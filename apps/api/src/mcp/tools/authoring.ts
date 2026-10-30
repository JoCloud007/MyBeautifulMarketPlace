/**
 * Authoring MCP tools — full create/update/delete coverage so the MCP can
 * substitute for the GUI.
 *
 * Instead of hand-writing ~60 near-identical tool definitions, a factory
 * generates them from a resource table: each entry produces
 * authoring_create_<name> / authoring_update_<name> / authoring_delete_<name>
 * against the documented REST path.
 *
 * IMPORTANT (SDK constraint): the registry passes `inputSchema.shape` to the
 * SDK, which re-wraps it in a STRICT z.object — any argument field not
 * declared in the shape is STRIPPED before the handler runs. Free-form
 * bodies therefore travel in an explicit `body` field (z.record) instead of
 * spreading fields at the top level. Field validation stays in the REST
 * API; its errors surface as readable tool results (translateHttpError).
 */
import { z } from 'zod';
import type { McpToolDefinition, McpToolGroup } from '../tools';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut, toToolResult } from '../api-client';

const uuidSchema = z.string().uuid();

/** Free-form JSON payload — field validation lives in the REST API. */
const bodyField = z
  .record(z.unknown())
  .describe('JSON payload with the object fields (the API validates them)');

/** id + free-form partial payload for updates. */
const updateBody = z.object({
  id: uuidSchema.describe('Resource UUID'),
  fields: bodyField,
});

interface WriteResource {
  /** Tool suffix, e.g. 'application' → authoring_create_application. */
  name: string;
  /** REST base path, e.g. '/api/applications'. */
  basePath: string;
  /** Which operations the REST API exposes for this resource. */
  ops: Array<'create' | 'update' | 'delete'>;
  /** update uses PUT instead of PATCH (zones, os). */
  updateMethod?: 'PUT' | 'PATCH';
  /** Human hint appended to every generated description. */
  hint: string;
}

const RESOURCES: WriteResource[] = [
  { name: 'application', basePath: '/api/applications', ops: ['create', 'update', 'delete'], hint: 'Applications and their continuity level.' },
  { name: 'availability_zone', basePath: '/api/availability-zones', ops: ['create', 'update', 'delete'], hint: 'Availability zones (AZs).' },
  { name: 'category', basePath: '/api/categories', ops: ['create', 'update', 'delete'], hint: 'Product categories. Example body: {"name": "Storage", "description": "..."}' },
  { name: 'flavor', basePath: '/api/flavors', ops: ['create', 'update', 'delete'], hint: 'Compute flavors (vCPU / RAM). Example body: {"name": "m", "vcpu": 4, "ramGb": 16}' },
  { name: 'dependency', basePath: '/api/dependencies', ops: ['create', 'update', 'delete'], hint: 'Product dependencies.' },
  { name: 'health_check', basePath: '/api/health-checks', ops: ['create', 'update', 'delete'], hint: 'Instance health checks.' },
  { name: 'infra_version', basePath: '/api/infra-versions', ops: ['create', 'update', 'delete'], hint: 'Infrastructure versions.' },
  { name: 'maintenance_window', basePath: '/api/maintenance-windows', ops: ['create', 'update', 'delete'], hint: 'Planned maintenance windows.' },
  { name: 'performance_profile', basePath: '/api/performance-profiles', ops: ['create', 'update', 'delete'], hint: 'Performance profiles (benchmark scores).' },
  { name: 'presentation_order', basePath: '/api/presentation-orders', ops: ['create', 'update', 'delete'], hint: 'Catalog display ordering.' },
  // create is NOT factory-generated: POST /api/product-versions has no
  // :productId and the router 404s — creation lives on the nested route
  // (see authoring_create_product_version below).
  { name: 'product_version', basePath: '/api/product-versions', ops: ['update', 'delete'], hint: 'Product versions and lifecycle dates.' },
  { name: 'product', basePath: '/api/products', ops: ['create', 'update', 'delete'], hint: 'Catalog products (categoryId, computeType...).' },
  { name: 'zone', basePath: '/api/zones', ops: ['create', 'update', 'delete'], updateMethod: 'PUT', hint: 'Infrastructure zones.' },
  { name: 'os', basePath: '/api/os', ops: ['create', 'update', 'delete'], updateMethod: 'PUT', hint: 'Operating systems.' },
  { name: 'region', basePath: '/api/regions', ops: ['create', 'update', 'delete'], hint: 'Geographic regions.' },
];

