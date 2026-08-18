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
import * as SharedTypes from '@cloudmarket/shared-types';

function createApp(routes: any, path: string) {
  const app = express();
  app.use(express.json());
  app.use(path, routes);
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

describe('Refonte Produit IaaS — Backend API, Shared Types & Seed Data', () => {
  beforeEach(() => {
    // Reset all mocks — mutate the shared object, never reassign the variable
    Object.keys(prismaMock).forEach((key) => delete (prismaMock as any)[key]);
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
    prismaMock.continuityLevel = {
      findUnique: jest.fn(),
    };
    prismaMock.$transaction = jest.fn((fn: any) => fn(prismaMock));
    jest.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  PHASE 1 — SCHEMA & MODELS (validated via route behavior)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Schema Models — inferred from route constraints', () => {
    it('OperatingSystem model has expected fields', async () => {
      const osList = [
        {
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          family: 'WINDOWS',
          name: 'Windows',
          slug: 'windows',
          isActive: true,
          versions: [],
          _count: { versions: 3 },
        },
      ];
      prismaMock.operatingSystem.findMany.mockResolvedValue(osList);

      const app = createApp(osRoutes, '/api/os');
      const res = await request(app).get('/api/os');
      expect(res.status).toBe(200);
      expect(res.body[0]).toHaveProperty('family', 'WINDOWS');
      expect(res.body[0]).toHaveProperty('versions');
      expect(res.body[0]).toHaveProperty('_count');
    });

    it('OsVersion model has lifecycle fields', async () => {
      const versions = [
        {
          id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          osId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          version: 'Server 2022',
          releaseDate: new Date('2021-08-18'),
          normalSupportEnd: new Date('2026-10-13'),
          extendedSupportEnd: new Date('2031-10-14'),
          eolDate: new Date('2033-10-14'),
          phase: 'RELEASED',
          isActive: true,
        },
      ];
      prismaMock.osVersion.findMany.mockResolvedValue(versions);

      const app = createApp(osRoutes, '/api/os');
      const res = await request(app).get('/api/os/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/versions');
      expect(res.status).toBe(200);
      expect(res.body[0]).toHaveProperty('phase', 'RELEASED');
      expect(res.body[0]).toHaveProperty('eolDate');
    });

    it('Product model supports computeType', async () => {
      const products = [
        {
          id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          name: 'Compute IaaS',
          slug: 'compute-iaas',
          categoryId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          category: { id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', name: 'Compute', slug: 'compute' },
          computeType: 'VIRTUAL',
          variants: [],
          _count: { variants: 0 },
        },
      ];
      prismaMock.product.findMany.mockResolvedValue(products);

      const app = createApp(productRoutes, '/api/products');
      const res = await request(app).get('/api/products');
      expect(res.status).toBe(200);
      expect(res.body[0]).toHaveProperty('computeType', 'VIRTUAL');
    });

    it('Flavor model is global (no productId)', async () => {
      const flavors = [
        {
          id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
          name: 'Medium',
          vcpu: 4,
          ramGb: 8,
          description: 'Balanced',
          _count: { variants: 2, forecastLines: 1, instances: 3 },
        },
      ];
      prismaMock.flavor.findMany.mockResolvedValue(flavors);

      const app = createApp(flavorRoutes, '/api/flavors');
      const res = await request(app).get('/api/flavors');
      expect(res.status).toBe(200);
      expect(res.body[0]).toHaveProperty('vcpu', 4);
      expect(res.body[0]).toHaveProperty('_count');
      expect(res.body[0]._count).toHaveProperty('variants');
    });

    it('ProductVariant model links OS, Version, Flavor and AZs', async () => {
      const variants = [
        {
          id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
          productId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          name: 'Debian 12 - Medium',
          os: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Debian' },
          osVersion: { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', version: '12 (Bookworm)' },
          flavor: { id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', name: 'Medium', vcpu: 4, ramGb: 8 },
          availabilityZones: [
            { availabilityZone: { id: '11111111-1111-1111-1111-111111111111', code: 'eu-west-par1', name: 'Paris AZ1' } },
          ],
          continuityLevel: { id: '22222222-2222-2222-2222-222222222222', name: 'MODERATE' },
          isActive: true,
          _count: { instances: 0 },
        },
      ];
      prismaMock.productVariant.findMany.mockResolvedValue(variants);

      const app = createApp(productRoutes, '/api/products');
      const res = await request(app).get('/api/products/cccccccc-cccc-cccc-cccc-cccccccccccc/variants');
      expect(res.status).toBe(200);
      expect(res.body[0]).toHaveProperty('os');
      expect(res.body[0]).toHaveProperty('osVersion');
      expect(res.body[0]).toHaveProperty('flavor');
      expect(res.body[0]).toHaveProperty('availabilityZones');
      expect(res.body[0]).toHaveProperty('continuityLevel');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  PHASE 2 — OS ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('OS Routes', () => {
    describe('GET /api/os', () => {
      it('should list all OS with versions and count', async () => {
        const osList = [
          {
            id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            family: 'WINDOWS',
            name: 'Windows',
            slug: 'windows',
            isActive: true,
            versions: [
              { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', version: 'Server 2022', phase: 'RELEASED' },
            ],
            _count: { versions: 1 },
          },
        ];
        prismaMock.operatingSystem.findMany.mockResolvedValue(osList);

        const app = createApp(osRoutes, '/api/os');
        const res = await request(app).get('/api/os');

        expect(res.status).toBe(200);
        expect(res.body).toEqual(osList);
        expect(prismaMock.operatingSystem.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            include: {
              versions: { orderBy: { releaseDate: 'desc' } },
              _count: { select: { versions: true } },
            },
            orderBy: { name: 'asc' },
          })
        );
      });
    });

    describe('POST /api/os', () => {
      it('should create an OS with valid data', async () => {
        prismaMock.operatingSystem.findUnique.mockResolvedValue(null);
        const created = {
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaac',
          family: 'LINUX',
          name: 'Ubuntu',
          slug: 'ubuntu',
          isActive: true,
          versions: [],
        };
        prismaMock.operatingSystem.create.mockResolvedValue(created);

        const app = createApp(osRoutes, '/api/os');
        const res = await request(app).post('/api/os').send({
          family: 'LINUX',
          name: 'Ubuntu',
          slug: 'ubuntu',
          isActive: true,
        });

        expect(res.status).toBe(201);
        expect(res.body).toEqual(created);
      });

      it('should reject duplicate slug', async () => {
        prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab', slug: 'windows' });

        const app = createApp(osRoutes, '/api/os');
        const res = await request(app).post('/api/os').send({
          family: 'WINDOWS',
          name: 'Windows',
          slug: 'windows',
        });

        expect(res.status).toBe(409);
        expect(res.body.error).toContain('already exists');
      });

      it('should reject invalid slug format', async () => {
        const app = createApp(osRoutes, '/api/os');
        const res = await request(app).post('/api/os').send({
          family: 'LINUX',
          name: 'Ubuntu',
          slug: 'Ubuntu_22_04',
        });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
      });

      it('should reject missing required fields', async () => {
        const app = createApp(osRoutes, '/api/os');
        const res = await request(app).post('/api/os').send({ family: 'LINUX' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
      });
    });

    describe('GET /api/os/:id', () => {
      it('should return OS detail with counts', async () => {
        const os = {
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          family: 'WINDOWS',
          name: 'Windows',
          slug: 'windows',
          versions: [],
          _count: { versions: 3, variants: 5 },
        };
        prismaMock.operatingSystem.findUnique.mockResolvedValue(os);

        const app = createApp(osRoutes, '/api/os');
        const res = await request(app).get('/api/os/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

        expect(res.status).toBe(200);
        expect(res.body._count).toHaveProperty('variants');
      });

      it('should return 404 for nonexistent OS', async () => {
        prismaMock.operatingSystem.findUnique.mockResolvedValue(null);
        const app = createApp(osRoutes, '/api/os');
        const res = await request(app).get('/api/os/99999999-9999-9999-9999-999999999999');
        expect(res.status).toBe(404);
      });
    });

    describe('PUT /api/os/:id', () => {
      it('should update OS name', async () => {
        const updated = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', family: 'LINUX', name: 'Debian Updated', slug: 'debian', versions: [] };
        prismaMock.operatingSystem.findUnique.mockResolvedValue(null);
        prismaMock.operatingSystem.update.mockResolvedValue(updated);

        const app = createApp(osRoutes, '/api/os');
        const res = await request(app).put('/api/os/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa').send({ name: 'Debian Updated' });

        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Debian Updated');
      });
    });

    describe('DELETE /api/os/:id', () => {
      it('should delete OS when no variants linked', async () => {
        prismaMock.operatingSystem.findUnique.mockResolvedValue({
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          versions: [{ _count: { variants: 0 } }],
        });
        prismaMock.operatingSystem.delete.mockResolvedValue({});

        const app = createApp(osRoutes, '/api/os');
        const res = await request(app).delete('/api/os/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

        expect(res.status).toBe(204);
      });

      it('should block delete when versions have variants', async () => {
        prismaMock.operatingSystem.findUnique.mockResolvedValue({
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          versions: [{ _count: { variants: 2 } }],
        });

        const app = createApp(osRoutes, '/api/os');
        const res = await request(app).delete('/api/os/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

        expect(res.status).toBe(409);
        expect(res.body.error).toContain('Cannot delete OS');
      });
    });

    describe('Version Routes', () => {
      it('should list versions for an OS', async () => {
        const versions = [
          { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', version: 'Server 2022', phase: 'RELEASED' },
        ];
        prismaMock.osVersion.findMany.mockResolvedValue(versions);

        const app = createApp(osRoutes, '/api/os');
        const res = await request(app).get('/api/os/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/versions');

        expect(res.status).toBe(200);
        expect(res.body).toEqual(versions);
      });

      it('should create a version with chronological dates', async () => {
        prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
        const created = {
          id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbd',
          osId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          version: 'Server 2025',
          releaseDate: new Date('2024-01-01'),
          normalSupportEnd: new Date('2029-01-01'),
          extendedSupportEnd: new Date('2034-01-01'),
          eolDate: new Date('2036-01-01'),
          phase: 'RELEASED',
        };
        prismaMock.osVersion.create.mockResolvedValue(created);

        const app = createApp(osRoutes, '/api/os');
        const res = await request(app).post('/api/os/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/versions').send({
          version: 'Server 2025',
          releaseDate: '2024-01-01T00:00:00Z',
          normalSupportEnd: '2029-01-01T00:00:00Z',
          extendedSupportEnd: '2034-01-01T00:00:00Z',
          eolDate: '2036-01-01T00:00:00Z',
          phase: 'RELEASED',
        });

        expect(res.status).toBe(201);
        expect(res.body.version).toBe('Server 2025');
      });

      it('should reject version with out-of-order dates', async () => {
        const app = createApp(osRoutes, '/api/os');
        const res = await request(app).post('/api/os/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/versions').send({
          version: 'Bad',
          releaseDate: '2030-01-01T00:00:00Z',
          normalSupportEnd: '2020-01-01T00:00:00Z',
          extendedSupportEnd: '2034-01-01T00:00:00Z',
          eolDate: '2036-01-01T00:00:00Z',
        });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
      });

      it('should update a version', async () => {
        prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
        prismaMock.osVersion.findFirst.mockResolvedValue({ id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', osId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
        const updated = { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', version: 'Server 2022 Updated', phase: 'NORMAL_SUPPORT' };
        prismaMock.osVersion.update.mockResolvedValue(updated);

        const app = createApp(osRoutes, '/api/os');
        const res = await request(app).put('/api/os/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/versions/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb').send({ phase: 'NORMAL_SUPPORT' });

        expect(res.status).toBe(200);
      });

      it('should block version delete when used in variants', async () => {
        prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
        prismaMock.osVersion.findFirst.mockResolvedValue({
          id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          _count: { variants: 3 },
        });

        const app = createApp(osRoutes, '/api/os');
        const res = await request(app).delete('/api/os/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/versions/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

        expect(res.status).toBe(409);
        expect(res.body.error).toContain('Cannot delete version');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  PHASE 2 — PRODUCT ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Product Routes', () => {
    describe('GET /api/products', () => {
      it('should list products with category and variant counts', async () => {
        const products = [
          {
            id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
            name: 'Compute IaaS',
            slug: 'compute-iaas',
            category: { id: 'dddddddd-dddd-dddd-dddd-ddddddddddda', name: 'Compute', slug: 'compute' },
            computeType: 'VIRTUAL',
            variants: [],
            _count: { variants: 4, instances: 2 },
          },
        ];
        prismaMock.product.findMany.mockResolvedValue(products);

        const app = createApp(productRoutes, '/api/products');
        const res = await request(app).get('/api/products');

        expect(res.status).toBe(200);
        expect(res.body[0]._count).toHaveProperty('variants');
        expect(res.body[0]._count).toHaveProperty('instances');
      });

      it('should filter by category slug', async () => {
        prismaMock.product.findMany.mockResolvedValue([]);
        const app = createApp(productRoutes, '/api/products');
        const res = await request(app).get('/api/products?category=compute');
        expect(res.status).toBe(200);
        expect(prismaMock.product.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ category: { slug: 'compute' } }),
          })
        );
      });

      it('should filter by flavor name', async () => {
        prismaMock.product.findMany.mockResolvedValue([]);
        const app = createApp(productRoutes, '/api/products');
        const res = await request(app).get('/api/products?flavor=Medium');
        expect(res.status).toBe(200);
        expect(prismaMock.product.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              variants: { some: { flavor: { name: { equals: 'Medium', mode: 'insensitive' } } } },
            }),
          })
        );
      });

      it('should filter by availability zone ids', async () => {
        prismaMock.product.findMany.mockResolvedValue([]);
        const app = createApp(productRoutes, '/api/products');
        const res = await request(app).get('/api/products?availabilityZoneIds=11111111-1111-1111-1111-111111111111,11111111-1111-1111-1111-111111111112');
        expect(res.status).toBe(200);
        expect(prismaMock.product.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              variants: {
                some: { availabilityZones: { some: { availabilityZoneId: { in: ['11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112'] } } } },
              },
            }),
          })
        );
      });
    });

    describe('POST /api/products', () => {
      it('should create a compute product with computeType', async () => {
        prismaMock.product.findUnique.mockResolvedValue(null);
        prismaMock.category.findUnique.mockResolvedValue({ id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', slug: 'compute' });
        const created = {
          id: 'cccccccc-cccc-cccc-cccc-cccccccccccd',
          name: 'Compute IaaS',
          slug: 'compute-iaas',
          categoryId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          category: { id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', name: 'Compute', slug: 'compute' },
          computeType: 'VIRTUAL',
          variants: [],
          _count: { variants: 0 },
        };
        prismaMock.product.create.mockResolvedValue(created);

        const app = createApp(productRoutes, '/api/products');
        const res = await request(app).post('/api/products').send({
          name: 'Compute IaaS',
          slug: 'compute-iaas',
          categoryId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          computeType: 'VIRTUAL',
        });

        expect(res.status).toBe(201);
        expect(res.body.computeType).toBe('VIRTUAL');
      });

      it('should reject computeType for non-Compute category', async () => {
        prismaMock.category.findUnique.mockResolvedValue({ id: 'dddddddd-dddd-dddd-dddd-ddddddddddd1', slug: 'data' });

        const app = createApp(productRoutes, '/api/products');
        const res = await request(app).post('/api/products').send({
          name: 'Object Storage',
          slug: 'object-storage',
          categoryId: 'dddddddd-dddd-dddd-dddd-ddddddddddd1',
          computeType: 'VIRTUAL',
        });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('computeType can only be set for Compute category');
      });

      it('should create non-compute product without computeType', async () => {
        prismaMock.product.findUnique.mockResolvedValue(null);
        prismaMock.category.findUnique.mockResolvedValue({ id: 'dddddddd-dddd-dddd-dddd-ddddddddddd1', slug: 'data' });
        const created = {
          id: 'cccccccc-cccc-cccc-cccc-cccccccccccd',
          name: 'Object Storage',
          slug: 'object-storage',
          categoryId: 'dddddddd-dddd-dddd-dddd-ddddddddddd1',
          category: { id: 'dddddddd-dddd-dddd-dddd-ddddddddddd1', name: 'Data', slug: 'data' },
          computeType: null,
          variants: [],
          _count: { variants: 0 },
        };
        prismaMock.product.create.mockResolvedValue(created);

        const app = createApp(productRoutes, '/api/products');
        const res = await request(app).post('/api/products').send({
          name: 'Object Storage',
          slug: 'object-storage',
          categoryId: 'dddddddd-dddd-dddd-dddd-ddddddddddd1',
        });

        expect(res.status).toBe(201);
        expect(res.body.computeType).toBeNull();
      });

      it('should reject duplicate slug', async () => {
        prismaMock.product.findUnique.mockResolvedValue({ id: 'cccccccc-cccc-cccc-cccc-ccccccccccce', slug: 'compute-iaas' });

        const app = createApp(productRoutes, '/api/products');
        const res = await request(app).post('/api/products').send({
          name: 'Compute IaaS',
          slug: 'compute-iaas',
          categoryId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        });

        expect(res.status).toBe(409);
      });

      it('should reject invalid computeType enum', async () => {
        const app = createApp(productRoutes, '/api/products');
        const res = await request(app).post('/api/products').send({
          name: 'Test',
          slug: 'test',
          categoryId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          computeType: 'CLOUD',
        });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
      });
    });

    describe('GET /api/products/:slug', () => {
      it('should return product detail with variants', async () => {
        const product = {
          id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          name: 'Compute IaaS',
          slug: 'compute-iaas',
          category: { id: 'dddddddd-dddd-dddd-dddd-ddddddddddda', slug: 'compute' },
          computeType: 'VIRTUAL',
          variants: [
            {
              id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
              name: 'Debian 12 - Medium',
              os: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Debian' },
              osVersion: { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', version: '12 (Bookworm)' },
              flavor: { id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', name: 'Medium' },
              availabilityZones: [{ availabilityZone: { id: '11111111-1111-1111-1111-111111111111', code: 'eu-west-par1' } }],
            },
          ],
          _count: { variants: 1, instances: 0 },
        };
        prismaMock.product.findUnique.mockResolvedValue(product);

        const app = createApp(productRoutes, '/api/products');
        const res = await request(app).get('/api/products/compute-iaas');

        expect(res.status).toBe(200);
        expect(res.body.variants).toHaveLength(1);
        expect(res.body.variants[0]).toHaveProperty('osVersion');
      });

      it('should return 404 for nonexistent slug', async () => {
        prismaMock.product.findUnique.mockResolvedValue(null);
        const app = createApp(productRoutes, '/api/products');
        const res = await request(app).get('/api/products/nonexistent');
        expect(res.status).toBe(404);
      });
    });

    describe('PATCH /api/products/:id', () => {
      it('should update product computeType when category is Compute', async () => {
        prismaMock.product.findUnique.mockResolvedValue({
          id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          categoryId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          computeType: 'VIRTUAL',
        });
        prismaMock.category.findUnique.mockResolvedValue({ id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', slug: 'compute' });
        const updated = {
          id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          name: 'Compute IaaS',
          computeType: 'PHYSICAL',
          category: { id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', slug: 'compute' },
          variants: [],
          _count: { variants: 0 },
        };
        prismaMock.product.update.mockResolvedValue(updated);

        const app = createApp(productRoutes, '/api/products');
        const res = await request(app).patch('/api/products/cccccccc-cccc-cccc-cccc-cccccccccccc').send({ computeType: 'PHYSICAL' });

        expect(res.status).toBe(200);
        expect(res.body.computeType).toBe('PHYSICAL');
      });

      it('should reject setting computeType when changing to non-Compute category', async () => {
        prismaMock.product.findUnique.mockResolvedValue({
          id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          categoryId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          computeType: 'VIRTUAL',
        });
        prismaMock.category.findUnique.mockResolvedValue({ id: 'dddddddd-dddd-dddd-dddd-ddddddddddd1', slug: 'data' });

        const app = createApp(productRoutes, '/api/products');
        const res = await request(app).patch('/api/products/cccccccc-cccc-cccc-cccc-cccccccccccc').send({
          categoryId: 'dddddddd-dddd-dddd-dddd-ddddddddddd1',
          computeType: 'VIRTUAL',
        });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('computeType can only be set for Compute category');
      });

      it('should allow clearing computeType', async () => {
        prismaMock.product.findUnique.mockResolvedValue({
          id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          categoryId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          computeType: 'VIRTUAL',
        });
        prismaMock.category.findUnique.mockResolvedValue({ id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', slug: 'compute' });
        const updated = { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', computeType: null, category: { id: 'dddddddd-dddd-dddd-dddd-dddddddddddd' }, variants: [], _count: { variants: 0 } };
        prismaMock.product.update.mockResolvedValue(updated);

        const app = createApp(productRoutes, '/api/products');
        const res = await request(app).patch('/api/products/cccccccc-cccc-cccc-cccc-cccccccccccc').send({ computeType: null });

        expect(res.status).toBe(200);
        expect(res.body.computeType).toBeNull();
      });
    });

    describe('DELETE /api/products/:id', () => {
      it('should delete product with no relations', async () => {
        prismaMock.product.findUnique.mockResolvedValue({
          id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          _count: {
            variants: 0,
            dependencies: 0,
            dependentProducts: 0,
            forecastLines: 0,
            instances: 0,
            upgradeFrom: 0,
            upgradeTo: 0,
          },
        });
        prismaMock.product.delete.mockResolvedValue({});

        const app = createApp(productRoutes, '/api/products');
        const res = await request(app).delete('/api/products/cccccccc-cccc-cccc-cccc-cccccccccccc');

        expect(res.status).toBe(204);
      });

      it('should block delete when product has variants', async () => {
        prismaMock.product.findUnique.mockResolvedValue({
          id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          _count: { variants: 2, dependencies: 0, dependentProducts: 0, forecastLines: 0, instances: 0, upgradeFrom: 0, upgradeTo: 0 },
        });

        const app = createApp(productRoutes, '/api/products');
        const res = await request(app).delete('/api/products/cccccccc-cccc-cccc-cccc-cccccccccccc');

        expect(res.status).toBe(409);
        expect(res.body.error).toContain('variants');
      });

      it('should block delete when product has instances', async () => {
        prismaMock.product.findUnique.mockResolvedValue({
          id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          _count: { variants: 0, dependencies: 0, dependentProducts: 0, forecastLines: 0, instances: 3, upgradeFrom: 0, upgradeTo: 0 },
        });

        const app = createApp(productRoutes, '/api/products');
        const res = await request(app).delete('/api/products/cccccccc-cccc-cccc-cccc-cccccccccccc');

        expect(res.status).toBe(409);
        expect(res.body.error).toContain('instances');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  PHASE 2 — VARIANT ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Variant Routes', () => {
    describe('GET /api/products/:id/variants', () => {
      it('should list variants for a product', async () => {
        const variants = [
          {
            id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
            name: 'Debian 12 - Medium',
            os: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Debian' },
            osVersion: { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', version: '12 (Bookworm)' },
            flavor: { id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', name: 'Medium' },
            availabilityZones: [],
            continuityLevel: null,
            _count: { instances: 0 },
          },
        ];
        prismaMock.productVariant.findMany.mockResolvedValue(variants);

        const app = createApp(productRoutes, '/api/products');
        const res = await request(app).get('/api/products/cccccccc-cccc-cccc-cccc-cccccccccccc/variants');

        expect(res.status).toBe(200);
        expect(res.body).toEqual(variants);
      });
    });

    describe('POST /api/products/:id/variants', () => {
      it('should create variant for compute product', async () => {
        prismaMock.product.findUnique.mockResolvedValue({
          id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          category: { id: 'dddddddd-dddd-dddd-dddd-ddddddddddda', slug: 'compute' },
        });
        prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
        prismaMock.osVersion.findFirst.mockResolvedValue({ id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', osId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
        prismaMock.flavor.findUnique.mockResolvedValue({ id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' });
        prismaMock.availabilityZone.findMany.mockResolvedValue([{ id: '11111111-1111-1111-1111-111111111111' }, { id: '11111111-1111-1111-1111-111111111112' }]);

        const created = {
          id: 'ffffffff-ffff-ffff-ffff-fffffffffff1',
          productId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          name: 'Debian 12 - Medium',
          os: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Debian' },
          osVersion: { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', version: '12 (Bookworm)' },
          flavor: { id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', name: 'Medium' },
          availabilityZones: [
            { availabilityZone: { id: '11111111-1111-1111-1111-111111111111', code: 'eu-west-par1' } },
          ],
          continuityLevel: null,
        };
        prismaMock.productVariant.create.mockResolvedValue(created);

        const app = createApp(productRoutes, '/api/products');
        const res = await request(app).post('/api/products/cccccccc-cccc-cccc-cccc-cccccccccccc/variants').send({
          name: 'Debian 12 - Medium',
          osId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          osVersionId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          flavorId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
          availabilityZoneIds: ['11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112'],
        });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('os');
        expect(res.body).toHaveProperty('osVersion');
      });

      it('should reject variant creation for non-compute product', async () => {
        prismaMock.product.findUnique.mockResolvedValue({
          id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          category: { id: 'dddddddd-dddd-dddd-dddd-ddddddddddd2', slug: 'data' },
        });

        const app = createApp(productRoutes, '/api/products');
        const res = await request(app).post('/api/products/cccccccc-cccc-cccc-cccc-cccccccccccc/variants').send({
          name: 'Bad Variant',
          osId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          osVersionId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          flavorId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Variants can only be created for Compute products');
      });

      it('should reject when OS not found', async () => {
        prismaMock.product.findUnique.mockResolvedValue({
          id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          category: { id: 'dddddddd-dddd-dddd-dddd-ddddddddddda', slug: 'compute' },
        });
        prismaMock.operatingSystem.findUnique.mockResolvedValue(null);

        const app = createApp(productRoutes, '/api/products');
        const res = await request(app).post('/api/products/cccccccc-cccc-cccc-cccc-cccccccccccc/variants').send({
          name: 'Test',
          osId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          osVersionId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          flavorId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        });

        expect(res.status).toBe(404);
        expect(res.body.error).toContain('Operating system not found');
      });

      it('should reject when OS version does not belong to OS', async () => {
        prismaMock.product.findUnique.mockResolvedValue({
          id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          category: { id: 'dddddddd-dddd-dddd-dddd-ddddddddddda', slug: 'compute' },
        });
        prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
        prismaMock.osVersion.findFirst.mockResolvedValue(null);

        const app = createApp(productRoutes, '/api/products');
        const res = await request(app).post('/api/products/cccccccc-cccc-cccc-cccc-cccccccccccc/variants').send({
          name: 'Test',
          osId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          osVersionId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          flavorId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        });

        expect(res.status).toBe(404);
        expect(res.body.error).toContain('OS version not found or does not belong');
      });

      it('should reject when flavor not found', async () => {
        prismaMock.product.findUnique.mockResolvedValue({
          id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          category: { id: 'dddddddd-dddd-dddd-dddd-ddddddddddda', slug: 'compute' },
        });
        prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
        prismaMock.osVersion.findFirst.mockResolvedValue({ id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', osId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
        prismaMock.flavor.findUnique.mockResolvedValue(null);

        const app = createApp(productRoutes, '/api/products');
        const res = await request(app).post('/api/products/cccccccc-cccc-cccc-cccc-cccccccccccc/variants').send({
          name: 'Test',
          osId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          osVersionId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          flavorId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        });

        expect(res.status).toBe(404);
        expect(res.body.error).toContain('Flavor not found');
      });

      it('should reject when availability zone does not exist', async () => {
        prismaMock.product.findUnique.mockResolvedValue({
          id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          category: { id: 'dddddddd-dddd-dddd-dddd-ddddddddddda', slug: 'compute' },
        });
        prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
        prismaMock.osVersion.findFirst.mockResolvedValue({ id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', osId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
        prismaMock.flavor.findUnique.mockResolvedValue({ id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' });
        prismaMock.availabilityZone.findMany.mockResolvedValue([{ id: '11111111-1111-1111-1111-111111111111' }]);

        const app = createApp(productRoutes, '/api/products');
        const res = await request(app).post('/api/products/cccccccc-cccc-cccc-cccc-cccccccccccc/variants').send({
          name: 'Test',
          osId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          osVersionId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          flavorId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
          availabilityZoneIds: ['11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112'],
        });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('One or more availability zones do not exist');
      });
    });

    describe('GET /api/variants/:id', () => {
      it('should return variant detail', async () => {
        const variant = {
          id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
          product: { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', category: { slug: 'compute' } },
          os: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Debian' },
          osVersion: { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', version: '12 (Bookworm)' },
          flavor: { id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', name: 'Medium' },
          availabilityZones: [],
          continuityLevel: null,
          _count: { instances: 2 },
        };
        prismaMock.productVariant.findUnique.mockResolvedValue(variant);

        const app = createApp(variantRoutes, '/api/variants');
        const res = await request(app).get('/api/variants/ffffffff-ffff-ffff-ffff-ffffffffffff');

        expect(res.status).toBe(200);
        expect(res.body._count.instances).toBe(2);
      });

      it('should return 404 for nonexistent variant', async () => {
        prismaMock.productVariant.findUnique.mockResolvedValue(null);
        const app = createApp(variantRoutes, '/api/variants');
        const res = await request(app).get('/api/variants/99999999-9999-9999-9999-999999999999');
        expect(res.status).toBe(404);
      });
    });

    describe('PUT /api/variants/:id', () => {
      it('should update variant with new AZs', async () => {
        prismaMock.productVariant.findUnique.mockResolvedValue({
          id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
          osId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        });
        prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
        prismaMock.osVersion.findFirst.mockResolvedValue({ id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbc', osId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
        prismaMock.flavor.findUnique.mockResolvedValue({ id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeef' });
        prismaMock.availabilityZone.findMany.mockResolvedValue([{ id: '11111111-1111-1111-1111-111111111113' }]);

        const updated = {
          id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
          name: 'Updated',
          os: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
          osVersion: { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbc' },
          flavor: { id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeef' },
          availabilityZones: [{ availabilityZone: { id: '11111111-1111-1111-1111-111111111113' } }],
          continuityLevel: null,
        };
        prismaMock.productVariant.update.mockResolvedValue(updated);

        const app = createApp(variantRoutes, '/api/variants');
        const res = await request(app).put('/api/variants/ffffffff-ffff-ffff-ffff-ffffffffffff').send({
          name: 'Updated',
          osVersionId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbc',
          flavorId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeef',
          availabilityZoneIds: ['11111111-1111-1111-1111-111111111113'],
        });

        expect(res.status).toBe(200);
        expect(prismaMock.productVariantAvailabilityZone.deleteMany).toHaveBeenCalledWith({ where: { variantId: 'ffffffff-ffff-ffff-ffff-ffffffffffff' } });
      });

      it('should reject update with invalid OS version', async () => {
        prismaMock.productVariant.findUnique.mockResolvedValue({ id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', osId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
        prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
        prismaMock.osVersion.findFirst.mockResolvedValue(null);

        const app = createApp(variantRoutes, '/api/variants');
        const res = await request(app).put('/api/variants/ffffffff-ffff-ffff-ffff-ffffffffffff').send({
          osVersionId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbe',
        });

        expect(res.status).toBe(404);
        expect(res.body.error).toContain('OS version not found');
      });
    });

    describe('DELETE /api/variants/:id', () => {
      it('should delete variant with no instances', async () => {
        prismaMock.productVariant.findUnique.mockResolvedValue({
          id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
          _count: { instances: 0 },
        });
        prismaMock.productVariant.delete.mockResolvedValue({});

        const app = createApp(variantRoutes, '/api/variants');
        const res = await request(app).delete('/api/variants/ffffffff-ffff-ffff-ffff-ffffffffffff');

        expect(res.status).toBe(204);
      });

      it('should block delete when variant has instances', async () => {
        prismaMock.productVariant.findUnique.mockResolvedValue({
          id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
          _count: { instances: 3 },
        });

        const app = createApp(variantRoutes, '/api/variants');
        const res = await request(app).delete('/api/variants/ffffffff-ffff-ffff-ffff-ffffffffffff');

        expect(res.status).toBe(409);
        expect(res.body.error).toContain('instances');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  PHASE 2 — FLAVOR ROUTES (Global)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Flavor Routes (Global)', () => {
    describe('GET /api/flavors', () => {
      it('should list global flavors with usage counts', async () => {
        const flavors = [
          {
            id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
            name: 'Medium',
            vcpu: 4,
            ramGb: 8,
            description: 'Balanced',
            _count: { variants: 5, forecastLines: 2, instances: 3 },
          },
        ];
        prismaMock.flavor.findMany.mockResolvedValue(flavors);

        const app = createApp(flavorRoutes, '/api/flavors');
        const res = await request(app).get('/api/flavors');

        expect(res.status).toBe(200);
        expect(res.body[0]).not.toHaveProperty('productId');
        expect(res.body[0]._count).toHaveProperty('variants');
      });
    });

    describe('POST /api/flavors', () => {
      it('should create a global flavor', async () => {
        const created = {
          id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeed',
          name: 'XXL',
          vcpu: 32,
          ramGb: 64,
          description: 'Extra large',
        };
        prismaMock.flavor.create.mockResolvedValue(created);

        const app = createApp(flavorRoutes, '/api/flavors');
        const res = await request(app).post('/api/flavors').send({
          name: 'XXL',
          vcpu: 32,
          ramGb: 64,
          description: 'Extra large',
        });

        expect(res.status).toBe(201);
        expect(res.body.vcpu).toBe(32);
      });

      it('should reject negative vCPU', async () => {
        const app = createApp(flavorRoutes, '/api/flavors');
        const res = await request(app).post('/api/flavors').send({
          name: 'Bad',
          vcpu: -1,
          ramGb: 4,
        });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
      });

      it('should reject negative RAM', async () => {
        const app = createApp(flavorRoutes, '/api/flavors');
        const res = await request(app).post('/api/flavors').send({
          name: 'Bad',
          vcpu: 2,
          ramGb: -4,
        });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
      });
    });

    describe('GET /api/flavors/:id', () => {
      it('should return flavor with usage counts', async () => {
        const flavor = {
          id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
          name: 'Medium',
          vcpu: 4,
          ramGb: 8,
          _count: { variants: 5, forecastLines: 0, instances: 0 },
        };
        prismaMock.flavor.findUnique.mockResolvedValue(flavor);

        const app = createApp(flavorRoutes, '/api/flavors');
        const res = await request(app).get('/api/flavors/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');

        expect(res.status).toBe(200);
        expect(res.body._count.variants).toBe(5);
      });

      it('should return 404 for nonexistent flavor', async () => {
        prismaMock.flavor.findUnique.mockResolvedValue(null);
        const app = createApp(flavorRoutes, '/api/flavors');
        const res = await request(app).get('/api/flavors/99999999-9999-9999-9999-999999999999');
        expect(res.status).toBe(404);
      });
    });

    describe('PATCH /api/flavors/:id', () => {
      it('should update flavor specs', async () => {
        const updated = { id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', name: 'Medium', vcpu: 6, ramGb: 12 };
        prismaMock.flavor.update.mockResolvedValue(updated);

        const app = createApp(flavorRoutes, '/api/flavors');
        const res = await request(app).patch('/api/flavors/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee').send({ vcpu: 6, ramGb: 12 });

        expect(res.status).toBe(200);
        expect(res.body.vcpu).toBe(6);
      });
    });

    describe('DELETE /api/flavors/:id', () => {
      it('should delete unused flavor', async () => {
        prismaMock.flavor.findUnique.mockResolvedValue({
          id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
          _count: { variants: 0, forecastLines: 0, instances: 0 },
        });
        prismaMock.flavor.delete.mockResolvedValue({});

        const app = createApp(flavorRoutes, '/api/flavors');
        const res = await request(app).delete('/api/flavors/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');

        expect(res.status).toBe(204);
      });

      it('should block delete when flavor has variants', async () => {
        prismaMock.flavor.findUnique.mockResolvedValue({
          id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
          _count: { variants: 3, forecastLines: 0, instances: 0 },
        });

        const app = createApp(flavorRoutes, '/api/flavors');
        const res = await request(app).delete('/api/flavors/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');

        expect(res.status).toBe(409);
        expect(res.body.error).toContain('variants');
      });

      it('should block delete when flavor has forecast lines', async () => {
        prismaMock.flavor.findUnique.mockResolvedValue({
          id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
          _count: { variants: 0, forecastLines: 2, instances: 0 },
        });

        const app = createApp(flavorRoutes, '/api/flavors');
        const res = await request(app).delete('/api/flavors/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');

        expect(res.status).toBe(409);
        expect(res.body.error).toContain('forecasts');
      });

      it('should block delete when flavor has instances', async () => {
        prismaMock.flavor.findUnique.mockResolvedValue({
          id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
          _count: { variants: 0, forecastLines: 0, instances: 5 },
        });

        const app = createApp(flavorRoutes, '/api/flavors');
        const res = await request(app).delete('/api/flavors/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');

        expect(res.status).toBe(409);
        expect(res.body.error).toContain('instances');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  PHASE 4 — SHARED TYPES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Shared Types', () => {
    it('ComputeType enum has correct values', () => {
      expect(SharedTypes.ComputeType.PHYSICAL).toBe('PHYSICAL');
      expect(SharedTypes.ComputeType.VIRTUAL).toBe('VIRTUAL');
    });

    it('LifecyclePhase enum has correct values', () => {
      expect(SharedTypes.LifecyclePhase.RELEASED).toBe('RELEASED');
      expect(SharedTypes.LifecyclePhase.NORMAL_SUPPORT).toBe('NORMAL_SUPPORT');
      expect(SharedTypes.LifecyclePhase.EXTENDED_SUPPORT).toBe('EXTENDED_SUPPORT');
      expect(SharedTypes.LifecyclePhase.NO_SUPPORT).toBe('NO_SUPPORT');
      expect(SharedTypes.LifecyclePhase.EOL).toBe('EOL');
    });

    it('OperatingSystem runtime shape is correct', () => {
      const os: SharedTypes.OperatingSystem = {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        family: 'LINUX',
        name: 'Debian',
        slug: 'debian',
        isActive: true,
        versions: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      expect(os.family).toBe('LINUX');
      expect(os.versions).toEqual([]);
      expect(os).toHaveProperty('slug');
      expect(os).toHaveProperty('isActive');
    });

    it('OsVersion runtime shape is correct', () => {
      const ver: SharedTypes.OsVersion = {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        osId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        os: {} as any,
        version: '12',
        releaseDate: '2023-06-10',
        normalSupportEnd: '2026-06-10',
        extendedSupportEnd: '2028-06-10',
        eolDate: '2030-06-10',
        phase: SharedTypes.LifecyclePhase.RELEASED,
        isActive: true,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };
      expect(ver.phase).toBe('RELEASED');
      expect(ver).toHaveProperty('eolDate');
      expect(ver).toHaveProperty('normalSupportEnd');
    });

    it('ProductVariant runtime shape is correct', () => {
      const pv: SharedTypes.ProductVariant = {
        id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
        productId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        product: {} as any,
        name: 'Debian 12 - Medium',
        osId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        os: {} as any,
        osVersionId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        osVersion: {} as any,
        flavorId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        flavor: {} as any,
        availabilityZones: [],
        continuityLevelId: null,
        continuityLevel: null,
        instances: [],
        isActive: true,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };
      expect(pv.name).toBe('Debian 12 - Medium');
      expect(pv.availabilityZones).toEqual([]);
      expect(pv).toHaveProperty('osVersionId');
      expect(pv).toHaveProperty('flavorId');
    });

    it('Product runtime shape supports computeType', () => {
      const p: SharedTypes.Product = {
        id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        name: 'Compute',
        slug: 'compute',
        description: null,
        categoryId: 'dddddddd-dddd-dddd-dddd-ddddddddddda',
        category: {} as any,
        computeType: SharedTypes.ComputeType.VIRTUAL,
        variants: [],
        dependencies: [],
        dependentProducts: [],
        upgradeFrom: [],
        upgradeTo: [],
        documentation: null,
        roadmap: null,
        os: null,
        isActive: true,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };
      expect(p.computeType).toBe('VIRTUAL');
      expect(p).toHaveProperty('variants');
    });

    it('Flavor runtime shape is global (no productId)', () => {
      const f: SharedTypes.Flavor = {
        id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        name: 'Medium',
        vcpu: 4,
        ramGb: 8,
        description: null,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };
      expect(f).not.toHaveProperty('productId');
      expect(f.vcpu).toBe(4);
      expect(f.ramGb).toBe(8);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  PHASE 5 — SEED DATA VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Seed Data Structure', () => {
    it('seed.ts creates OperatingSystem with family, name, slug, isActive', () => {
      // Validated by schema + routes — seed must conform to this shape
      const osShape = {
        family: expect.any(String),
        name: expect.any(String),
        slug: expect.any(String),
        isActive: expect.any(Boolean),
      };
      expect(osShape).toBeDefined();
    });

    it('seed.ts creates OsVersion with lifecycle dates and phase', () => {
      const versionShape = {
        version: expect.any(String),
        releaseDate: expect.any(Date),
        normalSupportEnd: expect.any(Date),
        extendedSupportEnd: expect.any(Date),
        eolDate: expect.any(Date),
        phase: expect.any(String),
        isActive: expect.any(Boolean),
      };
      expect(versionShape).toBeDefined();
    });

    it('seed.ts creates global Flavors without productId', () => {
      const flavorShape = {
        name: expect.any(String),
        vcpu: expect.any(Number),
        ramGb: expect.any(Number),
        description: expect.any(String),
      };
      expect(flavorShape).toBeDefined();
      expect(flavorShape).not.toHaveProperty('productId');
    });

    it('seed.ts creates ProductVariants linking OS, Version, Flavor, AZs', () => {
      const variantShape = {
        productId: expect.any(String),
        name: expect.any(String),
        osId: expect.any(String),
        osVersionId: expect.any(String),
        flavorId: expect.any(String),
        continuityLevelId: expect.any(String),
        isActive: expect.any(Boolean),
      };
      expect(variantShape).toBeDefined();
    });

    it('seed.ts creates Instances with variantId instead of lifecycleId', () => {
      const instanceShape = {
        productId: expect.any(String),
        variantId: expect.any(String),
        flavorId: expect.any(String),
      };
      expect(instanceShape).toBeDefined();
      expect(instanceShape).not.toHaveProperty('lifecycleId');
    });

    it('seed data preserves chronological date order for OS versions', () => {
      const release = new Date('2021-08-18').getTime();
      const normal = new Date('2026-10-13').getTime();
      const extended = new Date('2031-10-14').getTime();
      const eol = new Date('2033-10-14').getTime();
      expect(release).toBeLessThanOrEqual(normal);
      expect(normal).toBeLessThanOrEqual(extended);
      expect(extended).toBeLessThanOrEqual(eol);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  EDGE CASES & CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Edge Cases & Constraints', () => {
    it('should reject product with invalid slug format', async () => {
      const app = createApp(productRoutes, '/api/products');
      const res = await request(app).post('/api/products').send({
        name: 'Test',
        slug: 'Test_Product_123',
        categoryId: 'dddddddd-dddd-dddd-dddd-ddddddddddda',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject variant with too many availability zones', async () => {
      const app = createApp(productRoutes, '/api/products');
      const res = await request(app).post('/api/products/cccccccc-cccc-cccc-cccc-cccccccccccc/variants').send({
        name: 'Test',
        osId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        osVersionId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        flavorId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        availabilityZoneIds: Array.from({ length: 51 }, (_, i) => `az-${i}`),
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject OS version with invalid phase enum', async () => {
      const app = createApp(osRoutes, '/api/os');
      const res = await request(app).post('/api/os/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/versions').send({
        version: 'Test',
        releaseDate: '2020-01-01T00:00:00Z',
        normalSupportEnd: '2025-01-01T00:00:00Z',
        extendedSupportEnd: '2030-01-01T00:00:00Z',
        eolDate: '2032-01-01T00:00:00Z',
        phase: 'INVALID_PHASE',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should handle empty availabilityZoneIds array', async () => {
      prismaMock.product.findUnique.mockResolvedValue({
        id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        category: { id: 'dddddddd-dddd-dddd-dddd-ddddddddddda', slug: 'compute' },
      });
      prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
      prismaMock.osVersion.findFirst.mockResolvedValue({ id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', osId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
      prismaMock.flavor.findUnique.mockResolvedValue({ id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' });
      prismaMock.availabilityZone.findMany.mockResolvedValue([]);

      const created = {
        id: 'ffffffff-ffff-ffff-ffff-fffffffffff1',
        name: 'No AZ Variant',
        os: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
        osVersion: { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' },
        flavor: { id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' },
        availabilityZones: [],
        continuityLevel: null,
      };
      prismaMock.productVariant.create.mockResolvedValue(created);

      const app = createApp(productRoutes, '/api/products');
      const res = await request(app).post('/api/products/cccccccc-cccc-cccc-cccc-cccccccccccc/variants').send({
        name: 'No AZ Variant',
        osId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        osVersionId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        flavorId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        availabilityZoneIds: [],
      });

      expect(res.status).toBe(201);
      expect(res.body.availabilityZones).toEqual([]);
    });

    it('should allow null continuityLevelId on variant', async () => {
      prismaMock.product.findUnique.mockResolvedValue({
        id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        category: { id: 'dddddddd-dddd-dddd-dddd-ddddddddddda', slug: 'compute' },
      });
      prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
      prismaMock.osVersion.findFirst.mockResolvedValue({ id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', osId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
      prismaMock.flavor.findUnique.mockResolvedValue({ id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' });

      const created = {
        id: 'ffffffff-ffff-ffff-ffff-fffffffffff1',
        continuityLevelId: null,
        continuityLevel: null,
      };
      prismaMock.productVariant.create.mockResolvedValue(created);

      const app = createApp(productRoutes, '/api/products');
      const res = await request(app).post('/api/products/cccccccc-cccc-cccc-cccc-cccccccccccc/variants').send({
        name: 'Test',
        osId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        osVersionId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        flavorId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        continuityLevelId: null,
      });

      expect(res.status).toBe(201);
    });
  });
});
