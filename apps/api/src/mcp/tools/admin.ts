/**
 * Admin MCP tools — CRUD over the existing /api/admin routes, registered
 * ONLY when the ADMIN_API_KEY environment variable is configured.
 *
 * Why conditional: the admin routes are guarded by the x-admin-api-key
 * header (fail-closed when a key is configured — see the adminAuth
 * middleware in src/index.ts). Registering admin tools on an MCP server
 * without a configured key would advertise operations the server could
 * never authorize (or, worse, that the API would serve unauthenticated
 * when it runs without a key). buildAdminGroup() therefore returns null
 * and registerAdminTools() is a no-op unless ADMIN_API_KEY is set.
 *
 * Header propagation: every handler sends { admin: true } to the internal
 * api-client, which forwards the x-admin-api-key header verbatim from
 * process.env.ADMIN_API_KEY to /api/admin. API errors are translated into
 * single-line readable tool results (no stack traces).
 *
 * Registration: registerAdminTools(server) registers the group with the
 * same semantics as the shared registry's registerMcpTools() (zod shape →
 * JSON inputSchema, defensive try/catch wrapper). registerToolGroup() is
 * the generic helper used for that, also reusable for the other
 * tools/* groups until the registry aggregates them.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpToolDefinition, McpToolGroup } from '../tools';
import {
  ADMIN_API_KEY_HEADER,
  apiDelete,
  apiPatch,
  apiPost,
  apiRequest,
  toToolResult,
} from '../api-client';

const uuidSchema = z.string().uuid();

/** True when the admin key is configured in the environment. */
export function isAdminApiConfigured(): boolean {
  return typeof process.env.ADMIN_API_KEY === 'string' && process.env.ADMIN_API_KEY.length > 0;
}

// ---------------------------------------------------------------------------
// Input schemas — mirrors of the zod schemas enforced by src/routes/admin.ts
// ---------------------------------------------------------------------------
const scheduleSchema = z.object({
  id: uuidSchema.optional().describe('Existing schedule UUID (to update or delete)'),
  regionId: uuidSchema.nullable().optional().describe('Region UUID'),
  azId: uuidSchema.nullable().optional().describe('Availability zone UUID'),
  zoneId: uuidSchema.nullable().optional().describe('Zone UUID'),
  availableFrom: z.string().nullable().optional().describe('ISO 8601 datetime'),
  availableUntil: z.string().nullable().optional().describe('ISO 8601 datetime'),
  status: z.enum(['STANDARD', 'RECOMMENDED', 'RESTRICTED', 'ON_DEMAND']).optional(),
  deleted: z.boolean().optional().describe('Set true to delete an existing schedule'),
});

const relationFields = {
  zoneIds: z.array(uuidSchema).optional().describe('Zone UUIDs the resource is available in'),
  regionIds: z.array(uuidSchema).optional().describe('Region UUIDs the resource is available in'),
  availabilityZoneIds: z
    .array(uuidSchema)
    .max(50)
    .optional()
    .describe('Availability zone UUIDs the resource is available in'),
  schedules: z
    .array(scheduleSchema)
    .optional()
    .describe('Availability schedules (windows and visibility status)'),
};

const productShape = {
  name: z.string().min(1).describe('Product name'),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional()
    .describe('URL slug (generated from the name when omitted)'),
  description: z.string().optional(),
  categoryId: uuidSchema.describe('Category UUID'),
  computeType: z
    .enum(['PHYSICAL', 'VIRTUAL'])
    .optional()
    .nullable()
    .describe('Required for Compute-category products'),
  os: z.string().optional().describe('Operating system (free text)'),
  documentation: z.string().optional(),
  roadmap: z.string().optional(),
  initialReleaseDate: z.string().optional().describe('ISO 8601 datetime'),
  productEOLDate: z.string().optional().describe('ISO 8601 datetime'),
  isActive: z.boolean().optional(),
  ...relationFields,
};

const productUpdateShape = {
  id: uuidSchema.describe('Product UUID'),
  ...z.object(productShape).partial().shape,
};

const flavorShape = {
  name: z.string().min(1).describe('Flavor name'),
  vcpu: z.number().int().min(0).describe('Number of vCPUs'),
  ramGb: z.number().int().min(0).describe('RAM in GB'),
  description: z.string().optional(),
  releaseDate: z.string().optional().describe('ISO 8601 datetime'),
  deprecationDate: z.string().optional().describe('ISO 8601 datetime'),
  eolDate: z.string().optional().describe('ISO 8601 datetime'),
  ...relationFields,
};

const flavorUpdateShape = {
  id: uuidSchema.describe('Flavor UUID'),
  ...z.object(flavorShape).partial().shape,
};

const categoryShape = {
  name: z.string().min(1).describe('Category name'),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional()
    .describe('URL slug (generated from the name when omitted)'),
  description: z.string().optional(),
  icon: z.string().optional(),
};

