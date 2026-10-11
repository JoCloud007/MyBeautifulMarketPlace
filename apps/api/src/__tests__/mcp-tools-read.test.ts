/**
 * Tests for the read-only MCP tool groups owned by the "mcp-tools-read"
 * work unit:
 * - marketplace  → apps/api/src/mcp/tools/marketplace.ts
 * - availability → apps/api/src/mcp/tools/availability.ts
 * - ops          → apps/api/src/mcp/tools/ops.ts
 *
 * Coverage:
 * - the registered tool list: group/tool names, MCP-spec compliance and
 *   zod object input schemas (registration-ready for the shared registry
 *   in ../mcp/tools);
 * - at least one tools/call per tool group through the internal api-client,
 *   verifying the targeted /api/* routes and the JSON passthrough;
 * - the ops group exposes no mutating operation (GET-backed only);
 * - API errors (404/409/401 and ZodError payloads) surface as readable,
 *   single-line, stack-free tool-result messages.
 *
 * The SDK-level tools/list behaviour of the shared registry is covered by
 * mcp-registry.test.ts; this suite exercises the group definitions and
 * their handlers directly through the api-client.
 */
import { z } from 'zod';
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiRequest,
  toToolResult,
  translateHttpError,
} from '../mcp/api-client';
import { marketplaceGroup } from '../mcp/tools/marketplace';
import { availabilityGroup } from '../mcp/tools/availability';
import { opsGroup } from '../mcp/tools/ops';
import type { McpToolDefinition, McpToolGroup } from '../mcp/tools';

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

const mockedApiGet = apiGet as unknown as jest.Mock;
const mockedApiPost = apiPost as unknown as jest.Mock;
const mockedApiPatch = apiPatch as unknown as jest.Mock;
const mockedApiDelete = apiDelete as unknown as jest.Mock;

const readOnlyGroups: McpToolGroup[] = [marketplaceGroup, availabilityGroup, opsGroup];
const allTools: McpToolDefinition[] = readOnlyGroups.flatMap((group) => group.tools);
const toolByName = new Map(allTools.map((tool) => [tool.name, tool]));
const call = (name: string, args: unknown = {}) => toolByName.get(name)!.handler(args);

const UUID = '11111111-1111-1111-1111-111111111111';

/** Minimal valid arguments per tool with required path parameters. */
const sampleArgs: Record<string, Record<string, unknown>> = {
  marketplace_get_product: { slug: 'ubuntu-vm' },
  marketplace_get_category: { slug: 'compute' },
  marketplace_get_flavor: { id: UUID },
  marketplace_list_product_variants: { productId: UUID },
  marketplace_get_variant: { id: UUID },
  availability_get_zone: { id: UUID },
  availability_get_availability_zone: { id: UUID },
  ops_list_health_checks: { instanceId: UUID },
  ops_list_maintenance_windows: { instanceId: UUID },
  ops_list_instance_backups: { instanceId: UUID },
  ops_get_backup: { id: UUID },
};

