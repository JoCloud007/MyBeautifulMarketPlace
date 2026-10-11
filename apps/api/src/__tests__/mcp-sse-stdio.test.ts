/**
 * Tests for the MCP fallback transports:
 *
 * - apps/api/src/mcp/sse.ts — legacy SSE transport, opt-in behind
 *   MCP_ENABLE_SSE=1 (off by default) with mcpAuth on both /sse and
 *   /messages; exercised with the REAL SDK SSEServerTransport over a
 *   listening server (the stream stays open, so supertest is only used
 *   for requests that complete).
 * - apps/api/src/mcp/stdio.ts — local stdio entry reusing buildMcpServer()
 *   so the tool list is identical to the HTTP transport. The SDK's
 *   StdioServerTransport is mocked so tests never hijack stdin/stdout.
 */
import * as http from 'http';
import type { AddressInfo } from 'net';
import express, { Express } from 'express';
import request from 'supertest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  createSseRouter,
  isSseTransportEnabled,
  MCP_ENABLE_SSE_ENV_VAR,
  SSE_ENDPOINT_PATH,
  SSE_MESSAGES_PATH,
} from '../mcp/sse';
import { MCP_API_KEY_ENV_VAR } from '../mcp/auth';
import { buildMcpServer } from '../mcp/server';
import { getMcpToolNames } from '../mcp/tools';
import { main as runStdioMain } from '../mcp/stdio';

// The stdio test connects a real McpServer to a fake transport: the mock
// implements the Transport surface Protocol.connect() needs (start/send/
// close + callback slots) without touching the real stdin/stdout streams.
jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => {
  class MockStdioServerTransport {
    static lastInstance: MockStdioServerTransport | undefined;

    onmessage: unknown;
    onerror: unknown;
    onclose: unknown;
    started = false;
    closed = false;

    constructor() {
      MockStdioServerTransport.lastInstance = this;
    }

    async start(): Promise<void> {
      this.started = true;
    }

    async send(_message: unknown): Promise<void> {
      return undefined;
    }

    async close(): Promise<void> {
      this.closed = true;
    }
  }
  return { StdioServerTransport: MockStdioServerTransport };
});

const TEST_KEY = 'mcp-sse-stdio-test-key';
const AUTH = { Authorization: `Bearer ${TEST_KEY}` };

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function buildApp(): Express {
  const app = express();
  // Mounted like the integration task does: one line, next to
  // app.use(createMcpRouter()). Routes are absolute (/sse, /messages).
  app.use(createSseRouter());
  return app;
}

interface SseProbe {
  sessionId: string;
  statusCode?: number;
  contentType?: string;
  req: http.ClientRequest;
  stream: http.IncomingMessage;
}

/** Open a real GET /sse stream against a listening server and resolve with the announced sessionId. */
function openSseStream(srv: http.Server, headers: Record<string, string>): Promise<SseProbe> {
  const port = (srv.address() as AddressInfo).port;
  return new Promise<SseProbe>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Timed out waiting for the SSE endpoint event'));
      }
    }, 10000);

    const req = http.request(
      { host: '127.0.0.1', port, path: SSE_ENDPOINT_PATH, headers },
      (stream) => {
        let data = '';
        stream.setEncoding('utf8');
        stream.on('data', (chunk: string) => {
          data += chunk;
          // Legacy MCP SSE: the transport announces the POST endpoint as
          //   event: endpoint
          //   data: /messages?sessionId=<uuid>
          const match = /event: endpoint\ndata: ([^\r\n]+)/.exec(data);
          if (match && !settled) {
            settled = true;
            clearTimeout(timer);
            const url = new URL(match[1].trim(), 'http://127.0.0.1');
            resolve({
              sessionId: url.searchParams.get('sessionId') ?? '',
              statusCode: stream.statusCode,
              contentType: String(stream.headers['content-type'] ?? ''),
              req,
              stream,
            });
          }
        });
        stream.on('error', () => undefined); // ECONNRESET on destroy is expected
        stream.on('close', () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(new Error('SSE stream closed before the endpoint event'));
          }
        });
      },
    );
    req.on('error', () => undefined);
    req.end();
  });
}

/** Tear down the SSE client and the listening server (no jest open handles). */
async function shutdownServer(
  srv: http.Server,
  probe?: Pick<SseProbe, 'req' | 'stream'>,
): Promise<void> {
  probe?.stream.destroy();
  probe?.req.destroy();
  (srv as unknown as { closeAllConnections?: () => void }).closeAllConnections?.();
  await new Promise<void>((resolve) => srv.close(() => resolve()));
}