const categoryUpdateShape = {
  id: uuidSchema.describe('Category UUID'),
  ...z.object(categoryShape).partial().shape,
};

const dependencyShape = {
  productId: uuidSchema.describe('Product UUID that depends on another product'),
  dependsOnId: uuidSchema.describe('UUID of the product being depended on'),
  type: z.enum(['REQUIRED', 'RECOMMENDED']).describe('Dependency strength'),
  description: z.string().optional(),
};

const dependencyUpdateShape = {
  id: uuidSchema.describe('Dependency UUID'),
  ...z.object(dependencyShape).partial().shape,
};

const userShape = {
  email: z.string().email().describe('User email'),
  name: z.string().min(1).describe('User display name'),
  role: z.enum(['ADMIN', 'USER']).optional().describe('User role (defaults to USER)'),
};

const userUpdateShape = {
  id: uuidSchema.describe('User UUID'),
  ...z.object(userShape).partial().shape,
};

// ---------------------------------------------------------------------------
// Tool definitions — one per /api/admin route
// ---------------------------------------------------------------------------
function buildAdminTools(): McpToolDefinition[] {
  return [
    {
      name: 'admin_get_dashboard',
      description: 'Get the admin dashboard aggregates.',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiRequest('GET', '/api/admin/dashboard', { admin: true })),
    },

    // ----- Products -----
    {
      name: 'admin_list_products',
      description: 'List all products from the admin view (including inactive ones).',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiRequest('GET', '/api/admin/products', { admin: true })),
    },
    {
      name: 'admin_create_product',
      description: 'Create a product.',
      inputSchema: z.object(productShape),
      handler: async (args) => toToolResult(await apiPost('/api/admin/products', args, { admin: true })),
    },
    {
      name: 'admin_update_product',
      description:
        'Update a product (partial). Renaming regenerates the slug server-side.',
      inputSchema: z.object(productUpdateShape),
      handler: async (args) => {
        const { id, ...body } = (args ?? {}) as Record<string, unknown> & { id: string };
        return toToolResult(await apiPatch(`/api/admin/products/${id}`, body, { admin: true }));
      },
    },
    {
      name: 'admin_delete_product',
      description:
        'Delete a product. The API refuses deletion while variants, dependencies, forecast ' +
        'lines, instances or upgrade paths reference it (409).',
      inputSchema: z.object({ id: uuidSchema.describe('Product UUID') }),
      handler: async (args) => {
        const { id } = (args ?? {}) as { id: string };
        return toToolResult(await apiDelete(`/api/admin/products/${id}`, { admin: true }));
      },
    },

    // ----- Categories -----
    {
      name: 'admin_list_categories',
      description: 'List categories with their product counts.',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiRequest('GET', '/api/admin/categories', { admin: true })),
    },
    {
      name: 'admin_create_category',
      description: 'Create a category.',
      inputSchema: z.object(categoryShape),
      handler: async (args) => toToolResult(await apiPost('/api/admin/categories', args, { admin: true })),
    },
    {
      name: 'admin_update_category',
      description: 'Update a category (partial).',
      inputSchema: z.object(categoryUpdateShape),
      handler: async (args) => {
        const { id, ...body } = (args ?? {}) as Record<string, unknown> & { id: string };
        return toToolResult(await apiPatch(`/api/admin/categories/${id}`, body, { admin: true }));
      },
    },
    {
      name: 'admin_delete_category',
      description:
        'Delete a category. The API refuses deletion while products reference it (409).',
      inputSchema: z.object({ id: uuidSchema.describe('Category UUID') }),
      handler: async (args) => {
        const { id } = (args ?? {}) as { id: string };
        return toToolResult(await apiDelete(`/api/admin/categories/${id}`, { admin: true }));
      },
    },

    // ----- Flavors -----
    {
      name: 'admin_list_flavors',
      description: 'List compute flavors from the admin view.',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiRequest('GET', '/api/admin/flavors', { admin: true })),
    },
    {
      name: 'admin_create_flavor',
      description: 'Create a compute flavor (vCPU / RAM sizing).',
      inputSchema: z.object(flavorShape),
      handler: async (args) => toToolResult(await apiPost('/api/admin/flavors', args, { admin: true })),
    },
    {
      name: 'admin_update_flavor',
      description: 'Update a compute flavor (partial).',
      inputSchema: z.object(flavorUpdateShape),
      handler: async (args) => {
        const { id, ...body } = (args ?? {}) as Record<string, unknown> & { id: string };
        return toToolResult(await apiPatch(`/api/admin/flavors/${id}`, body, { admin: true }));
      },
    },
    {
      name: 'admin_delete_flavor',
      description: 'Delete a compute flavor.',
      inputSchema: z.object({ id: uuidSchema.describe('Flavor UUID') }),
      handler: async (args) => {
        const { id } = (args ?? {}) as { id: string };
        return toToolResult(await apiDelete(`/api/admin/flavors/${id}`, { admin: true }));
      },
    },

    // ----- Dependencies -----
    {
      name: 'admin_list_dependencies',
      description: 'List product dependencies from the admin view.',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiRequest('GET', '/api/admin/dependencies', { admin: true })),
    },
    {
      name: 'admin_create_dependency',
      description: 'Create a dependency between two products.',
      inputSchema: z.object(dependencyShape),
      handler: async (args) => toToolResult(await apiPost('/api/admin/dependencies', args, { admin: true })),
    },
    {
      name: 'admin_update_dependency',
      description: 'Update a product dependency (partial).',
      inputSchema: z.object(dependencyUpdateShape),
      handler: async (args) => {
        const { id, ...body } = (args ?? {}) as Record<string, unknown> & { id: string };
        return toToolResult(await apiPatch(`/api/admin/dependencies/${id}`, body, { admin: true }));
      },
    },
    {
      name: 'admin_delete_dependency',
      description: 'Delete a product dependency.',
      inputSchema: z.object({ id: uuidSchema.describe('Dependency UUID') }),
      handler: async (args) => {
        const { id } = (args ?? {}) as { id: string };
        return toToolResult(await apiDelete(`/api/admin/dependencies/${id}`, { admin: true }));
      },
    },

    // ----- Forecasts (admin view) -----
    {
      name: 'admin_list_forecasts',
      description: 'List all forecasts from the admin view (all statuses, with lines).',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiRequest('GET', '/api/admin/forecasts', { admin: true })),
    },

    // ----- Users -----
    {
      name: 'admin_list_users',
      description: 'List users from the admin view.',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiRequest('GET', '/api/admin/users', { admin: true })),
    },
    {
      name: 'admin_create_user',
      description: 'Create a user.',
      inputSchema: z.object(userShape),
      handler: async (args) => toToolResult(await apiPost('/api/admin/users', args, { admin: true })),
    },
    {
      name: 'admin_update_user',
      description: 'Update a user (partial).',
      inputSchema: z.object(userUpdateShape),
      handler: async (args) => {
        const { id, ...body } = (args ?? {}) as Record<string, unknown> & { id: string };
        return toToolResult(await apiPatch(`/api/admin/users/${id}`, body, { admin: true }));
      },
    },
    {
      name: 'admin_delete_user',
      description: 'Delete a user.',
      inputSchema: z.object({ id: uuidSchema.describe('User UUID') }),
      handler: async (args) => {
        const { id } = (args ?? {}) as { id: string };
        return toToolResult(await apiDelete(`/api/admin/users/${id}`, { admin: true }));
      },
    },
  ];
}