describe('read-only MCP tool groups (marketplace, availability, ops)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApiGet.mockResolvedValue({ ok: true, status: 200, data: { ok: true } });
  });

  describe('registered tool list', () => {
    it('registers one read-only group per domain', () => {
      expect(readOnlyGroups.map((group) => group.name)).toEqual([
        'marketplace',
        'availability',
        'ops',
      ]);
      for (const group of readOnlyGroups) {
        expect(group.description).toBeTruthy();
        expect(group.tools.length).toBeGreaterThan(0);
      }
    });

    it('names every tool uniquely, MCP-spec compliant and prefixed by its group', () => {
      const names = allTools.map((tool) => tool.name);
      expect(new Set(names).size).toBe(names.length);
      for (const group of readOnlyGroups) {
        for (const tool of group.tools) {
          expect(tool.name).toMatch(/^[a-zA-Z0-9_-]{1,128}$/);
          expect(tool.name.startsWith(`${group.name}_`)).toBe(true);
          expect(tool.description).toBeTruthy();
        }
      }
    });

    it('covers the requested read-only surface', () => {
      const expected = new Set([
        // marketplace — products, categories, flavors, os, variants
        'marketplace_list_products',
        'marketplace_get_product',
        'marketplace_list_categories',
        'marketplace_get_category',
        'marketplace_list_flavors',
        'marketplace_get_flavor',
        'marketplace_list_os',
        'marketplace_list_product_variants',
        'marketplace_get_variant',
        // availability — zones, availability zones
        'availability_list_zones',
        'availability_get_zone',
        'availability_list_availability_zones',
        'availability_get_availability_zone',
        // ops — health, topology, maintenance windows, backups (read only)
        'ops_health',
        'ops_get_topology',
        'ops_list_health_checks',
        'ops_health_check_stats',
        'ops_list_maintenance_windows',
        'ops_maintenance_window_stats',
        'ops_list_instance_backups',
        'ops_get_backup',
      ]);
      expect(allTools.map((tool) => tool.name).sort()).toEqual([...expected].sort());
    });

    it('declares a zod object input schema for every tool (registration-ready)', () => {
      for (const tool of allTools) {
        expect(tool.inputSchema).toBeInstanceOf(z.ZodObject);
        expect(typeof tool.inputSchema.shape).toBe('object');
        const parsed = tool.inputSchema.safeParse(sampleArgs[tool.name] ?? {});
        expect(parsed.success).toBe(true);
      }
    });

    it('exposes no mutating operation (every handler is GET-backed)', async () => {
      for (const group of readOnlyGroups) {
        for (const tool of group.tools) {
          await tool.handler(sampleArgs[tool.name] ?? {});
        }
      }
      expect(mockedApiGet).toHaveBeenCalledTimes(allTools.length);
      expect(mockedApiPost).not.toHaveBeenCalled();
      expect(mockedApiPatch).not.toHaveBeenCalled();
      expect(mockedApiDelete).not.toHaveBeenCalled();
    });
  });

  describe('tools/call per group through the api-client', () => {
    it('marketplace_list_products proxies GET /api/products with its filters', async () => {
      mockedApiGet.mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: [{ id: 'p1', name: 'compute-node' }],
      });

      const result = await call('marketplace_list_products', { search: 'gpu' });

      expect(mockedApiGet).toHaveBeenCalledWith('/api/products', {
        category: undefined,
        computeType: undefined,
        search: 'gpu',
      });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('compute-node');
    });

    it('marketplace_get_product targets GET /api/products/:slug', async () => {
      mockedApiGet.mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: { slug: 'ubuntu-vm', variants: [] },
      });

      const result = await call('marketplace_get_product', { slug: 'ubuntu-vm' });

      expect(mockedApiGet).toHaveBeenCalledWith('/api/products/ubuntu-vm');
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('ubuntu-vm');
    });

    it('marketplace group reads variants through the existing routes', async () => {
      await call('marketplace_list_product_variants', { productId: UUID });
      expect(mockedApiGet).toHaveBeenCalledWith(`/api/products/${UUID}/variants`);

      await call('marketplace_get_variant', { id: UUID });
      expect(mockedApiGet).toHaveBeenCalledWith(`/api/variants/${UUID}`);
    });

    it('availability_list_availability_zones proxies GET /api/availability-zones', async () => {
      mockedApiGet.mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: [{ id: 'az1', code: 'eu-west-par1', region: 'eu-west' }],
      });

      const result = await call('availability_list_availability_zones');

      expect(mockedApiGet).toHaveBeenCalledWith('/api/availability-zones');
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('eu-west-par1');
    });

    it('availability_get_zone targets GET /api/zones/:id', async () => {
      await call('availability_get_zone', { id: UUID });
      expect(mockedApiGet).toHaveBeenCalledWith(`/api/zones/${UUID}`);
    });

    it('ops_list_maintenance_windows proxies GET /api/maintenance-windows with filters', async () => {
      mockedApiGet.mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: [{ id: 'mw1', title: 'DB patching', status: 'SCHEDULED' }],
      });

      const result = await call('ops_list_maintenance_windows', {
        instanceId: UUID,
        status: 'SCHEDULED',
      });

      expect(mockedApiGet).toHaveBeenCalledWith('/api/maintenance-windows', {
        instanceId: UUID,
        applicationId: undefined,
        status: 'SCHEDULED',
      });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('DB patching');
    });

    it('ops_health targets the existing GET /health endpoint', async () => {
      mockedApiGet.mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: { status: 'ok', timestamp: '2026-01-01T00:00:00.000Z' },
      });

      const result = await call('ops_health');

      expect(mockedApiGet).toHaveBeenCalledWith('/health');
      expect(result.content[0].text).toContain('"status": "ok"');
    });

    it('ops group reads backups without exposing restore or create', async () => {
      await call('ops_list_instance_backups', { instanceId: UUID });
      expect(mockedApiGet).toHaveBeenCalledWith(`/api/backups/instances/${UUID}/backups`);

      await call('ops_get_backup', { id: UUID });
      expect(mockedApiGet).toHaveBeenCalledWith(`/api/backups/${UUID}`);

      const opsNames = opsGroup.tools.map((tool) => tool.name);
      expect(opsNames).not.toContain('ops_create_backup');
      expect(opsNames).not.toContain('ops_restore_backup');
    });
  });

  describe('error surfacing', () => {
    const fetchMock = jest.fn();

    function jsonResponse(status: number, body: unknown): unknown {
      return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => JSON.stringify(body),
      };
    }

    beforeAll(() => {
      (global as unknown as Record<string, unknown>).fetch = fetchMock;
    });

    afterAll(() => {
      delete (global as unknown as Record<string, unknown>).fetch;
    });

    beforeEach(() => {
      fetchMock.mockReset();
    });

    it('surfaces 404 as a readable isError tool result through a handler', async () => {
      mockedApiGet.mockResolvedValueOnce({
        ok: false,
        status: 404,
        error: translateHttpError(404, { error: 'Product not found' }, 'GET', '/api/products/nope'),
      });

      const result = await call('marketplace_get_product', { slug: 'nope' });

      expect(result.isError).toBe(true);
      const text = result.content[0].text;
      expect(text).toContain('Not found (404)');
      expect(text).toContain('Product not found');
      expect(text).not.toMatch(/\s+at\s/); // no stack frames
      expect(text).not.toContain('\n'); // single readable line
    });

    it('surfaces 401 with the credential hint and no stack trace', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: 'Unauthorized' }));

      const result = await apiRequest('GET', '/api/zones');
      const toolResult = toToolResult(result);

      expect(toolResult.isError).toBe(true);
      expect(toolResult.content[0].text).toContain('Unauthorized (401)');
      expect(toolResult.content[0].text).toContain('ADMIN_API_KEY');
      // Stack-frame anchored: "    at fn (file.ts:1:2)" — avoids matching
      // English words like "at most 200 character(s)" in validation text.
      expect(toolResult.content[0].text).not.toMatch(/(^|\n)\s+at\s+\S+:\d+/);
    });

    it('surfaces 409 conflicts with the API message', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(409, { error: 'Conflict', message: 'A record with this slug already exists' }),
      );

      const result = await apiRequest('POST', '/api/categories', { body: { name: 'dup' } });
      const toolResult = toToolResult(result);

      expect(toolResult.isError).toBe(true);
      expect(toolResult.content[0].text).toContain('Conflict (409)');
      expect(toolResult.content[0].text).toContain('A record with this slug already exists');
    });

    it('renders ZodError payloads as one readable validation line', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(400, {
          error: 'Validation Error',
          details: [{ path: 'search', message: 'String must contain at most 200 character(s)' }],
        }),
      );

      const result = await apiRequest('GET', '/api/products', { query: { search: 'x'.repeat(201) } });
      const toolResult = toToolResult(result);

      expect(toolResult.isError).toBe(true);
      expect(toolResult.content[0].text).toBe(
        'Validation failed (400) for GET /api/products: search: String must contain at most 200 character(s)',
      );
      expect(toolResult.content[0].text).not.toContain('ZodError');
      // Stack-frame anchored: "    at fn (file.ts:1:2)" — avoids matching
      // English words like "at most 200 character(s)" in validation text.
      expect(toolResult.content[0].text).not.toMatch(/(^|\n)\s+at\s+\S+:\d+/);
    });
  });
});
