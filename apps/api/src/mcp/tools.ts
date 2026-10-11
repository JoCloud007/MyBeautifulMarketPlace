/**
 * Shared MCP tool registry.
 *
 * Single source of truth for every tool exposed by the CloudMarket MCP
 * server. Tools are organized in groups; each group and each tool declares
 * a name, a description and a zod input schema (converted to the MCP JSON
 * inputSchema at registration time by the SDK).
 *
 * The admin group is the conditional one from ./tools/admin (registered
 * only when ADMIN_API_KEY is configured). Handlers go through ./api-client
 * so the model sees exactly what a REST client sees on the existing API
 * (127.0.0.1:3001).
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  toToolResult,
} from './api-client';
import { buildAdminGroup } from './tools/admin';
import { buildAuthoringGroup } from './tools/authoring';

export interface McpToolDefinition {
  /** Unique tool name (flat namespace across all groups). */
  name: string;
  description: string;
  /** zod object schema — converted to JSON inputSchema at registration. */
  inputSchema: z.ZodObject<any, any>;
  /** Executes the tool and returns an MCP CallToolResult-compatible object. */
  handler: (args: unknown) => Promise<{
    content: Array<{ type: 'text'; text: string }>;
    isError?: boolean;
  }>;
}

export interface McpToolGroup {
  name: string;
  description: string;
  tools: McpToolDefinition[];
}

const uuidSchema = z.string().uuid();

// ---------------------------------------------------------------------------
// Catalog group — products, categories, flavors, OS, product versions
// ---------------------------------------------------------------------------
const catalogGroup: McpToolGroup = {
  name: 'catalog',
  description: 'Browse the CloudMarket product catalog (products, categories, flavors, OS, versions).',
  tools: [
    {
      name: 'catalog_list_products',
      description: 'List active products, optionally filtered by category slug, compute type or free-text search.',
      inputSchema: z.object({
        category: z.string().max(100).optional().describe('Category slug filter'),
        computeType: z.enum(['PHYSICAL', 'VIRTUAL']).optional().describe('Compute type filter'),
        search: z.string().max(200).optional().describe('Free-text search on name and description'),
      }),
      handler: async (args) => {
        const { category, computeType, search } = (args ?? {}) as {
          category?: string;
          computeType?: string;
          search?: string;
        };
        return toToolResult(await apiGet('/api/products', { category, computeType, search }));
      },
    },
    {
      name: 'catalog_get_product',
      description: 'Get one product with its variants, dependencies and availability schedules by UUID.',
      inputSchema: z.object({ id: uuidSchema.describe('Product UUID') }),
      handler: async (args) => {
        const { id } = (args ?? {}) as { id: string };
        return toToolResult(await apiGet(`/api/products/${id}`));
      },
    },
    {
      name: 'catalog_list_categories',
      description: 'List product categories.',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiGet('/api/categories')),
    },
    {
      name: 'catalog_get_category',
      description: 'Get one category by slug, including its products.',
      inputSchema: z.object({ slug: z.string().min(1).max(120).describe('Category slug') }),
      handler: async (args) => {
        const { slug } = (args ?? {}) as { slug: string };
        return toToolResult(await apiGet(`/api/categories/${encodeURIComponent(slug)}`));
      },
    },
    {
      name: 'catalog_list_flavors',
      description: 'List compute flavors (vCPU, RAM, disk sizing).',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiGet('/api/flavors')),
    },
    {
      name: 'catalog_get_flavor',
      description: 'Get one compute flavor by UUID.',
      inputSchema: z.object({ id: uuidSchema.describe('Flavor UUID') }),
      handler: async (args) => {
        const { id } = (args ?? {}) as { id: string };
        return toToolResult(await apiGet(`/api/flavors/${id}`));
      },
    },
    {
      name: 'catalog_list_os',
      description: 'List supported operating systems.',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiGet('/api/os')),
    },
    {
      name: 'catalog_list_product_versions',
      description: 'List versions of a product with their lifecycle dates.',
      inputSchema: z.object({ productId: uuidSchema.describe('Product UUID') }),
      handler: async (args) => {
        const { productId } = (args ?? {}) as { productId: string };
        return toToolResult(await apiGet(`/api/products/${productId}/versions`));
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Infrastructure group — zones, regions, infra versions, performance
// ---------------------------------------------------------------------------
const infrastructureGroup: McpToolGroup = {
  name: 'infrastructure',
  description: 'Inspect infrastructure topology: zones, regions, availability zones, infra versions and performance profiles.',
  tools: [
    {
      name: 'infrastructure_list_zones',
      description: 'List infrastructure zones.',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiGet('/api/zones')),
    },
    {
      name: 'infrastructure_get_zone',
      description: 'Get one infrastructure zone by UUID.',
      inputSchema: z.object({ id: uuidSchema.describe('Zone UUID') }),
      handler: async (args) => {
        const { id } = (args ?? {}) as { id: string };
        return toToolResult(await apiGet(`/api/zones/${id}`));
      },
    },
    {
      name: 'infrastructure_list_availability_zones',
      description: 'List availability zones (AZs) with their regions.',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiGet('/api/availability-zones')),
    },
    {
      name: 'infrastructure_list_countries',
      description: 'List countries available in the geography catalog.',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiGet('/api/countries')),
    },
    {
      name: 'infrastructure_list_regions',
      description: 'List geographic regions.',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiGet('/api/regions')),
    },
    {
      name: 'infrastructure_list_infra_versions',
      description: 'List infrastructure versions.',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiGet('/api/infra-versions')),
    },
    {
      name: 'infrastructure_list_performance_profiles',
      description: 'List performance profiles (benchmark scores per flavor).',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiGet('/api/performance-profiles')),
    },
    {
      name: 'infrastructure_get_topology',
      description: 'Get the full infrastructure topology (zones, AZs, regions and relations).',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiGet('/api/topology')),
    },
  ],
};

