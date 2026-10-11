/**
 * Availability MCP tools (read-only) — zones and availability zones.
 *
 * Part of the shared MCP tool registry: the group below follows the exact
 * McpToolGroup contract of ./tools (../tools) so the registry can aggregate
 * it alongside the other groups. Every handler goes through the internal
 * api-client (../api-client) and targets the existing REST routes on
 * 127.0.0.1:3001.
 *
 * All tools are GET-backed (no mutating operation).
 */
import { z } from 'zod';
import type { McpToolGroup } from '../tools';
import { apiGet, toToolResult } from '../api-client';

const uuidSchema = z.string().uuid();

export const availabilityGroup: McpToolGroup = {
  name: 'availability',
  description:
    'Inspect where CloudMarket resources can run (read-only): infrastructure zones and availability zones with their regions.',
  tools: [
    {
      name: 'availability_list_zones',
      description: 'List infrastructure zones with their linked availability zones.',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiGet('/api/zones')),
    },
    {
      name: 'availability_get_zone',
      description: 'Get one infrastructure zone by UUID, including its availability zones.',
      inputSchema: z.object({ id: uuidSchema.describe('Zone UUID') }),
      handler: async (args) => {
        const { id } = (args ?? {}) as { id: string };
        return toToolResult(await apiGet(`/api/zones/${encodeURIComponent(id)}`));
      },
    },
    {
      name: 'availability_list_availability_zones',
      description:
        'List availability zones (AZs) with their city, country, region and infrastructure versions.',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiGet('/api/availability-zones')),
    },
    {
      name: 'availability_get_availability_zone',
      description: 'Get one availability zone (AZ) by UUID.',
      inputSchema: z.object({ id: uuidSchema.describe('Availability zone UUID') }),
      handler: async (args) => {
        const { id } = (args ?? {}) as { id: string };
        return toToolResult(await apiGet(`/api/availability-zones/${encodeURIComponent(id)}`));
      },
    },
  ],
};
