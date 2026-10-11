/**
 * Tests for the write-path MCP tools owned by the "mcp-tools-write" work
 * unit:
 * - forecast lifecycle → apps/api/src/mcp/tools/forecasts.ts
 * - conditional admin  → apps/api/src/mcp/tools/admin.ts
 *
 * Coverage:
 * - a full forecast tools/call round-trip through the MCP SDK
 *   (InMemoryTransport): tools/list, create → submit → approve → reject →
 *   cancel → resubmit → get → list → delete, all hitting the matching
 *   /api/forecasts endpoints;
 * - the conditional admin registration: with no ADMIN_API_KEY the admin
 *   tools are absent from tools/list; with ADMIN_API_KEY set they are
 *   listed and callable;
 * - header propagation: admin tool calls forward x-admin-api-key verbatim
 *   to /api/admin;
 * - API errors (400/401/409, ZodError payloads) surface as readable,
 *   single-line, stack-free tool-result messages.
 *
 * Unlike the other MCP suites (which mock ../mcp/api-client), this suite
 * mocks global.fetch only, so every tools/call exercises the real
 * api-client — URL building, JSON serialization, the x-admin-api-key
 * header and error translation included.
 */
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { forecastsGroup } from '../mcp/tools/forecasts';
import {
  buildAdminGroup,
  isAdminApiConfigured,
  registerAdminTools,
  registerToolGroup,
} from '../mcp/tools/admin';

const fetchMock = jest.fn();

/** Minimal Response stand-in — api-client only uses ok/status/text(). */
function jsonResponse(status: number, body: unknown): unknown {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === '' ? '' : JSON.stringify(body)),
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
  delete process.env.ADMIN_API_KEY;
});

afterEach(() => {
  delete process.env.ADMIN_API_KEY;
});

/** Build an MCP server + connected client with the given registrations. */
async function createConnectedPair(
  register: (server: McpServer) => void,
): Promise<{ server: McpServer; client: Client }> {
  const server = new McpServer({ name: 'test-server', version: '1.0.0' });
  register(server);
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(clientTransport), client.connect(serverTransport)]);
  return { server, client };
}

async function closePair(server: McpServer, client: Client): Promise<void> {
  await client.close();
  await server.close();
}

function textOf(result: CallToolResult): string {
  return (result.content as Array<{ type: string; text: string }>)[0].text;
}

const UUID = '11111111-1111-1111-1111-111111111111';
const UUID2 = '22222222-2222-2222-2222-222222222222';

/** Valid forecast UUIDs — the tools' input schemas validate ids as UUIDs. */
const FORECAST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const FORECAST_ID_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const forecastCreateArgs = {
  requestedBy: 'Alice Martin',
  requesterEmail: 'alice@example.io',
  applicationId: UUID,
  lines: [
    {
      productId: UUID2,
      flavorId: '33333333-3333-3333-3333-333333333333',
      azCode: 'eu-west-par1',
      quantity: 4,
    },
  ],
  justification: 'Peak season capacity',
  environment: 'PRD',
};

