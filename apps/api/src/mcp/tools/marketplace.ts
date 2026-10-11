/**
 * Marketplace MCP tools (read-only) — products, categories, flavors, OS,
 * variants.
 *
 * Part of the shared MCP tool registry: the group below follows the exact
 * McpToolGroup contract of ./tools (../tools) so the registry can aggregate
 * it alongside the other groups. Every handler goes through the internal
 * api-client (../api-client) and targets the existing REST routes on
 * 127.0.0.1:3001, so the model sees exactly what a REST client sees.
 *
 * All tools are GET-backed (no mutating operation).
 */
import { z } from 'zod';
import type { McpToolGroup } from '../tools';
import { apiGet, toToolResult } from '../api-client';

const uuidSchema = z.string().uuid();
const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, digits and hyphens');

export const marketplaceGroup: McpToolGroup = {
  name: 'marketplace',
  description:
    'Browse the CloudMarket marketplace catalog (read-only): products, categories, flavors, operating systems and variants.',
  tools: [
    {
      name: 'marketplace_list_products',
      description:
        'List active products, optionally filtered by category slug, compute type or free-text search.',
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
      name: 'marketplace_get_product',
      description:
        'Get one product by slug with its active variants, dependencies, upgrade paths and availability.',
      inputSchema: z.object({ slug: slugSchema.describe('Product slug (e.g. "ubuntu-vm")') }),
      handler: async (args) => {
        const { slug } = (args ?? {}) as { slug: string };
        return toToolResult(await apiGet(`/api/products/${encodeURIComponent(slug)}`));
      },
    },
    {
      name: 'marketplace_list_categories',
      description: 'List product categories with their product counts.',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiGet('/api/categories')),
    },
    {
      name: 'marketplace_get_category',
      description: 'Get one category by slug, including its products.',
      inputSchema: z.object({ slug: slugSchema.describe('Category slug') }),
      handler: async (args) => {
        const { slug } = (args ?? {}) as { slug: string };
        return toToolResult(await apiGet(`/api/categories/${encodeURIComponent(slug)}`));
      },
    },
    {
      name: 'marketplace_list_flavors',
      description: 'List compute flavors (vCPU, RAM, disk sizing) with their zone availability.',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiGet('/api/flavors')),
    },
    {
      name: 'marketplace_get_flavor',
      description: 'Get one compute flavor by UUID, including its variants.',
      inputSchema: z.object({ id: uuidSchema.describe('Flavor UUID') }),
      handler: async (args) => {
        const { id } = (args ?? {}) as { id: string };
        return toToolResult(await apiGet(`/api/flavors/${encodeURIComponent(id)}`));
      },
    },
    {
      name: 'marketplace_list_os',
      description: 'List supported operating systems with their versions.',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiGet('/api/os')),
    },
    {
      name: 'marketplace_list_product_variants',
      description: 'List the variants (OS + flavor + availability combinations) of one product.',
      inputSchema: z.object({ productId: uuidSchema.describe('Product UUID') }),
      handler: async (args) => {
        const { productId } = (args ?? {}) as { productId: string };
        return toToolResult(await apiGet(`/api/products/${encodeURIComponent(productId)}/variants`));
      },
    },
    {
      name: 'marketplace_get_variant',
      description:
        'Get one product variant by UUID (OS, OS version, flavor, availability zones, continuity level).',
      inputSchema: z.object({ id: uuidSchema.describe('Variant UUID') }),
      handler: async (args) => {
        const { id } = (args ?? {}) as { id: string };
        return toToolResult(await apiGet(`/api/variants/${encodeURIComponent(id)}`));
      },
    },
  ],
};
