/**
 * Stack composition API — route tests (spec "Stacks de produits & matrice de
 * compatibilité" §1.2 + §3 live validation). jest + supertest, Prisma mocked
 * (same pattern as topology.test.ts).
 */
import request from 'supertest';
import express from 'express';

var prismaMock: any = {};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => prismaMock),
}));

import { stackComponentRoutes } from '../routes/stack-components';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', stackComponentRoutes);
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
  });
  return app;
}

const PG_ID = 'pg-product';
const VM_ID = 'vm-product';
const PG_VERSION_ID = 'pg-16-3';
const VM_VERSION_ID = 'vm-v3';

function seedDb() {
  prismaMock.productVersion = {
    findUnique: jest.fn().mockImplementation(({ where }: any) => {
      if (where.id === PG_VERSION_ID) {
        return Promise.resolve({
          id: PG_VERSION_ID,
          productId: PG_ID,
          version: '16.3',
          versionMajor: 16,
          versionMinor: 3,
          versionPatch: 0,
        });
      }
      return Promise.resolve(null);
    }),
    findMany: jest.fn().mockImplementation(({ where }: any) => {
      const ids: string[] = where?.id?.in ?? [];
      const rows: any[] = [];
      if (ids.includes(VM_VERSION_ID)) {
        rows.push({
          id: VM_VERSION_ID,
          productId: VM_ID,
          version: 'v3',
          versionMajor: 3,
          versionMinor: 0,
          versionPatch: 0,
        });
      }
      return Promise.resolve(rows);
    }),
  };
  prismaMock.productVersionComponent = {
    findMany: jest.fn().mockResolvedValue([]),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
  };
  prismaMock.compatibilityRule = {
    findMany: jest.fn().mockResolvedValue([]),
  };
}

