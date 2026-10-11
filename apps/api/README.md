# CloudMarket API

Backend of the CloudMarket IaaS marketplace: **Express 4 + Prisma 5**, CommonJS `tsc` build, **jest + ts-jest + supertest**, served by the existing docker-compose `api` container.

- **Port**: `3001` (already published by `docker-compose.yml`)
- **REST base**: `/api/*` (products, categories, flavors, forecasts, instances, zones, admin, …)
- **Health**: `GET /health`
- **Admin auth**: `/api/admin` is guarded by the `x-admin-api-key` header (value = `ADMIN_API_KEY`, enforced only when configured)

## 🤖 MCP endpoint (`/mcp`)

The API embeds a **remote MCP (Model Context Protocol) server** at `POST /mcp`, served by the **existing api container on the already-published port 3001** — no new service, no new port, no Dockerfile/compose change, no Prisma schema change. The `@modelcontextprotocol/sdk` is pure JS, installed host-side and copied into the image (air-gapped safe: no network operations in containers).

| Property | Value |
|----------|-------|
| URL | `http://<host>:3001/mcp` |
| Transport | Streamable HTTP, **stateless** (`sessionIdGenerator: undefined`, `enableJsonResponse: true`) |
| Methods | `POST` only — `GET` and `DELETE` /mcp answer `405` + `Allow: POST` |
| Auth | `Authorization: Bearer <MCP_API_KEY>` — **fails closed**: unset/empty `MCP_API_KEY` ⇒ every request answered `401` (`WWW-Authenticate: Bearer`), the endpoint stays disabled |
| Body limit | 1 MB JSON-RPC; malformed JSON ⇒ JSON-RPC `-32700` / `-32600` (400); handler failures ⇒ `-32603` (500), never a stack trace |
| Middleware order | express-rate-limit → `mcpAuth` → transport (mounted by a single `app.use(createMcpRouter())` after the global rate limit) |

Environment variables (see `.env.example`):

| Variable | Default | Role |
|----------|---------|------|
| `MCP_API_KEY` | *(empty)* | **Required to activate `/mcp`** — bearer token checked with a constant-time comparison; unset/empty ⇒ fail-closed 401 |
| `MCP_ENABLE_SSE` | `0` | Opt-in legacy SSE fallback (`GET /sse` + `POST /messages?sessionId=…`, same bearer auth) — disabled by default, both routes answer 404 while off |
| `ADMIN_API_KEY` | *(empty)* | Admin MCP tools are registered only when set; every admin call forwards it verbatim as the `x-admin-api-key` header |

### Connection snippets

**Tidet — `mcp_server_add` (HTTP):**

```
mcp_server_add cloudmarket --type http --url http://localhost:3001/mcp \
  --header "Authorization: Bearer <MCP_API_KEY>"
```

**Claude Desktop — `.mcp.json`:**

```json
{
  "mcpServers": {
    "cloudmarket": {
      "type": "http",
      "url": "http://localhost:3001/mcp",
      "headers": {
        "Authorization": "Bearer <MCP_API_KEY>"
      }
    }
  }
}
```

**curl — JSON-RPC initialize:**

```bash
curl -s -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MCP_API_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"1.0.0"}}}'
# → {"jsonrpc":"2.0","id":1,"result":{"serverInfo":{"name":"cloudmarket-api",...}}}
```

**curl — JSON-RPC tools/call (example):**

```bash
curl -s -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MCP_API_KEY" -H "x-admin-api-key: $ADMIN_API_KEY" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"admin_list_products","arguments":{}}}'
```

### Admin tools & `x-admin-api-key`

Admin MCP tools (`admin_*`) call `/api/admin`, which requires the `x-admin-api-key` header (value = `ADMIN_API_KEY` from the API environment). **The client must also send `x-admin-api-key`** — the MCP admin tools are registered only when `ADMIN_API_KEY` is configured, and the key is forwarded verbatim to `/api/admin`. A wrong or missing key yields a readable `Unauthorized (401)` tool result; without `ADMIN_API_KEY` the admin tools are absent from `tools/list` entirely.

> **No Docker/port change is needed**: `/mcp` is served by the existing api container on port 3001; `make run` / `make deploy` are unchanged. Rebuild the api image (`docker compose build api`) only to pick up the new module/SDK, as for any code change.

### Local stdio entrypoint (optional)

The same tool registry also runs over stdio for local use:

```bash
npm run mcp:stdio -w apps/api   # node dist/mcp/stdio.js (after npm run build -w apps/api)
```

## 🧪 Tests

```bash
npm run test -w apps/api
```

MCP-related suites: `mcp-auth.test.ts` (fail-closed bearer auth), `mcp-http-transport.test.ts` (stateless HTTP sequence initialize → tools/list → tools/call), `mcp-tools-write.test.ts` (write/admin tools, header propagation), `mcp-api-client.test.ts` (REST error translation).

## 📄 License

MIT — Educational / demonstration project.
