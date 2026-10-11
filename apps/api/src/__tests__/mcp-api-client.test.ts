/**
 * Tests for the MCP internal API client (apps/api/src/mcp/api-client.ts):
 * base URL targeting, error translation (401/404/409, ZodError payloads)
 * and the absence of stack traces in tool-result messages.
 */
import {
  API_BASE_URL,
  ADMIN_API_KEY_HEADER,
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiRequest,
  toToolResult,
  translateHttpError,
} from '../mcp/api-client';

const fetchMock = jest.fn() as jest.Mock;

/** Minimal Response stand-in — api-client only uses ok/status/text(). */
function jsonResponse(status: number, body: unknown): unknown {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

beforeAll(() => {
  (global as unknown as Record<string, unknown>).fetch = fetchMock;
});

beforeEach(() => {
  fetchMock.mockReset();
  delete process.env.ADMIN_API_KEY;
});

afterEach(() => {
  delete process.env.ADMIN_API_KEY;
});

describe('apiRequest() targeting', () => {
  it('targets the existing REST API on 127.0.0.1:3001', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    const result = await apiRequest('GET', '/api/products');

    expect(API_BASE_URL).toBe('http://127.0.0.1:3001');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/products',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result).toEqual({ ok: true, status: 200, data: { ok: true } });
  });

  it('serializes query parameters and skips empty values', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, []));

    await apiGet('/api/products', { search: 'gpu', status: undefined, limit: 5 });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe('http://127.0.0.1:3001/api/products?search=gpu&limit=5');
  });

  it('sends the x-admin-api-key header when requested and configured', async () => {
    process.env.ADMIN_API_KEY = 'secret-key';
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

    // The admin header is opt-in ({admin: true}) — the same way admin.ts
    // calls apiRequest for every /api/admin route.
    await apiRequest('GET', '/api/admin/dashboard', { admin: true });

    const init = fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers[ADMIN_API_KEY_HEADER]).toBe('secret-key');
  });

  it('sends JSON bodies for POST, PATCH and DELETE helpers', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(201, { id: '1' }))
      .mockResolvedValueOnce(jsonResponse(200, { id: '1' }))
      .mockResolvedValueOnce(jsonResponse(200, {}));

    await apiPost('/api/instances', { name: 'vm1' });
    await apiPatch('/api/instances/1', { status: 'RUNNING' });
    await apiDelete('/api/instances/1');

    expect((fetchMock.mock.calls[0][1] as { body: string }).body).toBe(
      JSON.stringify({ name: 'vm1' }),
    );
    expect((fetchMock.mock.calls[1][1] as { body: string }).body).toBe(
      JSON.stringify({ status: 'RUNNING' }),
    );
    expect((fetchMock.mock.calls[2][1] as { method: string }).method).toBe('DELETE');
  });
});

describe('HTTP error translation', () => {
  it('translates 401 into a credential hint without a stack trace', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: 'Unauthorized' }));

    const result = await apiRequest('GET', '/api/admin/dashboard');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toContain('Unauthorized (401)');
      expect(result.error).toContain('ADMIN_API_KEY');
      expect(result.error).not.toMatch(/(^|\n)\s+at\s+\S+:\d+/); // no stack frames
    }
  });

  it('translates 404 into a not-found message naming the route', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { error: 'Not Found' }));

    const result = await apiGet('/api/products/11111111-1111-1111-1111-111111111111');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Not found (404)');
      expect(result.error).toContain('/api/products/11111111-1111-1111-1111-111111111111');
      expect(result.error).not.toMatch(/(^|\n)\s+at\s+\S+:\d+/); // no stack frames
    }
  });

  it('translates 409 with the payload conflict message', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, { error: 'Conflict', message: 'A record with this name already exists' }),
    );

    const result = await apiPost('/api/categories', { name: 'dup' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Conflict (409)');
      expect(result.error).toContain('A record with this name already exists');
    }
  });

  it('renders ZodError payloads ({error: Validation Error, details}) as one readable line', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, {
        error: 'Validation Error',
        details: [
          { path: 'name', message: 'Name is required' },
          { path: 'categoryId', message: 'Invalid category ID' },
        ],
      }),
    );

    const result = await apiPost('/api/products', {});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(
        'Validation failed (400) for POST /api/products: name: Name is required; categoryId: Invalid category ID',
      );
      expect(result.error).not.toContain('ZodError');
      expect(result.error).not.toMatch(/(^|\n)\s+at\s+\S+:\d+/); // no stack frames
    }
  });

  it('keeps network failures readable and stack-free', async () => {
    fetchMock.mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:3001'));

    const result = await apiRequest('GET', '/api/products');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Cannot reach the CloudMarket API at http://127.0.0.1:3001');
      expect(result.error).toContain('ECONNREFUSED');
      expect(result.error).not.toMatch(/(^|\n)\s+at\s+\S+:\d+/); // no stack frames
      expect(result.error).not.toContain('\n');
    }
  });

  it('translateHttpError covers 401/404/409 explicitly', () => {
    expect(translateHttpError(401, null, 'GET', '/api/admin/users')).toContain('(401)');
    expect(translateHttpError(404, null, 'GET', '/api/nope')).toContain('(404)');
    expect(translateHttpError(409, null, 'POST', '/api/zones')).toContain('(409)');
    expect(translateHttpError(500, null, 'GET', '/api/products')).toContain('(500)');
  });
});

describe('toToolResult()', () => {
  it('maps successful API data into text content', () => {
    const toolResult = toToolResult({ ok: true, status: 200, data: { hello: 'world' } });
    expect(toolResult.isError).toBeUndefined();
    expect(toolResult.content[0].text).toBe('{\n  "hello": "world"\n}');
  });

  it('maps failures into isError results carrying the readable message', () => {
    const toolResult = toToolResult({
      ok: false,
      status: 409,
      error: 'Conflict (409) for POST /api/zones: duplicate code',
    });
    expect(toolResult.isError).toBe(true);
    expect(toolResult.content[0].text).toContain('Conflict (409)');
  });
});
