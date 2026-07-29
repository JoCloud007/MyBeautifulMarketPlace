import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';

const router = Router();

const productSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().optional(),
  categoryId: z.string().uuid(),
  os: z.string().optional(),
  documentation: z.string().optional(),
  roadmap: z.string().optional(),
  isActive: z.boolean().optional(),
});

const flavorSchema = z.object({
  name: z.string().min(1),
  vcpu: z.number().int().min(0),
  ramGb: z.number().int().min(0),
  description: z.string().optional(),
});

const categorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
});

const dependencySchema = z.object({
  productId: z.string().uuid(),
  dependsOnId: z.string().uuid(),
  type: z.enum(['REQUIRED', 'RECOMMENDED']),
  description: z.string().optional(),
});

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['ADMIN', 'USER']).optional(),
});

// ===================== DASHBOARD =====================

// GET /api/admin/dashboard
router.get('/dashboard', async (_req, res, next) => {
  try {
    const [productCount, categoryCount, forecastCount, userCount] = await Promise.all([
      prisma.product.count(),
      prisma.category.count(),
      prisma.forecast.count(),
      prisma.user.count(),
    ]);

    const recentForecasts = await prisma.forecast.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { product: true, flavor: true },
    });

    res.json({
      counts: { products: productCount, categories: categoryCount, forecasts: forecastCount, users: userCount },
      recentForecasts,
    });
  } catch (err) {
    next(err);
  }
});

// ===================== PRODUCTS =====================

// GET /api/admin/products
router.get('/products', async (_req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      include: { category: true, flavors: true, _count: { select: { forecasts: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(products);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/products
router.post('/products', async (req, res, next) => {
  try {
    const data = productSchema.parse(req.body);

    // Check for duplicate slug
    const existing = await prisma.product.findUnique({ where: { slug: data.slug } });
    if (existing) {
      return res.status(409).json({ error: 'A product with this slug already exists' });
    }

    const product = await prisma.product.create({
      data,
      include: { category: true, flavors: true },
    });
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/products/:id
router.patch('/products/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = productSchema.partial().parse(req.body);

    // Check for duplicate slug if updating slug
    if (data.slug) {
      const existing = await prisma.product.findUnique({ where: { slug: data.slug } });
      if (existing && existing.id !== id) {
        return res.status(409).json({ error: 'A product with this slug already exists' });
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data,
      include: { category: true, flavors: true },
    });
    res.json(product);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/products/:id
router.delete('/products/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check for related records that would block deletion
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        _count: { select: { flavors: true, dependencies: true, dependentProducts: true, forecasts: true } },
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const blocks: string[] = [];
    if (product._count.flavors > 0) blocks.push('flavors');
    if (product._count.dependencies > 0) blocks.push('dependencies');
    if (product._count.dependentProducts > 0) blocks.push('dependent products');
    if (product._count.forecasts > 0) blocks.push('forecasts');

    if (blocks.length > 0) {
      return res.status(409).json({
        error: `Cannot delete product with existing ${blocks.join(', ')}. Please remove them first.`,
      });
    }

    await prisma.product.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/products/:id/flavors
router.post('/products/:id/flavors', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify product exists
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const data = flavorSchema.parse(req.body);
    const flavor = await prisma.flavor.create({
      data: { ...data, productId: id },
    });
    res.status(201).json(flavor);
  } catch (err) {
    next(err);
  }
});

// ===================== CATEGORIES =====================

// GET /api/admin/categories
router.get('/categories', async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/categories
router.post('/categories', async (req, res, next) => {
  try {
    const data = categorySchema.parse(req.body);

    // Check for duplicate slug
    const existingSlug = await prisma.category.findUnique({ where: { slug: data.slug } });
    if (existingSlug) {
      return res.status(409).json({ error: 'A category with this slug already exists' });
    }

    // Check for duplicate name
    const existingName = await prisma.category.findUnique({ where: { name: data.name } });
    if (existingName) {
      return res.status(409).json({ error: 'A category with this name already exists' });
    }

    const category = await prisma.category.create({
      data,
      include: { _count: { select: { products: true } } },
    });
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/categories/:id
router.patch('/categories/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = categorySchema.partial().parse(req.body);
    const category = await prisma.category.update({
      where: { id },
      data,
      include: { _count: { select: { products: true } } },
    });
    res.json(category);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/categories/:id
router.delete('/categories/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

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

// ===================== FLAVORS =====================

// GET /api/admin/flavors
router.get('/flavors', async (_req, res, next) => {
  try {
    const flavors = await prisma.flavor.findMany({
      include: { product: { include: { category: true } }, _count: { select: { forecasts: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(flavors);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/flavors/:id
router.patch('/flavors/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = flavorSchema.partial().parse(req.body);
    const flavor = await prisma.flavor.update({
      where: { id },
      data,
      include: { product: { include: { category: true } } },
    });
    res.json(flavor);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/flavors/:id
router.delete('/flavors/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if flavor has associated forecasts
    const flavor = await prisma.flavor.findUnique({
      where: { id },
      include: { _count: { select: { forecasts: true } } },
    });

    if (flavor && flavor._count.forecasts > 0) {
      return res.status(409).json({
        error: 'Cannot delete flavor with existing forecasts. Please delete forecasts first.',
      });
    }

    await prisma.flavor.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ===================== DEPENDENCIES =====================

// GET /api/admin/dependencies
router.get('/dependencies', async (_req, res, next) => {
  try {
    const dependencies = await prisma.dependency.findMany({
      include: {
        product: { include: { category: true } },
        dependsOn: { include: { category: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(dependencies);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/dependencies
router.post('/dependencies', async (req, res, next) => {
  try {
    const data = dependencySchema.parse(req.body);
    const dependency = await prisma.dependency.create({
      data,
      include: {
        product: { include: { category: true } },
        dependsOn: { include: { category: true } },
      },
    });
    res.status(201).json(dependency);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/dependencies/:id
router.patch('/dependencies/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = dependencySchema.partial().parse(req.body);
    const dependency = await prisma.dependency.update({
      where: { id },
      data,
      include: {
        product: { include: { category: true } },
        dependsOn: { include: { category: true } },
      },
    });
    res.json(dependency);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/dependencies/:id
router.delete('/dependencies/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.dependency.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ===================== FORECASTS =====================

// GET /api/admin/forecasts
router.get('/forecasts', async (_req, res, next) => {
  try {
    const forecasts = await prisma.forecast.findMany({
      include: { product: { include: { category: true } }, flavor: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(forecasts);
  } catch (err) {
    next(err);
  }
});

// ===================== USERS =====================

// GET /api/admin/users
router.get('/users', async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/users
router.post('/users', async (req, res, next) => {
  try {
    const data = userSchema.parse(req.body);
    const user = await prisma.user.create({ data });
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/users/:id
router.patch('/users/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = userSchema.partial().parse(req.body);
    const user = await prisma.user.update({ where: { id }, data });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.user.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as adminRoutes };
