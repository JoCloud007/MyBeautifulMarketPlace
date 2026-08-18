import request from 'supertest';
import express from 'express';

var prismaMock: any = {};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => prismaMock),
  LifecyclePhase: {
    RELEASED: 'RELEASED',
    NORMAL_SUPPORT: 'NORMAL_SUPPORT',
    EXTENDED_SUPPORT: 'EXTENDED_SUPPORT',
    NO_SUPPORT: 'NO_SUPPORT',
    EOL: 'EOL',
  },
}));

import { osRoutes } from '../routes/os';

const OS1 = '11111111-1111-1111-1111-111111111111';
const OS2 = '22222222-2222-2222-2222-222222222222';
const VER1 = '33333333-3333-3333-3333-333333333333';
const VER2 = '44444444-4444-4444-4444-444444444444';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/os', osRoutes);
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

describe('OS Routes — Marketplace Feature', () => {
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
    jest.clearAllMocks();
  });

  describe('GET /api/os', () => {
    it('lists all operating systems with versions and variant counts', async () => {
      const osList = [
        {
          id: OS1,
          family: 'WINDOWS',
          name: 'Windows',
          slug: 'windows',
          isActive: true,
          versions: [
            { id: VER1, version: 'Server 2022', releaseDate: new Date('2021-08-18'), phase: 'RELEASED' },
          ],
          _count: { variants: 3 },
        },
        {
          id: OS2,
          family: 'LINUX',
          name: 'Debian',
          slug: 'debian',
          isActive: true,
          versions: [
            { id: VER2, version: '12 (Bookworm)', releaseDate: new Date('2023-06-10'), phase: 'RELEASED' },
          ],
          _count: { variants: 2 },
        },
      ];
      prismaMock.operatingSystem.findMany.mockResolvedValue(osList);

      const app = createApp();
      const res = await request(app).get('/api/os');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].family).toBe('WINDOWS');
      expect(res.body[0].versions).toHaveLength(1);
      expect(res.body[0]._count.variants).toBe(3);
      expect(res.body[1].slug).toBe('debian');
    });
  });

  describe('POST /api/os', () => {
    it('creates a new operating system', async () => {
      const payload = { family: 'LINUX', name: 'Red Hat Enterprise Linux', slug: 'rhel', isActive: true };
      prismaMock.operatingSystem.findUnique.mockResolvedValue(null);
      prismaMock.operatingSystem.create.mockResolvedValue({ id: OS1, ...payload, versions: [] });

      const app = createApp();
      const res = await request(app).post('/api/os').send(payload);

      expect(res.status).toBe(201);
      expect(res.body.slug).toBe('rhel');
      expect(res.body.family).toBe('LINUX');
    });

    it('rejects duplicate slug with 409', async () => {
      const payload = { family: 'WINDOWS', name: 'Windows', slug: 'windows' };
      prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: OS1, ...payload });

      const app = createApp();
      const res = await request(app).post('/api/os').send(payload);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already exists');
    });

    it('rejects invalid slug format', async () => {
      const payload = { family: 'LINUX', name: 'Test', slug: 'Invalid_Slug' };
      const app = createApp();
      const res = await request(app).post('/api/os').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('GET /api/os/:id', () => {
    it('returns a single OS with versions', async () => {
      const os = {
        id: OS1,
        family: 'WINDOWS',
        name: 'Windows',
        slug: 'windows',
        isActive: true,
        versions: [
          { id: VER1, version: 'Server 2022', releaseDate: new Date('2021-08-18'), phase: 'RELEASED' },
        ],
        _count: { variants: 3 },
      };
      prismaMock.operatingSystem.findUnique.mockResolvedValue(os);

      const app = createApp();
      const res = await request(app).get(`/api/os/${OS1}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(OS1);
      expect(res.body.versions).toHaveLength(1);
    });

    it('returns 404 for non-existent OS', async () => {
      prismaMock.operatingSystem.findUnique.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).get(`/api/os/${OS1}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/os/:id', () => {
    it('updates an OS name', async () => {
      prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: OS1, name: 'Windows', slug: 'windows' });
      prismaMock.operatingSystem.update.mockResolvedValue({ id: OS1, family: 'WINDOWS', name: 'Windows Server', slug: 'windows', versions: [] });

      const app = createApp();
      const res = await request(app).put(`/api/os/${OS1}`).send({ name: 'Windows Server' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Windows Server');
    });
  });

  describe('DELETE /api/os/:id', () => {
    it('deletes OS with no variants', async () => {
      prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: OS1, _count: { variants: 0 } });
      prismaMock.operatingSystem.delete.mockResolvedValue({});

      const app = createApp();
      const res = await request(app).delete(`/api/os/${OS1}`);

      expect(res.status).toBe(204);
    });

    it('blocks deletion when variants exist', async () => {
      prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: OS1, _count: { variants: 2 } });

      const app = createApp();
      const res = await request(app).delete(`/api/os/${OS1}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('Cannot delete OS with existing variants');
    });
  });

  describe('GET /api/os/:id/versions', () => {
    it('lists versions for an OS', async () => {
      const versions = [
        { id: VER1, osId: OS1, version: 'Server 2022', releaseDate: new Date('2021-08-18'), phase: 'RELEASED' },
        { id: VER2, osId: OS1, version: 'Server 2019', releaseDate: new Date('2018-10-02'), phase: 'EXTENDED_SUPPORT' },
      ];
      prismaMock.osVersion.findMany.mockResolvedValue(versions);

      const app = createApp();
      const res = await request(app).get(`/api/os/${OS1}/versions`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].version).toBe('Server 2022');
    });
  });

  describe('POST /api/os/:id/versions', () => {
    it('creates a version with valid lifecycle dates', async () => {
      const payload = {
        version: '11',
        releaseDate: '2021-10-05T00:00:00.000Z',
        normalSupportEnd: '2025-10-14T00:00:00.000Z',
        extendedSupportEnd: '2028-10-10T00:00:00.000Z',
        eolDate: '2030-10-10T00:00:00.000Z',
        phase: 'NORMAL_SUPPORT',
      };
      prismaMock.operatingSystem.findUnique.mockResolvedValue({ id: OS1 });
      prismaMock.osVersion.create.mockResolvedValue({ id: VER1, osId: OS1, ...payload });

      const app = createApp();
      const res = await request(app).post(`/api/os/${OS1}/versions`).send(payload);

      expect(res.status).toBe(201);
      expect(res.body.version).toBe('11');
    });

    it('rejects version with invalid date order', async () => {
      const payload = {
        version: '11',
        releaseDate: '2025-10-05T00:00:00.000Z',
        normalSupportEnd: '2021-10-14T00:00:00.000Z',
        extendedSupportEnd: '2028-10-10T00:00:00.000Z',
        eolDate: '2030-10-10T00:00:00.000Z',
      };
      const app = createApp();
      const res = await request(app).post(`/api/os/${OS1}/versions`).send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('DELETE /api/os/:id/versions/:versionId', () => {
    it('blocks deletion when variants exist', async () => {
      prismaMock.osVersion.findFirst.mockResolvedValue({ id: VER1, osId: OS1, _count: { variants: 1 } });

      const app = createApp();
      const res = await request(app).delete(`/api/os/${OS1}/versions/${VER1}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('Cannot delete version with existing variants');
    });
  });
});