describe('SSE transport gating — MCP_ENABLE_SSE (default off)', () => {
  let app: Express;
  const originalEnable = process.env[MCP_ENABLE_SSE_ENV_VAR];
  const originalKey = process.env[MCP_API_KEY_ENV_VAR];

  beforeEach(() => {
    app = buildApp();
    process.env[MCP_API_KEY_ENV_VAR] = TEST_KEY;
    delete process.env[MCP_ENABLE_SSE_ENV_VAR]; // default state: disabled
  });

  afterEach(() => {
    if (originalEnable === undefined) {
      delete process.env[MCP_ENABLE_SSE_ENV_VAR];
    } else {
      process.env[MCP_ENABLE_SSE_ENV_VAR] = originalEnable;
    }
    if (originalKey === undefined) {
      delete process.env[MCP_API_KEY_ENV_VAR];
    } else {
      process.env[MCP_API_KEY_ENV_VAR] = originalKey;
    }
  });

  it('is disabled when MCP_ENABLE_SSE is unset', () => {
    expect(isSseTransportEnabled()).toBe(false);
  });

  it('is enabled only when MCP_ENABLE_SSE is exactly "1"', () => {
    process.env[MCP_ENABLE_SSE_ENV_VAR] = '0';
    expect(isSseTransportEnabled()).toBe(false);

    process.env[MCP_ENABLE_SSE_ENV_VAR] = 'true';
    expect(isSseTransportEnabled()).toBe(false);

    process.env[MCP_ENABLE_SSE_ENV_VAR] = '1';
    expect(isSseTransportEnabled()).toBe(true);
  });

  it('answers 404 on GET /sse when MCP_ENABLE_SSE is unset — even with a valid token', async () => {
    const res = await request(app).get(SSE_ENDPOINT_PATH).set(AUTH).expect(404);

    expect(res.body.error).toMatch(/MCP_ENABLE_SSE/);
  });

  it('answers 404 on GET /sse when MCP_ENABLE_SSE=0', async () => {
    process.env[MCP_ENABLE_SSE_ENV_VAR] = '0';

    await request(app).get(SSE_ENDPOINT_PATH).set(AUTH).expect(404);
  });

  it('answers 404 on POST /messages when MCP_ENABLE_SSE is unset', async () => {
    const res = await request(app)
      .post(`${SSE_MESSAGES_PATH}?sessionId=11111111-1111-4111-8111-111111111111`)
      .set('Content-Type', 'application/json')
      .set(AUTH)
      .send({ jsonrpc: '2.0', id: 1, method: 'ping' })
      .expect(404);

    expect(res.body.error).toMatch(/MCP_ENABLE_SSE/);
  });

  it('answers 404 without ever consulting auth when disabled (no 401)', async () => {
    await request(app).get(SSE_ENDPOINT_PATH).expect(404); // no Authorization header at all
  });
});

describe('SSE transport enabled (MCP_ENABLE_SSE=1) — mcpAuth enforced', () => {
  let app: Express;
  const originalEnable = process.env[MCP_ENABLE_SSE_ENV_VAR];
  const originalKey = process.env[MCP_API_KEY_ENV_VAR];

  beforeEach(() => {
    app = buildApp();
    process.env[MCP_ENABLE_SSE_ENV_VAR] = '1';
    process.env[MCP_API_KEY_ENV_VAR] = TEST_KEY;
  });

  afterEach(() => {
    if (originalEnable === undefined) {
      delete process.env[MCP_ENABLE_SSE_ENV_VAR];
    } else {
      process.env[MCP_ENABLE_SSE_ENV_VAR] = originalEnable;
    }
    if (originalKey === undefined) {
      delete process.env[MCP_API_KEY_ENV_VAR];
    } else {
      process.env[MCP_API_KEY_ENV_VAR] = originalKey;
    }
  });

  it('requires a bearer token on GET /sse (401 without / 401 with wrong token)', async () => {
    const res = await request(app).get(SSE_ENDPOINT_PATH).expect(401);

    expect(res.headers['www-authenticate']).toContain('Bearer');

    await request(app)
      .get(SSE_ENDPOINT_PATH)
      .set('Authorization', 'Bearer not-the-key')
      .expect(401);
  });

  it('requires a bearer token on POST /messages', async () => {
    await request(app)
      .post(`${SSE_MESSAGES_PATH}?sessionId=22222222-2222-4222-8222-222222222222`)
      .set('Content-Type', 'application/json')
      .send({ jsonrpc: '2.0', id: 1, method: 'ping' })
      .expect(401);

    await request(app)
      .post(`${SSE_MESSAGES_PATH}?sessionId=22222222-2222-4222-8222-222222222222`)
      .set('Content-Type', 'application/json')
      .set('Authorization', 'Bearer not-the-key')
      .send({ jsonrpc: '2.0', id: 1, method: 'ping' })
      .expect(401);
  });

  it('still enforces 401 on GET /sse with a WRONG token when MCP_API_KEY is configured', async () => {
    // When the key is UNSET, auth is disabled (optional auth) and GET /sse
    // opens a live SSE stream — supertest would hang on it, so the fail-open
    // path is proven on the middleware directly (see mcp-auth.test.ts).
    // Here we keep the mis-token rejection, which terminates cleanly.
    process.env[MCP_API_KEY_ENV_VAR] = 'real-key';
    try {
      await request(app)
        .get(SSE_ENDPOINT_PATH)
        .set('Authorization', 'Bearer not-the-key')
        .expect(401);
    } finally {
      delete process.env[MCP_API_KEY_ENV_VAR];
    }
  });

  it('answers 404 for POST /messages without a sessionId parameter', async () => {
    const res = await request(app)
      .post(SSE_MESSAGES_PATH)
      .set('Content-Type', 'application/json')
      .set(AUTH)
      .send({ jsonrpc: '2.0', id: 1, method: 'ping' })
      .expect(404);

    expect(res.body.error).toMatch(/session/i);
  });

  it('answers 404 for POST /messages with an unknown or closed sessionId', async () => {
    const res = await request(app)
      .post(`${SSE_MESSAGES_PATH}?sessionId=33333333-3333-4333-8333-333333333333`)
      .set('Content-Type', 'application/json')
      .set(AUTH)
      .send({ jsonrpc: '2.0', id: 1, method: 'ping' })
      .expect(404);

    expect(res.body.error).toMatch(/session/i);
  });
});