// ---------------------------------------------------------------------------
// Operations group — applications, instances, backups, health checks,
// maintenance windows, compliance
// ---------------------------------------------------------------------------
const operationsGroup: McpToolGroup = {
  name: 'operations',
  description: 'Operate running workloads: applications, instances, backups, health checks, maintenance windows and compliance.',
  tools: [
    {
      name: 'operations_list_applications',
      description: 'List applications with their continuity levels.',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiGet('/api/applications')),
    },
    {
      name: 'operations_get_application',
      description: 'Get one application by UUID.',
      inputSchema: z.object({ id: uuidSchema.describe('Application UUID') }),
      handler: async (args) => {
        const { id } = (args ?? {}) as { id: string };
        return toToolResult(await apiGet(`/api/applications/${id}`));
      },
    },
    {
      name: 'operations_list_instances',
      description: 'List instances, optionally filtered by application, product, variant, status or environment.',
      inputSchema: z.object({
        applicationId: uuidSchema.optional().describe('Filter by application UUID'),
        productId: uuidSchema.optional().describe('Filter by product UUID'),
        status: z.enum(['PENDING', 'PROVISIONING', 'RUNNING', 'STOPPED', 'TERMINATED']).optional(),
        environment: z.enum(['PRD', 'DEV', 'STG']).optional(),
      }),
      handler: async (args) => {
        const { applicationId, productId, status, environment } = (args ?? {}) as {
          applicationId?: string;
          productId?: string;
          status?: string;
          environment?: string;
        };
        return toToolResult(
          await apiGet('/api/instances', { applicationId, productId, status, environment }),
        );
      },
    },
    {
      name: 'operations_get_instance',
      description: 'Get one instance by UUID.',
      inputSchema: z.object({ id: uuidSchema.describe('Instance UUID') }),
      handler: async (args) => {
        const { id } = (args ?? {}) as { id: string };
        return toToolResult(await apiGet(`/api/instances/${id}`));
      },
    },
    {
      name: 'operations_create_instance',
      description: 'Provision a new instance.',
      inputSchema: z.object({
        name: z.string().min(1).describe('Instance name'),
        applicationId: uuidSchema.describe('Application UUID'),
        productId: uuidSchema.describe('Product UUID'),
        flavorId: uuidSchema.describe('Flavor UUID'),
        azCode: z.string().min(1).describe('Availability zone code'),
        variantId: uuidSchema.optional().describe('Product variant UUID'),
        environment: z.enum(['PRD', 'DEV', 'STG']).optional().describe('Target environment'),
        status: z.enum(['PENDING', 'PROVISIONING', 'RUNNING', 'STOPPED']).optional(),
        ipAddress: z.string().optional().describe('IP address (IPv4 or IPv6)'),
        hostname: z.string().max(253).optional().describe('Hostname'),
      }),
      handler: async (args) => toToolResult(await apiPost('/api/instances', args)),
    },
    {
      name: 'operations_update_instance',
      description: 'Update an instance (status, environment, addressing...).',
      inputSchema: z.object({
        id: uuidSchema.describe('Instance UUID'),
        name: z.string().min(1).optional(),
        status: z.enum(['PENDING', 'PROVISIONING', 'RUNNING', 'STOPPED', 'TERMINATED']).optional(),
        environment: z.enum(['PRD', 'DEV', 'STG']).optional(),
        ipAddress: z.string().optional(),
        hostname: z.string().max(253).optional(),
      }),
      handler: async (args) => {
        const { id, ...body } = (args ?? {}) as Record<string, unknown> & { id: string };
        return toToolResult(await apiPatch(`/api/instances/${id}`, body));
      },
    },
    {
      name: 'operations_delete_instance',
      description: 'Terminate and delete an instance by UUID.',
      inputSchema: z.object({ id: uuidSchema.describe('Instance UUID') }),
      handler: async (args) => {
        const { id } = (args ?? {}) as { id: string };
        return toToolResult(await apiDelete(`/api/instances/${id}`));
      },
    },
    {
      name: 'operations_list_instance_backups',
      description: 'List backups attached to one instance.',
      inputSchema: z.object({ instanceId: uuidSchema.describe('Instance UUID') }),
      handler: async (args) => {
        const { instanceId } = (args ?? {}) as { instanceId: string };
        return toToolResult(await apiGet(`/api/backups/instances/${instanceId}/backups`));
      },
    },
    {
      name: 'operations_create_backup',
      description: 'Create a backup for an instance.',
      inputSchema: z.object({
        instanceId: uuidSchema.describe('Instance UUID'),
        name: z.string().min(1).optional().describe('Backup name'),
        type: z.string().optional().describe('Backup type (e.g. FULL, INCREMENTAL)'),
      }),
      handler: async (args) => {
        const { instanceId, ...body } = (args ?? {}) as Record<string, unknown> & { instanceId: string };
        return toToolResult(await apiPost(`/api/backups/instances/${instanceId}/backups`, body));
      },
    },
    {
      name: 'operations_get_backup',
      description: 'Get one backup by UUID.',
      inputSchema: z.object({ id: uuidSchema.describe('Backup UUID') }),
      handler: async (args) => {
        const { id } = (args ?? {}) as { id: string };
        return toToolResult(await apiGet(`/api/backups/${id}`));
      },
    },
    {
      name: 'operations_restore_backup',
      description: 'Restore a backup by UUID.',
      inputSchema: z.object({ id: uuidSchema.describe('Backup UUID') }),
      handler: async (args) => {
        const { id } = (args ?? {}) as { id: string };
        return toToolResult(await apiPost(`/api/backups/${id}/restore`, {}));
      },
    },
    {
      name: 'operations_list_health_checks',
      description: 'List health checks, optionally filtered by instance.',
      inputSchema: z.object({
        instanceId: uuidSchema.optional().describe('Filter by instance UUID'),
      }),
      handler: async (args) => {
        const { instanceId } = (args ?? {}) as { instanceId?: string };
        return toToolResult(await apiGet('/api/health-checks', { instanceId }));
      },
    },
    {
      name: 'operations_health_check_stats',
      description: 'Aggregate health check statistics.',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiGet('/api/health-checks/stats')),
    },
    {
      name: 'operations_list_maintenance_windows',
      description: 'List planned maintenance windows.',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiGet('/api/maintenance-windows')),
    },
    {
      name: 'operations_maintenance_window_stats',
      description: 'Aggregate maintenance window statistics.',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiGet('/api/maintenance-windows/stats')),
    },
    {
      name: 'operations_get_compliance_report',
      description: 'Get the instance compliance report (security and continuity rules).',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiGet('/api/compliance')),
    },
    {
      name: 'operations_maintenance_alerts',
      description: 'List maintenance orchestrator alerts.',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiGet('/api/maintenance-orchestrator/alerts')),
    },
    {
      name: 'operations_maintenance_schedule',
      description: 'Get the maintenance orchestrator schedule.',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiGet('/api/maintenance-orchestrator/schedule')),
    },
    {
      name: 'operations_maintenance_impact',
      description: 'Compute the impact of a hypothetical maintenance window.',
      inputSchema: z.object({
        azCode: z.string().min(1).optional().describe('Availability zone code'),
        zoneId: uuidSchema.optional().describe('Zone UUID'),
        startsAt: z.string().optional().describe('Window start (ISO 8601)'),
        endsAt: z.string().optional().describe('Window end (ISO 8601)'),
      }),
      handler: async (args) => toToolResult(await apiPost('/api/maintenance-orchestrator/impact', args)),
    },
  ],
};

