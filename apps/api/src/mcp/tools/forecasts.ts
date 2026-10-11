/**
 * Forecast lifecycle MCP tools — write path of the capacity-planning
 * workflow (list, get, create, submit, approve, reject, cancel, resubmit,
 * delete).
 *
 * Part of the shared MCP tool registry: the group below follows the exact
 * McpToolGroup contract of ../tools so the registry can aggregate it
 * alongside the other groups. Every handler goes through the internal
 * api-client (../api-client) and targets the existing REST routes on
 * 127.0.0.1:3001 (/api/forecasts), so the model sees exactly what a REST
 * client sees — including the governance rules (sequential steps, mandatory
 * rejection reason, role checks) enforced by the API itself.
 */
import { z } from 'zod';
import type { McpToolGroup } from '../tools';
import { apiDelete, apiGet, apiPost, toToolResult } from '../api-client';

const uuidSchema = z.string().uuid();

const forecastStatusSchema = z.enum([
  'DRAFT',
  'PENDING_TECH',
  'PENDING_MANAGER',
  'PENDING_BUDGET',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
]);

const forecastLineSchema = z.object({
  productId: uuidSchema.describe('Product UUID'),
  variantId: uuidSchema.optional().describe('Product variant UUID'),
  flavorId: uuidSchema.describe('Flavor UUID — must match a catalog variant of the product'),
  azCode: z.string().min(1).describe('Availability zone code (e.g. eu-west-par1)'),
  quantity: z.number().int().min(1).describe('Number of units'),
  metadata: z.record(z.unknown()).optional().describe('Free-form line metadata (e.g. { osVersion })'),
  resiliency: z
    .enum(['STANDARD', 'HA', 'MULTI_AZ'])
    .optional()
    .describe('HA and MULTI_AZ require at least 2 distinct availability zones for the product'),
});

/** Actor fields accepted by every lifecycle action endpoint. */
const actorFields = {
  actorName: z.string().min(1).describe('Display name of the person performing the action'),
  actorEmail: z.string().email().optional().describe('Actor email (used to resolve their roles)'),
  actorId: uuidSchema.optional().describe('Actor user UUID (used to resolve their roles)'),
  comment: z.string().optional().describe('Optional comment recorded in the transition history'),
};