describe('SSE transport enabled — real SDK SSEServerTransport round trip', () => {
  let app: Express;
  const originalEnable = process.env[MCP_ENABLE_SSE_ENV_VAR];
  const originalKey = process.env[MCP_API_KEY_ENV_VAR];

  beforeEach(() => {
    app = buildApp();
    process.env[MCP_ENABLE_SSE_ENV_VAR] = '1';
    process.env[MCP_API_KEY_ENV_VAR] = TEST_KEY;
  });

  afterEach(() => {
    if (originalEnable === undefined) {
      delete process.env[MCP_ENABLE_SSE_ENV_VAR];
    } else {
      process.env[MCP_ENABLE_SSE_ENV_VAR] = originalEnable;
    }
    if (originalKey === undefined) {
      delete process.env[MCP_API_KEY_ENV_VAR];
    } else {
      process.env[MCP_API_KEY_ENV_VAR] = originalKey;
    }
  });

  it('opens GET /sse, announces /messages?sessionId=..., accepts POST /messages and cleans up on disconnect', async () => {
    const srv = await new Promise<http.Server>((resolve, reject) => {
      const listening = http.createServer(app);
      listening.once('error', reject);
      listening.listen(0, '127.0.0.1', () => resolve(listening));
    });

    let probe: SseProbe | undefined;
    try {
      probe = await openSseStream(srv, AUTH);

      // SSE stream opened with the expected status and content type.
      expect(probe.statusCode).toBe(200);
      expect(probe.contentType).toContain('text/event-stream');
      expect(probe.sessionId).toBeTruthy();

      // Client-to-server message for the announced session: the legacy
      // transport accepts it with 202 (replies flow over the SSE stream).
      const post = await request(app)
        .post(`${SSE_MESSAGES_PATH}?sessionId=${encodeURIComponent(probe.sessionId)}`)
        .set('Content-Type', 'application/json')
        .set(AUTH)
        .send({ jsonrpc: '2.0', id: 1, method: 'ping' });
      expect([200, 202]).toContain(post.status);

      // Disconnect -> the session pair is closed and removed.
      probe.stream.destroy();
      probe.req.destroy();
      await delay(150);

      await request(app)
        .post(`${SSE_MESSAGES_PATH}?sessionId=${encodeURIComponent(probe.sessionId)}`)
        .set('Content-Type', 'application/json')
        .set(AUTH)
        .send({ jsonrpc: '2.0', id: 2, method: 'ping' })
        .expect(404);

      probe = undefined; // already torn down
    } finally {
      await shutdownServer(srv, probe);
    }
  });
});

describe('stdio transport entry (apps/api/src/mcp/stdio.ts)', () => {
  const mockedStdio = jest.requireMock(
    '@modelcontextprotocol/sdk/server/stdio.js',
  ) as {
    StdioServerTransport: { lastInstance?: { started: boolean; closed: boolean } };
  };

  afterEach(() => {
    mockedStdio.StdioServerTransport.lastInstance = undefined;
  });

  it('builds the shared MCP server and connects it to a StdioServerTransport', async () => {
    await runStdioMain();

    const transport = mockedStdio.StdioServerTransport.lastInstance;
    expect(transport).toBeDefined();
    // Protocol.connect() called transport.start() — i.e. the McpServer from
    // buildMcpServer() is live on the stdio transport.
    expect(transport?.started).toBe(true);
    expect(transport?.closed).toBe(false);
  });

  it('exposes the same tool list as the HTTP transport (shared buildMcpServer registry)', async () => {
    // stdio.ts and http.ts both build their server with buildMcpServer();
    // verify that factory's tools/list output equals the shared registry.
    const server = buildMcpServer();
    const client = new Client({ name: 'stdio-test-client', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(clientTransport), client.connect(serverTransport)]);

    try {
      const { tools } = await client.listTools();
      const listedNames = tools.map((tool) => tool.name).sort();
      expect(listedNames).toEqual([...getMcpToolNames()].sort());
      expect(listedNames.length).toBe(getMcpToolNames().length);
      for (const tool of tools) {
        expect(tool.inputSchema).toMatchObject({ type: 'object' });
      }
    } finally {
      await client.close();
      await server.close();
    }
  });
});
