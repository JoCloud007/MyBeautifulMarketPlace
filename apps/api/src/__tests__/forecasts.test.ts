import request from 'supertest';
import express from 'express';
import { forecastRoutes } from '../routes/forecasts';

var prismaMock: any = {};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => prismaMock),
  ApprovalStatus: {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
  },
}));

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

describe('Forecast Routes', () => {
  beforeEach(() => {
    prismaMock.forecast = {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    prismaMock.application = {
      findUnique: jest.fn(),
    };
    prismaMock.flavor = {
      findUnique: jest.fn(),
    };
    prismaMock.availabilityZone = {
      findUnique: jest.fn(),
    };
    prismaMock.productAvailabilityZone = {
      findFirst: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe('GET /api/forecasts', () => {
    it('should list all forecasts with product and flavor', async () => {
      const forecasts = [
        {
          id: F1,
          requestedBy: 'Alice',
          requesterEmail: 'alice@example.com',
          status: 'PENDING',
          lines: [
            { product: { id: P1, name: 'VM Debian', category: { id: 'c1', name: 'Compute' } }, flavor: { id: FL1, name: 'Small', vcpu: 2, ramGb: 4 } },
          ],
          application: { id: APP1, name: 'App1', continuityLevel: { name: 'LOW' } },
        },
      ];
      prismaMock.forecast.findMany.mockResolvedValue(forecasts);

      const app = createApp();
      const res = await request(app).get('/api/forecasts');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(forecasts);
    });

    it('should return empty array when no forecasts exist', async () => {
      prismaMock.forecast.findMany.mockResolvedValue([]);

      const app = createApp();
      const res = await request(app).get('/api/forecasts');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('GET /api/forecasts/stats', () => {
    it('should return correct stats aggregation', async () => {
      prismaMock.forecast.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(2);

      const app = createApp();
      const res = await request(app).get('/api/forecasts/stats');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ total: 10, pending: 3, approved: 5, rejected: 2 });
      expect(prismaMock.forecast.count).toHaveBeenCalledTimes(4);
    });

    it('should handle zero counts', async () => {
      prismaMock.forecast.count.mockResolvedValue(0);

      const app = createApp();
      const res = await request(app).get('/api/forecasts/stats');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ total: 0, pending: 0, approved: 0, rejected: 0 });
    });
  });

  describe('POST /api/forecasts', () => {
    it('should create a forecast with valid data', async () => {
      const payload = {
        requestedBy: 'Bob',
        requesterEmail: 'bob@example.com',
        targetDate: '2024-12-31',
        lines: [{ productId: P1, flavorId: FL1, azCode: 'eu-west-1a', quantity: 2 }],
        justification: 'Need compute',
        applicationId: APP1,
        environment: 'DEV',
      };
      const created = {
        id: 'f-new',
        ...payload,
        status: 'PENDING',
        lines: [{ productId: P1, flavorId: FL1, azCode: 'eu-west-1a', quantity: 2, product: { id: P1 }, flavor: { id: FL1 } }],
        application: { id: APP1, name: 'App1', continuityLevel: { name: 'LOW' } },
      };
      prismaMock.application.findUnique.mockResolvedValue({ id: APP1 });
      prismaMock.flavor.findUnique.mockResolvedValue({ id: FL1, productId: P1 });
      prismaMock.availabilityZone.findUnique.mockResolvedValue({ id: AZ1, code: 'eu-west-1a' });
      prismaMock.productAvailabilityZone.findFirst.mockResolvedValue({ id: 'paz1' });
      prismaMock.forecast.create.mockResolvedValue(created);

      const app = createApp();
      const res = await request(app).post('/api/forecasts').send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(created);
    });

    it('should reject invalid email', async () => {
      const payload = {
        requestedBy: 'Bob',
        requesterEmail: 'not-an-email',
        lines: [{ productId: P1, flavorId: FL1, azCode: 'eu-west-1a', quantity: 1 }],
        applicationId: APP1,
        environment: 'DEV',
      };

      const app = createApp();
      const res = await request(app).post('/api/forecasts').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject zero quantity', async () => {
      const payload = {
        requestedBy: 'Bob',
        requesterEmail: 'bob@example.com',
        lines: [{ productId: P1, flavorId: FL1, azCode: 'eu-west-1a', quantity: 0 }],
        applicationId: APP1,
        environment: 'DEV',
      };

      const app = createApp();
      const res = await request(app).post('/api/forecasts').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject missing required fields', async () => {
      const payload = { lines: [{ productId: P1, flavorId: FL1, azCode: 'eu-west-1a', quantity: 1 }] };

      const app = createApp();
      const res = await request(app).post('/api/forecasts').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject invalid UUID for productId', async () => {
      const payload = {
        requestedBy: 'Bob',
        requesterEmail: 'bob@example.com',
        lines: [{ productId: 'not-a-uuid', flavorId: FL1, azCode: 'eu-west-1a', quantity: 1 }],
        applicationId: APP1,
        environment: 'DEV',
      };

      const app = createApp();
      const res = await request(app).post('/api/forecasts').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('PATCH /api/forecasts/:id', () => {
    it('should approve a forecast and set reviewedAt', async () => {
      const payload = { status: 'APPROVED', reviewedBy: 'Admin' };
      const updated = {
        id: F1,
        status: 'APPROVED',
        reviewedBy: 'Admin',
        reviewedAt: '2024-01-01T00:00:00.000Z',
        lines: [],
        application: { id: APP1, name: 'App1', continuityLevel: { name: 'LOW' } },
      };
      prismaMock.forecast.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app).patch(`/api/forecasts/${F1}`).send(payload);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(updated);
    });

    it('should reject a forecast with rejectionReason', async () => {
      const payload = { status: 'REJECTED', reviewedBy: 'Admin', rejectionReason: 'Budget exceeded' };
      const updated = {
        id: F1,
        status: 'REJECTED',
        reviewedBy: 'Admin',
        reviewedAt: '2024-01-01T00:00:00.000Z',
        rejectionReason: 'Budget exceeded',
        lines: [],
        application: { id: APP1, name: 'App1', continuityLevel: { name: 'LOW' } },
      };
      prismaMock.forecast.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app).patch(`/api/forecasts/${F1}`).send(payload);

      expect(res.status).toBe(200);
      expect(res.body.rejectionReason).toBe('Budget exceeded');
    });

    it('should reject invalid status enum', async () => {
      const payload = { status: 'UNKNOWN', reviewedBy: 'Admin' };

      const app = createApp();
      const res = await request(app).patch(`/api/forecasts/${F1}`).send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject missing reviewedBy', async () => {
      const payload = { status: 'APPROVED' };

      const app = createApp();
      const res = await request(app).patch(`/api/forecasts/${F1}`).send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject invalid id format', async () => {
      const payload = { status: 'APPROVED', reviewedBy: 'Admin' };

      const app = createApp();
      const res = await request(app).patch('/api/forecasts/not-a-uuid').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('DELETE /api/forecasts/:id', () => {
    it('should delete a forecast', async () => {
      prismaMock.forecast.delete.mockResolvedValue({});

      const app = createApp();
      const res = await request(app).delete(`/api/forecasts/${F1}`);

      expect(res.status).toBe(204);
      expect(prismaMock.forecast.delete).toHaveBeenCalledWith({ where: { id: F1 } });
    });

    it('should propagate not-found errors', async () => {
      const err = new Error('Record not found') as any;
      err.code = 'P2025';
      prismaMock.forecast.delete.mockRejectedValue(err);

      const app = createApp();
      const res = await request(app).delete(`/api/forecasts/${F1}`);

      expect(res.status).toBe(500);
    });

    it('should reject invalid id format', async () => {
      const app = createApp();
      const res = await request(app).delete('/api/forecasts/not-a-uuid');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });
});
