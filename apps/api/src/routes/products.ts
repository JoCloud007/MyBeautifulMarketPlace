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
  computeType: z.enum(['PHYSICAL', 'VIRTUAL']).optional().nullable(),
  documentation: z.string().optional(),
  roadmap: z.string().optional(),
  isActive: z.boolean().optional(),
});

const idParamSchema = z.string().uuid();

const createVariantSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  osId: z.string().uuid('Invalid OS ID'),
  osVersionId: z.string().uuid('Invalid OS version ID'),
  flavorId: z.string().uuid('Invalid flavor ID'),
  availabilityZoneIds: z.array(z.string().uuid()).max(50).optional(),
  continuityLevelId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
});

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  computeType: z.enum(['PHYSICAL', 'VIRTUAL']).optional().nullable(),
  documentation: z.string().optional(),
  roadmap: z.string().optional(),
  isActive: z.boolean().optional(),
});

// Helper to validate computeType constraint
async function validateComputeType(categoryId: string, computeType: string | undefined | null) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) {
    return { valid: false, message: 'Category not found' };
  }
  if (computeType && category.slug !== 'compute') {
    return { valid: false, message: 'computeType can only be set for Compute category products' };
  }
  return { valid: true, category };
}

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

    if (orConditions.length > 0) {
      where.OR = orConditions;
    }

    const variantConditions: any[] = [];

    if (filters.os) {
      where.os = { equals: filters.os, mode: 'insensitive' };
    }

    if (filters.flavor) {
      variantConditions.push({ flavor: { name: { equals: filters.flavor, mode: 'insensitive' } } });
    }

    if (filters.availabilityZoneIds && filters.availabilityZoneIds.length > 0) {
      const ids = filters.availabilityZoneIds.split(',').filter((id) => id.length > 0);
      if (ids.length > 0) {
        variantConditions.push({ availabilityZones: { some: { availabilityZoneId: { in: ids } } } });
      }
    }

    if (variantConditions.length === 1) {
      where.variants = { some: variantConditions[0] };
    } else if (variantConditions.length > 1) {
      where.variants = { some: { AND: variantConditions } };
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        variants: {
          include: {
            os: true,
            osVersion: true,
            flavor: true,
            availabilityZones: { include: { availabilityZone: true } },
          },
        },
        dependencies: {
          include: { dependsOn: { include: { category: true } } },
        },
        dependentProducts: {
          include: { product: { include: { category: true } } },
        },
        upgradeFrom: { include: { toProduct: { select: { id: true, name: true, slug: true } } } },
        upgradeTo: { include: { fromProduct: { select: { id: true, name: true, slug: true } } } },
        _count: { select: { variants: true, instances: true } },
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

    const existing = await prisma.product.findUnique({ where: { slug: data.slug } });
    if (existing) {
      return res.status(409).json({ error: 'A product with this slug already exists' });
    }

    const validation = await validateComputeType(data.categoryId, data.computeType);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }

    const product = await prisma.product.create({
      data,
      include: {
        category: true,
        variants: {
          include: {
            os: true,
            osVersion: true,
            flavor: true,
            availabilityZones: { include: { availabilityZone: true } },
          },
        },
        dependencies: {
          include: { dependsOn: { include: { category: true } } },
        },
        dependentProducts: {
          include: { product: { include: { category: true } } },
        },
        _count: { select: { variants: true } },
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
        variants: {
          include: {
            os: true,
            osVersion: true,
            flavor: true,
            availabilityZones: { include: { availabilityZone: true } },
            continuityLevel: true,
          },
        },
        dependencies: {
          include: { dependsOn: { include: { category: true, variants: { include: { flavor: true } } } } },
        },
        dependentProducts: {
          include: { product: { include: { category: true, variants: { include: { flavor: true } } } } },
        },
        upgradeFrom: { include: { toProduct: { select: { id: true, name: true, slug: true } } } },
        upgradeTo: { include: { fromProduct: { select: { id: true, name: true, slug: true } } } },
        _count: { select: { variants: true, instances: true } },
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

    if (data.categoryId || data.computeType !== undefined) {
      const categoryId = data.categoryId || existingProduct.categoryId;
      const computeType = data.computeType !== undefined ? data.computeType : existingProduct.computeType;
      const validation = await validateComputeType(categoryId, computeType);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.message });
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data,
      include: {
        category: true,
        variants: {
          include: {
            os: true,
            osVersion: true,
            flavor: true,
            availabilityZones: { include: { availabilityZone: true } },
          },
        },
        dependencies: {
          include: { dependsOn: { include: { category: true } } },
        },
        dependentProducts: {
          include: { product: { include: { category: true } } },
        },
        _count: { select: { variants: true } },
      },
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
        _count: { select: { variants: true, dependencies: true, dependentProducts: true, forecastLines: true, instances: true, upgradeFrom: true, upgradeTo: true } },
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

// ===== PRODUCT VARIANTS =====

// GET /api/products/:id/variants
router.get('/:id/variants', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);

    const variants = await prisma.productVariant.findMany({
      where: { productId: id },
      include: {
        os: true,
        osVersion: true,
        flavor: true,
        availabilityZones: { include: { availabilityZone: true } },
        continuityLevel: true,
        _count: { select: { instances: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(variants);
  } catch (err) {
    next(err);
  }
});

// POST /api/products/:id/variants
router.post('/:id/variants', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const data = createVariantSchema.parse(req.body);

    const product = await prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (product.category?.slug !== 'compute') {
      return res.status(400).json({ error: 'Variants can only be created for Compute products' });
    }

    const os = await prisma.operatingSystem.findUnique({ where: { id: data.osId } });
    if (!os) {
      return res.status(404).json({ error: 'Operating system not found' });
    }

    const osVersion = await prisma.osVersion.findFirst({
      where: { id: data.osVersionId, osId: data.osId },
    });
    if (!osVersion) {
      return res.status(404).json({ error: 'OS version not found or does not belong to the selected OS' });
    }

    const flavor = await prisma.flavor.findUnique({ where: { id: data.flavorId } });
    if (!flavor) {
      return res.status(404).json({ error: 'Flavor not found' });
    }

    const uniqueAzIds = data.availabilityZoneIds ? [...new Set(data.availabilityZoneIds)] : [];
    if (uniqueAzIds.length > 0) {
      const zones = await prisma.availabilityZone.findMany({
        where: { id: { in: uniqueAzIds } },
      });
      if (zones.length !== uniqueAzIds.length) {
        return res.status(400).json({ error: 'One or more availability zones do not exist' });
      }
    }

    const variant = await prisma.productVariant.create({
      data: {
        productId: id,
        name: data.name,
        osId: data.osId,
        osVersionId: data.osVersionId,
        flavorId: data.flavorId,
        continuityLevelId: data.continuityLevelId,
        isActive: data.isActive,
        availabilityZones: uniqueAzIds.length > 0
          ? { create: uniqueAzIds.map((azId: string) => ({ availabilityZoneId: azId })) }
          : undefined,
      },
      include: {
        os: true,
        osVersion: true,
        flavor: true,
        availabilityZones: { include: { availabilityZone: true } },
        continuityLevel: true,
      },
    });

    res.status(201).json(variant);
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
      include: { lines: { include: { flavor: true, product: true, variant: { include: { os: true, osVersion: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json(forecasts);
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
