import { Router, type Request, type Response } from 'express';
import { ForecastStatus, ForecastAction, Role, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db';
import { resolveTransition, TransitionError, estimateLineCost, governanceDefinition, Actor } from '../lib/forecast-workflow';

const router = Router();
const governanceDef = governanceDefinition();

const metadataSchema = z.object({
  osVersion: z.string().optional(),
}).catchall(z.unknown()).optional();

const forecastLineSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  flavorId: z.string().uuid(),
  azCode: z.string().min(1),
  quantity: z.number().int().min(1),
  metadata: metadataSchema,
  resiliency: z.enum(['STANDARD', 'HA', 'MULTI_AZ']).optional(),
});

const createForecastSchema = z.object({
  requestedBy: z.string().min(1),
  requesterEmail: z.string().email(),
  targetDate: z.preprocess((val) => {
    if (val === '' || val === undefined || val === null) return undefined;
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
      const d = new Date(val + 'T12:00:00Z');
      if (!isNaN(d.getTime()) && d.toISOString().startsWith(val)) return val + 'T12:00:00Z';
    }
    return val;
  }, z.string().datetime().optional()),
  lines: z.array(forecastLineSchema).min(1),
  justification: z.string().optional(),
  applicationId: z.string().uuid(),
  environment: z.enum(['PRD', 'DEV', 'STG']).default('DEV'),
  // Create + submit in one call
  submit: z.boolean().optional(),
});

const idParamSchema = z.string().uuid();

const editForecastSchema = z.object({
  targetDate: z.preprocess((val) => {
    if (val === '' || val === undefined || val === null) return undefined;
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
      const d = new Date(val + 'T12:00:00Z');
      if (!isNaN(d.getTime()) && d.toISOString().startsWith(val)) return val + 'T12:00:00Z';
    }
    return val;
  }, z.string().datetime().optional()),
  lines: z.array(forecastLineSchema).min(1).optional(),
  justification: z.string().optional(),
  applicationId: z.string().uuid().optional(),
  environment: z.enum(['PRD', 'DEV', 'STG']).optional(),
});

const actionSchema = z.object({
  actorName: z.string().min(1),
  actorEmail: z.string().email().optional(),
  actorId: z.string().uuid().optional(),
  comment: z.string().optional(),
});

const rejectSchema = actionSchema.extend({
  comment: z.string().min(1, 'A rejection reason is required'),
});

const forecastInclude = {
  lines: {
    include: {
      product: { include: { category: true } },
      flavor: true,
      variant: { include: { os: true, osVersion: true } },
    },
  },
  transitions: { orderBy: { createdAt: 'asc' as const } },
  application: { include: { continuityLevel: true } },
};

/** Build the actor context from the request body + DB user when identifiable. */
async function buildActor(body: { actorId?: string; actorName: string; actorEmail?: string }, requesterEmail: string): Promise<Actor> {
  let user: { id: string; email: string; name: string; roles: Role[] } | null = null;
  if (body.actorId) {
    const found = await prisma.user.findUnique({ where: { id: body.actorId } });
    if (!found) throw new TransitionError(`Actor user not found: ${body.actorId}`, 404);
    user = found as any;
  } else if (body.actorEmail) {
    user = (await prisma.user.findUnique({ where: { email: body.actorEmail } })) as any;
  }
  let isRequesterManager = false;
  if (user) {
    const requester = await prisma.user.findUnique({ where: { email: requesterEmail } });
    isRequesterManager = !!requester?.managerId && requester.managerId === user.id;
  }
  if (!user) {
    // Ad-hoc actor (no User record): REQUESTER only when they are the
    // requester of this very forecast (same email) — keeps the ad-hoc
    // template flow working; no elevated roles otherwise.
    const isRequester = !!body.actorEmail && body.actorEmail === requesterEmail;
    return { name: body.actorName, email: body.actorEmail, roles: isRequester ? [Role.REQUESTER] : [], isRequesterManager: false };
  }
  return {
    id: user.id,
    name: body.actorName || user.name,
    email: user.email,
    roles: (user.roles as Role[]) || [],
    isRequesterManager,
  };
}

