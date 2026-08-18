import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';

const router = Router();

const idParamSchema = z.string().uuid();

const createFlavorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  vcpu: z.number().int().min(0, 'vCPU must be a non-negative integer'),
  ramGb: z.number().int().min(0, 'RAM must be a non-negative integer'),
  description: z.string().optional(),
});

const updateFlavorSchema = z.object({
  name: z.string().min(1).optional(),
  vcpu: z.number().int().min(0).optional(),
  ramGb: z.number().int().min(0).optional(),
  description: z.string().optional(),
});

// GET /api/flavors
router.get('/', async (_req, res, next) => {
  try {
    const flavors = await prisma.flavor.findMany({
      include: {
        _count: { select: { variants: true, forecastLines: true, instances: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(flavors);
  } catch (err) {
    next(err);
  }
});

// POST /api/flavors
router.post('/', async (req, res, next) => {
  try {
    const data = createFlavorSchema.parse(req.body);

    const flavor = await prisma.flavor.create({
      data,
      include: {
        _count: { select: { variants: true } },
      },
    });

    res.status(201).json(flavor);
  } catch (err) {
    next(err);
  }
});

// GET /api/flavors/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const flavor = await prisma.flavor.findUnique({
      where: { id },
      include: {
        variants: {
          include: {
            product: { select: { id: true, name: true, slug: true } },
            os: true,
            osVersion: true,
          },
        },
        _count: { select: { variants: true, forecastLines: true } },
      },
    });

    if (!flavor) {
      return res.status(404).json({ error: 'Flavor not found' });
    }

    res.json(flavor);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/flavors/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const data = updateFlavorSchema.parse(req.body);

    const existing = await prisma.flavor.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Flavor not found' });
    }

    const flavor = await prisma.flavor.update({
      where: { id },
      data,
      include: {
        _count: { select: { variants: true } },
      },
    });

    res.json(flavor);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/flavors/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);

    const flavor = await prisma.flavor.findUnique({
      where: { id },
      include: { _count: { select: { variants: true, forecastLines: true, instances: true } } },
    });

    if (!flavor) {
      return res.status(404).json({ error: 'Flavor not found' });
    }

    const blocks: string[] = [];
    if (flavor._count.variants > 0) blocks.push('variants');
    if (flavor._count.forecastLines > 0) blocks.push('forecast lines');
    if (flavor._count.instances > 0) blocks.push('instances');

    if (blocks.length > 0) {
      return res.status(409).json({
        error: `Cannot delete flavor with existing ${blocks.join(', ')}. Please remove them first.`,
      });
    }

    await prisma.flavor.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as flavorRoutes };
