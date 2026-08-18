import request from 'supertest';
import express from 'express';

var prismaMock: any = {};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => prismaMock),
  ComputeType: {
    PHYSICAL: 'PHYSICAL',
    VIRTUAL: 'VIRTUAL',
  },
}));

import { productRoutes } from '../routes/products';

const CAT_COMPUTE = '11111111-1111-1111-1111-111111111111';
const CAT_DATA = '22222222-2222-2222-2222-222222222222';
const PROD1 = '33333333-3333-3333-3333-333333333333';
const PROD2 = '44444444-4444-4444-4444-444444444444';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/products', productRoutes);
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

describe('Product Routes — Marketplace Feature', () => {
  beforeEach(() => {
    prismaMock.product = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    prismaMock.category = {
      findUnique: jest.fn(),
    };
    prismaMock.forecast = {
      findMany: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe('GET /api/products', () => {
    it('lists products with variants, dependencies, and counts', async () => {
      const products = [
        {
          id: PROD1,
          name: 'Virtual Machine',
          slug: 'virtual-machine',
          category: { id: CAT_COMPUTE, name: 'Compute', slug: 'compute' },
          computeType: 'VIRTUAL',
          variants: [{ id: 'v1', name: 'Debian 12 - Small', os: { name: 'Debian' }, flavor: { name: 'Small' } }],
          dependencies: [],
          dependentProducts: [],
          upgradeFrom: [],
          upgradeTo: [],
          _count: { variants: 1, instances: 2 },
        },
        {
          id: PROD2,
          name: 'Object Storage',
          slug: 'object-storage',
          category: { id: CAT_DATA, name: 'Data', slug: 'data' },
          computeType: null,
          variants: [],
          dependencies: [],
          dependentProducts: [],
          upgradeFrom: [],
          upgradeTo: [],
          _count: { variants: 0, instances: 0 },
        },
      ];
      prismaMock.product.findMany.mockResolvedValue(products);

      const app = createApp();
      const res = await request(app).get('/api/products');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].computeType).toBe('VIRTUAL');
      expect(res.body[0].variants).toHaveLength(1);
      expect(res.body[1].computeType).toBeNull();
    });

    it('filters by computeType', async () => {
      const products = [
        {
          id: PROD1,
          name: 'Bare Metal',
          slug: 'bare-metal',
          category: { id: CAT_COMPUTE, name: 'Compute', slug: 'compute' },
          computeType: 'PHYSICAL',
          variants: [],
          dependencies: [],
          dependentProducts: [],
          upgradeFrom: [],
          upgradeTo: [],
          _count: { variants: 0, instances: 0 },
        },
      ];
      prismaMock.product.findMany.mockResolvedValue(products);

      const app = createApp();
      const res = await request(app).get('/api/products?computeType=PHYSICAL');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].computeType).toBe('PHYSICAL');
    });

    it('filters by category slug', async () => {
      prismaMock.product.findMany.mockResolvedValue([]);

      const app = createApp();
      const res = await request(app).get('/api/products?category=compute');

      expect(res.status).toBe(200);
      expect(prismaMock.product.findMany).toHaveBeenCalled();
    });
  });

  describe('POST /api/products', () => {
    it('creates a Compute product with computeType', async () => {
      const payload = {
        name: 'Virtual Machine',
        slug: 'virtual-machine',
        categoryId: CAT_COMPUTE,
        computeType: 'VIRTUAL',
        description: 'A VM',
      };
      prismaMock.product.findUnique.mockResolvedValue(null);
      prismaMock.category.findUnique.mockResolvedValue({ id: CAT_COMPUTE, slug: 'compute' });
      prismaMock.product.create.mockResolvedValue({
        id: PROD1,
        ...payload,
        category: { id: CAT_COMPUTE, name: 'Compute', slug: 'compute' },
        variants: [],
        dependencies: [],
        dependentProducts: [],
        _count: { variants: 0 },
      });

      const app = createApp();
      const res = await request(app).post('/api/products').send(payload);

      expect(res.status).toBe(201);
      expect(res.body.computeType).toBe('VIRTUAL');
      expect(res.body.category.slug).toBe('compute');
    });

    it('rejects computeType for non-Compute category', async () => {
      const payload = {
        name: 'Object Storage',
        slug: 'object-storage',
        categoryId: CAT_DATA,
        computeType: 'VIRTUAL',
      };
      prismaMock.product.findUnique.mockResolvedValue(null);
      prismaMock.category.findUnique.mockResolvedValue({ id: CAT_DATA, slug: 'data' });

      const app = createApp();
      const res = await request(app).post('/api/products').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('computeType can only be set for Compute category');
    });

    it('allows null computeType for non-Compute category', async () => {
      const payload = {
        name: 'Object Storage',
        slug: 'object-storage',
        categoryId: CAT_DATA,
      };
      prismaMock.product.findUnique.mockResolvedValue(null);
      prismaMock.category.findUnique.mockResolvedValue({ id: CAT_DATA, slug: 'data' });
      prismaMock.product.create.mockResolvedValue({
        id: PROD2,
        ...payload,
        computeType: null,
        category: { id: CAT_DATA, name: 'Data', slug: 'data' },
        variants: [],
        dependencies: [],
        dependentProducts: [],
        _count: { variants: 0 },
      });

      const app = createApp();
      const res = await request(app).post('/api/products').send(payload);

      expect(res.status).toBe(201);
      expect(res.body.computeType).toBeNull();
    });

    it('rejects duplicate slug', async () => {
      const payload = { name: 'VM', slug: 'virtual-machine', categoryId: CAT_COMPUTE };
      prismaMock.product.findUnique.mockResolvedValue({ id: PROD1, slug: 'virtual-machine' });

      const app = createApp();
      const res = await request(app).post('/api/products').send(payload);

      expect(res.status).toBe(409);
    });
  });

  describe('PATCH /api/products/:id', () => {
    it('updates computeType for Compute product', async () => {
      prismaMock.product.findUnique.mockResolvedValue({
        id: PROD1,
        category: { id: CAT_COMPUTE, slug: 'compute' },
      });
      prismaMock.product.update.mockResolvedValue({
        id: PROD1,
        name: 'Virtual Machine',
        slug: 'virtual-machine',
        computeType: 'PHYSICAL',
        category: { id: CAT_COMPUTE, name: 'Compute', slug: 'compute' },
        variants: [],
        dependencies: [],
        dependentProducts: [],
        _count: { variants: 0 },
      });

      const app = createApp();
      const res = await request(app).patch(`/api/products/${PROD1}`).send({ computeType: 'PHYSICAL' });

      expect(res.status).toBe(200);
      expect(res.body.computeType).toBe('PHYSICAL');
    });

    it('clears computeType when set to null', async () => {
      prismaMock.product.findUnique.mockResolvedValue({
        id: PROD1,
        category: { id: CAT_COMPUTE, slug: 'compute' },
      });
      prismaMock.product.update.mockResolvedValue({
        id: PROD1,
        name: 'Virtual Machine',
        slug: 'virtual-machine',
        computeType: null,
        category: { id: CAT_COMPUTE, name: 'Compute', slug: 'compute' },
        variants: [],
        dependencies: [],
        dependentProducts: [],
        _count: { variants: 0 },
      });

      const app = createApp();
      const res = await request(app).patch(`/api/products/${PROD1}`).send({ computeType: null });

      expect(res.status).toBe(200);
      expect(res.body.computeType).toBeNull();
    });
  });

  describe('DELETE /api/products/:id', () => {
    it('blocks deletion when variants exist', async () => {
      prismaMock.product.findUnique.mockResolvedValue({
        id: PROD1,
        _count: { variants: 2, dependencies: 0, dependentProducts: 0, forecastLines: 0, instances: 0 },
      });

      const app = createApp();
      const res = await request(app).delete(`/api/products/${PROD1}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('variants');
    });

    it('blocks deletion when instances exist', async () => {
      prismaMock.product.findUnique.mockResolvedValue({
        id: PROD1,
        _count: { variants: 0, dependencies: 0, dependentProducts: 0, forecastLines: 0, instances: 3 },
      });

      const app = createApp();
      const res = await request(app).delete(`/api/products/${PROD1}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('instances');
    });

    it('deletes product with no relationships', async () => {
      prismaMock.product.findUnique.mockResolvedValue({
        id: PROD1,
        _count: { variants: 0, dependencies: 0, dependentProducts: 0, forecastLines: 0, instances: 0 },
      });
      prismaMock.product.delete.mockResolvedValue({});

      const app = createApp();
      const res = await request(app).delete(`/api/products/${PROD1}`);

      expect(res.status).toBe(204);
    });
  });
});
