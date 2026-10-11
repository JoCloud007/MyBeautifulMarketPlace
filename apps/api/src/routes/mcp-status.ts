/**
 * MCP status route — public, non-sensitive view of the MCP endpoint state.
 *
 * Serves GET /api/mcp-status for the web "MCP" page (state + how to
 * connect). Deliberately reveals ONLY booleans and counts:
 * - `enabled`: whether MCP_API_KEY is configured (fail-closed gate). The
 *   key itself is NEVER included in the response.
 * - `sseEnabled`: whether the legacy SSE fallback is active.
 * - tool counts per registry group (admin shown only when registered).
 * - endpoint URLs (host-relative info a client needs to connect).
 *
 * No DATABASE access — reads the shared registry and env only.
 */
import { Router } from 'express';
import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from '../mcp/server';
import { getMcpToolGroups } from '../mcp/tools';
import { MCP_ENDPOINT_PATH } from '../mcp/http';

export const mcpStatusRouter = Router();

/** True when the legacy SSE fallback is enabled (MCP_ENABLE_SSE=1). */
function isSseEnabled(): boolean {
  return process.env.MCP_ENABLE_SSE === '1';
}

/**
 * Build the status payload. Extracted for testability (registry + env are
 * read at call time, same principle as the registry's dynamic admin group).
 */
export function buildMcpStatus() {
  const groups = getMcpToolGroups().map((group) => ({
    name: group.name,
    description: group.description,
    toolCount: group.tools.length,
    tools: group.tools.map((tool) => ({ name: tool.name, description: tool.description })),
  }));

  return {
    server: { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    enabled: true,
    authRequired: !!process.env.MCP_API_KEY?.trim(),
    sseEnabled: isSseEnabled(),
    transport: 'streamable-http' as const,
    endpoint: MCP_ENDPOINT_PATH,
    toolCount: groups.reduce((sum, group) => sum + group.toolCount, 0),
    groups,
  };
}

mcpStatusRouter.get('/mcp-status', (_req, res) => {
  res.json(buildMcpStatus());
});
