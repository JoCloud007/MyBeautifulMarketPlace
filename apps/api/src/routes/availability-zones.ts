import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { getCapitalCoordinates } from '../lib/countryCapitals';

const router = Router();

const createAZSchema = z.object({
  code: z.string().min(1).max(100).optional(),
  name: z.string().min(1, 'Name is required').max(100),
  city: z.string().min(1, 'City is required').max(100),
  country: z.string().min(1, 'Country is required').max(100),
  region: z.string().min(1, 'Region is required').max(100),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isActive: z.boolean().optional(),
  infraVersionIds: z.array(z.string().uuid()).max(100).optional(),
});

const updateAZSchema = createAZSchema.partial();

const idParamSchema = z.string().uuid();

function injectCapitalCoordinates(zone: { latitude: number | null; longitude: number | null; country: string; [key: string]: unknown }) {
  if (zone.latitude == null || zone.longitude == null) {
    const coords = getCapitalCoordinates(zone.country);
    if (coords) {
      return { ...zone, latitude: coords[0], longitude: coords[1] };
    }
  }
  return zone;
}

// GET /api/availability-zones
router.get('/', async (_req, res, next) => {
  try {
    const zones = await prisma.availabilityZone.findMany({
      orderBy: { region: 'asc' },
      include: { infraVersions: { include: { infraVersion: true } } },
    });
    res.json(zones.map(injectCapitalCoordinates));
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
      include: { infraVersions: { include: { infraVersion: true } } },
    });

    if (!zone) {
      return res.status(404).json({ error: 'Availability zone not found' });
    }

    res.json(injectCapitalCoordinates(zone));
  } catch (err) {
    next(err);
  }
});

// POST /api/availability-zones
router.post('/', async (req, res, next) => {
  try {
    const data = createAZSchema.parse(req.body);

    let code = data.code || data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!code) code = `az-${Date.now()}`;
    const existing = await prisma.availabilityZone.findUnique({ where: { code } });
    if (existing) {
      return res.status(409).json({ error: 'An availability zone with this code already exists' });
    }

    const { code: _code, infraVersionIds, ...rest } = data;
    const zone = await prisma.availabilityZone.create({
      data: {
        ...rest,
        code,
        infraVersions: infraVersionIds ? { create: infraVersionIds.map((infraVersionId) => ({ infraVersionId })) } : undefined,
      },
      include: { infraVersions: { include: { infraVersion: true } } },
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

    // Prevent updating code to preserve referential integrity with instances
    const { code: _code, infraVersionIds, ...safeData } = data;

    const zone = await prisma.$transaction(async (tx) => {
      if (infraVersionIds) {
        await tx.azInfraVersion.deleteMany({ where: { availabilityZoneId: id } });
        if (infraVersionIds.length > 0) {
          await tx.azInfraVersion.createMany({
            data: infraVersionIds.map((infraVersionId) => ({ availabilityZoneId: id, infraVersionId })),
          });
        }
      }
      return tx.availabilityZone.update({
        where: { id },
        data: safeData,
        include: { infraVersions: { include: { infraVersion: true } } },
      });
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

    // Check for linked variants, instances, and forecast lines
    const zone = await prisma.availabilityZone.findUnique({
      where: { id },
      include: { _count: { select: { variantZones: true, instances: true, forecastLines: true } } },
    });

    if (!zone) {
      return res.status(404).json({ error: 'Availability zone not found' });
    }

    const blocks: string[] = [];
    if (zone._count.variantZones > 0) blocks.push('linked variants');
    if (zone._count.instances > 0) blocks.push('instances');
    if (zone._count.forecastLines > 0) blocks.push('forecast lines');

    if (blocks.length > 0) {
      return res.status(409).json({
        error: `Cannot delete availability zone with ${blocks.join(', ')}. Please remove them first.`,
      });
    }

    await prisma.availabilityZone.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as availabilityZoneRoutes };