/**
 * Build the admin tool group — ALWAYS registered.
 *
 * Enforcement is server-side: the /api/admin routes apply the x-admin-api-key
 * guard themselves (open when ADMIN_API_KEY is unset — same as the GUI). The
 * api-client forwards the header automatically from ADMIN_API_KEY when it is
 * configured. Returns the group directly (kept nullable in the type for the
 * generic registerToolGroup helper).
 */
export function buildAdminGroup(): McpToolGroup | null {
  return {
    name: 'admin',
    description:
      'Administrative CRUD (products, categories, flavors, dependencies, users, dashboard). ' +
      `When ADMIN_API_KEY is configured, calls carry the '${ADMIN_API_KEY_HEADER}' header; the API enforces it.`,
    tools: buildAdminTools(),
  };
}

/**
 * Register one tool group on an MCP server, using the same semantics as the
 * shared registry's registerMcpTools(): the zod object schema is passed as a
 * ZodRawShape (the SDK converts it to the JSON inputSchema served over
 * tools/list) and handler failures are converted into readable isError
 * results instead of thrown errors.
 *
 * A null group (e.g. the admin group without ADMIN_API_KEY) is a no-op.
 */
export function registerToolGroup(server: McpServer, group: McpToolGroup | null): void {
  if (!group) {
    return;
  }
  for (const tool of group.tools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema.shape,
      },
      async (args: unknown) => {
        try {
          return await tool.handler(args);
        } catch (cause) {
          // Defensive: handlers resolve to results instead of throwing, but
          // the model must never see a stack trace if one escapes.
          const message =
            cause instanceof Error && cause.message ? cause.message : String(cause);
          return toToolResult({
            ok: false,
            error: `Tool ${tool.name} failed: ${message}`,
          });
        }
      },
    );
  }
}

/**
 * Register the admin tools on an MCP server — a no-op when ADMIN_API_KEY is
 * not configured, so admin tools never appear in tools/list in that case.
 */
export function registerAdminTools(server: McpServer): void {
  registerToolGroup(server, buildAdminGroup());
}
