import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';

const router = Router();

const idParamSchema = z.string().uuid();

const createOsSchema = z.object({
  family: z.string().min(1, 'Family is required'),
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  isActive: z.boolean().optional(),
  availabilityType: z.enum(['STANDARD', 'RECOMMENDED', 'RESTRICTED', 'ON_DEMAND']).optional(),
  zoneIds: z.array(z.string().uuid()).optional(),
});

const updateOsSchema = z.object({
  family: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  isActive: z.boolean().optional(),
  availabilityType: z.enum(['STANDARD', 'RECOMMENDED', 'RESTRICTED', 'ON_DEMAND']).optional(),
  zoneIds: z.array(z.string().uuid()).optional(),
});

const createVersionSchema = z.object({
  version: z.string().min(1, 'Version is required'),
  releaseDate: z.string().datetime(),
  normalSupportEnd: z.string().datetime(),
  extendedSupportEnd: z.string().datetime(),
  eolDate: z.string().datetime(),
  phase: z.enum(['RELEASED', 'NORMAL_SUPPORT', 'EXTENDED_SUPPORT', 'NO_SUPPORT', 'EOL']).optional(),
  isActive: z.boolean().optional(),
}).refine((data) => {
  const release = new Date(data.releaseDate).getTime();
  const normal = new Date(data.normalSupportEnd).getTime();
  const extended = new Date(data.extendedSupportEnd).getTime();
  const eol = new Date(data.eolDate).getTime();
  return release < normal && normal < extended && extended < eol;
}, {
  message: 'Dates must be in chronological order: releaseDate < normalSupportEnd < extendedSupportEnd < eolDate',
});

const updateVersionSchema = z.object({
  version: z.string().min(1).optional(),
  releaseDate: z.string().datetime().optional(),
  normalSupportEnd: z.string().datetime().optional(),
  extendedSupportEnd: z.string().datetime().optional(),
  eolDate: z.string().datetime().optional(),
  phase: z.enum(['RELEASED', 'NORMAL_SUPPORT', 'EXTENDED_SUPPORT', 'NO_SUPPORT', 'EOL']).optional(),
  isActive: z.boolean().optional(),
});

// GET /api/os
router.get('/', async (_req, res, next) => {
  try {
    const osList = await prisma.operatingSystem.findMany({
      include: {
        versions: { orderBy: { releaseDate: 'desc' } },
        zones: { include: { zone: true } },
        _count: { select: { variants: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(osList);
  } catch (err) {
    next(err);
  }
});

// POST /api/os
router.post('/', async (req, res, next) => {
  try {
    const data = createOsSchema.parse(req.body);

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

    const { zoneIds, ...osData } = data;

    try {
      const os = await prisma.operatingSystem.create({
        data: {
          ...osData,
          zones: zoneIds ? { create: zoneIds.map((zid) => ({ zoneId: zid })) } : undefined,
        },
        include: { versions: true, zones: { include: { zone: true } } },
      });
      res.status(201).json(os);
    } catch (err: any) {
      if (err.code === 'P2002') {
        return res.status(409).json({ error: 'An OS with this slug already exists' });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

// GET /api/os/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);

    const os = await prisma.operatingSystem.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { releaseDate: 'desc' } },
        zones: { include: { zone: true } },
        _count: { select: { variants: true } },
      },
    });

    if (!os) {
      return res.status(404).json({ error: 'OS not found' });
    }

    res.json(os);
  } catch (err) {
    next(err);
  }
});

// PUT /api/os/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const data = updateOsSchema.parse(req.body);

    const existing = await prisma.operatingSystem.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'OS not found' });
    }

    if (data.slug) {
      const dup = await prisma.operatingSystem.findUnique({ where: { slug: data.slug } });
      if (dup && dup.id !== id) {
        return res.status(409).json({ error: 'An OS with this slug already exists' });
      }
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

    const { zoneIds, ...osData } = data;

    // Handle zone links update
    if (zoneIds) {
      await prisma.operatingSystemZone.deleteMany({ where: { operatingSystemId: id } });
    }

    const os = await prisma.operatingSystem.update({
      where: { id },
      data: {
        ...osData,
        zones: zoneIds ? { create: zoneIds.map((zid) => ({ zoneId: zid })) } : undefined,
      },
      include: { versions: true, zones: { include: { zone: true } } },
    });
    res.json(os);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/os/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);

    const os = await prisma.operatingSystem.findUnique({
      where: { id },
      include: { _count: { select: { variants: true } } },
    });

    if (!os) {
      return res.status(404).json({ error: 'OS not found' });
    }

    if (os._count.variants > 0) {
      return res.status(409).json({ error: 'Cannot delete OS with existing variants' });
    }

    await prisma.operatingSystem.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ===== VERSIONS =====

