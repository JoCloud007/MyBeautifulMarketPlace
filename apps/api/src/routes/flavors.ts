import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';

const router = Router();

const idParamSchema = z.string().uuid();

const scheduleSchema = z.object({
  id: z.string().uuid().optional(),
  regionId: z.string().uuid().optional().nullable(),
  azId: z.string().uuid().optional().nullable(),
  zoneId: z.string().uuid().optional().nullable(),
  availableFrom: z.string().datetime().or(z.date()).optional().nullable(),
  availableUntil: z.string().datetime().or(z.date()).optional().nullable(),
  status: z.enum(['STANDARD', 'RECOMMENDED', 'RESTRICTED', 'ON_DEMAND']).optional(),
  deleted: z.boolean().optional(),
});

async function validateScheduleRefs(schedules: any[]) {
  const regionIds = [...new Set(schedules.map((s) => s.regionId).filter(Boolean))];
  const azIds = [...new Set(schedules.map((s) => s.azId).filter(Boolean))];
  const zoneIds = [...new Set(schedules.map((s) => s.zoneId).filter(Boolean))];

  if (regionIds.length > 0) {
    const found = await prisma.region.findMany({ where: { id: { in: regionIds } }, select: { id: true } });
    if (found.length !== regionIds.length) {
      throw new Error('One or more schedule region IDs do not exist');
    }
  }
  if (azIds.length > 0) {
    const found = await prisma.availabilityZone.findMany({ where: { id: { in: azIds } }, select: { id: true } });
    if (found.length !== azIds.length) {
      throw new Error('One or more schedule availability zone IDs do not exist');
    }
  }
  if (zoneIds.length > 0) {
    const found = await prisma.zone.findMany({ where: { id: { in: zoneIds } }, select: { id: true } });
    if (found.length !== zoneIds.length) {
      throw new Error('One or more schedule zone IDs do not exist');
    }
  }
}

const createFlavorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  vcpu: z.number().int().min(0, 'vCPU must be a non-negative integer'),
  ramGb: z.number().int().min(0, 'RAM must be a non-negative integer'),
  description: z.string().optional(),
  zoneIds: z.array(z.string().uuid()).optional(),
  regionIds: z.array(z.string().uuid()).optional(),
  availabilityZoneIds: z.array(z.string().uuid()).max(50).optional(),
  releaseDate: z.string().datetime().or(z.date()).optional(),
  deprecationDate: z.string().datetime().or(z.date()).optional(),
  eolDate: z.string().datetime().or(z.date()).optional(),
  schedules: z.array(scheduleSchema).optional(),
});

const updateFlavorSchema = z.object({
  name: z.string().min(1).optional(),
  vcpu: z.number().int().min(0).optional(),
  ramGb: z.number().int().min(0).optional(),
  description: z.string().optional(),
  zoneIds: z.array(z.string().uuid()).optional(),
  regionIds: z.array(z.string().uuid()).optional(),
  availabilityZoneIds: z.array(z.string().uuid()).max(50).optional(),
  releaseDate: z.string().datetime().or(z.date()).optional(),
  deprecationDate: z.string().datetime().or(z.date()).optional(),
  eolDate: z.string().datetime().or(z.date()).optional(),
  schedules: z.array(scheduleSchema).optional(),
});

