import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';

const router = Router();

const idParamSchema = z.string().uuid();

const createOsSchema = z.object({
  family: z.string().min(1, 'Family is required'),
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  isActive: z.boolean().optional(),
});

const updateOsSchema = z.object({
  family: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  isActive: z.boolean().optional(),
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
  return release <= normal && normal <= extended && extended <= eol;
}, {
  message: 'Dates must be in chronological order: releaseDate <= normalSupportEnd <= extendedSupportEnd <= eolDate',
});

const updateVersionSchema = z.object({
  version: z.string().min(1).optional(),
  releaseDate: z.string().datetime().optional(),
  normalSupportEnd: z.string().datetime().optional(),
  extendedSupportEnd: z.string().datetime().optional(),
  eolDate: z.string().datetime().optional(),
  phase: z.enum(['RELEASED', 'NORMAL_SUPPORT', 'EXTENDED_SUPPORT', 'NO_SUPPORT', 'EOL']).optional(),
  isActive: z.boolean().optional(),
}).refine((data) => {
  const dates = ['releaseDate', 'normalSupportEnd', 'extendedSupportEnd', 'eolDate'] as const;
  const present = dates.filter((d) => data[d] !== undefined);
  if (present.length < 2) return true;
  const timestamps = present.map((d) => new Date(data[d]!).getTime());
  for (let i = 1; i < timestamps.length; i++) {
    if (timestamps[i] < timestamps[i - 1]) return false;
  }
  return true;
}, {
  message: 'Dates must be in chronological order: releaseDate <= normalSupportEnd <= extendedSupportEnd <= eolDate',
});

// GET /api/os
router.get('/', async (_req, res, next) => {
  try {
    const osList = await prisma.operatingSystem.findMany({
      include: {
        versions: { orderBy: { releaseDate: 'desc' } },
        _count: { select: { versions: true } },
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

    const existing = await prisma.operatingSystem.findUnique({ where: { slug: data.slug } });
    if (existing) {
      return res.status(409).json({ error: 'An OS with this slug already exists' });
    }

    const os = await prisma.operatingSystem.create({
      data,
      include: { versions: true },
    });
    res.status(201).json(os);
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
        _count: { select: { versions: true, variants: true } },
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

    if (data.slug) {
      const existing = await prisma.operatingSystem.findUnique({ where: { slug: data.slug } });
      if (existing && existing.id !== id) {
        return res.status(409).json({ error: 'An OS with this slug already exists' });
      }
    }

    const os = await prisma.operatingSystem.update({
      where: { id },
      data,
      include: { versions: true },
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
      include: {
        versions: { include: { _count: { select: { variants: true } } } },
      },
    });

    if (!os) {
      return res.status(404).json({ error: 'OS not found' });
    }

    const hasVariants = os.versions.some((v) => v._count.variants > 0);
    if (hasVariants) {
      return res.status(409).json({ error: 'Cannot delete OS with versions used in product variants' });
    }

    await prisma.operatingSystem.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

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

// PUT /api/os/:id/versions/:vId
router.put('/:id/versions/:vId', async (req, res, next) => {
  try {
    const { id, vId } = req.params;
    idParamSchema.parse(id);
    idParamSchema.parse(vId);
    const data = updateVersionSchema.parse(req.body);

    const os = await prisma.operatingSystem.findUnique({ where: { id } });
    if (!os) {
      return res.status(404).json({ error: 'OS not found' });
    }

    const existingVersion = await prisma.osVersion.findFirst({
      where: { id: vId, osId: id },
    });
    if (!existingVersion) {
      return res.status(404).json({ error: 'Version not found for this OS' });
    }

    const version = await prisma.osVersion.update({
      where: { id: vId },
      data: {
        ...data,
        releaseDate: data.releaseDate ? new Date(data.releaseDate) : undefined,
        normalSupportEnd: data.normalSupportEnd ? new Date(data.normalSupportEnd) : undefined,
        extendedSupportEnd: data.extendedSupportEnd ? new Date(data.extendedSupportEnd) : undefined,
        eolDate: data.eolDate ? new Date(data.eolDate) : undefined,
      },
    });

    res.json(version);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/os/:id/versions/:vId
router.delete('/:id/versions/:vId', async (req, res, next) => {
  try {
    const { id, vId } = req.params;
    idParamSchema.parse(id);
    idParamSchema.parse(vId);

    const os = await prisma.operatingSystem.findUnique({ where: { id } });
    if (!os) {
      return res.status(404).json({ error: 'OS not found' });
    }

    const version = await prisma.osVersion.findFirst({
      where: { id: vId, osId: id },
      include: { _count: { select: { variants: true } } },
    });

    if (!version) {
      return res.status(404).json({ error: 'Version not found for this OS' });
    }

    if (version._count.variants > 0) {
      return res.status(409).json({ error: 'Cannot delete version used in product variants' });
    }

    await prisma.osVersion.delete({ where: { id: vId } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as osRoutes };
