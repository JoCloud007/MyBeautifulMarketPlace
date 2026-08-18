import request from 'supertest';
import express from 'express';

var prismaMock: any = {};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => prismaMock),
}));

import { flavorRoutes } from '../routes/flavors';

const FL1 = '11111111-1111-1111-1111-111111111111';
const FL2 = '22222222-2222-2222-2222-222222222222';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/flavors', flavorRoutes);
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

describe('Flavor Routes — Marketplace Feature', () => {
  beforeEach(() => {
    prismaMock.flavor = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe('GET /api/flavors', () => {
    it('lists all global flavors with usage counts', async () => {
      const flavors = [
        { id: FL1, name: 'Small', vcpu: 2, ramGb: 4, description: 'Entry-level', _count: { variants: 3, forecastLines: 2 } },
        { id: FL2, name: 'Large', vcpu: 8, ramGb: 16, description: 'High-performance', _count: { variants: 1, forecastLines: 0 } },
      ];
      prismaMock.flavor.findMany.mockResolvedValue(flavors);

      const app = createApp();
      const res = await request(app).get('/api/flavors');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].name).toBe('Small');
      expect(res.body[0].vcpu).toBe(2);
      expect(res.body[0]._count.variants).toBe(3);
      expect(res.body[1]._count.forecastLines).toBe(0);
    });
  });

  describe('POST /api/flavors', () => {
    it('creates a new global flavor', async () => {
      const payload = { name: 'XL', vcpu: 16, ramGb: 32, description: 'Maximum performance' };
      prismaMock.flavor.create.mockResolvedValue({ id: FL1, ...payload, _count: { variants: 0 } });

      const app = createApp();
      const res = await request(app).post('/api/flavors').send(payload);

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('XL');
      expect(res.body.vcpu).toBe(16);
      expect(res.body.ramGb).toBe(32);
    });

    it('rejects negative vcpu', async () => {
      const payload = { name: 'Bad', vcpu: -1, ramGb: 4 };
      const app = createApp();
      const res = await request(app).post('/api/flavors').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('allows zero vcpu for storage flavors', async () => {
      const payload = { name: 'Storage Small', vcpu: 0, ramGb: 0, description: '1TB storage' };
      prismaMock.flavor.create.mockResolvedValue({ id: FL1, ...payload, _count: { variants: 0 } });

      const app = createApp();
      const res = await request(app).post('/api/flavors').send(payload);

      expect(res.status).toBe(201);
      expect(res.body.vcpu).toBe(0);
    });
  });

  describe('GET /api/flavors/:id', () => {
    it('returns a flavor with its variants', async () => {
      const flavor = {
        id: FL1,
        name: 'Small',
        vcpu: 2,
        ramGb: 4,
        variants: [
          {
            id: 'v1',
            product: { id: 'p1', name: 'Virtual Machine', slug: 'virtual-machine' },
            os: { id: 'os1', name: 'Debian' },
            osVersion: { id: 'ver1', version: '12 (Bookworm)' },
          },
        ],
        _count: { variants: 1, forecastLines: 0 },
      };
      prismaMock.flavor.findUnique.mockResolvedValue(flavor);

      const app = createApp();
      const res = await request(app).get(`/api/flavors/${FL1}`);

      expect(res.status).toBe(200);
      expect(res.body.variants).toHaveLength(1);
      expect(res.body.variants[0].product.name).toBe('Virtual Machine');
    });

    it('returns 404 for non-existent flavor', async () => {
      prismaMock.flavor.findUnique.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).get(`/api/flavors/${FL1}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/flavors/:id', () => {
    it('updates flavor specs', async () => {
      prismaMock.flavor.update.mockResolvedValue({
        id: FL1,
        name: 'Small',
        vcpu: 4,
        ramGb: 8,
        _count: { variants: 2 },
      });

      const app = createApp();
      const res = await request(app).patch(`/api/flavors/${FL1}`).send({ vcpu: 4, ramGb: 8 });

      expect(res.status).toBe(200);
      expect(res.body.vcpu).toBe(4);
      expect(res.body.ramGb).toBe(8);
    });
  });

  describe('DELETE /api/flavors/:id', () => {
    it('blocks deletion when variants exist', async () => {
      prismaMock.flavor.findUnique.mockResolvedValue({
        id: FL1,
        _count: { variants: 3, forecastLines: 0 },
      });

      const app = createApp();
      const res = await request(app).delete(`/api/flavors/${FL1}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('variants');
    });

    it('blocks deletion when forecast lines exist', async () => {
      prismaMock.flavor.findUnique.mockResolvedValue({
        id: FL1,
        _count: { variants: 0, forecastLines: 2 },
      });

      const app = createApp();
      const res = await request(app).delete(`/api/flavors/${FL1}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('forecast lines');
    });

    it('deletes unused flavor', async () => {
      prismaMock.flavor.findUnique.mockResolvedValue({
        id: FL1,
        _count: { variants: 0, forecastLines: 0 },
      });
      prismaMock.flavor.delete.mockResolvedValue({});

      const app = createApp();
      const res = await request(app).delete(`/api/flavors/${FL1}`);

      expect(res.status).toBe(204);
    });
  });
});
