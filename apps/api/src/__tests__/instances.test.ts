import request from 'supertest';
import express from 'express';

var prismaMock: any = {};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => prismaMock),
  InstanceStatus: {
    PENDING: 'PENDING',
    PROVISIONING: 'PROVISIONING',
    RUNNING: 'RUNNING',
    STOPPED: 'STOPPED',
    TERMINATED: 'TERMINATED',
  },
}));

import { instanceRoutes } from '../routes/instances';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/instances', instanceRoutes);
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

describe('Instance Registry Routes', () => {
  beforeEach(() => {
    prismaMock.instance = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    prismaMock.application = {
      findUnique: jest.fn(),
    };
    prismaMock.product = {
      findUnique: jest.fn(),
    };
    prismaMock.flavor = {
      findUnique: jest.fn(),
    };
    prismaMock.availabilityZone = {
      findUnique: jest.fn(),
    };
    prismaMock.forecast = {
      findUnique: jest.fn(),
    };
    prismaMock.productLifecycle = {
      findUnique: jest.fn(),
    };
    jest.clearAllMocks();
  });

  // ─── GET /api/instances ───────────────────────────────────────────────────
  describe('GET /api/instances', () => {
    it('should list all instances with relations', async () => {
      const instances = [
        {
          id: 'i1',
          name: 'web-server-01',
          application: { id: 'a1', name: 'App1', continuityLevel: { id: 'c1', name: 'LOW' } },
          product: { id: 'p1', name: 'VM', category: { id: 'cat1', name: 'Compute' } },
          flavor: { id: 'f1', name: 'Small' },
          az: { id: 'az1', code: 'eu-west-1a' },
          forecast: null,
        },
      ];
      prismaMock.instance.findMany.mockResolvedValue(instances);

      const app = createApp();
      const res = await request(app).get('/api/instances');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(instances);
      expect(prismaMock.instance.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          application: { include: { continuityLevel: true } },
          product: { include: { category: true } },
          flavor: true,
          lifecycle: true,
          az: true,
          forecast: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by applicationId', async () => {
      prismaMock.instance.findMany.mockResolvedValue([]);
      const app = createApp();
      const res = await request(app).get('/api/instances?applicationId=a1');
      expect(res.status).toBe(200);
      expect(prismaMock.instance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { applicationId: 'a1' },
        })
      );
    });

    it('should filter by productId', async () => {
      prismaMock.instance.findMany.mockResolvedValue([]);
      const app = createApp();
      const res = await request(app).get('/api/instances?productId=p1');
      expect(res.status).toBe(200);
      expect(prismaMock.instance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId: 'p1' },
        })
      );
    });

    it('should filter by status', async () => {
      prismaMock.instance.findMany.mockResolvedValue([]);
      const app = createApp();
      const res = await request(app).get('/api/instances?status=RUNNING');
      expect(res.status).toBe(200);
      expect(prismaMock.instance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'RUNNING' },
        })
      );
    });

    it('should filter by environment', async () => {
      prismaMock.instance.findMany.mockResolvedValue([]);
      const app = createApp();
      const res = await request(app).get('/api/instances?environment=PRD');
      expect(res.status).toBe(200);
      expect(prismaMock.instance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { environment: 'PRD' },
        })
      );
    });

    it('should combine multiple filters', async () => {
      prismaMock.instance.findMany.mockResolvedValue([]);
      const app = createApp();
      await request(app).get('/api/instances?applicationId=a1&status=RUNNING&environment=PRD');
      expect(prismaMock.instance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { applicationId: 'a1', status: 'RUNNING', environment: 'PRD' },
        })
      );
    });

    it('should return empty array when no instances exist', async () => {
      prismaMock.instance.findMany.mockResolvedValue([]);
      const app = createApp();
      const res = await request(app).get('/api/instances');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // ─── GET /api/instances/stats ─────────────────────────────────────────────
  describe('GET /api/instances/stats', () => {
    it('should return correct stats aggregation', async () => {
      prismaMock.instance.count
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(1);

      const app = createApp();
      const res = await request(app).get('/api/instances/stats');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        total: 20,
        pending: 3,
        provisioning: 2,
        running: 10,
        stopped: 4,
        terminated: 1,
      });
      expect(prismaMock.instance.count).toHaveBeenCalledTimes(6);
    });

    it('should handle all zero counts', async () => {
      prismaMock.instance.count.mockResolvedValue(0);
      const app = createApp();
      const res = await request(app).get('/api/instances/stats');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        total: 0,
        pending: 0,
        provisioning: 0,
        running: 0,
        stopped: 0,
        terminated: 0,
      });
    });
  });

  // ─── GET /api/instances/:id ───────────────────────────────────────────────
  describe('GET /api/instances/:id', () => {
    it('should return an instance by id', async () => {
      const instance = {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'db-server',
        application: { id: 'a1', name: 'App1' },
        product: { id: 'p1', name: 'VM' },
        flavor: { id: 'f1', name: 'Large' },
        lifecycle: { id: 'lc1', version: '1.0' },
        az: { id: 'az1', code: 'us-east-1a' },
        forecast: null,
      };
      prismaMock.instance.findUnique.mockResolvedValue(instance);

      const app = createApp();
      const res = await request(app).get('/api/instances/11111111-1111-1111-1111-111111111111');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(instance);
    });

    it('should return 404 for nonexistent instance', async () => {
      prismaMock.instance.findUnique.mockResolvedValue(null);
      const app = createApp();
      const res = await request(app).get('/api/instances/99999999-9999-9999-9999-999999999999');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Instance not found');
    });

    it('should reject invalid UUID format', async () => {
      const app = createApp();
      const res = await request(app).get('/api/instances/not-a-uuid');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  // ─── POST /api/instances ──────────────────────────────────────────────────
  describe('POST /api/instances', () => {
    const validPayload = {
      name: 'new-instance',
      applicationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      productId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      flavorId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      azCode: 'eu-west-1a',
    };

    function mockRelationsValid() {
      prismaMock.application.findUnique.mockResolvedValue({ id: validPayload.applicationId });
      prismaMock.product.findUnique.mockResolvedValue({ id: validPayload.productId });
      prismaMock.flavor.findUnique.mockResolvedValue({ id: validPayload.flavorId, productId: validPayload.productId });
      prismaMock.availabilityZone.findUnique.mockResolvedValue({ id: 'az1', code: validPayload.azCode });
    }

    it('should create an instance with valid data', async () => {
      mockRelationsValid();
      const created = {
        id: 'i-new',
        ...validPayload,
        status: 'PENDING',
        environment: 'DEV',
        application: { id: validPayload.applicationId },
        product: { id: validPayload.productId },
        flavor: { id: validPayload.flavorId },
        az: { id: 'az1', code: validPayload.azCode },
        forecast: null,
      };
      prismaMock.instance.create.mockResolvedValue(created);

      const app = createApp();
      const res = await request(app).post('/api/instances').send(validPayload);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(created);
      expect(prismaMock.instance.create).toHaveBeenCalledWith({
        data: {
          name: validPayload.name,
          description: undefined,
          forecastId: undefined,
          applicationId: validPayload.applicationId,
          productId: validPayload.productId,
          flavorId: validPayload.flavorId,
          azCode: validPayload.azCode,
          status: 'PENDING',
          environment: 'DEV',
          ipAddress: undefined,
          hostname: undefined,
          metadata: undefined,
        },
        include: {
          application: { include: { continuityLevel: true } },
          product: { include: { category: true } },
          flavor: true,
          lifecycle: true,
          az: true,
          forecast: true,
        },
      });
    });

    it('should create with explicit status, environment, and optional fields', async () => {
      mockRelationsValid();
      prismaMock.forecast.findUnique.mockResolvedValue({ id: 'ffffffff-ffff-ffff-ffff-ffffffffffff' });
      const payload = {
        ...validPayload,
        forecastId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
        status: 'RUNNING',
        environment: 'PRD',
        description: 'Production DB',
        ipAddress: '10.0.0.1',
        hostname: 'db01.example.com',
        metadata: { team: 'backend' },
      };
      const created = { id: 'i2', ...payload, application: { id: payload.applicationId }, product: { id: payload.productId }, flavor: { id: payload.flavorId }, az: { id: 'az1' }, forecast: { id: payload.forecastId } };
      prismaMock.instance.create.mockResolvedValue(created);

      const app = createApp();
      const res = await request(app).post('/api/instances').send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(created);
    });

    it('should reject when application not found', async () => {
      prismaMock.application.findUnique.mockResolvedValue(null);
      const app = createApp();
      const res = await request(app).post('/api/instances').send(validPayload);
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Application not found');
    });

    it('should reject when product not found', async () => {
      prismaMock.application.findUnique.mockResolvedValue({ id: validPayload.applicationId });
      prismaMock.product.findUnique.mockResolvedValue(null);
      const app = createApp();
      const res = await request(app).post('/api/instances').send(validPayload);
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Product not found');
    });

    it('should reject when flavor not found', async () => {
      prismaMock.application.findUnique.mockResolvedValue({ id: validPayload.applicationId });
      prismaMock.product.findUnique.mockResolvedValue({ id: validPayload.productId });
      prismaMock.flavor.findUnique.mockResolvedValue(null);
      const app = createApp();
      const res = await request(app).post('/api/instances').send(validPayload);
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Flavor not found');
    });

    it('should reject when flavor does not belong to product', async () => {
      prismaMock.application.findUnique.mockResolvedValue({ id: validPayload.applicationId });
      prismaMock.product.findUnique.mockResolvedValue({ id: validPayload.productId });
      prismaMock.flavor.findUnique.mockResolvedValue({ id: validPayload.flavorId, productId: 'other-product-id' });
      const app = createApp();
      const res = await request(app).post('/api/instances').send(validPayload);
      expect(res.status).toBe(409);
      expect(res.body.error).toContain('does not belong to product');
    });

    it('should reject when availability zone not found', async () => {
      prismaMock.application.findUnique.mockResolvedValue({ id: validPayload.applicationId });
      prismaMock.product.findUnique.mockResolvedValue({ id: validPayload.productId });
      prismaMock.flavor.findUnique.mockResolvedValue({ id: validPayload.flavorId, productId: validPayload.productId });
      prismaMock.availabilityZone.findUnique.mockResolvedValue(null);
      const app = createApp();
      const res = await request(app).post('/api/instances').send(validPayload);
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Availability zone not found');
    });

    it('should reject when forecastId provided but forecast not found', async () => {
      mockRelationsValid();
      prismaMock.forecast.findUnique.mockResolvedValue(null);
      const app = createApp();
      const res = await request(app)
        .post('/api/instances')
        .send({ ...validPayload, forecastId: 'ffffffff-ffff-ffff-ffff-ffffffffffff' });
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Forecast not found');
    });

    it('should create an instance with lifecycleId', async () => {
      mockRelationsValid();
      const lifecycleId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
      prismaMock.productLifecycle.findUnique.mockResolvedValue({ id: lifecycleId, productId: validPayload.productId });
      const created = {
        id: 'i-lc',
        ...validPayload,
        lifecycleId,
        status: 'PENDING',
        environment: 'DEV',
        application: { id: validPayload.applicationId },
        product: { id: validPayload.productId },
        flavor: { id: validPayload.flavorId },
        lifecycle: { id: lifecycleId },
        az: { id: 'az1', code: validPayload.azCode },
        forecast: null,
      };
      prismaMock.instance.create.mockResolvedValue(created);

      const app = createApp();
      const res = await request(app).post('/api/instances').send({ ...validPayload, lifecycleId });

      expect(res.status).toBe(201);
      expect(res.body).toEqual(created);
      expect(prismaMock.productLifecycle.findUnique).toHaveBeenCalledWith({ where: { id: lifecycleId } });
    });

    it('should reject when lifecycleId does not belong to product', async () => {
      mockRelationsValid();
      const lifecycleId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
      prismaMock.productLifecycle.findUnique.mockResolvedValue({ id: lifecycleId, productId: 'other-product-id' });
      const app = createApp();
      const res = await request(app).post('/api/instances').send({ ...validPayload, lifecycleId });
      expect(res.status).toBe(409);
      expect(res.body.error).toContain('does not belong to product');
    });

    it('should reject when lifecycle not found', async () => {
      mockRelationsValid();
      prismaMock.productLifecycle.findUnique.mockResolvedValue(null);
      const app = createApp();
      const res = await request(app).post('/api/instances').send({ ...validPayload, lifecycleId: 'dddddddd-dddd-dddd-dddd-dddddddddddd' });
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Lifecycle not found');
    });

    it('should reject empty name', async () => {
      const app = createApp();
      const res = await request(app).post('/api/instances').send({ ...validPayload, name: '' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject invalid UUID for applicationId', async () => {
      const app = createApp();
      const res = await request(app).post('/api/instances').send({ ...validPayload, applicationId: 'not-a-uuid' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject invalid status enum', async () => {
      const app = createApp();
      const res = await request(app).post('/api/instances').send({ ...validPayload, status: 'INVALID_STATUS' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject invalid environment enum', async () => {
      const app = createApp();
      const res = await request(app).post('/api/instances').send({ ...validPayload, environment: 'PROD' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject missing required fields', async () => {
      const app = createApp();
      const res = await request(app).post('/api/instances').send({ name: 'only-name' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  // ─── PATCH /api/instances/:id ─────────────────────────────────────────────
  describe('PATCH /api/instances/:id', () => {
    it('should update instance name and status', async () => {
      const updated = {
        id: 'i1',
        name: 'renamed-server',
        status: 'RUNNING',
        application: { id: 'a1' },
        product: { id: 'p1' },
        flavor: { id: 'f1' },
        az: { id: 'az1' },
        forecast: null,
      };
      prismaMock.instance.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app).patch('/api/instances/11111111-1111-1111-1111-111111111111').send({ name: 'renamed-server', status: 'RUNNING' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(updated);
      expect(prismaMock.instance.update).toHaveBeenCalledWith({
        where: { id: '11111111-1111-1111-1111-111111111111' },
        data: { name: 'renamed-server', status: 'RUNNING' },
        include: {
          application: { include: { continuityLevel: true } },
          product: { include: { category: true } },
          flavor: true,
          lifecycle: true,
          az: true,
          forecast: true,
        },
      });
    });

    it('should parse datetime fields into Date objects', async () => {
      const updated = {
        id: 'i1',
        name: 'server',
        startedAt: new Date('2024-01-15T10:00:00Z'),
        stoppedAt: new Date('2024-01-20T18:00:00Z'),
        terminatedAt: new Date('2024-01-25T00:00:00Z'),
        application: { id: 'a1' },
        product: { id: 'p1' },
        flavor: { id: 'f1' },
        az: { id: 'az1' },
        forecast: null,
      };
      prismaMock.instance.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app).patch('/api/instances/11111111-1111-1111-1111-111111111111').send({
        startedAt: '2024-01-15T10:00:00Z',
        stoppedAt: '2024-01-20T18:00:00Z',
        terminatedAt: '2024-01-25T00:00:00Z',
      });

      expect(res.status).toBe(200);
      expect(prismaMock.instance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            startedAt: new Date('2024-01-15T10:00:00Z'),
            stoppedAt: new Date('2024-01-20T18:00:00Z'),
            terminatedAt: new Date('2024-01-25T00:00:00Z'),
          }),
        })
      );
    });

    it('should update environment', async () => {
      prismaMock.instance.update.mockResolvedValue({ id: 'i1', environment: 'STG', application: { id: 'a1' }, product: { id: 'p1' }, flavor: { id: 'f1' }, az: { id: 'az1' }, forecast: null });
      const app = createApp();
      const res = await request(app).patch('/api/instances/11111111-1111-1111-1111-111111111111').send({ environment: 'STG' });
      expect(res.status).toBe(200);
    });

    it('should update metadata', async () => {
      prismaMock.instance.update.mockResolvedValue({ id: 'i1', metadata: { tags: ['prod'] }, application: { id: 'a1' }, product: { id: 'p1' }, flavor: { id: 'f1' }, az: { id: 'az1' }, forecast: null });
      const app = createApp();
      const res = await request(app).patch('/api/instances/11111111-1111-1111-1111-111111111111').send({ metadata: { tags: ['prod'] } });
      expect(res.status).toBe(200);
    });

    it('should reject invalid UUID param', async () => {
      const app = createApp();
      const res = await request(app).patch('/api/instances/bad-id').send({ name: 'x' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject invalid status enum', async () => {
      const app = createApp();
      const res = await request(app).patch('/api/instances/11111111-1111-1111-1111-111111111111').send({ status: 'DELETED' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject invalid environment enum', async () => {
      const app = createApp();
      const res = await request(app).patch('/api/instances/11111111-1111-1111-1111-111111111111').send({ environment: 'QA' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should update lifecycleId', async () => {
      const lifecycleId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
      prismaMock.productLifecycle.findUnique.mockResolvedValue({ id: lifecycleId, productId: 'p1' });
      prismaMock.instance.findUnique.mockResolvedValue({ id: 'i1', productId: 'p1' });
      prismaMock.instance.update.mockResolvedValue({ id: 'i1', lifecycleId, application: { id: 'a1' }, product: { id: 'p1' }, flavor: { id: 'f1' }, lifecycle: { id: lifecycleId }, az: { id: 'az1' }, forecast: null });
      const app = createApp();
      const res = await request(app).patch('/api/instances/11111111-1111-1111-1111-111111111111').send({ lifecycleId });
      expect(res.status).toBe(200);
      expect(prismaMock.instance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lifecycleId }),
        })
      );
    });

    it('should reject PATCH when lifecycleId does not belong to product', async () => {
      const lifecycleId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
      prismaMock.productLifecycle.findUnique.mockResolvedValue({ id: lifecycleId, productId: 'other-product' });
      prismaMock.instance.findUnique.mockResolvedValue({ id: 'i1', productId: 'p1' });
      const app = createApp();
      const res = await request(app).patch('/api/instances/11111111-1111-1111-1111-111111111111').send({ lifecycleId });
      expect(res.status).toBe(409);
      expect(res.body.error).toContain('does not belong to product');
    });
  });

  // ─── DELETE /api/instances/:id ────────────────────────────────────────────
  describe('DELETE /api/instances/:id', () => {
    it('should delete an instance', async () => {
      prismaMock.instance.delete.mockResolvedValue({});
      const app = createApp();
      const res = await request(app).delete('/api/instances/11111111-1111-1111-1111-111111111111');
      expect(res.status).toBe(204);
      expect(prismaMock.instance.delete).toHaveBeenCalledWith({ where: { id: '11111111-1111-1111-1111-111111111111' } });
    });

    it('should reject invalid UUID param', async () => {
      const app = createApp();
      const res = await request(app).delete('/api/instances/not-uuid');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should propagate not-found errors', async () => {
      const err = new Error('Record not found') as any;
      err.code = 'P2025';
      prismaMock.instance.delete.mockRejectedValue(err);
      const app = createApp();
      const res = await request(app).delete('/api/instances/99999999-9999-9999-9999-999999999999');
      expect(res.status).toBe(500);
    });
  });
});
