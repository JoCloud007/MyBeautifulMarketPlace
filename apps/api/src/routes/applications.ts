import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';

const router = Router();

const createApplicationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  continuityLevelId: z.string().uuid('Invalid continuity level ID'),
  owner: z.string().min(1, 'Owner is required'),
});

const updateApplicationSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  continuityLevelId: z.string().uuid().optional(),
  owner: z.string().min(1).optional(),
});

const idParamSchema = z.string().uuid();

// GET /api/applications
router.get('/', async (_req, res, next) => {
  try {
    const applications = await prisma.application.findMany({
      include: { continuityLevel: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(applications);
  } catch (err) {
    next(err);
  }
});

// GET /api/applications/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const application = await prisma.application.findUnique({
      where: { id },
      include: { continuityLevel: true },
    });
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    res.json(application);
  } catch (err) {
    next(err);
  }
});

// POST /api/applications
router.post('/', async (req, res, next) => {
  try {
    const data = createApplicationSchema.parse(req.body);

    const existing = await prisma.application.findUnique({ where: { name: data.name } });
    if (existing) {
      return res.status(409).json({ error: 'An application with this name already exists' });
    }

    const application = await prisma.application.create({
      data,
      include: { continuityLevel: true },
    });
    res.status(201).json(application);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/applications/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const data = updateApplicationSchema.parse(req.body);

    if (data.name) {
      const existing = await prisma.application.findUnique({ where: { name: data.name } });
      if (existing && existing.id !== id) {
        return res.status(409).json({ error: 'An application with this name already exists' });
      }
    }

    const application = await prisma.application.update({
      where: { id },
      data,
      include: { continuityLevel: true },
    });
    res.json(application);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/applications/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);

    const app = await prisma.application.findUnique({
      where: { id },
      include: { _count: { select: { forecasts: true } } },
    });

    if (!app) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (app._count.forecasts > 0) {
      return res.status(409).json({
        error: 'Cannot delete application with existing forecasts. Please remove or reassign them first.',
      });
    }

    await prisma.application.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as applicationRoutes };