// GET /api/flavors
router.get('/', async (_req, res, next) => {
  try {
    const flavors = await prisma.flavor.findMany({
      include: {
        zones: { include: { zone: true } },
        regions: { include: { region: true } },
        availabilityZones: { include: { availabilityZone: true } },
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

    // Validate zoneIds if provided
    if (data.zoneIds && data.zoneIds.length > 0) {
      const uniqueZoneIds = [...new Set(data.zoneIds)];
      if (uniqueZoneIds.length !== data.zoneIds.length) {
        return res.status(400).json({ error: 'Duplicate zone IDs are not allowed' });
      }
      const zones = await prisma.zone.findMany({
        where: { id: { in: data.zoneIds } },
      });
      if (zones.length !== data.zoneIds.length) {
        return res.status(400).json({ error: 'One or more zones do not exist' });
      }
    }

    // Validate regionIds if provided
    if (data.regionIds && data.regionIds.length > 0) {
      const uniqueRegionIds = [...new Set(data.regionIds)];
      if (uniqueRegionIds.length !== data.regionIds.length) {
        return res.status(400).json({ error: 'Duplicate region IDs are not allowed' });
      }
      const regions = await prisma.region.findMany({ where: { id: { in: data.regionIds } } });
      if (regions.length !== data.regionIds.length) {
        return res.status(400).json({ error: 'One or more regions do not exist' });
      }
    }

    // Validate availabilityZoneIds if provided
    if (data.availabilityZoneIds && data.availabilityZoneIds.length > 0) {
      const uniqueAzIds = [...new Set(data.availabilityZoneIds)];
      if (uniqueAzIds.length !== data.availabilityZoneIds.length) {
        return res.status(400).json({ error: 'Duplicate availability zone IDs are not allowed' });
      }
      const azs = await prisma.availabilityZone.findMany({ where: { id: { in: data.availabilityZoneIds } } });
      if (azs.length !== data.availabilityZoneIds.length) {
        return res.status(400).json({ error: 'One or more availability zones do not exist' });
      }
    }

    const { zoneIds, regionIds, availabilityZoneIds, schedules, ...flavorData } = data;

    const flavor = await prisma.flavor.create({
      data: {
        ...flavorData,
        zones: zoneIds ? { create: zoneIds.map((zid) => ({ zoneId: zid })) } : undefined,
        regions: regionIds ? { create: regionIds.map((rid) => ({ regionId: rid })) } : undefined,
        availabilityZones: availabilityZoneIds ? { create: availabilityZoneIds.map((azId) => ({ availabilityZoneId: azId })) } : undefined,
      },
      include: {
        zones: { include: { zone: true } },
        regions: { include: { region: true } },
        availabilityZones: { include: { availabilityZone: true } },
        _count: { select: { variants: true } },
      },
    });

    // Create schedules if provided
    if (schedules && schedules.length > 0) {
      const toCreate = schedules.filter((s: any) => !s.deleted);
      if (toCreate.length > 0) {
        await validateScheduleRefs(toCreate);
        await prisma.availabilitySchedule.createMany({
          data: toCreate.map((s: any) => ({
            targetType: 'FLAVOR' as const,
            targetId: flavor.id,
            regionId: s.regionId,
            azId: s.azId,
            zoneId: s.zoneId,
            availableFrom: s.availableFrom ? new Date(s.availableFrom) : null,
            availableUntil: s.availableUntil ? new Date(s.availableUntil) : null,
            status: s.status || 'STANDARD',
          })),
        });
      }
    }

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
        zones: { include: { zone: true } },
        regions: { include: { region: true } },
        availabilityZones: { include: { availabilityZone: true } },
        performanceProfiles: { include: { metrics: true } },
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

    // Validate zoneIds if provided
    if (data.zoneIds && data.zoneIds.length > 0) {
      const uniqueZoneIds = [...new Set(data.zoneIds)];
      if (uniqueZoneIds.length !== data.zoneIds.length) {
        return res.status(400).json({ error: 'Duplicate zone IDs are not allowed' });
      }
      const zones = await prisma.zone.findMany({
        where: { id: { in: data.zoneIds } },
      });
      if (zones.length !== data.zoneIds.length) {
        return res.status(400).json({ error: 'One or more zones do not exist' });
      }
    }

    // Validate regionIds if provided
    if (data.regionIds && data.regionIds.length > 0) {
      const uniqueRegionIds = [...new Set(data.regionIds)];
      if (uniqueRegionIds.length !== data.regionIds.length) {
        return res.status(400).json({ error: 'Duplicate region IDs are not allowed' });
      }
      const regions = await prisma.region.findMany({ where: { id: { in: data.regionIds } } });
      if (regions.length !== data.regionIds.length) {
        return res.status(400).json({ error: 'One or more regions do not exist' });
      }
    }

    // Validate availabilityZoneIds if provided
    if (data.availabilityZoneIds && data.availabilityZoneIds.length > 0) {
      const uniqueAzIds = [...new Set(data.availabilityZoneIds)];
      if (uniqueAzIds.length !== data.availabilityZoneIds.length) {
        return res.status(400).json({ error: 'Duplicate availability zone IDs are not allowed' });
      }
      const azs = await prisma.availabilityZone.findMany({ where: { id: { in: data.availabilityZoneIds } } });
      if (azs.length !== data.availabilityZoneIds.length) {
        return res.status(400).json({ error: 'One or more availability zones do not exist' });
      }
    }

    const { zoneIds, regionIds, availabilityZoneIds, schedules, ...flavorData } = data;

    // Handle zone links update
    if (zoneIds) {
      await prisma.flavorZone.deleteMany({ where: { flavorId: id } });
    }
    if (regionIds) {
      await prisma.flavorRegion.deleteMany({ where: { flavorId: id } });
    }
    if (availabilityZoneIds) {
      await prisma.flavorAvailabilityZone.deleteMany({ where: { flavorId: id } });
    }

    // Handle schedules update
    if (schedules) {
      const toDelete = schedules.filter((s: any) => s.deleted && s.id).map((s: any) => s.id);
      const toUpdate = schedules.filter((s: any) => s.id && !s.deleted);
      const toCreate = schedules.filter((s: any) => !s.id && !s.deleted);
      if (toDelete.length > 0) {
        await prisma.availabilitySchedule.deleteMany({ where: { id: { in: toDelete }, targetType: 'FLAVOR', targetId: id } });
      }
      for (const s of toUpdate) {
        await prisma.availabilitySchedule.update({
          where: { id: s.id },
          data: {
            regionId: s.regionId,
            azId: s.azId,
            zoneId: s.zoneId,
            availableFrom: s.availableFrom ? new Date(s.availableFrom) : null,
            availableUntil: s.availableUntil ? new Date(s.availableUntil) : null,
            status: s.status || 'STANDARD',
          },
        });
      }
      if (toCreate.length > 0) {
        await validateScheduleRefs(toCreate);
        await prisma.availabilitySchedule.createMany({
          data: toCreate.map((s: any) => ({
            targetType: 'FLAVOR' as const,
            targetId: id,
            regionId: s.regionId,
            azId: s.azId,
            zoneId: s.zoneId,
            availableFrom: s.availableFrom ? new Date(s.availableFrom) : null,
            availableUntil: s.availableUntil ? new Date(s.availableUntil) : null,
            status: s.status || 'STANDARD',
          })),
        });
      }
    }

    const flavor = await prisma.flavor.update({
      where: { id },
      data: {
        ...flavorData,
        zones: zoneIds ? { create: zoneIds.map((zid) => ({ zoneId: zid })) } : undefined,
        regions: regionIds ? { create: regionIds.map((rid) => ({ regionId: rid })) } : undefined,
        availabilityZones: availabilityZoneIds ? { create: availabilityZoneIds.map((azId) => ({ availabilityZoneId: azId })) } : undefined,
      },
      include: {
        zones: { include: { zone: true } },
        regions: { include: { region: true } },
        availabilityZones: { include: { availabilityZone: true } },
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
