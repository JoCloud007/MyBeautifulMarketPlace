import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { generateSlug } from '../lib/slugify';

const router = Router();

// GET /api/countries
router.get('/countries', async (_req, res, next) => {
  try {
    const countries = await prisma.country.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(countries);
  } catch (err) {
    next(err);
  }
});

const regionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

const idParamSchema = z.string().uuid();

// GET /api/regions
router.get('/regions', async (_req, res, next) => {
  try {
    const regions = await prisma.region.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(regions);
  } catch (err) {
    next(err);
  }
});

// POST /api/regions
router.post('/regions', async (req, res, next) => {
  try {
    const data = regionSchema.parse(req.body);
    const slug = generateSlug('region', data.name);

    const existing = await prisma.region.findUnique({ where: { slug } });
    if (existing) {
      return res.status(409).json({ error: 'A region with this name already exists' });
    }

    const region = await prisma.region.create({
      data: { ...data, slug },
    });
    res.status(201).json(region);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/regions/:id
router.patch('/regions/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const data = regionSchema.partial().parse(req.body);

    const region = await prisma.region.update({
      where: { id },
      data,
    });
    res.json(region);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/regions/:id
router.delete('/regions/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const region = await prisma.region.findUnique({
      where: { id },
      include: { products: true, productVersions: true },
    });
    if (!region) {
      res.status(404).json({ error: 'Not Found', message: 'Record to delete does not exist.' });
      return;
    }
    const attached: string[] = [];
    if (region.products.length > 0) attached.push(`${region.products.length} product(s)`);
    if (region.productVersions.length > 0) attached.push(`${region.productVersions.length} product version(s)`);
    if (attached.length > 0) {
      res.status(409).json({ error: 'Conflict', message: `Cannot delete region: ${attached.join(', ')} attached.` });
      return;
    }
    await prisma.region.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as geoRoutes };
