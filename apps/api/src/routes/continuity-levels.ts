import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';

const router = Router();

const updateContinuityLevelSchema = z.object({
  rtoMinutes: z.number().int().min(1).optional(),
  rpoMinutes: z.number().int().min(1).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
});

const idParamSchema = z.string().uuid();

// GET /api/continuity-levels
router.get('/', async (_req, res, next) => {
  try {
    const levels = await prisma.continuityLevel.findMany({
      orderBy: { rtoMinutes: 'asc' },
    });
    res.json(levels);
  } catch (err) {
    next(err);
  }
});

// GET /api/continuity-levels/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const level = await prisma.continuityLevel.findUnique({ where: { id } });
    if (!level) {
      return res.status(404).json({ error: 'Continuity level not found' });
    }
    res.json(level);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/continuity-levels/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const data = updateContinuityLevelSchema.parse(req.body);

    const level = await prisma.continuityLevel.update({
      where: { id },
      data,
    });
    res.json(level);
  } catch (err) {
    next(err);
  }
});

export { router as continuityLevelRoutes };
