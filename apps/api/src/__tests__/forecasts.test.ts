import request from 'supertest';
import express from 'express';
import { forecastRoutes } from '../routes/forecasts';

var prismaMock: any = {};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => {
    return new Proxy(
      {},
      {
        get(_target, prop: string) {
          return prismaMock?.[prop] ?? {};
        },
      }
    );
  }),
  ForecastStatus: {
    DRAFT: 'DRAFT',
    PENDING_TECH: 'PENDING_TECH',
    PENDING_MANAGER: 'PENDING_MANAGER',
    PENDING_BUDGET: 'PENDING_BUDGET',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    CANCELLED: 'CANCELLED',
  },
  ForecastAction: {
    CREATE: 'CREATE',
    UPDATE: 'UPDATE',
    SUBMIT: 'SUBMIT',
    APPROVE: 'APPROVE',
    REJECT: 'REJECT',
    CANCEL: 'CANCEL',
    RESUBMIT: 'RESUBMIT',
  },
  Role: {
    ADMIN: 'ADMIN',
    REQUESTER: 'REQUESTER',
    TECH_LEAD: 'TECH_LEAD',
    MANAGER: 'MANAGER',
    FINANCE: 'FINANCE',
  },
  Prisma: {},
}));

// $transaction runs the callback with the same mock (unit-test simplification)
prismaMock.$transaction = (cb: any) => cb(prismaMock);

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/forecasts', forecastRoutes);
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation Error',
        details: err.errors.map((e: any) => ({ path: e.path.join('.'), message: e.message })),
      });
    }
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
  });
  return app;
}

const F1 = '11111111-1111-1111-1111-111111111111';
const P1 = '22222222-2222-2222-2222-222222222222';
const FL1 = '33333333-3333-3333-3333-333333333333';
const AZ1 = '44444444-4444-4444-4444-444444444444';
const APP1 = '55555555-5555-5555-5555-555555555555';
const U1 = '66666666-6666-6666-6666-666666666666';

const BASE_PAYLOAD = {
  requestedBy: 'Bob',
  requesterEmail: 'bob@example.com',
  lines: [{ productId: P1, flavorId: FL1, azCode: 'eu-west-1a', quantity: 2 }],
  applicationId: APP1,
  environment: 'DEV',
};

