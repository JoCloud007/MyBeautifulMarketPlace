const API_URL = process.env.API_URL || 'http://localhost:3001';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function api(method: string, path: string, body?: any) {
  const url = `${API_URL}${path}`;
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  const res = await fetch(url, init);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  return { status: res.status, data, headers: res.headers };
}

const get = (path: string) => api('GET', path);
const post = (path: string, body: any) => api('POST', path, body);
const patch = (path: string, body: any) => api('PATCH', path, body);
const del = (path: string) => api('DELETE', path);

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('🩺 Health Monitoring', () => {
  // IDs of health-check records created during tests — cleaned up in afterAll
  const cleanupIds: string[] = [];

  // Re-use a seeded instance for all health-check tests
  let instanceId: string;
  let secondInstanceId: string;

  beforeAll(async () => {
    const { status, data } = await get('/api/instances');
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(2);
    instanceId = data[0].id;
    secondInstanceId = data[1].id;
  });

  afterAll(async () => {
    for (const id of cleanupIds) {
      try {
        await del(`/api/health-checks/${id}`);
      } catch {
        /* ignore cleanup errors */
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Stats & Empty-State
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1️⃣ Health Check Stats', () => {
    test('GET /api/health-checks/stats returns zeroes when no checks exist', async () => {
      // Ensure we start from a clean state for stats assertions
      const { status, data } = await get('/api/health-checks/stats');
      expect(status).toBe(200);
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('healthy');
      expect(data).toHaveProperty('degraded');
      expect(data).toHaveProperty('unhealthy');
      expect(typeof data.total).toBe('number');
      expect(data.total).toBe(data.healthy + data.degraded + data.unhealthy);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Create (POST)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('2️⃣ POST /api/health-checks', () => {
    test('creates a health check with default values', async () => {
      const { status, data } = await post('/api/health-checks', {
        instanceId,
      });
      expect(status).toBe(201);
      expect(data.id).toBeDefined();
      expect(data.instanceId).toBe(instanceId);
      expect(data.status).toBe('HEALTHY');
      expect(data.cpuPercent).toBe(0);
      expect(data.memoryPercent).toBe(0);
      expect(data.diskPercent).toBe(0);
      expect(data.responseTimeMs).toBe(0);
      expect(data.checkedAt).toBeDefined();
      expect(data.instance).toBeDefined();
      expect(data.instance.application).toBeDefined();
      cleanupIds.push(data.id);
    });

    test('creates a health check with explicit values', async () => {
      const { status, data } = await post('/api/health-checks', {
        instanceId,
        status: 'DEGRADED',
        cpuPercent: 75.5,
        memoryPercent: 82.0,
        diskPercent: 45.0,
        responseTimeMs: 340,
      });
      expect(status).toBe(201);
      expect(data.status).toBe('DEGRADED');
      expect(data.cpuPercent).toBe(75.5);
      expect(data.memoryPercent).toBe(82.0);
      expect(data.diskPercent).toBe(45.0);
      expect(data.responseTimeMs).toBe(340);
      cleanupIds.push(data.id);
    });

    test('creates a health check with custom checkedAt', async () => {
      const checkedAt = '2024-06-15T10:30:00.000Z';
      const { status, data } = await post('/api/health-checks', {
        instanceId,
        status: 'UNHEALTHY',
        cpuPercent: 95.0,
        checkedAt,
      });
      expect(status).toBe(201);
      expect(data.status).toBe('UNHEALTHY');
      expect(new Date(data.checkedAt).toISOString()).toBe(checkedAt);
      cleanupIds.push(data.id);
    });

    test('returns 404 for non-existent instanceId', async () => {
      const { status, data } = await post('/api/health-checks', {
        instanceId: '00000000-0000-0000-0000-000000000000',
        status: 'HEALTHY',
      });
      expect(status).toBe(404);
      expect(data.error).toMatch(/Instance not found/i);
    });

    test('returns 400 for invalid status enum value', async () => {
      const { status, data } = await post('/api/health-checks', {
        instanceId,
        status: 'CRITICAL',
      });
      expect(status).toBe(400);
      expect(data.error).toBe('Validation Error');
    });

    test('returns 400 for cpuPercent > 100', async () => {
      const { status, data } = await post('/api/health-checks', {
        instanceId,
        cpuPercent: 101,
      });
      expect(status).toBe(400);
      expect(data.error).toBe('Validation Error');
    });

    test('returns 400 for negative memoryPercent', async () => {
      const { status, data } = await post('/api/health-checks', {
        instanceId,
        memoryPercent: -1,
      });
      expect(status).toBe(400);
      expect(data.error).toBe('Validation Error');
    });

    test('returns 400 for invalid instanceId format', async () => {
      const { status, data } = await post('/api/health-checks', {
        instanceId: 'not-a-uuid',
      });
      expect(status).toBe(400);
      expect(data.error).toBe('Validation Error');
    });

    test('returns 400 when instanceId is missing', async () => {
      const { status, data } = await post('/api/health-checks', {
        status: 'HEALTHY',
      });
      expect(status).toBe(400);
      expect(data.error).toBe('Validation Error');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Read (GET list + single)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('3️⃣ GET /api/health-checks', () => {
    beforeAll(async () => {
      // Seed a few checks for list/filter tests
      const checks = [
        { instanceId, status: 'HEALTHY', cpuPercent: 10 },
        { instanceId, status: 'HEALTHY', cpuPercent: 20 },
        { instanceId, status: 'DEGRADED', cpuPercent: 65 },
        { instanceId: secondInstanceId, status: 'UNHEALTHY', cpuPercent: 99 },
      ];
      for (const c of checks) {
        const { data } = await post('/api/health-checks', c);
        cleanupIds.push(data.id);
      }
    });

    test('returns all health checks ordered by checkedAt desc', async () => {
      const { status, data } = await get('/api/health-checks');
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(4);
      // Each check should include nested instance data
      for (const check of data) {
        expect(check.instance).toBeDefined();
        expect(check.instance.application).toBeDefined();
        expect(check.instance.product).toBeDefined();
      }
      // Verify descending order
      for (let i = 1; i < data.length; i++) {
        const prev = new Date(data[i - 1].checkedAt).getTime();
        const curr = new Date(data[i].checkedAt).getTime();
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    });

    test('filters by status query parameter', async () => {
      const { status, data } = await get('/api/health-checks?status=HEALTHY');
      expect(status).toBe(200);
      expect(data.length).toBeGreaterThanOrEqual(2);
      for (const check of data) {
        expect(check.status).toBe('HEALTHY');
      }
    });

    test('filters by instanceId query parameter', async () => {
      const { status, data } = await get(`/api/health-checks?instanceId=${secondInstanceId}`);
      expect(status).toBe(200);
      expect(data.length).toBeGreaterThanOrEqual(1);
      for (const check of data) {
        expect(check.instanceId).toBe(secondInstanceId);
      }
    });

    test('filters by both status and instanceId', async () => {
      const { status, data } = await get(`/api/health-checks?instanceId=${instanceId}&status=DEGRADED`);
      expect(status).toBe(200);
      expect(data.length).toBeGreaterThanOrEqual(1);
      for (const check of data) {
        expect(check.instanceId).toBe(instanceId);
        expect(check.status).toBe('DEGRADED');
      }
    });

    test('returns empty array for non-matching filters', async () => {
      const { status, data } = await get('/api/health-checks?status=UNHEALTHY&instanceId=00000000-0000-0000-0000-000000000000');
      expect(status).toBe(200);
      expect(data).toEqual([]);
    });

    test('GET /api/health-checks/stats reflects created checks', async () => {
      const { status, data } = await get('/api/health-checks/stats');
      expect(status).toBe(200);
      expect(data.total).toBeGreaterThanOrEqual(4);
      expect(data.healthy).toBeGreaterThanOrEqual(2);
      expect(data.degraded).toBeGreaterThanOrEqual(1);
      expect(data.unhealthy).toBeGreaterThanOrEqual(1);
      expect(data.total).toBe(data.healthy + data.degraded + data.unhealthy);
    });

    test('GET /api/health-checks/:id returns a single check', async () => {
      const { data: list } = await get('/api/health-checks');
      const firstId = list[0].id;
      const { status, data } = await get(`/api/health-checks/${firstId}`);
      expect(status).toBe(200);
      expect(data.id).toBe(firstId);
      expect(data.instance).toBeDefined();
    });

    test('GET /api/health-checks/:id returns 404 for unknown id', async () => {
      const { status, data } = await get('/api/health-checks/00000000-0000-0000-0000-000000000000');
      expect(status).toBe(404);
      expect(data.error).toMatch(/Health check not found/i);
    });

    test('GET /api/health-checks/:id returns 400 for invalid uuid', async () => {
      const { status, data } = await get('/api/health-checks/not-a-uuid');
      expect(status).toBe(400);
      expect(data.error).toBe('Validation Error');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Update (PATCH)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('4️⃣ PATCH /api/health-checks/:id', () => {
    let patchTestId: string;

    beforeAll(async () => {
      const { data } = await post('/api/health-checks', {
        instanceId,
        status: 'HEALTHY',
        cpuPercent: 10,
        memoryPercent: 20,
        diskPercent: 30,
        responseTimeMs: 100,
      });
      patchTestId = data.id;
      cleanupIds.push(data.id);
    });

    test('updates status and metrics', async () => {
      const { status, data } = await patch(`/api/health-checks/${patchTestId}`, {
        status: 'UNHEALTHY',
        cpuPercent: 95.5,
        memoryPercent: 88.0,
        diskPercent: 92.0,
        responseTimeMs: 2500,
      });
      expect(status).toBe(200);
      expect(data.status).toBe('UNHEALTHY');
      expect(data.cpuPercent).toBe(95.5);
      expect(data.memoryPercent).toBe(88.0);
      expect(data.diskPercent).toBe(92.0);
      expect(data.responseTimeMs).toBe(2500);
    });

    test('updates checkedAt timestamp', async () => {
      const newCheckedAt = '2024-12-25T00:00:00.000Z';
      const { status, data } = await patch(`/api/health-checks/${patchTestId}`, {
        checkedAt: newCheckedAt,
      });
      expect(status).toBe(200);
      expect(new Date(data.checkedAt).toISOString()).toBe(newCheckedAt);
    });

    test('partial update leaves other fields unchanged', async () => {
      const { data: before } = await get(`/api/health-checks/${patchTestId}`);
      const { status, data } = await patch(`/api/health-checks/${patchTestId}`, {
        cpuPercent: 50,
      });
      expect(status).toBe(200);
      expect(data.cpuPercent).toBe(50);
      expect(data.status).toBe(before.status);
      expect(data.memoryPercent).toBe(before.memoryPercent);
    });

    test('returns 404 for non-existent id', async () => {
      const { status, data } = await patch('/api/health-checks/00000000-0000-0000-0000-000000000000', {
        status: 'HEALTHY',
      });
      expect(status).toBe(404);
      expect(data.error).toMatch(/Not Found|Record not found/i);
    });

    test('returns 400 for invalid status enum', async () => {
      const { status, data } = await patch(`/api/health-checks/${patchTestId}`, {
        status: 'UNKNOWN',
      });
      expect(status).toBe(400);
      expect(data.error).toBe('Validation Error');
    });

    test('returns 400 for cpuPercent > 100', async () => {
      const { status, data } = await patch(`/api/health-checks/${patchTestId}`, {
        cpuPercent: 100.1,
      });
      expect(status).toBe(400);
      expect(data.error).toBe('Validation Error');
    });

    test('returns 400 for negative responseTimeMs', async () => {
      const { status, data } = await patch(`/api/health-checks/${patchTestId}`, {
        responseTimeMs: -1,
      });
      expect(status).toBe(400);
      expect(data.error).toBe('Validation Error');
    });

    test('returns 400 for invalid id format', async () => {
      const { status, data } = await patch('/api/health-checks/bad-id', {
        status: 'HEALTHY',
      });
      expect(status).toBe(400);
      expect(data.error).toBe('Validation Error');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Delete (DELETE)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('5️⃣ DELETE /api/health-checks/:id', () => {
    test('removes a health check', async () => {
      const { data: created } = await post('/api/health-checks', { instanceId });
      const id = created.id;

      const { status: delStatus } = await del(`/api/health-checks/${id}`);
      expect(delStatus).toBe(204);

      const { status: getStatus } = await get(`/api/health-checks/${id}`);
      expect(getStatus).toBe(404);
    });

    test('returns 404 for non-existent id', async () => {
      const { status, data } = await del('/api/health-checks/00000000-0000-0000-0000-000000000000');
      expect(status).toBe(404);
      expect(data.error).toMatch(/Not Found|Record not found/i);
    });

    test('returns 400 for invalid id format', async () => {
      const { status, data } = await del('/api/health-checks/not-uuid');
      expect(status).toBe(400);
      expect(data.error).toBe('Validation Error');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. Frontend Page Smoke Tests
  // ═══════════════════════════════════════════════════════════════════════════
  describe('6️⃣ Frontend Health Page', () => {
    test('GET /health returns ok with ISO timestamp', async () => {
      const { status, data } = await get('/health');
      expect(status).toBe(200);
      expect(data.status).toBe('ok');
      expect(typeof data.timestamp).toBe('string');
      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
    });
  });
});