// GET /api/os/:id/versions
router.get('/:id/versions', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);

    const versions = await prisma.osVersion.findMany({
      where: { osId: id },
      orderBy: { releaseDate: 'desc' },
    });

    res.json(versions);
  } catch (err) {
    next(err);
  }
});

// POST /api/os/:id/versions
router.post('/:id/versions', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const data = createVersionSchema.parse(req.body);

    const os = await prisma.operatingSystem.findUnique({ where: { id } });
    if (!os) {
      return res.status(404).json({ error: 'OS not found' });
    }

    const version = await prisma.osVersion.create({
      data: {
        osId: id,
        version: data.version,
        releaseDate: new Date(data.releaseDate),
        normalSupportEnd: new Date(data.normalSupportEnd),
        extendedSupportEnd: new Date(data.extendedSupportEnd),
        eolDate: new Date(data.eolDate),
        phase: data.phase,
        isActive: data.isActive,
      },
    });
    res.status(201).json(version);
  } catch (err) {
    next(err);
  }
});

// PUT /api/os/:id/versions/:versionId
router.put('/:id/versions/:versionId', async (req, res, next) => {
  try {
    const { id, versionId } = req.params;
    idParamSchema.parse(id);
    idParamSchema.parse(versionId);
    const data = updateVersionSchema.parse(req.body);

    const version = await prisma.osVersion.findFirst({
      where: { id: versionId, osId: id },
    });
    if (!version) {
      return res.status(404).json({ error: 'Version not found for this OS' });
    }

    // Merge with existing dates and validate chronological order
    const releaseDate = data.releaseDate ? new Date(data.releaseDate) : version.releaseDate;
    const normalSupportEnd = data.normalSupportEnd ? new Date(data.normalSupportEnd) : version.normalSupportEnd;
    const extendedSupportEnd = data.extendedSupportEnd ? new Date(data.extendedSupportEnd) : version.extendedSupportEnd;
    const eolDate = data.eolDate ? new Date(data.eolDate) : version.eolDate;

    if (releaseDate.getTime() >= normalSupportEnd.getTime() ||
        normalSupportEnd.getTime() >= extendedSupportEnd.getTime() ||
        extendedSupportEnd.getTime() >= eolDate.getTime()) {
      return res.status(400).json({
        error: 'Dates must be in chronological order: releaseDate < normalSupportEnd < extendedSupportEnd < eolDate',
      });
    }

    const updated = await prisma.osVersion.update({
      where: { id: versionId },
      data: {
        ...data,
        releaseDate: data.releaseDate ? new Date(data.releaseDate) : undefined,
        normalSupportEnd: data.normalSupportEnd ? new Date(data.normalSupportEnd) : undefined,
        extendedSupportEnd: data.extendedSupportEnd ? new Date(data.extendedSupportEnd) : undefined,
        eolDate: data.eolDate ? new Date(data.eolDate) : undefined,
      },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/os/:id/versions/:versionId
router.delete('/:id/versions/:versionId', async (req, res, next) => {
  try {
    const { id, versionId } = req.params;
    idParamSchema.parse(id);
    idParamSchema.parse(versionId);

    const version = await prisma.osVersion.findFirst({
      where: { id: versionId, osId: id },
      include: { _count: { select: { variants: true } } },
    });
    if (!version) {
      return res.status(404).json({ error: 'Version not found for this OS' });
    }

    if (version._count.variants > 0) {
      return res.status(409).json({ error: 'Cannot delete version with existing variants' });
    }

    await prisma.osVersion.delete({ where: { id: versionId } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as osRoutes };
