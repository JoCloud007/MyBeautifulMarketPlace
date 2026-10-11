/**
 * Internal API client for the CloudMarket MCP server.
 *
 * Every MCP tool talks to the existing REST API over loopback
 * (http://127.0.0.1:3001) so the model sees exactly what a REST client
 * sees — same routes, same validation, same error semantics.
 *
 * HTTP statuses and ZodError-shaped payloads are translated into short,
 * readable messages. Stack traces are never surfaced to the model.
 */
import { z } from 'zod';

/** Base URL of the already-published REST API (no new port, no new service). */
export const API_BASE_URL = 'http://127.0.0.1:3001';

/** Header name used by the existing admin auth middleware. */
export const ADMIN_API_KEY_HEADER = 'x-admin-api-key';

export type ApiCallResult =
  | { ok: true; status: number; data: unknown }
  | { ok: false; status?: number; error: string };

export interface ApiRequestOptions {
  /** JSON-serializable request body (sent as application/json). */
  body?: unknown;
  /** Query parameters; undefined/null values are skipped. */
  query?: Record<string, string | number | boolean | undefined | null>;
  /**
   * Send the x-admin-api-key header (from the ADMIN_API_KEY environment
   * variable) for routes guarded by the admin middleware.
   */
  admin?: boolean;
}

/** Shape of the API's ZodError response payload (see global error handler). */
const zodErrorPayloadSchema = z.object({
  error: z.literal('Validation Error'),
  details: z.array(
    z.object({
      path: z.string(),
      message: z.string(),
    }),
  ),
});

function extractPayloadMessage(payload: unknown): string | undefined {
  if (payload === null || payload === undefined) return undefined;
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    for (const key of ['message', 'error']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
  }
  return undefined;
}

/**
 * Translate an HTTP error status + response payload into a readable,
 * single-line message. Never includes stack traces.
 */
export function translateHttpError(
  status: number,
  payload: unknown,
  method: string,
  path: string,
): string {
  const payloadMessage = extractPayloadMessage(payload);

  // ZodError response payloads: { error: 'Validation Error', details: [...] }
  const zodPayload = zodErrorPayloadSchema.safeParse(payload);
  if (zodPayload.success) {
    const details = zodPayload.data.details
      .map((detail) =>
        detail.path.length > 0 ? `${detail.path}: ${detail.message}` : detail.message,
      )
      .join('; ');
    return `Validation failed (${status}) for ${method} ${path}: ${details}`;
  }

  switch (status) {
    case 400:
      return `Bad request (400) for ${method} ${path}${payloadMessage ? `: ${payloadMessage}` : ''}`;
    case 401:
      return `Unauthorized (401) for ${method} ${path}: the API rejected the credentials. Set ADMIN_API_KEY to match the server configuration and send it in the '${ADMIN_API_KEY_HEADER}' header.`;
    case 403:
      return `Forbidden (403) for ${method} ${path}${payloadMessage ? `: ${payloadMessage}` : ''}`;
    case 404:
      return `Not found (404): ${method} ${path} does not exist on the CloudMarket API${payloadMessage ? ` (${payloadMessage})` : ''}`;
    case 409:
      return `Conflict (409) for ${method} ${path}: ${payloadMessage ?? 'the request conflicts with existing data'}`;
    case 429:
      return `Too many requests (429) for ${method} ${path}: the API rate limit was hit, retry later`;
    case 500:
      return `Internal server error (500) for ${method} ${path}${payloadMessage ? `: ${payloadMessage}` : ''}`;
    default:
      return `CloudMarket API error ${status} for ${method} ${path}${payloadMessage ? `: ${payloadMessage}` : ''}`;
  }
}

function buildUrl(path: string, query?: ApiRequestOptions['query']): string {
  let pathname = path.startsWith('/') ? path : `/${path}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      params.set(key, String(value));
    }
    const queryString = params.toString();
    if (queryString.length > 0) {
      pathname += (pathname.includes('?') ? '&' : '?') + queryString;
    }
  }
  return `${API_BASE_URL}${pathname}`;
}

/**
 * Perform one internal HTTP call against the REST API.
 * Resolves with a discriminated result instead of throwing, so tool
 * handlers can turn failures into readable tool results.
 */
export async function apiRequest(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiCallResult> {
  const url = buildUrl(path, options.query);
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.admin) {
    const adminKey = process.env.ADMIN_API_KEY;
    if (adminKey) {
      headers[ADMIN_API_KEY_HEADER] = adminKey;
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (cause) {
    // Network-level failure (API down, DNS, socket reset...). Message only,
    // never the stack trace.
    const reason =
      cause instanceof Error && cause.message ? cause.message : String(cause);
    return {
      ok: false,
      error: `Cannot reach the CloudMarket API at ${API_BASE_URL} (${method} ${path}): ${reason}`,
    };
  }

  const rawBody = await response.text();
  let payload: unknown = rawBody;
  if (rawBody.length > 0) {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      // Keep the raw text — some endpoints may return plain text.
    }
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: translateHttpError(response.status, payload, method, path),
    };
  }

  return { ok: true, status: response.status, data: payload };
}

/** Convert an ApiCallResult into an MCP tool result (CallToolResult shape). */
export function toToolResult(result: ApiCallResult): {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
} {
  if (result.ok) {
    return {
      content: [
        {
          type: 'text',
          text:
            result.data === undefined || result.data === null
              ? '(empty response)'
              : JSON.stringify(result.data, null, 2),
        },
      ],
    };
  }
  return {
    content: [{ type: 'text', text: result.error }],
    isError: true,
  };
}

/** GET helper returning a tool result directly. */
export function apiGet(path: string, query?: ApiRequestOptions['query']) {
  return apiRequest('GET', path, { query });
}

/** POST helper (JSON body). */
export function apiPost(path: string, body?: unknown, options: Omit<ApiRequestOptions, 'body'> = {}) {
  return apiRequest('POST', path, { ...options, body });
}

/** PATCH helper (JSON body). */
export function apiPatch(path: string, body?: unknown, options: Omit<ApiRequestOptions, 'body'> = {}) {
  return apiRequest('PATCH', path, { ...options, body });
}

/** PUT helper (JSON body). */
export function apiPut(path: string, body?: unknown, options: Omit<ApiRequestOptions, 'body'> = {}) {
  return apiRequest('PUT', path, { ...options, body });
}

/** DELETE helper. */
export function apiDelete(path: string, options: Omit<ApiRequestOptions, 'body'> = {}) {
  return apiRequest('DELETE', path, options);
}
