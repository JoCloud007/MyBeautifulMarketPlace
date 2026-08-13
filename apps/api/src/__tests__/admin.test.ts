import request from 'supertest';
import express from 'express';
import { adminRoutes } from '../routes/admin';

var prismaMock: any = {};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => prismaMock),
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation Error',
        details: err.errors.map((e: any) => ({ path: e.path.join('.'), message: e.message })),
      });
    }
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Conflict', message: 'Duplicate record' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Not Found', message: err.meta?.cause || 'Record not found' });
    }
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
  });
  return app;
}

const P1 = '11111111-1111-1111-1111-111111111111';
const C1 = '22222222-2222-2222-2222-222222222222';
const FL1 = '33333333-3333-3333-3333-333333333333';
const D1 = '44444444-4444-4444-4444-444444444444';
const U1 = '55555555-5555-5555-5555-555555555555';
const AZ1 = '66666666-6666-6666-6666-666666666666';

describe('Admin Routes', () => {
  beforeEach(() => {
    prismaMock.product = {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    prismaMock.category = {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    prismaMock.forecast = {
      count: jest.fn(),
      findMany: jest.fn(),
    };
    prismaMock.user = {
      count: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    prismaMock.flavor = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    prismaMock.dependency = {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    prismaMock.availabilityZone = {
      count: jest.fn(),
      findMany: jest.fn(),
    };
    prismaMock.productAvailabilityZone = {
      deleteMany: jest.fn(),
    };
    prismaMock.$transaction = jest.fn(async (fn: any) => fn(prismaMock));
    jest.clearAllMocks();
  });

  describe('GET /api/admin/dashboard', () => {
    it('should return counts and recent forecasts', async () => {
      prismaMock.product.count.mockResolvedValue(8);
      prismaMock.category.count.mockResolvedValue(4);
      prismaMock.forecast.count.mockResolvedValue(3);
      prismaMock.user.count.mockResolvedValue(2);
      prismaMock.availabilityZone.count.mockResolvedValue(5);
      prismaMock.forecast.findMany.mockResolvedValue([
        { id: 'f1', lines: [{ product: { name: 'VM' }, flavor: { name: 'Small' } }] },
      ]);

      const app = createApp();
      const res = await request(app).get('/api/admin/dashboard');

      expect(res.status).toBe(200);
      expect(res.body.counts).toEqual({ products: 8, categories: 4, forecasts: 3, users: 2, availabilityZones: 5 });
      expect(res.body.recentForecasts).toHaveLength(1);
    });
  });

  describe('GET /api/admin/products', () => {
    it('should list products with category, flavors and forecast count', async () => {
      const products = [
        { id: P1, name: 'VM', category: { id: C1, name: 'Compute' }, flavors: [], availabilityZones: [], _count: { forecastLines: 2 } },
      ];
      prismaMock.product.findMany.mockResolvedValue(products);

      const app = createApp();
      const res = await request(app).get('/api/admin/products');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(products);
    });
  });

  describe('POST /api/admin/products', () => {
    it('should create a product', async () => {
      const payload = { name: 'New VM', slug: 'new-vm', categoryId: C1, description: 'desc' };
      const created = { id: 'p-new', ...payload, category: { id: C1 }, flavors: [], availabilityZones: [] };
      prismaMock.product.findUnique.mockResolvedValue(null);
      prismaMock.product.create.mockResolvedValue(created);

      const app = createApp();
      const res = await request(app).post('/api/admin/products').send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(created);
    });

    it('should reject missing name', async () => {
      const payload = { slug: 'no-name', categoryId: C1 };

      const app = createApp();
      const res = await request(app).post('/api/admin/products').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject invalid slug format', async () => {
      const payload = { name: 'Bad', slug: 'bad slug!', categoryId: C1 };

      const app = createApp();
      const res = await request(app).post('/api/admin/products').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('PATCH /api/admin/products/:id', () => {
    it('should update a product', async () => {
      const updated = { id: P1, name: 'Updated VM', category: { id: C1 }, flavors: [], availabilityZones: [] };
      prismaMock.product.findUnique.mockResolvedValue(null);
      prismaMock.product.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app).patch(`/api/admin/products/${P1}`).send({ name: 'Updated VM' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated VM');
    });
  });

  describe('DELETE /api/admin/products/:id', () => {
    it('should delete a product', async () => {
      prismaMock.product.findUnique.mockResolvedValue({
        id: P1,
        _count: { flavors: 0, dependencies: 0, dependentProducts: 0, forecastLines: 0 },
      });
      prismaMock.product.delete.mockResolvedValue({});

      const app = createApp();
      const res = await request(app).delete(`/api/admin/products/${P1}`);

      expect(res.status).toBe(204);
    });
  });

  describe('POST /api/admin/products/:id/flavors', () => {
    it('should create a flavor under a product', async () => {
      const payload = { name: 'Tiny', vcpu: 1, ramGb: 2 };
      const created = { id: 'fl-new', ...payload, productId: P1 };
      prismaMock.product.findUnique.mockResolvedValue({ id: P1 });
      prismaMock.flavor.create.mockResolvedValue(created);

      const app = createApp();
      const res = await request(app).post(`/api/admin/products/${P1}/flavors`).send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(created);
      expect(prismaMock.flavor.create).toHaveBeenCalledWith({
        data: { ...payload, productId: P1 },
      });
    });

    it('should reject negative vcpu', async () => {
      const payload = { name: 'Bad', vcpu: -1, ramGb: 2 };

      const app = createApp();
      const res = await request(app).post(`/api/admin/products/${P1}/flavors`).send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('GET /api/admin/categories', () => {
    it('should list categories with product count', async () => {
      const categories = [
        { id: C1, name: 'Compute', slug: 'compute', _count: { products: 3 } },
      ];
      prismaMock.category.findMany.mockResolvedValue(categories);

      const app = createApp();
      const res = await request(app).get('/api/admin/categories');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(categories);
    });
  });

  describe('POST /api/admin/categories', () => {
    it('should create a category', async () => {
      const payload = { name: 'Network', slug: 'network', description: 'Net' };
      const created = { id: 'c-new', ...payload, _count: { products: 0 } };
      prismaMock.category.findUnique.mockResolvedValue(null);
      prismaMock.category.create.mockResolvedValue(created);

      const app = createApp();
      const res = await request(app).post('/api/admin/categories').send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(created);
    });
  });

  describe('PATCH /api/admin/categories/:id', () => {
    it('should update a category', async () => {
      const updated = { id: C1, name: 'Compute', slug: 'compute', description: 'Updated', _count: { products: 3 } };
      prismaMock.category.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app).patch(`/api/admin/categories/${C1}`).send({ description: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.description).toBe('Updated');
    });
  });

  describe('DELETE /api/admin/categories/:id', () => {
    it('should delete a category', async () => {
      prismaMock.category.findUnique.mockResolvedValue({ id: C1, _count: { products: 0 } });
      prismaMock.category.delete.mockResolvedValue({});

      const app = createApp();
      const res = await request(app).delete(`/api/admin/categories/${C1}`);

      expect(res.status).toBe(204);
    });
  });

  describe('GET /api/admin/flavors', () => {
    it('should list flavors with product and forecast count', async () => {
      const flavors = [
        { id: FL1, name: 'Small', product: { id: P1, category: { id: C1 } }, _count: { forecastLines: 1 } },
      ];
      prismaMock.flavor.findMany.mockResolvedValue(flavors);

      const app = createApp();
      const res = await request(app).get('/api/admin/flavors');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(flavors);
    });
  });

  describe('PATCH /api/admin/flavors/:id', () => {
    it('should update a flavor', async () => {
      const updated = { id: FL1, name: 'Small', vcpu: 4, ramGb: 8, product: { id: P1, category: { id: C1 } } };
      prismaMock.flavor.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app).patch(`/api/admin/flavors/${FL1}`).send({ vcpu: 4 });

      expect(res.status).toBe(200);
      expect(res.body.vcpu).toBe(4);
    });
  });

  describe('DELETE /api/admin/flavors/:id', () => {
    it('should delete a flavor', async () => {
      prismaMock.flavor.findUnique.mockResolvedValue({ id: FL1, _count: { forecastLines: 0 } });
      prismaMock.flavor.delete.mockResolvedValue({});

      const app = createApp();
      const res = await request(app).delete(`/api/admin/flavors/${FL1}`);

      expect(res.status).toBe(204);
    });
  });

  describe('GET /api/admin/dependencies', () => {
    it('should list dependencies with product and dependsOn', async () => {
      const deps = [
        {
          id: D1,
          product: { id: P1, category: { id: C1 } },
          dependsOn: { id: 'p2', category: { id: 'c2' } },
          type: 'REQUIRED',
        },
      ];
      prismaMock.dependency.findMany.mockResolvedValue(deps);

      const app = createApp();
      const res = await request(app).get('/api/admin/dependencies');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(deps);
    });
  });

  describe('POST /api/admin/dependencies', () => {
    it('should create a dependency', async () => {
      const payload = { productId: P1, dependsOnId: 'p2', type: 'RECOMMENDED', description: 'Link' };
      const created = { id: 'd-new', ...payload, product: { id: P1 }, dependsOn: { id: 'p2' } };
      prismaMock.dependency.create.mockResolvedValue(created);

      const app = createApp();
      const res = await request(app).post('/api/admin/dependencies').send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(created);
    });

    it('should reject invalid dependency type', async () => {
      const payload = { productId: P1, dependsOnId: 'p2', type: 'OPTIONAL' };

      const app = createApp();
      const res = await request(app).post('/api/admin/dependencies').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('PATCH /api/admin/dependencies/:id', () => {
    it('should update a dependency type', async () => {
      const updated = { id: D1, productId: P1, dependsOnId: 'p2', type: 'REQUIRED', product: { id: P1 }, dependsOn: { id: 'p2' } };
      prismaMock.dependency.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app).patch(`/api/admin/dependencies/${D1}`).send({ type: 'REQUIRED' });

      expect(res.status).toBe(200);
      expect(res.body.type).toBe('REQUIRED');
    });
  });

  describe('DELETE /api/admin/dependencies/:id', () => {
    it('should delete a dependency', async () => {
      prismaMock.dependency.delete.mockResolvedValue({});

      const app = createApp();
      const res = await request(app).delete(`/api/admin/dependencies/${D1}`);

      expect(res.status).toBe(204);
    });
  });

  describe('GET /api/admin/forecasts', () => {
    it('should list all forecasts', async () => {
      const forecasts = [
        { id: 'f1', lines: [{ product: { id: P1, category: { id: C1 } }, flavor: { id: FL1 } }] },
      ];
      prismaMock.forecast.findMany.mockResolvedValue(forecasts);

      const app = createApp();
      const res = await request(app).get('/api/admin/forecasts');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(forecasts);
    });
  });

  describe('GET /api/admin/users', () => {
    it('should list users ordered by createdAt desc', async () => {
      const users = [{ id: U1, email: 'a@example.com', name: 'Alice', role: 'ADMIN' }];
      prismaMock.user.findMany.mockResolvedValue(users);

      const app = createApp();
      const res = await request(app).get('/api/admin/users');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(users);
    });
  });

  describe('POST /api/admin/users', () => {
    it('should create a user', async () => {
      const payload = { email: 'new@example.com', name: 'New User', role: 'USER' };
      const created = { id: 'u-new', ...payload };
      prismaMock.user.create.mockResolvedValue(created);

      const app = createApp();
      const res = await request(app).post('/api/admin/users').send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(created);
    });

    it('should reject invalid email', async () => {
      const payload = { email: 'not-email', name: 'Bad' };

      const app = createApp();
      const res = await request(app).post('/api/admin/users').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject empty name', async () => {
      const payload = { email: 'valid@example.com', name: '' };

      const app = createApp();
      const res = await request(app).post('/api/admin/users').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject invalid role', async () => {
      const payload = { email: 'valid@example.com', name: 'Bob', role: 'SUPERUSER' };

      const app = createApp();
      const res = await request(app).post('/api/admin/users').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('PATCH /api/admin/users/:id', () => {
    it('should update a user', async () => {
      const updated = { id: U1, email: 'a@example.com', name: 'Alice Updated', role: 'ADMIN' };
      prismaMock.user.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app).patch(`/api/admin/users/${U1}`).send({ name: 'Alice Updated' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Alice Updated');
    });
  });

  describe('DELETE /api/admin/users/:id', () => {
    it('should delete a user', async () => {
      prismaMock.user.delete.mockResolvedValue({});

      const app = createApp();
      const res = await request(app).delete(`/api/admin/users/${U1}`);

      expect(res.status).toBe(204);
    });
  });
});