describe('forecast lifecycle tools (apps/api/src/mcp/tools/forecasts.ts)', () => {
  it('declares the full lifecycle with zod object schemas and unique names', () => {
    expect(forecastsGroup.name).toBe('forecasts');
    expect(forecastsGroup.description).toBeTruthy();

    const names = forecastsGroup.tools.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(
      expect.arrayContaining([
        'forecasts_list_forecasts',
        'forecasts_get_forecast',
        'forecasts_get_governance',
        'forecasts_create_forecast',
        'forecasts_submit_forecast',
        'forecasts_approve_forecast',
        'forecasts_reject_forecast',
        'forecasts_cancel_forecast',
        'forecasts_resubmit_forecast',
        'forecasts_delete_forecast',
      ]),
    );

    for (const tool of forecastsGroup.tools) {
      expect(tool.name).toMatch(/^[a-zA-Z0-9_-]{1,128}$/);
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeInstanceOf(z.ZodObject);
      expect(typeof tool.inputSchema.shape).toBe('object');
    }
  });

  it('enforces the zod input schemas locally (registration-ready)', () => {
    const toolByName = new Map(forecastsGroup.tools.map((tool) => [tool.name, tool]));

    // Valid create arguments parse successfully.
    const createSchema = toolByName.get('forecasts_create_forecast')!.inputSchema;
    expect(createSchema.safeParse(forecastCreateArgs).success).toBe(true);

    // quantity must be a positive integer.
    expect(
      createSchema.safeParse({
        ...forecastCreateArgs,
        lines: [{ ...forecastCreateArgs.lines[0], quantity: 0 }],
      }).success,
    ).toBe(false);

    // requesterEmail must be an email.
    expect(
      createSchema.safeParse({ ...forecastCreateArgs, requesterEmail: 'not-an-email' }).success,
    ).toBe(false);

    // ids must be UUIDs.
    const getSchema = toolByName.get('forecasts_get_forecast')!.inputSchema;
    expect(getSchema.safeParse({ id: UUID }).success).toBe(true);
    expect(getSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false);

    // The rejection reason is mandatory (governance rule).
    const rejectSchema = toolByName.get('forecasts_reject_forecast')!.inputSchema;
    expect(rejectSchema.safeParse({ id: UUID, actorName: 'Bob', comment: 'nope' }).success).toBe(
      true,
    );
    expect(rejectSchema.safeParse({ id: UUID, actorName: 'Bob' }).success).toBe(false);

    // The status filter only accepts real workflow statuses.
    const listSchema = toolByName.get('forecasts_list_forecasts')!.inputSchema;
    expect(listSchema.safeParse({ status: 'PENDING_TECH' }).success).toBe(true);
    expect(listSchema.safeParse({ status: 'NOT_A_STATUS' }).success).toBe(false);

    // Action endpoints require an actor name.
    const submitSchema = toolByName.get('forecasts_submit_forecast')!.inputSchema;
    expect(submitSchema.safeParse({ id: UUID, actorName: 'Alice' }).success).toBe(true);
    expect(submitSchema.safeParse({ id: UUID }).success).toBe(false);
  });

  it('round-trips create + submit + approve through /api/forecasts', async () => {
    const { server, client } = await createConnectedPair((server) =>
      registerToolGroup(server, forecastsGroup),
    );
    try {
      // tools/list exposes the lifecycle tools with JSON input schemas.
      const { tools } = await client.listTools();
      const listed = tools.map((tool) => tool.name);
      for (const name of forecastsGroup.tools.map((tool) => tool.name)) {
        expect(listed).toContain(name);
      }
      for (const tool of tools.filter((tool) => tool.name.startsWith('forecasts_'))) {
        expect(tool.inputSchema).toMatchObject({ type: 'object' });
      }

      // POST /api/forecasts (create draft)
      fetchMock.mockResolvedValueOnce(
        jsonResponse(201, { id: FORECAST_ID, status: 'DRAFT', estimatedCost: 1300 }),
      );
      const created = (await client.callTool({
        name: 'forecasts_create_forecast',
        arguments: forecastCreateArgs,
      })) as CallToolResult;
      expect(fetchMock).toHaveBeenLastCalledWith(
        'http://127.0.0.1:3001/api/forecasts',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        }),
      );
      expect(JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body)).toEqual(
        forecastCreateArgs,
      );
      expect(created.isError).toBeUndefined();
      expect(textOf(created)).toContain(FORECAST_ID);
      expect(textOf(created)).toContain('DRAFT');

      // POST /api/forecasts/:id/submit
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, { id: FORECAST_ID, status: 'PENDING_TECH' }),
      );
      const submitted = (await client.callTool({
        name: 'forecasts_submit_forecast',
        arguments: { id: FORECAST_ID, actorName: 'Alice', actorEmail: 'alice@example.io' },
      })) as CallToolResult;
      expect(fetchMock).toHaveBeenLastCalledWith(
        `http://127.0.0.1:3001/api/forecasts/${FORECAST_ID}/submit`,
        expect.objectContaining({ method: 'POST' }),
      );
      // The handler strips the path id before forwarding the actor body.
      // calls[1] is the submit POST (calls[0] was the create POST above).
      expect(
        JSON.parse((fetchMock.mock.calls[1][1] as { body: string }).body),
      ).toEqual({ actorName: 'Alice', actorEmail: 'alice@example.io' });
      expect(submitted.isError).toBeUndefined();
      expect(textOf(submitted)).toContain('PENDING_TECH');

      // POST /api/forecasts/:id/approve (tech lead step)
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, { id: FORECAST_ID, status: 'PENDING_MANAGER' }),
      );
      const approved = (await client.callTool({
        name: 'forecasts_approve_forecast',
        arguments: { id: FORECAST_ID, actorName: 'Tech Lead', actorEmail: 'tl@example.io' },
      })) as CallToolResult;
      expect(fetchMock).toHaveBeenLastCalledWith(
        `http://127.0.0.1:3001/api/forecasts/${FORECAST_ID}/approve`,
        expect.objectContaining({ method: 'POST' }),
      );
      expect(approved.isError).toBeUndefined();
      expect(textOf(approved)).toContain('PENDING_MANAGER');
    } finally {
      await closePair(server, client);
    }
  });

  it('round-trips reject (mandatory reason), cancel, resubmit, get, list and delete', async () => {
    const { server, client } = await createConnectedPair((server) =>
      registerToolGroup(server, forecastsGroup),
    );
    try {
      // POST /api/forecasts/:id/reject — reason forwarded in the body
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, { id: FORECAST_ID, status: 'REJECTED', rejectionReason: 'over budget' }),
      );
      const rejected = (await client.callTool({
        name: 'forecasts_reject_forecast',
        arguments: { id: FORECAST_ID, actorName: 'Finance', comment: 'over budget' },
      })) as CallToolResult;
      expect(fetchMock).toHaveBeenLastCalledWith(
        `http://127.0.0.1:3001/api/forecasts/${FORECAST_ID}/reject`,
        expect.objectContaining({ method: 'POST' }),
      );
      // The handler strips the path id before forwarding the actor body.
      // fetchMock.mockReset() in beforeEach makes this the first logged call.
      expect(
        JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body),
      ).toEqual({ actorName: 'Finance', comment: 'over budget' });
      expect(textOf(rejected)).toContain('over budget');

      // POST /api/forecasts/:id/cancel
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, { id: FORECAST_ID_2, status: 'CANCELLED' }),
      );
      const cancelled = (await client.callTool({
        name: 'forecasts_cancel_forecast',
        arguments: { id: FORECAST_ID_2, actorName: 'Alice' },
      })) as CallToolResult;
      expect(fetchMock).toHaveBeenLastCalledWith(
        `http://127.0.0.1:3001/api/forecasts/${FORECAST_ID_2}/cancel`,
        expect.objectContaining({ method: 'POST' }),
      );
      expect(textOf(cancelled)).toContain('CANCELLED');

      // POST /api/forecasts/:id/resubmit
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, { id: FORECAST_ID, status: 'PENDING_TECH' }),
      );
      const resubmitted = (await client.callTool({
        name: 'forecasts_resubmit_forecast',
        arguments: { id: FORECAST_ID, actorName: 'Alice' },
      })) as CallToolResult;
      expect(fetchMock).toHaveBeenLastCalledWith(
        `http://127.0.0.1:3001/api/forecasts/${FORECAST_ID}/resubmit`,
        expect.objectContaining({ method: 'POST' }),
      );
      expect(textOf(resubmitted)).toContain('PENDING_TECH');

      // GET /api/forecasts/:id
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, { id: FORECAST_ID, status: 'PENDING_TECH', lines: [] }),
      );
      const fetched = (await client.callTool({
        name: 'forecasts_get_forecast',
        arguments: { id: FORECAST_ID },
      })) as CallToolResult;
      expect(fetchMock).toHaveBeenLastCalledWith(
        `http://127.0.0.1:3001/api/forecasts/${FORECAST_ID}`,
        expect.objectContaining({ method: 'GET' }),
      );
      expect(textOf(fetched)).toContain(FORECAST_ID);

      // GET /api/forecasts?queue=APPROVED&mine=... (status → queue param)
      fetchMock.mockResolvedValueOnce(jsonResponse(200, [{ id: 'f-3', status: 'APPROVED' }]));
      const listed = (await client.callTool({
        name: 'forecasts_list_forecasts',
        arguments: { status: 'APPROVED', mine: 'alice@example.io' },
      })) as CallToolResult;
      // calls[4] is the list GET (this test already fetched reject, cancel,
      // resubmit and get before it).
      const listUrl = fetchMock.mock.calls[4][0] as string;
      expect(listUrl.startsWith('http://127.0.0.1:3001/api/forecasts?')).toBe(true);
      expect(listUrl).toContain('queue=APPROVED');
      expect(listUrl).toContain(encodeURIComponent('alice@example.io'));
      expect(textOf(listed)).toContain('f-3');

      // GET /api/forecasts/governance
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { steps: [], rules: [] }));
      await client.callTool({ name: 'forecasts_get_governance', arguments: {} });
      expect(fetchMock).toHaveBeenLastCalledWith(
        'http://127.0.0.1:3001/api/forecasts/governance',
        expect.objectContaining({ method: 'GET' }),
      );

      // DELETE /api/forecasts/:id (204, empty body)
      fetchMock.mockResolvedValueOnce(jsonResponse(204, ''));
      const deleted = (await client.callTool({
        name: 'forecasts_delete_forecast',
        arguments: { id: FORECAST_ID },
      })) as CallToolResult;
      expect(fetchMock).toHaveBeenLastCalledWith(
        `http://127.0.0.1:3001/api/forecasts/${FORECAST_ID}`,
        expect.objectContaining({ method: 'DELETE' }),
      );
      expect(deleted.isError).toBeUndefined();
    } finally {
      await closePair(server, client);
    }
  });

  it('surfaces API transition and validation errors as readable isError results', async () => {
    const { server, client } = await createConnectedPair((server) =>
      registerToolGroup(server, forecastsGroup),
    );
    try {
      // Governance rejection: 400 with the API's message
      fetchMock.mockResolvedValueOnce(
        jsonResponse(400, { error: 'Action APPROVE is not permitted from status DRAFT' }),
      );
      const transition = (await client.callTool({
        name: 'forecasts_approve_forecast',
        arguments: { id: FORECAST_ID, actorName: 'Eager' },
      })) as CallToolResult;
      expect(transition.isError).toBe(true);
      expect(textOf(transition)).toContain('Bad request (400)');
      expect(textOf(transition)).toContain('Action APPROVE is not permitted from status DRAFT');
      expect(textOf(transition)).not.toContain('\n');
      expect(textOf(transition)).not.toMatch(/\s+at\s/);

      // ZodError payload from the global error handler. The arguments must
      // PASS the tool's local zod schema (lines non-empty) so the call
      // reaches the API — where the mocked 400 is translated. (An argument
      // violating the local schema would be rejected client-side by the SDK
      // with -32602 and never hit the API.)
      fetchMock.mockResolvedValueOnce(
        jsonResponse(400, {
          error: 'Validation Error',
          details: [
            { path: 'applicationId', message: 'Application does not exist' },
          ],
        }),
      );
      const validation = (await client.callTool({
        name: 'forecasts_create_forecast',
        arguments: forecastCreateArgs,
      })) as CallToolResult;
      expect(validation.isError).toBe(true);
      expect(textOf(validation)).toBe(
        'Validation failed (400) for POST /api/forecasts: applicationId: Application does not exist',
      );
      expect(textOf(validation)).not.toContain('ZodError');
    } finally {
      await closePair(server, client);
    }
  });
});