function buildResourceTools(resource: WriteResource): McpToolDefinition[] {
  const label = resource.name.replace(/_/g, ' ');
  const tools: McpToolDefinition[] = [];

  if (resource.ops.includes('create')) {
    tools.push({
      name: `authoring_create_${resource.name}`,
      description: `Create a ${label} — POST ${resource.basePath}. ${resource.hint}`,
      inputSchema: z.object({ body: bodyField }),
      handler: async (args) => {
        const { body } = (args ?? {}) as { body?: Record<string, unknown> };
        return toToolResult(await apiPost(resource.basePath, body ?? {}));
      },
    });
  }

  if (resource.ops.includes('update')) {
    const method = resource.updateMethod ?? 'PATCH';
    tools.push({
      name: `authoring_update_${resource.name}`,
      description: `Update a ${label} — ${method} ${resource.basePath}/:id. ${resource.hint}`,
      inputSchema: updateBody,
      handler: async (args) => {
        const { id, fields } = (args ?? {}) as { id: string; fields?: Record<string, unknown> };
        const result =
          method === 'PUT'
            ? await apiPut(`${resource.basePath}/${id}`, fields ?? {})
            : await apiPatch(`${resource.basePath}/${id}`, fields ?? {});
        return toToolResult(result);
      },
    });
  }

  if (resource.ops.includes('delete')) {
    tools.push({
      name: `authoring_delete_${resource.name}`,
      description: `Delete a ${label} — DELETE ${resource.basePath}/:id. The API refuses deletion when other records reference it (409).`,
      inputSchema: z.object({ id: uuidSchema.describe('Resource UUID') }),
      handler: async (args) => {
        const { id } = (args ?? {}) as { id: string };
        return toToolResult(await apiDelete(`${resource.basePath}/${id}`));
      },
    });
  }

  return tools;
}

