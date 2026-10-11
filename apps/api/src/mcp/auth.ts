/**
 * OPTIONAL bearer authentication for the CloudMarket MCP HTTP endpoint.
 *
 * mcpAuth is an Express middleware:
 * - when MCP_API_KEY IS configured → `Authorization: Bearer <MCP_API_KEY>`
 *   is required on every request (constant-time comparison).
 * - when MCP_API_KEY is unset or empty → requests pass through WITHOUT a
 *   token (auth disabled — explicit user choice: no auth for now, keep the
 *   implementation, make it optional). The key is read from the environment
 *   at request time so configuration changes (and tests) take effect
 *   without a module reload.
 */
import { createHash, timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

/** Name of the environment variable holding the shared MCP bearer token. */
export const MCP_API_KEY_ENV_VAR = 'MCP_API_KEY';

/** WWW-Authenticate challenge returned with every 401 response. */
const WWW_AUTHENTICATE = 'Bearer realm="cloudmarket-mcp"';

/**
 * Constant-time string comparison. Both sides are hashed to a fixed 32-byte
 * digest first so neither the contents nor the length of the secret can be
 * probed through timing or error behaviour.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const digestA = createHash('sha256').update(a, 'utf8').digest();
  const digestB = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(digestA, digestB);
}

function deny(res: Response, message: string): void {
  res.status(401).set('WWW-Authenticate', WWW_AUTHENTICATE).json({ error: message });
}

/**
 * Express middleware protecting the MCP HTTP endpoint.
 *
 * Runs before any MCP transport handling (it is applied inside
 * createMcpRouter(), which the integration task mounts after the global
 * rate-limit middleware). Rejections are plain 401 JSON responses carrying a
 * WWW-Authenticate: Bearer challenge; the configured key itself is never
 * echoed back.
 */
export function mcpAuth(req: Request, res: Response, next: NextFunction): void {
  const expectedKey = process.env[MCP_API_KEY_ENV_VAR];

  // Auth disabled: without a configured key requests pass through without
  // a token (the Bearer mechanism is kept for when a key is set).
  if (typeof expectedKey !== 'string' || expectedKey.trim().length === 0) {
    next();
    return;
  }

  const header = req.headers.authorization;
  if (typeof header !== 'string' || header.trim().length === 0) {
    deny(res, 'Missing Authorization header: expected "Authorization: Bearer <MCP_API_KEY>"');
    return;
  }

  // The scheme is case-insensitive per RFC 7235; the token itself is not.
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) {
    deny(res, 'Invalid Authorization scheme: expected "Authorization: Bearer <MCP_API_KEY>"');
    return;
  }

  if (!constantTimeEquals(match[1].trim(), expectedKey)) {
    deny(res, 'Invalid bearer token');
    return;
  }

  next();
}
