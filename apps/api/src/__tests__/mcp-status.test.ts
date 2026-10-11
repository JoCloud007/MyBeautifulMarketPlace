/**
 * Tests for GET /api/mcp-status (apps/api/src/routes/mcp-status.ts).
 *
 * The status endpoint must reveal ONLY non-sensitive state: booleans and
 * counts. The API key itself must NEVER appear in the response, whatever
 * the environment contains.
 */
import request from 'supertest';
import express, { Express } from 'express';
import { mcpStatusRouter, buildMcpStatus } from '../routes/mcp-status';
import { MCP_ENDPOINT_PATH } from '../mcp/http';

function buildApp(): Express {
  const app = express();
  app.use('/api', mcpStatusRouter);
  return app;
}

describe('GET /api/mcp-status', () => {
  const originalKey = process.env['MCP_API_KEY'];
  const originalSse = process.env['MCP_ENABLE_SSE'];

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env['MCP_API_KEY'];
    } else {
      process.env['MCP_API_KEY'] = originalKey;
    }
    if (originalSse === undefined) {
      delete process.env['MCP_ENABLE_SSE'];
    } else {
      process.env['MCP_ENABLE_SSE'] = originalSse;
    }
  });

  it('reports enabled=true with group and tool counts, never the key', async () => {
    const secret = 'status-test-secret-key';
    process.env['MCP_API_KEY'] = secret;

    const res = await request(buildApp()).get('/api/mcp-status').expect(200);

    expect(res.body.enabled).toBe(true);
    expect(res.body.endpoint).toBe(MCP_ENDPOINT_PATH);
    expect(res.body.transport).toBe('streamable-http');
    expect(res.body.toolCount).toBeGreaterThan(20);
    expect(res.body.groups.length).toBeGreaterThanOrEqual(4);
    // The secret must never leak — in any string field of the payload.
    expect(res.text).not.toContain(secret);
  });

  it('reports authRequired=false when MCP_API_KEY is unset (auth optional)', async () => {
    delete process.env['MCP_API_KEY'];

    const res = await request(buildApp()).get('/api/mcp-status').expect(200);

    expect(res.body.enabled).toBe(true);
    expect(res.body.authRequired).toBe(false);
  });

  it('reports sseEnabled=true only when MCP_ENABLE_SSE=1', async () => {
    process.env['MCP_ENABLE_SSE'] = '0';
    expect(buildMcpStatus().sseEnabled).toBe(false);

    process.env['MCP_ENABLE_SSE'] = '1';
    expect(buildMcpStatus().sseEnabled).toBe(true);
  });

  it('lists tool names per group (for the connection page)', async () => {
    const res = await request(buildApp()).get('/api/mcp-status').expect(200);

    const catalog = res.body.groups.find((g: { name: string }) => g.name === 'catalog');
    expect(catalog).toBeDefined();
    expect(catalog.tools.map((t: { name: string }) => t.name)).toContain(
      'catalog_list_products',
    );
    for (const group of res.body.groups) {
      expect(group.toolCount).toBe(group.tools.length);
    }
  });
});
