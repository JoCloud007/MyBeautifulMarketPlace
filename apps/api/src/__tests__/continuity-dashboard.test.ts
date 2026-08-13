import request from 'supertest';
import express from 'express';

var prismaMock: any = {};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => prismaMock),
}));

import { applicationRoutes } from '../routes/applications';
import { continuityLevelRoutes } from '../routes/continuity-levels';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/applications', applicationRoutes);
  app.use('/api/continuity-levels', continuityLevelRoutes);
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

describe('Continuity Dashboard — API Routes', () => {
  beforeEach(() => {
    prismaMock.application = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    prismaMock.continuityLevel = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    };
    jest.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Continuity Levels
  // ═══════════════════════════════════════════════════════════════════════
  describe('GET /api/continuity-levels', () => {
    it('returns all continuity levels ordered by rtoMinutes asc', async () => {
      const levels = [
        { id: 'cl-low', name: 'LOW', rtoMinutes: 1440, rpoMinutes: 240, description: 'Basic backup', color: 'green' },
        { id: 'cl-mod', name: 'MODERATE', rtoMinutes: 480, rpoMinutes: 60, description: 'HA pair', color: 'yellow' },
        { id: 'cl-ser', name: 'SERIOUS', rtoMinutes: 240, rpoMinutes: 15, description: 'Multi-AZ', color: 'orange' },
        { id: 'cl-ext', name: 'EXTREME', rtoMinutes: 60, rpoMinutes: 5, description: 'Active-Active', color: 'red' },
      ];
      prismaMock.continuityLevel.findMany.mockResolvedValue(levels);

      const app = createApp();
      const res = await request(app).get('/api/continuity-levels');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(levels);
      expect(prismaMock.continuityLevel.findMany).toHaveBeenCalledWith({
        orderBy: { rtoMinutes: 'asc' },
      });
    });

    it('returns empty array when no levels exist', async () => {
      prismaMock.continuityLevel.findMany.mockResolvedValue([]);

      const app = createApp();
      const res = await request(app).get('/api/continuity-levels');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('GET /api/continuity-levels/:id', () => {
    it('returns a single continuity level', async () => {
      const level = { id: '11111111-1111-1111-1111-111111111111', name: 'EXTREME', rtoMinutes: 60, rpoMinutes: 5 };
      prismaMock.continuityLevel.findUnique.mockResolvedValue(level);

      const app = createApp();
      const res = await request(app).get('/api/continuity-levels/11111111-1111-1111-1111-111111111111');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(level);
    });

    it('returns 404 for non-existent level', async () => {
      prismaMock.continuityLevel.findUnique.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).get('/api/continuity-levels/00000000-0000-0000-0000-000000000000');

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/Continuity level not found/i);
    });

    it('returns 400 for invalid UUID', async () => {
      const app = createApp();
      const res = await request(app).get('/api/continuity-levels/not-a-uuid');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('PATCH /api/continuity-levels/:id', () => {
    it('updates rtoMinutes and rpoMinutes', async () => {
      const updated = { id: '11111111-1111-1111-1111-111111111111', name: 'EXTREME', rtoMinutes: 30, rpoMinutes: 2, description: 'Ultra' };
      prismaMock.continuityLevel.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app)
        .patch('/api/continuity-levels/11111111-1111-1111-1111-111111111111')
        .send({ rtoMinutes: 30, rpoMinutes: 2, description: 'Ultra' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(updated);
      expect(prismaMock.continuityLevel.update).toHaveBeenCalledWith({
        where: { id: '11111111-1111-1111-1111-111111111111' },
        data: { rtoMinutes: 30, rpoMinutes: 2, description: 'Ultra' },
      });
    });

    it('returns 400 for negative rtoMinutes', async () => {
      const app = createApp();
      const res = await request(app)
        .patch('/api/continuity-levels/cl-1')
        .send({ rtoMinutes: -1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('returns 400 for zero rpoMinutes', async () => {
      const app = createApp();
      const res = await request(app)
        .patch('/api/continuity-levels/cl-1')
        .send({ rpoMinutes: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('returns 400 for invalid id format', async () => {
      const app = createApp();
      const res = await request(app)
        .patch('/api/continuity-levels/bad-id')
        .send({ description: 'x' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Applications
  // ═══════════════════════════════════════════════════════════════════════
  describe('GET /api/applications', () => {
    it('returns all applications with continuityLevel included', async () => {
      const apps = [
        { id: 'a1', name: 'E-Commerce', continuityLevelId: 'cl-ser', continuityLevel: { id: 'cl-ser', name: 'SERIOUS', rtoMinutes: 240 }, owner: 'Alice' },
        { id: 'a2', name: 'Analytics', continuityLevelId: 'cl-mod', continuityLevel: { id: 'cl-mod', name: 'MODERATE', rtoMinutes: 480 }, owner: 'Bob' },
      ];
      prismaMock.application.findMany.mockResolvedValue(apps);

      const app = createApp();
      const res = await request(app).get('/api/applications');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(apps);
      expect(prismaMock.application.findMany).toHaveBeenCalledWith({
        include: { continuityLevel: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('returns empty array when no applications exist', async () => {
      prismaMock.application.findMany.mockResolvedValue([]);

      const app = createApp();
      const res = await request(app).get('/api/applications');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('GET /api/applications/:id', () => {
    it('returns a single application with continuityLevel', async () => {
      const appData = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'E-Commerce', continuityLevelId: 'cccccccc-cccc-cccc-cccc-cccccccccccc', continuityLevel: { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', name: 'SERIOUS' }, owner: 'Alice' };
      prismaMock.application.findUnique.mockResolvedValue(appData);

      const app = createApp();
      const res = await request(app).get('/api/applications/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(appData);
    });

    it('returns 404 for non-existent application', async () => {
      prismaMock.application.findUnique.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).get('/api/applications/00000000-0000-0000-0000-000000000000');

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/Application not found/i);
    });

    it('returns 400 for invalid UUID', async () => {
      const app = createApp();
      const res = await request(app).get('/api/applications/not-a-uuid');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('POST /api/applications', () => {
    it('creates an application with valid data', async () => {
      const payload = { name: 'New App', description: 'Test', continuityLevelId: '11111111-1111-1111-1111-111111111111', owner: 'Charlie' };
      const created = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', ...payload, continuityLevel: { id: '11111111-1111-1111-1111-111111111111', name: 'LOW' } };
      prismaMock.application.findUnique.mockResolvedValue(null);
      prismaMock.application.create.mockResolvedValue(created);

      const app = createApp();
      const res = await request(app).post('/api/applications').send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(created);
      expect(prismaMock.application.create).toHaveBeenCalledWith({
        data: payload,
        include: { continuityLevel: true },
      });
    });

    it('returns 409 when name already exists', async () => {
      const payload = { name: 'Existing', continuityLevelId: '11111111-1111-1111-1111-111111111111', owner: 'Charlie' };
      prismaMock.application.findUnique.mockResolvedValue({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab', name: 'Existing' });

      const app = createApp();
      const res = await request(app).post('/api/applications').send(payload);

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already exists/i);
    });

    it('returns 400 for missing name', async () => {
      const app = createApp();
      const res = await request(app).post('/api/applications').send({ continuityLevelId: '11111111-1111-1111-1111-111111111111', owner: 'Charlie' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('returns 400 for empty name', async () => {
      const app = createApp();
      const res = await request(app).post('/api/applications').send({ name: '', continuityLevelId: '11111111-1111-1111-1111-111111111111', owner: 'Charlie' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('returns 400 for invalid continuityLevelId', async () => {
      const app = createApp();
      const res = await request(app).post('/api/applications').send({ name: 'New', continuityLevelId: 'not-a-uuid', owner: 'Charlie' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('returns 400 for missing owner', async () => {
      const app = createApp();
      const res = await request(app).post('/api/applications').send({ name: 'New', continuityLevelId: '11111111-1111-1111-1111-111111111111' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('PATCH /api/applications/:id', () => {
    it('updates application name and owner', async () => {
      const updated = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Updated App', description: 'Desc', continuityLevelId: '11111111-1111-1111-1111-111111111111', continuityLevel: { id: '11111111-1111-1111-1111-111111111111', name: 'LOW' }, owner: 'Dave' };
      prismaMock.application.findUnique.mockResolvedValue(null);
      prismaMock.application.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app).patch('/api/applications/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa').send({ name: 'Updated App', owner: 'Dave' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(updated);
    });

    it('prevents duplicate name on update', async () => {
      prismaMock.application.findUnique.mockResolvedValue({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab', name: 'Taken' });

      const app = createApp();
      const res = await request(app).patch('/api/applications/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa').send({ name: 'Taken' });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already exists/i);
    });

    it('allows keeping same name during update', async () => {
      const updated = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Same', continuityLevel: { id: '11111111-1111-1111-1111-111111111111', name: 'LOW' } };
      prismaMock.application.findUnique.mockResolvedValue({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Same' });
      prismaMock.application.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app).patch('/api/applications/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa').send({ name: 'Same' });

      expect(res.status).toBe(200);
    });

    it('returns 400 for invalid continuityLevelId', async () => {
      const app = createApp();
      const res = await request(app).patch('/api/applications/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa').send({ continuityLevelId: 'bad' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('returns 400 for invalid id format', async () => {
      const app = createApp();
      const res = await request(app).patch('/api/applications/bad-id').send({ name: 'x' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('DELETE /api/applications/:id', () => {
    it('deletes an application without forecasts', async () => {
      prismaMock.application.findUnique.mockResolvedValue({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'App', _count: { forecasts: 0 } });
      prismaMock.application.delete.mockResolvedValue({});

      const app = createApp();
      const res = await request(app).delete('/api/applications/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

      expect(res.status).toBe(204);
      expect(prismaMock.application.delete).toHaveBeenCalledWith({ where: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' } });
    });

    it('returns 409 when application has existing forecasts', async () => {
      prismaMock.application.findUnique.mockResolvedValue({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'App', _count: { forecasts: 3 } });

      const app = createApp();
      const res = await request(app).delete('/api/applications/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/Cannot delete application with existing forecasts/i);
    });

    it('returns 404 for non-existent application', async () => {
      prismaMock.application.findUnique.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).delete('/api/applications/00000000-0000-0000-0000-000000000000');

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/Application not found/i);
    });

    it('returns 400 for invalid id format', async () => {
      const app = createApp();
      const res = await request(app).delete('/api/applications/bad-id');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Dashboard Data Integration
  // ═══════════════════════════════════════════════════════════════════════
  describe('Dashboard Data Integration', () => {
    it('applications include continuityLevel needed for dashboard', async () => {
      const apps = [
        {
          id: 'a1',
          name: 'E-Commerce',
          continuityLevelId: 'cl-ext',
          continuityLevel: { id: 'cl-ext', name: 'EXTREME', rtoMinutes: 60, rpoMinutes: 5, color: 'red' },
          owner: 'Alice',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];
      prismaMock.application.findMany.mockResolvedValue(apps);

      const app = createApp();
      const res = await request(app).get('/api/applications');

      expect(res.status).toBe(200);
      expect(res.body[0].continuityLevel).toBeDefined();
      expect(res.body[0].continuityLevel.rtoMinutes).toBe(60);
      expect(res.body[0].continuityLevel.rpoMinutes).toBe(5);
    });

    it('continuity levels ordered from lowest to highest RTO', async () => {
      const levels = [
        { id: 'cl-1', name: 'LOW', rtoMinutes: 1440, rpoMinutes: 240 },
        { id: 'cl-2', name: 'MODERATE', rtoMinutes: 480, rpoMinutes: 60 },
        { id: 'cl-3', name: 'SERIOUS', rtoMinutes: 240, rpoMinutes: 15 },
        { id: 'cl-4', name: 'EXTREME', rtoMinutes: 60, rpoMinutes: 5 },
      ];
      prismaMock.continuityLevel.findMany.mockResolvedValue(levels);

      const app = createApp();
      const res = await request(app).get('/api/continuity-levels');

      expect(res.status).toBe(200);
      const rtos = res.body.map((l: any) => l.rtoMinutes);
      expect(rtos).toEqual([1440, 480, 240, 60]);
    });
  });
});
