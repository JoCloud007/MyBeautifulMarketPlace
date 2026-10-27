/**
 * Compatibility rules API — route tests (spec "Stacks de produits & matrice de
 * compatibilité" §1.3 + §2 registration validation). jest + supertest, Prisma
 * mocked (same pattern as topology.test.ts).
 */
import request from 'supertest';
import express from 'express';

var prismaMock: any = {};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => prismaMock),
}));

import { compatibilityRuleRoutes } from '../routes/compatibility-rules';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', compatibilityRuleRoutes);
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
  });
  return app;
}

const PG_ID = 'pg-product';
const VM_ID = 'vm-product';

function validRulePayload(overrides: Record<string, unknown> = {}) {
  return {
    name: 'PG 17 REQUIRES VM >= v4',
    fromProductId: PG_ID,
    fromVersionConstraint: '>=17',
    toProductId: VM_ID,
    toVersionConstraint: '>=4',
    kind: 'REQUIRES',
    severity: 'HARD',
    scopeType: 'GLOBAL',
    ...overrides,
  };
}

describe('Compatibility rules API', () => {
  beforeEach(() => {
    // MUTATE the shared mock object (never reassign: src/db.ts instantiated
    // PrismaClient at import time and holds the original reference).
    for (const key of Object.keys(prismaMock)) delete prismaMock[key];
    prismaMock.compatibilityRule = {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'rule-new', ...data })
      ),
      update: jest.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'rule-1', ...data })
      ),
      delete: jest.fn().mockResolvedValue({}),
    };
  });

  describe('POST /api/compatibility-rules', () => {
    it('creates a valid GLOBAL rule', async () => {
      const res = await request(createApp())
        .post('/api/compatibility-rules')
        .send(validRulePayload());
      expect(res.status).toBe(201);
      expect(res.body.id).toBe('rule-new');
      expect(prismaMock.compatibilityRule.create).toHaveBeenCalled();
    });

    it('rejects an unparsable constraint (§2 grammar)', async () => {
      const res = await request(createApp())
        .post('/api/compatibility-rules')
        .send(validRulePayload({ toVersionConstraint: '>=garbage' }));
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/Invalid version constraint/);
    });

    it('rejects identical from/to products', async () => {
      const res = await request(createApp())
        .post('/api/compatibility-rules')
        .send(validRulePayload({ fromProductId: VM_ID, toProductId: VM_ID }));
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/distinct products/);
    });

    it('rejects an invalid enum value', async () => {
      const res = await request(createApp())
        .post('/api/compatibility-rules')
        .send(validRulePayload({ severity: 'CRITICAL' }));
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('requires scopeProductId for a PRODUCT-scoped rule', async () => {
      const res = await request(createApp())
        .post('/api/compatibility-rules')
        .send(validRulePayload({ scopeType: 'PRODUCT' }));
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/scopeProductId is required/);
    });

    it('requires justification when a PRODUCT rule relaxes the matching GLOBAL rule', async () => {
      prismaMock.compatibilityRule.findMany.mockResolvedValue([
        {
          id: 'rule-global',
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
      const res = await request(createApp())
        .post('/api/compatibility-rules')
        .send(validRulePayload({
          name: 'Override local',
          scopeType: 'PRODUCT',
          scopeProductId: 'stack-product',
          toVersionConstraint: '>=3', // relaxes >=4
        }));
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/justification is required/);
      expect(prismaMock.compatibilityRule.create).not.toHaveBeenCalled();
    });

    it('accepts the relaxing override with a justification', async () => {
      prismaMock.compatibilityRule.findMany.mockResolvedValue([
        {
          id: 'rule-global',
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
      const res = await request(createApp())
        .post('/api/compatibility-rules')
        .send(validRulePayload({
          name: 'Override local',
          scopeType: 'PRODUCT',
          scopeProductId: 'stack-product',
          toVersionConstraint: '>=3',
          justification: 'Backport interne certifié le 2026-10-27',
        }));
      expect(res.status).toBe(201);
      expect(prismaMock.compatibilityRule.create).toHaveBeenCalled();
    });

    it('does not require justification for a tighter scoped rule', async () => {
      prismaMock.compatibilityRule.findMany.mockResolvedValue([
        {
          id: 'rule-global',
          name: 'PG 17 REQUIRES VM >= v3',
          fromProductId: PG_ID,
          fromVersionConstraint: '>=17',
          toProductId: VM_ID,
          toVersionConstraint: '>=3',
          kind: 'REQUIRES',
          severity: 'HARD',
          scopeType: 'GLOBAL',
          isActive: true,
        },
      ]);
      const res = await request(createApp())
        .post('/api/compatibility-rules')
        .send(validRulePayload({
          name: 'Contrainte locale',
          scopeType: 'PRODUCT',
          scopeProductId: 'stack-product',
          toVersionConstraint: '>=4', // tighter than >=3
        }));
      expect(res.status).toBe(201);
    });
  });

  describe('PATCH/DELETE', () => {
    it('404 for an unknown id on PATCH', async () => {
      const res = await request(createApp())
        .patch('/api/compatibility-rules/ghost')
        .send({ name: 'x' });
      expect(res.status).toBe(404);
    });

    it('404 for an unknown id on DELETE', async () => {
      const res = await request(createApp()).delete('/api/compatibility-rules/ghost');
      expect(res.status).toBe(404);
    });

    it('PATCH validates the merged draft', async () => {
      prismaMock.compatibilityRule.findUnique.mockResolvedValue({
        id: 'rule-1',
        name: 'Rule',
        fromProductId: PG_ID,
        fromVersionConstraint: '>=17',
        toProductId: VM_ID,
        toVersionConstraint: '>=4',
        kind: 'REQUIRES',
        severity: 'HARD',
        scopeType: 'GLOBAL',
        isActive: true,
      });
      const res = await request(createApp())
        .patch('/api/compatibility-rules/rule-1')
        .send({ toVersionConstraint: '!!bogus' });
      expect(res.status).toBe(400);
    });

    it('DELETE removes the rule', async () => {
      prismaMock.compatibilityRule.findUnique.mockResolvedValue({ id: 'rule-1' });
      const res = await request(createApp()).delete('/api/compatibility-rules/rule-1');
      expect(res.status).toBe(204);
      expect(prismaMock.compatibilityRule.delete).toHaveBeenCalledWith({ where: { id: 'rule-1' } });
    });
  });

  describe('GET /api/compatibility-rules', () => {
    it('lists all rules', async () => {
      prismaMock.compatibilityRule.findMany.mockResolvedValue([{ id: 'rule-1', name: 'r' }]);
      const res = await request(createApp()).get('/api/compatibility-rules');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it('excludes inactive rules on /effective', async () => {
      prismaMock.compatibilityRule.findMany.mockResolvedValue([
        { id: 'rule-1', name: 'active', isActive: true },
      ]);
      const res = await request(createApp()).get('/api/compatibility-rules/effective');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      // The route filters with where: { isActive: true } — assert the call shape.
      const call = prismaMock.compatibilityRule.findMany.mock.calls[0][0];
      expect(call.where).toEqual({ isActive: true });
    });
  });
});
