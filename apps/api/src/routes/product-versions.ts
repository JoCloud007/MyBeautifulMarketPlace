import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';

const router = Router({ mergeParams: true });

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

const createVersionSchema = z.object({
  version: z.string().min(1, 'Version is required'),
  releaseDate: z.string().datetime().or(z.date()).optional(),
  normalSupportEnd: z.string().datetime().or(z.date()).optional(),
  extendedSupportEnd: z.string().datetime().or(z.date()).optional(),
  eolDate: z.string().datetime().or(z.date()).optional(),
  phase: z.enum(['RELEASED', 'NORMAL_SUPPORT', 'EXTENDED_SUPPORT', 'NO_SUPPORT', 'EOL']).optional(),
  isActive: z.boolean().optional(),
  changelog: z.string().optional(),
  regionIds: z.array(z.string().uuid()).optional(),
  zoneIds: z.array(z.string().uuid()).optional(),
  availabilityZoneIds: z.array(z.string().uuid()).max(50).optional(),
  schedules: z.array(scheduleSchema).optional(),
});

const updateVersionSchema = createVersionSchema.partial();

// GET /api/products/:productId/versions
router.get('/', async (req, res, next) => {
  try {
    const productId = (req.params as any).productId as string;
    if (!productId) {
      return res.status(404).json({ error: 'Not Found' });
    }
    idParamSchema.parse(productId);

    const versions = await prisma.productVersion.findMany({
      where: { productId },
      orderBy: { releaseDate: 'desc' },
      include: {
        regions: { include: { region: true } },
        zones: { include: { zone: true } },
        availabilityZones: { include: { availabilityZone: true } },
      },
    });

    res.json(versions);
  } catch (err) {
    next(err);
  }
});

