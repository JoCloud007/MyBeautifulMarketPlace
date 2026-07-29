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

describe('Admin Routes', () => {
  beforeEach(() => {
    prismaMock.product = {
      count: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    prismaMock.category = {
      count: jest.fn(),
      findMany: jest.fn(),
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
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    };
    prismaMock.dependency = {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe('GET /api/admin/dashboard', () => {
    it('should return counts and recent forecasts', async () => {
      prismaMock.product.count.mockResolvedValue(8);
      prismaMock.category.count.mockResolvedValue(4);
      prismaMock.forecast.count.mockResolvedValue(3);
      prismaMock.user.count.mockResolvedValue(2);
      prismaMock.forecast.findMany.mockResolvedValue([
        { id: 'f1', product: { name: 'VM' }, flavor: { name: 'Small' } },
      ]);

      const app = createApp();
      const res = await request(app).get('/api/admin/dashboard');

      expect(res.status).toBe(200);
      expect(res.body.counts).toEqual({ products: 8, categories: 4, forecasts: 3, users: 2 });
      expect(res.body.recentForecasts).toHaveLength(1);
      expect(prismaMock.forecast.findMany).toHaveBeenCalledWith({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { product: true, flavor: true },
      });
    });
  });

  describe('GET /api/admin/products', () => {
    it('should list products with category, flavors and forecast count', async () => {
      const products = [
        { id: 'p1', name: 'VM', category: { id: 'c1', name: 'Compute' }, flavors: [], _count: { forecasts: 2 } },
      ];
      prismaMock.product.findMany.mockResolvedValue(products);

      const app = createApp();
      const res = await request(app).get('/api/admin/products');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(products);
      expect(prismaMock.product.findMany).toHaveBeenCalledWith({
        include: { category: true, flavors: true, _count: { select: { forecasts: true } } },
        orderBy: { updatedAt: 'desc' },
      });
    });
  });

  describe('POST /api/admin/products', () => {
    it('should create a product', async () => {
      const payload = { name: 'New VM', slug: 'new-vm', categoryId: 'c1', description: 'desc' };
      const created = { id: 'p-new', ...payload, category: { id: 'c1' }, flavors: [] };
      prismaMock.product.create.mockResolvedValue(created);

      const app = createApp();
      const res = await request(app).post('/api/admin/products').send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(created);
    });

    it('should reject missing name', async () => {
      const payload = { slug: 'no-name', categoryId: 'c1' };

      const app = createApp();
      const res = await request(app).post('/api/admin/products').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject invalid slug format', async () => {
      const payload = { name: 'Bad', slug: 'bad slug!', categoryId: 'c1' };

      const app = createApp();
      const res = await request(app).post('/api/admin/products').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('PATCH /api/admin/products/:id', () => {
    it('should update a product', async () => {
      const updated = { id: 'p1', name: 'Updated VM', category: { id: 'c1' }, flavors: [] };
      prismaMock.product.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app).patch('/api/admin/products/p1').send({ name: 'Updated VM' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated VM');
    });
  });

  describe('DELETE /api/admin/products/:id', () => {
    it('should delete a product', async () => {
      prismaMock.product.delete.mockResolvedValue({});

      const app = createApp();
      const res = await request(app).delete('/api/admin/products/p1');

      expect(res.status).toBe(204);
      expect(prismaMock.product.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    });
  });

  describe('POST /api/admin/products/:id/flavors', () => {
    it('should create a flavor under a product', async () => {
      const payload = { name: 'Tiny', vcpu: 1, ramGb: 2 };
      const created = { id: 'fl-new', ...payload, productId: 'p1' };
      prismaMock.flavor.create.mockResolvedValue(created);

      const app = createApp();
      const res = await request(app).post('/api/admin/products/p1/flavors').send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(created);
      expect(prismaMock.flavor.create).toHaveBeenCalledWith({
        data: { ...payload, productId: 'p1' },
      });
    });

    it('should reject negative vcpu', async () => {
      const payload = { name: 'Bad', vcpu: -1, ramGb: 2 };

      const app = createApp();
      const res = await request(app).post('/api/admin/products/p1/flavors').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('GET /api/admin/categories', () => {
    it('should list categories with product count', async () => {
      const categories = [
        { id: 'c1', name: 'Compute', slug: 'compute', _count: { products: 3 } },
      ];
      prismaMock.category.findMany.mockResolvedValue(categories);

      const app = createApp();
      const res = await request(app).get('/api/admin/categories');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(categories);
      expect(prismaMock.category.findMany).toHaveBeenCalledWith({
        include: { _count: { select: { products: true } } },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('POST /api/admin/categories', () => {
    it('should create a category', async () => {
      const payload = { name: 'Network', slug: 'network', description: 'Net' };
      const created = { id: 'c-new', ...payload, _count: { products: 0 } };
      prismaMock.category.create.mockResolvedValue(created);

      const app = createApp();
      const res = await request(app).post('/api/admin/categories').send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(created);
    });
  });

  describe('PATCH /api/admin/categories/:id', () => {
    it('should update a category', async () => {
      const updated = { id: 'c1', name: 'Compute', slug: 'compute', description: 'Updated', _count: { products: 3 } };
      prismaMock.category.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app).patch('/api/admin/categories/c1').send({ description: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.description).toBe('Updated');
    });
  });

  describe('DELETE /api/admin/categories/:id', () => {
    it('should delete a category', async () => {
      prismaMock.category.delete.mockResolvedValue({});

      const app = createApp();
      const res = await request(app).delete('/api/admin/categories/c1');

      expect(res.status).toBe(204);
    });
  });

  describe('GET /api/admin/flavors', () => {
    it('should list flavors with product and forecast count', async () => {
      const flavors = [
        { id: 'fl1', name: 'Small', product: { id: 'p1', category: { id: 'c1' } }, _count: { forecasts: 1 } },
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
      const updated = { id: 'fl1', name: 'Small', vcpu: 4, ramGb: 8, product: { id: 'p1', category: { id: 'c1' } } };
      prismaMock.flavor.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app).patch('/api/admin/flavors/fl1').send({ vcpu: 4 });

      expect(res.status).toBe(200);
      expect(res.body.vcpu).toBe(4);
    });
  });

  describe('DELETE /api/admin/flavors/:id', () => {
    it('should delete a flavor', async () => {
      prismaMock.flavor.delete.mockResolvedValue({});

      const app = createApp();
      const res = await request(app).delete('/api/admin/flavors/fl1');

      expect(res.status).toBe(204);
    });
  });

  describe('GET /api/admin/dependencies', () => {
    it('should list dependencies with product and dependsOn', async () => {
      const deps = [
        {
          id: 'd1',
          product: { id: 'p1', category: { id: 'c1' } },
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
      const payload = { productId: 'p1', dependsOnId: 'p2', type: 'RECOMMENDED', description: 'Link' };
      const created = { id: 'd-new', ...payload, product: { id: 'p1' }, dependsOn: { id: 'p2' } };
      prismaMock.dependency.create.mockResolvedValue(created);

      const app = createApp();
      const res = await request(app).post('/api/admin/dependencies').send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(created);
    });

    it('should reject invalid dependency type', async () => {
      const payload = { productId: 'p1', dependsOnId: 'p2', type: 'OPTIONAL' };

      const app = createApp();
      const res = await request(app).post('/api/admin/dependencies').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('PATCH /api/admin/dependencies/:id', () => {
    it('should update a dependency type', async () => {
      const updated = { id: 'd1', productId: 'p1', dependsOnId: 'p2', type: 'REQUIRED', product: { id: 'p1' }, dependsOn: { id: 'p2' } };
      prismaMock.dependency.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app).patch('/api/admin/dependencies/d1').send({ type: 'REQUIRED' });

      expect(res.status).toBe(200);
      expect(res.body.type).toBe('REQUIRED');
    });
  });

  describe('DELETE /api/admin/dependencies/:id', () => {
    it('should delete a dependency', async () => {
      prismaMock.dependency.delete.mockResolvedValue({});

      const app = createApp();
      const res = await request(app).delete('/api/admin/dependencies/d1');

      expect(res.status).toBe(204);
    });
  });

  describe('GET /api/admin/forecasts', () => {
    it('should list all forecasts', async () => {
      const forecasts = [
        { id: 'f1', product: { id: 'p1', category: { id: 'c1' } }, flavor: { id: 'fl1' } },
      ];
      prismaMock.forecast.findMany.mockResolvedValue(forecasts);

      const app = createApp();
      const res = await request(app).get('/api/admin/forecasts');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(forecasts);
      expect(prismaMock.forecast.findMany).toHaveBeenCalledWith({
        include: { product: { include: { category: true } }, flavor: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('GET /api/admin/users', () => {
    it('should list users ordered by createdAt desc', async () => {
      const users = [{ id: 'u1', email: 'a@example.com', name: 'Alice', role: 'ADMIN' }];
      prismaMock.user.findMany.mockResolvedValue(users);

      const app = createApp();
      const res = await request(app).get('/api/admin/users');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(users);
      expect(prismaMock.user.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } });
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
      const updated = { id: 'u1', email: 'a@example.com', name: 'Alice Updated', role: 'ADMIN' };
      prismaMock.user.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app).patch('/api/admin/users/u1').send({ name: 'Alice Updated' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Alice Updated');
    });
  });

  describe('DELETE /api/admin/users/:id', () => {
    it('should delete a user', async () => {
      prismaMock.user.delete.mockResolvedValue({});

      const app = createApp();
      const res = await request(app).delete('/api/admin/users/u1');

      expect(res.status).toBe(204);
    });
  });
});
