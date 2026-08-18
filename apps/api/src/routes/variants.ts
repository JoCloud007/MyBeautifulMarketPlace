import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import type { Prisma } from '@prisma/client';

const router = Router();

const idParamSchema = z.string().uuid();

const createVariantSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  osId: z.string().uuid('Invalid OS ID'),
  osVersionId: z.string().uuid('Invalid OS version ID'),
  flavorId: z.string().uuid('Invalid flavor ID'),
  availabilityZoneIds: z.array(z.string().uuid()).max(50).optional(),
  continuityLevelId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
  availabilityType: z.enum(['STANDARD', 'RECOMMENDED', 'RESTRICTED', 'ON_DEMAND']).optional(),
});

const updateVariantSchema = z.object({
  name: z.string().min(1).optional(),
  osId: z.string().uuid().optional(),
  osVersionId: z.string().uuid().optional(),
  flavorId: z.string().uuid().optional(),
  availabilityZoneIds: z.array(z.string().uuid()).max(50).optional(),
  zoneIds: z.array(z.string().uuid()).max(50).optional(),
  continuityLevelId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
  availabilityType: z.enum(['STANDARD', 'RECOMMENDED', 'RESTRICTED', 'ON_DEMAND']).optional(),
});

// GET /api/variants/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);

    const variant = await prisma.productVariant.findUnique({
      where: { id },
      include: {
        product: { include: { category: true } },
        os: true,
        osVersion: true,
        flavor: true,
        availabilityZones: { include: { availabilityZone: true } },
        zones: { include: { zone: true } },
        continuityLevel: true,
        _count: { select: { instances: true } },
      },
    });

    if (!variant) {
      return res.status(404).json({ error: 'Variant not found' });
    }

    res.json(variant);
  } catch (err) {
    next(err);
  }
});

// PUT /api/variants/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const data = updateVariantSchema.parse(req.body);

    const existing = await prisma.productVariant.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Variant not found' });
    }

    // Verify OS if changing
    if (data.osId) {
      const os = await prisma.operatingSystem.findUnique({ where: { id: data.osId } });
      if (!os) {
        return res.status(404).json({ error: 'OS not found' });
      }
    }

    // Verify OS version belongs to the target OS
    const finalOsId = data.osId || existing.osId;
    const finalOsVersionId = data.osVersionId || existing.osVersionId;
    const osVersion = await prisma.osVersion.findFirst({
      where: { id: finalOsVersionId, osId: finalOsId },
    });
    if (!osVersion) {
      return res.status(404).json({ error: 'OS version not found or does not belong to the specified OS' });
    }

    // Verify flavor if changing
    if (data.flavorId) {
      const flavor = await prisma.flavor.findUnique({ where: { id: data.flavorId } });
      if (!flavor) {
        return res.status(404).json({ error: 'Flavor not found' });
      }
    }

    // Verify continuity level if changing
    if (data.continuityLevelId) {
      const cl = await prisma.continuityLevel.findUnique({ where: { id: data.continuityLevelId } });
      if (!cl) {
        return res.status(404).json({ error: 'Continuity level not found' });
      }
    }

    // Verify AZs if changing
    if (data.availabilityZoneIds) {
      if (data.availabilityZoneIds.length > 0) {
        const uniqueAzIds = [...new Set(data.availabilityZoneIds)];
        if (uniqueAzIds.length !== data.availabilityZoneIds.length) {
          return res.status(400).json({ error: 'Duplicate availability zone IDs are not allowed' });
        }
        const zones = await prisma.availabilityZone.findMany({
          where: { id: { in: data.availabilityZoneIds } },
        });
        if (zones.length !== data.availabilityZoneIds.length) {
          return res.status(400).json({ error: 'One or more availability zones do not exist' });
        }
      }
    }

    // Verify zones if changing
    if (data.zoneIds) {
      if (data.zoneIds.length > 0) {
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
    }

    const variant = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (data.availabilityZoneIds) {
        await tx.productVariantAvailabilityZone.deleteMany({ where: { variantId: id } });
      }
      if (data.zoneIds) {
        await tx.productVariantZone.deleteMany({ where: { variantId: id } });
      }
      return tx.productVariant.update({
        where: { id },
        data: {
          name: data.name,
          osId: data.osId,
          osVersionId: data.osVersionId,
          flavorId: data.flavorId,
          continuityLevelId: data.continuityLevelId,
          isActive: data.isActive,
          availabilityType: data.availabilityType,
          availabilityZones: data.availabilityZoneIds
            ? { create: data.availabilityZoneIds.map((azId) => ({ availabilityZoneId: azId })) }
            : undefined,
          zones: data.zoneIds
            ? { create: data.zoneIds.map((zid) => ({ zoneId: zid })) }
            : undefined,
        },
        include: {
          os: true,
          osVersion: true,
          flavor: true,
          availabilityZones: { include: { availabilityZone: true } },
          zones: { include: { zone: true } },
          continuityLevel: true,
        },
      });
    });

    res.json(variant);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/variants/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);

    const variant = await prisma.productVariant.findUnique({
      where: { id },
      include: { _count: { select: { instances: true, forecastLines: true } } },
    });

    if (!variant) {
      return res.status(404).json({ error: 'Variant not found' });
    }

    const blocks: string[] = [];
    if (variant._count.instances > 0) blocks.push('instances');
    if (variant._count.forecastLines > 0) blocks.push('forecast lines');

    if (blocks.length > 0) {
      return res.status(409).json({ error: `Cannot delete variant with existing ${blocks.join(', ')}` });
    }

    await prisma.productVariant.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as variantRoutes };