// POST /api/products/:productId/versions
router.post('/', async (req, res, next) => {
  try {
    const productId = (req.params as any).productId as string;
    if (!productId) {
      return res.status(404).json({ error: 'Not Found' });
    }
    idParamSchema.parse(productId);
    const data = createVersionSchema.parse(req.body);

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const { regionIds, zoneIds, availabilityZoneIds, schedules, ...versionData } = data;

    // Validate regionIds if provided
    if (regionIds && regionIds.length > 0) {
      const uniqueRegionIds = [...new Set(regionIds)];
      if (uniqueRegionIds.length !== regionIds.length) {
        return res.status(400).json({ error: 'Duplicate region IDs are not allowed' });
      }
      const regions = await prisma.region.findMany({ where: { id: { in: regionIds } } });
      if (regions.length !== regionIds.length) {
        return res.status(400).json({ error: 'One or more regions do not exist' });
      }
    }

    // Validate zoneIds if provided
    if (zoneIds && zoneIds.length > 0) {
      const uniqueZoneIds = [...new Set(zoneIds)];
      if (uniqueZoneIds.length !== zoneIds.length) {
        return res.status(400).json({ error: 'Duplicate zone IDs are not allowed' });
      }
      const zones = await prisma.zone.findMany({
        where: { id: { in: zoneIds } },
      });
      if (zones.length !== zoneIds.length) {
        return res.status(400).json({ error: 'One or more zones do not exist' });
      }
    }

    // Validate availabilityZoneIds if provided
    if (availabilityZoneIds && availabilityZoneIds.length > 0) {
      const uniqueAzIds = [...new Set(availabilityZoneIds)];
      if (uniqueAzIds.length !== availabilityZoneIds.length) {
        return res.status(400).json({ error: 'Duplicate availability zone IDs are not allowed' });
      }
      const azs = await prisma.availabilityZone.findMany({
        where: { id: { in: availabilityZoneIds } },
      });
      if (azs.length !== availabilityZoneIds.length) {
        return res.status(400).json({ error: 'One or more availability zones do not exist' });
      }
    }

    const version = await prisma.productVersion.create({
      data: {
        ...versionData,
        product: { connect: { id: productId } },
        regions: regionIds?.length ? { create: regionIds.map((rid: string) => ({ region: { connect: { id: rid } } })) } : undefined,
        zones: zoneIds?.length ? { create: zoneIds.map((zid: string) => ({ zone: { connect: { id: zid } } })) } : undefined,
        availabilityZones: availabilityZoneIds?.length ? { create: availabilityZoneIds.map((azId: string) => ({ availabilityZone: { connect: { id: azId } } })) } : undefined,
      },
      include: {
        regions: { include: { region: true } },
        zones: { include: { zone: true } },
        availabilityZones: { include: { availabilityZone: true } },
      },
    });

    // Create schedules if provided
    if (schedules && schedules.length > 0) {
      const toCreate = schedules.filter((s: any) => !s.deleted);
      if (toCreate.length > 0) {
        await validateScheduleRefs(toCreate);
        await prisma.availabilitySchedule.createMany({
          data: toCreate.map((s: any) => ({
            targetType: 'PRODUCT_VERSION' as const,
            targetId: version.id,
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

    res.status(201).json(version);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/product-versions/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const productId = (req.params as any).productId as string | undefined;
    idParamSchema.parse(id);
    const data = updateVersionSchema.parse(req.body);

    // Verify ownership when accessed via nested route
    if (productId) {
      const existing = await prisma.productVersion.findUnique({ where: { id } });
      if (!existing || existing.productId !== productId) {
        return res.status(404).json({ error: 'Version not found for this product' });
      }
    }

    const { regionIds, zoneIds, availabilityZoneIds, schedules, ...versionData } = data;

    // Validate regionIds if provided
    if (regionIds && regionIds.length > 0) {
      const uniqueRegionIds = [...new Set(regionIds)];
      if (uniqueRegionIds.length !== regionIds.length) {
        return res.status(400).json({ error: 'Duplicate region IDs are not allowed' });
      }
      const regions = await prisma.region.findMany({ where: { id: { in: regionIds } } });
      if (regions.length !== regionIds.length) {
        return res.status(400).json({ error: 'One or more regions do not exist' });
      }
    }

    // Validate zoneIds if provided
    if (zoneIds && zoneIds.length > 0) {
      const uniqueZoneIds = [...new Set(zoneIds)];
      if (uniqueZoneIds.length !== zoneIds.length) {
        return res.status(400).json({ error: 'Duplicate zone IDs are not allowed' });
      }
      const zones = await prisma.zone.findMany({
        where: { id: { in: zoneIds } },
      });
      if (zones.length !== zoneIds.length) {
        return res.status(400).json({ error: 'One or more zones do not exist' });
      }
    }

    // Validate availabilityZoneIds if provided
    if (availabilityZoneIds && availabilityZoneIds.length > 0) {
      const uniqueAzIds = [...new Set(availabilityZoneIds)];
      if (uniqueAzIds.length !== availabilityZoneIds.length) {
        return res.status(400).json({ error: 'Duplicate availability zone IDs are not allowed' });
      }
      const azs = await prisma.availabilityZone.findMany({
        where: { id: { in: availabilityZoneIds } },
      });
      if (azs.length !== availabilityZoneIds.length) {
        return res.status(400).json({ error: 'One or more availability zones do not exist' });
      }
    }

    // Handle schedules update
    if (schedules) {
      const toDelete = schedules.filter((s: any) => s.deleted && s.id).map((s: any) => s.id);
      const toUpdate = schedules.filter((s: any) => s.id && !s.deleted);
      const toCreate = schedules.filter((s: any) => !s.id && !s.deleted);
      if (toDelete.length > 0) {
        await prisma.availabilitySchedule.deleteMany({ where: { id: { in: toDelete }, targetType: 'PRODUCT_VERSION', targetId: id } });
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
            targetType: 'PRODUCT_VERSION' as const,
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

    // Handle zone links update in a transaction
    const ops: any[] = [];
    if (regionIds !== undefined) {
      ops.push(prisma.productVersionRegion.deleteMany({ where: { productVersionId: id } }));
    }
    if (zoneIds !== undefined) {
      ops.push(prisma.productVersionZone.deleteMany({ where: { productVersionId: id } }));
    }
    if (availabilityZoneIds !== undefined) {
      ops.push(prisma.productVersionAvailabilityZone.deleteMany({ where: { productVersionId: id } }));
    }
    ops.push(prisma.productVersion.update({
      where: { id },
      data: {
        ...versionData,
        regions: regionIds?.length ? { create: regionIds.map((rid: string) => ({ region: { connect: { id: rid } } })) } : undefined,
        zones: zoneIds?.length ? { create: zoneIds.map((zid: string) => ({ zone: { connect: { id: zid } } })) } : undefined,
        availabilityZones: availabilityZoneIds?.length ? { create: availabilityZoneIds.map((azId: string) => ({ availabilityZone: { connect: { id: azId } } })) } : undefined,
      },
      include: {
        regions: { include: { region: true } },
        zones: { include: { zone: true } },
        availabilityZones: { include: { availabilityZone: true } },
      },
    }));

    const result = await prisma.$transaction(ops);
    const version = result[result.length - 1];

    res.json(version);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/product-versions/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const productId = (req.params as any).productId as string | undefined;
    idParamSchema.parse(id);

    const version = await prisma.productVersion.findUnique({
      where: { id },
      include: { _count: { select: { variants: true } } },
    });

    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    // Verify ownership when accessed via nested route
    if (productId && version.productId !== productId) {
      return res.status(404).json({ error: 'Version not found for this product' });
    }

    if (version._count.variants > 0) {
      return res.status(409).json({ error: 'Cannot delete version with linked variants' });
    }

    await prisma.productVersion.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as productVersionRoutes };
