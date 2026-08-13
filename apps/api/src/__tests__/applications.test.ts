import request from 'supertest';
import express from 'express';

var prismaMock: any = {};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => prismaMock),
}));

import { applicationRoutes } from '../routes/applications';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/applications', applicationRoutes);
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

describe('Application Hub Routes', () => {
  beforeEach(() => {
    prismaMock.application = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    prismaMock.forecast = { findMany: jest.fn() };
    prismaMock.instance = { findMany: jest.fn() };
    jest.clearAllMocks();
  });

  // ─── GET /api/applications ──────────────────────────────────────────────
  describe('GET /api/applications', () => {
    it('should list all applications with continuity levels', async () => {
      const apps = [
        {
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          name: 'App One',
          description: 'First app',
          continuityLevelId: 'cl1',
          continuityLevel: { id: 'cl1', name: 'LOW', rtoMinutes: 1440, rpoMinutes: 240, description: 'Basic' },
          owner: 'owner1',
          createdAt: '2024-01-01T00:00:00Z',
        },
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

    it('should return empty array when no applications exist', async () => {
      prismaMock.application.findMany.mockResolvedValue([]);
      const app = createApp();
      const res = await request(app).get('/api/applications');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // ─── GET /api/applications/:id ──────────────────────────────────────────
  describe('GET /api/applications/:id', () => {
    it('should return an application by id', async () => {
      const application = {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'App One',
        continuityLevel: { id: 'cl1', name: 'MODERATE' },
      };
      prismaMock.application.findUnique.mockResolvedValue(application);

      const app = createApp();
      const res = await request(app).get('/api/applications/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(application);
      expect(prismaMock.application.findUnique).toHaveBeenCalledWith({
        where: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
        include: { continuityLevel: true },
      });
    });

    it('should return 404 for nonexistent application', async () => {
      prismaMock.application.findUnique.mockResolvedValue(null);
      const app = createApp();
      const res = await request(app).get('/api/applications/99999999-9999-9999-9999-999999999999');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Application not found');
    });

    it('should reject invalid UUID format', async () => {
      const app = createApp();
      const res = await request(app).get('/api/applications/not-a-uuid');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  // ─── POST /api/applications ─────────────────────────────────────────────
  describe('POST /api/applications', () => {
    const validPayload = {
      name: 'New App',
      description: 'A new application',
      continuityLevelId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      owner: 'team-alpha',
    };

    it('should create an application with valid data', async () => {
      const created = {
        id: 'a-new',
        ...validPayload,
        continuityLevel: { id: validPayload.continuityLevelId, name: 'LOW' },
      };
      prismaMock.application.create.mockResolvedValue(created);

      const app = createApp();
      const res = await request(app).post('/api/applications').send(validPayload);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(created);
      expect(prismaMock.application.create).toHaveBeenCalledWith({
        data: validPayload,
        include: { continuityLevel: true },
      });
    });

    it('should reject missing name', async () => {
      const app = createApp();
      const res = await request(app).post('/api/applications').send({ ...validPayload, name: '' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject missing owner', async () => {
      const app = createApp();
      const res = await request(app).post('/api/applications').send({ ...validPayload, owner: '' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject invalid continuityLevelId', async () => {
      const app = createApp();
      const res = await request(app).post('/api/applications').send({ ...validPayload, continuityLevelId: 'bad-id' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject missing required fields', async () => {
      const app = createApp();
      const res = await request(app).post('/api/applications').send({ name: 'Only name' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should return 409 on duplicate name', async () => {
      const err = new Error('Unique constraint') as any;
      err.code = 'P2002';
      prismaMock.application.create.mockRejectedValue(err);

      const app = createApp();
      const res = await request(app).post('/api/applications').send(validPayload);
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('An application with this name already exists');
    });
  });

  // ─── PATCH /api/applications/:id ────────────────────────────────────────
  describe('PATCH /api/applications/:id', () => {
    it('should update application fields', async () => {
      const updated = {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'Updated App',
        description: 'Updated desc',
        continuityLevel: { id: 'cl1', name: 'SERIOUS' },
      };
      prismaMock.application.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app).patch('/api/applications/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa').send({ name: 'Updated App', description: 'Updated desc' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(updated);
      expect(prismaMock.application.update).toHaveBeenCalledWith({
        where: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
        data: { name: 'Updated App', description: 'Updated desc' },
        include: { continuityLevel: true },
      });
    });

    it('should reject invalid UUID param', async () => {
      const app = createApp();
      const res = await request(app).patch('/api/applications/bad-id').send({ name: 'x' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should return 409 on duplicate name', async () => {
      const err = new Error('Unique constraint') as any;
      err.code = 'P2002';
      prismaMock.application.update.mockRejectedValue(err);

      const app = createApp();
      const res = await request(app).patch('/api/applications/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa').send({ name: 'Dup' });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('An application with this name already exists');
    });
  });

  // ─── DELETE /api/applications/:id ───────────────────────────────────────
  describe('DELETE /api/applications/:id', () => {
    it('should delete an application with no related records', async () => {
      prismaMock.application.findUnique.mockResolvedValue({
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        _count: { forecasts: 0, instances: 0, maintenanceWindows: 0 },
      });
      prismaMock.application.delete.mockResolvedValue({});

      const app = createApp();
      const res = await request(app).delete('/api/applications/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

      expect(res.status).toBe(204);
      expect(prismaMock.application.delete).toHaveBeenCalledWith({ where: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' } });
    });

    it('should return 404 for nonexistent application', async () => {
      prismaMock.application.findUnique.mockResolvedValue(null);
      const app = createApp();
      const res = await request(app).delete('/api/applications/99999999-9999-9999-9999-999999999999');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Application not found');
    });

    it('should reject deletion when forecasts exist', async () => {
      prismaMock.application.findUnique.mockResolvedValue({
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        _count: { forecasts: 2, instances: 0, maintenanceWindows: 0 },
      });
      const app = createApp();
      const res = await request(app).delete('/api/applications/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
      expect(res.status).toBe(409);
      expect(res.body.error).toContain('forecasts');
    });

    it('should reject deletion when instances exist', async () => {
      prismaMock.application.findUnique.mockResolvedValue({
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        _count: { forecasts: 0, instances: 3, maintenanceWindows: 0 },
      });
      const app = createApp();
      const res = await request(app).delete('/api/applications/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
      expect(res.status).toBe(409);
      expect(res.body.error).toContain('instances');
    });

    it('should reject deletion when maintenance windows exist', async () => {
      prismaMock.application.findUnique.mockResolvedValue({
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        _count: { forecasts: 0, instances: 0, maintenanceWindows: 1 },
      });
      const app = createApp();
      const res = await request(app).delete('/api/applications/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
      expect(res.status).toBe(409);
      expect(res.body.error).toContain('maintenance windows');
    });

    it('should list all blocking relations', async () => {
      prismaMock.application.findUnique.mockResolvedValue({
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        _count: { forecasts: 1, instances: 1, maintenanceWindows: 1 },
      });
      const app = createApp();
      const res = await request(app).delete('/api/applications/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
      expect(res.status).toBe(409);
      expect(res.body.error).toContain('forecasts');
      expect(res.body.error).toContain('instances');
      expect(res.body.error).toContain('maintenance windows');
    });

    it('should reject invalid UUID param', async () => {
      const app = createApp();
      const res = await request(app).delete('/api/applications/bad-id');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });
});
