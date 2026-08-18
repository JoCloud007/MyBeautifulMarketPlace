import request from 'supertest';
import express from 'express';
import { osRoutes } from '../routes/os';
import { variantRoutes } from '../routes/variants';
import { productRoutes } from '../routes/products';
import { flavorRoutes } from '../routes/flavors';

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
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/os', osRoutes);
  app.use('/api/variants', variantRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/flavors', flavorRoutes);
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

const OS1 = '11111111-1111-1111-1111-111111111111';
const OS2 = '22222222-2222-2222-2222-222222222222';
const V1 = '33333333-3333-3333-3333-333333333333';
const P1 = '44444444-4444-4444-4444-444444444444';
const PV1 = '55555555-5555-5555-5555-555555555555';
const FL1 = '66666666-6666-6666-6666-666666666666';
const AZ1 = '77777777-7777-7777-7777-777777777777';
const CAT_COMPUTE = '88888888-8888-8888-8888-888888888888';
const CAT_OTHER = '99999999-9999-9999-9999-999999999999';

describe('Admin Dashboard — Refonte Produit IaaS', () => {
  beforeEach(() => {
    prismaMock.operatingSystem = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    prismaMock.osVersion = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    prismaMock.product = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    prismaMock.productVariant = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    prismaMock.productVariantAvailabilityZone = {
      deleteMany: jest.fn(),
    };
    prismaMock.flavor = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    prismaMock.category = {
      findUnique: jest.fn(),
    };
    prismaMock.availabilityZone = {
      findMany: jest.fn(),
    };
    prismaMock.$transaction = jest.fn(async (fn: any) => fn(prismaMock));
    jest.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════
  // OS ROUTES
  // ═══════════════════════════════════════════════════════════════

  describe('GET /api/os', () => {
    it('should list all operating systems with versions and counts', async () => {
      const osList = [
        {
          id: OS1,
          family: 'WINDOWS',
          name: 'Windows',
          slug: 'windows',
          isActive: true,
          versions: [{ id: V1, version: 'Server 2022', phase: 'NORMAL_SUPPORT' }],
          _count: { versions: 1 },
        },
      ];
      prismaMock.operatingSystem.findMany.mockResolvedValue(osList);

      const app = createApp();
      const res = await request(app).get('/api/os');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(osList);
      expect(prismaMock.operatingSystem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            versions: expect.anything(),
            _count: { select: { versions: true } },
          }),
        })
      );
    });
  });

  describe('POST /api/os', () => {
    it('should create an operating system', async () => {
      const payload = { family: 'DEBIAN', name: 'Debian', slug: 'debian', isActive: true };
      const created = { id: OS2, ...payload, versions: [] };
      prismaMock.operatingSystem.findUnique.mockResolvedValue(null);
      prismaMock.operatingSystem.create.mockResolvedValue(created);

      const app = createApp();
      const res = await request(app).post('/api/os').send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(created);
    });

    it('should reject duplicate slug', async () => {
      const payload = { family: 'WINDOWS', name: 'Windows', slug: 'windows' };
      prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: OS1, ...payload });

      const app = createApp();
      const res = await request(app).post('/api/os').send(payload);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already exists');
    });

    it('should reject invalid slug format', async () => {
      const payload = { family: 'BAD', name: 'Bad', slug: 'bad slug!' };

      const app = createApp();
      const res = await request(app).post('/api/os').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject missing family', async () => {
      const payload = { name: 'NoFamily', slug: 'no-family' };

      const app = createApp();
      const res = await request(app).post('/api/os').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('GET /api/os/:id', () => {
    it('should return OS detail with versions and variant counts', async () => {
      const os = {
        id: OS1,
        family: 'WINDOWS',
        name: 'Windows',
        slug: 'windows',
        versions: [{ id: V1, version: 'Server 2022' }],
        _count: { versions: 1, variants: 0 },
      };
      prismaMock.operatingSystem.findUnique.mockResolvedValue(os);

      const app = createApp();
      const res = await request(app).get(`/api/os/${OS1}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(os);
    });

    it('should return 404 for unknown OS', async () => {
      prismaMock.operatingSystem.findUnique.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).get(`/api/os/${OS1}`);

      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid UUID', async () => {
      const app = createApp();
      const res = await request(app).get('/api/os/not-a-uuid');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('PUT /api/os/:id', () => {
    it('should update an OS', async () => {
      const updated = { id: OS1, family: 'WINDOWS', name: 'Windows Server', slug: 'windows', isActive: true, versions: [] };
      prismaMock.operatingSystem.findUnique.mockResolvedValue(null);
      prismaMock.operatingSystem.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app).put(`/api/os/${OS1}`).send({ name: 'Windows Server' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Windows Server');
    });

    it('should reject duplicate slug on update', async () => {
      prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: OS2, slug: 'debian' });

      const app = createApp();
      const res = await request(app).put(`/api/os/${OS1}`).send({ slug: 'debian' });

      expect(res.status).toBe(409);
    });
  });

  describe('DELETE /api/os/:id', () => {
    it('should delete an OS with no variant usage', async () => {
      prismaMock.operatingSystem.findUnique.mockResolvedValue({
        id: OS1,
        versions: [{ _count: { variants: 0 } }],
      });
      prismaMock.operatingSystem.delete.mockResolvedValue({});

      const app = createApp();
      const res = await request(app).delete(`/api/os/${OS1}`);

      expect(res.status).toBe(204);
    });

    it('should block deletion if versions have variants', async () => {
      prismaMock.operatingSystem.findUnique.mockResolvedValue({
        id: OS1,
        versions: [{ _count: { variants: 2 } }],
      });

      const app = createApp();
      const res = await request(app).delete(`/api/os/${OS1}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('Cannot delete OS');
    });

    it('should return 404 for unknown OS', async () => {
      prismaMock.operatingSystem.findUnique.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).delete(`/api/os/${OS1}`);

      expect(res.status).toBe(404);
    });
  });

  describe('OS Versions CRUD', () => {
    it('GET /api/os/:id/versions should list versions', async () => {
      const versions = [
        { id: V1, osId: OS1, version: 'Server 2022', phase: 'NORMAL_SUPPORT' },
      ];
      prismaMock.osVersion.findMany.mockResolvedValue(versions);

      const app = createApp();
      const res = await request(app).get(`/api/os/${OS1}/versions`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(versions);
    });

    it('POST /api/os/:id/versions should create a version with valid dates', async () => {
      const payload = {
        version: 'Server 2025',
        releaseDate: '2025-01-01T00:00:00Z',
        normalSupportEnd: '2030-01-01T00:00:00Z',
        extendedSupportEnd: '2035-01-01T00:00:00Z',
        eolDate: '2035-01-01T00:00:00Z',
        phase: 'RELEASED',
        isActive: true,
      };
      const created = { id: 'v-new', osId: OS1, ...payload };
      prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: OS1 });
      prismaMock.osVersion.create.mockResolvedValue(created);

      const app = createApp();
      const res = await request(app).post(`/api/os/${OS1}/versions`).send(payload);

      expect(res.status).toBe(201);
      expect(res.body.version).toBe('Server 2025');
    });

    it('POST /api/os/:id/versions should reject out-of-order dates', async () => {
      const payload = {
        version: 'Bad',
        releaseDate: '2030-01-01T00:00:00Z',
        normalSupportEnd: '2025-01-01T00:00:00Z',
        extendedSupportEnd: '2035-01-01T00:00:00Z',
        eolDate: '2035-01-01T00:00:00Z',
      };

      const app = createApp();
      const res = await request(app).post(`/api/os/${OS1}/versions`).send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('POST /api/os/:id/versions should return 404 for unknown OS', async () => {
      prismaMock.operatingSystem.findUnique.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).post(`/api/os/${OS1}/versions`).send({
        version: 'X',
        releaseDate: '2025-01-01T00:00:00Z',
        normalSupportEnd: '2030-01-01T00:00:00Z',
        extendedSupportEnd: '2035-01-01T00:00:00Z',
        eolDate: '2035-01-01T00:00:00Z',
      });

      expect(res.status).toBe(404);
    });

    it('PUT /api/os/:id/versions/:vId should update a version', async () => {
      const updated = { id: V1, osId: OS1, version: 'Server 2022 Updated', phase: 'EXTENDED_SUPPORT' };
      prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: OS1 });
      prismaMock.osVersion.findFirst.mockResolvedValue({ id: V1 });
      prismaMock.osVersion.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app).put(`/api/os/${OS1}/versions/${V1}`).send({ phase: 'EXTENDED_SUPPORT' });

      expect(res.status).toBe(200);
      expect(res.body.phase).toBe('EXTENDED_SUPPORT');
    });

    it('DELETE /api/os/:id/versions/:vId should delete unused version', async () => {
      prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: OS1 });
      prismaMock.osVersion.findFirst.mockResolvedValue({ id: V1, _count: { variants: 0 } });
      prismaMock.osVersion.delete.mockResolvedValue({});

      const app = createApp();
      const res = await request(app).delete(`/api/os/${OS1}/versions/${V1}`);

      expect(res.status).toBe(204);
    });

    it('DELETE /api/os/:id/versions/:vId should block deletion if used in variants', async () => {
      prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: OS1 });
      prismaMock.osVersion.findFirst.mockResolvedValue({ id: V1, _count: { variants: 3 } });

      const app = createApp();
      const res = await request(app).delete(`/api/os/${OS1}/versions/${V1}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('Cannot delete version');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // FLAVOR ROUTES (Global)
  // ═══════════════════════════════════════════════════════════════

  describe('GET /api/flavors', () => {
    it('should list global flavors with usage counts', async () => {
      const flavors = [
        { id: FL1, name: 'Medium', vcpu: 4, ramGb: 8, _count: { variants: 2, forecastLines: 1, instances: 3 } },
      ];
      prismaMock.flavor.findMany.mockResolvedValue(flavors);

      const app = createApp();
      const res = await request(app).get('/api/flavors');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(flavors);
    });
  });

  describe('POST /api/flavors', () => {
    it('should create a global flavor', async () => {
      const payload = { name: 'Large', vcpu: 8, ramGb: 16, description: 'Big' };
      const created = { id: 'fl-new', ...payload };
      prismaMock.flavor.create.mockResolvedValue(created);

      const app = createApp();
      const res = await request(app).post('/api/flavors').send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(created);
    });

    it('should reject negative vcpu', async () => {
      const app = createApp();
      const res = await request(app).post('/api/flavors').send({ name: 'Bad', vcpu: -1, ramGb: 2 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject missing name', async () => {
      const app = createApp();
      const res = await request(app).post('/api/flavors').send({ vcpu: 2, ramGb: 4 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('GET /api/flavors/:id', () => {
    it('should return flavor detail with counts', async () => {
      const flavor = { id: FL1, name: 'Medium', vcpu: 4, ramGb: 8, _count: { variants: 2, forecastLines: 0, instances: 0 } };
      prismaMock.flavor.findUnique.mockResolvedValue(flavor);

      const app = createApp();
      const res = await request(app).get(`/api/flavors/${FL1}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(flavor);
    });

    it('should return 404 for unknown flavor', async () => {
      prismaMock.flavor.findUnique.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).get(`/api/flavors/${FL1}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/flavors/:id', () => {
    it('should update a flavor', async () => {
      const updated = { id: FL1, name: 'Medium+', vcpu: 4, ramGb: 10 };
      prismaMock.flavor.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app).patch(`/api/flavors/${FL1}`).send({ ramGb: 10 });

      expect(res.status).toBe(200);
      expect(res.body.ramGb).toBe(10);
    });
  });

  describe('DELETE /api/flavors/:id', () => {
    it('should delete unused flavor', async () => {
      prismaMock.flavor.findUnique.mockResolvedValue({
        id: FL1,
        _count: { variants: 0, forecastLines: 0, instances: 0 },
      });
      prismaMock.flavor.delete.mockResolvedValue({});

      const app = createApp();
      const res = await request(app).delete(`/api/flavors/${FL1}`);

      expect(res.status).toBe(204);
    });

    it('should block deletion if used in variants', async () => {
      prismaMock.flavor.findUnique.mockResolvedValue({
        id: FL1,
        _count: { variants: 2, forecastLines: 0, instances: 0 },
      });

      const app = createApp();
      const res = await request(app).delete(`/api/flavors/${FL1}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('variants');
    });

    it('should block deletion if used in forecasts', async () => {
      prismaMock.flavor.findUnique.mockResolvedValue({
        id: FL1,
        _count: { variants: 0, forecastLines: 1, instances: 0 },
      });

      const app = createApp();
      const res = await request(app).delete(`/api/flavors/${FL1}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('forecasts');
    });

    it('should block deletion if used in instances', async () => {
      prismaMock.flavor.findUnique.mockResolvedValue({
        id: FL1,
        _count: { variants: 0, forecastLines: 0, instances: 1 },
      });

      const app = createApp();
      const res = await request(app).delete(`/api/flavors/${FL1}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('instances');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // PRODUCT ROUTES (Refactored)
  // ═══════════════════════════════════════════════════════════════

  describe('GET /api/products', () => {
    it('should list products with category, variants, and counts', async () => {
      const products = [
        {
          id: P1,
          name: 'Compute IaaS',
          slug: 'compute-iaas',
          category: { id: CAT_COMPUTE, name: 'Compute', slug: 'compute' },
          computeType: 'VIRTUAL',
          variants: [],
          _count: { variants: 0, instances: 0 },
        },
      ];
      prismaMock.product.findMany.mockResolvedValue(products);

      const app = createApp();
      const res = await request(app).get('/api/products');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(products);
    });

    it('should filter by category slug', async () => {
      prismaMock.product.findMany.mockResolvedValue([]);

      const app = createApp();
      const res = await request(app).get('/api/products?category=compute');

      expect(res.status).toBe(200);
      expect(prismaMock.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: { slug: 'compute' },
          }),
        })
      );
    });

    it('should filter by search term', async () => {
      prismaMock.product.findMany.mockResolvedValue([]);

      const app = createApp();
      const res = await request(app).get('/api/products?search=iaas');

      expect(res.status).toBe(200);
      expect(prismaMock.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: expect.anything() }),
              expect.objectContaining({ description: expect.anything() }),
            ]),
          }),
        })
      );
    });
  });

  describe('POST /api/products', () => {
    it('should create a Compute product with computeType', async () => {
      const payload = {
        name: 'Compute IaaS',
        slug: 'compute-iaas',
        categoryId: CAT_COMPUTE,
        computeType: 'VIRTUAL',
        description: 'IaaS compute',
      };
      const created = {
        id: P1,
        ...payload,
        category: { id: CAT_COMPUTE, name: 'Compute', slug: 'compute' },
        variants: [],
        _count: { variants: 0 },
      };
      prismaMock.product.findUnique.mockResolvedValue(null);
      prismaMock.category.findUnique.mockResolvedValue({ id: CAT_COMPUTE, slug: 'compute' });
      prismaMock.product.create.mockResolvedValue(created);

      const app = createApp();
      const res = await request(app).post('/api/products').send(payload);

      expect(res.status).toBe(201);
      expect(res.body.computeType).toBe('VIRTUAL');
    });

    it('should reject computeType for non-Compute category', async () => {
      const payload = {
        name: 'Storage',
        slug: 'storage',
        categoryId: CAT_OTHER,
        computeType: 'VIRTUAL',
      };
      prismaMock.category.findUnique.mockResolvedValue({ id: CAT_OTHER, slug: 'storage' });

      const app = createApp();
      const res = await request(app).post('/api/products').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('computeType');
    });

    it('should allow product without computeType for non-Compute category', async () => {
      const payload = {
        name: 'Storage',
        slug: 'storage',
        categoryId: CAT_OTHER,
        description: 'Object storage',
      };
      prismaMock.product.findUnique.mockResolvedValue(null);
      prismaMock.category.findUnique.mockResolvedValue({ id: CAT_OTHER, slug: 'storage' });
      prismaMock.product.create.mockResolvedValue({ id: P1, ...payload, category: { id: CAT_OTHER }, variants: [], _count: { variants: 0 } });

      const app = createApp();
      const res = await request(app).post('/api/products').send(payload);

      expect(res.status).toBe(201);
    });

    it('should reject duplicate slug', async () => {
      const payload = { name: 'Dup', slug: 'dup', categoryId: CAT_COMPUTE };
      prismaMock.product.findUnique.mockResolvedValue({ id: 'existing', slug: 'dup' });

      const app = createApp();
      const res = await request(app).post('/api/products').send(payload);

      expect(res.status).toBe(409);
    });

    it('should reject invalid slug format', async () => {
      const app = createApp();
      const res = await request(app).post('/api/products').send({
        name: 'Bad',
        slug: 'bad slug!',
        categoryId: CAT_COMPUTE,
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('GET /api/products/:slug', () => {
    it('should return product detail with variants', async () => {
      const product = {
        id: P1,
        name: 'Compute IaaS',
        slug: 'compute-iaas',
        category: { id: CAT_COMPUTE, slug: 'compute' },
        computeType: 'VIRTUAL',
        variants: [
          {
            id: PV1,
            name: 'Windows Medium',
            os: { name: 'Windows' },
            osVersion: { version: 'Server 2022' },
            flavor: { name: 'Medium' },
            availabilityZones: [],
          },
        ],
        _count: { variants: 1, instances: 0 },
      };
      prismaMock.product.findUnique.mockResolvedValue(product);

      const app = createApp();
      const res = await request(app).get('/api/products/compute-iaas');

      expect(res.status).toBe(200);
      expect(res.body.variants).toHaveLength(1);
    });

    it('should return 404 for unknown product', async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).get('/api/products/unknown');

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/products/:id', () => {
    it('should update product computeType when category is Compute', async () => {
      const existing = { id: P1, categoryId: CAT_COMPUTE, computeType: 'VIRTUAL' };
      const updated = { id: P1, name: 'Updated', category: { id: CAT_COMPUTE }, computeType: 'PHYSICAL', variants: [], _count: { variants: 0 } };
      prismaMock.product.findUnique.mockResolvedValue(existing);
      prismaMock.category.findUnique.mockResolvedValue({ id: CAT_COMPUTE, slug: 'compute' });
      prismaMock.product.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app).patch(`/api/products/${P1}`).send({ computeType: 'PHYSICAL' });

      expect(res.status).toBe(200);
      expect(res.body.computeType).toBe('PHYSICAL');
    });

    it('should reject setting computeType when category is not Compute', async () => {
      const existing = { id: P1, categoryId: CAT_OTHER, computeType: null };
      prismaMock.product.findUnique.mockResolvedValue(existing);
      prismaMock.category.findUnique.mockResolvedValue({ id: CAT_OTHER, slug: 'storage' });

      const app = createApp();
      const res = await request(app).patch(`/api/products/${P1}`).send({ computeType: 'VIRTUAL' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('computeType');
    });
  });

  describe('DELETE /api/products/:id', () => {
    it('should delete product with no dependencies', async () => {
      prismaMock.product.findUnique.mockResolvedValue({
        id: P1,
        _count: { variants: 0, dependencies: 0, dependentProducts: 0, forecastLines: 0, instances: 0, upgradeFrom: 0, upgradeTo: 0 },
      });
      prismaMock.product.delete.mockResolvedValue({});

      const app = createApp();
      const res = await request(app).delete(`/api/products/${P1}`);

      expect(res.status).toBe(204);
    });

    it('should block deletion if product has variants', async () => {
      prismaMock.product.findUnique.mockResolvedValue({
        id: P1,
        _count: { variants: 2, dependencies: 0, dependentProducts: 0, forecastLines: 0, instances: 0, upgradeFrom: 0, upgradeTo: 0 },
      });

      const app = createApp();
      const res = await request(app).delete(`/api/products/${P1}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('variants');
    });

    it('should block deletion if product has instances', async () => {
      prismaMock.product.findUnique.mockResolvedValue({
        id: P1,
        _count: { variants: 0, dependencies: 0, dependentProducts: 0, forecastLines: 0, instances: 1, upgradeFrom: 0, upgradeTo: 0 },
      });

      const app = createApp();
      const res = await request(app).delete(`/api/products/${P1}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('instances');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // VARIANT ROUTES
  // ═══════════════════════════════════════════════════════════════

  describe('GET /api/products/:id/variants', () => {
    it('should list variants for a product', async () => {
      const variants = [
        {
          id: PV1,
          productId: P1,
          name: 'Windows Medium',
          os: { name: 'Windows' },
          osVersion: { version: 'Server 2022' },
          flavor: { name: 'Medium' },
          availabilityZones: [],
          continuityLevel: null,
          _count: { instances: 0 },
        },
      ];
      prismaMock.productVariant.findMany.mockResolvedValue(variants);

      const app = createApp();
      const res = await request(app).get(`/api/products/${P1}/variants`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Windows Medium');
    });
  });

  describe('POST /api/products/:id/variants', () => {
    it('should create a variant for Compute product', async () => {
      const payload = {
        name: 'Windows Medium',
        osId: OS1,
        osVersionId: V1,
        flavorId: FL1,
        availabilityZoneIds: [AZ1],
        continuityLevelId: null,
        isActive: true,
      };
      const created = {
        id: PV1,
        productId: P1,
        ...payload,
        os: { name: 'Windows' },
        osVersion: { version: 'Server 2022' },
        flavor: { name: 'Medium' },
        availabilityZones: [{ availabilityZone: { code: 'eu-west-1a' } }],
        continuityLevel: null,
      };
      prismaMock.product.findUnique.mockResolvedValue({ id: P1, category: { slug: 'compute' } });
      prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: OS1 });
      prismaMock.osVersion.findFirst.mockResolvedValue({ id: V1, osId: OS1 });
      prismaMock.flavor.findUnique.mockResolvedValue({ id: FL1 });
      prismaMock.availabilityZone.findMany.mockResolvedValue([{ id: AZ1 }]);
      prismaMock.productVariant.create.mockResolvedValue(created);

      const app = createApp();
      const res = await request(app).post(`/api/products/${P1}/variants`).send(payload);

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Windows Medium');
    });

    it('should reject variant creation for non-Compute product', async () => {
      prismaMock.product.findUnique.mockResolvedValue({ id: P1, category: { slug: 'storage' } });

      const app = createApp();
      const res = await request(app).post(`/api/products/${P1}/variants`).send({
        name: 'Bad',
        osId: OS1,
        osVersionId: V1,
        flavorId: FL1,
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Compute');
    });

    it('should reject variant with non-existent OS', async () => {
      prismaMock.product.findUnique.mockResolvedValue({ id: P1, category: { slug: 'compute' } });
      prismaMock.operatingSystem.findUnique.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).post(`/api/products/${P1}/variants`).send({
        name: 'Bad',
        osId: OS1,
        osVersionId: V1,
        flavorId: FL1,
      });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Operating system not found');
    });

    it('should reject variant with OS version not belonging to OS', async () => {
      prismaMock.product.findUnique.mockResolvedValue({ id: P1, category: { slug: 'compute' } });
      prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: OS1 });
      prismaMock.osVersion.findFirst.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).post(`/api/products/${P1}/variants`).send({
        name: 'Bad',
        osId: OS1,
        osVersionId: V1,
        flavorId: FL1,
      });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('OS version not found');
    });

    it('should reject variant with non-existent flavor', async () => {
      prismaMock.product.findUnique.mockResolvedValue({ id: P1, category: { slug: 'compute' } });
      prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: OS1 });
      prismaMock.osVersion.findFirst.mockResolvedValue({ id: V1, osId: OS1 });
      prismaMock.flavor.findUnique.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).post(`/api/products/${P1}/variants`).send({
        name: 'Bad',
        osId: OS1,
        osVersionId: V1,
        flavorId: FL1,
      });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Flavor not found');
    });

    it('should reject variant with invalid availability zone', async () => {
      prismaMock.product.findUnique.mockResolvedValue({ id: P1, category: { slug: 'compute' } });
      prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: OS1 });
      prismaMock.osVersion.findFirst.mockResolvedValue({ id: V1, osId: OS1 });
      prismaMock.flavor.findUnique.mockResolvedValue({ id: FL1 });
      prismaMock.availabilityZone.findMany.mockResolvedValue([]);

      const app = createApp();
      const res = await request(app).post(`/api/products/${P1}/variants`).send({
        name: 'Bad',
        osId: OS1,
        osVersionId: V1,
        flavorId: FL1,
        availabilityZoneIds: [AZ1],
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('availability zones');
    });

    it('should return 404 for unknown product', async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).post(`/api/products/${P1}/variants`).send({
        name: 'Bad',
        osId: OS1,
        osVersionId: V1,
        flavorId: FL1,
      });

      expect(res.status).toBe(404);
    });

    it('should reject invalid UUID in payload', async () => {
      const app = createApp();
      const res = await request(app).post(`/api/products/${P1}/variants`).send({
        name: 'Bad',
        osId: 'not-a-uuid',
        osVersionId: V1,
        flavorId: FL1,
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('GET /api/variants/:id', () => {
    it('should return variant detail', async () => {
      const variant = {
        id: PV1,
        product: { category: { slug: 'compute' } },
        os: { name: 'Windows' },
        osVersion: { version: 'Server 2022' },
        flavor: { name: 'Medium' },
        availabilityZones: [],
        continuityLevel: null,
        _count: { instances: 0 },
      };
      prismaMock.productVariant.findUnique.mockResolvedValue(variant);

      const app = createApp();
      const res = await request(app).get(`/api/variants/${PV1}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(PV1);
    });

    it('should return 404 for unknown variant', async () => {
      prismaMock.productVariant.findUnique.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).get(`/api/variants/${PV1}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/variants/:id', () => {
    it('should update a variant', async () => {
      const existing = { id: PV1, osId: OS1, osVersionId: V1, flavorId: FL1 };
      const updated = {
        id: PV1,
        name: 'Updated Variant',
        os: { name: 'Windows' },
        osVersion: { version: 'Server 2022' },
        flavor: { name: 'Medium' },
        availabilityZones: [],
        continuityLevel: null,
      };
      prismaMock.productVariant.findUnique.mockResolvedValue(existing);
      prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: OS1 });
      prismaMock.osVersion.findFirst.mockResolvedValue({ id: V1, osId: OS1 });
      prismaMock.flavor.findUnique.mockResolvedValue({ id: FL1 });
      prismaMock.productVariant.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app).put(`/api/variants/${PV1}`).send({ name: 'Updated Variant' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Variant');
    });

    it('should update availability zones by replacing them', async () => {
      const existing = { id: PV1, osId: OS1, osVersionId: V1, flavorId: FL1 };
      const updated = {
        id: PV1,
        name: 'Variant',
        availabilityZones: [{ availabilityZoneId: AZ1 }],
      };
      prismaMock.productVariant.findUnique.mockResolvedValue(existing);
      prismaMock.availabilityZone.findMany.mockResolvedValue([{ id: AZ1 }]);
      prismaMock.productVariantAvailabilityZone.deleteMany.mockResolvedValue({ count: 1 });
      prismaMock.productVariant.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app).put(`/api/variants/${PV1}`).send({
        availabilityZoneIds: [AZ1],
      });

      expect(res.status).toBe(200);
      expect(prismaMock.productVariantAvailabilityZone.deleteMany).toHaveBeenCalledWith({ where: { variantId: PV1 } });
    });

    it('should return 404 for unknown variant', async () => {
      prismaMock.productVariant.findUnique.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).put(`/api/variants/${PV1}`).send({ name: 'X' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/variants/:id', () => {
    it('should delete variant with no instances or forecasts', async () => {
      prismaMock.productVariant.findUnique.mockResolvedValue({
        id: PV1,
        _count: { instances: 0, forecastLines: 0 },
      });
      prismaMock.productVariant.delete.mockResolvedValue({});

      const app = createApp();
      const res = await request(app).delete(`/api/variants/${PV1}`);

      expect(res.status).toBe(204);
    });

    it('should block deletion if variant has instances', async () => {
      prismaMock.productVariant.findUnique.mockResolvedValue({
        id: PV1,
        _count: { instances: 2, forecastLines: 0 },
      });

      const app = createApp();
      const res = await request(app).delete(`/api/variants/${PV1}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('instances');
    });

    it('should block deletion if variant has forecast lines', async () => {
      prismaMock.productVariant.findUnique.mockResolvedValue({
        id: PV1,
        _count: { instances: 0, forecastLines: 1 },
      });

      const app = createApp();
      const res = await request(app).delete(`/api/variants/${PV1}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('forecast lines');
    });

    it('should return 404 for unknown variant', async () => {
      prismaMock.productVariant.findUnique.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).delete(`/api/variants/${PV1}`);

      expect(res.status).toBe(404);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // EDGE CASES & VALIDATIONS
  // ═══════════════════════════════════════════════════════════════

  describe('Edge Cases', () => {
    it('should handle Prisma P2002 unique constraint on product slug', async () => {
      const err = new Error('Unique constraint') as any;
      err.code = 'P2002';
      err.meta = { target: ['slug'] };
      prismaMock.product.create.mockRejectedValue(err);
      prismaMock.product.findUnique.mockResolvedValue(null);
      prismaMock.category.findUnique.mockResolvedValue({ id: CAT_COMPUTE, slug: 'compute' });

      const app = createApp();
      const res = await request(app).post('/api/products').send({
        name: 'Test',
        slug: 'test',
        categoryId: CAT_COMPUTE,
      });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Conflict');
    });

    it('should handle Prisma P2025 record not found on update', async () => {
      const err = new Error('Record not found') as any;
      err.code = 'P2025';
      err.meta = { cause: 'Product not found' };
      prismaMock.product.update.mockRejectedValue(err);
      prismaMock.product.findUnique.mockResolvedValue({ id: P1, categoryId: CAT_COMPUTE, computeType: 'VIRTUAL' });
      prismaMock.category.findUnique.mockResolvedValue({ id: CAT_COMPUTE, slug: 'compute' });

      const app = createApp();
      const res = await request(app).patch(`/api/products/${P1}`).send({ name: 'X' });

      expect(res.status).toBe(404);
    });

    it('should allow too many AZ ids up to 50', async () => {
      const azIds = Array.from({ length: 50 }, (_, i) => `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa${String(i).padStart(3, '0')}`);
      const payload = {
        name: 'Big Variant',
        osId: OS1,
        osVersionId: V1,
        flavorId: FL1,
        availabilityZoneIds: azIds,
      };
      prismaMock.product.findUnique.mockResolvedValue({ id: P1, category: { slug: 'compute' } });
      prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: OS1 });
      prismaMock.osVersion.findFirst.mockResolvedValue({ id: V1, osId: OS1 });
      prismaMock.flavor.findUnique.mockResolvedValue({ id: FL1 });
      prismaMock.availabilityZone.findMany.mockResolvedValue(azIds.map((id) => ({ id })));
      prismaMock.productVariant.create.mockResolvedValue({ id: PV1, ...payload });

      const app = createApp();
      const res = await request(app).post(`/api/products/${P1}/variants`).send(payload);

      expect(res.status).toBe(201);
    });

    it('should reject more than 50 AZ ids', async () => {
      const azIds = Array.from({ length: 51 }, (_, i) => `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa${String(i).padStart(3, '0')}`);
      const payload = {
        name: 'Too Big',
        osId: OS1,
        osVersionId: V1,
        flavorId: FL1,
        availabilityZoneIds: azIds,
      };

      const app = createApp();
      const res = await request(app).post(`/api/products/${P1}/variants`).send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });
});
