import request from 'supertest';
import express from 'express';

var prismaMock: any = {};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => prismaMock),
  MaintenanceStatus: {
    SCHEDULED: 'SCHEDULED',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
  },
}));

import { maintenanceWindowRoutes } from '../routes/maintenance-windows';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/maintenance-windows', maintenanceWindowRoutes);
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

describe('Maintenance Window Routes', () => {
  beforeEach(() => {
    prismaMock.maintenanceWindow = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    prismaMock.instance = {
      findUnique: jest.fn(),
    };
    prismaMock.application = {
      findUnique: jest.fn(),
    };
    jest.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /api/maintenance-windows
  // ═══════════════════════════════════════════════════════════════════════════
  describe('GET /api/maintenance-windows', () => {
    it('should list all maintenance windows ordered by startTime asc', async () => {
      const windows = [
        {
          id: '11111111-1111-1111-1111-111111111111',
          title: 'Patch Tuesday',
          startTime: '2024-06-01T02:00:00.000Z',
          endTime: '2024-06-01T04:00:00.000Z',
          status: 'SCHEDULED',
          instance: null,
          application: null,
        },
        {
          id: 'mw2',
          title: 'DB Upgrade',
          startTime: '2024-06-15T01:00:00.000Z',
          endTime: '2024-06-15T03:00:00.000Z',
          status: 'SCHEDULED',
          instance: { id: '22222222-2222-2222-2222-222222222222', name: 'prod-web-01', application: { id: '33333333-3333-3333-3333-333333333333', name: 'App A' } },
          application: { id: '33333333-3333-3333-3333-333333333333', name: 'App A', continuityLevel: { id: 'cl1', name: 'EXTREME' } },
        },
      ];
      prismaMock.maintenanceWindow.findMany.mockResolvedValue(windows);

      const app = createApp();
      const res = await request(app).get('/api/maintenance-windows');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(windows);
      expect(prismaMock.maintenanceWindow.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          instance: { include: { application: true, product: { include: { category: true } }, flavor: true, az: true } },
          application: { include: { continuityLevel: true } },
        },
        orderBy: { startTime: 'asc' },
      });
    });

    it('should filter by instanceId', async () => {
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const app = createApp();
      const res = await request(app).get('/api/maintenance-windows?instanceId=22222222-2222-2222-2222-222222222222');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
      expect(prismaMock.maintenanceWindow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { instanceId: '22222222-2222-2222-2222-222222222222' },
        })
      );
    });

    it('should filter by applicationId', async () => {
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const app = createApp();
      const res = await request(app).get('/api/maintenance-windows?applicationId=33333333-3333-3333-3333-333333333333');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
      expect(prismaMock.maintenanceWindow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { applicationId: '33333333-3333-3333-3333-333333333333' },
        })
      );
    });

    it('should filter by status', async () => {
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const app = createApp();
      const res = await request(app).get('/api/maintenance-windows?status=COMPLETED');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
      expect(prismaMock.maintenanceWindow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'COMPLETED' },
        })
      );
    });

    it('should filter by all three query params', async () => {
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const app = createApp();
      const res = await request(app).get('/api/maintenance-windows?instanceId=22222222-2222-2222-2222-222222222222&applicationId=33333333-3333-3333-3333-333333333333&status=SCHEDULED');

      expect(res.status).toBe(200);
      expect(prismaMock.maintenanceWindow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { instanceId: '22222222-2222-2222-2222-222222222222', applicationId: '33333333-3333-3333-3333-333333333333', status: 'SCHEDULED' },
        })
      );
    });

    it('should return empty array when no windows exist', async () => {
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const app = createApp();
      const res = await request(app).get('/api/maintenance-windows');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /api/maintenance-windows/stats
  // ═══════════════════════════════════════════════════════════════════════════
  describe('GET /api/maintenance-windows/stats', () => {
    it('should return correct stats aggregation', async () => {
      prismaMock.maintenanceWindow.count
        .mockResolvedValueOnce(12)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(1);

      const app = createApp();
      const res = await request(app).get('/api/maintenance-windows/stats');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ total: 12, scheduled: 5, inProgress: 2, completed: 4, cancelled: 1 });
      expect(prismaMock.maintenanceWindow.count).toHaveBeenCalledTimes(5);
      expect(prismaMock.maintenanceWindow.count).toHaveBeenNthCalledWith(2, { where: { status: 'SCHEDULED' } });
      expect(prismaMock.maintenanceWindow.count).toHaveBeenNthCalledWith(3, { where: { status: 'IN_PROGRESS' } });
      expect(prismaMock.maintenanceWindow.count).toHaveBeenNthCalledWith(4, { where: { status: 'COMPLETED' } });
      expect(prismaMock.maintenanceWindow.count).toHaveBeenNthCalledWith(5, { where: { status: 'CANCELLED' } });
    });

    it('should handle zero counts', async () => {
      prismaMock.maintenanceWindow.count.mockResolvedValue(0);

      const app = createApp();
      const res = await request(app).get('/api/maintenance-windows/stats');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ total: 0, scheduled: 0, inProgress: 0, completed: 0, cancelled: 0 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /api/maintenance-windows/:id
  // ═══════════════════════════════════════════════════════════════════════════
  describe('GET /api/maintenance-windows/:id', () => {
    it('should return a single maintenance window', async () => {
      const window = {
        id: '11111111-1111-1111-1111-111111111111',
        title: 'Patch Tuesday',
        startTime: '2024-06-01T02:00:00.000Z',
        endTime: '2024-06-01T04:00:00.000Z',
        status: 'SCHEDULED',
        instance: null,
        application: null,
      };
      prismaMock.maintenanceWindow.findUnique.mockResolvedValue(window);

      const app = createApp();
      const res = await request(app).get('/api/maintenance-windows/11111111-1111-1111-1111-111111111111');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(window);
      expect(prismaMock.maintenanceWindow.findUnique).toHaveBeenCalledWith({
        where: { id: '11111111-1111-1111-1111-111111111111' },
        include: {
          instance: { include: { application: true, product: { include: { category: true } }, flavor: true, az: true } },
          application: { include: { continuityLevel: true } },
        },
      });
    });

    it('should return 404 when window not found', async () => {
      prismaMock.maintenanceWindow.findUnique.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).get('/api/maintenance-windows/00000000-0000-0000-0000-000000000000');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Maintenance window not found');
    });

    it('should reject invalid UUID format', async () => {
      const app = createApp();
      const res = await request(app).get('/api/maintenance-windows/not-a-uuid');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /api/maintenance-windows
  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /api/maintenance-windows', () => {
    it('should create a maintenance window with minimal required fields', async () => {
      const payload = {
        title: 'Monthly Patching',
        startTime: '2024-07-01T02:00:00.000Z',
        endTime: '2024-07-01T04:00:00.000Z',
      };
      const created = {
        id: 'mw-new',
        ...payload,
        instanceId: null,
        applicationId: null,
        description: null,
        status: 'SCHEDULED',
        instance: null,
        application: null,
      };
      prismaMock.maintenanceWindow.create.mockResolvedValue(created);

      const app = createApp();
      const res = await request(app).post('/api/maintenance-windows').send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(created);
      expect(prismaMock.maintenanceWindow.create).toHaveBeenCalledWith({
        data: {
          instanceId: undefined,
          applicationId: undefined,
          title: 'Monthly Patching',
          description: undefined,
          startTime: expect.any(Date),
          endTime: expect.any(Date),
          status: 'SCHEDULED',
        },
        include: {
          instance: { include: { application: true, product: { include: { category: true } }, flavor: true, az: true } },
          application: { include: { continuityLevel: true } },
        },
      });
    });

    it('should create a maintenance window with instanceId and applicationId', async () => {
      const payload = {
        instanceId: '22222222-2222-2222-2222-222222222222',
        applicationId: '33333333-3333-3333-3333-333333333333',
        title: 'DB Maintenance',
        description: 'Apply security patches',
        startTime: '2024-07-01T02:00:00.000Z',
        endTime: '2024-07-01T04:00:00.000Z',
        status: 'SCHEDULED',
      };
      const created = {
        id: 'mw-new',
        ...payload,
        instance: { id: '22222222-2222-2222-2222-222222222222', name: 'prod-db-01' },
        application: { id: '33333333-3333-3333-3333-333333333333', name: 'App A' },
      };
      prismaMock.instance.findUnique.mockResolvedValue({ id: '22222222-2222-2222-2222-222222222222' });
      prismaMock.application.findUnique.mockResolvedValue({ id: '33333333-3333-3333-3333-333333333333' });
      prismaMock.maintenanceWindow.create.mockResolvedValue(created);

      const app = createApp();
      const res = await request(app).post('/api/maintenance-windows').send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(created);
      expect(prismaMock.instance.findUnique).toHaveBeenCalledWith({ where: { id: '22222222-2222-2222-2222-222222222222' } });
      expect(prismaMock.application.findUnique).toHaveBeenCalledWith({ where: { id: '33333333-3333-3333-3333-333333333333' } });
    });

    it('should create with status IN_PROGRESS', async () => {
      const payload = {
        title: 'Emergency Fix',
        startTime: '2024-07-01T02:00:00.000Z',
        endTime: '2024-07-01T04:00:00.000Z',
        status: 'IN_PROGRESS',
      };
      prismaMock.maintenanceWindow.create.mockResolvedValue({ id: 'mw-new', ...payload });

      const app = createApp();
      const res = await request(app).post('/api/maintenance-windows').send(payload);

      expect(res.status).toBe(201);
      expect(prismaMock.maintenanceWindow.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'IN_PROGRESS' }),
        })
      );
    });

    it('should default status to SCHEDULED when omitted', async () => {
      const payload = {
        title: 'Default Status Test',
        startTime: '2024-07-01T02:00:00.000Z',
        endTime: '2024-07-01T04:00:00.000Z',
      };
      prismaMock.maintenanceWindow.create.mockResolvedValue({ id: 'mw-new', ...payload, status: 'SCHEDULED' });

      const app = createApp();
      await request(app).post('/api/maintenance-windows').send(payload);

      expect(prismaMock.maintenanceWindow.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SCHEDULED' }),
        })
      );
    });

    it('should reject missing title', async () => {
      const payload = {
        startTime: '2024-07-01T02:00:00.000Z',
        endTime: '2024-07-01T04:00:00.000Z',
      };

      const app = createApp();
      const res = await request(app).post('/api/maintenance-windows').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject empty title', async () => {
      const payload = {
        title: '',
        startTime: '2024-07-01T02:00:00.000Z',
        endTime: '2024-07-01T04:00:00.000Z',
      };

      const app = createApp();
      const res = await request(app).post('/api/maintenance-windows').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject missing startTime', async () => {
      const payload = {
        title: 'No Start Time',
        endTime: '2024-07-01T04:00:00.000Z',
      };

      const app = createApp();
      const res = await request(app).post('/api/maintenance-windows').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject missing endTime', async () => {
      const payload = {
        title: 'No End Time',
        startTime: '2024-07-01T02:00:00.000Z',
      };

      const app = createApp();
      const res = await request(app).post('/api/maintenance-windows').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject invalid datetime format', async () => {
      const payload = {
        title: 'Bad Date',
        startTime: 'not-a-date',
        endTime: '2024-07-01T04:00:00.000Z',
      };

      const app = createApp();
      const res = await request(app).post('/api/maintenance-windows').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject invalid status enum', async () => {
      const payload = {
        title: 'Bad Status',
        startTime: '2024-07-01T02:00:00.000Z',
        endTime: '2024-07-01T04:00:00.000Z',
        status: 'PENDING',
      };

      const app = createApp();
      const res = await request(app).post('/api/maintenance-windows').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject invalid UUID for instanceId', async () => {
      const payload = {
        instanceId: 'not-a-uuid',
        title: 'Bad Instance',
        startTime: '2024-07-01T02:00:00.000Z',
        endTime: '2024-07-01T04:00:00.000Z',
      };

      const app = createApp();
      const res = await request(app).post('/api/maintenance-windows').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject invalid UUID for applicationId', async () => {
      const payload = {
        applicationId: 'not-a-uuid',
        title: 'Bad Application',
        startTime: '2024-07-01T02:00:00.000Z',
        endTime: '2024-07-01T04:00:00.000Z',
      };

      const app = createApp();
      const res = await request(app).post('/api/maintenance-windows').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should return 404 when referenced instance does not exist', async () => {
      const payload = {
        instanceId: '22222222-2222-2222-2222-222222222222',
        title: 'Missing Instance',
        startTime: '2024-07-01T02:00:00.000Z',
        endTime: '2024-07-01T04:00:00.000Z',
      };
      prismaMock.instance.findUnique.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).post('/api/maintenance-windows').send(payload);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Instance not found: 22222222-2222-2222-2222-222222222222');
    });

    it('should return 404 when referenced application does not exist', async () => {
      const payload = {
        applicationId: '33333333-3333-3333-3333-333333333333',
        title: 'Missing Application',
        startTime: '2024-07-01T02:00:00.000Z',
        endTime: '2024-07-01T04:00:00.000Z',
      };
      prismaMock.application.findUnique.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).post('/api/maintenance-windows').send(payload);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Application not found: 33333333-3333-3333-3333-333333333333');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PATCH /api/maintenance-windows/:id
  // ═══════════════════════════════════════════════════════════════════════════
  describe('PATCH /api/maintenance-windows/:id', () => {
    it('should update title', async () => {
      const updated = {
        id: '11111111-1111-1111-1111-111111111111',
        title: 'Updated Title',
        startTime: '2024-06-01T02:00:00.000Z',
        endTime: '2024-06-01T04:00:00.000Z',
        status: 'SCHEDULED',
        instance: null,
        application: null,
      };
      prismaMock.maintenanceWindow.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app).patch('/api/maintenance-windows/11111111-1111-1111-1111-111111111111').send({ title: 'Updated Title' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(updated);
      expect(prismaMock.maintenanceWindow.update).toHaveBeenCalledWith({
        where: { id: '11111111-1111-1111-1111-111111111111' },
        data: { title: 'Updated Title' },
        include: {
          instance: { include: { application: true, product: { include: { category: true } }, flavor: true, az: true } },
          application: { include: { continuityLevel: true } },
        },
      });
    });

    it('should update status', async () => {
      const updated = {
        id: '11111111-1111-1111-1111-111111111111',
        title: 'Patch Tuesday',
        startTime: '2024-06-01T02:00:00.000Z',
        endTime: '2024-06-01T04:00:00.000Z',
        status: 'COMPLETED',
        instance: null,
        application: null,
      };
      prismaMock.maintenanceWindow.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app).patch('/api/maintenance-windows/11111111-1111-1111-1111-111111111111').send({ status: 'COMPLETED' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('COMPLETED');
    });

    it('should update startTime and endTime converting strings to Dates', async () => {
      const updated = {
        id: '11111111-1111-1111-1111-111111111111',
        title: 'Patch Tuesday',
        startTime: '2024-08-01T02:00:00.000Z',
        endTime: '2024-08-01T04:00:00.000Z',
        status: 'SCHEDULED',
        instance: null,
        application: null,
      };
      prismaMock.maintenanceWindow.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app)
        .patch('/api/maintenance-windows/11111111-1111-1111-1111-111111111111')
        .send({ startTime: '2024-08-01T02:00:00.000Z', endTime: '2024-08-01T04:00:00.000Z' });

      expect(res.status).toBe(200);
      expect(prismaMock.maintenanceWindow.update).toHaveBeenCalledWith({
        where: { id: '11111111-1111-1111-1111-111111111111' },
        data: {
          startTime: expect.any(Date),
          endTime: expect.any(Date),
        },
        include: expect.any(Object),
      });
    });

    it('should allow nulling instanceId', async () => {
      const updated = {
        id: '11111111-1111-1111-1111-111111111111',
        title: 'Patch Tuesday',
        startTime: '2024-06-01T02:00:00.000Z',
        endTime: '2024-06-01T04:00:00.000Z',
        status: 'SCHEDULED',
        instanceId: null,
        instance: null,
        application: null,
      };
      prismaMock.maintenanceWindow.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app).patch('/api/maintenance-windows/11111111-1111-1111-1111-111111111111').send({ instanceId: null });

      expect(res.status).toBe(200);
      expect(prismaMock.maintenanceWindow.update).toHaveBeenCalledWith({
        where: { id: '11111111-1111-1111-1111-111111111111' },
        data: { instanceId: null },
        include: expect.any(Object),
      });
    });

    it('should allow nulling applicationId', async () => {
      const updated = {
        id: '11111111-1111-1111-1111-111111111111',
        title: 'Patch Tuesday',
        startTime: '2024-06-01T02:00:00.000Z',
        endTime: '2024-06-01T04:00:00.000Z',
        status: 'SCHEDULED',
        applicationId: null,
        instance: null,
        application: null,
      };
      prismaMock.maintenanceWindow.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app).patch('/api/maintenance-windows/11111111-1111-1111-1111-111111111111').send({ applicationId: null });

      expect(res.status).toBe(200);
      expect(prismaMock.maintenanceWindow.update).toHaveBeenCalledWith({
        where: { id: '11111111-1111-1111-1111-111111111111' },
        data: { applicationId: null },
        include: expect.any(Object),
      });
    });

    it('should reject invalid status enum on update', async () => {
      const app = createApp();
      const res = await request(app).patch('/api/maintenance-windows/11111111-1111-1111-1111-111111111111').send({ status: 'UNKNOWN' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject empty title on update', async () => {
      const app = createApp();
      const res = await request(app).patch('/api/maintenance-windows/11111111-1111-1111-1111-111111111111').send({ title: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject invalid UUID param', async () => {
      const app = createApp();
      const res = await request(app).patch('/api/maintenance-windows/not-a-uuid').send({ title: 'OK' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DELETE /api/maintenance-windows/:id
  // ═══════════════════════════════════════════════════════════════════════════
  describe('DELETE /api/maintenance-windows/:id', () => {
    it('should delete a maintenance window', async () => {
      prismaMock.maintenanceWindow.delete.mockResolvedValue({});

      const app = createApp();
      const res = await request(app).delete('/api/maintenance-windows/11111111-1111-1111-1111-111111111111');

      expect(res.status).toBe(204);
      expect(prismaMock.maintenanceWindow.delete).toHaveBeenCalledWith({ where: { id: '11111111-1111-1111-1111-111111111111' } });
    });

    it('should reject invalid UUID param', async () => {
      const app = createApp();
      const res = await request(app).delete('/api/maintenance-windows/not-a-uuid');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });
});
