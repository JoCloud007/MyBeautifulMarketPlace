import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { generateSlug } from '../lib/slugify';

const router = Router();

const productSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().optional(),
  categoryId: z.string().uuid(),
  computeType: z.enum(['PHYSICAL', 'VIRTUAL']).optional().nullable(),
  os: z.string().optional(),
  documentation: z.string().optional(),
  roadmap: z.string().optional(),
  initialReleaseDate: z.string().datetime().or(z.date()).optional(),
  productEOLDate: z.string().datetime().or(z.date()).optional(),
  isActive: z.boolean().optional(),
  zoneIds: z.array(z.string().uuid()).optional(),
  regionId: z.string().uuid().optional(),
});

const flavorSchema = z.object({
  name: z.string().min(1),
  vcpu: z.number().int().min(0),
  ramGb: z.number().int().min(0),
  description: z.string().optional(),
  zoneIds: z.array(z.string().uuid()).optional(),
  releaseDate: z.string().datetime().or(z.date()).optional(),
  deprecationDate: z.string().datetime().or(z.date()).optional(),
  eolDate: z.string().datetime().or(z.date()).optional(),
});

const categorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
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

const idParamSchema = z.string().uuid();

// Helper to validate computeType constraint
async function validateComputeType(categoryId: string, computeType: string | undefined | null) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) {
    return { valid: false, message: 'Category not found' };
  }
  if (computeType && category.name.toLowerCase() !== 'compute') {
    return { valid: false, message: 'computeType can only be set for Compute category products' };
  }
  return { valid: true, category };
}

// ===================== DASHBOARD =====================

