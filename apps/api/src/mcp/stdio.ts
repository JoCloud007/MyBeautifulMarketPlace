/**
 * Local stdio entrypoint for the CloudMarket MCP server.
 *
 * Run with: npm run mcp:stdio    (i.e. `node dist/mcp/stdio.js`)
 *
 * It reuses buildMcpServer() from ./server so the exposed tool list is
 * exactly the shared registry's — identical to the Streamable HTTP
 * transport (./http) and the legacy SSE transport (./sse). JSON-RPC
 * messages are read on stdin and answered on stdout; everything meant for
 * a human is written to stderr (console.error) because stdout carries the
 * protocol. Tool calls reach the existing REST API on 127.0.0.1:3001 via
 * ./api-client — no new port, no new service.
 *
 * The auto-start is guarded by `require.main === module` so importing the
 * module (tests, tooling) never hijacks stdio; running the compiled file
 * as a script starts the server as before.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildMcpServer } from './server';

export async function main(): Promise<void> {
  const server = buildMcpServer();
  await server.connect(new StdioServerTransport());
  console.error('CloudMarket MCP server ready (stdio) — tools call REST API on 127.0.0.1:3001');
}

if (require.main === module) {
  main().catch((e: unknown) => {
    console.error(
      'CloudMarket MCP server failed to start:',
      e instanceof Error ? e.message : String(e),
    );
    process.exit(1);
  });
}
