import { Router } from 'express';
import { MaintenanceStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db';

const router = Router();

const createSchema = z.object({
  instanceId: z.string().uuid().optional(),
  applicationId: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).default('SCHEDULED'),
});

const updateSchema = z.object({
  instanceId: z.string().uuid().optional().nullable(),
  applicationId: z.string().uuid().optional().nullable(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
});

const idParamSchema = z.string().uuid();

// GET /api/maintenance-windows
router.get('/', async (req, res, next) => {
  try {
    const { instanceId, applicationId, status } = req.query;
    const where: any = {};
    if (instanceId) where.instanceId = String(instanceId);
    if (applicationId) where.applicationId = String(applicationId);
    if (status) where.status = String(status);

    const windows = await prisma.maintenanceWindow.findMany({
      where,
      include: {
        instance: { include: { application: true, product: { include: { category: true } }, flavor: true, az: true } },
        application: { include: { continuityLevel: true } },
      },
      orderBy: { startTime: 'asc' },
    });
    res.json(windows);
  } catch (err) {
    next(err);
  }
});

// GET /api/maintenance-windows/stats
router.get('/stats', async (_req, res, next) => {
  try {
    const [total, scheduled, inProgress, completed, cancelled] = await Promise.all([
      prisma.maintenanceWindow.count(),
      prisma.maintenanceWindow.count({ where: { status: MaintenanceStatus.SCHEDULED } }),
      prisma.maintenanceWindow.count({ where: { status: MaintenanceStatus.IN_PROGRESS } }),
      prisma.maintenanceWindow.count({ where: { status: MaintenanceStatus.COMPLETED } }),
      prisma.maintenanceWindow.count({ where: { status: MaintenanceStatus.CANCELLED } }),
    ]);

    res.json({ total, scheduled, inProgress, completed, cancelled });
  } catch (err) {
    next(err);
  }
});

// GET /api/maintenance-windows/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const window = await prisma.maintenanceWindow.findUnique({
      where: { id },
      include: {
        instance: { include: { application: true, product: { include: { category: true } }, flavor: true, az: true } },
        application: { include: { continuityLevel: true } },
      },
    });
    if (!window) {
      return res.status(404).json({ error: 'Maintenance window not found' });
    }
    res.json(window);
  } catch (err) {
    next(err);
  }
});

// POST /api/maintenance-windows
router.post('/', async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);

    if (data.instanceId) {
      const instance = await prisma.instance.findUnique({ where: { id: data.instanceId } });
      if (!instance) {
        return res.status(404).json({ error: `Instance not found: ${data.instanceId}` });
      }
    }
    if (data.applicationId) {
      const application = await prisma.application.findUnique({ where: { id: data.applicationId } });
      if (!application) {
        return res.status(404).json({ error: `Application not found: ${data.applicationId}` });
      }
    }

    const window = await prisma.maintenanceWindow.create({
      data: {
        instanceId: data.instanceId,
        applicationId: data.applicationId,
        title: data.title,
        description: data.description,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        status: data.status,
      },
      include: {
        instance: { include: { application: true, product: { include: { category: true } }, flavor: true, az: true } },
        application: { include: { continuityLevel: true } },
      },
    });
    res.status(201).json(window);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/maintenance-windows/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const data = updateSchema.parse(req.body);

    const updateData: any = { ...data };
    if (data.startTime) updateData.startTime = new Date(data.startTime);
    if (data.endTime) updateData.endTime = new Date(data.endTime);

    const window = await prisma.maintenanceWindow.update({
      where: { id },
      data: updateData,
      include: {
        instance: { include: { application: true, product: { include: { category: true } }, flavor: true, az: true } },
        application: { include: { continuityLevel: true } },
      },
    });

    res.json(window);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/maintenance-windows/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    await prisma.maintenanceWindow.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as maintenanceWindowRoutes };
