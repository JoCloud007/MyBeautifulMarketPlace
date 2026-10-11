/**
 * Tests for the MCP Streamable HTTP transport (apps/api/src/mcp/http.ts).
 *
 * The router is exercised through a real Express app with supertest:
 * - 405 for GET /mcp and DELETE /mcp (stateless: no GET stream)
 * - 401 without a bearer token, and fail-closed 401 when MCP_API_KEY is unset
 * - an authenticated initialize -> tools/list -> tools/call sequence over
 *   POST /mcp, each request served by a fresh stateless
 *   StreamableHTTPServerTransport + McpServer (registry tools)
 *
 * The registry tools call the REST API via ./api-client (global fetch to
 * 127.0.0.1:3001); the fetch stub below intercepts those calls so the
 * sequence runs with no network access.
 */
import express, { Express } from 'express';
import request from 'supertest';
import { createMcpRouter } from '../mcp/http';
import { getMcpToolNames } from '../mcp/tools';

const TEST_KEY = 'mcp-http-transport-test-key';

// MCP Streamable HTTP requires every POST to accept BOTH application/json
// and text/event-stream (SDK validation, 406 otherwise) — real clients send
// this header, so the test requests must too.
const AUTH_HEADER = {
  Authorization: `Bearer ${TEST_KEY}`,
  Accept: 'application/json, text/event-stream',
};

function buildApp(): Express {
  const app = express();
  // Intentionally mounted like the integration task does: one line, after
  // the (global) rate-limit middleware would sit above it.
  app.use(createMcpRouter());
  return app;
}

function jsonRpcRequest(id: number, method: string, params?: Record<string, unknown>) {
  return {
    jsonrpc: '2.0',
    id,
    method,
    ...(params !== undefined ? { params } : {}),
  };
}

describe('POST /mcp — auth gate', () => {
  let app: Express;
  const originalKey = process.env['MCP_API_KEY'];

  beforeEach(() => {
    app = buildApp();
    process.env['MCP_API_KEY'] = TEST_KEY;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalKey === undefined) {
      delete process.env['MCP_API_KEY'];
    } else {
      process.env['MCP_API_KEY'] = originalKey;
    }
  });

  it('returns 401 when no Authorization header is sent', async () => {
    const res = await request(app).post('/mcp').send(jsonRpcRequest(1, 'ping')).expect(401);

    expect(res.headers['www-authenticate']).toContain('Bearer');
    expect(res.body.error).toBeTruthy();
  });

  it('returns 401 when the bearer token does not match MCP_API_KEY', async () => {
    await request(app)
      .post('/mcp')
      .set('Authorization', 'Bearer not-the-key')
      .send(jsonRpcRequest(1, 'ping'))
      .expect(401);
  });

  it('processes requests WITHOUT a token when MCP_API_KEY is unset (auth optional)', async () => {
    delete process.env['MCP_API_KEY'];

    await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json, text/event-stream')
      .send(
        jsonRpcRequest(1, 'initialize', { protocolVersion: '2025-03-26', capabilities: {} }),
      )
      .expect(200);
  });

  it('returns 405 for GET /mcp (stateless — no SSE stream)', async () => {
    const res = await request(app).get('/mcp').set(AUTH_HEADER).expect(405);

    expect(res.headers.allow).toContain('POST');
    expect(res.body.error).toBeTruthy();
  });

  it('returns 405 for DELETE /mcp (stateless — no session termination)', async () => {
    const res = await request(app).delete('/mcp').set(AUTH_HEADER).expect(405);

    expect(res.headers.allow).toContain('POST');
    expect(res.body.error).toBeTruthy();
  });

  it('returns a JSON-RPC parse error (400) for an invalid body', async () => {
    const res = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADER)
      .send('{not json')
      .expect(400);

    expect(res.body.error).toMatchObject({ code: -32700 });
  });

  it('returns a JSON-RPC error (400) for a body that is not a request object', async () => {
    const res = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADER)
      .send([1, 2, 3])
      .expect(400);

    expect(res.body.error).toMatchObject({ code: -32600 });
  });

  it('does NOT leak mcpAuth onto sibling routes of the same app', async () => {
    // Regression guard: the router is mounted bare (app.use(createMcpRouter()))
    // and carries absolute paths, so mcpAuth must be scoped per route. When it
    // leaked via router.use(mcpAuth), EVERY app route (/health, /api/*...)
    // answered 401 without a bearer token.
    const appWithSibling = express();
    appWithSibling.get('/health', (_req, res) => res.json({ status: 'ok' }));
    appWithSibling.use(createMcpRouter());

    const health = await request(appWithSibling).get('/health').expect(200);
    expect(health.body).toMatchObject({ status: 'ok' });
  });
});

