/**
 * Streamable HTTP transport for the CloudMarket MCP server.
 *
 * createMcpRouter() returns a self-contained Express router that serves the
 * MCP endpoint at POST /mcp on the already-published API port (3001) — no new
 * service, no new port, no Docker/compose change.
 *
 * Mounting (integration task, single line after the global rate-limit):
 *
 *   app.use(createMcpRouter());   // routes are absolute: POST/GET/DELETE /mcp
 *
 * Behaviour:
 * - POST /mcp: every request is handled by a fresh
 *   StreamableHTTPServerTransport in STATELESS mode (sessionIdGenerator:
 *   undefined) wired to a fresh McpServer built from the shared tool
 *   registry (./server). No session state, no GET stream; responses are
 *   single JSON documents (enableJsonResponse).
 * - GET /mcp and DELETE /mcp: 405 Method Not Allowed (the server never
 *   opens server-initiated SSE streams).
 * - mcpAuth (./auth) is applied inside the router, so the endpoint always
 *   requires Authorization: Bearer <MCP_API_KEY> and fails closed when the
 *   variable is unset. The router is designed to be mounted after the
 *   global express-rate-limit middleware: requests hit the rate limit
 *   first, then mcpAuth, then the MCP transport.
 */
import express, { NextFunction, Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { buildMcpServer } from './server';
import { mcpAuth } from './auth';
import { isSseTransportEnabled, openSseSession } from './sse';

/** Absolute path of the MCP endpoint on the API. */
export const MCP_ENDPOINT_PATH = '/mcp';

/** JSON-RPC error codes used in the transport's own error responses. */
const JSON_RPC_PARSE_ERROR = -32700;
const JSON_RPC_INVALID_REQUEST = -32600;
const JSON_RPC_INTERNAL_ERROR = -32603;

/** Max size of a JSON-RPC request body (matches typical express.json limits). */
const MCP_MAX_BODY_BYTES = '1mb';

interface JsonRpcRequest {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
}

function isJsonRpcRequestLike(body: unknown): body is JsonRpcRequest {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as JsonRpcRequest).method === 'string'
  );
}

function sendJsonRpcError(res: Response, status: number, code: number, message: string): void {
  res.status(status).json({
    jsonrpc: '2.0',
    id: null,
    error: { code, message },
  });
}

/**
 * Build the MCP HTTP router.
 *
 * The router is self-contained: it applies mcpAuth itself, parses the JSON
 * body of POST requests and dispatches them through the stateless Streamable
 * HTTP transport. Mount it after the global rate-limit middleware with
 * `app.use(createMcpRouter())` — nothing else is needed.
 */
export function createMcpRouter(): express.Router {
  const router = express.Router();

  // Bearer-token gate (fail closed) — see ./auth.
  //
  // IMPORTANT: mcpAuth is attached PER ROUTE, not via router.use(). The
  // integration mounts this router bare (app.use(createMcpRouter())) so it
  // can carry absolute paths (/mcp); a router.use(mcpAuth) here would then
  // run on EVERY request of the app (/health, /api/*...) and reject them
  // all with 401.
  //
  // The Streamable HTTP transport expects the JSON body to be pre-parsed
  // (it is then passed as `parsedBody` to handleRequest).
  router.post(
    MCP_ENDPOINT_PATH,
    mcpAuth,
    express.json({ limit: MCP_MAX_BODY_BYTES }),
    (req: Request, res: Response, next: NextFunction) => {
      const body: unknown = req.body;

      // Basic JSON-RPC shape check: the SDK's handleRequest() is strict and
      // validates the full envelope itself; this only catches obviously
      // non-object bodies early (e.g. a JSON array or scalar).
      if (!isJsonRpcRequestLike(body)) {
        sendJsonRpcError(
          res,
          400,
          JSON_RPC_INVALID_REQUEST,
          'Invalid request: body must be a JSON-RPC 2.0 request object with a "method" string',
        );
        return;
      }

      handleStatelessPost(req, res, body).catch((error: unknown) => {
        // Headers may already be sent by the transport; guard against that.
        if (res.headersSent) {
          next(error);
          return;
        }
        sendJsonRpcError(
          res,
          500,
          JSON_RPC_INTERNAL_ERROR,
          'Internal error while processing the MCP request',
        );
      });
    },
  );

  // Stateless server: no GET (SSE) stream by default, no session termination.
  //
  // GET /mcp CO-LOCATION (opencode 1.x compatibility): when the legacy SSE
  // transport is enabled (MCP_ENABLE_SSE=1) AND the client explicitly asks
  // for an event stream, GET /mcp opens a legacy SSE session instead of
  // answering 405. opencode 1.x's transport inference only tries SSE on the
  // exact configured URL, so url=.../mcp works for BOTH generations:
  // opencode 2.x / SDK clients use POST (Streamable HTTP, untouched), 1.x
  // clients open the SSE stream on the same path. Without
  // "text/event-stream" in the Accept header (browser, plain curl), the
  // answer stays the plain 405.
  router.get(MCP_ENDPOINT_PATH, mcpAuth, (req: Request, res: Response) => {
    const wantsEventStream = String(req.headers.accept ?? '').includes(
      'text/event-stream',
    );
    if (isSseTransportEnabled() && wantsEventStream) {
      openSseSession(res);
      return;
    }
    res.status(405).set('Allow', 'POST').json({
      error: 'Method Not Allowed: the CloudMarket MCP endpoint is stateless and only accepts POST /mcp',
    });
  });
  const methodNotAllowed = (req: Request, res: Response, next: NextFunction) => {
    mcpAuth(req, res, (error?: unknown) => {
      if (error || res.headersSent) {
        next(error as Error | undefined);
        return;
      }
      res.status(405).set('Allow', 'POST').json({
        error: 'Method Not Allowed: the CloudMarket MCP endpoint is stateless and only accepts POST /mcp',
      });
    });
  };
  router.delete(MCP_ENDPOINT_PATH, methodNotAllowed);

  // Body-parser failures become JSON-RPC parse errors (no stack traces).
  router.use(
    (
      error: unknown,
      _req: Request,
      res: Response,
      next: NextFunction,
    ): void => {
      const isBodyParserError =
        typeof error === 'object' &&
        error !== null &&
        (error as { type?: string }).type === 'entity.parse.failed';
      if (!isBodyParserError) {
        next(error);
        return;
      }
      sendJsonRpcError(res, 400, JSON_RPC_PARSE_ERROR, 'Parse error: request body is not valid JSON');
    },
  );

  return router;
}

/**
 * Handle one POST /mcp JSON-RPC message with a dedicated server + transport
 * pair (stateless mode). A JSON-RPC notification (no id) gets 202 Accepted
 * and no response body; a request gets a single JSON response document.
 */
async function handleStatelessPost(req: Request, res: Response, parsedBody: unknown): Promise<void> {
  const server = buildMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless: no session id, no resumption
    enableJsonResponse: true, // single JSON document, never an open SSE stream
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, parsedBody);
  } finally {
    // The response has been written; dispose of the per-request pair.
    const jsonRpcId = isJsonRpcRequestLike(parsedBody) ? parsedBody.id : undefined;
    if (jsonRpcId === undefined) {
      // Notification (or unparseable request): no JSON body was sent — send
      // an empty 202 acknowledgement like the stateless transport does.
      if (!res.headersSent) {
        res.status(202).end();
      }
    }
    await transport.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
}