// ---------------------------------------------------------------------------
// Planning group — forecasts, dependencies, continuity, presentation orders
// ---------------------------------------------------------------------------
const planningGroup: McpToolGroup = {
  name: 'planning',
  description: 'Capacity planning: forecasts, dependencies, continuity levels, presentation orders and users.',
  tools: [
    {
      name: 'planning_list_forecasts',
      description: 'List capacity forecasts, optionally filtered by status.',
      inputSchema: z.object({
        status: z
          .enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED'])
          .optional()
          .describe('Forecast workflow status'),
      }),
      handler: async (args) => {
        const { status } = (args ?? {}) as { status?: string };
        return toToolResult(await apiGet('/api/forecasts', { status }));
      },
    },
    {
      name: 'planning_get_forecast',
      description: 'Get one forecast by UUID.',
      inputSchema: z.object({ id: uuidSchema.describe('Forecast UUID') }),
      handler: async (args) => {
        const { id } = (args ?? {}) as { id: string };
        return toToolResult(await apiGet(`/api/forecasts/${id}`));
      },
    },
    {
      name: 'planning_forecast_stats',
      description: 'Aggregate forecast statistics.',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiGet('/api/forecasts/stats')),
    },
    {
      name: 'planning_create_forecast',
      description: 'Create a capacity forecast draft.',
      inputSchema: z.object({
        payload: z.record(z.unknown()).describe('Forecast payload (lines, quantities, zones)'),
      }),
      handler: async (args) => {
        const { payload } = (args ?? {}) as { payload: Record<string, unknown> };
        return toToolResult(await apiPost('/api/forecasts', payload));
      },
    },
    {
      name: 'planning_transition_forecast',
      description:
        "Run a forecast workflow transition (submit, approve, reject, cancel or resubmit). " +
        'The governance API records who performed the action — actorName is mandatory; ' +
        'reject also requires a comment (the rejection reason).',
      inputSchema: z.object({
        id: uuidSchema.describe('Forecast UUID'),
        action: z.enum(['submit', 'approve', 'reject', 'cancel', 'resubmit']),
        actorName: z.string().min(1).describe('Display name of the person performing the action'),
        actorEmail: z.string().email().optional().describe('Actor email (used to resolve their roles)'),
        actorId: uuidSchema.optional().describe('Actor user UUID (used to resolve their roles)'),
        comment: z.string().optional().describe('Comment recorded in the transition history (mandatory for reject)'),
      }),
      handler: async (args) => {
        const { id, action, ...actor } = (args ?? {}) as Record<string, unknown> & {
          id: string;
          action: string;
        };
        return toToolResult(await apiPost(`/api/forecasts/${id}/${action}`, actor));
      },
    },
    {
      name: 'planning_list_dependencies',
      description: 'List product dependencies, optionally filtered by product.',
      inputSchema: z.object({
        productId: uuidSchema.optional().describe('Filter by product UUID'),
      }),
      handler: async (args) => {
        const { productId } = (args ?? {}) as { productId?: string };
        return toToolResult(await apiGet('/api/dependencies', { productId }));
      },
    },
    {
      name: 'planning_list_continuity_levels',
      description: 'List continuity levels (P1, P2...).',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiGet('/api/continuity-levels')),
    },
    {
      name: 'planning_get_continuity_level',
      description: 'Get one continuity level by UUID.',
      inputSchema: z.object({ id: uuidSchema.describe('Continuity level UUID') }),
      handler: async (args) => {
        const { id } = (args ?? {}) as { id: string };
        return toToolResult(await apiGet(`/api/continuity-levels/${id}`));
      },
    },
    {
      name: 'planning_list_presentation_orders',
      description: 'List presentation orders (catalog display ordering).',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiGet('/api/presentation-orders')),
    },
    {
      name: 'planning_list_users',
      description: 'List marketplace users.',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiGet('/api/users')),
    },
  ],
};

