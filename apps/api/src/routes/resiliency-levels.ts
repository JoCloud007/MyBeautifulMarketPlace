import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { resolveAllowedResiliency } from '../lib/resiliency';

const router = Router();

const createLevelSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(400).optional(),
  minAz: z.number().int().min(1).max(50).default(1),
  isActive: z.boolean().default(true),
});

const updateLevelSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(400).nullable().optional(),
  minAz: z.number().int().min(1).max(50).optional(),
  isActive: z.boolean().optional(),
  order: z.number().int().optional(),
});

const idParamSchema = z.string().uuid();

const productResiliencySchema = z.object({
  levelCodes: z.array(z.string().min(1).max(40)),
});

const slugify = (name: string) =>
  name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'LEVEL';

// GET /api/resiliency-levels — all levels (admin + form usage with ?activeOnly=1)
router.get('/', async (req, res, next) => {
  try {
    const activeOnly = req.query.activeOnly === '1' || req.query.activeOnly === 'true';
    const levels = await prisma.resiliencyLevelConfig.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ rank: 'asc' }],
    });
    res.json(levels);
  } catch (err) {
    next(err);
  }
});

// GET /api/resiliency-levels/product/:productId — levels allowed for a product
// (empty association = all active levels, backward compatible)
router.get('/product/:productId', async (req, res, next) => {
  try {
    const { productId } = req.params;
    const [product, associations, activeLevels] = await Promise.all([
      prisma.product.findUnique({ where: { id: productId }, select: { id: true } }),
      prisma.productResiliency.findMany({ where: { productId } }),
      prisma.resiliencyLevelConfig.findMany({ where: { isActive: true }, orderBy: { rank: 'asc' } }),
    ]);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const allowed = associations.length === 0
      ? activeLevels
      : activeLevels.filter((l) => associations.some((a) => a.levelCode === l.code));
    res.json({ allActive: activeLevels, allowed, associatedCodes: associations.map((a) => a.levelCode) });
  } catch (err) {
    next(err);
  }
});

// PUT /api/resiliency-levels/product/:productId — replace the association set
router.put('/product/:productId', async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { levelCodes } = productResiliencySchema.parse(req.body);

    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Validate all codes exist
    const known = await prisma.resiliencyLevelConfig.findMany({
      where: { code: { in: levelCodes } },
      select: { code: true },
    });
    const knownSet = new Set(known.map((k) => k.code));
    const unknown = levelCodes.filter((c) => !knownSet.has(c));
    if (unknown.length > 0) {
      return res.status(400).json({ error: `Unknown resiliency level codes: ${unknown.join(', ')}` });
    }

    await prisma.$transaction([
      prisma.productResiliency.deleteMany({ where: { productId } }),
      levelCodes.length > 0
        ? prisma.productResiliency.createMany({
            data: [...new Set(levelCodes)].map((levelCode) => ({ productId, levelCode })),
          })
        : prisma.productResiliency.deleteMany({ where: { productId } }), // no-op keep types happy
    ]);

    res.json({ productId, levelCodes: [...new Set(levelCodes)] });
  } catch (err) {
    next(err);
  }
});

// ---------- Scoped availability rules ----------

const SCOPE_TYPES = ['REGION', 'AVAILABILITY_ZONE', 'ZONE', 'FLAVOR'] as const;

const createScopeSchema = z.object({
  levelCode: z.string().min(1).max(40),
  productId: z.string().uuid().nullable().optional(),
  scopeType: z.enum(SCOPE_TYPES),
  scopeId: z.string().min(1).max(100),
  allowed: z.boolean(),
});

// GET /api/resiliency-levels/scopes — all rules (joined for display)
router.get('/scopes', async (_req, res, next) => {
  try {
    const scopes = await prisma.resiliencyScope.findMany({
      include: {
        level: { select: { code: true, name: true, rank: true } },
        product: { select: { id: true, name: true } },
      },
      orderBy: [{ level: { rank: 'asc' } }, { scopeType: 'asc' }],
    });
    res.json(scopes);
  } catch (err) {
    next(err);
  }
});

