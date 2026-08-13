import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';

const router = Router();

const createAZSchema = z.object({
  code: z.string().min(1, 'Code is required').max(100),
  name: z.string().min(1, 'Name is required').max(100),
  city: z.string().min(1, 'City is required').max(100),
  country: z.string().min(1, 'Country is required').max(100),
  region: z.string().min(1, 'Region is required').max(100),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  isActive: z.boolean().optional(),
});

const updateAZSchema = createAZSchema.partial();

const idParamSchema = z.string().uuid();

// GET /api/availability-zones
router.get('/', async (_req, res, next) => {
  try {
    const zones = await prisma.availabilityZone.findMany({
      include: {
        productAvailabilities: {
          include: { product: { select: { id: true, name: true, slug: true } } },
        },
      },
      orderBy: { region: 'asc' },
    });
    res.json(zones);
  } catch (err) {
    next(err);
  }
});

// GET /api/availability-zones/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const zone = await prisma.availabilityZone.findUnique({
      where: { id },
      include: {
        productAvailabilities: {
          include: { product: { select: { id: true, name: true, slug: true } } },
        },
      },
    });

    if (!zone) {
      return res.status(404).json({ error: 'Availability zone not found' });
    }

    res.json(zone);
  } catch (err) {
    next(err);
  }
});

// POST /api/availability-zones
router.post('/', async (req, res, next) => {
  try {
    const data = createAZSchema.parse(req.body);

    const existing = await prisma.availabilityZone.findUnique({ where: { code: data.code } });
    if (existing) {
      return res.status(409).json({ error: 'An availability zone with this code already exists' });
    }

    const zone = await prisma.availabilityZone.create({
      data,
      include: {
        productAvailabilities: {
          include: { product: { select: { id: true, name: true, slug: true } } },
        },
      },
    });

    res.status(201).json(zone);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/availability-zones/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const data = updateAZSchema.parse(req.body);

    if (data.code) {
      const existing = await prisma.availabilityZone.findUnique({ where: { code: data.code } });
      if (existing && existing.id !== id) {
        return res.status(409).json({ error: 'An availability zone with this code already exists' });
      }
    }

    const zone = await prisma.availabilityZone.update({
      where: { id },
      data,
      include: {
        productAvailabilities: {
          include: { product: { select: { id: true, name: true, slug: true } } },
        },
      },
    });

    res.json(zone);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/availability-zones/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);

    // Check for linked products
    const zone = await prisma.availabilityZone.findUnique({
      where: { id },
      include: { _count: { select: { productAvailabilities: true } } },
    });

    if (!zone) {
      return res.status(404).json({ error: 'Availability zone not found' });
    }

    if (zone._count.productAvailabilities > 0) {
      return res.status(409).json({
        error: 'Cannot delete availability zone with linked products. Please remove product associations first.',
      });
    }

    await prisma.availabilityZone.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as availabilityZoneRoutes };