describe('Forecast Routes (lifecycle)', () => {
  beforeEach(() => {
    prismaMock.forecast = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    prismaMock.forecastLine = {
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    };
    prismaMock.forecastTransition = {
      findMany: jest.fn(),
      create: jest.fn(),
    };
    prismaMock.application = { findUnique: jest.fn() };
    prismaMock.flavor = { findMany: jest.fn(), findUnique: jest.fn() };
    prismaMock.productVariant = { findMany: jest.fn() };
    prismaMock.availabilityZone = { findUnique: jest.fn(), findMany: jest.fn() };
    prismaMock.user = { findUnique: jest.fn() };
    prismaMock.instance = { findMany: jest.fn() };
    jest.clearAllMocks();
    prismaMock.$transaction = (cb: any) => cb(prismaMock);
  });

  describe('GET /api/forecasts', () => {
    it('should list all forecasts with lines, transitions and application', async () => {
      const forecasts = [
        {
          id: F1,
          requestedBy: 'Alice',
          requesterEmail: 'alice@example.com',
          status: 'PENDING_TECH',
          lines: [
            { product: { id: P1, name: 'VM Debian', category: { id: 'c1', name: 'Compute' } }, flavor: { id: FL1, name: 'Small', vcpu: 2, ramGb: 4 } },
          ],
          transitions: [],
          application: { id: APP1, name: 'App1', continuityLevel: { name: 'LOW' } },
        },
      ];
      prismaMock.forecast.findMany.mockResolvedValue(forecasts);

      const app = createApp();
      const res = await request(app).get('/api/forecasts');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(forecasts);
    });

    it('should filter by queue status', async () => {
      prismaMock.forecast.findMany.mockResolvedValue([]);
      const app = createApp();
      const res = await request(app).get('/api/forecasts?queue=PENDING_TECH');

      expect(res.status).toBe(200);
      expect(prismaMock.forecast.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'PENDING_TECH' }) })
      );
    });

    it('should filter mine by email', async () => {
      prismaMock.forecast.findMany.mockResolvedValue([]);
      const app = createApp();
      const res = await request(app).get('/api/forecasts?mine=bob@example.com');

      expect(res.status).toBe(200);
      expect(prismaMock.forecast.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ requesterEmail: 'bob@example.com' }, { requestedBy: 'bob@example.com' }],
          }),
        })
      );
    });
  });

  describe('GET /api/forecasts/stats', () => {
    it('should return stats with byStatus and totalEstimatedCost', async () => {
      prismaMock.forecast.findMany.mockResolvedValue([
        { status: 'PENDING_TECH', estimatedCost: 100 },
        { status: 'PENDING_TECH', estimatedCost: 50 },
        { status: 'APPROVED', estimatedCost: 200 },
        { status: 'REJECTED', estimatedCost: null },
      ]);

      const app = createApp();
      const res = await request(app).get('/api/forecasts/stats');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        total: 4,
        pending: 2,
        approved: 1,
        rejected: 1,
        byStatus: [
          { status: 'PENDING_TECH', count: 2 },
          { status: 'APPROVED', count: 1 },
          { status: 'REJECTED', count: 1 },
        ],
        totalEstimatedCost: 350,
      });
    });
  });

  describe('POST /api/forecasts', () => {
    it('should create a forecast in DRAFT by default', async () => {
      const created = {
        id: 'f-new',
        ...BASE_PAYLOAD,
        status: 'DRAFT',
        lines: [],
        application: { id: APP1, name: 'App1', continuityLevel: { name: 'LOW' } },
      };
      prismaMock.application.findUnique.mockResolvedValue({ id: APP1 });
      prismaMock.flavor.findMany.mockResolvedValue([{ id: FL1, vcpu: 2, ramGb: 4 }]);
      prismaMock.availabilityZone.findMany.mockResolvedValue([{ id: AZ1, code: 'eu-west-1a' }]);
      prismaMock.productVariant.findMany.mockResolvedValue([{ productId: P1, flavorId: FL1 }]);
      prismaMock.forecast.create.mockResolvedValue(created);

      const app = createApp();
      const res = await request(app).post('/api/forecasts').send({ ...BASE_PAYLOAD, targetDate: '2024-12-31' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual(created);
      // create called with DRAFT status and estimated cost (2×(2×10+4×3)) = 64
      const createArg = prismaMock.forecast.create.mock.calls[0][0];
      expect(createArg.data.status).toBe('DRAFT');
      expect(createArg.data.estimatedCost).toBe(64);
      expect(createArg.data.lines.create[0].unitPrice).toBe(32);
    });

    it('should create and submit when submit=true', async () => {
      const created = { id: 'f-new', status: 'PENDING_TECH' };
      prismaMock.application.findUnique.mockResolvedValue({ id: APP1 });
      prismaMock.flavor.findMany.mockResolvedValue([{ id: FL1, vcpu: 2, ramGb: 4 }]);
      prismaMock.availabilityZone.findMany.mockResolvedValue([{ id: AZ1, code: 'eu-west-1a' }]);
      prismaMock.productVariant.findMany.mockResolvedValue([{ productId: P1, flavorId: FL1 }]);
      prismaMock.forecast.create.mockResolvedValue(created);

      const app = createApp();
      const res = await request(app).post('/api/forecasts').send({ ...BASE_PAYLOAD, submit: true });

      expect(res.status).toBe(201);
      const createArg = prismaMock.forecast.create.mock.calls[0][0];
      expect(createArg.data.status).toBe('PENDING_TECH');
      expect(createArg.data.transitions.create.action).toBe('SUBMIT');
      expect(createArg.data.submittedAt).toBeDefined();
    });

    it('should reject a flavor not compatible with the product', async () => {
      prismaMock.application.findUnique.mockResolvedValue({ id: APP1 });
      prismaMock.flavor.findMany.mockResolvedValue([{ id: FL1, vcpu: 2, ramGb: 4 }]);
      prismaMock.availabilityZone.findMany.mockResolvedValue([{ id: AZ1, code: 'eu-west-1a' }]);
      // No catalog variant pairs this product with this flavor
      prismaMock.productVariant.findMany.mockResolvedValue([]);

      const app = createApp();
      const res = await request(app).post('/api/forecasts').send({ ...BASE_PAYLOAD });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not available for this product/);
    });

    it('should reject HA resiliency with a single AZ', async () => {
      prismaMock.application.findUnique.mockResolvedValue({ id: APP1 });
      prismaMock.flavor.findMany.mockResolvedValue([{ id: FL1, vcpu: 2, ramGb: 4 }]);
      prismaMock.availabilityZone.findMany.mockResolvedValue([{ id: AZ1, code: 'eu-west-1a' }]);
      prismaMock.productVariant.findMany.mockResolvedValue([{ productId: P1, flavorId: FL1 }]);

      const app = createApp();
      const res = await request(app).post('/api/forecasts').send({
        ...BASE_PAYLOAD,
        lines: [{ productId: P1, flavorId: FL1, azCode: 'eu-west-1a', quantity: 1, resiliency: 'HA' }],
      });

      expect(res.status).toBe(400);
    });

    it('should reject invalid email', async () => {
      const app = createApp();
      const res = await request(app).post('/api/forecasts').send({ ...BASE_PAYLOAD, requesterEmail: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject zero quantity', async () => {
      const app = createApp();
      const res = await request(app).post('/api/forecasts').send({
        ...BASE_PAYLOAD,
        lines: [{ productId: P1, flavorId: FL1, azCode: 'eu-west-1a', quantity: 0 }],
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject missing required fields', async () => {
      const app = createApp();
      const res = await request(app).post('/api/forecasts').send({ lines: [{ productId: P1, flavorId: FL1, azCode: 'eu-west-1a', quantity: 1 }] });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject invalid UUID for productId', async () => {
      const app = createApp();
      const res = await request(app).post('/api/forecasts').send({
        ...BASE_PAYLOAD,
        lines: [{ productId: 'not-a-uuid', flavorId: FL1, azCode: 'eu-west-1a', quantity: 1 }],
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('PATCH /api/forecasts/:id (draft edit)', () => {
    it('should edit a DRAFT forecast and recompute cost', async () => {
      const existing = {
        id: F1,
        status: 'DRAFT',
        requesterEmail: 'bob@example.com',
        lines: [{ flavor: { vcpu: 2, ramGb: 4 }, quantity: 2 }],
      };
      const updated = { ...existing, lines: [], transitions: [] };
      prismaMock.forecast.findUnique.mockResolvedValue(existing);
      prismaMock.forecast.update.mockResolvedValue(updated);
      prismaMock.flavor.findMany.mockResolvedValue([{ id: FL1, vcpu: 4, ramGb: 8 }]);
      prismaMock.availabilityZone.findMany.mockResolvedValue([{ id: AZ1, code: 'eu-west-1a' }]);
      prismaMock.productVariant.findMany.mockResolvedValue([{ productId: P1, flavorId: FL1 }]);

      const app = createApp();
      const res = await request(app).patch(`/api/forecasts/${F1}`).send({
        actorName: 'Bob',
        lines: [{ productId: P1, flavorId: FL1, azCode: 'eu-west-1a', quantity: 3 }],
        justification: 'Updated',
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(updated);
      // 3 × (4×10 + 8×3) = 192
      expect(prismaMock.forecast.update.mock.calls[0][0].data.estimatedCost).toBe(192);
    });

    it('should refuse editing a non-DRAFT forecast', async () => {
      prismaMock.forecast.findUnique.mockResolvedValue({ id: F1, status: 'PENDING_TECH', requesterEmail: 'bob@example.com' });

      const app = createApp();
      const res = await request(app).patch(`/api/forecasts/${F1}`).send({ actorName: 'Bob' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('DRAFT');
    });

    it('should reject invalid id format', async () => {
      const app = createApp();
      const res = await request(app).patch('/api/forecasts/not-a-uuid').send({ actorName: 'Bob' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('POST /api/forecasts/:id/submit', () => {
    it('should submit a DRAFT to PENDING_TECH', async () => {
      const existing = { id: F1, status: 'DRAFT', requesterEmail: 'bob@example.com' };
      const submitted = { ...existing, status: 'PENDING_TECH', transitions: [] };
      prismaMock.forecast.findUnique.mockResolvedValue(existing);
      prismaMock.forecast.update.mockResolvedValue(submitted);

      const app = createApp();
      const res = await request(app).post(`/api/forecasts/${F1}/submit`).send({ actorName: 'Bob', actorEmail: 'bob@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PENDING_TECH');
      expect(prismaMock.forecastTransition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'SUBMIT', fromStatus: 'DRAFT', toStatus: 'PENDING_TECH', actorName: 'Bob' }),
      });
    });

    it('should refuse submitting a PENDING_TECH forecast', async () => {
      prismaMock.forecast.findUnique.mockResolvedValue({ id: F1, status: 'PENDING_TECH', requesterEmail: 'bob@example.com' });

      const app = createApp();
      const res = await request(app).post(`/api/forecasts/${F1}/submit`).send({ actorName: 'Bob' });

      expect(res.status).toBe(400);
      expect(prismaMock.forecast.update).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/forecasts/:id/approve', () => {
    it('should advance PENDING_TECH to PENDING_MANAGER for a TECH_LEAD', async () => {
      const existing = { id: F1, status: 'PENDING_TECH', requesterEmail: 'user@cloudmarket.local' };
      const approved = { ...existing, status: 'PENDING_MANAGER', transitions: [] };
      prismaMock.forecast.findUnique.mockResolvedValue(existing);
      prismaMock.user.findUnique.mockImplementation(({ where }: any) => {
        if (where.id === U1) return Promise.resolve({ id: U1, name: 'Trevor', email: 'tech@x', roles: ['TECH_LEAD'] });
        return Promise.resolve(null);
      });
      prismaMock.forecast.update.mockResolvedValue(approved);

      const app = createApp();
      const res = await request(app).post(`/api/forecasts/${F1}/approve`).send({ actorId: U1, actorName: 'Trevor' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PENDING_MANAGER');
    });

    it('should refuse approve for an actor without the step role', async () => {
      prismaMock.forecast.findUnique.mockResolvedValue({ id: F1, status: 'PENDING_TECH', requesterEmail: 'user@cloudmarket.local' });
      prismaMock.user.findUnique.mockResolvedValue({ id: U1, name: 'Fiona', email: 'fin@x', roles: ['FINANCE'] });

      const app = createApp();
      const res = await request(app).post(`/api/forecasts/${F1}/approve`).send({ actorId: U1, actorName: 'Fiona' });

      expect(res.status).toBe(403);
      expect(prismaMock.forecast.update).not.toHaveBeenCalled();
    });

    it('should bind the MANAGER step to the requester manager', async () => {
      const existing = { id: F1, status: 'PENDING_MANAGER', requesterEmail: 'user@cloudmarket.local' };
      prismaMock.forecast.findUnique.mockResolvedValue(existing);
      // actor U1 exists but is NOT the requester's manager
      prismaMock.user.findUnique.mockImplementation(({ where }: any) => {
        if (where.id === U1) return Promise.resolve({ id: U1, name: 'Stranger', email: 's@x', roles: ['MANAGER'] });
        if (where.email === 'user@cloudmarket.local') return Promise.resolve({ id: 'req-1', email: 'user@cloudmarket.local', managerId: 'other-manager' });
        return Promise.resolve(null);
      });

      const app = createApp();
      const res = await request(app).post(`/api/forecasts/${F1}/approve`).send({ actorId: U1, actorName: 'Stranger' });

      expect(res.status).toBe(403);
    });

    it('should accept the MANAGER step for the actual requester manager', async () => {
      const existing = { id: F1, status: 'PENDING_MANAGER', requesterEmail: 'user@cloudmarket.local' };
      prismaMock.forecast.findUnique.mockResolvedValue(existing);
      prismaMock.user.findUnique.mockImplementation(({ where }: any) => {
        if (where.id === U1) return Promise.resolve({ id: U1, name: 'Carol', email: 'carol@x', roles: ['MANAGER'] });
        if (where.email === 'user@cloudmarket.local') return Promise.resolve({ id: 'req-1', email: 'user@cloudmarket.local', managerId: U1 });
        return Promise.resolve(null);
      });
      prismaMock.forecast.update.mockResolvedValue({ ...existing, status: 'PENDING_BUDGET', transitions: [] });

      const app = createApp();
      const res = await request(app).post(`/api/forecasts/${F1}/approve`).send({ actorId: U1, actorName: 'Carol' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PENDING_BUDGET');
    });
  });

  describe('POST /api/forecasts/:id/reject', () => {
    it('should require a rejection reason', async () => {
      const app = createApp();
      const res = await request(app).post(`/api/forecasts/${F1}/reject`).send({ actorName: 'Trevor' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject with reason and record the transition', async () => {
      const existing = { id: F1, status: 'PENDING_TECH', requesterEmail: 'user@cloudmarket.local' };
      prismaMock.forecast.findUnique.mockResolvedValue(existing);
      prismaMock.user.findUnique.mockResolvedValue({ id: U1, name: 'Trevor', email: 't@x', roles: ['TECH_LEAD'] });
      prismaMock.forecast.update.mockResolvedValue({ ...existing, status: 'REJECTED', transitions: [] });

      const app = createApp();
      const res = await request(app).post(`/api/forecasts/${F1}/reject`).send({ actorId: U1, actorName: 'Trevor', comment: 'Not aligned with the roadmap' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('REJECTED');
      const updateArg = prismaMock.forecast.update.mock.calls[0][0];
      expect(updateArg.data.rejectionReason).toBe('Not aligned with the roadmap');
      expect(prismaMock.forecastTransition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'REJECT', comment: 'Not aligned with the roadmap' }),
      });
    });
  });

  describe('POST /api/forecasts/:id/resubmit', () => {
    it('should resubmit a REJECTED forecast to PENDING_TECH', async () => {
      const existing = { id: F1, status: 'REJECTED', requesterEmail: 'bob@example.com' };
      prismaMock.forecast.findUnique.mockResolvedValue(existing);
      prismaMock.forecast.update.mockResolvedValue({ ...existing, status: 'PENDING_TECH', transitions: [] });

      const app = createApp();
      const res = await request(app).post(`/api/forecasts/${F1}/resubmit`).send({ actorName: 'Bob', actorEmail: 'bob@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PENDING_TECH');
    });

    it('should refuse resubmitting an APPROVED forecast', async () => {
      prismaMock.forecast.findUnique.mockResolvedValue({ id: F1, status: 'APPROVED', requesterEmail: 'bob@example.com' });

      const app = createApp();
      const res = await request(app).post(`/api/forecasts/${F1}/resubmit`).send({ actorName: 'Bob' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/forecasts/governance', () => {
    it('should return lifecycle definition and recent transitions', async () => {
      prismaMock.forecastTransition.findMany.mockResolvedValue([]);

      const app = createApp();
      const res = await request(app).get('/api/forecasts/governance');

      expect(res.status).toBe(200);
      expect(res.body.steps).toHaveLength(7);
      expect(res.body.rules.length).toBeGreaterThan(0);
      expect(res.body.recentTransitions).toEqual([]);
    });
  });

  describe('DELETE /api/forecasts/:id', () => {
    it('should delete a forecast', async () => {
      prismaMock.forecast.findUnique.mockResolvedValue({ id: F1 });
      prismaMock.forecast.delete.mockResolvedValue({});

      const app = createApp();
      const res = await request(app).delete(`/api/forecasts/${F1}`);

      expect(res.status).toBe(204);
      expect(prismaMock.forecast.delete).toHaveBeenCalledWith({ where: { id: F1 } });
    });

    it('should return 404 when the forecast does not exist', async () => {
      prismaMock.forecast.findUnique.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).delete(`/api/forecasts/${F1}`);

      expect(res.status).toBe(404);
    });

    it('should reject invalid id format', async () => {
      const app = createApp();
      const res = await request(app).delete('/api/forecasts/not-a-uuid');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });
});