function computeCost(lines: { flavor: { vcpu: number | null; ramGb: number | null }; quantity: number }[]): number {
  return lines.reduce((sum, l) => sum + estimateLineCost(l.flavor.vcpu || 0, l.flavor.ramGb || 0, l.quantity), 0);
}

function lineCreateData(line: z.infer<typeof forecastLineSchema>) {
  return {
    product: { connect: { id: line.productId } },
    flavor: { connect: { id: line.flavorId } },
    az: { connect: { code: line.azCode } },
    variant: line.variantId ? { connect: { id: line.variantId } } : undefined,
    quantity: line.quantity,
    metadata: (line.metadata ?? undefined) as any,
    resiliency: line.resiliency || 'STANDARD',
  };
}

/** Validate flavors/AZs exist and enforce the HA/MULTI_AZ >= 2 AZ governance rule. Returns flavor map. */
async function validateLines(tx: Prisma.TransactionClient, lines: z.infer<typeof forecastLineSchema>[]) {
  const flavorIds = [...new Set(lines.map((l) => l.flavorId))];
  const azCodes = [...new Set(lines.map((l) => l.azCode))];

  const variantIds = [...new Set(lines.map((l) => l.variantId).filter((v): v is string => !!v))];

  const [flavors, azs, variants, pairs] = await Promise.all([
    tx.flavor.findMany({ where: { id: { in: flavorIds } } }),
    tx.availabilityZone.findMany({ where: { code: { in: azCodes } } }),
    variantIds.length > 0
      ? tx.productVariant.findMany({ where: { id: { in: variantIds } } })
      : Promise.resolve([]),
    // Catalog compatibility: each (product, flavor) pair must exist in the
    // catalog as a ProductVariant — prevents e.g. a storage flavor on a VM.
    tx.productVariant.findMany({
      where: { OR: lines.map((l) => ({ productId: l.productId, flavorId: l.flavorId })) },
      select: { productId: true, flavorId: true },
    }),
  ]);

  const flavorMap = new Map(flavors.map((f) => [f.id, f]));
  const azMap = new Map(azs.map((z) => [z.code, z]));
  const variantMap = new Map(variants.map((v) => [v.id, v]));
  const compatiblePairs = new Set(pairs.map((p) => `${p.productId}:${p.flavorId}`));

  const azsByProduct = new Map<string, Set<string>>();
  for (const line of lines) {
    const flavor = flavorMap.get(line.flavorId);
    if (!flavor) {
      throw Object.assign(new Error(`Flavor not found: ${line.flavorId}`), { status: 404 });
    }
    const az = azMap.get(line.azCode);
    if (!az) {
      throw Object.assign(new Error(`Availability zone not found: ${line.azCode}`), { status: 404 });
    }
    if (line.variantId && !variantMap.has(line.variantId)) {
      throw Object.assign(new Error(`Variant not found: ${line.variantId}`), { status: 404 });
    }
    // Governance rule: the (product, flavor) pair must exist in the catalog
    if (!compatiblePairs.has(`${line.productId}:${line.flavorId}`)) {
      throw Object.assign(new Error(
        `Flavor "${flavor.name}" is not available for this product in the catalog — the product/flavor combination does not match any catalog variant`
      ), { status: 400 });
    }
    if (line.resiliency === 'HA' || line.resiliency === 'MULTI_AZ') {
      const set = azsByProduct.get(line.productId) || new Set<string>();
      set.add(line.azCode);
      azsByProduct.set(line.productId, set);
    }
  }

  for (const line of lines) {
    if (line.resiliency === 'HA' || line.resiliency === 'MULTI_AZ') {
      const distinctAzs = azsByProduct.get(line.productId) || new Set<string>();
      if (distinctAzs.size < 2) {
        throw Object.assign(new Error(
          `Resiliency ${line.resiliency} requires at least 2 distinct availability zones for product ${line.productId}. ` +
          `Only HA and MULTI_AZ lines count toward this requirement; STANDARD lines are ignored.`
        ), { status: 400 });
      }
    }
  }

  return flavorMap;
}

