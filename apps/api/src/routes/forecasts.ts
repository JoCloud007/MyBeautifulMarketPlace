import { Router } from 'express';
import { ApprovalStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAdminAuth } from '../middleware/auth';

const router = Router();

const forecastLineSchema = z.object({
  productId: z.string().uuid(),
  flavorId: z.string().uuid(),
  azCode: z.string().min(1),
  quantity: z.number().int().min(1),
  metadata: z.record(z.any()).optional(),
});

const createForecastSchema = z.object({
  requestedBy: z.string().min(1),
  requesterEmail: z.string().email(),
  targetDate: z.string().datetime().optional(),
  lines: z.array(forecastLineSchema).min(1),
  justification: z.string().optional(),
});

const idParamSchema = z.string().uuid();

const updateForecastSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  reviewedBy: z.string().min(1),
  rejectionReason: z.string().optional(),
}).refine((data) => {
  if (data.status === 'REJECTED') {
    return !!data.rejectionReason && data.rejectionReason.trim().length > 0;
  }
  return true;
}, {
  message: 'rejectionReason is required when status is REJECTED',
  path: ['rejectionReason'],
});

// GET /api/forecasts
router.get('/', async (_req, res, next) => {
  try {
    const forecasts = await prisma.forecast.findMany({
      include: { lines: { include: { product: { include: { category: true } }, flavor: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(forecasts);
  } catch (err) {
    next(err);
  }
});

// GET /api/forecasts/stats
router.get('/stats', async (_req, res, next) => {
  try {
    const [total, pending, approved, rejected] = await Promise.all([
      prisma.forecast.count(),
      prisma.forecast.count({ where: { status: ApprovalStatus.PENDING } }),
      prisma.forecast.count({ where: { status: ApprovalStatus.APPROVED } }),
      prisma.forecast.count({ where: { status: ApprovalStatus.REJECTED } }),
    ]);

    res.json({ total, pending, approved, rejected });
  } catch (err) {
    next(err);
  }
});

// POST /api/forecasts
router.post('/', requireAdminAuth, async (req, res, next) => {
  try {
    const data = createForecastSchema.parse(req.body);

    for (const line of data.lines) {
      const flavor = await prisma.flavor.findUnique({ where: { id: line.flavorId } });
      if (!flavor) {
        return res.status(404).json({ error: `Flavor not found: ${line.flavorId}` });
      }
      if (flavor.productId !== line.productId) {
        return res.status(409).json({ error: `Flavor ${line.flavorId} does not belong to product ${line.productId}` });
      }
      const az = await prisma.availabilityZone.findUnique({ where: { code: line.azCode } });
      if (!az) {
        return res.status(404).json({ error: `Availability zone not found: ${line.azCode}` });
      }
      const offered = await prisma.productAvailabilityZone.findFirst({
        where: { productId: line.productId, availabilityZoneId: az.id },
      });
      if (!offered) {
        return res.status(409).json({ error: `Product ${line.productId} is not available in zone ${line.azCode}` });
      }
    }

    const forecast = await prisma.forecast.create({
      data: {
        requestedBy: data.requestedBy,
        requesterEmail: data.requesterEmail,
        targetDate: data.targetDate ? new Date(data.targetDate) : null,
        justification: data.justification,
        lines: {
          create: data.lines.map((line) => ({
            productId: line.productId,
            flavorId: line.flavorId,
            azCode: line.azCode,
            quantity: line.quantity,
            metadata: line.metadata || undefined,
          })),
        },
      },
      include: { lines: { include: { product: true, flavor: true } } },
    });
    res.status(201).json(forecast);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/forecasts/:id
router.patch('/:id', requireAdminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const data = updateForecastSchema.parse(req.body);

    const forecast = await prisma.forecast.update({
      where: { id },
      data: {
        status: data.status,
        reviewedBy: data.reviewedBy,
        reviewedAt: new Date(),
        rejectionReason: data.rejectionReason || null,
      },
      include: { lines: { include: { product: true, flavor: true } } },
    });

    res.json(forecast);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/forecasts/:id
router.delete('/:id', requireAdminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    await prisma.forecast.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as forecastRoutes };
