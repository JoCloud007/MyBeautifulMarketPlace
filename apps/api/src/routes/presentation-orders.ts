import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';

const router = Router();

const idParamSchema = z.string().uuid();

const createOrderSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

const updateOrderSchema = createOrderSchema.partial();

const stepSchema = z.object({
  stepType: z.enum(['COUNTRY', 'ZONE', 'PRODUCT', 'FLAVOR', 'USE_CASE', 'CATEGORY', 'CONTINUITY', 'OS']),
  position: z.number().int().min(0),
  label: z.string().nullish(),
  filterRule: z.string().nullish(),
});

const replaceStepsSchema = z.object({
  steps: z.array(stepSchema).min(1, 'At least one step is required'),
});

// GET /api/presentation-orders
router.get('/', async (_req, res, next) => {
  try {
    const orders = await prisma.presentationOrder.findMany({
      include: { steps: { orderBy: { position: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

// GET /api/presentation-orders/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const order = await prisma.presentationOrder.findUnique({
      where: { id },
      include: { steps: { orderBy: { position: 'asc' } } },
    });

    if (!order) {
      return res.status(404).json({ error: 'Presentation order not found' });
    }

    res.json(order);
  } catch (err) {
    next(err);
  }
});

// POST /api/presentation-orders
router.post('/', async (req, res, next) => {
  try {
    const data = createOrderSchema.parse(req.body);

    const existing = await prisma.presentationOrder.findUnique({ where: { name: data.name } });
    if (existing) {
      return res.status(409).json({ error: 'A presentation order with this name already exists' });
    }

    const order = await prisma.presentationOrder.create({
      data,
      include: { steps: { orderBy: { position: 'asc' } } },
    });

    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/presentation-orders/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const data = updateOrderSchema.parse(req.body);

    const existing = await prisma.presentationOrder.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Presentation order not found' });
    }

    if (data.name) {
      const conflict = await prisma.presentationOrder.findUnique({ where: { name: data.name } });
      if (conflict && conflict.id !== id) {
        return res.status(409).json({ error: 'A presentation order with this name already exists' });
      }
    }

    const order = await prisma.presentationOrder.update({
      where: { id },
      data,
      include: { steps: { orderBy: { position: 'asc' } } },
    });

    res.json(order);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/presentation-orders/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);

    const order = await prisma.presentationOrder.findUnique({
      where: { id },
      include: { _count: { select: { steps: true } } },
    });

    if (!order) {
      return res.status(404).json({ error: 'Presentation order not found' });
    }

    await prisma.presentationOrder.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// PUT /api/presentation-orders/:id/steps — replace all steps
router.put('/:id/steps', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const { steps } = replaceStepsSchema.parse(req.body);

    const order = await prisma.presentationOrder.findUnique({ where: { id } });
    if (!order) {
      return res.status(404).json({ error: 'Presentation order not found' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.presentationStep.deleteMany({ where: { orderId: id } });
      await tx.presentationStep.createMany({
        data: steps.map((s) => ({
          orderId: id,
          stepType: s.stepType as any,
          position: s.position,
          label: s.label,
          filterRule: s.filterRule,
        })),
      });
      return tx.presentationOrder.findUnique({
        where: { id },
        include: { steps: { orderBy: { position: 'asc' } } },
      });
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// GET /api/presentation-orders/:id/browse
router.get('/:id/browse', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);

    const order = await prisma.presentationOrder.findUnique({
      where: { id },
      include: { steps: { orderBy: { position: 'asc' } } },
    });

    if (!order) {
      return res.status(404).json({ error: 'Presentation order not found' });
    }

    const { step, country, zone, product } = req.query as {
      step?: string;
      country?: string;
      zone?: string;
      product?: string;
    };

    if (!step) {
      return res.status(400).json({ error: 'step query parameter is required' });
    }

    switch (step.toUpperCase()) {
      case 'COUNTRY': {
        const countries = await prisma.availabilityZone.findMany({
          where: { isActive: true },
          select: { country: true },
          distinct: ['country'],
          orderBy: { country: 'asc' },
        });
        const flagMap: Record<string, string> = {
          China: '🇨🇳',
          France: '🇫🇷',
          Singapore: '🇸🇬',
          UK: '🇬🇧',
          USA: '🇺🇸',
          Germany: '🇩🇪',
          Japan: '🇯🇵',
          Canada: '🇨🇦',
          Australia: '🇦🇺',
          India: '🇮🇳',
          Brazil: '🇧🇷',
          Netherlands: '🇳🇱',
          Ireland: '🇮🇪',
          Sweden: '🇸🇪',
          Switzerland: '🇨🇭',
          Spain: '🇪🇸',
          Italy: '🇮🇹',
          Poland: '🇵🇱',
          UAE: '🇦🇪',
          SouthKorea: '🇰🇷',
          'South Korea': '🇰🇷',
        };
        res.json(countries.map((c) => ({ id: c.country, name: c.country, meta: { flag: flagMap[c.country] || '🌍' } })));
        break;
      }

      case 'ZONE': {
        if (!country) {
          return res.status(400).json({ error: 'country query parameter is required for zone step' });
        }
        const zones = await prisma.zone.findMany({
          where: {
            isActive: true,
            availabilityZones: {
              some: {
                availabilityZone: { country: { equals: country, mode: 'insensitive' } },
              },
            },
          },
          select: { id: true, name: true, slug: true, description: true },
          orderBy: { name: 'asc' },
        });
        res.json(zones);
        break;
      }

      case 'PRODUCT': {
        const whereProduct: any = { isActive: true };
        if (zone) {
          whereProduct.zones = {
            some: { zoneId: zone },
          };
        }
        const products = await prisma.product.findMany({
          where: whereProduct,
          select: { id: true, name: true, slug: true, description: true, category: { select: { name: true } } },
          orderBy: { name: 'asc' },
        });
        res.json(products);
        break;
      }

      case 'FLAVOR': {
        if (!product) {
          return res.status(400).json({ error: 'product query parameter is required for flavor step' });
        }
        const flavors = await prisma.flavor.findMany({
          where: {
            variants: {
              some: { productId: product },
            },
          },
          select: { id: true, name: true, vcpu: true, ramGb: true, description: true },
          orderBy: { name: 'asc' },
        });
        const profile = await prisma.performanceProfile.findFirst({
          where: { productId: product, visibility: 'SHOW_ALL' },
          include: { metrics: { orderBy: { displayOrder: 'asc' } } },
        });
        res.json({ items: flavors, profile });
        break;
      }

      case 'CATEGORY': {
        const categories = await prisma.category.findMany({
          select: { id: true, name: true, slug: true, description: true, icon: true },
          orderBy: { name: 'asc' },
        });
        res.json(categories);
        break;
      }

      case 'USE_CASE': {
        // Use cases map to applications in this domain
        const applications = await prisma.application.findMany({
          select: { id: true, name: true, description: true, owner: true },
          orderBy: { name: 'asc' },
        });
        res.json(applications);
        break;
      }

      case 'CONTINUITY': {
        const levels = await prisma.continuityLevel.findMany({
          orderBy: { name: 'asc' },
        });
        res.json(levels.map((l) => ({
          id: l.id,
          name: l.name,
          description: l.description,
          meta: {
            rto: `${l.rtoMinutes} min`,
            rpo: `${l.rpoMinutes} min`,
            color: l.color,
          },
        })));
        break;
      }

      case 'OS': {
        const osWhere: any = { isActive: true };
        if (product) {
          osWhere.variants = { some: { productId: product } };
        }
        const osList = await prisma.operatingSystem.findMany({
          where: osWhere,
          select: { id: true, name: true, family: true, slug: true },
          orderBy: { name: 'asc' },
        });
        res.json(osList.map((os) => ({
          id: os.id,
          name: os.name,
          description: os.family,
          meta: { slug: os.slug },
        })));
        break;
      }

      default:
        res.status(400).json({ error: `Unknown step type: ${step}` });
    }
  } catch (err) {
    next(err);
  }
});

export { router as presentationOrderRoutes };