describe('conditional admin registration (apps/api/src/mcp/tools/admin.ts)', () => {
  const adminToolNames = [
    'admin_get_dashboard',
    'admin_list_products',
    'admin_create_product',
    'admin_update_product',
    'admin_delete_product',
    'admin_list_categories',
    'admin_create_category',
    'admin_update_category',
    'admin_delete_category',
    'admin_list_flavors',
    'admin_create_flavor',
    'admin_update_flavor',
    'admin_delete_flavor',
    'admin_list_dependencies',
    'admin_create_dependency',
    'admin_update_dependency',
    'admin_delete_dependency',
    'admin_list_forecasts',
    'admin_list_users',
    'admin_create_user',
    'admin_update_user',
    'admin_delete_user',
  ];

  it('builds the admin group even without ADMIN_API_KEY (enforcement is server-side)', () => {
    // Auth is optional per explicit user choice: admin tools are always
    // registered; the /api/admin routes enforce x-admin-api-key themselves
    // (open when ADMIN_API_KEY is unset — same as the GUI).
    delete process.env.ADMIN_API_KEY;
    expect(isAdminApiConfigured()).toBe(false);
    const group = buildAdminGroup();
    expect(group).not.toBeNull();
    expect(group!.tools.map((tool) => tool.name)).toEqual(adminToolNames);
  });

  it('builds the admin group only when ADMIN_API_KEY is set', () => {
    process.env.ADMIN_API_KEY = 'test-admin-key';
    expect(isAdminApiConfigured()).toBe(true);

    const group = buildAdminGroup();
    expect(group).not.toBeNull();
    expect(group!.name).toBe('admin');
    expect(group!.tools.map((tool) => tool.name)).toEqual(adminToolNames);

    for (const tool of group!.tools) {
      expect(tool.name).toMatch(/^[a-zA-Z0-9_-]{1,128}$/);
      expect(tool.inputSchema).toBeInstanceOf(z.ZodObject);
      expect(tool.description).toBeTruthy();
    }
  });

  it('lists admin tools over tools/list even when ADMIN_API_KEY is not set', async () => {
    delete process.env.ADMIN_API_KEY;
    const { server, client } = await createConnectedPair((server) => {
      registerAdminTools(server);
      registerToolGroup(server, forecastsGroup);
    });
    try {
      const { tools } = await client.listTools();
      const names = tools.map((tool) => tool.name);
      for (const adminName of adminToolNames) {
        expect(names).toContain(adminName);
      }
      expect(names).toContain('forecasts_create_forecast');
    } finally {
      await closePair(server, client);
    }
  });

  it('lists every admin tool over tools/list when ADMIN_API_KEY is set', async () => {
    process.env.ADMIN_API_KEY = 'test-admin-key';
    const { server, client } = await createConnectedPair((server) =>
      registerAdminTools(server),
    );
    try {
      const { tools } = await client.listTools();
      const names = tools.map((tool) => tool.name);
      expect(names.sort()).toEqual([...adminToolNames].sort());
      for (const tool of tools) {
        expect(tool.inputSchema).toMatchObject({ type: 'object' });
        expect(tool.description).toBeTruthy();
      }
    } finally {
      await closePair(server, client);
    }
  });

  it('propagates x-admin-api-key verbatim from the environment to /api/admin', async () => {
    process.env.ADMIN_API_KEY = 's3cr3t-admin-key-42';
    const { server, client } = await createConnectedPair((server) =>
      registerAdminTools(server),
    );
    try {
      fetchMock.mockResolvedValueOnce(jsonResponse(201, { id: 'u1', email: 'a@b.io' }));

      const args = { email: 'a@b.io', name: 'Alice', role: 'USER' };
      const result = (await client.callTool({
        name: 'admin_create_user',
        arguments: args,
      })) as CallToolResult;

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [
        string,
        { method: string; headers: Record<string, string>; body: string },
      ];
      expect(url).toBe('http://127.0.0.1:3001/api/admin/users');
      expect(init.method).toBe('POST');
      expect(init.headers['x-admin-api-key']).toBe('s3cr3t-admin-key-42');
      expect(init.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(init.body)).toEqual(args);
      expect(result.isError).toBeUndefined();
      expect(textOf(result)).toContain('u1');
    } finally {
      await closePair(server, client);
    }
  });

  it('sends the header on admin GET tools too (dashboard)', async () => {
    process.env.ADMIN_API_KEY = 'read-key';
    const { server, client } = await createConnectedPair((server) =>
      registerAdminTools(server),
    );
    try {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { totals: { products: 12 } }));

      const result = (await client.callTool({
        name: 'admin_get_dashboard',
        arguments: {},
      })) as CallToolResult;

      const [url, init] = fetchMock.mock.calls[0] as [
        string,
        { method: string; headers: Record<string, string> },
      ];
      expect(url).toBe('http://127.0.0.1:3001/api/admin/dashboard');
      expect(init.method).toBe('GET');
      expect(init.headers['x-admin-api-key']).toBe('read-key');
      expect(result.isError).toBeUndefined();
      expect(textOf(result)).toContain('products');
    } finally {
      await closePair(server, client);
    }
  });

  it('turns admin API errors (401/409) into readable tool results', async () => {
    process.env.ADMIN_API_KEY = 'wrong-key';
    const { server, client } = await createConnectedPair((server) =>
      registerAdminTools(server),
    );
    try {
      // 401 from the adminAuth middleware
      fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: 'Unauthorized' }));
      const unauthorized = (await client.callTool({
        name: 'admin_list_users',
        arguments: {},
      })) as CallToolResult;
      expect(unauthorized.isError).toBe(true);
      expect(textOf(unauthorized)).toContain('Unauthorized (401)');
      expect(textOf(unauthorized)).toContain('ADMIN_API_KEY');
      expect(textOf(unauthorized)).not.toMatch(/\s+at\s/);

      // 409 conflict from the API
      fetchMock.mockResolvedValueOnce(
        jsonResponse(409, { error: 'A product with this slug already exists' }),
      );
      const conflict = (await client.callTool({
        name: 'admin_create_product',
        arguments: { name: 'Ubuntu VM', categoryId: UUID, computeType: 'VIRTUAL' },
      })) as CallToolResult;
      expect(conflict.isError).toBe(true);
      expect(textOf(conflict)).toContain('Conflict (409)');
      expect(textOf(conflict)).toContain('A product with this slug already exists');
      expect(textOf(conflict)).not.toContain('\n');

      // ZodError payload (validation) from the API
      fetchMock.mockResolvedValueOnce(
        jsonResponse(400, {
          error: 'Validation Error',
          details: [{ path: 'vcpu', message: 'Expected number, received string' }],
        }),
      );
      const validation = (await client.callTool({
        name: 'admin_create_flavor',
        arguments: { name: 'small', vcpu: 2, ramGb: 8 },
      })) as CallToolResult;
      expect(validation.isError).toBe(true);
      expect(textOf(validation)).toBe(
        'Validation failed (400) for POST /api/admin/flavors: vcpu: Expected number, received string',
      );
    } finally {
      await closePair(server, client);
    }
  });

  it('registers forecast and admin tools together without name collisions', async () => {
    process.env.ADMIN_API_KEY = 'combined-key';
    const { server, client } = await createConnectedPair((server) => {
      registerToolGroup(server, forecastsGroup);
      registerAdminTools(server);
    });
    try {
      const { tools } = await client.listTools();
      const names = tools.map((tool) => tool.name);
      expect(new Set(names).size).toBe(names.length);
      expect(names.length).toBe(forecastsGroup.tools.length + adminToolNames.length);
    } finally {
      await closePair(server, client);
    }
  });
});
