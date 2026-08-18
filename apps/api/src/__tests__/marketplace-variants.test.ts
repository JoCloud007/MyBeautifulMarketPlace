import request from 'supertest';
import express from 'express';

var prismaMock: any = {};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => prismaMock),
}));

import { variantRoutes } from '../routes/variants';

const PROD_COMPUTE = '11111111-1111-1111-1111-111111111111';
const PROD_DATA = '22222222-2222-2222-2222-222222222222';
const OS1 = '33333333-3333-3333-3333-333333333333';
const VER1 = '44444444-4444-4444-4444-444444444444';
const FLAVOR1 = '55555555-5555-5555-5555-555555555555';
const AZ1 = '66666666-6666-6666-6666-666666666666';
const CL1 = '77777777-7777-7777-7777-777777777777';
const VAR1 = '88888888-8888-8888-8888-888888888888';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/variants', variantRoutes);
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

describe('Variant Routes — Marketplace Feature', () => {
  beforeEach(() => {
    prismaMock.product = { findUnique: jest.fn() };
    prismaMock.operatingSystem = { findUnique: jest.fn() };
    prismaMock.osVersion = { findFirst: jest.fn() };
    prismaMock.flavor = { findUnique: jest.fn() };
    prismaMock.continuityLevel = { findUnique: jest.fn() };
    prismaMock.availabilityZone = { findMany: jest.fn() };
    prismaMock.productVariant = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    prismaMock.productVariantAvailabilityZone = { deleteMany: jest.fn() };
    prismaMock.$transaction = jest.fn(async (fn: any) => fn(prismaMock));
    jest.clearAllMocks();
  });

  describe('GET /api/variants/product/:productId', () => {
    it('lists variants for a compute product', async () => {
      const variants = [
        {
          id: VAR1,
          productId: PROD_COMPUTE,
          name: 'Debian 12 - Small',
          os: { id: OS1, name: 'Debian' },
          osVersion: { id: VER1, version: '12 (Bookworm)' },
          flavor: { id: FLAVOR1, name: 'Small', vcpu: 2, ramGb: 4 },
          availabilityZones: [{ availabilityZone: { id: AZ1, code: 'eu-west-par1' } }],
          continuityLevel: { id: CL1, name: 'MODERATE' },
          _count: { instances: 1 },
        },
      ];
      prismaMock.productVariant.findMany.mockResolvedValue(variants);

      const app = createApp();
      const res = await request(app).get(`/api/variants/product/${PROD_COMPUTE}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Debian 12 - Small');
      expect(res.body[0].os.name).toBe('Debian');
      expect(res.body[0].flavor.vcpu).toBe(2);
      expect(res.body[0]._count.instances).toBe(1);
    });
  });

  describe('POST /api/variants/product/:productId', () => {
    it('creates a variant for a Compute product', async () => {
      const payload = {
        name: 'Debian 12 - Small',
        osId: OS1,
        osVersionId: VER1,
        flavorId: FLAVOR1,
        availabilityZoneIds: [AZ1],
        continuityLevelId: CL1,
      };
      prismaMock.product.findUnique.mockResolvedValue({
        id: PROD_COMPUTE,
        category: { slug: 'compute' },
      });
      prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: OS1 });
      prismaMock.osVersion.findFirst.mockResolvedValue({ id: VER1, osId: OS1 });
      prismaMock.flavor.findUnique.mockResolvedValue({ id: FLAVOR1 });
      prismaMock.continuityLevel.findUnique.mockResolvedValue({ id: CL1 });
      prismaMock.availabilityZone.findMany.mockResolvedValue([{ id: AZ1 }]);
      prismaMock.productVariant.create.mockResolvedValue({
        id: VAR1,
        productId: PROD_COMPUTE,
        ...payload,
        os: { id: OS1, name: 'Debian' },
        osVersion: { id: VER1, version: '12 (Bookworm)' },
        flavor: { id: FLAVOR1, name: 'Small' },
        availabilityZones: [{ availabilityZone: { id: AZ1, code: 'eu-west-par1' } }],
        continuityLevel: { id: CL1, name: 'MODERATE' },
      });

      const app = createApp();
      const res = await request(app).post(`/api/variants/product/${PROD_COMPUTE}`).send(payload);

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Debian 12 - Small');
      expect(res.body.os.name).toBe('Debian');
    });

    it('rejects variant creation for non-Compute product', async () => {
      const payload = {
        name: 'Storage Small',
        osId: OS1,
        osVersionId: VER1,
        flavorId: FLAVOR1,
      };
      prismaMock.product.findUnique.mockResolvedValue({
        id: PROD_DATA,
        category: { slug: 'data' },
      });

      const app = createApp();
      const res = await request(app).post(`/api/variants/product/${PROD_DATA}`).send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Variants can only be created for Compute products');
    });

    it('rejects variant with mismatched OS and version', async () => {
      const payload = {
        name: 'Debian 12 - Small',
        osId: OS1,
        osVersionId: VER1,
        flavorId: FLAVOR1,
      };
      prismaMock.product.findUnique.mockResolvedValue({
        id: PROD_COMPUTE,
        category: { slug: 'compute' },
      });
      prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: OS1 });
      prismaMock.osVersion.findFirst.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).post(`/api/variants/product/${PROD_COMPUTE}`).send(payload);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('OS version not found or does not belong');
    });

    it('rejects variant with non-existent flavor', async () => {
      const payload = {
        name: 'Debian 12 - Small',
        osId: OS1,
        osVersionId: VER1,
        flavorId: FLAVOR1,
      };
      prismaMock.product.findUnique.mockResolvedValue({
        id: PROD_COMPUTE,
        category: { slug: 'compute' },
      });
      prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: OS1 });
      prismaMock.osVersion.findFirst.mockResolvedValue({ id: VER1, osId: OS1 });
      prismaMock.flavor.findUnique.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).post(`/api/variants/product/${PROD_COMPUTE}`).send(payload);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Flavor not found');
    });

    it('rejects variant with invalid availability zone', async () => {
      const payload = {
        name: 'Debian 12 - Small',
        osId: OS1,
        osVersionId: VER1,
        flavorId: FLAVOR1,
        availabilityZoneIds: [AZ1],
      };
      prismaMock.product.findUnique.mockResolvedValue({
        id: PROD_COMPUTE,
        category: { slug: 'compute' },
      });
      prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: OS1 });
      prismaMock.osVersion.findFirst.mockResolvedValue({ id: VER1, osId: OS1 });
      prismaMock.flavor.findUnique.mockResolvedValue({ id: FLAVOR1 });
      prismaMock.availabilityZone.findMany.mockResolvedValue([]);

      const app = createApp();
      const res = await request(app).post(`/api/variants/product/${PROD_COMPUTE}`).send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('One or more availability zones do not exist');
    });
  });

  describe('PUT /api/variants/:id', () => {
    it('updates a variant with new AZs', async () => {
      const payload = {
        name: 'Debian 12 - Medium',
        availabilityZoneIds: [AZ1],
      };
      prismaMock.productVariant.findUnique.mockResolvedValue({ id: VAR1, osId: OS1 });
      prismaMock.availabilityZone.findMany.mockResolvedValue([{ id: AZ1 }]);
      prismaMock.productVariant.update.mockResolvedValue({
        id: VAR1,
        name: 'Debian 12 - Medium',
        os: { id: OS1, name: 'Debian' },
        osVersion: { id: VER1, version: '12 (Bookworm)' },
        flavor: { id: FLAVOR1, name: 'Small' },
        availabilityZones: [{ availabilityZone: { id: AZ1, code: 'eu-west-par1' } }],
        continuityLevel: null,
      });

      const app = createApp();
      const res = await request(app).put(`/api/variants/${VAR1}`).send(payload);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Debian 12 - Medium');
      expect(prismaMock.productVariantAvailabilityZone.deleteMany).toHaveBeenCalledWith({ where: { variantId: VAR1 } });
    });
  });

  describe('DELETE /api/variants/:id', () => {
    it('deletes variant with no instances', async () => {
      prismaMock.productVariant.findUnique.mockResolvedValue({
        id: VAR1,
        _count: { instances: 0 },
      });
      prismaMock.productVariant.delete.mockResolvedValue({});

      const app = createApp();
      const res = await request(app).delete(`/api/variants/${VAR1}`);

      expect(res.status).toBe(204);
    });

    it('blocks deletion when instances exist', async () => {
      prismaMock.productVariant.findUnique.mockResolvedValue({
        id: VAR1,
        _count: { instances: 2 },
      });

      const app = createApp();
      const res = await request(app).delete(`/api/variants/${VAR1}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('Cannot delete variant with existing instances');
    });
  });
});
