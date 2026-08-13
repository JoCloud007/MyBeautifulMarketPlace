import request from 'supertest';
import express from 'express';
import { backupRoutes } from '../routes/backups';

var prismaMock: any = {};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => prismaMock),
  BackupStatus: {
    PENDING: 'PENDING',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
  },
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/backups', backupRoutes);
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

describe('Backup Routes', () => {
  beforeEach(() => {
    prismaMock.instance = {
      findUnique: jest.fn(),
      create: jest.fn(),
    };
    prismaMock.backup = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    prismaMock.$transaction = jest.fn((cb: any) => cb(prismaMock));
    jest.clearAllMocks();
  });

  describe('POST /api/backups/instances/:id/backups', () => {
    it('should create a backup for an existing instance', async () => {
      const instanceId = '00000000-0000-0000-0000-000000000001';
      const payload = { name: 'Daily Backup', description: 'Automated daily backup' };
      const instance = { id: instanceId, name: 'VM-1' };
      const createdBackup = {
        id: '00000000-0000-0000-0000-000000000002',
        instanceId,
        name: payload.name,
        description: payload.description,
        status: 'PENDING',
        sizeBytes: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        completedAt: null,
        restoredAt: null,
      };

      prismaMock.instance.findUnique.mockResolvedValue(instance);
      prismaMock.backup.create.mockResolvedValue(createdBackup);

      const app = createApp();
      const res = await request(app).post(`/api/backups/instances/${instanceId}/backups`).send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(createdBackup);
      expect(prismaMock.backup.create).toHaveBeenCalledWith({
        data: {
          instanceId,
          name: payload.name,
          description: payload.description,
          status: 'PENDING',
        },
      });
    });

    it('should return 404 for non-existent instance', async () => {
      prismaMock.instance.findUnique.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).post('/api/backups/instances/nonexistent-uuid/backups').send({ name: 'Test' });

      expect(res.status).toBe(400);
    });

    it('should reject missing name', async () => {
      const app = createApp();
      const res = await request(app).post('/api/backups/instances/00000000-0000-0000-0000-000000000001/backups').send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should reject invalid UUID', async () => {
      const app = createApp();
      const res = await request(app).post('/api/backups/instances/not-a-uuid/backups').send({ name: 'Test' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('GET /api/backups/instances/:id/backups', () => {
    it('should list backups for an instance', async () => {
      const instanceId = '00000000-0000-0000-0000-000000000001';
      const instance = { id: instanceId };
      const backups = [
        { id: '00000000-0000-0000-0000-000000000002', instanceId, name: 'Backup 1', status: 'COMPLETED' },
        { id: '00000000-0000-0000-0000-000000000003', instanceId, name: 'Backup 2', status: 'PENDING' },
      ];

      prismaMock.instance.findUnique.mockResolvedValue(instance);
      prismaMock.backup.findMany.mockResolvedValue(backups);

      const app = createApp();
      const res = await request(app).get(`/api/backups/instances/${instanceId}/backups`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(backups);
      expect(prismaMock.backup.findMany).toHaveBeenCalledWith({
        where: { instanceId },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no backups exist', async () => {
      const instanceId = '00000000-0000-0000-0000-000000000001';
      prismaMock.instance.findUnique.mockResolvedValue({ id: instanceId });
      prismaMock.backup.findMany.mockResolvedValue([]);

      const app = createApp();
      const res = await request(app).get(`/api/backups/instances/${instanceId}/backups`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return 404 for non-existent instance', async () => {
      prismaMock.instance.findUnique.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).get('/api/backups/instances/nonexistent-uuid/backups');

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/backups/:id', () => {
    it('should return a backup with instance details', async () => {
      const backupId = '00000000-0000-0000-0000-000000000002';
      const backup = {
        id: backupId,
        name: 'Daily Backup',
        status: 'COMPLETED',
        instance: {
          id: '00000000-0000-0000-0000-000000000001',
          name: 'VM-1',
          application: { id: '00000000-0000-0000-0000-000000000004', name: 'App' },
          product: { id: '00000000-0000-0000-0000-000000000005', name: 'VM' },
          flavor: { id: '00000000-0000-0000-0000-000000000006', name: 'Small' },
          az: { code: 'eu-west-1a', name: 'EU West 1A' },
        },
      };

      prismaMock.backup.findUnique.mockResolvedValue(backup);

      const app = createApp();
      const res = await request(app).get(`/api/backups/${backupId}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(backup);
      expect(prismaMock.backup.findUnique).toHaveBeenCalledWith({
        where: { id: backupId },
        include: {
          instance: {
            include: { application: true, product: true, flavor: true, az: true },
          },
        },
      });
    });

    it('should return 404 for non-existent backup', async () => {
      prismaMock.backup.findUnique.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).get('/api/backups/bkp-nonexistent');

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/backups/:id', () => {
    it('should update backup status to COMPLETED and set completedAt', async () => {
      const backupId = '00000000-0000-0000-0000-000000000002';
      const payload = { status: 'COMPLETED', sizeBytes: 1073741824 };
      const updated = {
        id: backupId,
        status: 'COMPLETED',
        sizeBytes: 1073741824,
        completedAt: '2024-01-01T12:00:00.000Z',
      };

      prismaMock.backup.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app).patch(`/api/backups/${backupId}`).send(payload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('COMPLETED');
      expect(res.body.sizeBytes).toBe(1073741824);
      expect(prismaMock.backup.update).toHaveBeenCalledWith({
        where: { id: backupId },
        data: expect.objectContaining({
          status: 'COMPLETED',
          sizeBytes: 1073741824,
          completedAt: expect.any(Date),
        }),
      });
    });

    it('should update backup status to FAILED and set completedAt', async () => {
      const backupId = '00000000-0000-0000-0000-000000000002';
      const payload = { status: 'FAILED' };
      const updated = {
        id: backupId,
        status: 'FAILED',
        completedAt: '2024-01-01T12:00:00.000Z',
      };

      prismaMock.backup.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app).patch(`/api/backups/${backupId}`).send(payload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('FAILED');
      expect(prismaMock.backup.update).toHaveBeenCalledWith({
        where: { id: backupId },
        data: expect.objectContaining({
          status: 'FAILED',
          completedAt: expect.any(Date),
        }),
      });
    });

    it('should update backup name without setting completedAt', async () => {
      const backupId = '00000000-0000-0000-0000-000000000002';
      const payload = { name: 'Renamed Backup' };
      const updated = { id: backupId, name: 'Renamed Backup' };

      prismaMock.backup.update.mockResolvedValue(updated);

      const app = createApp();
      const res = await request(app).patch(`/api/backups/${backupId}`).send(payload);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Renamed Backup');
      expect(prismaMock.backup.update).toHaveBeenCalledWith({
        where: { id: backupId },
        data: { name: 'Renamed Backup' },
      });
    });

    it('should reject invalid status enum', async () => {
      const app = createApp();
      const res = await request(app).patch('/api/backups/00000000-0000-0000-0000-000000000002').send({ status: 'UNKNOWN' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('POST /api/backups/:id/restore', () => {
    it('should restore to a new instance when no targetInstanceId provided', async () => {
      const backupId = '00000000-0000-0000-0000-000000000002';
      const instanceId = '00000000-0000-0000-0000-000000000001';
      const backup = {
        id: backupId,
        status: 'COMPLETED',
        instance: {
          id: instanceId,
          name: 'VM-1',
          applicationId: '00000000-0000-0000-0000-000000000004',
          productId: '00000000-0000-0000-0000-000000000005',
          flavorId: '00000000-0000-0000-0000-000000000006',
          azCode: 'eu-west-1a',
          environment: 'PRD',
        },
      };
      const newInstance = {
        id: '00000000-0000-0000-0000-000000000009',
        name: 'VM-1-restored',
        description: 'Restored from backup Daily Backup',
        applicationId: '00000000-0000-0000-0000-000000000004',
        productId: '00000000-0000-0000-0000-000000000005',
        flavorId: '00000000-0000-0000-0000-000000000006',
        azCode: 'eu-west-1a',
        status: 'PENDING',
        environment: 'PRD',
      };
      const updatedBackup = { id: backupId, restoredAt: '2024-01-01T12:00:00.000Z' };

      prismaMock.backup.findUnique.mockResolvedValue(backup);
      prismaMock.instance.create.mockResolvedValue(newInstance);
      prismaMock.backup.update.mockResolvedValue(updatedBackup);

      const app = createApp();
      const res = await request(app).post(`/api/backups/${backupId}/restore`).send({});

      expect(res.status).toBe(200);
      expect(res.body.backup.restoredAt).toBeDefined();
      expect(res.body.instance.name).toBe('VM-1-restored');
      expect(prismaMock.instance.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'VM-1-restored',
          description: `Restored from backup ${backup.instance.name}`,
          applicationId: backup.instance.applicationId,
          productId: backup.instance.productId,
          flavorId: backup.instance.flavorId,
          azCode: backup.instance.azCode,
          status: 'PENDING',
          environment: backup.instance.environment,
        }),
      });
    });

    it('should restore to an existing target instance', async () => {
      const backupId = '00000000-0000-0000-0000-000000000002';
      const targetId = '00000000-0000-0000-0000-000000000007';
      const backup = {
        id: backupId,
        status: 'COMPLETED',
        instance: {
          id: '00000000-0000-0000-0000-000000000001',
          name: 'VM-1',
          applicationId: '00000000-0000-0000-0000-000000000004',
          productId: '00000000-0000-0000-0000-000000000005',
          flavorId: '00000000-0000-0000-0000-000000000006',
          azCode: 'eu-west-1a',
          environment: 'PRD',
        },
      };
      const targetInstance = { id: targetId, name: 'Target-VM' };
      const updatedBackup = { id: backupId, restoredAt: '2024-01-01T12:00:00.000Z' };

      prismaMock.backup.findUnique.mockResolvedValue(backup);
      prismaMock.instance.findUnique.mockResolvedValue(targetInstance);
      prismaMock.backup.update.mockResolvedValue(updatedBackup);

      const app = createApp();
      const res = await request(app).post(`/api/backups/${backupId}/restore`).send({ targetInstanceId: targetId });

      expect(res.status).toBe(200);
      expect(res.body.instance.id).toBe(targetId);
      expect(prismaMock.instance.create).not.toHaveBeenCalled();
    });

    it('should return 404 for non-existent backup', async () => {
      prismaMock.backup.findUnique.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).post('/api/backups/bkp-nonexistent/restore').send({});

      expect(res.status).toBe(400);
    });

    it('should return 409 when restoring from non-completed backup', async () => {
      const backupId = '00000000-0000-0000-0000-000000000002';
      const backup = { id: backupId, status: 'PENDING', instance: { id: '00000000-0000-0000-0000-000000000001' } };

      prismaMock.backup.findUnique.mockResolvedValue(backup);

      const app = createApp();
      const res = await request(app).post(`/api/backups/${backupId}/restore`).send({});

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Cannot restore from a backup that is not completed');
    });

    it('should return 404 for non-existent target instance', async () => {
      const backupId = '00000000-0000-0000-0000-000000000002';
      const backup = {
        id: backupId,
        status: 'COMPLETED',
        instance: { id: '00000000-0000-0000-0000-000000000001', name: 'VM-1', applicationId: '00000000-0000-0000-0000-000000000004', productId: '00000000-0000-0000-0000-000000000005', flavorId: '00000000-0000-0000-0000-000000000006', azCode: 'eu-west-1a', environment: 'PRD' },
      };

      prismaMock.backup.findUnique.mockResolvedValue(backup);
      prismaMock.instance.findUnique.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).post(`/api/backups/${backupId}/restore`).send({ targetInstanceId: '00000000-0000-0000-0000-000000000008' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Target instance not found');
    });

    it('should allow custom name for restored instance', async () => {
      const backupId = '00000000-0000-0000-0000-000000000002';
      const backup = {
        id: backupId,
        status: 'COMPLETED',
        instance: {
          id: '00000000-0000-0000-0000-000000000001',
          name: 'VM-1',
          applicationId: '00000000-0000-0000-0000-000000000004',
          productId: '00000000-0000-0000-0000-000000000005',
          flavorId: '00000000-0000-0000-0000-000000000006',
          azCode: 'eu-west-1a',
          environment: 'PRD',
        },
      };
      const newInstance = {
        id: '00000000-0000-0000-0000-000000000009',
        name: 'Custom-Restored-Name',
        applicationId: '00000000-0000-0000-0000-000000000004',
        productId: '00000000-0000-0000-0000-000000000005',
        flavorId: '00000000-0000-0000-0000-000000000006',
        azCode: 'eu-west-1a',
        status: 'PENDING',
        environment: 'PRD',
      };

      prismaMock.backup.findUnique.mockResolvedValue(backup);
      prismaMock.instance.create.mockResolvedValue(newInstance);
      prismaMock.backup.update.mockResolvedValue({ id: backupId, restoredAt: new Date() });

      const app = createApp();
      const res = await request(app).post(`/api/backups/${backupId}/restore`).send({ name: 'Custom-Restored-Name' });

      expect(res.status).toBe(200);
      expect(res.body.instance.name).toBe('Custom-Restored-Name');
      expect(prismaMock.instance.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'Custom-Restored-Name' }),
      });
    });

    it('should reject invalid targetInstanceId UUID', async () => {
      const backupId = '00000000-0000-0000-0000-000000000002';
      const backup = {
        id: backupId,
        status: 'COMPLETED',
        instance: { id: '00000000-0000-0000-0000-000000000001', name: 'VM-1', applicationId: '00000000-0000-0000-0000-000000000004', productId: '00000000-0000-0000-0000-000000000005', flavorId: '00000000-0000-0000-0000-000000000006', azCode: 'eu-west-1a', environment: 'PRD' },
      };

      prismaMock.backup.findUnique.mockResolvedValue(backup);

      const app = createApp();
      const res = await request(app).post(`/api/backups/${backupId}/restore`).send({ targetInstanceId: 'not-a-uuid' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('DELETE /api/backups/:id', () => {
    it('should delete a backup', async () => {
      const backupId = '00000000-0000-0000-0000-000000000002';
      prismaMock.backup.delete.mockResolvedValue({});

      const app = createApp();
      const res = await request(app).delete(`/api/backups/${backupId}`);

      expect(res.status).toBe(204);
      expect(prismaMock.backup.delete).toHaveBeenCalledWith({ where: { id: backupId } });
    });

    it('should propagate not-found errors', async () => {
      const err = new Error('Record not found') as any;
      err.code = 'P2025';
      prismaMock.backup.delete.mockRejectedValue(err);

      const app = createApp();
      const res = await request(app).delete('/api/backups/00000000-0000-0000-0000-000000000999');

      expect(res.status).toBe(500);
    });

    it('should reject invalid UUID', async () => {
      const app = createApp();
      const res = await request(app).delete('/api/backups/not-a-uuid');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });
});
