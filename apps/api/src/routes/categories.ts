import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { generateSlug } from '../lib/slugify';

const router = Router();

const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
});

// GET /api/categories
router.get('/', async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        _count: { select: { products: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

// POST /api/categories
router.post('/', async (req, res, next) => {
  try {
    const data = createCategorySchema.parse(req.body);
    const slug = data.slug || generateSlug('category', data.name);

    try {
      const category = await prisma.category.create({
        data: { ...data, slug },
        include: {
          _count: { select: { products: true } },
        },
      });

      res.status(201).json(category);
    } catch (err: any) {
      if (err.code === 'P2002') {
        return res.status(409).json({ error: 'A category with this slug or name already exists' });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

// GET /api/categories/:slug
router.get('/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    z.string().min(1).regex(/^[a-z0-9-]+$/).parse(slug);
    const category = await prisma.category.findUnique({
      where: { slug },
      include: {
        products: {
          where: { isActive: true },
          include: { category: true, variants: { include: { os: true, osVersion: true, flavor: true } } },
        },
      },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(category);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/categories/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const idParamSchema = z.string().uuid();
    idParamSchema.parse(id);
    const data = updateCategorySchema.parse(req.body);

    const updateData: any = { ...data };

    // Regenerate slug when name changes
    if (data.name) {
      const newSlug = generateSlug('category', data.name);
      const existing = await prisma.category.findUnique({ where: { slug: newSlug } });
      if (existing && existing.id !== id) {
        return res.status(409).json({ error: 'A category with this slug already exists' });
      }
      updateData.slug = newSlug;
    } else if (data.slug) {
      const existing = await prisma.category.findUnique({ where: { slug: data.slug } });
      if (existing && existing.id !== id) {
        return res.status(409).json({ error: 'A category with this slug already exists' });
      }
      updateData.slug = data.slug;
    }

    // Check for duplicate name if updating name
    if (data.name) {
      const existing = await prisma.category.findUnique({ where: { name: data.name } });
      if (existing && existing.id !== id) {
        return res.status(409).json({ error: 'A category with this name already exists' });
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data: updateData,
      include: {
        _count: { select: { products: true } },
      },
    });

    res.json(category);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/categories/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const idParamSchema = z.string().uuid();
    idParamSchema.parse(id);

    // Check if category has products
    const category = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });

    if (category && category._count.products > 0) {
      return res.status(409).json({
        error: 'Cannot delete category with existing products. Please reassign or delete products first.',
      });
    }

    await prisma.category.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as categoryRoutes };