/** Named extras — write flows that do not fit the base-path factory. */
function buildExtraTools(): McpToolDefinition[] {
  return [
    // Product versions: creation lives on the NESTED route only —
    // POST /api/product-versions (flat) has no :productId and 404s.
    {
      name: 'authoring_create_product_version',
      description:
        'Create a version of a product with its lifecycle dates — POST /api/products/:productId/versions.',
      inputSchema: z.object({
        productId: uuidSchema.describe('Parent product UUID'),
        body: bodyField,
      }),
      handler: async (args) => {
        const { productId, body } = (args ?? {}) as {
          productId: string;
          body?: Record<string, unknown>;
        };
        return toToolResult(
          await apiPost(`/api/products/${productId}/versions`, body ?? {}),
        );
      },
    },

    // Forecast lifecycle: patch + delete (create + transitions already in planning).
    {
      name: 'authoring_update_forecast',
      description: 'Update a capacity forecast — PATCH /api/forecasts/:id.',
      inputSchema: updateBody,
      handler: async (args) => {
        const { id, fields } = (args ?? {}) as { id: string; fields?: Record<string, unknown> };
        return toToolResult(await apiPatch(`/api/forecasts/${id}`, fields ?? {}));
      },
    },
    {
      name: 'authoring_delete_forecast',
      description: 'Delete a capacity forecast — DELETE /api/forecasts/:id.',
      inputSchema: z.object({ id: uuidSchema.describe('Forecast UUID') }),
      handler: async (args) => {
        const { id } = (args ?? {}) as { id: string };
        return toToolResult(await apiDelete(`/api/forecasts/${id}`));
      },
    },

    // Product sub-objects.
    {
      name: 'authoring_create_product_variant',
      description: 'Create a variant of a product — POST /api/products/:productId/variants.',
      inputSchema: z.object({
        productId: uuidSchema.describe('Parent product UUID'),
        body: bodyField,
      }),
      handler: async (args) => {
        const { productId, body } = (args ?? {}) as {
          productId: string;
          body?: Record<string, unknown>;
        };
        return toToolResult(await apiPost(`/api/products/${productId}/variants`, body ?? {}));
      },
    },
    {
      name: 'authoring_update_product_variant',
      description: 'Update a product variant — PUT /api/variants/:id.',
      inputSchema: updateBody,
      handler: async (args) => {
        const { id, fields } = (args ?? {}) as { id: string; fields?: Record<string, unknown> };
        return toToolResult(await apiPut(`/api/variants/${id}`, fields ?? {}));
      },
    },
    {
      name: 'authoring_delete_product_variant',
      description: 'Delete a product variant — DELETE /api/variants/:id.',
      inputSchema: z.object({ id: uuidSchema.describe('Variant UUID') }),
      handler: async (args) => {
        const { id } = (args ?? {}) as { id: string };
        return toToolResult(await apiDelete(`/api/variants/${id}`));
      },
    },
    {
      name: 'authoring_create_upgrade_path',
      description: 'Create a transition between two product versions (legacy alias, creates a Transition) — POST /api/products/:productId/upgrade-paths.',
      inputSchema: z.object({
        productId: uuidSchema.describe('Product UUID'),
        body: bodyField,
      }),
      handler: async (args) => {
        const { productId, body } = (args ?? {}) as {
          productId: string;
          body?: Record<string, unknown>;
        };
        return toToolResult(await apiPost(`/api/products/${productId}/upgrade-paths`, body ?? {}));
      },
    },
    {
      name: 'authoring_delete_upgrade_path',
      description: 'Delete a transition (legacy alias) — DELETE /api/products/:productId/upgrade-paths/:pathId.',
      inputSchema: z.object({
        productId: uuidSchema.describe('Product UUID'),
        pathId: uuidSchema.describe('Upgrade path UUID'),
      }),
      handler: async (args) => {
        const { productId, pathId } = (args ?? {}) as { productId: string; pathId: string };
        return toToolResult(await apiDelete(`/api/products/${productId}/upgrade-paths/${pathId}`));
      },
    },
    {
      name: 'authoring_create_product_transition',
      description: 'Create a lifecycle transition for a product — POST /api/products/:productId/transitions.',
      inputSchema: z.object({
        productId: uuidSchema.describe('Product UUID'),
        body: bodyField,
      }),
      handler: async (args) => {
        const { productId, body } = (args ?? {}) as {
          productId: string;
          body?: Record<string, unknown>;
        };
        return toToolResult(await apiPost(`/api/products/${productId}/transitions`, body ?? {}));
      },
    },
    {
      name: 'authoring_update_product_transition',
      description:
        'Update a lifecycle transition — PATCH /api/products/transitions/:id. ' +
        'Can switch kind between PRODUCT and OS: kind=OS requires fromOsVersionId and toOsVersionId ' +
        '(fromVersion/toVersion are auto-filled from the OsVersion rows), kind=PRODUCT clears the OS ' +
        'references and uses the free-text fromVersion/toVersion.',
      inputSchema: updateBody,
      handler: async (args) => {
        const { id, fields } = (args ?? {}) as { id: string; fields?: Record<string, unknown> };
        return toToolResult(await apiPatch(`/api/products/transitions/${id}`, fields ?? {}));
      },
    },
    {
      name: 'authoring_delete_product_transition',
      description: 'Delete a lifecycle transition — DELETE /api/products/transitions/:id.',
      inputSchema: z.object({ id: uuidSchema.describe('Transition UUID') }),
      handler: async (args) => {
        const { id } = (args ?? {}) as { id: string };
        return toToolResult(await apiDelete(`/api/products/transitions/${id}`));
      },
    },

    // OS versions (nested under /api/os).
    {
      name: 'authoring_create_os_version',
      description: 'Create a version of an operating system — POST /api/os/:osId/versions.',
      inputSchema: z.object({
        osId: uuidSchema.describe('OS UUID'),
        body: bodyField,
      }),
      handler: async (args) => {
        const { osId, body } = (args ?? {}) as { osId: string; body?: Record<string, unknown> };
        return toToolResult(await apiPost(`/api/os/${osId}/versions`, body ?? {}));
      },
    },
    {
      name: 'authoring_update_os_version',
      description: 'Update an OS version — PUT /api/os/:osId/versions/:versionId.',
      inputSchema: z.object({
        osId: uuidSchema.describe('OS UUID'),
        versionId: uuidSchema.describe('OS version UUID'),
        fields: z.record(z.unknown()).describe('Fields to update (the API validates them)'),
      }),
      handler: async (args) => {
        const { osId, versionId, fields } = (args ?? {}) as {
          osId: string;
          versionId: string;
          fields?: Record<string, unknown>;
        };
        return toToolResult(await apiPut(`/api/os/${osId}/versions/${versionId}`, fields ?? {}));
      },
    },

    // Presentation order steps (reorder the catalog view).
    {
      name: 'authoring_set_presentation_steps',
      description: 'Replace the steps of a presentation order — PUT /api/presentation-orders/:id/steps.',
      inputSchema: z.object({
        id: uuidSchema.describe('Presentation order UUID'),
        body: bodyField,
      }),
      handler: async (args) => {
        const { id, body } = (args ?? {}) as { id: string; body?: Record<string, unknown> };
        return toToolResult(await apiPut(`/api/presentation-orders/${id}/steps`, body ?? {}));
      },
    },

    // Bulk: apply an OS (and optional version) to EVERY variant of a product —
    // the "make this OS available to all VMs" workflow in ONE tool call
    // instead of N update calls the model would have to orchestrate.
    {
      name: 'authoring_apply_os_to_product',
      description:
        'Apply an OS — and optionally one of its versions — to EVERY variant of a product ' +
        '(e.g. make a new OS available to all Virtual Machine sizes). Lists the product ' +
        "variants, sets osId/osVersionId on each via PUT /api/variants/:id, and returns a " +
        'per-variant summary. Use authoring_create_product_variant first if a product has ' +
        'no variants yet.',
      inputSchema: z.object({
        productId: uuidSchema.describe('Product whose variants are updated'),
        osId: uuidSchema.describe('OS UUID to apply (see catalog_list_os)'),
        osVersionId: uuidSchema
          .optional()
          .describe('OS version UUID to apply (see catalog_list_os → versions)'),
      }),
      handler: async (args) => {
        const { productId, osId, osVersionId } = (args ?? {}) as {
          productId: string;
          osId: string;
          osVersionId?: string;
        };

        // The REST API has no GET /api/products/:id — variants come from
        // /api/products/:id/variants and the display name from the list.
        const variantsResult = await apiGet(`/api/products/${productId}/variants`);
        if (!variantsResult.ok) {
          return toToolResult(variantsResult);
        }
        const variants = (variantsResult.data as Array<{ id: string; name: string }>) ?? [];
        const listResult = await apiGet('/api/products');
        const productList =
          listResult.ok ? ((listResult.data as Array<{ id: string; name: string }>) ?? []) : [];
        const product = {
          name: productList.find((p) => p.id === productId)?.name ?? productId,
          variants,
        };
        if (variants.length === 0) {
          return toToolResult({
            ok: true,
            status: 200,
            data: {
              product: product.name ?? productId,
              updated: 0,
              message:
                'This product has no variants yet — create one with authoring_create_product_variant first.',
            },
          });
        }

        const results: Array<{ variant: string; ok: boolean; error?: string }> = [];
        for (const variant of variants) {
          const body: Record<string, unknown> = { osId };
          if (osVersionId) body.osVersionId = osVersionId;
          const updated = await apiPut(`/api/variants/${variant.id}`, body);
          results.push(
            updated.ok
              ? { variant: variant.name, ok: true }
              : { variant: variant.name, ok: false, error: updated.error },
          );
        }

        const failed = results.filter((r) => !r.ok);
        if (failed.length > 0) {
          return toToolResult({
            ok: false,
            status: 200,
            error: `${failed.length} of ${results.length} variants failed to update: ${failed
              .map((f) => `${f.variant}: ${f.error}`)
              .join('; ')}`,
          });
        }
        return toToolResult({
          ok: true,
          status: 200,
          data: {
            product: product.name ?? productId,
            updated: results.length,
            details: results,
          },
        });
      },
    },

    // Continuity levels (PATCH only in the REST API).
    {
      name: 'authoring_update_continuity_level',
      description: 'Update a continuity level (P1, P2...) — PATCH /api/continuity-levels/:id.',
      inputSchema: updateBody,
      handler: async (args) => {
        const { id, fields } = (args ?? {}) as { id: string; fields?: Record<string, unknown> };
        return toToolResult(await apiPatch(`/api/continuity-levels/${id}`, fields ?? {}));
      },
    },

    // ServiceNow integration.
    {
      name: 'authoring_update_servicenow_config',
      description: 'Update the ServiceNow integration configuration — PUT /api/servicenow/config.',
      inputSchema: z.object({ body: bodyField }),
      handler: async (args) => {
        const { body } = (args ?? {}) as { body?: Record<string, unknown> };
        return toToolResult(await apiPut('/api/servicenow/config', body ?? {}));
      },
    },
    {
      name: 'authoring_sync_servicenow',
      description: 'Trigger a ServiceNow synchronization — POST /api/servicenow/sync.',
      inputSchema: z.object({ body: bodyField }),
      handler: async (args) => {
        const { body } = (args ?? {}) as { body?: Record<string, unknown> };
        return toToolResult(await apiPost('/api/servicenow/sync', body ?? {}));
      },
    },

    // Backups: complete the operations group coverage (patch + delete).
    {
      name: 'authoring_update_backup',
      description: 'Update a backup — PATCH /api/backups/:id.',
      inputSchema: updateBody,
      handler: async (args) => {
        const { id, fields } = (args ?? {}) as { id: string; fields?: Record<string, unknown> };
        return toToolResult(await apiPatch(`/api/backups/${id}`, fields ?? {}));
      },
    },
    {
      name: 'authoring_delete_backup',
      description: 'Delete a backup — DELETE /api/backups/:id.',
      inputSchema: z.object({ id: uuidSchema.describe('Backup UUID') }),
      handler: async (args) => {
        const { id } = (args ?? {}) as { id: string };
        return toToolResult(await apiDelete(`/api/backups/${id}`));
      },
    },
  ];
}

/** Build the authoring group: factory-generated CRUD + named extras. */
export function buildAuthoringGroup(): McpToolGroup {
  const tools = RESOURCES.flatMap((resource) => buildResourceTools(resource)).concat(
    buildExtraTools(),
  );

  const names = new Set<string>();
  for (const tool of tools) {
    if (names.has(tool.name)) {
      throw new Error(`Duplicate authoring tool name: ${tool.name}`);
    }
    names.add(tool.name);
  }

  return {
    name: 'authoring',
    description:
      'Full create/update/delete coverage over every CloudMarket object, so the MCP can ' +
      'substitute for the GUI. Payloads travel in the `body` / `fields` argument; field ' +
      'validation is done by the REST API and errors come back as readable messages.',
    tools,
  };
}