// GET /api/admin/dashboard
router.get('/dashboard', async (_req, res, next) => {
  try {
    const [productCount, categoryCount, forecastCount, userCount, azCount, zoneCount, applicationCount, continuityLevelCount] = await Promise.all([
      prisma.product.count(),
      prisma.category.count(),
      prisma.forecast.count(),
      prisma.user.count(),
      prisma.availabilityZone.count(),
      prisma.zone.count(),
      prisma.application.count(),
      prisma.continuityLevel.count(),
    ]);

    const recentForecasts = await prisma.forecast.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { lines: { include: { product: true, flavor: true } }, application: { include: { continuityLevel: true } } },
    });

    res.json({
      counts: { products: productCount, categories: categoryCount, forecasts: forecastCount, users: userCount, availabilityZones: azCount, zones: zoneCount, applications: applicationCount, continuityLevels: continuityLevelCount },
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
      include: {
        category: true,
        variants: { include: { os: true, osVersion: true, flavor: true, availabilityZones: { include: { availabilityZone: true } }, zones: { include: { zone: true } }, continuityLevel: true } },
        zones: { include: { zone: true } },
        region: true,
        productVersions: { include: { region: true, zones: { include: { zone: true } }, availabilityZones: { include: { availabilityZone: true } } } },
        _count: { select: { forecastLines: true, variants: true, instances: true } },
      },
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

    const slug = data.slug || generateSlug('product', data.name);
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) {
      return res.status(409).json({ error: 'A product with this slug already exists' });
    }

    // Validate computeType constraint
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    if (category.name.toLowerCase() === 'compute' && !data.computeType) {
      return res.status(400).json({ error: 'computeType is required for Compute category products' });
    }
    if (data.computeType && category.name.toLowerCase() !== 'compute') {
      return res.status(400).json({ error: 'computeType can only be set for Compute category products' });
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

    // Validate regionId if provided
    if (data.regionId) {
      const region = await prisma.region.findUnique({ where: { id: data.regionId } });
      if (!region) {
        return res.status(400).json({ error: 'Region not found' });
      }
    }

    const { zoneIds, regionId, ...productData } = data;

    try {
      const product = await prisma.product.create({
        data: {
          ...productData,
          slug,
          zones: zoneIds ? { create: zoneIds.map((zid) => ({ zoneId: zid })) } : undefined,
          regionId: regionId || undefined,
        },
        include: { category: true, variants: { include: { os: true, flavor: true } }, zones: { include: { zone: true } }, region: true, productVersions: { include: { region: true, zones: { include: { zone: true } }, availabilityZones: { include: { availabilityZone: true } } } } },
      });
      res.status(201).json(product);
    } catch (err: any) {
      if (err.code === 'P2002') {
        return res.status(409).json({ error: 'A product with this slug already exists' });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/products/:id
router.patch('/products/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const data = productSchema.partial().parse(req.body);

    const existingProduct = await prisma.product.findUnique({ where: { id }, include: { category: true } });
    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const updateData: any = { ...data };

    if (data.name) {
      const newSlug = generateSlug('product', data.name);
      const existing = await prisma.product.findUnique({ where: { slug: newSlug } });
      if (existing && existing.id !== id) {
        return res.status(409).json({ error: 'A product with this slug already exists' });
      }
      updateData.slug = newSlug;
    }

    // Validate computeType constraint and clear when category changes to non-compute
    let targetCategory: typeof existingProduct.category | null = existingProduct.category;
    if (data.categoryId) {
      targetCategory = await prisma.category.findUnique({ where: { id: data.categoryId } });
      if (!targetCategory) {
        return res.status(400).json({ error: 'Category not found' });
      }
    }
    if (targetCategory.name.toLowerCase() === 'compute') {
      if ((data.computeType === undefined ? existingProduct.computeType : data.computeType) == null) {
        return res.status(400).json({ error: 'computeType is required for Compute category products' });
      }
    } else {
      updateData.computeType = null;
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

    // Validate regionId if provided
    if (data.regionId) {
      const region = await prisma.region.findUnique({ where: { id: data.regionId } });
      if (!region) {
        return res.status(400).json({ error: 'Region not found' });
      }
    }

    const { zoneIds, regionId, ...productData } = updateData;

    try {
      const product = await prisma.product.update({
        where: { id },
        data: {
          ...productData,
          zones: zoneIds ? { deleteMany: {}, create: zoneIds.map((zid: string) => ({ zoneId: zid })) } : undefined,
          regionId: regionId !== undefined ? regionId : undefined,
        },
        include: { category: true, variants: { include: { os: { include: { zones: { include: { zone: true } } } }, osVersion: true, flavor: { include: { zones: { include: { zone: true } } } }, availabilityZones: { include: { availabilityZone: true } }, zones: { include: { zone: true } }, continuityLevel: true } }, zones: { include: { zone: true } }, region: true, productVersions: { include: { region: true, zones: { include: { zone: true } }, availabilityZones: { include: { availabilityZone: true } } } } },
      });
      res.json(product);
    } catch (err: any) {
      if (err.code === 'P2002') {
        return res.status(409).json({ error: 'A product with this slug already exists' });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/products/:id
router.delete('/products/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            variants: true,
            dependencies: true,
            dependentProducts: true,
            forecastLines: true,
            instances: true,
            upgradeFrom: true,
            upgradeTo: true,
          },
        },
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const blocks: string[] = [];
    if (product._count.variants > 0) blocks.push('variants');
    if (product._count.dependencies > 0) blocks.push('dependencies');
    if (product._count.dependentProducts > 0) blocks.push('dependent products');
    if (product._count.forecastLines > 0) blocks.push('forecast lines');
    if (product._count.instances > 0) blocks.push('instances');
    if (product._count.upgradeFrom > 0) blocks.push('upgrade paths');
    if (product._count.upgradeTo > 0) blocks.push('dependent upgrade paths');

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

    const slug = generateSlug('category', data.name);
    const existingSlug = await prisma.category.findUnique({ where: { slug } });
    if (existingSlug) {
      return res.status(409).json({ error: 'A category with this slug already exists' });
    }

    const existingName = await prisma.category.findUnique({ where: { name: data.name } });
    if (existingName) {
      return res.status(409).json({ error: 'A category with this name already exists' });
    }

    const category = await prisma.category.create({
      data: { ...data, slug },
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
    idParamSchema.parse(id);
    const data = categorySchema.partial().parse(req.body);

    const updateData: any = { ...data };
    if (data.name) {
      const newSlug = generateSlug('category', data.name);
      const existing = await prisma.category.findUnique({ where: { slug: newSlug } });
      if (existing && existing.id !== id) {
        return res.status(409).json({ error: 'A category with this slug already exists' });
      }
      updateData.slug = newSlug;
    }

    const category = await prisma.category.update({
      where: { id },
      data: updateData,
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
    idParamSchema.parse(id);

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
      include: { zones: { include: { zone: true } }, _count: { select: { variants: true, forecastLines: true, instances: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(flavors);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/flavors
router.post('/flavors', async (req, res, next) => {
  try {
    const data = flavorSchema.parse(req.body);
    const flavor = await prisma.flavor.create({ data });
    res.status(201).json(flavor);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/flavors/:id
router.patch('/flavors/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const data = flavorSchema.partial().parse(req.body);

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

    const { zoneIds, ...flavorData } = data;

    // Handle zone links update
    if (zoneIds) {
      await prisma.flavorZone.deleteMany({ where: { flavorId: id } });
    }

    const flavor = await prisma.flavor.update({
      where: { id },
      data: {
        ...flavorData,
        zones: zoneIds ? { create: zoneIds.map((zid) => ({ zoneId: zid })) } : undefined,
      },
      include: { zones: { include: { zone: true } }, _count: { select: { variants: true } } },
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
    idParamSchema.parse(id);

    // Check if flavor has associated forecasts, instances, or variants
    const flavor = await prisma.flavor.findUnique({
      where: { id },
      include: { _count: { select: { forecastLines: true, instances: true, variants: true } } },
    });

    const blocks: string[] = [];
    if (flavor && flavor._count.variants > 0) blocks.push('variants');
    if (flavor && flavor._count.forecastLines > 0) blocks.push('forecasts');
    if (flavor && flavor._count.instances > 0) blocks.push('instances');

    if (blocks.length > 0) {
      return res.status(409).json({
        error: `Cannot delete flavor with existing ${blocks.join(', ')}. Please delete them first.`,
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
    idParamSchema.parse(id);
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
    idParamSchema.parse(id);
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
      include: { lines: { include: { product: { include: { category: true } }, flavor: true, variant: { include: { os: true, osVersion: true } } } }, application: { include: { continuityLevel: true } } },
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
    idParamSchema.parse(id);
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
    idParamSchema.parse(id);
    await prisma.user.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as adminRoutes };
