import { Router } from 'express';
import { BackupStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED']).optional(),
  sizeBytes: z.number().int().min(0).optional(),
});

const restoreSchema = z.object({
  targetInstanceId: z.string().uuid().optional(),
  name: z.string().min(1).optional(),
});

const idParamSchema = z.string().uuid();

// GET /api/instances/:id/backups
router.get('/instances/:id/backups', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);

    const instance = await prisma.instance.findUnique({ where: { id } });
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    const backups = await prisma.backup.findMany({
      where: { instanceId: id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(backups);
  } catch (err) {
    next(err);
  }
});

// POST /api/instances/:id/backups
router.post('/instances/:id/backups', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const data = createSchema.parse(req.body);

    const instance = await prisma.instance.findUnique({ where: { id } });
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    const backup = await prisma.backup.create({
      data: {
        instanceId: id,
        name: data.name,
        description: data.description,
        status: BackupStatus.PENDING,
      },
    });
    res.status(201).json(backup);
  } catch (err) {
    next(err);
  }
});

// GET /api/backups/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const backup = await prisma.backup.findUnique({
      where: { id },
      include: { instance: { include: { application: true, product: true, flavor: true, az: true } } },
    });
    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' });
    }
    res.json(backup);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/backups/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const data = updateSchema.parse(req.body);

    const updateData: any = { ...data };
    if (data.status === 'COMPLETED' || data.status === 'FAILED') {
      updateData.completedAt = new Date();
    }

    const backup = await prisma.backup.update({
      where: { id },
      data: updateData,
    });
    res.json(backup);
  } catch (err) {
    next(err);
  }
});

// POST /api/backups/:id/restore
router.post('/:id/restore', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const data = restoreSchema.parse(req.body);

    const backup = await prisma.backup.findUnique({
      where: { id },
      include: { instance: true },
    });
    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    if (backup.status !== BackupStatus.COMPLETED) {
      return res.status(409).json({ error: 'Cannot restore from a backup that is not completed' });
    }

    let targetInstance: { id: string; name: string } | null = null;
    if (data.targetInstanceId) {
      targetInstance = await prisma.instance.findUnique({ where: { id: data.targetInstanceId } });
      if (!targetInstance) {
        return res.status(404).json({ error: 'Target instance not found' });
      }
    }

    const restored = await prisma.$transaction(async (tx) => {
      const updatedBackup = await tx.backup.update({
        where: { id },
        data: { restoredAt: new Date() },
      });

      let instanceRecord = targetInstance;
      if (!targetInstance) {
        instanceRecord = await tx.instance.create({
          data: {
            name: data.name || `${backup.instance.name}-restored`,
            description: `Restored from backup ${backup.name}`,
            applicationId: backup.instance.applicationId,
            productId: backup.instance.productId,
            flavorId: backup.instance.flavorId,
            azCode: backup.instance.azCode,
            status: 'PENDING',
            environment: backup.instance.environment,
          },
        });
      }

      return { backup: updatedBackup, instance: instanceRecord };
    });

    res.status(200).json(restored);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/backups/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    await prisma.backup.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as backupRoutes };