/** Full-CRUD authoring group (factory-generated from the resource table). */
const authoringGroup: McpToolGroup = buildAuthoringGroup();

/**
 * All tool groups, in registration order — admin tools registered
 * UNCONDITIONALLY.
 *
 * The /api/admin routes keep their own guard (the API's adminAuth
 * middleware): enforcement happens server-side, per request. When
 * ADMIN_API_KEY is configured the api-client sends the x-admin-api-key
 * header (it reads the same env); when it is not, the admin routes run
 * open — the same behaviour the GUI relies on. Registering the tools
 * always keeps the MCP a full GUI substitute.
 */
export function getMcpToolGroups(): McpToolGroup[] {
  return [
    catalogGroup,
    infrastructureGroup,
    operationsGroup,
    planningGroup,
    authoringGroup,
    buildAdminGroup(),
  ].filter((group): group is McpToolGroup => group !== null);
}

/** Backwards-compatible snapshot (admin evaluated at call time). */
export function getMcpToolGroupsSnapshot(): McpToolGroup[] {
  return getMcpToolGroups();
}

/** Flat, de-duplicated list of every registered tool name. */
export function getMcpToolNames(): string[] {
  return getMcpToolGroups().flatMap((group) => group.tools.map((tool) => tool.name));
}

/** Lightweight summaries used by tests and diagnostics. */
export function getMcpToolSummaries(): Array<{
  name: string;
  description: string;
  schemaType: string;
}> {
  return getMcpToolGroups().flatMap((group) =>
    group.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      schemaType: tool.inputSchema.constructor?.name ?? 'unknown',
    })),
  );
}

/**
 * Register every tool group on an McpServer instance.
 * The SDK converts each zod input schema into the JSON inputSchema served
 * over tools/list.
 */
export function registerMcpTools(server: McpServer): void {
  for (const group of getMcpToolGroups()) {
    for (const tool of group.tools) {
      server.registerTool(tool.name, {
        description: tool.description,
        // The SDK expects a ZodRawShape; it wraps it in z.object() and
        // converts it to the JSON inputSchema served over tools/list.
        inputSchema: tool.inputSchema.shape,
      }, async (args: unknown) => {
        try {
          return await tool.handler(args);
        } catch (cause) {
          // Defensive: tool handlers should not throw, but if one does the
          // model must still get a readable message, never a stack trace.
          const message =
            cause instanceof Error && cause.message ? cause.message : String(cause);
          return toToolResult({
            ok: false,
            error: `Tool ${tool.name} failed: ${message}`,
          });
        }
      });
    }
  }
}
