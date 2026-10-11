/**
 * Tests for the shared MCP tool registry (apps/api/src/mcp/tools.ts) and
 * buildMcpServer() (apps/api/src/mcp/server.ts).
 *
 * The McpServer is exercised through the SDK InMemoryTransport so the
 * tools/list output (zod -> JSON inputSchema conversion) is verified
 * end-to-end without any network access.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { buildMcpServer } from '../mcp/server';
import {
  getMcpToolGroups,
  getMcpToolNames,
  getMcpToolSummaries,
} from '../mcp/tools';

jest.mock('../mcp/api-client', () => {
  const actual = jest.requireActual('../mcp/api-client');
  return {
    ...actual,
    apiGet: jest.fn(),
    apiPost: jest.fn(),
    apiPatch: jest.fn(),
    apiDelete: jest.fn(),
  };
});

import {
  apiGet,
  apiPost,
} from '../mcp/api-client';

const mockedApiGet = apiGet as jest.Mock;
const mockedApiPost = apiPost as jest.Mock;

describe('MCP shared tool registry', () => {
  it('declares non-empty tool groups with name and description', () => {
    const groups = getMcpToolGroups();
    expect(groups.length).toBeGreaterThanOrEqual(4);
    for (const group of groups) {
      expect(group.name).toBeTruthy();
      expect(group.description).toBeTruthy();
      expect(group.tools.length).toBeGreaterThan(0);
    }
  });

  it('declares a zod input schema and a description for every tool', () => {
    const summaries = getMcpToolSummaries();
    expect(summaries.length).toBeGreaterThan(0);
    for (const summary of summaries) {
      expect(summary.description).toBeTruthy();
      // Every schema is a zod object (converted to JSON inputSchema at
      // registration time by the SDK).
      expect(summary.schemaType).toBe('ZodObject');
    }
  });

  it('uses unique tool names across all groups', () => {
    const names = getMcpToolNames();
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('buildMcpServer()', () => {
  let client: Client;
  let server: McpServer;

  beforeEach(async () => {
    jest.clearAllMocks();
    server = buildMcpServer();
    client = new Client({ name: 'test-client', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(clientTransport), client.connect(serverTransport)]);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
    delete process.env.ADMIN_API_KEY;
  });

  it('returns an McpServer exposing exactly the registry tools via tools/list', async () => {
    const { tools } = await client.listTools();
    const listedNames = tools.map((tool) => tool.name).sort();
    const registryNames = getMcpToolNames().sort();

    expect(listedNames).toEqual(registryNames);
    expect(listedNames.length).toBeGreaterThan(20);
  });

  it('exposes a JSON inputSchema object (converted from zod) for every tool', async () => {
    const { tools } = await client.listTools();
    for (const tool of tools) {
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toMatchObject({ type: 'object' });
      expect(tool.inputSchema.properties).toBeDefined();
    }
  });

  it('announces the cloudmarket server identity during initialize', async () => {
    const serverInfo = client.getServerVersion();
    expect(serverInfo).toMatchObject({ name: 'cloudmarket-api' });
  });

  it('serves a successful tool call by proxying the internal REST API', async () => {
    mockedApiGet.mockResolvedValueOnce({ ok: true, status: 200, data: [{ id: 'p1' }] });

    const result = await client.callTool({ name: 'catalog_list_products', arguments: { search: 'compute' } });

    expect(mockedApiGet).toHaveBeenCalledWith('/api/products', {
      category: undefined,
      computeType: undefined,
      search: 'compute',
    });
    expect(result.isError).toBeUndefined();
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('p1');
  });

  it('returns a readable isError result when the API call fails', async () => {
    mockedApiGet.mockResolvedValueOnce({
      ok: false,
      status: 404,
      error: 'Not found (404): GET /api/products/xxx does not exist on the CloudMarket API',
    });

    const result = await client.callTool({
      name: 'catalog_get_product',
      arguments: { id: '11111111-1111-1111-1111-111111111111' },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('Not found (404)');
    expect(text).not.toMatch(/at .+:\d+/); // no stack trace frames
  });

  it('rejects calls whose arguments violate the zod input schema', async () => {
    const result = await client.callTool({
      name: 'catalog_get_product',
      arguments: { id: 'not-a-uuid' },
    });
    expect(result.isError).toBe(true);
  });

  it('sends admin tool bodies to admin routes with the admin flag', async () => {
    // Admin tools register ONLY when ADMIN_API_KEY is configured (evaluated
    // at buildMcpServer() time) — provide it, then rebuild server+client.
    process.env.ADMIN_API_KEY = 'registry-test-admin-key';
    await client.close();
    await server.close();
    server = buildMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(clientTransport), client.connect(serverTransport)]);

    mockedApiPost.mockResolvedValueOnce({ ok: true, status: 201, data: { id: 'u1' } });

    await client.callTool({
      name: 'admin_create_user',
      arguments: { email: 'a@b.io', name: 'Alice' },
    });

    expect(mockedApiPost).toHaveBeenCalledWith(
      '/api/admin/users',
      { email: 'a@b.io', name: 'Alice' },
      { admin: true },
    );
  });
});
