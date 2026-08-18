import request from 'supertest';
import express from 'express';

var prismaMock: any = {};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => prismaMock),
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
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
  });
  return app;
}

const UUID_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const UUID_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const UUID_C = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const UUID_D = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const UUID_E = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1 — Schema Refactor (validated through API behaviour)
// PHASE 2 — API Backend
// PHASE 5 — Seed Data patterns
// ─────────────────────────────────────────────────────────────────────────────

describe('Prisma Schema Refactor — 5 Phases', () => {
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
      create: jest.fn(),
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

  // ═══════════════════════════════════════════════════════════════════════════
  // OS ROUTES
  // ═══════════════════════════════════════════════════════════════════════════
  describe('OS Routes', () => {
    describe('GET /api/os', () => {
      it('lists all OS with versions and variant counts', async () => {
        const osList = [
          { id: UUID_A, family: 'WINDOWS', name: 'Windows', slug: 'windows', isActive: true, versions: [], _count: { variants: 3 } },
          { id: UUID_B, family: 'LINUX', name: 'Debian', slug: 'debian', isActive: true, versions: [], _count: { variants: 2 } },
        ];
        prismaMock.operatingSystem.findMany.mockResolvedValue(osList);

        const app = createApp();
        const res = await request(app).get('/api/os');

        expect(res.status).toBe(200);
        expect(res.body).toEqual(osList);
        expect(prismaMock.operatingSystem.findMany).toHaveBeenCalledWith(expect.objectContaining({
          include: expect.objectContaining({ versions: expect.anything(), _count: expect.anything() }),
          orderBy: { name: 'asc' },
        }));
      });

      it('returns empty array when no OS exist', async () => {
        prismaMock.operatingSystem.findMany.mockResolvedValue([]);
        const app = createApp();
        const res = await request(app).get('/api/os');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
      });
    });

    describe('POST /api/os', () => {
      it('creates a new OS with valid data', async () => {
        const payload = { family: 'LINUX', name: 'Ubuntu', slug: 'ubuntu', isActive: true };
        const created = { id: UUID_C, ...payload, versions: [] };
        prismaMock.operatingSystem.findUnique.mockResolvedValue(null);
        prismaMock.operatingSystem.create.mockResolvedValue(created);

        const app = createApp();
        const res = await request(app).post('/api/os').send(payload);

        expect(res.status).toBe(201);
        expect(res.body).toEqual(created);
      });

      it('rejects duplicate slug with 409', async () => {
        prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: UUID_A, slug: 'windows' });
        const app = createApp();
        const res = await request(app).post('/api/os').send({ family: 'X', name: 'X', slug: 'windows' });
        expect(res.status).toBe(409);
        expect(res.body.error).toContain('slug');
      });

      it('rejects invalid slug format', async () => {
        const app = createApp();
        const res = await request(app).post('/api/os').send({ family: 'X', name: 'X', slug: 'Invalid_Slug' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
      });

      it('rejects missing required fields', async () => {
        const app = createApp();
        const res = await request(app).post('/api/os').send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
      });
    });

    describe('GET /api/os/:id', () => {
      it('returns a single OS by id', async () => {
        const os = { id: UUID_A, family: 'WINDOWS', name: 'Windows', slug: 'windows', versions: [], _count: { variants: 0 } };
        prismaMock.operatingSystem.findUnique.mockResolvedValue(os);
        const app = createApp();
        const res = await request(app).get(`/api/os/${UUID_A}`);
        expect(res.status).toBe(200);
        expect(res.body).toEqual(os);
      });

      it('returns 404 for nonexistent OS', async () => {
        prismaMock.operatingSystem.findUnique.mockResolvedValue(null);
        const app = createApp();
        const res = await request(app).get(`/api/os/${UUID_B}`);
        expect(res.status).toBe(404);
      });

      it('rejects invalid UUID', async () => {
        const app = createApp();
        const res = await request(app).get('/api/os/bad-id');
        expect(res.status).toBe(400);
      });
    });

    describe('PUT /api/os/:id', () => {
      it('updates OS fields', async () => {
        const updated = { id: UUID_A, family: 'WINDOWS', name: 'Windows Server', slug: 'windows', versions: [] };
        prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: UUID_A });
        prismaMock.operatingSystem.findUnique.mockResolvedValueOnce({ id: UUID_A });
        prismaMock.operatingSystem.update.mockResolvedValue(updated);

        const app = createApp();
        const res = await request(app).put(`/api/os/${UUID_A}`).send({ name: 'Windows Server' });
        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Windows Server');
      });

      it('prevents slug collision on update', async () => {
        prismaMock.operatingSystem.findUnique
          .mockResolvedValueOnce({ id: UUID_A, slug: 'old' })
          .mockResolvedValueOnce({ id: UUID_B, slug: 'new' });
        const app = createApp();
        const res = await request(app).put(`/api/os/${UUID_A}`).send({ slug: 'new' });
        expect(res.status).toBe(409);
      });
    });

    describe('DELETE /api/os/:id', () => {
      it('deletes OS with no variants', async () => {
        prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: UUID_A, _count: { variants: 0 } });
        prismaMock.operatingSystem.delete.mockResolvedValue({});
        const app = createApp();
        const res = await request(app).delete(`/api/os/${UUID_A}`);
        expect(res.status).toBe(204);
      });

      it('blocks deletion when variants exist', async () => {
        prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: UUID_A, _count: { variants: 2 } });
        const app = createApp();
        const res = await request(app).delete(`/api/os/${UUID_A}`);
        expect(res.status).toBe(409);
        expect(res.body.error).toContain('variants');
      });
    });

    describe('OS Versions', () => {
      const versionPayload = {
        version: 'Server 2022',
        releaseDate: '2021-08-18T00:00:00.000Z',
        normalSupportEnd: '2026-10-13T00:00:00.000Z',
        extendedSupportEnd: '2031-10-14T00:00:00.000Z',
        eolDate: '2033-10-14T00:00:00.000Z',
        phase: 'RELEASED',
        isActive: true,
      };

      describe('GET /api/os/:id/versions', () => {
        it('lists versions for an OS', async () => {
          prismaMock.osVersion.findMany.mockResolvedValue([{ id: UUID_C, ...versionPayload, osId: UUID_A }]);
          const app = createApp();
          const res = await request(app).get(`/api/os/${UUID_A}/versions`);
          expect(res.status).toBe(200);
          expect(res.body.length).toBe(1);
        });
      });

      describe('POST /api/os/:id/versions', () => {
        it('creates a version with valid lifecycle dates', async () => {
          prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: UUID_A });
          prismaMock.osVersion.create.mockResolvedValue({ id: UUID_C, osId: UUID_A, ...versionPayload });
          const app = createApp();
          const res = await request(app).post(`/api/os/${UUID_A}/versions`).send(versionPayload);
          expect(res.status).toBe(201);
        });

        it('rejects chronologically invalid dates', async () => {
          const app = createApp();
          const bad = { ...versionPayload, eolDate: '2020-01-01T00:00:00.000Z' };
          const res = await request(app).post(`/api/os/${UUID_A}/versions`).send(bad);
          expect(res.status).toBe(400);
          expect(res.body.error).toBe('Validation Error');
        });

        it('returns 404 for nonexistent OS', async () => {
          prismaMock.operatingSystem.findUnique.mockResolvedValue(null);
          const app = createApp();
          const res = await request(app).post(`/api/os/${UUID_A}/versions`).send(versionPayload);
          expect(res.status).toBe(404);
        });
      });

      describe('PUT /api/os/:id/versions/:versionId', () => {
        it('updates a version', async () => {
          prismaMock.osVersion.findFirst.mockResolvedValue({ id: UUID_C, osId: UUID_A });
          prismaMock.osVersion.update.mockResolvedValue({ id: UUID_C, osId: UUID_A, version: 'Server 2025' });
          const app = createApp();
          const res = await request(app).put(`/api/os/${UUID_A}/versions/${UUID_C}`).send({ version: 'Server 2025' });
          expect(res.status).toBe(200);
        });

        it('returns 404 for version not belonging to OS', async () => {
          prismaMock.osVersion.findFirst.mockResolvedValue(null);
          const app = createApp();
          const res = await request(app).put(`/api/os/${UUID_A}/versions/${UUID_C}`).send({ version: 'X' });
          expect(res.status).toBe(404);
        });
      });

      describe('DELETE /api/os/:id/versions/:versionId', () => {
        it('deletes a version with no variants', async () => {
          prismaMock.osVersion.findFirst.mockResolvedValue({ id: UUID_C, osId: UUID_A, _count: { variants: 0 } });
          prismaMock.osVersion.delete.mockResolvedValue({});
          const app = createApp();
          const res = await request(app).delete(`/api/os/${UUID_A}/versions/${UUID_C}`);
          expect(res.status).toBe(204);
        });

        it('blocks deletion when variants exist', async () => {
          prismaMock.osVersion.findFirst.mockResolvedValue({ id: UUID_C, osId: UUID_A, _count: { variants: 1 } });
          const app = createApp();
          const res = await request(app).delete(`/api/os/${UUID_A}/versions/${UUID_C}`);
          expect(res.status).toBe(409);
        });
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCT ROUTES
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Product Routes', () => {
    const computeCategory = { id: UUID_A, slug: 'compute', name: 'Compute' };
    const dataCategory = { id: UUID_B, slug: 'data', name: 'Data' };

    describe('GET /api/products', () => {
      it('lists products with variants and category', async () => {
        const products = [
          { id: UUID_A, name: 'VM', slug: 'vm', category: computeCategory, computeType: 'VIRTUAL', variants: [], _count: { variants: 2, instances: 1 } },
          { id: UUID_B, name: 'Storage', slug: 'storage', category: dataCategory, computeType: null, variants: [], _count: { variants: 0, instances: 0 } },
        ];
        prismaMock.product.findMany.mockResolvedValue(products);
        const app = createApp();
        const res = await request(app).get('/api/products');
        expect(res.status).toBe(200);
        expect(res.body).toEqual(products);
      });

      it('filters by category slug', async () => {
        prismaMock.product.findMany.mockResolvedValue([]);
        const app = createApp();
        const res = await request(app).get('/api/products?category=compute');
        expect(res.status).toBe(200);
        expect(prismaMock.product.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ category: { slug: 'compute' } }),
          })
        );
      });

      it('filters by computeType', async () => {
        prismaMock.product.findMany.mockResolvedValue([]);
        const app = createApp();
        const res = await request(app).get('/api/products?computeType=VIRTUAL');
        expect(res.status).toBe(200);
        expect(prismaMock.product.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ computeType: 'VIRTUAL' }),
          })
        );
      });

      it('filters by search term', async () => {
        prismaMock.product.findMany.mockResolvedValue([]);
        const app = createApp();
        const res = await request(app).get('/api/products?search=vm');
        expect(res.status).toBe(200);
        expect(prismaMock.product.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({ name: expect.objectContaining({ contains: 'vm' }) }),
              ]),
            }),
          })
        );
      });
    });

    describe('POST /api/products', () => {
      it('creates a Compute product with computeType', async () => {
        const payload = { name: 'VM', slug: 'vm', categoryId: UUID_A, computeType: 'VIRTUAL' };
        prismaMock.product.findUnique.mockResolvedValue(null);
        prismaMock.category.findUnique.mockResolvedValue(computeCategory);
        prismaMock.product.create.mockResolvedValue({ id: UUID_C, ...payload, category: computeCategory, variants: [], _count: { variants: 0 } });

        const app = createApp();
        const res = await request(app).post('/api/products').send(payload);
        expect(res.status).toBe(201);
        expect(res.body.computeType).toBe('VIRTUAL');
      });

      it('creates a non-Compute product without computeType', async () => {
        const payload = { name: 'Storage', slug: 'storage', categoryId: UUID_B };
        prismaMock.product.findUnique.mockResolvedValue(null);
        prismaMock.category.findUnique.mockResolvedValue(dataCategory);
        prismaMock.product.create.mockResolvedValue({ id: UUID_C, ...payload, category: dataCategory, variants: [], _count: { variants: 0 } });

        const app = createApp();
        const res = await request(app).post('/api/products').send(payload);
        expect(res.status).toBe(201);
      });

      it('rejects computeType for non-Compute category', async () => {
        const payload = { name: 'Bad', slug: 'bad', categoryId: UUID_B, computeType: 'VIRTUAL' };
        prismaMock.product.findUnique.mockResolvedValue(null);
        prismaMock.category.findUnique.mockResolvedValue(dataCategory);

        const app = createApp();
        const res = await request(app).post('/api/products').send(payload);
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('computeType');
      });

      it('rejects duplicate slug', async () => {
        prismaMock.product.findUnique.mockResolvedValue({ id: UUID_A, slug: 'vm' });
        const app = createApp();
        const res = await request(app).post('/api/products').send({ name: 'VM', slug: 'vm', categoryId: UUID_A });
        expect(res.status).toBe(409);
      });

      it('rejects invalid category ID', async () => {
        prismaMock.product.findUnique.mockResolvedValue(null);
        prismaMock.category.findUnique.mockResolvedValue(null);
        const app = createApp();
        const res = await request(app).post('/api/products').send({ name: 'X', slug: 'x', categoryId: UUID_A });
        expect(res.status).toBe(404);
        expect(res.body.error).toContain('Category');
      });
    });

    describe('PATCH /api/products/:id', () => {
      it('updates computeType for Compute product', async () => {
        prismaMock.product.findUnique.mockResolvedValue({ id: UUID_A, category: computeCategory });
        prismaMock.product.update.mockResolvedValue({ id: UUID_A, computeType: 'PHYSICAL', category: computeCategory });
        const app = createApp();
        const res = await request(app).patch(`/api/products/${UUID_A}`).send({ computeType: 'PHYSICAL' });
        expect(res.status).toBe(200);
      });

      it('rejects computeType when switching to non-Compute category', async () => {
        prismaMock.product.findUnique.mockResolvedValue({ id: UUID_A, category: computeCategory });
        prismaMock.category.findUnique.mockResolvedValue(dataCategory);
        const app = createApp();
        const res = await request(app).patch(`/api/products/${UUID_A}`).send({ categoryId: UUID_B, computeType: 'VIRTUAL' });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('computeType');
      });

      it('allows clearing computeType with null', async () => {
        prismaMock.product.findUnique.mockResolvedValue({ id: UUID_A, category: computeCategory });
        prismaMock.product.update.mockResolvedValue({ id: UUID_A, computeType: null, category: computeCategory });
        const app = createApp();
        const res = await request(app).patch(`/api/products/${UUID_A}`).send({ computeType: null });
        expect(res.status).toBe(200);
      });
    });

    describe('DELETE /api/products/:id', () => {
      it('deletes product with no relations', async () => {
        prismaMock.product.findUnique.mockResolvedValue({
          id: UUID_A, _count: { variants: 0, dependencies: 0, dependentProducts: 0, forecastLines: 0, instances: 0 },
        });
        prismaMock.product.delete.mockResolvedValue({});
        const app = createApp();
        const res = await request(app).delete(`/api/products/${UUID_A}`);
        expect(res.status).toBe(204);
      });

      it('blocks deletion when variants exist', async () => {
        prismaMock.product.findUnique.mockResolvedValue({
          id: UUID_A, _count: { variants: 1, dependencies: 0, dependentProducts: 0, forecastLines: 0, instances: 0 },
        });
        const app = createApp();
        const res = await request(app).delete(`/api/products/${UUID_A}`);
        expect(res.status).toBe(409);
        expect(res.body.error).toContain('variants');
      });

      it('blocks deletion when dependencies exist', async () => {
        prismaMock.product.findUnique.mockResolvedValue({
          id: UUID_A, _count: { variants: 0, dependencies: 1, dependentProducts: 0, forecastLines: 0, instances: 0 },
        });
        const app = createApp();
        const res = await request(app).delete(`/api/products/${UUID_A}`);
        expect(res.status).toBe(409);
        expect(res.body.error).toContain('dependencies');
      });

      it('blocks deletion when forecast lines exist', async () => {
        prismaMock.product.findUnique.mockResolvedValue({
          id: UUID_A, _count: { variants: 0, dependencies: 0, dependentProducts: 0, forecastLines: 1, instances: 0 },
        });
        const app = createApp();
        const res = await request(app).delete(`/api/products/${UUID_A}`);
        expect(res.status).toBe(409);
        expect(res.body.error).toContain('forecast lines');
      });

      it('blocks deletion when instances exist', async () => {
        prismaMock.product.findUnique.mockResolvedValue({
          id: UUID_A, _count: { variants: 0, dependencies: 0, dependentProducts: 0, forecastLines: 0, instances: 2 },
        });
        const app = createApp();
        const res = await request(app).delete(`/api/products/${UUID_A}`);
        expect(res.status).toBe(409);
        expect(res.body.error).toContain('instances');
      });

      it('lists all blocking relations', async () => {
        prismaMock.product.findUnique.mockResolvedValue({
          id: UUID_A, _count: { variants: 1, dependencies: 1, dependentProducts: 1, forecastLines: 1, instances: 1 },
        });
        const app = createApp();
        const res = await request(app).delete(`/api/products/${UUID_A}`);
        expect(res.status).toBe(409);
        expect(res.body.error).toContain('variants');
        expect(res.body.error).toContain('dependencies');
        expect(res.body.error).toContain('dependent products');
        expect(res.body.error).toContain('forecast lines');
        expect(res.body.error).toContain('instances');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VARIANT ROUTES
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Variant Routes', () => {
    const computeCategory = { id: UUID_A, slug: 'compute', name: 'Compute' };
    const os = { id: UUID_C, name: 'Debian' };
    const osVersion = { id: UUID_D, version: '12', osId: UUID_C };
    const flavor = { id: UUID_E, name: 'Small' };
    const az = { id: UUID_A, code: 'par1' };
    const cl = { id: UUID_B, name: 'LOW' };

    describe('GET /api/variants/product/:productId', () => {
      it('lists variants for a product', async () => {
        const variants = [
          { id: UUID_A, name: 'Debian 12 - Small', os, osVersion, flavor, availabilityZones: [], continuityLevel: cl, _count: { instances: 0 } },
        ];
        prismaMock.productVariant.findMany.mockResolvedValue(variants);
        const app = createApp();
        const res = await request(app).get(`/api/variants/product/${UUID_A}`);
        expect(res.status).toBe(200);
        expect(res.body).toEqual(variants);
      });
    });

    describe('POST /api/variants/product/:productId', () => {
      it('creates a variant for Compute product', async () => {
        prismaMock.product.findUnique.mockResolvedValue({ id: UUID_A, category: computeCategory });
        prismaMock.operatingSystem.findUnique.mockResolvedValue(os);
        prismaMock.osVersion.findFirst.mockResolvedValue(osVersion);
        prismaMock.flavor.findUnique.mockResolvedValue(flavor);
        prismaMock.continuityLevel.findUnique.mockResolvedValue(cl);
        prismaMock.availabilityZone.findMany.mockResolvedValue([az]);
        prismaMock.productVariant.create.mockResolvedValue({
          id: UUID_A, productId: UUID_A, name: 'V1', osId: UUID_C, osVersionId: UUID_D, flavorId: UUID_E, availabilityZones: [{ availabilityZone: az }], continuityLevel: cl,
        });

        const app = createApp();
        const res = await request(app).post(`/api/variants/product/${UUID_A}`).send({
          name: 'V1', osId: UUID_C, osVersionId: UUID_D, flavorId: UUID_E, availabilityZoneIds: [UUID_A], continuityLevelId: UUID_B,
        });
        expect(res.status).toBe(201);
      });

      it('rejects variant creation for non-Compute product', async () => {
        prismaMock.product.findUnique.mockResolvedValue({ id: UUID_A, category: { id: UUID_B, slug: 'data', name: 'Data' } });
        const app = createApp();
        const res = await request(app).post(`/api/variants/product/${UUID_A}`).send({
          name: 'V1', osId: UUID_C, osVersionId: UUID_D, flavorId: UUID_E,
        });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Compute');
      });

      it('rejects when OS does not exist', async () => {
        prismaMock.product.findUnique.mockResolvedValue({ id: UUID_A, category: computeCategory });
        prismaMock.operatingSystem.findUnique.mockResolvedValue(null);
        const app = createApp();
        const res = await request(app).post(`/api/variants/product/${UUID_A}`).send({
          name: 'V1', osId: UUID_C, osVersionId: UUID_D, flavorId: UUID_E,
        });
        expect(res.status).toBe(404);
        expect(res.body.error).toContain('OS');
      });

      it('rejects when OS version does not belong to OS', async () => {
        prismaMock.product.findUnique.mockResolvedValue({ id: UUID_A, category: computeCategory });
        prismaMock.operatingSystem.findUnique.mockResolvedValue(os);
        prismaMock.osVersion.findFirst.mockResolvedValue(null);
        const app = createApp();
        const res = await request(app).post(`/api/variants/product/${UUID_A}`).send({
          name: 'V1', osId: UUID_C, osVersionId: UUID_D, flavorId: UUID_E,
        });
        expect(res.status).toBe(404);
        expect(res.body.error).toContain('version');
      });

      it('rejects when flavor does not exist', async () => {
        prismaMock.product.findUnique.mockResolvedValue({ id: UUID_A, category: computeCategory });
        prismaMock.operatingSystem.findUnique.mockResolvedValue(os);
        prismaMock.osVersion.findFirst.mockResolvedValue(osVersion);
        prismaMock.flavor.findUnique.mockResolvedValue(null);
        const app = createApp();
        const res = await request(app).post(`/api/variants/product/${UUID_A}`).send({
          name: 'V1', osId: UUID_C, osVersionId: UUID_D, flavorId: UUID_E,
        });
        expect(res.status).toBe(404);
        expect(res.body.error).toContain('Flavor');
      });

      it('rejects invalid availability zone IDs', async () => {
        prismaMock.product.findUnique.mockResolvedValue({ id: UUID_A, category: computeCategory });
        prismaMock.operatingSystem.findUnique.mockResolvedValue(os);
        prismaMock.osVersion.findFirst.mockResolvedValue(osVersion);
        prismaMock.flavor.findUnique.mockResolvedValue(flavor);
        prismaMock.availabilityZone.findMany.mockResolvedValue([]);
        const app = createApp();
        const res = await request(app).post(`/api/variants/product/${UUID_A}`).send({
          name: 'V1', osId: UUID_C, osVersionId: UUID_D, flavorId: UUID_E, availabilityZoneIds: [UUID_A],
        });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('availability zones');
      });

      it('rejects invalid continuity level ID', async () => {
        prismaMock.product.findUnique.mockResolvedValue({ id: UUID_A, category: computeCategory });
        prismaMock.operatingSystem.findUnique.mockResolvedValue(os);
        prismaMock.osVersion.findFirst.mockResolvedValue(osVersion);
        prismaMock.flavor.findUnique.mockResolvedValue(flavor);
        prismaMock.availabilityZone.findMany.mockResolvedValue([]);
        prismaMock.continuityLevel.findUnique.mockResolvedValue(null);
        const app = createApp();
        const res = await request(app).post(`/api/variants/product/${UUID_A}`).send({
          name: 'V1', osId: UUID_C, osVersionId: UUID_D, flavorId: UUID_E, continuityLevelId: UUID_B,
        });
        expect(res.status).toBe(404);
        expect(res.body.error).toContain('Continuity level');
      });
    });

    describe('PUT /api/variants/:id', () => {
      it('updates variant with new AZs (replaces existing)', async () => {
        prismaMock.productVariant.findUnique.mockResolvedValue({ id: UUID_A, osId: UUID_C });
        prismaMock.operatingSystem.findUnique.mockResolvedValue(os);
        prismaMock.osVersion.findFirst.mockResolvedValue(osVersion);
        prismaMock.flavor.findUnique.mockResolvedValue(flavor);
        prismaMock.availabilityZone.findMany.mockResolvedValue([az]);
        prismaMock.productVariant.update.mockResolvedValue({ id: UUID_A });

        const app = createApp();
        const res = await request(app).put(`/api/variants/${UUID_A}`).send({
          name: 'Updated', availabilityZoneIds: [UUID_A],
        });
        expect(res.status).toBe(200);
        expect(prismaMock.productVariantAvailabilityZone.deleteMany).toHaveBeenCalledWith({ where: { variantId: UUID_A } });
      });

      it('returns 404 for nonexistent variant', async () => {
        prismaMock.productVariant.findUnique.mockResolvedValue(null);
        const app = createApp();
        const res = await request(app).put(`/api/variants/${UUID_A}`).send({ name: 'X' });
        expect(res.status).toBe(404);
      });
    });

    describe('DELETE /api/variants/:id', () => {
      it('deletes variant with no instances', async () => {
        prismaMock.productVariant.findUnique.mockResolvedValue({ id: UUID_A, _count: { instances: 0 } });
        prismaMock.productVariant.delete.mockResolvedValue({});
        const app = createApp();
        const res = await request(app).delete(`/api/variants/${UUID_A}`);
        expect(res.status).toBe(204);
      });

      it('blocks deletion when instances exist', async () => {
        prismaMock.productVariant.findUnique.mockResolvedValue({ id: UUID_A, _count: { instances: 2 } });
        const app = createApp();
        const res = await request(app).delete(`/api/variants/${UUID_A}`);
        expect(res.status).toBe(409);
        expect(res.body.error).toContain('instances');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FLAVOR ROUTES
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Flavor Routes (Global)', () => {
    describe('GET /api/flavors', () => {
      it('lists all global flavors with usage counts', async () => {
        const flavors = [
          { id: UUID_A, name: 'Small', vcpu: 2, ramGb: 4, _count: { variants: 3, forecastLines: 1 } },
          { id: UUID_B, name: 'Large', vcpu: 8, ramGb: 16, _count: { variants: 1, forecastLines: 0 } },
        ];
        prismaMock.flavor.findMany.mockResolvedValue(flavors);
        const app = createApp();
        const res = await request(app).get('/api/flavors');
        expect(res.status).toBe(200);
        expect(res.body).toEqual(flavors);
      });
    });

    describe('POST /api/flavors', () => {
      it('creates a global flavor', async () => {
        const payload = { name: 'Medium', vcpu: 4, ramGb: 8, description: 'Balanced' };
        prismaMock.flavor.create.mockResolvedValue({ id: UUID_C, ...payload, _count: { variants: 0 } });
        const app = createApp();
        const res = await request(app).post('/api/flavors').send(payload);
        expect(res.status).toBe(201);
        expect(res.body.name).toBe('Medium');
      });

      it('rejects negative vCPU', async () => {
        const app = createApp();
        const res = await request(app).post('/api/flavors').send({ name: 'X', vcpu: -1, ramGb: 4 });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
      });

      it('rejects negative RAM', async () => {
        const app = createApp();
        const res = await request(app).post('/api/flavors').send({ name: 'X', vcpu: 2, ramGb: -4 });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
      });
    });

    describe('GET /api/flavors/:id', () => {
      it('returns flavor with linked variants', async () => {
        const flavor = {
          id: UUID_A, name: 'Small', vcpu: 2, ramGb: 4,
          variants: [{ product: { id: UUID_B, name: 'VM', slug: 'vm' }, os: { name: 'Debian' }, osVersion: { version: '12' } }],
          _count: { variants: 1, forecastLines: 0 },
        };
        prismaMock.flavor.findUnique.mockResolvedValue(flavor);
        const app = createApp();
        const res = await request(app).get(`/api/flavors/${UUID_A}`);
        expect(res.status).toBe(200);
        expect(res.body.variants.length).toBe(1);
      });

      it('returns 404 for nonexistent flavor', async () => {
        prismaMock.flavor.findUnique.mockResolvedValue(null);
        const app = createApp();
        const res = await request(app).get(`/api/flavors/${UUID_A}`);
        expect(res.status).toBe(404);
      });
    });

    describe('PATCH /api/flavors/:id', () => {
      it('updates flavor fields', async () => {
        prismaMock.flavor.update.mockResolvedValue({ id: UUID_A, name: 'Medium', vcpu: 4, ramGb: 8, _count: { variants: 0 } });
        const app = createApp();
        const res = await request(app).patch(`/api/flavors/${UUID_A}`).send({ name: 'Medium', vcpu: 4 });
        expect(res.status).toBe(200);
        expect(res.body.vcpu).toBe(4);
      });
    });

    describe('DELETE /api/flavors/:id', () => {
      it('deletes flavor with no relations', async () => {
        prismaMock.flavor.findUnique.mockResolvedValue({ id: UUID_A, _count: { variants: 0, forecastLines: 0 } });
        prismaMock.flavor.delete.mockResolvedValue({});
        const app = createApp();
        const res = await request(app).delete(`/api/flavors/${UUID_A}`);
        expect(res.status).toBe(204);
      });

      it('blocks deletion when variants exist', async () => {
        prismaMock.flavor.findUnique.mockResolvedValue({ id: UUID_A, _count: { variants: 2, forecastLines: 0 } });
        const app = createApp();
        const res = await request(app).delete(`/api/flavors/${UUID_A}`);
        expect(res.status).toBe(409);
        expect(res.body.error).toContain('variants');
      });

      it('blocks deletion when forecast lines exist', async () => {
        prismaMock.flavor.findUnique.mockResolvedValue({ id: UUID_A, _count: { variants: 0, forecastLines: 1 } });
        const app = createApp();
        const res = await request(app).delete(`/api/flavors/${UUID_A}`);
        expect(res.status).toBe(409);
        expect(res.body.error).toContain('forecast lines');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EDGE CASES & CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Edge Cases & Constraints', () => {
    it('computeType is optional (nullable) in schema — non-Compute product has null computeType', async () => {
      const payload = { name: 'NAS', slug: 'nas', categoryId: UUID_B };
      prismaMock.product.findUnique.mockResolvedValue(null);
      prismaMock.category.findUnique.mockResolvedValue({ id: UUID_B, slug: 'data', name: 'Data' });
      prismaMock.product.create.mockResolvedValue({ id: UUID_C, ...payload, computeType: null, category: { id: UUID_B, slug: 'data', name: 'Data' }, variants: [], _count: { variants: 0 } });

      const app = createApp();
      const res = await request(app).post('/api/products').send(payload);
      expect(res.status).toBe(201);
      expect(res.body.computeType).toBeNull();
    });

    it('ProductVariant links to OperatingSystem, OsVersion, Flavor, and AvailabilityZones', async () => {
      const computeCategory = { id: UUID_A, slug: 'compute', name: 'Compute' };
      const os = { id: UUID_C, name: 'Windows' };
      const osVersion = { id: UUID_D, version: 'Server 2022', osId: UUID_C };
      const flavor = { id: UUID_E, name: 'XL' };
      const az = { id: UUID_A, code: 'nyc1' };

      prismaMock.product.findUnique.mockResolvedValue({ id: UUID_B, category: computeCategory });
      prismaMock.operatingSystem.findUnique.mockResolvedValue(os);
      prismaMock.osVersion.findFirst.mockResolvedValue(osVersion);
      prismaMock.flavor.findUnique.mockResolvedValue(flavor);
      prismaMock.availabilityZone.findMany.mockResolvedValue([az]);
      prismaMock.productVariant.create.mockResolvedValue({
        id: UUID_A, productId: UUID_B, name: 'Win2022-XL',
        osId: UUID_C, osVersionId: UUID_D, flavorId: UUID_E,
        availabilityZones: [{ availabilityZoneId: UUID_A, availabilityZone: az }],
      });

      const app = createApp();
      const res = await request(app).post(`/api/variants/product/${UUID_B}`).send({
        name: 'Win2022-XL', osId: UUID_C, osVersionId: UUID_D, flavorId: UUID_E, availabilityZoneIds: [UUID_A],
      });
      expect(res.status).toBe(201);
      expect(res.body.osId).toBe(UUID_C);
      expect(res.body.osVersionId).toBe(UUID_D);
      expect(res.body.flavorId).toBe(UUID_E);
    });

    it('Flavor is global — no productId field', async () => {
      prismaMock.flavor.create.mockResolvedValue({ id: UUID_A, name: 'Tiny', vcpu: 1, ramGb: 2, _count: { variants: 0 } });
      const app = createApp();
      const res = await request(app).post('/api/flavors').send({ name: 'Tiny', vcpu: 1, ramGb: 2 });
      expect(res.status).toBe(201);
      expect(prismaMock.flavor.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.not.objectContaining({ productId: expect.anything() }) })
      );
    });

    it('accepts valid lifecycle phase values', async () => {
      const phases = ['RELEASED', 'NORMAL_SUPPORT', 'EXTENDED_SUPPORT', 'NO_SUPPORT', 'EOL'];
      for (const phase of phases) {
        prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: UUID_A });
        prismaMock.osVersion.create.mockResolvedValue({ id: UUID_C, phase });
        const app = createApp();
        const payload = {
          version: 'Test', releaseDate: '2021-01-01T00:00:00.000Z',
          normalSupportEnd: '2022-01-01T00:00:00.000Z',
          extendedSupportEnd: '2023-01-01T00:00:00.000Z',
          eolDate: '2024-01-01T00:00:00.000Z',
          phase,
        };
        const res = await request(app).post(`/api/os/${UUID_A}/versions`).send(payload);
        expect(res.status).toBe(201);
      }
    });
  });
});
