import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';

const router = Router();

const productQuerySchema = z.object({
  category: z.string().optional(),
  os: z.string().optional(),
  flavor: z.string().optional(),
  search: z.string().max(200).optional(),
  availabilityZoneIds: z.string().optional(),
});

const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().optional(),
  categoryId: z.string().uuid('Invalid category ID'),
  os: z.string().optional(),
  documentation: z.string().optional(),
  roadmap: z.string().optional(),
  isActive: z.boolean().optional(),
  availabilityZoneIds: z.array(z.string().uuid()).max(50).optional(),
});

const idParamSchema = z.string().uuid();

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  os: z.string().optional(),
  documentation: z.string().optional(),
  roadmap: z.string().optional(),
  isActive: z.boolean().optional(),
  availabilityZoneIds: z.array(z.string().uuid()).max(50).optional(),
});

const createOptionSchema = z.object({
  type: z.enum(['OS_VERSION', 'EDITION', 'FEATURE']),
  value: z.string().min(1),
  label: z.string().min(1),
  isDefault: z.boolean().optional(),
});

const createLifecycleSchema = z.object({
  version: z.string().min(1),
  releaseDate: z.string().datetime(),
  normalSupportEnd: z.string().datetime(),
  extendedSupportEnd: z.string().datetime(),
  eolDate: z.string().datetime(),
}).refine((data) => {
  const release = new Date(data.releaseDate).getTime();
  const normal = new Date(data.normalSupportEnd).getTime();
  const extended = new Date(data.extendedSupportEnd).getTime();
  const eol = new Date(data.eolDate).getTime();
  return release < normal && normal < extended && extended < eol;
}, {
  message: 'Dates must be in chronological order: releaseDate < normalSupportEnd < extendedSupportEnd < eolDate',
});

