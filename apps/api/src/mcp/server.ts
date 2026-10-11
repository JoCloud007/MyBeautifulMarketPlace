/**
 * CloudMarket MCP server core.
 *
 * buildMcpServer() returns an MCP SDK McpServer instance whose tool set
 * comes exclusively from the shared registry (./tools). The module is
 * self-contained under apps/api/src/mcp and mounts nothing by itself: it
 * is consumed by the stdio entrypoint (./stdio) on the already-published
 * API port context (REST calls go to 127.0.0.1:3001 via ./api-client).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerMcpTools } from './tools';

export const MCP_SERVER_NAME = 'cloudmarket-api';
export const MCP_SERVER_VERSION = '1.0.0';

/**
 * Build the CloudMarket MCP server.
 * The returned McpServer has every registry tool registered (zod input
 * schemas converted to JSON inputSchema) but is not connected to any
 * transport yet — callers choose stdio, in-memory, etc.
 */
export function buildMcpServer(): McpServer {
  const server = new McpServer(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    {
      instructions:
        'CloudMarket IaaS marketplace API. Tools mirror the existing REST routes ' +
        '(catalog, infrastructure, operations, planning, admin). Errors are returned ' +
        'as readable tool results; there is no need to retry with stack traces.',
    },
  );

  registerMcpTools(server);

  return server;
}
