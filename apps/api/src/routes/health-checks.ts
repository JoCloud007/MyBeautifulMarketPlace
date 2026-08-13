import { Router } from 'express';
import { HealthStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db';

const router = Router();

const createSchema = z.object({
  instanceId: z.string().uuid(),
  status: z.enum(['HEALTHY', 'DEGRADED', 'UNHEALTHY']).default('HEALTHY'),
  cpuPercent: z.number().min(0).max(100).default(0),
  memoryPercent: z.number().min(0).max(100).default(0),
  diskPercent: z.number().min(0).max(100).default(0),
  responseTimeMs: z.number().min(0).default(0),
  checkedAt: z.string().datetime().optional(),
});

const updateSchema = z.object({
  status: z.enum(['HEALTHY', 'DEGRADED', 'UNHEALTHY']).optional(),
  cpuPercent: z.number().min(0).max(100).optional(),
  memoryPercent: z.number().min(0).max(100).optional(),
  diskPercent: z.number().min(0).max(100).optional(),
  responseTimeMs: z.number().min(0).optional(),
  checkedAt: z.string().datetime().optional(),
});

const idParamSchema = z.string().uuid();

// GET /api/health-checks
router.get('/', async (req, res, next) => {
  try {
    const { instanceId, status } = req.query;
    const where: any = {};
    if (instanceId) where.instanceId = String(instanceId);
    if (status) where.status = String(status);

    const checks = await prisma.healthCheck.findMany({
      where,
      include: {
        instance: { include: { application: true, product: { include: { category: true } }, flavor: true, az: true } },
      },
      orderBy: { checkedAt: 'desc' },
    });
    res.json(checks);
  } catch (err) {
    next(err);
  }
});

// GET /api/health-checks/stats
router.get('/stats', async (_req, res, next) => {
  try {
    const [total, healthy, degraded, unhealthy] = await Promise.all([
      prisma.healthCheck.count(),
      prisma.healthCheck.count({ where: { status: HealthStatus.HEALTHY } }),
      prisma.healthCheck.count({ where: { status: HealthStatus.DEGRADED } }),
      prisma.healthCheck.count({ where: { status: HealthStatus.UNHEALTHY } }),
    ]);

    res.json({ total, healthy, degraded, unhealthy });
  } catch (err) {
    next(err);
  }
});

// GET /api/health-checks/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const check = await prisma.healthCheck.findUnique({
      where: { id },
      include: {
        instance: { include: { application: true, product: { include: { category: true } }, flavor: true, az: true } },
      },
    });
    if (!check) {
      return res.status(404).json({ error: 'Health check not found' });
    }
    res.json(check);
  } catch (err) {
    next(err);
  }
});

// POST /api/health-checks
router.post('/', async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);

    const instance = await prisma.instance.findUnique({ where: { id: data.instanceId } });
    if (!instance) {
      return res.status(404).json({ error: `Instance not found: ${data.instanceId}` });
    }

    const check = await prisma.healthCheck.create({
      data: {
        instanceId: data.instanceId,
        status: data.status,
        cpuPercent: data.cpuPercent,
        memoryPercent: data.memoryPercent,
        diskPercent: data.diskPercent,
        responseTimeMs: data.responseTimeMs,
        checkedAt: data.checkedAt ? new Date(data.checkedAt) : new Date(),
      },
      include: {
        instance: { include: { application: true, product: { include: { category: true } }, flavor: true, az: true } },
      },
    });
    res.status(201).json(check);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/health-checks/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const data = updateSchema.parse(req.body);

    const updateData: any = { ...data };
    if (data.checkedAt) updateData.checkedAt = new Date(data.checkedAt);

    const check = await prisma.healthCheck.update({
      where: { id },
      data: updateData,
      include: {
        instance: { include: { application: true, product: { include: { category: true } }, flavor: true, az: true } },
      },
    });

    res.json(check);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/health-checks/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    await prisma.healthCheck.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as healthCheckRoutes };