describe('Stack components API', () => {
  beforeEach(() => {
    // MUTATE the shared mock object (never reassign: src/db.ts instantiated
    // PrismaClient at import time and holds the original reference).
    for (const key of Object.keys(prismaMock)) delete prismaMock[key];
    seedDb();
  });

  describe('POST /api/compatibility/validate (write-free)', () => {
    it('requires containerProductId', async () => {
      const res = await request(createApp()).post('/api/compatibility/validate').send({ components: [] });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('requires components array', async () => {
      const res = await request(createApp())
        .post('/api/compatibility/validate')
        .send({ containerProductId: PG_ID });
      expect(res.status).toBe(400);
    });

    it('rejects self-composition', async () => {
      const res = await request(createApp())
        .post('/api/compatibility/validate')
        .send({
          containerProductId: PG_ID,
          components: [{ productId: PG_ID, versionId: PG_VERSION_ID }],
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Self-composition/);
    });

    it('rejects duplicate component products', async () => {
      const res = await request(createApp())
        .post('/api/compatibility/validate')
        .send({
          containerProductId: PG_ID,
          components: [
            { productId: VM_ID, versionId: VM_VERSION_ID },
            { productId: VM_ID, versionId: VM_VERSION_ID },
          ],
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Duplicate component products/);
    });

    it('rejects a version that does not belong to its product', async () => {
      const res = await request(createApp())
        .post('/api/compatibility/validate')
        .send({
          containerProductId: PG_ID,
          // VM_VERSION_ID belongs to VM_ID, not to 'other-product'
          components: [{ productId: 'other-product', versionId: VM_VERSION_ID }],
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/does not belong to/);
    });

    it('returns VALID when no rule is violated (empty rule set)', async () => {
      const res = await request(createApp())
        .post('/api/compatibility/validate')
        .send({
          containerProductId: PG_ID,
          components: [{ productId: VM_ID, versionId: VM_VERSION_ID }],
        });
      expect(res.status).toBe(200);
      expect(res.body.verdict).toBe('VALID');
      expect(res.body.findings).toEqual([]);
    });

    it('computes findings from the stored rules', async () => {
      prismaMock.compatibilityRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          name: 'PG 16+ REQUIRES VM >= v3',
          fromProductId: PG_ID,
          fromVersionConstraint: '>=16',
          toProductId: VM_ID,
          toVersionConstraint: '>=3',
          kind: 'REQUIRES',
          severity: 'HARD',
          scopeType: 'GLOBAL',
          isActive: true,
        },
      ]);
      const res = await request(createApp())
        .post('/api/compatibility/validate')
        .send({
          containerProductId: PG_ID,
          components: [{ productId: VM_ID, versionId: VM_VERSION_ID }],
        });
      expect(res.status).toBe(200);
      expect(res.body.verdict).toBe('VALID');
      expect(res.body.findings[0].ruleName).toBe('PG 16+ REQUIRES VM >= v3');
    });

    it('performs no write on the validation path', async () => {
      await request(createApp())
        .post('/api/compatibility/validate')
        .send({
          containerProductId: PG_ID,
          components: [{ productId: VM_ID, versionId: VM_VERSION_ID }],
        });
      expect(prismaMock.productVersionComponent.createMany).not.toHaveBeenCalled();
      expect(prismaMock.productVersionComponent.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/product-versions/:id/components', () => {
    it('404 for an unknown container version', async () => {
      const res = await request(createApp())
        .put('/api/product-versions/unknown/components')
        .send({ components: [] });
      expect(res.status).toBe(404);
    });

    it('rejects a component version not found', async () => {
      const res = await request(createApp())
        .put(`/api/product-versions/${PG_VERSION_ID}/components`)
        .send({ components: [{ componentProductId: VM_ID, componentVersionId: 'ghost' }] });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Component version not found/);
    });

    it('replaces the list and returns the components', async () => {
      const res = await request(createApp())
        .put(`/api/product-versions/${PG_VERSION_ID}/components`)
        .send({ components: [{ componentProductId: VM_ID, componentVersionId: VM_VERSION_ID }] });
      expect(res.status).toBe(200);
      expect(prismaMock.productVersionComponent.deleteMany).toHaveBeenCalled();
      expect(prismaMock.productVersionComponent.createMany).toHaveBeenCalledWith({
        data: [
          {
            containerVersionId: PG_VERSION_ID,
            componentProductId: VM_ID,
            componentVersionId: VM_VERSION_ID,
          },
        ],
      });
      expect(res.body.verdict).toBe('VALID');
    });

    it('blocks a HARD violation with findings in the 400 body', async () => {
      prismaMock.compatibilityRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          name: 'PG 17 REQUIRES VM >= v4',
          fromProductId: PG_ID,
          fromVersionConstraint: '>=17',
          toProductId: VM_ID,
          toVersionConstraint: '>=4',
          kind: 'REQUIRES',
          severity: 'HARD',
          scopeType: 'GLOBAL',
          isActive: true,
        },
      ]);
      // Container PG 16.3 triggers no rule; use a container that does.
      prismaMock.productVersion.findUnique.mockResolvedValue({
        id: PG_VERSION_ID,
        productId: PG_ID,
        version: '17.1',
        versionMajor: 17,
        versionMinor: 1,
        versionPatch: 0,
      });
      const res = await request(createApp())
        .put(`/api/product-versions/${PG_VERSION_ID}/components`)
        .send({ components: [{ componentProductId: VM_ID, componentVersionId: VM_VERSION_ID }] });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/HARD compatibility rules/);
      expect(res.body.findings.length).toBeGreaterThan(0);
      expect(prismaMock.productVersionComponent.createMany).not.toHaveBeenCalled();
    });

    it('requires a justification to force a HARD override', async () => {
      prismaMock.compatibilityRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          name: 'PG 17 REQUIRES VM >= v4',
          fromProductId: PG_ID,
          fromVersionConstraint: '>=17',
          toProductId: VM_ID,
          toVersionConstraint: '>=4',
          kind: 'REQUIRES',
          severity: 'HARD',
          scopeType: 'GLOBAL',
          isActive: true,
        },
      ]);
      prismaMock.productVersion.findUnique.mockResolvedValue({
        id: PG_VERSION_ID,
        productId: PG_ID,
        version: '17.1',
        versionMajor: 17,
        versionMinor: 1,
        versionPatch: 0,
      });
      const res = await request(createApp())
        .put(`/api/product-versions/${PG_VERSION_ID}/components?force=true`)
        .send({ components: [{ componentProductId: VM_ID, componentVersionId: VM_VERSION_ID }] });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/justification is required/);
    });

    it('force + justification saves the list with downgraded findings', async () => {
      prismaMock.compatibilityRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          name: 'PG 17 REQUIRES VM >= v4',
          fromProductId: PG_ID,
          fromVersionConstraint: '>=17',
          toProductId: VM_ID,
          toVersionConstraint: '>=4',
          kind: 'REQUIRES',
          severity: 'HARD',
          scopeType: 'GLOBAL',
          isActive: true,
        },
      ]);
      prismaMock.productVersion.findUnique.mockResolvedValue({
        id: PG_VERSION_ID,
        productId: PG_ID,
        version: '17.1',
        versionMajor: 17,
        versionMinor: 1,
        versionPatch: 0,
      });
      const res = await request(createApp())
        .put(`/api/product-versions/${PG_VERSION_ID}/components?force=true`)
        .send({
          components: [{ componentProductId: VM_ID, componentVersionId: VM_VERSION_ID }],
          justification: 'Backport interne certifié le 2026-10-27',
        });
      expect(res.status).toBe(200);
      expect(res.body.forced).toBe(true);
      expect(res.body.verdict).toBe('WARNING');
      expect(res.body.findings.every((f: any) => f.severity !== 'HARD')).toBe(true);
      expect(prismaMock.productVersionComponent.createMany).toHaveBeenCalled();
    });
  });

  describe('GET /api/product-versions/:id/components', () => {
    it('lists components with linked rows', async () => {
      prismaMock.productVersionComponent.findMany.mockResolvedValue([
        {
          id: 'comp-1',
          containerVersionId: PG_VERSION_ID,
          componentProductId: VM_ID,
          componentVersionId: VM_VERSION_ID,
          componentProduct: { id: VM_ID, name: 'General Purpose VM', slug: 'general-purpose-vm' },
          componentVersion: { id: VM_VERSION_ID, productId: VM_ID, version: 'v3' },
        },
      ]);
      const res = await request(createApp()).get(`/api/product-versions/${PG_VERSION_ID}/components`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].product.name).toBe('General Purpose VM');
      expect(res.body[0].version.version).toBe('v3');
    });
  });
});
