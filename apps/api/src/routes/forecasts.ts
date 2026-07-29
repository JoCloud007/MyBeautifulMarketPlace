import { Router } from 'express';
import { ApprovalStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../index';

const router = Router();

const createForecastSchema = z.object({
  productId: z.string().uuid(),
  flavorId: z.string().uuid(),
  requestedBy: z.string().min(1),
  requesterEmail: z.string().email(),
  quantity: z.number().int().min(1),
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
      include: { product: { include: { category: true } }, flavor: true },
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
router.post('/', async (req, res, next) => {
  try {
    const data = createForecastSchema.parse(req.body);

    // Verify that the flavor belongs to the product
    const flavor = await prisma.flavor.findUnique({ where: { id: data.flavorId } });
    if (!flavor) {
      return res.status(404).json({ error: 'Flavor not found' });
    }
    if (flavor.productId !== data.productId) {
      return res.status(409).json({ error: 'The selected flavor does not belong to the specified product' });
    }

    const forecast = await prisma.forecast.create({
      data,
      include: { product: true, flavor: true },
    });
    res.status(201).json(forecast);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/forecasts/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = updateForecastSchema.parse(req.body);

    const forecast = await prisma.forecast.update({
      where: { id },
      data: {
        status: data.status,
        reviewedBy: data.reviewedBy,
        reviewedAt: new Date(),
        rejectionReason: data.rejectionReason || null,
      },
      include: { product: true, flavor: true },
    });

    res.json(forecast);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/forecasts/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.forecast.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as forecastRoutes };
