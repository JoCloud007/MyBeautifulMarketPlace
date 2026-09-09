import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';

const router = Router({ mergeParams: true });

const idParamSchema = z.string().uuid();

const createVersionSchema = z.object({
  version: z.string().min(1, 'Version is required'),
  releaseDate: z.string().datetime().or(z.date()).optional(),
  normalSupportEnd: z.string().datetime().or(z.date()).optional(),
  extendedSupportEnd: z.string().datetime().or(z.date()).optional(),
  eolDate: z.string().datetime().or(z.date()).optional(),
  phase: z.enum(['RELEASED', 'NORMAL_SUPPORT', 'EXTENDED_SUPPORT', 'NO_SUPPORT', 'EOL']).optional(),
  isActive: z.boolean().optional(),
  changelog: z.string().optional(),
  regionId: z.string().uuid().optional(),
  zoneIds: z.array(z.string().uuid()).optional(),
  availabilityZoneIds: z.array(z.string().uuid()).optional(),
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
        region: true,
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
// Geo associations: region, zones, availabilityZones
// Fixed: empty array guards and transaction wrapping
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

    const { regionId, zoneIds, availabilityZoneIds, ...versionData } = data;

    // Validate regionId if provided
    if (regionId) {
      const region = await prisma.region.findUnique({ where: { id: regionId } });
      if (!region) {
        return res.status(400).json({ error: 'Region not found' });
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
        region: regionId ? { connect: { id: regionId } } : undefined,
        zones: zoneIds?.length ? { create: zoneIds.map((zid: string) => ({ zone: { connect: { id: zid } } })) } : undefined,
        availabilityZones: availabilityZoneIds?.length ? { create: availabilityZoneIds.map((azId: string) => ({ availabilityZone: { connect: { id: azId } } })) } : undefined,
      },
      include: {
        region: true,
        zones: { include: { zone: true } },
        availabilityZones: { include: { availabilityZone: true } },
      },
    });

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

    const { regionId, zoneIds, availabilityZoneIds, ...versionData } = data;

    // Validate regionId if provided
    if (regionId) {
      const region = await prisma.region.findUnique({ where: { id: regionId } });
      if (!region) {
        return res.status(400).json({ error: 'Region not found' });
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

    // Handle zone links update in a transaction
    const ops: any[] = [];
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
        region: regionId !== undefined ? (regionId ? { connect: { id: regionId } } : { disconnect: true }) : undefined,
        zones: zoneIds?.length ? { create: zoneIds.map((zid: string) => ({ zone: { connect: { id: zid } } })) } : undefined,
        availabilityZones: availabilityZoneIds?.length ? { create: availabilityZoneIds.map((azId: string) => ({ availabilityZone: { connect: { id: azId } } })) } : undefined,
      },
      include: {
        region: true,
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
