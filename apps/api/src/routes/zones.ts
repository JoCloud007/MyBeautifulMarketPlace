import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';

const router = Router();

const createZoneSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z.string().min(1, 'Slug is required').max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  availabilityZoneIds: z.array(z.string().uuid()).max(50).optional(),
});

const updateZoneSchema = createZoneSchema.partial();

const idParamSchema = z.string().uuid();

// GET /api/zones
router.get('/', async (_req, res, next) => {
  try {
    const zones = await prisma.zone.findMany({
      orderBy: { name: 'asc' },
      include: {
        availabilityZones: { include: { availabilityZone: true } },
      },
    });
    res.json(zones);
  } catch (err) {
    next(err);
  }
});

// GET /api/zones/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const zone = await prisma.zone.findUnique({
      where: { id },
      include: {
        availabilityZones: { include: { availabilityZone: true } },
      },
    });

    if (!zone) {
      return res.status(404).json({ error: 'Zone not found' });
    }

    res.json(zone);
  } catch (err) {
    next(err);
  }
});

// POST /api/zones
router.post('/', async (req, res, next) => {
  try {
    const data = createZoneSchema.parse(req.body);

    const existingName = await prisma.zone.findUnique({ where: { name: data.name } });
    if (existingName) {
      return res.status(409).json({ error: 'A zone with this name already exists' });
    }

    const existingSlug = await prisma.zone.findUnique({ where: { slug: data.slug } });
    if (existingSlug) {
      return res.status(409).json({ error: 'A zone with this slug already exists' });
    }

    if (data.availabilityZoneIds && data.availabilityZoneIds.length > 0) {
      const uniqueAzIds = [...new Set(data.availabilityZoneIds)];
      if (uniqueAzIds.length !== data.availabilityZoneIds.length) {
        return res.status(400).json({ error: 'Duplicate availability zone IDs are not allowed' });
      }
      const azs = await prisma.availabilityZone.findMany({
        where: { id: { in: data.availabilityZoneIds } },
      });
      if (azs.length !== data.availabilityZoneIds.length) {
        return res.status(400).json({ error: 'One or more availability zones do not exist' });
      }
    }

    const zone = await prisma.zone.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        isActive: data.isActive,
        availabilityZones: data.availabilityZoneIds
          ? { create: data.availabilityZoneIds.map((azId) => ({ availabilityZoneId: azId })) }
          : undefined,
      },
      include: {
        availabilityZones: { include: { availabilityZone: true } },
      },
    });

    res.status(201).json(zone);
  } catch (err) {
    next(err);
  }
});

// PUT /api/zones/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const data = updateZoneSchema.parse(req.body);

    if (data.name) {
      const existing = await prisma.zone.findUnique({ where: { name: data.name } });
      if (existing && existing.id !== id) {
        return res.status(409).json({ error: 'A zone with this name already exists' });
      }
    }

    if (data.slug) {
      const existing = await prisma.zone.findUnique({ where: { slug: data.slug } });
      if (existing && existing.id !== id) {
        return res.status(409).json({ error: 'A zone with this slug already exists' });
      }
    }

    if (data.availabilityZoneIds) {
      if (data.availabilityZoneIds.length > 0) {
        const uniqueAzIds = [...new Set(data.availabilityZoneIds)];
        if (uniqueAzIds.length !== data.availabilityZoneIds.length) {
          return res.status(400).json({ error: 'Duplicate availability zone IDs are not allowed' });
        }
        const azs = await prisma.availabilityZone.findMany({
          where: { id: { in: data.availabilityZoneIds } },
        });
        if (azs.length !== data.availabilityZoneIds.length) {
          return res.status(400).json({ error: 'One or more availability zones do not exist' });
        }
      }
    }

    const zone = await prisma.$transaction(async (tx) => {
      if (data.availabilityZoneIds) {
        await tx.zoneAvailabilityZone.deleteMany({ where: { zoneId: id } });
      }
      return tx.zone.update({
        where: { id },
        data: {
          name: data.name,
          slug: data.slug,
          description: data.description,
          isActive: data.isActive,
          availabilityZones: data.availabilityZoneIds
            ? { create: data.availabilityZoneIds.map((azId) => ({ availabilityZoneId: azId })) }
            : undefined,
        },
        include: {
          availabilityZones: { include: { availabilityZone: true } },
        },
      });
    });

    res.json(zone);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/zones/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);

    const zone = await prisma.zone.findUnique({
      where: { id },
      include: { _count: { select: { variants: true, availabilityZones: true } } },
    });

    if (!zone) {
      return res.status(404).json({ error: 'Zone not found' });
    }

    const blocks: string[] = [];
    if (zone._count.variants > 0) blocks.push('linked variants');
    if (zone._count.availabilityZones > 0) blocks.push('linked availability zones');

    if (blocks.length > 0) {
      return res.status(409).json({
        error: `Cannot delete zone with ${blocks.join(', ')}. Please remove them first.`,
      });
    }

    await prisma.zone.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as zoneRoutes };
