import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';

const router = Router();

const idParamSchema = z.string().uuid();

const updateVariantSchema = z.object({
  name: z.string().min(1).optional(),
  osId: z.string().uuid().optional(),
  osVersionId: z.string().uuid().optional(),
  flavorId: z.string().uuid().optional(),
  availabilityZoneIds: z.array(z.string().uuid()).max(50).optional(),
  continuityLevelId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
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
    const { availabilityZoneIds, ...variantData } = data;

    const existing = await prisma.productVariant.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Variant not found' });
    }

    // Verify OS exists if updating
    if (data.osId) {
      const os = await prisma.operatingSystem.findUnique({ where: { id: data.osId } });
      if (!os) {
        return res.status(404).json({ error: 'Operating system not found' });
      }
    }

    // Verify OS version exists and belongs to the OS if updating
    if (data.osVersionId || data.osId) {
      const osVersionId = data.osVersionId || existing.osVersionId;
      const osId = data.osId || existing.osId;
      const osVersion = await prisma.osVersion.findFirst({
        where: { id: osVersionId, osId },
      });
      if (!osVersion) {
        return res.status(404).json({ error: 'OS version not found or does not belong to the selected OS' });
      }
    }

    // Verify flavor exists if updating
    if (data.flavorId) {
      const flavor = await prisma.flavor.findUnique({ where: { id: data.flavorId } });
      if (!flavor) {
        return res.status(404).json({ error: 'Flavor not found' });
      }
    }

    // Verify availability zones exist
    const uniqueAzIds = availabilityZoneIds ? [...new Set(availabilityZoneIds)] : [];
    if (uniqueAzIds.length > 0) {
      const zones = await prisma.availabilityZone.findMany({
        where: { id: { in: uniqueAzIds } },
      });
      if (zones.length !== uniqueAzIds.length) {
        return res.status(400).json({ error: 'One or more availability zones do not exist' });
      }
    }

    const variant = await prisma.$transaction(async (tx) => {
      if (availabilityZoneIds) {
        await tx.productVariantAvailabilityZone.deleteMany({ where: { variantId: id } });
      }
      return tx.productVariant.update({
        where: { id },
        data: {
          ...variantData,
          availabilityZones: uniqueAzIds.length > 0
            ? { create: uniqueAzIds.map((azId) => ({ availabilityZoneId: azId })) }
            : undefined,
        },
        include: {
          os: true,
          osVersion: true,
          flavor: true,
          availabilityZones: { include: { availabilityZone: true } },
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
      return res.status(409).json({
        error: `Cannot delete variant with existing ${blocks.join(', ')}. Please remove them first.`,
      });
    }

    await prisma.productVariant.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as variantRoutes };
