/**
 * Ops MCP tools (READ-ONLY) — health, topology, maintenance windows,
 * backups.
 *
 * Part of the shared MCP tool registry: the group below follows the exact
 * McpToolGroup contract of ./tools (../tools) so the registry can aggregate
 * it alongside the other groups. Every handler goes through the internal
 * api-client (../api-client) and targets the existing REST routes on
 * 127.0.0.1:3001.
 *
 * Contract: this group exposes NO mutating operation. Every handler is
 * GET-backed (list/get/stats only); creation, restoration and deletion of
 * backups, maintenance windows and instances stay outside the MCP surface.
 */
import { z } from 'zod';
import type { McpToolGroup } from '../tools';
import { apiGet, toToolResult } from '../api-client';

const uuidSchema = z.string().uuid();

export const opsGroup: McpToolGroup = {
  name: 'ops',
  description:
    'Operational visibility (read-only): API health, infrastructure topology, instance health checks, maintenance windows and backups.',
  tools: [
    {
      name: 'ops_health',
      description: 'Check that the CloudMarket API is up and read its server timestamp.',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiGet('/health')),
    },
    {
      name: 'ops_get_topology',
      description:
        'Get the full infrastructure topology graph: application/product nodes and instance, dependency and relation edges.',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiGet('/api/topology')),
    },
    {
      name: 'ops_list_health_checks',
      description:
        'List instance health checks, optionally filtered by instance UUID or status (HEALTHY, DEGRADED, UNHEALTHY).',
      inputSchema: z.object({
        instanceId: uuidSchema.optional().describe('Filter by instance UUID'),
        status: z.enum(['HEALTHY', 'DEGRADED', 'UNHEALTHY']).optional(),
      }),
      handler: async (args) => {
        const { instanceId, status } = (args ?? {}) as { instanceId?: string; status?: string };
        return toToolResult(await apiGet('/api/health-checks', { instanceId, status }));
      },
    },
    {
      name: 'ops_health_check_stats',
      description: 'Aggregate health check statistics (total, healthy, degraded, unhealthy).',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiGet('/api/health-checks/stats')),
    },
    {
      name: 'ops_list_maintenance_windows',
      description:
        'List planned maintenance windows, optionally filtered by instance, application or status (SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED).',
      inputSchema: z.object({
        instanceId: uuidSchema.optional().describe('Filter by instance UUID'),
        applicationId: uuidSchema.optional().describe('Filter by application UUID'),
        status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
      }),
      handler: async (args) => {
        const { instanceId, applicationId, status } = (args ?? {}) as {
          instanceId?: string;
          applicationId?: string;
          status?: string;
        };
        return toToolResult(
          await apiGet('/api/maintenance-windows', { instanceId, applicationId, status }),
        );
      },
    },
    {
      name: 'ops_maintenance_window_stats',
      description:
        'Aggregate maintenance window statistics (total, scheduled, in progress, completed, cancelled).',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiGet('/api/maintenance-windows/stats')),
    },
    {
      name: 'ops_list_instance_backups',
      description: 'List the backups attached to one instance, newest first.',
      inputSchema: z.object({ instanceId: uuidSchema.describe('Instance UUID') }),
      handler: async (args) => {
        const { instanceId } = (args ?? {}) as { instanceId: string };
        return toToolResult(
          await apiGet(`/api/backups/instances/${encodeURIComponent(instanceId)}/backups`),
        );
      },
    },
    {
      name: 'ops_get_backup',
      description: 'Get one backup by UUID (metadata and status only — restoring is not exposed).',
      inputSchema: z.object({ id: uuidSchema.describe('Backup UUID') }),
      handler: async (args) => {
        const { id } = (args ?? {}) as { id: string };
        return toToolResult(await apiGet(`/api/backups/${encodeURIComponent(id)}`));
      },
    },
  ],
};