// GET /api/forecasts — supports ?queue=<STATUS> and ?mine=<email>
router.get('/', async (req, res, next) => {
  try {
    const where: Prisma.ForecastWhereInput = {};
    const queue = typeof req.query.queue === 'string' ? req.query.queue : undefined;
    if (queue && (Object.values(ForecastStatus) as string[]).includes(queue)) {
      where.status = queue as ForecastStatus;
    }
    const mine = typeof req.query.mine === 'string' ? req.query.mine : undefined;
    if (mine) {
      where.OR = [{ requesterEmail: mine }, { requestedBy: mine }];
    }

    const forecasts = await prisma.forecast.findMany({
      where,
      include: forecastInclude,
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
    const forecasts = await prisma.forecast.findMany({ select: { status: true, estimatedCost: true } });
    const byStatus = new Map<string, number>();
    let totalEstimatedCost = 0;
    for (const f of forecasts) {
      byStatus.set(f.status, (byStatus.get(f.status) || 0) + 1);
      totalEstimatedCost += f.estimatedCost || 0;
    }
    const stats = {
      total: forecasts.length,
      pending: byStatus.get(ForecastStatus.PENDING_TECH) || 0,
      approved: byStatus.get(ForecastStatus.APPROVED) || 0,
      rejected: byStatus.get(ForecastStatus.REJECTED) || 0,
      byStatus: Array.from(byStatus.entries()).map(([status, count]) => ({ status, count })),
      totalEstimatedCost,
    };
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// GET /api/forecasts/governance
router.get('/governance', async (_req, res, next) => {
  try {
    const recentTransitions = await prisma.forecastTransition.findMany({
      orderBy: { createdAt: 'desc' as const },
      take: 20,
    });
    res.json({ ...governanceDef, recentTransitions });
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
    if (days <= 0) {
      return res.status(400).json({ error: 'days must be a positive integer' });
    }
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const forecasts = await prisma.forecast.findMany({
      where: { createdAt: { gte: since } },
      select: {
        createdAt: true,
        transitions: { where: { action: 'APPROVE' }, select: { createdAt: true } },
      },
    });

    const grouped = new Map<string, { created: number; approved: number }>();
    for (const f of forecasts) {
      const date = f.createdAt.toISOString().split('T')[0];
      const entry = grouped.get(date) || { created: 0, approved: 0 };
      entry.created++;
      for (const t of f.transitions) {
        const reviewedDate = t.createdAt.toISOString().split('T')[0];
        const reviewedEntry = grouped.get(reviewedDate) || { created: 0, approved: 0 };
        reviewedEntry.approved++;
        grouped.set(reviewedDate, reviewedEntry);
      }
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
    const lines = await prisma.forecastLine.findMany({
      where: { forecast: { status: ForecastStatus.APPROVED } },
      include: { flavor: true, forecast: true },
    });

    const grouped = new Map<string, { vcpu: number; ramGb: number }>();
    for (const line of lines) {
      const entry = grouped.get(line.azCode) || { vcpu: 0, ramGb: 0 };
      entry.vcpu += (line.flavor.vcpu || 0) * line.quantity;
      entry.ramGb += (line.flavor.ramGb || 0) * line.quantity;
      grouped.set(line.azCode, entry);
    }

    // Subtract resources from terminated instances that originated from approved forecasts
    const terminatedInstances = await prisma.instance.findMany({
      where: { status: 'TERMINATED', forecastId: { not: null } },
      include: { flavor: true, forecast: true },
    });

    for (const instance of terminatedInstances) {
      if (instance.forecast?.status !== ForecastStatus.APPROVED) continue;
      const entry = grouped.get(instance.azCode);
      if (entry && instance.flavor) {
        entry.vcpu -= (instance.flavor.vcpu || 0);
        entry.ramGb -= (instance.flavor.ramGb || 0);
        if (entry.vcpu <= 0 || entry.ramGb <= 0) {
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
      where: { forecast: { status: ForecastStatus.APPROVED } },
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

// POST /api/forecasts — create in DRAFT (or create + submit)
router.post('/', async (req, res, next) => {
  try {
    const data = createForecastSchema.parse(req.body);

    const forecast = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const application = await tx.application.findUnique({
        where: { id: data.applicationId },
      });
      if (!application) {
        throw Object.assign(new Error(`Application not found: ${data.applicationId}`), { status: 404 });
      }

      const flavorMap = await validateLines(tx, data.lines);

      const actor: Actor = { name: data.requestedBy, email: data.requesterEmail, roles: [Role.REQUESTER] };
      const initialStatus = data.submit
        ? resolveTransition(ForecastStatus.DRAFT, 'SUBMIT', actor).to
        : ForecastStatus.DRAFT;

      const estimatedCost = data.lines.reduce((sum, l) => {
        const f = flavorMap.get(l.flavorId);
        return sum + estimateLineCost(f?.vcpu || 0, f?.ramGb || 0, l.quantity);
      }, 0);

      return tx.forecast.create({
        data: {
          requestedBy: data.requestedBy,
          requesterEmail: data.requesterEmail,
          targetDate: data.targetDate ? new Date(data.targetDate) : null,
          justification: data.justification,
          applicationId: data.applicationId,
          environment: data.environment,
          status: initialStatus,
          submittedAt: data.submit ? new Date() : null,
          estimatedCost,
          lines: {
            create: data.lines.map((line) => {
              const f = flavorMap.get(line.flavorId);
              const unitPrice = f ? estimateLineCost(f.vcpu || 0, f.ramGb || 0, 1) : null;
              return { ...lineCreateData(line), unitPrice };
            }),
          },
          transitions: {
            create: {
              action: data.submit ? ForecastAction.SUBMIT : ForecastAction.CREATE,
              fromStatus: ForecastStatus.DRAFT,
              toStatus: initialStatus,
              actorName: data.requestedBy,
              actorEmail: data.requesterEmail,
              actorRole: Role.REQUESTER,
              comment: data.submit ? 'Created and submitted' : 'Created as draft',
            },
          },
        },
        include: forecastInclude,
      });
    });
    res.status(201).json(forecast);
  } catch (err) {
    if (err instanceof TransitionError) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

// PATCH /api/forecasts/:id — edit only in DRAFT
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const data = editForecastSchema.parse(req.body);

    const existing = await prisma.forecast.findUnique({
      where: { id },
      include: { lines: { include: { flavor: true } } },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Forecast not found' });
    }
    if (existing.status !== ForecastStatus.DRAFT) {
      return res.status(400).json({ error: `Forecast can only be edited while in DRAFT (current status: ${existing.status})` });
    }

    const actor = await buildActor(req.body, existing.requesterEmail);

    const forecast = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updateData: Prisma.ForecastUpdateInput = {};
      if (data.justification !== undefined) updateData.justification = data.justification;
      if (data.targetDate !== undefined) updateData.targetDate = data.targetDate ? new Date(data.targetDate) : null;
      if (data.applicationId) updateData.application = { connect: { id: data.applicationId } };
      if (data.environment) updateData.environment = data.environment;

      let estimatedCost = computeCost(existing.lines);
      if (data.lines) {
        await validateLines(tx, data.lines);
        await tx.forecastLine.deleteMany({ where: { forecastId: id } });
        const flavorMap = await tx.flavor.findMany({ where: { id: { in: [...new Set(data.lines.map((l) => l.flavorId))] } } });
        const flavorById = new Map(flavorMap.map((f) => [f.id, f]));
        updateData.lines = {
          create: data.lines.map((line) => {
            const f = flavorById.get(line.flavorId);
            const unitPrice = f ? estimateLineCost(f.vcpu || 0, f.ramGb || 0, 1) : null;
            return { ...lineCreateData(line), unitPrice };
          }),
        };
        estimatedCost = data.lines.reduce((sum, l) => {
          const f = flavorById.get(l.flavorId);
          return sum + estimateLineCost(f?.vcpu || 0, f?.ramGb || 0, l.quantity);
        }, 0);
      }
      updateData.estimatedCost = estimatedCost;

      await tx.forecastTransition.create({
        data: {
          forecastId: id,
          action: ForecastAction.UPDATE,
          fromStatus: existing.status,
          toStatus: existing.status,
          actorName: actor.name,
          actorEmail: actor.email,
          comment: 'Draft edited',
        },
      });

      return tx.forecast.update({
        where: { id },
        data: updateData,
        include: forecastInclude,
      });
    });

    res.json(forecast);
  } catch (err) {
    if (err instanceof TransitionError) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

/** Shared implementation for the lifecycle action endpoints. */
async function performAction(
  req: Request,
  res: Response,
  action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'CANCEL' | 'RESUBMIT',
) {
  const { id } = req.params;
  idParamSchema.parse(id);
  const schema = action === 'REJECT' ? rejectSchema : actionSchema;
  const body = schema.parse(req.body);

  const existing = await prisma.forecast.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: 'Forecast not found' });
  }

  const actor = await buildActor(body, existing.requesterEmail);
  const { to } = resolveTransition(existing.status, action, actor);

  const forecast = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const updateData: Prisma.ForecastUpdateInput = { status: to };
    if (action === 'SUBMIT' || action === 'RESUBMIT') {
      updateData.submittedAt = new Date();
      updateData.rejectionReason = null;
    }
    if (action === 'APPROVE') {
      updateData.reviewedBy = actor.name;
      updateData.reviewedAt = new Date();
    }
    if (action === 'REJECT') {
      updateData.reviewedBy = actor.name;
      updateData.reviewedAt = new Date();
      updateData.rejectionReason = body.comment;
    }

    await tx.forecastTransition.create({
      data: {
        forecastId: id,
        action: action as ForecastAction,
        fromStatus: existing.status,
        toStatus: to,
        actorName: actor.name,
        actorEmail: actor.email,
        actorRole: actor.roles[0] || null,
        comment: body.comment,
      },
    });

    return tx.forecast.update({
      where: { id },
      data: updateData,
      include: forecastInclude,
    });
  });

  return res.json(forecast);
}

// POST /api/forecasts/:id/submit
router.post('/:id/submit', async (req, res, next) => {
  try {
    await performAction(req, res, 'SUBMIT');
  } catch (err) {
    if (err instanceof TransitionError) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /api/forecasts/:id/approve
router.post('/:id/approve', async (req, res, next) => {
  try {
    await performAction(req, res, 'APPROVE');
  } catch (err) {
    if (err instanceof TransitionError) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /api/forecasts/:id/reject — reason mandatory
router.post('/:id/reject', async (req, res, next) => {
  try {
    await performAction(req, res, 'REJECT');
  } catch (err) {
    if (err instanceof TransitionError) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /api/forecasts/:id/cancel
router.post('/:id/cancel', async (req, res, next) => {
  try {
    await performAction(req, res, 'CANCEL');
  } catch (err) {
    if (err instanceof TransitionError) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /api/forecasts/:id/resubmit
router.post('/:id/resubmit', async (req, res, next) => {
  try {
    await performAction(req, res, 'RESUBMIT');
  } catch (err) {
    if (err instanceof TransitionError) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// GET /api/forecasts/:id — detail with transitions
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const forecast = await prisma.forecast.findUnique({ where: { id }, include: forecastInclude });
    if (!forecast) {
      return res.status(404).json({ error: 'Forecast not found' });
    }
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
    const existing = await prisma.forecast.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Forecast not found' });
    }
    await prisma.forecast.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as forecastRoutes };
