import request from 'supertest';
import express from 'express';

var prismaMock: any = {};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => prismaMock),
}));

import { adminRoutes } from '../routes/admin';
import { flavorRoutes } from '../routes/flavors';

const CAT1 = 'aaaaaaaa-1111-1111-1111-111111111111';
const CAT2 = 'aaaaaaaa-2222-2222-2222-222222222222';
const PROF1 = 'bbbbbbbb-1111-1111-1111-111111111111';
const PROF2 = 'bbbbbbbb-2222-2222-2222-222222222222';
const FL1 = 'cccccccc-1111-1111-1111-111111111111';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
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

describe('FlavorProfile CRUD + cross-category validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.category = { findUnique: jest.fn() };
    prismaMock.flavorProfile = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    prismaMock.flavor = {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    };
  });

  describe('GET /api/admin/flavor-profiles (cross-category list)', () => {
    it('lists all profiles with category and flavorCount', async () => {
      prismaMock.flavorProfile.findMany.mockResolvedValue([
        {
          id: PROF1, categoryId: CAT1, name: 'General purpose', slug: 'general-purpose', order: 0,
          category: { id: CAT1, name: 'Compute', slug: 'compute' }, _count: { flavors: 4 },
        },
      ]);

      const res = await request(createApp()).get('/api/admin/flavor-profiles');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].category.name).toBe('Compute');
      expect(res.body[0].flavorCount).toBe(4);
      expect(res.body[0]._count).toBeUndefined();
    });

    it('filters by categoryId when provided', async () => {
      prismaMock.flavorProfile.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get(`/api/admin/flavor-profiles?categoryId=${CAT1}`);

      expect(res.status).toBe(200);
      expect(prismaMock.flavorProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { categoryId: CAT1 } })
      );
    });

    it('returns every category when no filter is given', async () => {
      prismaMock.flavorProfile.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/admin/flavor-profiles');

      expect(res.status).toBe(200);
      expect(prismaMock.flavorProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined })
      );
    });

    it('rejects an invalid categoryId (400)', async () => {
      const res = await request(createApp()).get('/api/admin/flavor-profiles?categoryId=not-a-uuid');

      expect(res.status).toBe(400);
      expect(prismaMock.flavorProfile.findMany).not.toHaveBeenCalled();
    });
  });

  describe('CRUD /api/admin/categories/:id/flavor-profiles', () => {
    it('lists profiles of a category ordered', async () => {
      prismaMock.flavorProfile.findMany.mockResolvedValue([
        { id: PROF1, categoryId: CAT1, name: 'General purpose', slug: 'general-purpose', order: 0 },
        { id: PROF2, categoryId: CAT1, name: 'Memory oriented', slug: 'memory-oriented', order: 1 },
      ]);

      const res = await request(createApp()).get(`/api/admin/categories/${CAT1}/flavor-profiles`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].slug).toBe('general-purpose');
    });

    it('creates a profile with slug derived from name', async () => {
      prismaMock.category.findUnique.mockResolvedValue({ id: CAT1, name: 'Compute' });
      prismaMock.flavorProfile.findUnique.mockResolvedValue(null);
      prismaMock.flavorProfile.create.mockResolvedValue({
        id: PROF1, categoryId: CAT1, name: 'Memory oriented', slug: 'memory-oriented',
      });

      const res = await request(createApp())
        .post(`/api/admin/categories/${CAT1}/flavor-profiles`)
        .send({ name: 'Memory oriented' });

      expect(res.status).toBe(201);
      expect(res.body.slug).toBe('memory-oriented');
      expect(prismaMock.flavorProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ slug: 'memory-oriented', categoryId: CAT1 }) })
      );
    });

    it('returns 409 when slug already exists in the category', async () => {
      prismaMock.category.findUnique.mockResolvedValue({ id: CAT1, name: 'Compute' });
      prismaMock.flavorProfile.findUnique.mockResolvedValue({ id: PROF1, categoryId: CAT1, slug: 'memory-oriented' });

      const res = await request(createApp())
        .post(`/api/admin/categories/${CAT1}/flavor-profiles`)
        .send({ name: 'Memory oriented', slug: 'memory-oriented' });

      expect(res.status).toBe(409);
    });

    it('refuses slug rename on PATCH (400)', async () => {
      prismaMock.flavorProfile.findUnique.mockResolvedValue({ id: PROF1, categoryId: CAT1, slug: 'memory-oriented' });

      const res = await request(createApp())
        .patch(`/api/admin/categories/${CAT1}/flavor-profiles/${PROF1}`)
        .send({ slug: 'new-slug' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/slug/i);
    });

    it('allows non-slug rename on PATCH', async () => {
      prismaMock.flavorProfile.findUnique.mockResolvedValue({ id: PROF1, categoryId: CAT1, slug: 'memory-oriented' });
      prismaMock.flavorProfile.update.mockResolvedValue({ id: PROF1, categoryId: CAT1, name: 'Memory First', slug: 'memory-oriented' });

      const res = await request(createApp())
        .patch(`/api/admin/categories/${CAT1}/flavor-profiles/${PROF1}`)
        .send({ name: 'Memory First' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Memory First');
    });

    it('returns 404 when PATCH targets another category profile', async () => {
      prismaMock.flavorProfile.findUnique.mockResolvedValue({ id: PROF1, categoryId: CAT2, slug: 'x' });

      const res = await request(createApp())
        .patch(`/api/admin/categories/${CAT1}/flavor-profiles/${PROF1}`)
        .send({ name: 'X' });

      expect(res.status).toBe(404);
    });

    it('blocks DELETE while flavors reference the profile (409)', async () => {
      prismaMock.flavorProfile.findUnique.mockResolvedValue({ id: PROF1, categoryId: CAT1, slug: 'memory-oriented' });
      prismaMock.flavor.count.mockResolvedValue(3);

      const res = await request(createApp())
        .delete(`/api/admin/categories/${CAT1}/flavor-profiles/${PROF1}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/3 attached flavor/);
      expect(prismaMock.flavorProfile.delete).not.toHaveBeenCalled();
    });

    it('deletes an unused profile', async () => {
      prismaMock.flavorProfile.findUnique.mockResolvedValue({ id: PROF1, categoryId: CAT1, slug: 'memory-oriented' });
      prismaMock.flavor.count.mockResolvedValue(0);
      prismaMock.flavorProfile.delete.mockResolvedValue({});

      const res = await request(createApp())
        .delete(`/api/admin/categories/${CAT1}/flavor-profiles/${PROF1}`);

      expect(res.status).toBe(204);
      expect(prismaMock.flavorProfile.delete).toHaveBeenCalledWith({ where: { id: PROF1 } });
    });
  });

  describe('Flavor profileId cross-category validation', () => {
    it('rejects a flavor whose profileId belongs to another category (400)', async () => {
      prismaMock.flavorProfile.findUnique.mockResolvedValue({ id: PROF1, categoryId: CAT2 });
      prismaMock.flavor.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .post('/api/flavors')
        .send({ name: 'New', categoryId: CAT1, profileId: PROF1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/category/i);
    });

    it('accepts a flavor with a same-category profileId', async () => {
      prismaMock.flavorProfile.findUnique.mockResolvedValue({ id: PROF1, categoryId: CAT1 });
      prismaMock.flavor.create.mockResolvedValue({
        id: FL1, name: 'New', categoryId: CAT1, profileId: PROF1, sizeLabel: 'L', sizeRank: 3,
        profile: { id: PROF1, name: 'Memory oriented', slug: 'memory-oriented', icon: null, color: null },
        zones: [], regions: [], availabilityZones: [], _count: { variants: 0 },
      });

      const res = await request(createApp())
        .post('/api/flavors')
        .send({ name: 'New', categoryId: CAT1, profileId: PROF1, sizeLabel: 'L', sizeRank: 3 });

      expect(res.status).toBe(201);
      expect(res.body.profile.slug).toBe('memory-oriented');
      expect(res.body.sizeLabel).toBe('L');
    });

    it('rejects an unknown profileId (400)', async () => {
      prismaMock.flavorProfile.findUnique.mockResolvedValue(null);
      prismaMock.flavor.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .post('/api/flavors')
        .send({ name: 'New', categoryId: CAT1, profileId: PROF1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not found/i);
    });
  });
});