// POST /api/resiliency-levels/scopes — create/update a rule (admin)
router.post('/scopes', async (req, res, next) => {
  try {
    const data = createScopeSchema.parse(req.body);
    const productId = data.productId ?? null;

    const level = await prisma.resiliencyLevelConfig.findUnique({ where: { code: data.levelCode } });
    if (!level) return res.status(400).json({ error: `Unknown level code: ${data.levelCode}` });

    // Validate the scope target exists
    switch (data.scopeType) {
      case 'REGION': {
        // A REGION rule targets either the AZ technical region (eu-west…) or a
        // commercial region (AMER/EMEA/APAC) attached to the product — platform
        // products without AZs declare their geography through the latter.
        const inAzGeo = await prisma.availabilityZone.findFirst({
          where: { region: data.scopeId },
          select: { region: true },
        });
        if (inAzGeo) break;
        const inCommercial = productId
          ? await prisma.productRegion.findFirst({
              where: { productId, region: { name: data.scopeId } },
              select: { regionId: true },
            })
          : null;
        if (!inCommercial) {
          return res.status(400).json({ error: `Region not found in AZ geography or product regions: ${data.scopeId}` });
        }
        break;
      }
      case 'AVAILABILITY_ZONE': {
        const found = await prisma.availabilityZone.findUnique({ where: { code: data.scopeId } });
        if (!found) return res.status(400).json({ error: `Availability zone not found: ${data.scopeId}` });
        break;
      }
      case 'ZONE': {
        const found = await prisma.zone.findUnique({ where: { id: data.scopeId } });
        if (!found) return res.status(400).json({ error: `Zone not found: ${data.scopeId}` });
        break;
      }
      case 'FLAVOR': {
        const found = await prisma.flavor.findUnique({ where: { id: data.scopeId } });
        if (!found) return res.status(400).json({ error: `Flavor not found: ${data.scopeId}` });
        break;
      }
    }

    // find-then-update/create: Prisma's compound-unique where types productId as
    // non-null here even though the column is nullable, so an explicit upsert
    // with productId: null cannot be expressed — the manual pattern can.
    const existingScope = await prisma.resiliencyScope.findFirst({
      where: { levelCode: data.levelCode, productId, scopeType: data.scopeType, scopeId: data.scopeId },
    });
    const scope = existingScope
      ? await prisma.resiliencyScope.update({ where: { id: existingScope.id }, data: { allowed: data.allowed } })
      : await prisma.resiliencyScope.create({
          data: { levelCode: data.levelCode, productId, scopeType: data.scopeType, scopeId: data.scopeId, allowed: data.allowed },
        });
    res.status(existingScope ? 200 : 201).json(scope);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/resiliency-levels/scopes/:id (admin)
router.delete('/scopes/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    z.string().uuid().parse(id);
    const existing = await prisma.resiliencyScope.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Rule not found' });
    await prisma.resiliencyScope.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// GET /api/resiliency-levels/resolve?productId&azCode&flavorId
// Levels allowed for this exact context (public — used by the forecast form).
router.get('/resolve', async (req, res, next) => {
  try {
    const productId = typeof req.query.productId === 'string' ? req.query.productId : '';
    if (!productId) return res.status(400).json({ error: 'productId query parameter is required' });
    const azCode = typeof req.query.azCode === 'string' ? req.query.azCode : null;
    const flavorId = typeof req.query.flavorId === 'string' ? req.query.flavorId : null;

    const levels = await resolveAllowedResiliency(prisma, { productId, flavorId, azCode });
    res.json({ productId, azCode, flavorId, levels });
  } catch (err) {
    next(err);
  }
});

// POST /api/resiliency-levels — create a level (rank auto = max+1)
router.post('/', async (req, res, next) => {
  try {
    const data = createLevelSchema.parse(req.body);
    const code = slugify(data.name);

    const clash = await prisma.resiliencyLevelConfig.findUnique({ where: { code } });
    if (clash) {
      return res.status(400).json({ error: `A level with code "${code}" already exists` });
    }

    const maxRank = await prisma.resiliencyLevelConfig.aggregate({ _max: { rank: true } });
    const level = await prisma.resiliencyLevelConfig.create({
      data: {
        code,
        name: data.name,
        description: data.description,
        minAz: data.minAz,
        isActive: data.isActive,
        rank: (maxRank._max.rank ?? -1) + 1,
        order: (maxRank._max.rank ?? -1) + 1,
      },
    });
    res.status(201).json(level);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/resiliency-levels/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const data = updateLevelSchema.parse(req.body);

    const existing = await prisma.resiliencyLevelConfig.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Resiliency level not found' });
    }

    const level = await prisma.resiliencyLevelConfig.update({ where: { id }, data });
    res.json(level);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/resiliency-levels/:id — refused if referenced by forecast lines
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);

    const existing = await prisma.resiliencyLevelConfig.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Resiliency level not found' });
    }

    const used = await prisma.forecastLine.count({ where: { resiliency: existing.code } });
    if (used > 0) {
      return res.status(400).json({
        error: `Level "${existing.code}" is used by ${used} forecast line(s) — deactivate it instead of deleting.`,
      });
    }

    await prisma.resiliencyLevelConfig.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export { router as resiliencyLevelRoutes };