export const forecastsGroup: McpToolGroup = {
  name: 'forecasts',
  description:
    'Forecast request lifecycle: list and read capacity forecasts, create drafts, then drive ' +
    'them through submit, approve, reject, cancel, resubmit and delete.',
  tools: [
    {
      name: 'forecasts_list_forecasts',
      description:
        'List forecasts, optionally filtered by workflow status (queue) and requester.',
      inputSchema: z.object({
        status: forecastStatusSchema
          .optional()
          .describe('Filter by workflow status'),
        mine: z
          .string()
          .min(1)
          .optional()
          .describe('Filter to forecasts requested by this name or email'),
      }),
      handler: async (args) => {
        const { status, mine } = (args ?? {}) as { status?: string; mine?: string };
        // The REST route reads ?queue=<STATUS> and ?mine=<name-or-email>.
        return toToolResult(await apiGet('/api/forecasts', { queue: status, mine }));
      },
    },
    {
      name: 'forecasts_get_forecast',
      description:
        'Get one forecast by UUID, including its lines, transition history and application.',
      inputSchema: z.object({ id: uuidSchema.describe('Forecast UUID') }),
      handler: async (args) => {
        const { id } = (args ?? {}) as { id: string };
        return toToolResult(await apiGet(`/api/forecasts/${encodeURIComponent(id)}`));
      },
    },
    {
      name: 'forecasts_get_governance',
      description:
        'Get the forecast governance definition: lifecycle steps, rules (mandatory rejection ' +
        'reason, HA/Multi-AZ, role checks), SLA targets and recent transitions.',
      inputSchema: z.object({}),
      handler: async () => toToolResult(await apiGet('/api/forecasts/governance')),
    },
    {
      name: 'forecasts_create_forecast',
      description:
        'Create a capacity forecast draft (status DRAFT). Pass submit:true to create and ' +
        'submit it for technical review in one call.',
      inputSchema: z.object({
        requestedBy: z.string().min(1).describe('Requester display name'),
        requesterEmail: z.string().email().describe('Requester email'),
        applicationId: uuidSchema.describe('Application the forecast belongs to'),
        lines: z.array(forecastLineSchema).min(1).describe('Forecast lines (at least one)'),
        targetDate: z
          .string()
          .optional()
          .describe('Desired availability date (YYYY-MM-DD or ISO 8601)'),
        justification: z.string().optional().describe('Business justification'),
        environment: z
          .enum(['PRD', 'DEV', 'STG'])
          .optional()
          .describe('Target environment (defaults to DEV)'),
        submit: z.boolean().optional().describe('Create and submit in one call'),
      }),
      handler: async (args) => toToolResult(await apiPost('/api/forecasts', args)),
    },
    {
      name: 'forecasts_submit_forecast',
      description:
        'Submit a DRAFT forecast for technical review (DRAFT → PENDING_TECH).',
      inputSchema: z.object({
        id: uuidSchema.describe('Forecast UUID'),
        ...actorFields,
      }),
      handler: async (args) => {
        const { id, ...body } = (args ?? {}) as Record<string, unknown> & { id: string };
        return toToolResult(await apiPost(`/api/forecasts/${encodeURIComponent(id)}/submit`, body));
      },
    },
    {
      name: 'forecasts_approve_forecast',
      description:
        'Approve the forecast at its current review step (tech lead → manager → finance); ' +
        'the API enforces the role required for the current step.',
      inputSchema: z.object({
        id: uuidSchema.describe('Forecast UUID'),
        ...actorFields,
      }),
      handler: async (args) => {
        const { id, ...body } = (args ?? {}) as Record<string, unknown> & { id: string };
        return toToolResult(await apiPost(`/api/forecasts/${encodeURIComponent(id)}/approve`, body));
      },
    },
    {
      name: 'forecasts_reject_forecast',
      description:
        'Reject the forecast from any review step with a mandatory written reason ' +
        '(the reason is stored and visible in the audit trail).',
      inputSchema: z.object({
        id: uuidSchema.describe('Forecast UUID'),
        ...actorFields,
        comment: z.string().min(1).describe('Rejection reason (mandatory)'),
      }),
      handler: async (args) => {
        const { id, ...body } = (args ?? {}) as Record<string, unknown> & { id: string };
        return toToolResult(await apiPost(`/api/forecasts/${encodeURIComponent(id)}/reject`, body));
      },
    },
    {
      name: 'forecasts_cancel_forecast',
      description:
        'Cancel a DRAFT or pending-review forecast (requester action; CANCELLED is final).',
      inputSchema: z.object({
        id: uuidSchema.describe('Forecast UUID'),
        ...actorFields,
      }),
      handler: async (args) => {
        const { id, ...body } = (args ?? {}) as Record<string, unknown> & { id: string };
        return toToolResult(await apiPost(`/api/forecasts/${encodeURIComponent(id)}/cancel`, body));
      },
    },
    {
      name: 'forecasts_resubmit_forecast',
      description:
        'Resubmit a REJECTED forecast for technical review (REJECTED → PENDING_TECH).',
      inputSchema: z.object({
        id: uuidSchema.describe('Forecast UUID'),
        ...actorFields,
      }),
      handler: async (args) => {
        const { id, ...body } = (args ?? {}) as Record<string, unknown> & { id: string };
        return toToolResult(await apiPost(`/api/forecasts/${encodeURIComponent(id)}/resubmit`, body));
      },
    },
    {
      name: 'forecasts_delete_forecast',
      description: 'Permanently delete a forecast by UUID.',
      inputSchema: z.object({ id: uuidSchema.describe('Forecast UUID') }),
      handler: async (args) => {
        const { id } = (args ?? {}) as { id: string };
        return toToolResult(await apiDelete(`/api/forecasts/${encodeURIComponent(id)}`));
      },
    },
  ],
};
