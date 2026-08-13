import { Router } from 'express';
import { ApprovalStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db';

const router = Router();

const forecastLineSchema = z.object({
  productId: z.string().uuid(),
  flavorId: z.string().uuid(),
  azCode: z.string().min(1),
  quantity: z.number().int().min(1),
  metadata: z.record(z.any()).optional(),
  resiliency: z.enum(['STANDARD', 'HA', 'MULTI_AZ']).optional(),
});

const createForecastSchema = z.object({
  requestedBy: z.string().min(1),
  requesterEmail: z.string().email(),
  targetDate: z.preprocess((val) => {
    if (val === '' || val === undefined || val === null) return undefined;
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val + 'T00:00:00Z';
    return val;
  }, z.string().datetime().optional()),
  lines: z.array(forecastLineSchema).min(1),
  justification: z.string().optional(),
  applicationId: z.string().uuid(),
  environment: z.enum(['PRD', 'DEV', 'STG']).default('DEV'),
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
      include: {
        lines: { include: { product: { include: { category: true } }, flavor: true } },
        application: { include: { continuityLevel: true } },
      },
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

// GET /api/forecasts/trends
router.get('/trends', async (req, res, next) => {
  try {
    const rawDays = req.query.days;
    const parsedDays = typeof rawDays === 'string' && /^\d+$/.test(rawDays) ? parseInt(rawDays, 10) : 30;
    const days = Math.min(parsedDays, 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const forecasts = await prisma.forecast.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, status: true },
    });

    const grouped = new Map<string, { created: number; approved: number }>();
    for (const f of forecasts) {
      const date = f.createdAt.toISOString().split('T')[0];
      const entry = grouped.get(date) || { created: 0, approved: 0 };
      entry.created++;
      if (f.status === ApprovalStatus.APPROVED) entry.approved++;
      grouped.set(date, entry);
    }

    const result = Array.from(grouped.entries())
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/forecasts/resources-by-zone
router.get('/resources-by-zone', async (_req, res, next) => {
  try {
    // Sum resources from approved forecast lines
    const lines = await prisma.forecastLine.findMany({
      where: { forecast: { status: ApprovalStatus.APPROVED } },
      include: { flavor: true, forecast: true },
    });

    const grouped = new Map<string, { vcpu: number; ramGb: number }>();
    for (const line of lines) {
      const entry = grouped.get(line.azCode) || { vcpu: 0, ramGb: 0 };
      entry.vcpu += (line.flavor.vcpu || 0) * line.quantity;
      entry.ramGb += (line.flavor.ramGb || 0) * line.quantity;
      grouped.set(line.azCode, entry);
    }

    // Subtract resources from terminated instances linked to approved forecasts
    const terminatedInstances = await prisma.instance.findMany({
      where: { status: 'TERMINATED', forecastId: { not: null } },
      include: { flavor: true },
    });

    for (const instance of terminatedInstances) {
      const entry = grouped.get(instance.azCode);
      if (entry && instance.flavor) {
        entry.vcpu -= (instance.flavor.vcpu || 0);
        entry.ramGb -= (instance.flavor.ramGb || 0);
        if (entry.vcpu <= 0 && entry.ramGb <= 0) {
          grouped.delete(instance.azCode);
        }
      }
    }

    const result = Array.from(grouped.entries()).map(([azCode, resources]) => ({
      azCode,
      ...resources,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/forecasts/demand-heatmap
router.get('/demand-heatmap', async (_req, res, next) => {
  try {
    const lines = await prisma.forecastLine.findMany({
      where: { forecast: { status: ApprovalStatus.APPROVED } },
      include: { product: true },
    });

    const grouped = new Map<string, { productId: string; productName: string; azCode: string; count: number }>();
    for (const line of lines) {
      const key = `${line.productId}-${line.azCode}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.count += line.quantity;
      } else {
        grouped.set(key, {
          productId: line.productId,
          productName: line.product.name,
          azCode: line.azCode,
          count: line.quantity,
        });
      }
    }

    res.json(Array.from(grouped.values()));
  } catch (err) {
    next(err);
  }
});

// POST /api/forecasts
router.post('/', async (req, res, next) => {
  try {
    const data = createForecastSchema.parse(req.body);

    // Validate application exists
    const application = await prisma.application.findUnique({
      where: { id: data.applicationId },
    });
    if (!application) {
      return res.status(404).json({ error: `Application not found: ${data.applicationId}` });
    }

    // Validate each line and group HA/MULTI_AZ lines by product for resiliency validation
    const azsByProduct = new Map<string, Set<string>>();
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

      if (line.resiliency === 'HA' || line.resiliency === 'MULTI_AZ') {
        const set = azsByProduct.get(line.productId) || new Set<string>();
        set.add(line.azCode);
        azsByProduct.set(line.productId, set);
      }
    }

    // HA/MULTI_AZ requires minimum 2 distinct AZs per product (counting only HA/MULTI_AZ lines)
    for (const line of data.lines) {
      if ((line.resiliency === 'HA' || line.resiliency === 'MULTI_AZ')) {
        const distinctAzs = azsByProduct.get(line.productId) || new Set<string>();
        if (distinctAzs.size < 2) {
          return res.status(400).json({
            error: `Resiliency ${line.resiliency} requires at least 2 distinct availability zones for product ${line.productId}`,
          });
        }
      }
    }

    const forecast = await prisma.forecast.create({
      data: {
        requestedBy: data.requestedBy,
        requesterEmail: data.requesterEmail,
        targetDate: data.targetDate ? new Date(data.targetDate) : null,
        justification: data.justification,
        applicationId: data.applicationId,
        environment: data.environment,
        lines: {
          create: data.lines.map((line) => ({
            productId: line.productId,
            flavorId: line.flavorId,
            azCode: line.azCode,
            quantity: line.quantity,
            metadata: line.metadata || undefined,
            resiliency: line.resiliency || 'STANDARD',
          })),
        },
      },
      include: {
        lines: { include: { product: true, flavor: true } },
        application: { include: { continuityLevel: true } },
      },
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
      include: {
        lines: { include: { product: true, flavor: true } },
        application: { include: { continuityLevel: true } },
      },
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
    idParamSchema.parse(id);
    await prisma.forecast.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as forecastRoutes };