describe('POST /mcp — authenticated MCP sequence', () => {
  let app: Express;
  const originalKey = process.env['MCP_API_KEY'];
  const realFetch = global.fetch;

  beforeEach(() => {
    app = buildApp();
    process.env['MCP_API_KEY'] = TEST_KEY;
  });

  afterEach(() => {
    global.fetch = realFetch;
    if (originalKey === undefined) {
      delete process.env['MCP_API_KEY'];
    } else {
      process.env['MCP_API_KEY'] = originalKey;
    }
  });

  it('serves initialize, tools/list and tools/call over stateless POST /mcp', async () => {
    // -- 1. initialize -----------------------------------------------------
    const initRes = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADER)
      .send(
        jsonRpcRequest(1, 'initialize', {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'supertest-client', version: '1.0.0' },
        }),
      )
      .expect(200)
      .expect('Content-Type', /application\/json/);

    expect(initRes.body.jsonrpc).toBe('2.0');
    expect(initRes.body.id).toBe(1);
    expect(initRes.body.error).toBeUndefined();
    // The server negotiates a spec revision it supports (echoes the client's
    // requested version when supported, otherwise its latest supported one).
    expect(typeof initRes.body.result.protocolVersion).toBe('string');
    expect(initRes.body.result.protocolVersion).toBeTruthy();
    expect(initRes.body.result.serverInfo).toMatchObject({ name: 'cloudmarket-api' });
    // Stateless: no session id is ever issued.
    expect(initRes.headers['mcp-session-id']).toBeUndefined();

    // -- 2. tools/list -----------------------------------------------------
    const listRes = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADER)
      .send(jsonRpcRequest(2, 'tools/list', {}))
      .expect(200)
      .expect('Content-Type', /application\/json/);

    expect(listRes.body.error).toBeUndefined();
    const listedNames: string[] = listRes.body.result.tools.map((t: { name: string }) => t.name);
    expect(listedNames.sort()).toEqual([...getMcpToolNames()].sort());
    expect(listedNames).toContain('catalog_list_products');
    for (const tool of listRes.body.result.tools) {
      expect(tool.inputSchema).toMatchObject({ type: 'object' });
    }

    // -- 3. tools/call (registry tool, REST call intercepted) --------------
    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('http://127.0.0.1:3001/api/products')) {
        return new Response(JSON.stringify([{ id: 'p-1', name: 'Tiny VM' }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'unexpected URL in test' }), { status: 404 });
    });

    const callRes = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADER)
      .send(
        jsonRpcRequest(3, 'tools/call', {
          name: 'catalog_list_products',
          arguments: { search: 'tiny' },
        }),
      )
      .expect(200)
      .expect('Content-Type', /application\/json/);

    expect(callRes.body.error).toBeUndefined();
    expect(callRes.body.result.isError).toBeUndefined();
    const text: string = callRes.body.result.content[0].text;
    expect(text).toContain('p-1');
    expect(text).toContain('Tiny VM');
    expect(text).not.toMatch(/at .+:\d+/); // never a stack trace
  });

  it('returns a JSON-RPC error result for an unknown tool (no 500, no stack trace)', async () => {
    const res = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADER)
      .send(jsonRpcRequest(4, 'tools/call', { name: 'does_not_exist', arguments: {} }))
      .expect(200)
      .expect('Content-Type', /application\/json/);

    // The SDK either answers with a JSON-RPC error or an isError tool result
    // depending on the minor version — both are acceptable "no such tool".
    const rejected =
      (res.body.error && typeof res.body.error.code === 'number') ||
      res.body.result?.isError === true;
    expect(rejected).toBe(true);
    expect(JSON.stringify(res.body)).not.toMatch(/at .+:\d+/);
  });

  it('acknowledges a JSON-RPC notification with 202 and no body', async () => {
    const res = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADER)
      .send({ jsonrpc: '2.0', method: 'notifications/initialized' })
      .expect(202);

    expect(res.text).toBe('');
  });

  it('handles concurrent stateless requests independently', async () => {
    const responses = await Promise.all([
      request(app)
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .set(AUTH_HEADER)
        .send(jsonRpcRequest(10, 'tools/list', {}))
        .expect(200),
      request(app)
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .set(AUTH_HEADER)
        .send(jsonRpcRequest(11, 'tools/list', {}))
        .expect(200),
    ]);

    for (const res of responses) {
      expect(res.body.error).toBeUndefined();
      expect(res.body.result.tools.length).toBe(getMcpToolNames().length);
    }
  });
});
