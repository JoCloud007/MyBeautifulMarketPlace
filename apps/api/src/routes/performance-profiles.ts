import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';

const router = Router();

const idParamSchema = z.string().uuid();

const metricSchema = z.object({
  name: z.string().min(1, 'Metric name is required'),
  value: z.number(),
  unit: z.string().optional(),
  comparison: z.string().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

const createProfileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  targetType: z.enum(['PRODUCT', 'FLAVOR']),
  targetId: z.string().uuid('Invalid target ID'),
  overallScore: z.number().int().min(0).max(100),
  scoreLabel: z.string().optional(),
  colorTheme: z.enum(['green', 'yellow', 'red', 'blue']).optional(),
  visibility: z.enum(['SHOW_ALL', 'INTERNAL_ONLY', 'HIDDEN']).optional(),
  metrics: z.array(metricSchema).optional(),
});

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  targetType: z.enum(['PRODUCT', 'FLAVOR']).optional(),
  targetId: z.string().uuid().optional(),
  overallScore: z.number().int().min(0).max(100).optional(),
  scoreLabel: z.string().optional(),
  colorTheme: z.enum(['green', 'yellow', 'red', 'blue']).optional(),
  visibility: z.enum(['SHOW_ALL', 'INTERNAL_ONLY', 'HIDDEN']).optional(),
  metrics: z.array(metricSchema).optional(),
});

// GET /api/performance-profiles
router.get('/', async (req, res, next) => {
  try {
    const { targetType, targetId } = req.query as { targetType?: string; targetId?: string };

    const where: any = {};
    if (targetType) {
      where.targetType = targetType;
    }
    if (targetId) {
      where.targetId = targetId;
    }

    const profiles = await prisma.performanceProfile.findMany({
      where,
      include: { metrics: { orderBy: { displayOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json(profiles);
  } catch (err) {
    next(err);
  }
});

// POST /api/performance-profiles
router.post('/', async (req, res, next) => {
  try {
    const data = createProfileSchema.parse(req.body);

    const existing = await prisma.performanceProfile.findUnique({
      where: {
        targetType_targetId_name: {
          targetType: data.targetType,
          targetId: data.targetId,
          name: data.name,
        },
      },
    });
    if (existing) {
      return res.status(409).json({
        error: 'A performance profile already exists for this target',
      });
    }

    const relationData =
      data.targetType === 'PRODUCT'
        ? { productId: data.targetId }
        : { flavorId: data.targetId };

    const profile = await prisma.performanceProfile.create({
      data: {
        name: data.name,
        targetType: data.targetType,
        targetId: data.targetId,
        overallScore: data.overallScore,
        scoreLabel: data.scoreLabel,
        colorTheme: data.colorTheme,
        visibility: data.visibility,
        ...relationData,
        metrics: data.metrics
          ? {
              create: data.metrics.map((m) => ({
                name: m.name,
                value: m.value,
                unit: m.unit,
                comparison: m.comparison,
                displayOrder: m.displayOrder ?? 0,
              })),
            }
          : undefined,
      },
      include: { metrics: { orderBy: { displayOrder: 'asc' } } },
    });

    res.status(201).json(profile);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/performance-profiles/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const data = updateProfileSchema.parse(req.body);

    const existing = await prisma.performanceProfile.findUnique({
      where: { id },
      include: { metrics: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Performance profile not found' });
    }

    // Check unique constraint if targetType or targetId changed
    if (data.targetType || data.targetId) {
      const newTargetType = data.targetType ?? existing.targetType;
      const newTargetId = data.targetId ?? existing.targetId;
      const conflict = await prisma.performanceProfile.findUnique({
        where: {
          targetType_targetId_name: {
            targetType: newTargetType,
            targetId: newTargetId,
            name: data.name ?? existing.name,
          },
        },
      });
      if (conflict && conflict.id !== id) {
        return res.status(409).json({
          error: 'A performance profile already exists for this target',
        });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Replace metrics if provided
      if (data.metrics) {
        await tx.performanceMetric.deleteMany({ where: { profileId: id } });
        if (data.metrics.length > 0) {
          await tx.performanceMetric.createMany({
            data: data.metrics.map((m) => ({
              profileId: id,
              name: m.name,
              value: m.value,
              unit: m.unit,
              comparison: m.comparison,
              displayOrder: m.displayOrder ?? 0,
            })),
          });
        }
      }

      const newTargetType = data.targetType ?? existing.targetType;
      const newTargetId = data.targetId ?? existing.targetId;
      const relationUpdate =
        newTargetType === 'PRODUCT'
          ? { productId: newTargetId, flavorId: null }
          : { flavorId: newTargetId, productId: null };

      return tx.performanceProfile.update({
        where: { id },
        data: {
          name: data.name,
          targetType: data.targetType,
          targetId: data.targetId,
          overallScore: data.overallScore,
          scoreLabel: data.scoreLabel,
          colorTheme: data.colorTheme,
          visibility: data.visibility,
          ...relationUpdate,
        },
        include: { metrics: { orderBy: { displayOrder: 'asc' } } },
      });
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/performance-profiles/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);

    const profile = await prisma.performanceProfile.findUnique({ where: { id } });
    if (!profile) {
      return res.status(404).json({ error: 'Performance profile not found' });
    }

    await prisma.performanceProfile.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as performanceProfileRoutes };
