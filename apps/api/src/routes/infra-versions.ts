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

const createInfraVersionSchema = z.object({
  code: z.string().min(1).max(20).regex(/^[A-Za-z0-9-]+$/, 'Code must be alphanumeric with dashes'),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  releaseDate: z.string().datetime().or(z.date()).optional().nullable(),
  normalSupportEnd: z.string().datetime().or(z.date()).optional().nullable(),
  extendedSupportEnd: z.string().datetime().or(z.date()).optional().nullable(),
  eolDate: z.string().datetime().or(z.date()).optional().nullable(),
  phase: z.enum(['RELEASED', 'NORMAL_SUPPORT', 'EXTENDED_SUPPORT', 'NO_SUPPORT', 'EOL']).optional(),
  isActive: z.boolean().optional(),
  changelog: z.string().optional(),
  availabilityZoneIds: z.array(z.string().uuid()).max(100).optional(),
  schedules: z.array(scheduleSchema).optional(),
});

const updateInfraVersionSchema = createInfraVersionSchema.partial();

// GET /api/infra-versions
router.get('/', async (_req, res, next) => {
  try {
    const infraVersions = await prisma.infraVersion.findMany({
      orderBy: { releaseDate: 'desc' },
      include: {
        availabilityZones: { include: { availabilityZone: true } },
        availabilitySchedules: {
          include: { region: true, az: true, zone: true },
        },
      },
    });
    res.json(infraVersions);
  } catch (err) {
    next(err);
  }
});

// GET /api/infra-versions/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const infraVersion = await prisma.infraVersion.findUnique({
      where: { id },
      include: {
        availabilityZones: { include: { availabilityZone: true } },
        availabilitySchedules: { include: { region: true, az: true, zone: true } },
      },
    });
    if (!infraVersion) {
      return res.status(404).json({ error: 'Infra version not found' });
    }
    res.json(infraVersion);
  } catch (err) {
    next(err);
  }
});

// POST /api/infra-versions
router.post('/', async (req, res, next) => {
  try {
    const data = createInfraVersionSchema.parse(req.body);

    const existing = await prisma.infraVersion.findUnique({ where: { code: data.code } });
    if (existing) {
      return res.status(409).json({ error: 'An infra version with this code already exists' });
    }

    if (data.availabilityZoneIds && data.availabilityZoneIds.length > 0) {
      const azs = await prisma.availabilityZone.findMany({ where: { id: { in: data.availabilityZoneIds } } });
      if (azs.length !== data.availabilityZoneIds.length) {
        return res.status(400).json({ error: 'One or more availability zones do not exist' });
      }
    }

    const { availabilityZoneIds, schedules, ...ivData } = data;

    const createdId = await prisma.$transaction(async (tx) => {
      const created = await tx.infraVersion.create({
        data: {
          ...ivData,
          availabilityZones: availabilityZoneIds
            ? { create: availabilityZoneIds.map((availabilityZoneId) => ({ availabilityZoneId })) }
            : undefined,
        },
      });

      const schedulePayload = (schedules ?? [])
        .filter((s) => !s.deleted)
        .map((s) => ({
          targetType: 'INFRA_VERSION' as const,
          targetId: created.id,
          // Keep the relation FK in sync so `include: { availabilitySchedules }` resolves
          infraVersionId: created.id,
          regionId: s.regionId || null,
          azId: s.azId || null,
          zoneId: s.zoneId || null,
          availableFrom: s.availableFrom ? new Date(s.availableFrom) : null,
          availableUntil: s.availableUntil ? new Date(s.availableUntil) : null,
          status: s.status || 'STANDARD',
        }));
      if (schedulePayload.length > 0) {
        await tx.availabilitySchedule.createMany({ data: schedulePayload });
      }

      return created.id;
    });

    // Fetch after commit so includes reflect the schedules just created
    const infraVersion = await prisma.infraVersion.findUnique({
      where: { id: createdId },
      include: {
        availabilityZones: { include: { availabilityZone: true } },
        availabilitySchedules: { include: { region: true, az: true, zone: true } },
      },
    });

    res.status(201).json(infraVersion);
  } catch (err: any) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'An infra version with this code already exists' });
    }
    next(err);
  }
});

// PATCH /api/infra-versions/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const data = updateInfraVersionSchema.parse(req.body);

    const existing = await prisma.infraVersion.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Infra version not found' });
    }

    // Prevent changing code (referential integrity)
    const { availabilityZoneIds, schedules, code: _code, ...ivData } = data;

    const infraVersion = await prisma.$transaction(async (tx) => {
      // Sync AZ links if provided
      if (availabilityZoneIds) {
        await tx.azInfraVersion.deleteMany({ where: { infraVersionId: id } });
        if (availabilityZoneIds.length > 0) {
          await tx.azInfraVersion.createMany({
            data: availabilityZoneIds.map((availabilityZoneId) => ({ infraVersionId: id, availabilityZoneId })),
          });
        }
      }

      // Sync schedules if provided
      if (schedules) {
        const keepIds = schedules.filter((s) => s.id && !s.deleted).map((s) => s.id!);
        await tx.availabilitySchedule.deleteMany({
          where: { targetType: 'INFRA_VERSION', targetId: id, ...(keepIds.length > 0 ? { id: { notIn: keepIds } } : {}) },
        });
        for (const s of schedules) {
          if (s.deleted) continue;
          const payload = {
            targetType: 'INFRA_VERSION' as const,
            targetId: id,
            // Keep the relation FK in sync so `include: { availabilitySchedules }` resolves
            infraVersionId: id,
            regionId: s.regionId || null,
            azId: s.azId || null,
            zoneId: s.zoneId || null,
            availableFrom: s.availableFrom ? new Date(s.availableFrom) : null,
            availableUntil: s.availableUntil ? new Date(s.availableUntil) : null,
            status: s.status || 'STANDARD',
          };
          if (s.id) {
            // Scoped update: only touch rows that belong to THIS infra version —
            // prevents retargeting a foreign owner's schedule (e.g. a FLAVOR's).
            const updated = await tx.availabilitySchedule.updateMany({
              where: { id: s.id, targetType: 'INFRA_VERSION', targetId: id },
              data: payload,
            });
            if (updated.count === 0) {
              // No matching row owned by this infra version — create a new one instead
              await tx.availabilitySchedule.create({ data: payload });
            }
          } else {
            await tx.availabilitySchedule.create({ data: payload });
          }
        }
      }

      return tx.infraVersion.update({
        where: { id },
        data: ivData,
        include: {
          availabilityZones: { include: { availabilityZone: true } },
          availabilitySchedules: { include: { region: true, az: true, zone: true } },
        },
      });
    });

    res.json(infraVersion);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/infra-versions/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);

    const infraVersion = await prisma.infraVersion.findUnique({
      where: { id },
      include: { _count: { select: { availabilityZones: true, availabilitySchedules: true } } },
    });
    if (!infraVersion) {
      return res.status(404).json({ error: 'Infra version not found' });
    }

    const blocks: string[] = [];
    if (infraVersion._count.availabilityZones > 0) blocks.push('linked availability zones');
    if (infraVersion._count.availabilitySchedules > 0) blocks.push('availability schedules');
    if (blocks.length > 0) {
      return res.status(409).json({
        error: `Cannot delete infra version with ${blocks.join(', ')}. Please remove them first.`,
      });
    }

    await prisma.infraVersion.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as infraVersionRoutes };
