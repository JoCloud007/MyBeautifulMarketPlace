/**
 * Legacy SSE transport for the CloudMarket MCP server (opt-in fallback).
 *
 * createSseRouter() returns a self-contained Express router serving the
 * legacy "HTTP + SSE" MCP transport on the already-published API port:
 *
 *   GET  /sse                      -> opens one SSE stream = one MCP session
 *   POST /messages?sessionId=...   -> client-to-server JSON-RPC messages
 *
 * The transport is DISABLED BY DEFAULT: it only becomes active when the
 * MCP_ENABLE_SSE environment variable is exactly "1" (checked at request
 * time, so tests and config changes take effect without a module reload).
 * When disabled, both routes answer 404 — the endpoint does not exist —
 * and no SSE session can be created. The rest of the API is untouched.
 *
 * mcpAuth (./auth) is enforced on BOTH routes when the transport is active:
 * every request must carry `Authorization: Bearer <MCP_API_KEY>` (fail
 * closed when MCP_API_KEY is unset). Ordering is gate (404 when disabled)
 * -> mcpAuth (401 when unauthorized) -> transport handling, applied
 * per-route so mounting the router never intercepts other API traffic.
 *
 * Mounting (integration task, single line after the global rate-limit):
 *
 *   app.use(createSseRouter());   // routes are absolute: GET /sse, POST /messages
 *
 * Each GET /sse connection gets a fresh McpServer built from the shared
 * tool registry (./server buildMcpServer()), so the tool list is identical
 * to the Streamable HTTP transport (./http) and the stdio entry (./stdio).
 * The session pair (server + SSEServerTransport) is closed and removed
 * when the SSE stream closes. No new port, no new service, no Docker
 * change; tool calls reach the REST API on 127.0.0.1:3001 via ./api-client.
 */
import express, { NextFunction, Request, Response } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { buildMcpServer } from './server';
import { mcpAuth } from './auth';

/** Name of the environment variable gating the legacy SSE transport. */
export const MCP_ENABLE_SSE_ENV_VAR = 'MCP_ENABLE_SSE';

/** Absolute path that opens an SSE stream (one MCP session per stream). */
export const SSE_ENDPOINT_PATH = '/sse';

/** Absolute path receiving client-to-server messages for an open session. */
export const SSE_MESSAGES_PATH = '/messages';

/**
 * Whether the legacy SSE transport is currently enabled.
 * Enabled only when MCP_ENABLE_SSE is exactly "1" — off by default.
 */
export function isSseTransportEnabled(): boolean {
  return process.env[MCP_ENABLE_SSE_ENV_VAR] === '1';
}

/** One live SSE session: a dedicated server + transport pair. */
interface SseSession {
  transport: SSEServerTransport;
  server: ReturnType<typeof buildMcpServer>;
}

/** Live SSE sessions, keyed by the transport-generated sessionId. */
const sessions = new Map<string, SseSession>();

/** 404 answer used whenever the transport is disabled (it does not exist). */
function respondSseDisabled(res: Response): void {
  res.status(404).json({
    error:
      'Not Found: the legacy SSE MCP transport is disabled (set MCP_ENABLE_SSE=1 to enable it)',
  });
}

/**
 * Open one legacy SSE session on ANY response object (the stream is the
 * session). Used by GET /sse (legacy endpoint) and, when
 * MCP_ENABLE_SSE=1, by GET /mcp as a co-located fallback so opencode 1.x
 * clients — whose transport inference only tries SSE first on the exact
 * configured URL — can connect with url=.../mcp just like their other
 * servers. The announced message URL is always /messages (already proxied).
 */
export function openSseSession(res: Response): void {
  const server = buildMcpServer();
  const transport = new SSEServerTransport(SSE_MESSAGES_PATH, res);
  sessions.set(transport.sessionId, { transport, server });

  // Cleanup when the SSE stream closes (client disconnect or shutdown).
  res.on('close', () => {
    if (sessions.get(transport.sessionId)?.transport === transport) {
      sessions.delete(transport.sessionId);
    }
    void transport.close().catch(() => undefined);
    void server.close().catch(() => undefined);
  });

  server.connect(transport).catch((error: unknown) => {
    // Message only — never a stack trace on the wire or in the logs.
    const message =
      error instanceof Error && error.message ? error.message : String(error);
    console.error(`CloudMarket MCP SSE session failed to start: ${message}`);
    sessions.delete(transport.sessionId);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to start the MCP SSE session' });
    } else {
      res.destroy();
    }
  });
}

/**
 * Route one client-to-server message to its open SSE session. Resolves
 * once the transport has handled the POST (or answers 404 itself when the
 * session is unknown/closed).
 */
export function handleSseMessage(
  req: Request,
  res: Response,
  next: NextFunction,
  sessionId: string | undefined,
): void {
  const session = sessionId ? sessions.get(sessionId) : undefined;

  if (!session) {
    res.status(404).json({
      error:
        'Unknown or closed SSE session: open GET /sse first and POST to the /messages?sessionId=... URL it announces',
    });
    return;
  }

  session.transport.handlePostMessage(req, res, req.body).catch(next);
}

/**
 * Build the legacy SSE MCP router.
 *
 * The router is self-contained and safe to mount unconditionally next to
 * createMcpRouter(): when MCP_ENABLE_SSE is not "1" it only answers 404 on
 * /sse and /messages and leaves every other route untouched. No catch-all
 * middleware is registered, so mounting it can never shadow the REST API.
 */
export function createSseRouter(): express.Router {
  const router = express.Router();

  // Per-route gate: 404 unless MCP_ENABLE_SSE=1 (checked at request time).
  const sseGate = (_req: Request, res: Response, next: NextFunction): void => {
    if (!isSseTransportEnabled()) {
      respondSseDisabled(res);
      return;
    }
    next();
  };

  // GET /sse — open one SSE stream and bind a fresh MCP server to it.
  router.get(SSE_ENDPOINT_PATH, sseGate, mcpAuth, (req: Request, res: Response) => {
    openSseSession(res);
  });

  // POST /messages?sessionId=... — messages for one open SSE session.
  // The JSON body is pre-parsed and handed to the transport (same pattern
  // as the Streamable HTTP router), so the request stream is never read
  // twice.
  router.post(
    SSE_MESSAGES_PATH,
    sseGate,
    mcpAuth,
    express.json({ limit: '1mb' }),
    (req: Request, res: Response, next: NextFunction): void => {
      const rawSessionId = req.query.sessionId;
      const sessionId = typeof rawSessionId === 'string' ? rawSessionId : undefined;
      handleSseMessage(req, res, next, sessionId);
    },
  );

  return router;
}
