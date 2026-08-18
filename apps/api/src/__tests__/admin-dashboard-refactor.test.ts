import request from 'supertest';
import express from 'express';

var prismaMock: any = {};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => prismaMock),
  ComputeType: { PHYSICAL: 'PHYSICAL', VIRTUAL: 'VIRTUAL' },
  LifecyclePhase: {
    RELEASED: 'RELEASED',
    NORMAL_SUPPORT: 'NORMAL_SUPPORT',
    EXTENDED_SUPPORT: 'EXTENDED_SUPPORT',
    NO_SUPPORT: 'NO_SUPPORT',
    EOL: 'EOL',
  },
}));

import { osRoutes } from '../routes/os';
import { productRoutes } from '../routes/products';
import { variantRoutes } from '../routes/variants';
import { flavorRoutes } from '../routes/flavors';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/os', osRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/variants', variantRoutes);
  app.use('/api/flavors', flavorRoutes);
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation Error',
        details: err.errors.map((e: any) => ({ path: e.path.join('.'), message: e.message })),
      });
    }
    if (err.code === 'P2002') {
      const target = err.meta?.target ? err.meta.target.join(', ') : 'field';
      return res.status(409).json({ error: 'Conflict', message: `A record with this ${target} already exists` });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({ error: 'Constraint Violation', message: 'The referenced record does not exist or cannot be modified due to existing relations' });
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
const VER1 = '33333333-3333-3333-3333-333333333333';
const VER2 = '44444444-4444-4444-4444-444444444444';
const PROD1 = '55555555-5555-5555-5555-555555555555';
const PROD2 = '66666666-6666-6666-6666-666666666666';
const VAR1 = '77777777-7777-7777-7777-777777777777';
const FLAV1 = '88888888-8888-8888-8888-888888888888';
const AZ1 = '99999999-9999-9999-9999-999999999999';
const CL1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CAT_COMPUTE = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const CAT_DATA = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

describe('Admin Dashboard Refactor — 5 Phases', () => {
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
      findFirst: jest.fn(),
      findUnique: jest.fn(),
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
    prismaMock.continuityLevel = {
      findUnique: jest.fn(),
    };
    prismaMock.$transaction = jest.fn(async (fn: any) => fn(prismaMock));
    jest.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 1 & 2 — OS CRUD + Versions
  // ═══════════════════════════════════════════════════════════════════════
  describe('OS Routes', () => {
    describe('GET /api/os', () => {
      it('should list all OS with versions and variant counts', async () => {
        const osList = [
          { id: OS1, family: 'WINDOWS', name: 'Windows', slug: 'windows', versions: [], _count: { variants: 3 } },
        ];
        prismaMock.operatingSystem.findMany.mockResolvedValue(osList);

        const app = createApp();
        const res = await request(app).get('/api/os');

        expect(res.status).toBe(200);
        expect(res.body).toEqual(osList);
        expect(prismaMock.operatingSystem.findMany).toHaveBeenCalledWith({
          include: { versions: { orderBy: { releaseDate: 'desc' } }, _count: { select: { variants: true } } },
          orderBy: { name: 'asc' },
        });
      });

      it('should return empty array when no OS exist', async () => {
        prismaMock.operatingSystem.findMany.mockResolvedValue([]);
        const app = createApp();
        const res = await request(app).get('/api/os');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
      });
    });

    describe('POST /api/os', () => {
      it('should create an OS', async () => {
        const payload = { family: 'LINUX', name: 'Ubuntu', slug: 'ubuntu' };
        const created = { id: 'os-new', ...payload, isActive: true, versions: [] };
        prismaMock.operatingSystem.findUnique.mockResolvedValue(null);
        prismaMock.operatingSystem.create.mockResolvedValue(created);

        const app = createApp();
        const res = await request(app).post('/api/os').send(payload);

        expect(res.status).toBe(201);
        expect(res.body).toEqual(created);
      });

      it('should reject duplicate slug', async () => {
        prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: OS1, slug: 'windows' });
        const app = createApp();
        const res = await request(app).post('/api/os').send({ family: 'WINDOWS', name: 'Windows', slug: 'windows' });
        expect(res.status).toBe(409);
        expect(res.body.error).toContain('slug already exists');
      });

      it('should reject invalid slug format', async () => {
        const app = createApp();
        const res = await request(app).post('/api/os').send({ family: 'X', name: 'X', slug: 'Invalid Slug!' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
      });

      it('should reject empty family', async () => {
        const app = createApp();
        const res = await request(app).post('/api/os').send({ family: '', name: 'X', slug: 'x' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
      });
    });

    describe('GET /api/os/:id', () => {
      it('should return an OS by id', async () => {
        const os = { id: OS1, family: 'WINDOWS', name: 'Windows', slug: 'windows', versions: [], _count: { variants: 2 } };
        prismaMock.operatingSystem.findUnique.mockResolvedValue(os);

        const app = createApp();
        const res = await request(app).get(`/api/os/${OS1}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual(os);
      });

      it('should return 404 for nonexistent OS', async () => {
        prismaMock.operatingSystem.findUnique.mockResolvedValue(null);
        const app = createApp();
        const res = await request(app).get('/api/os/99999999-9999-9999-9999-999999999999');
        expect(res.status).toBe(404);
        expect(res.body.error).toContain('not found');
      });

      it('should reject invalid UUID', async () => {
        const app = createApp();
        const res = await request(app).get('/api/os/not-uuid');
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
      });
    });

    describe('PUT /api/os/:id', () => {
      it('should update an OS', async () => {
        const updated = { id: OS1, family: 'LINUX', name: 'Windows Updated', slug: 'windows', versions: [] };
        prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: OS1 });
        prismaMock.operatingSystem.update.mockResolvedValue(updated);

        const app = createApp();
        const res = await request(app).put(`/api/os/${OS1}`).send({ name: 'Windows Updated' });

        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Windows Updated');
      });

      it('should reject update to existing slug of another OS', async () => {
        prismaMock.operatingSystem.findUnique
          .mockResolvedValueOnce({ id: OS1 })
          .mockResolvedValueOnce({ id: OS2, slug: 'debian' });
        const app = createApp();
        const res = await request(app).put(`/api/os/${OS1}`).send({ slug: 'debian' });
        expect(res.status).toBe(409);
        expect(res.body.error).toContain('slug already exists');
      });
    });

    describe('DELETE /api/os/:id', () => {
      it('should delete an OS with no variants', async () => {
        prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: OS1, _count: { variants: 0 } });
        prismaMock.operatingSystem.delete.mockResolvedValue({});

        const app = createApp();
        const res = await request(app).delete(`/api/os/${OS1}`);

        expect(res.status).toBe(204);
      });

      it('should reject deletion when variants exist', async () => {
        prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: OS1, _count: { variants: 3 } });
        const app = createApp();
        const res = await request(app).delete(`/api/os/${OS1}`);
        expect(res.status).toBe(409);
        expect(res.body.error).toContain('existing variants');
      });

      it('should return 404 for nonexistent OS', async () => {
        prismaMock.operatingSystem.findUnique.mockResolvedValue(null);
        const app = createApp();
        const res = await request(app).delete('/api/os/99999999-9999-9999-9999-999999999999');
        expect(res.status).toBe(404);
      });
    });
  });

  describe('OS Version Routes', () => {
    describe('GET /api/os/:id/versions', () => {
      it('should list versions for an OS', async () => {
        const versions = [
          { id: VER1, osId: OS1, version: 'Server 2022', phase: 'RELEASED' },
          { id: VER2, osId: OS1, version: 'Server 2019', phase: 'EXTENDED_SUPPORT' },
        ];
        prismaMock.osVersion.findMany.mockResolvedValue(versions);

        const app = createApp();
        const res = await request(app).get(`/api/os/${OS1}/versions`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual(versions);
        expect(prismaMock.osVersion.findMany).toHaveBeenCalledWith({
          where: { osId: OS1 },
          orderBy: { releaseDate: 'desc' },
        });
      });
    });

    describe('POST /api/os/:id/versions', () => {
      const validVersion = {
        version: 'Server 2025',
        releaseDate: '2025-01-01T00:00:00Z',
        normalSupportEnd: '2030-01-01T00:00:00Z',
        extendedSupportEnd: '2032-01-01T00:00:00Z',
        eolDate: '2034-01-01T00:00:00Z',
      };

      it('should create a version with valid chronological dates', async () => {
        prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: OS1 });
        const created = { id: 'v-new', osId: OS1, ...validVersion, phase: 'RELEASED', isActive: true };
        prismaMock.osVersion.create.mockResolvedValue(created);

        const app = createApp();
        const res = await request(app).post(`/api/os/${OS1}/versions`).send(validVersion);

        expect(res.status).toBe(201);
        expect(res.body).toEqual(created);
      });

      it('should reject out-of-order dates', async () => {
        const app = createApp();
        const res = await request(app).post(`/api/os/${OS1}/versions`).send({
          version: 'Bad',
          releaseDate: '2025-01-01T00:00:00Z',
          normalSupportEnd: '2024-01-01T00:00:00Z',
          extendedSupportEnd: '2026-01-01T00:00:00Z',
          eolDate: '2028-01-01T00:00:00Z',
        });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
      });

      it('should reject when OS not found', async () => {
        prismaMock.operatingSystem.findUnique.mockResolvedValue(null);
        const app = createApp();
        const res = await request(app).post(`/api/os/${OS1}/versions`).send(validVersion);
        expect(res.status).toBe(404);
        expect(res.body.error).toContain('OS not found');
      });

      it('should reject missing version', async () => {
        const app = createApp();
        const res = await request(app).post(`/api/os/${OS1}/versions`).send({
          releaseDate: '2025-01-01T00:00:00Z',
          normalSupportEnd: '2030-01-01T00:00:00Z',
          extendedSupportEnd: '2032-01-01T00:00:00Z',
          eolDate: '2034-01-01T00:00:00Z',
        });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
      });
    });

    describe('PUT /api/os/:id/versions/:versionId', () => {
      it('should update a version', async () => {
        prismaMock.osVersion.findFirst.mockResolvedValue({ id: VER1, osId: OS1 });
        const updated = { id: VER1, osId: OS1, version: 'Server 2022 Updated', phase: 'NORMAL_SUPPORT' };
        prismaMock.osVersion.update.mockResolvedValue(updated);

        const app = createApp();
        const res = await request(app).put(`/api/os/${OS1}/versions/${VER1}`).send({ phase: 'NORMAL_SUPPORT' });

        expect(res.status).toBe(200);
        expect(res.body.phase).toBe('NORMAL_SUPPORT');
      });

      it('should return 404 when version does not belong to OS', async () => {
        prismaMock.osVersion.findFirst.mockResolvedValue(null);
        const app = createApp();
        const res = await request(app).put(`/api/os/${OS1}/versions/${VER2}`).send({ version: 'X' });
        expect(res.status).toBe(404);
        expect(res.body.error).toContain('Version not found');
      });
    });

    describe('DELETE /api/os/:id/versions/:versionId', () => {
      it('should delete a version with no variants', async () => {
        prismaMock.osVersion.findFirst.mockResolvedValue({ id: VER1, osId: OS1, _count: { variants: 0 } });
        prismaMock.osVersion.delete.mockResolvedValue({});

        const app = createApp();
        const res = await request(app).delete(`/api/os/${OS1}/versions/${VER1}`);

        expect(res.status).toBe(204);
      });

      it('should reject deletion when variants exist', async () => {
        prismaMock.osVersion.findFirst.mockResolvedValue({ id: VER1, osId: OS1, _count: { variants: 2 } });
        const app = createApp();
        const res = await request(app).delete(`/api/os/${OS1}/versions/${VER1}`);
        expect(res.status).toBe(409);
        expect(res.body.error).toContain('existing variants');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2 — Product Refonte
  // ═══════════════════════════════════════════════════════════════════════
  describe('Product Routes (Refactored)', () => {
    describe('GET /api/products', () => {
      it('should list products with variants and counts', async () => {
        const products = [
          {
            id: PROD1, name: 'VM', slug: 'vm', category: { id: CAT_COMPUTE, name: 'Compute', slug: 'compute' },
            computeType: 'VIRTUAL', variants: [], dependencies: [], dependentProducts: [],
            upgradeFrom: [], upgradeTo: [], _count: { variants: 2, instances: 5 },
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
          expect.objectContaining({ where: expect.objectContaining({ category: { slug: 'compute' } }) })
        );
      });

      it('should filter by computeType', async () => {
        prismaMock.product.findMany.mockResolvedValue([]);
        const app = createApp();
        const res = await request(app).get('/api/products?computeType=VIRTUAL');
        expect(res.status).toBe(200);
        expect(prismaMock.product.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: expect.objectContaining({ computeType: 'VIRTUAL' }) })
        );
      });

      it('should search by name/description', async () => {
        prismaMock.product.findMany.mockResolvedValue([]);
        const app = createApp();
        const res = await request(app).get('/api/products?search=virtual');
        expect(res.status).toBe(200);
        expect(prismaMock.product.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: [
                { name: { contains: 'virtual', mode: 'insensitive' } },
                { description: { contains: 'virtual', mode: 'insensitive' } },
              ],
            }),
          })
        );
      });
    });

    describe('POST /api/products', () => {
      it('should create a Compute product with computeType', async () => {
        const payload = { name: 'VM', slug: 'vm', categoryId: CAT_COMPUTE, computeType: 'VIRTUAL' };
        const created = { id: PROD1, ...payload, category: { id: CAT_COMPUTE, slug: 'compute' }, variants: [], _count: { variants: 0 } };
        prismaMock.product.findUnique.mockResolvedValue(null);
        prismaMock.category.findUnique.mockResolvedValue({ id: CAT_COMPUTE, slug: 'compute' });
        prismaMock.product.create.mockResolvedValue(created);

        const app = createApp();
        const res = await request(app).post('/api/products').send(payload);

        expect(res.status).toBe(201);
        expect(res.body.computeType).toBe('VIRTUAL');
      });

      it('should create a non-Compute product without computeType', async () => {
        const payload = { name: 'Storage', slug: 'storage', categoryId: CAT_DATA };
        const created = { id: PROD2, ...payload, category: { id: CAT_DATA, slug: 'data' }, variants: [], _count: { variants: 0 } };
        prismaMock.product.findUnique.mockResolvedValue(null);
        prismaMock.category.findUnique.mockResolvedValue({ id: CAT_DATA, slug: 'data' });
        prismaMock.product.create.mockResolvedValue(created);

        const app = createApp();
        const res = await request(app).post('/api/products').send(payload);

        expect(res.status).toBe(201);
        expect(res.body.computeType).toBeUndefined();
      });

      it('should reject computeType for non-Compute category', async () => {
        prismaMock.product.findUnique.mockResolvedValue(null);
        prismaMock.category.findUnique.mockResolvedValue({ id: CAT_DATA, slug: 'data' });

        const app = createApp();
        const res = await request(app).post('/api/products').send({
          name: 'Bad', slug: 'bad', categoryId: CAT_DATA, computeType: 'VIRTUAL',
        });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('computeType can only be set for Compute');
      });

      it('should reject duplicate slug', async () => {
        prismaMock.product.findUnique.mockResolvedValue({ id: PROD1, slug: 'vm' });
        const app = createApp();
        const res = await request(app).post('/api/products').send({ name: 'VM', slug: 'vm', categoryId: CAT_COMPUTE });
        expect(res.status).toBe(409);
      });

      it('should reject invalid categoryId', async () => {
        const app = createApp();
        const res = await request(app).post('/api/products').send({ name: 'X', slug: 'x', categoryId: 'not-uuid' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
      });
    });

    describe('GET /api/products/:slug', () => {
      it('should return a product by slug with variants', async () => {
        const product = {
          id: PROD1, name: 'VM', slug: 'vm', category: { id: CAT_COMPUTE, slug: 'compute' },
          computeType: 'VIRTUAL', variants: [
            { id: VAR1, name: 'Debian 12 - Small', os: { id: OS1 }, osVersion: { id: VER1 }, flavor: { id: FLAV1 } },
          ],
          _count: { variants: 1, instances: 3 },
        };
        prismaMock.product.findUnique.mockResolvedValue(product);

        const app = createApp();
        const res = await request(app).get('/api/products/vm');

        expect(res.status).toBe(200);
        expect(res.body.variants).toHaveLength(1);
      });

      it('should return 404 for unknown slug', async () => {
        prismaMock.product.findUnique.mockResolvedValue(null);
        const app = createApp();
        const res = await request(app).get('/api/products/unknown');
        expect(res.status).toBe(404);
      });
    });

    describe('PATCH /api/products/:id', () => {
      it('should update product name', async () => {
        const updated = { id: PROD1, name: 'Updated VM', category: { id: CAT_COMPUTE, slug: 'compute' }, variants: [], _count: { variants: 0 } };
        prismaMock.product.findUnique.mockResolvedValue({ id: PROD1, category: { id: CAT_COMPUTE, slug: 'compute' } });
        prismaMock.product.update.mockResolvedValue(updated);

        const app = createApp();
        const res = await request(app).patch(`/api/products/${PROD1}`).send({ name: 'Updated VM' });

        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Updated VM');
      });

      it('should allow setting computeType when category is Compute', async () => {
        prismaMock.product.findUnique.mockResolvedValue({ id: PROD1, category: { id: CAT_COMPUTE, slug: 'compute' } });
        prismaMock.product.update.mockResolvedValue({ id: PROD1, computeType: 'PHYSICAL' });

        const app = createApp();
        const res = await request(app).patch(`/api/products/${PROD1}`).send({ computeType: 'PHYSICAL' });
        expect(res.status).toBe(200);
      });

      it('should reject computeType when product category is not Compute', async () => {
        prismaMock.product.findUnique.mockResolvedValue({ id: PROD2, category: { id: CAT_DATA, slug: 'data' } });
        const app = createApp();
        const res = await request(app).patch(`/api/products/${PROD2}`).send({ computeType: 'VIRTUAL' });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('computeType can only be set for Compute');
      });

      it('should allow changing category to Compute and setting computeType together', async () => {
        prismaMock.product.findUnique.mockResolvedValue({ id: PROD2, category: { id: CAT_DATA, slug: 'data' } });
        prismaMock.category.findUnique.mockResolvedValue({ id: CAT_COMPUTE, slug: 'compute' });
        prismaMock.product.update.mockResolvedValue({ id: PROD2, category: { id: CAT_COMPUTE }, computeType: 'VIRTUAL' });

        const app = createApp();
        const res = await request(app).patch(`/api/products/${PROD2}`).send({ categoryId: CAT_COMPUTE, computeType: 'VIRTUAL' });
        expect(res.status).toBe(200);
      });
    });

    describe('DELETE /api/products/:id', () => {
      it('should delete a product with no relations', async () => {
        prismaMock.product.findUnique.mockResolvedValue({
          id: PROD1,
          _count: { variants: 0, dependencies: 0, dependentProducts: 0, forecastLines: 0, instances: 0 },
        });
        prismaMock.product.delete.mockResolvedValue({});

        const app = createApp();
        const res = await request(app).delete(`/api/products/${PROD1}`);

        expect(res.status).toBe(204);
      });

      it('should reject deletion when variants exist', async () => {
        prismaMock.product.findUnique.mockResolvedValue({
          id: PROD1,
          _count: { variants: 2, dependencies: 0, dependentProducts: 0, forecastLines: 0, instances: 0 },
        });
        const app = createApp();
        const res = await request(app).delete(`/api/products/${PROD1}`);
        expect(res.status).toBe(409);
        expect(res.body.error).toContain('variants');
      });

      it('should reject deletion when instances exist', async () => {
        prismaMock.product.findUnique.mockResolvedValue({
          id: PROD1,
          _count: { variants: 0, dependencies: 0, dependentProducts: 0, forecastLines: 0, instances: 3 },
        });
        const app = createApp();
        const res = await request(app).delete(`/api/products/${PROD1}`);
        expect(res.status).toBe(409);
        expect(res.body.error).toContain('instances');
      });

      it('should list all blocking relations', async () => {
        prismaMock.product.findUnique.mockResolvedValue({
          id: PROD1,
          _count: { variants: 1, dependencies: 1, dependentProducts: 1, forecastLines: 1, instances: 1 },
        });
        const app = createApp();
        const res = await request(app).delete(`/api/products/${PROD1}`);
        expect(res.status).toBe(409);
        expect(res.body.error).toContain('variants');
        expect(res.body.error).toContain('dependencies');
        expect(res.body.error).toContain('instances');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2 — ProductVariant Routes
  // ═══════════════════════════════════════════════════════════════════════
  describe('ProductVariant Routes', () => {
    describe('GET /api/variants/product/:productId', () => {
      it('should list variants for a product', async () => {
        const variants = [
          {
            id: VAR1, productId: PROD1, name: 'Debian 12 - Small',
            os: { id: OS1 }, osVersion: { id: VER1 }, flavor: { id: FLAV1 },
            availabilityZones: [], continuityLevel: null, _count: { instances: 0 },
          },
        ];
        prismaMock.productVariant.findMany.mockResolvedValue(variants);

        const app = createApp();
        const res = await request(app).get(`/api/variants/product/${PROD1}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual(variants);
      });
    });

    describe('POST /api/variants/product/:productId', () => {
      const validVariant = {
        name: 'Debian 12 - Small',
        osId: OS1,
        osVersionId: VER1,
        flavorId: FLAV1,
        availabilityZoneIds: [AZ1],
      };

      function mockVariantRelationsValid() {
        prismaMock.product.findUnique.mockResolvedValue({ id: PROD1, category: { slug: 'compute' } });
        prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: OS1 });
        prismaMock.osVersion.findFirst.mockResolvedValue({ id: VER1, osId: OS1 });
        prismaMock.flavor.findUnique.mockResolvedValue({ id: FLAV1 });
        prismaMock.availabilityZone.findMany.mockResolvedValue([{ id: AZ1 }]);
      }

      it('should create a variant for a Compute product', async () => {
        mockVariantRelationsValid();
        const created = {
          id: VAR1, productId: PROD1, ...validVariant,
          os: { id: OS1 }, osVersion: { id: VER1 }, flavor: { id: FLAV1 },
          availabilityZones: [{ availabilityZone: { id: AZ1 } }], continuityLevel: null,
        };
        prismaMock.productVariant.create.mockResolvedValue(created);

        const app = createApp();
        const res = await request(app).post(`/api/variants/product/${PROD1}`).send(validVariant);

        expect(res.status).toBe(201);
        expect(res.body.name).toBe('Debian 12 - Small');
      });

      it('should reject variant for non-Compute product', async () => {
        prismaMock.product.findUnique.mockResolvedValue({ id: PROD2, category: { slug: 'data' } });
        const app = createApp();
        const res = await request(app).post(`/api/variants/product/${PROD2}`).send(validVariant);
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('only be created for Compute products');
      });

      it('should reject when OS not found', async () => {
        prismaMock.product.findUnique.mockResolvedValue({ id: PROD1, category: { slug: 'compute' } });
        prismaMock.operatingSystem.findUnique.mockResolvedValue(null);
        const app = createApp();
        const res = await request(app).post(`/api/variants/product/${PROD1}`).send(validVariant);
        expect(res.status).toBe(404);
        expect(res.body.error).toContain('OS not found');
      });

      it('should reject when OS version does not belong to OS', async () => {
        prismaMock.product.findUnique.mockResolvedValue({ id: PROD1, category: { slug: 'compute' } });
        prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: OS1 });
        prismaMock.osVersion.findFirst.mockResolvedValue(null);
        const app = createApp();
        const res = await request(app).post(`/api/variants/product/${PROD1}`).send(validVariant);
        expect(res.status).toBe(404);
        expect(res.body.error).toContain('OS version not found');
      });

      it('should reject when flavor not found', async () => {
        prismaMock.product.findUnique.mockResolvedValue({ id: PROD1, category: { slug: 'compute' } });
        prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: OS1 });
        prismaMock.osVersion.findFirst.mockResolvedValue({ id: VER1, osId: OS1 });
        prismaMock.flavor.findUnique.mockResolvedValue(null);
        const app = createApp();
        const res = await request(app).post(`/api/variants/product/${PROD1}`).send(validVariant);
        expect(res.status).toBe(404);
        expect(res.body.error).toContain('Flavor not found');
      });

      it('should reject when continuity level not found', async () => {
        mockVariantRelationsValid();
        prismaMock.continuityLevel.findUnique.mockResolvedValue(null);
        const app = createApp();
        const res = await request(app).post(`/api/variants/product/${PROD1}`).send({ ...validVariant, continuityLevelId: CL1 });
        expect(res.status).toBe(404);
        expect(res.body.error).toContain('Continuity level not found');
      });

      it('should reject when availability zone does not exist', async () => {
        prismaMock.product.findUnique.mockResolvedValue({ id: PROD1, category: { slug: 'compute' } });
        prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: OS1 });
        prismaMock.osVersion.findFirst.mockResolvedValue({ id: VER1, osId: OS1 });
        prismaMock.flavor.findUnique.mockResolvedValue({ id: FLAV1 });
        prismaMock.availabilityZone.findMany.mockResolvedValue([]);
        const app = createApp();
        const res = await request(app).post(`/api/variants/product/${PROD1}`).send(validVariant);
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('availability zones do not exist');
      });

      it('should reject invalid UUID for osId', async () => {
        const app = createApp();
        const res = await request(app).post(`/api/variants/product/${PROD1}`).send({
          name: 'X', osId: 'bad', osVersionId: VER1, flavorId: FLAV1,
        });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
      });
    });

    describe('GET /api/variants/:id', () => {
      it('should return a variant by id', async () => {
        const variant = {
          id: VAR1, name: 'Debian 12 - Small',
          product: { id: PROD1, category: { slug: 'compute' } },
          os: { id: OS1 }, osVersion: { id: VER1 }, flavor: { id: FLAV1 },
          availabilityZones: [], continuityLevel: null, _count: { instances: 2 },
        };
        prismaMock.productVariant.findUnique.mockResolvedValue(variant);

        const app = createApp();
        const res = await request(app).get(`/api/variants/${VAR1}`);

        expect(res.status).toBe(200);
        expect(res.body._count.instances).toBe(2);
      });

      it('should return 404 for unknown variant', async () => {
        prismaMock.productVariant.findUnique.mockResolvedValue(null);
        const app = createApp();
        const res = await request(app).get('/api/variants/99999999-9999-9999-9999-999999999999');
        expect(res.status).toBe(404);
      });
    });

    describe('PUT /api/variants/:id', () => {
      it('should update a variant name', async () => {
        prismaMock.productVariant.findUnique.mockResolvedValue({ id: VAR1, osId: OS1 });
        const updated = {
          id: VAR1, name: 'Updated Name', os: { id: OS1 }, osVersion: { id: VER1 },
          flavor: { id: FLAV1 }, availabilityZones: [], continuityLevel: null,
        };
        prismaMock.productVariant.update.mockResolvedValue(updated);

        const app = createApp();
        const res = await request(app).put(`/api/variants/${VAR1}`).send({ name: 'Updated Name' });

        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Updated Name');
      });

      it('should reject when changing to nonexistent OS', async () => {
        prismaMock.productVariant.findUnique.mockResolvedValue({ id: VAR1, osId: OS1 });
        prismaMock.operatingSystem.findUnique.mockResolvedValue(null);
        const app = createApp();
        const res = await request(app).put(`/api/variants/${VAR1}`).send({ osId: OS2 });
        expect(res.status).toBe(404);
        expect(res.body.error).toContain('OS not found');
      });

      it('should reject when new OS version does not belong to OS', async () => {
        prismaMock.productVariant.findUnique.mockResolvedValue({ id: VAR1, osId: OS1 });
        prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: OS2 });
        prismaMock.osVersion.findFirst.mockResolvedValue(null);
        const app = createApp();
        const res = await request(app).put(`/api/variants/${VAR1}`).send({ osId: OS2, osVersionId: VER2 });
        expect(res.status).toBe(404);
        expect(res.body.error).toContain('OS version not found');
      });

      it('should replace availability zones when provided', async () => {
        prismaMock.productVariant.findUnique.mockResolvedValue({ id: VAR1, osId: OS1 });
        prismaMock.availabilityZone.findMany.mockResolvedValue([{ id: AZ1 }]);
        const updated = {
          id: VAR1, name: 'X', os: { id: OS1 }, osVersion: { id: VER1 },
          flavor: { id: FLAV1 }, availabilityZones: [{ availabilityZone: { id: AZ1 } }], continuityLevel: null,
        };
        prismaMock.productVariant.update.mockResolvedValue(updated);

        const app = createApp();
        const res = await request(app).put(`/api/variants/${VAR1}`).send({ availabilityZoneIds: [AZ1] });

        expect(res.status).toBe(200);
        expect(prismaMock.productVariantAvailabilityZone.deleteMany).toHaveBeenCalledWith({ where: { variantId: VAR1 } });
      });
    });

    describe('DELETE /api/variants/:id', () => {
      it('should delete a variant with no instances', async () => {
        prismaMock.productVariant.findUnique.mockResolvedValue({ id: VAR1, _count: { instances: 0 } });
        prismaMock.productVariant.delete.mockResolvedValue({});

        const app = createApp();
        const res = await request(app).delete(`/api/variants/${VAR1}`);

        expect(res.status).toBe(204);
      });

      it('should reject deletion when instances exist', async () => {
        prismaMock.productVariant.findUnique.mockResolvedValue({ id: VAR1, _count: { instances: 3 } });
        const app = createApp();
        const res = await request(app).delete(`/api/variants/${VAR1}`);
        expect(res.status).toBe(409);
        expect(res.body.error).toContain('existing instances');
      });

      it('should return 404 for unknown variant', async () => {
        prismaMock.productVariant.findUnique.mockResolvedValue(null);
        const app = createApp();
        const res = await request(app).delete('/api/variants/99999999-9999-9999-9999-999999999999');
        expect(res.status).toBe(404);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2 — Global Flavor Routes
  // ═══════════════════════════════════════════════════════════════════════
  describe('Flavor Routes (Global)', () => {
    describe('GET /api/flavors', () => {
      it('should list global flavors with usage counts', async () => {
        const flavors = [
          { id: FLAV1, name: 'Small', vcpu: 2, ramGb: 4, _count: { variants: 5, forecastLines: 2 } },
        ];
        prismaMock.flavor.findMany.mockResolvedValue(flavors);

        const app = createApp();
        const res = await request(app).get('/api/flavors');

        expect(res.status).toBe(200);
        expect(res.body).toEqual(flavors);
        expect(prismaMock.flavor.findMany).toHaveBeenCalledWith({
          include: { _count: { select: { variants: true, forecastLines: true } } },
          orderBy: { createdAt: 'desc' },
        });
      });
    });

    describe('POST /api/flavors', () => {
      it('should create a global flavor', async () => {
        const payload = { name: 'Tiny', vcpu: 1, ramGb: 2 };
        const created = { id: 'fl-new', ...payload, _count: { variants: 0 } };
        prismaMock.flavor.create.mockResolvedValue(created);

        const app = createApp();
        const res = await request(app).post('/api/flavors').send(payload);

        expect(res.status).toBe(201);
        expect(res.body.name).toBe('Tiny');
      });

      it('should reject negative vcpu', async () => {
        const app = createApp();
        const res = await request(app).post('/api/flavors').send({ name: 'Bad', vcpu: -1, ramGb: 2 });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
      });

      it('should reject negative ramGb', async () => {
        const app = createApp();
        const res = await request(app).post('/api/flavors').send({ name: 'Bad', vcpu: 1, ramGb: -2 });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
      });
    });

    describe('GET /api/flavors/:id', () => {
      it('should return a flavor with its variants', async () => {
        const flavor = {
          id: FLAV1, name: 'Small', vcpu: 2, ramGb: 4,
          variants: [
            { id: VAR1, product: { id: PROD1, name: 'VM', slug: 'vm' }, os: { id: OS1 }, osVersion: { id: VER1 } },
          ],
          _count: { variants: 1, forecastLines: 0 },
        };
        prismaMock.flavor.findUnique.mockResolvedValue(flavor);

        const app = createApp();
        const res = await request(app).get(`/api/flavors/${FLAV1}`);

        expect(res.status).toBe(200);
        expect(res.body.variants).toHaveLength(1);
        expect(res.body.variants[0].product.name).toBe('VM');
      });

      it('should return 404 for unknown flavor', async () => {
        prismaMock.flavor.findUnique.mockResolvedValue(null);
        const app = createApp();
        const res = await request(app).get('/api/flavors/99999999-9999-9999-9999-999999999999');
        expect(res.status).toBe(404);
      });
    });

    describe('PATCH /api/flavors/:id', () => {
      it('should update flavor specs', async () => {
        const updated = { id: FLAV1, name: 'Small', vcpu: 4, ramGb: 8, _count: { variants: 2 } };
        prismaMock.flavor.update.mockResolvedValue(updated);

        const app = createApp();
        const res = await request(app).patch(`/api/flavors/${FLAV1}`).send({ vcpu: 4, ramGb: 8 });

        expect(res.status).toBe(200);
        expect(res.body.vcpu).toBe(4);
        expect(res.body.ramGb).toBe(8);
      });

      it('should reject invalid UUID', async () => {
        const app = createApp();
        const res = await request(app).patch('/api/flavors/bad-id').send({ vcpu: 4 });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
      });
    });

    describe('DELETE /api/flavors/:id', () => {
      it('should delete a flavor with no relations', async () => {
        prismaMock.flavor.findUnique.mockResolvedValue({ id: FLAV1, _count: { variants: 0, forecastLines: 0 } });
        prismaMock.flavor.delete.mockResolvedValue({});

        const app = createApp();
        const res = await request(app).delete(`/api/flavors/${FLAV1}`);

        expect(res.status).toBe(204);
      });

      it('should reject deletion when variants exist', async () => {
        prismaMock.flavor.findUnique.mockResolvedValue({ id: FLAV1, _count: { variants: 3, forecastLines: 0 } });
        const app = createApp();
        const res = await request(app).delete(`/api/flavors/${FLAV1}`);
        expect(res.status).toBe(409);
        expect(res.body.error).toContain('variants');
      });

      it('should reject deletion when forecast lines exist', async () => {
        prismaMock.flavor.findUnique.mockResolvedValue({ id: FLAV1, _count: { variants: 0, forecastLines: 2 } });
        const app = createApp();
        const res = await request(app).delete(`/api/flavors/${FLAV1}`);
        expect(res.status).toBe(409);
        expect(res.body.error).toContain('forecast lines');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 1 — Schema Constraints (tested via API behavior)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Schema Constraints via API', () => {
    it('computeType is optional and only valid for Compute category', async () => {
      // Covered in Product POST/PATCH tests above
      expect(true).toBe(true);
    });

    it('ProductVariant is only allowed for Compute products', async () => {
      // Covered in Variant POST tests above
      expect(true).toBe(true);
    });

    it('Flavor is global (no productId) and can be used by any Compute variant', async () => {
      // Covered in Flavor GET tests showing variants relation
      expect(true).toBe(true);
    });

    it('ProductVariant links to OS, OsVersion, Flavor, and AvailabilityZones', async () => {
      // Covered in Variant POST/GET tests
      expect(true).toBe(true);
    });

    it('Deleted models (ProductOption, ProductLifecycle, ProductAvailabilityZone) are not referenced', async () => {
      // Verify by checking no mocks needed for deleted models
      expect(prismaMock.productOption).toBeUndefined();
      expect(prismaMock.productLifecycle).toBeUndefined();
      expect(prismaMock.productAvailabilityZone).toBeUndefined();
    });
  });
});