// GET /api/products
router.get('/', async (req, res, next) => {
  try {
    const filters = productQuerySchema.parse(req.query);

    const where: any = { isActive: true };
    const orConditions: any[] = [];

    if (filters.category) {
      where.category = { slug: filters.category };
    }

    if (filters.search) {
      orConditions.push(
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      );
    }

    if (filters.os) {
      orConditions.push(
        { os: { equals: filters.os, mode: 'insensitive' } },
        { options: { some: { type: 'OS_VERSION', value: { equals: filters.os, mode: 'insensitive' } } } },
      );
    }

    if (orConditions.length > 0) {
      where.OR = orConditions;
    }

    if (filters.flavor) {
      where.flavors = { some: { name: { equals: filters.flavor, mode: 'insensitive' } } };
    }

    if (filters.availabilityZoneIds && filters.availabilityZoneIds.length > 0) {
      const ids = filters.availabilityZoneIds.split(',').filter((id) => id.length > 0);
      if (ids.length > 0) {
        where.availabilityZones = { some: { availabilityZoneId: { in: ids } } };
      }
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        flavors: true,
        availabilityZones: {
          include: { availabilityZone: true },
        },
        dependencies: {
          include: { dependsOn: { include: { category: true } } },
        },
        dependentProducts: {
          include: { product: { include: { category: true } } },
        },
        options: true,
        lifecycles: { orderBy: { releaseDate: 'desc' } },
        upgradeFrom: { include: { toProduct: { select: { id: true, name: true, slug: true } } } },
        upgradeTo: { include: { fromProduct: { select: { id: true, name: true, slug: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(products);
  } catch (err) {
    next(err);
  }
});

// POST /api/products
router.post('/', async (req, res, next) => {
  try {
    const data = createProductSchema.parse(req.body);
    const { availabilityZoneIds, ...productData } = data;

    const existing = await prisma.product.findUnique({ where: { slug: data.slug } });
    if (existing) {
      return res.status(409).json({ error: 'A product with this slug already exists' });
    }

    if (availabilityZoneIds && availabilityZoneIds.length > 0) {
      const zones = await prisma.availabilityZone.findMany({ where: { id: { in: availabilityZoneIds } } });
      if (zones.length !== availabilityZoneIds.length) {
        return res.status(400).json({ error: 'One or more availability zones do not exist' });
      }
    }

    const product = await prisma.product.create({
      data: {
        ...productData,
        availabilityZones: availabilityZoneIds
          ? { create: availabilityZoneIds.map((id) => ({ availabilityZoneId: id })) }
          : undefined,
      },
      include: {
        category: true,
        flavors: true,
        availabilityZones: {
          include: { availabilityZone: true },
        },
        dependencies: {
          include: { dependsOn: { include: { category: true } } },
        },
        dependentProducts: {
          include: { product: { include: { category: true } } },
        },
        options: true,
        lifecycles: true,
      },
    });

    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:slug
router.get('/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        flavors: true,
        availabilityZones: {
          include: { availabilityZone: true },
        },
        dependencies: {
          include: { dependsOn: { include: { category: true, flavors: true } } },
        },
        dependentProducts: {
          include: { product: { include: { category: true, flavors: true } } },
        },
        options: true,
        lifecycles: { orderBy: { releaseDate: 'desc' } },
        upgradeFrom: { include: { toProduct: { select: { id: true, name: true, slug: true } } } },
        upgradeTo: { include: { fromProduct: { select: { id: true, name: true, slug: true } } } },
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/products/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const data = updateProductSchema.parse(req.body);
    const { availabilityZoneIds, ...productData } = data;

    const existingProduct = await prisma.product.findUnique({ where: { id } });
    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (data.slug) {
      const existing = await prisma.product.findUnique({ where: { slug: data.slug } });
      if (existing && existing.id !== id) {
        return res.status(409).json({ error: 'A product with this slug already exists' });
      }
    }

    if (availabilityZoneIds) {
      if (availabilityZoneIds.length > 0) {
        const zones = await prisma.availabilityZone.findMany({ where: { id: { in: availabilityZoneIds } } });
        if (zones.length !== availabilityZoneIds.length) {
          return res.status(400).json({ error: 'One or more availability zones do not exist' });
        }
      }
    }

    const product = await prisma.$transaction(async (tx) => {
      if (availabilityZoneIds) {
        await tx.productAvailabilityZone.deleteMany({ where: { productId: id } });
      }
      return tx.product.update({
        where: { id },
        data: {
          ...productData,
          availabilityZones: availabilityZoneIds
            ? { create: availabilityZoneIds.map((azId) => ({ availabilityZoneId: azId })) }
            : undefined,
        },
        include: {
          category: true,
          flavors: true,
          availabilityZones: {
            include: { availabilityZone: true },
          },
          dependencies: {
            include: { dependsOn: { include: { category: true } } },
          },
          dependentProducts: {
            include: { product: { include: { category: true } } },
          },
          options: true,
          lifecycles: true,
        },
      });
    });

    res.json(product);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/products/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        _count: { select: { flavors: true, dependencies: true, dependentProducts: true, forecastLines: true } },
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const blocks: string[] = [];
    if (product._count.flavors > 0) blocks.push('flavors');
    if (product._count.dependencies > 0) blocks.push('dependencies');
    if (product._count.dependentProducts > 0) blocks.push('dependent products');
    if (product._count.forecastLines > 0) blocks.push('forecast lines');

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

// GET /api/products/:slug/forecasts
router.get('/:slug/forecasts', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const product = await prisma.product.findUnique({ where: { slug } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const forecasts = await prisma.forecast.findMany({
      where: { lines: { some: { productId: product.id } } },
      include: { lines: { include: { flavor: true, product: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json(forecasts);
  } catch (err) {
    next(err);
  }
});

// ===== OPTIONS =====

// GET /api/products/:id/options
router.get('/:id/options', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const options = await prisma.productOption.findMany({
      where: { productId: id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(options);
  } catch (err) {
    next(err);
  }
});

// POST /api/products/:id/options
router.post('/:id/options', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const data = createOptionSchema.parse(req.body);

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const option = await prisma.productOption.create({
      data: { ...data, productId: id },
    });
    res.status(201).json(option);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/products/:id/options/:optionId
router.delete('/:id/options/:optionId', async (req, res, next) => {
  try {
    const { id, optionId } = req.params;
    idParamSchema.parse(id);
    idParamSchema.parse(optionId);

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const option = await prisma.productOption.findFirst({
      where: { id: optionId, productId: id },
    });
    if (!option) {
      return res.status(404).json({ error: 'Option not found for this product' });
    }

    await prisma.productOption.delete({ where: { id: optionId } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ===== LIFECYCLES =====

// GET /api/products/:id/lifecycles
router.get('/:id/lifecycles', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const lifecycles = await prisma.productLifecycle.findMany({
      where: { productId: id },
      orderBy: { releaseDate: 'desc' },
    });
    res.json(lifecycles);
  } catch (err) {
    next(err);
  }
});

// POST /api/products/:id/lifecycles
router.post('/:id/lifecycles', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const data = createLifecycleSchema.parse(req.body);

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const lifecycle = await prisma.productLifecycle.create({
      data: {
        productId: id,
        version: data.version,
        releaseDate: new Date(data.releaseDate),
        normalSupportEnd: new Date(data.normalSupportEnd),
        extendedSupportEnd: new Date(data.extendedSupportEnd),
        eolDate: new Date(data.eolDate),
      },
    });
    res.status(201).json(lifecycle);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/products/:id/lifecycles/:lifecycleId
router.patch('/:id/lifecycles/:lifecycleId', async (req, res, next) => {
  try {
    const { id, lifecycleId } = req.params;
    idParamSchema.parse(id);
    idParamSchema.parse(lifecycleId);
    const data = z.object({
      version: z.string().optional(),
      releaseDate: z.string().datetime().optional(),
      normalSupportEnd: z.string().datetime().optional(),
      extendedSupportEnd: z.string().datetime().optional(),
      eolDate: z.string().datetime().optional(),
      phase: z.enum(['RELEASED', 'NORMAL_SUPPORT', 'EXTENDED_SUPPORT', 'NO_SUPPORT', 'EOL']).optional(),
    }).parse(req.body);

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const lifecycle = await prisma.productLifecycle.findFirst({
      where: { id: lifecycleId, productId: id },
    });
    if (!lifecycle) {
      return res.status(404).json({ error: 'Lifecycle not found for this product' });
    }

    const updated = await prisma.productLifecycle.update({
      where: { id: lifecycleId },
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

// DELETE /api/products/:id/lifecycles/:lifecycleId
router.delete('/:id/lifecycles/:lifecycleId', async (req, res, next) => {
  try {
    const { id, lifecycleId } = req.params;
    idParamSchema.parse(id);
    idParamSchema.parse(lifecycleId);

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const lifecycle = await prisma.productLifecycle.findFirst({
      where: { id: lifecycleId, productId: id },
    });
    if (!lifecycle) {
      return res.status(404).json({ error: 'Lifecycle not found for this product' });
    }

    await prisma.productLifecycle.delete({ where: { id: lifecycleId } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ===== UPGRADE PATHS =====

// GET /api/products/:id/upgrade-paths
router.get('/:id/upgrade-paths', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const paths = await prisma.upgradePath.findMany({
      where: { fromProductId: id },
      include: { toProduct: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(paths);
  } catch (err) {
    next(err);
  }
});

// POST /api/products/:id/upgrade-paths
router.post('/:id/upgrade-paths', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const data = z.object({
      toProductId: z.string().uuid(),
      fromVersion: z.string().min(1),
      toVersion: z.string().min(1),
      migrationType: z.enum(['IN_PLACE', 'REBUILD', 'BLUE_GREEN', 'SNAPSHOT']),
      notes: z.string().optional(),
    }).parse(req.body);

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const path = await prisma.upgradePath.create({
      data: { ...data, fromProductId: id },
    });
    res.status(201).json(path);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/products/:id/upgrade-paths/:pathId
router.delete('/:id/upgrade-paths/:pathId', async (req, res, next) => {
  try {
    const { id, pathId } = req.params;
    idParamSchema.parse(id);
    idParamSchema.parse(pathId);

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const path = await prisma.upgradePath.findFirst({
      where: { id: pathId, fromProductId: id },
    });
    if (!path) {
      return res.status(404).json({ error: 'Upgrade path not found for this product' });
    }

    await prisma.upgradePath.delete({ where: { id: pathId } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as productRoutes };
