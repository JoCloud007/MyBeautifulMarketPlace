import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { generateSlug, slugify } from '../lib/slugify';

const router = Router();

const scheduleSchema = z.object({
  id: z.string().uuid().optional(),
  regionId: z.string().uuid().optional().nullable(),
  azId: z.string().uuid().optional().nullable(),
  zoneId: z.string().uuid().optional().nullable(),
  availableFrom: z.string().datetime().or(z.date()).optional().nullable(),
  availableUntil: z.string().datetime().or(z.date()).optional().nullable(),
  status: z.enum(['STANDARD', 'RECOMMENDED', 'RESTRICTED', 'ON_DEMAND']).optional(),
  deleted: z.boolean().optional(),
});

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
  regionIds: z.array(z.string().uuid()).optional(),
  availabilityZoneIds: z.array(z.string().uuid()).max(50).optional(),
  schedules: z.array(scheduleSchema).optional(),
});

const flavorSchema = z.object({
  name: z.string().min(1),
  categoryId: z.string().uuid().optional(),
  // Profile × Size grid — all nullable: existing flavors keep working without one
  profileId: z.string().uuid().nullable().optional(),
  sizeLabel: z.string().nullable().optional(),
  sizeRank: z.number().int().nullable().optional(),
  vcpu: z.number().int().min(0).optional(),
  ramGb: z.number().int().min(0).optional(),
  attributes: z.record(z.union([z.string(), z.number()])).optional(),
  description: z.string().optional(),
  zoneIds: z.array(z.string().uuid()).optional(),
  regionIds: z.array(z.string().uuid()).optional(),
  availabilityZoneIds: z.array(z.string().uuid()).max(50).optional(),
  schedules: z.array(scheduleSchema).optional(),
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

const fieldDefinitionSchema = z.object({
  key: z.string().min(1).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Key must be alphanumeric (starting with a letter)'),
  label: z.string().min(1),
  unit: z.string().optional(),
  type: z.enum(['number', 'enum', 'string']),
  required: z.boolean().optional(),
  order: z.number().int().optional(),
  options: z.array(z.string()).optional(),
});

// Validates a flavor's `attributes` object against the target category's field definitions.
// Returns an error message string, or null when valid.
// Validates that a provided profileId references a FlavorProfile belonging to the
// flavor's own category (Profile × Size grid). Returns an error message string,
// or null when valid. profileId is optional/nullable — flavors may stay unprofiled.
async function validateFlavorProfile(
  categoryId: string | undefined | null,
  profileId: string | undefined | null
): Promise<string | null> {
  if (profileId == null) return null;
  const profile = await (prisma as any).flavorProfile.findUnique({ where: { id: profileId } });
  if (!profile) return 'Flavor profile not found';
  if (categoryId && profile.categoryId !== categoryId) {
    return 'Flavor profile must belong to the same category as the flavor';
  }
  return null;
}

async function validateFlavorAttributes(categoryId: string | undefined, attributes: Record<string, string | number> | undefined): Promise<string | null> {
  if (!categoryId || !attributes) return null;
  const defs = await prisma.flavorFieldDefinition.findMany({ where: { categoryId } });
  for (const [key, value] of Object.entries(attributes)) {
    const def = defs.find((d) => d.key === key);
    if (!def) return `Unknown flavor attribute "${key}" for this category`;
    if (def.type === 'number' && typeof value !== 'number') return `Attribute "${key}" must be a number`;
    if (def.type === 'enum') {
      if (typeof value !== 'string') return `Attribute "${key}" must be one of: ${(def.options as string[] | null)?.join(', ') || 'string'}`;
      const options = (def.options as string[] | null) || [];
      if (options.length > 0 && !options.includes(value)) return `Attribute "${key}" must be one of: ${options.join(', ')}`;
    }
  }
  for (const def of defs) {
    const v = attributes[def.key];
    if (def.required && (v == null || v === '')) return `Missing required attribute "${def.key}" (${def.label})`;
  }
  return null;
}

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
        // flavorFieldDefinitions lets the web UI detect compute categories
        // (strict rule: the category defines a "vcpu" field). Without it the
        // drawer cannot tell Compute from Data and mis-shows OS on variants.
        category: { include: { flavorFieldDefinitions: { orderBy: { order: 'asc' } } } },
        variants: { include: { os: true, osVersion: true, flavor: true, availabilityZones: { include: { availabilityZone: true } }, zones: { include: { zone: true } }, continuityLevel: true } },
        zones: { include: { zone: true } },
        regions: { include: { region: true } },
        availabilityZones: { include: { availabilityZone: true } },
        productVersions: { include: { regions: { include: { region: true } }, zones: { include: { zone: true } }, availabilityZones: { include: { availabilityZone: true } } } },
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

    // Validate regionIds if provided
    if (data.regionIds && data.regionIds.length > 0) {
      const uniqueRegionIds = [...new Set(data.regionIds)];
      if (uniqueRegionIds.length !== data.regionIds.length) {
        return res.status(400).json({ error: 'Duplicate region IDs are not allowed' });
      }
      const regions = await prisma.region.findMany({ where: { id: { in: data.regionIds } } });
      if (regions.length !== data.regionIds.length) {
        return res.status(400).json({ error: 'One or more regions do not exist' });
      }
    }

    // Validate availabilityZoneIds if provided
    if (data.availabilityZoneIds && data.availabilityZoneIds.length > 0) {
      const uniqueAzIds = [...new Set(data.availabilityZoneIds)];
      if (uniqueAzIds.length !== data.availabilityZoneIds.length) {
        return res.status(400).json({ error: 'Duplicate availability zone IDs are not allowed' });
      }
      const azs = await prisma.availabilityZone.findMany({ where: { id: { in: data.availabilityZoneIds } } });
      if (azs.length !== data.availabilityZoneIds.length) {
        return res.status(400).json({ error: 'One or more availability zones do not exist' });
      }
    }

    const { zoneIds, regionIds, availabilityZoneIds, schedules, ...productData } = data;

    try {
      const product = await prisma.product.create({
        data: {
          ...productData,
          slug,
          zones: zoneIds ? { create: zoneIds.map((zid) => ({ zoneId: zid })) } : undefined,
          regions: regionIds ? { create: regionIds.map((rid) => ({ regionId: rid })) } : undefined,
          availabilityZones: availabilityZoneIds ? { create: availabilityZoneIds.map((azId) => ({ availabilityZoneId: azId })) } : undefined,
        },
        include: { category: true, variants: { include: { os: true, flavor: true, availabilityZones: { include: { availabilityZone: true } }, zones: { include: { zone: true } } } }, zones: { include: { zone: true } }, regions: { include: { region: true } }, availabilityZones: { include: { availabilityZone: true } }, productVersions: { include: { regions: { include: { region: true } }, zones: { include: { zone: true } }, availabilityZones: { include: { availabilityZone: true } } } } },
      });

      if (schedules && schedules.length > 0) {
        await prisma.availabilitySchedule.createMany({
          data: schedules.map((s) => ({
            targetType: 'PRODUCT' as const,
            targetId: product.id,
            regionId: s.regionId || null,
            azId: s.azId || null,
            zoneId: s.zoneId || null,
            availableFrom: s.availableFrom ? new Date(s.availableFrom) : null,
            availableUntil: s.availableUntil ? new Date(s.availableUntil) : null,
            status: s.status || 'STANDARD',
          })),
        });
      }

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

    // Validate regionIds if provided
    if (data.regionIds && data.regionIds.length > 0) {
      const uniqueRegionIds = [...new Set(data.regionIds)];
      if (uniqueRegionIds.length !== data.regionIds.length) {
        return res.status(400).json({ error: 'Duplicate region IDs are not allowed' });
      }
      const regions = await prisma.region.findMany({ where: { id: { in: data.regionIds } } });
      if (regions.length !== data.regionIds.length) {
        return res.status(400).json({ error: 'One or more regions do not exist' });
      }
    }

    // Validate availabilityZoneIds if provided
    if (data.availabilityZoneIds && data.availabilityZoneIds.length > 0) {
      const uniqueAzIds = [...new Set(data.availabilityZoneIds)];
      if (uniqueAzIds.length !== data.availabilityZoneIds.length) {
        return res.status(400).json({ error: 'Duplicate availability zone IDs are not allowed' });
      }
      const azs = await prisma.availabilityZone.findMany({ where: { id: { in: data.availabilityZoneIds } } });
      if (azs.length !== data.availabilityZoneIds.length) {
        return res.status(400).json({ error: 'One or more availability zones do not exist' });
      }
    }

    const { zoneIds, regionIds, availabilityZoneIds, schedules, ...productData } = updateData;

    // Handle relation updates
    if (zoneIds) {
      await prisma.productZone.deleteMany({ where: { productId: id } });
    }
    if (regionIds) {
      await prisma.productRegion.deleteMany({ where: { productId: id } });
    }
    if (availabilityZoneIds) {
      await prisma.productAvailabilityZone.deleteMany({ where: { productId: id } });
    }

    // Handle schedules update
    if (schedules) {
      const toDelete = schedules.filter((s: any) => s.deleted && s.id).map((s: any) => s.id);
      const toUpdate = schedules.filter((s: any) => s.id && !s.deleted);
      const toCreate = schedules.filter((s: any) => !s.id && !s.deleted);
      if (toDelete.length > 0) {
        await prisma.availabilitySchedule.deleteMany({ where: { id: { in: toDelete }, targetType: 'PRODUCT', targetId: id } });
      }
      for (const s of toUpdate) {
        await prisma.availabilitySchedule.update({
          where: { id: s.id },
          data: {
            regionId: s.regionId,
            azId: s.azId,
            zoneId: s.zoneId,
            availableFrom: s.availableFrom ? new Date(s.availableFrom) : null,
            availableUntil: s.availableUntil ? new Date(s.availableUntil) : null,
            status: s.status || 'STANDARD',
          },
        });
      }
      if (toCreate.length > 0) {
        await prisma.availabilitySchedule.createMany({
          data: toCreate.map((s: any) => ({
            targetType: 'PRODUCT',
            targetId: id,
            regionId: s.regionId,
            azId: s.azId,
            zoneId: s.zoneId,
            availableFrom: s.availableFrom ? new Date(s.availableFrom) : null,
            availableUntil: s.availableUntil ? new Date(s.availableUntil) : null,
            status: s.status || 'STANDARD',
          })),
        });
      }
    }

    try {
      const product = await prisma.product.update({
        where: { id },
        data: {
          ...productData,
          zones: zoneIds ? { create: zoneIds.map((zid: string) => ({ zoneId: zid })) } : undefined,
          regions: regionIds ? { create: regionIds.map((rid: string) => ({ regionId: rid })) } : undefined,
          availabilityZones: availabilityZoneIds ? { create: availabilityZoneIds.map((azId: string) => ({ availabilityZoneId: azId })) } : undefined,
        },
        include: { category: true, variants: { include: { os: { include: { zones: { include: { zone: true } } } }, osVersion: true, flavor: { include: { zones: { include: { zone: true } } } }, availabilityZones: { include: { availabilityZone: true } }, zones: { include: { zone: true } }, continuityLevel: true } }, zones: { include: { zone: true } }, regions: { include: { region: true } }, availabilityZones: { include: { availabilityZone: true } }, productVersions: { include: { regions: { include: { region: true } }, zones: { include: { zone: true } }, availabilityZones: { include: { availabilityZone: true } } } } },
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

// ===================== VARIANTS =====================

// GET /api/admin/variants — global ProductVariant list for the Variants admin page.
// Read-only: variants are managed from the product drawer (create/edit scoped to a product).
router.get('/variants', async (req, res, next) => {
  try {
    const { productId, productVersionId, osId } = req.query;
    const where: any = {};
    if (typeof productId === 'string' && productId) where.productId = productId;
    if (typeof productVersionId === 'string' && productVersionId) where.productVersionId = productVersionId;
    if (typeof osId === 'string' && osId) where.osId = osId;

    const variants = await prisma.productVariant.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, slug: true } },
        os: true,
        osVersion: true,
        flavor: { include: { profile: { select: { id: true, name: true, slug: true, icon: true, color: true, order: true } } } },
        productVersion: { select: { id: true, version: true } },
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

// ===================== FLAVORS =====================

// GET /api/admin/flavors
router.get('/flavors', async (_req, res, next) => {
  try {
    const flavors = await prisma.flavor.findMany({
      include: { category: { include: { flavorFieldDefinitions: { orderBy: { order: 'asc' } } } }, profile: { select: { id: true, name: true, slug: true, icon: true, color: true } }, zones: { include: { zone: true } }, regions: { include: { region: true } }, availabilityZones: { include: { availabilityZone: true } }, _count: { select: { variants: true, forecastLines: true, instances: true } } },
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
    const attrError = await validateFlavorAttributes(data.categoryId, data.attributes);
    if (attrError) return res.status(400).json({ error: attrError });
    // Cross-validate: a provided profileId must belong to the flavor's own category
    const profileError = await validateFlavorProfile(data.categoryId, data.profileId);
    if (profileError) return res.status(400).json({ error: profileError });
    const { zoneIds, regionIds, availabilityZoneIds, schedules, ...flavorData } = data;

    const flavor = await prisma.flavor.create({
      data: {
        ...flavorData,
        zones: zoneIds ? { create: zoneIds.map((zid) => ({ zoneId: zid })) } : undefined,
        regions: regionIds ? { create: regionIds.map((rid) => ({ regionId: rid })) } : undefined,
        availabilityZones: availabilityZoneIds ? { create: availabilityZoneIds.map((azId) => ({ availabilityZoneId: azId })) } : undefined,
      },
      include: { profile: { select: { id: true, name: true, slug: true, icon: true, color: true } }, zones: { include: { zone: true } }, regions: { include: { region: true } }, availabilityZones: { include: { availabilityZone: true } } },
    });

    if (schedules && schedules.length > 0) {
      await prisma.availabilitySchedule.createMany({
        data: schedules.map((s) => ({
          targetType: 'FLAVOR' as const,
          targetId: flavor.id,
          regionId: s.regionId || null,
          azId: s.azId || null,
          zoneId: s.zoneId || null,
          availableFrom: s.availableFrom ? new Date(s.availableFrom) : null,
          availableUntil: s.availableUntil ? new Date(s.availableUntil) : null,
          status: s.status || 'STANDARD',
        })),
      });
    }

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

    // Validate regionIds if provided
    if (data.regionIds && data.regionIds.length > 0) {
      const uniqueRegionIds = [...new Set(data.regionIds)];
      if (uniqueRegionIds.length !== data.regionIds.length) {
        return res.status(400).json({ error: 'Duplicate region IDs are not allowed' });
      }
      const regions = await prisma.region.findMany({ where: { id: { in: data.regionIds } } });
      if (regions.length !== data.regionIds.length) {
        return res.status(400).json({ error: 'One or more regions do not exist' });
      }
    }

    // Validate availabilityZoneIds if provided
    if (data.availabilityZoneIds && data.availabilityZoneIds.length > 0) {
      const uniqueAzIds = [...new Set(data.availabilityZoneIds)];
      if (uniqueAzIds.length !== data.availabilityZoneIds.length) {
        return res.status(400).json({ error: 'Duplicate availability zone IDs are not allowed' });
      }
      const azs = await prisma.availabilityZone.findMany({ where: { id: { in: data.availabilityZoneIds } } });
      if (azs.length !== data.availabilityZoneIds.length) {
        return res.status(400).json({ error: 'One or more availability zones do not exist' });
      }
    }

    const { zoneIds, regionIds, availabilityZoneIds, schedules, ...flavorData } = data;

    // Validate attributes against the flavor's category definitions
    let effectiveCategoryId: string | undefined = data.categoryId ?? undefined;
    if (!effectiveCategoryId) {
      const existing = await prisma.flavor.findUnique({ where: { id }, select: { categoryId: true } });
      effectiveCategoryId = existing?.categoryId ?? undefined;
    }
    const attrError = await validateFlavorAttributes(effectiveCategoryId, data.attributes);
    if (attrError) return res.status(400).json({ error: attrError });

    // Cross-validate: a provided profileId must belong to the flavor's own category.
    // Also revalidate the STORED profile when the PATCH changes categoryId — otherwise
    // moving a profiled flavor to another category would silently break the invariant.
    const profileError = await validateFlavorProfile(effectiveCategoryId, data.profileId);
    if (profileError) return res.status(400).json({ error: profileError });
    if (data.categoryId && data.profileId === undefined) {
      const existing = await prisma.flavor.findUnique({ where: { id }, select: { profileId: true } });
      const staleProfileError = await validateFlavorProfile(effectiveCategoryId, existing?.profileId);
      if (staleProfileError) {
        return res.status(400).json({
          error: `${staleProfileError} — the flavor keeps its current profile; move it to a profile of category "${effectiveCategoryId}" or clear the profile in the same request.`,
        });
      }
    }

    // Handle relation updates
    if (zoneIds) {
      await prisma.flavorZone.deleteMany({ where: { flavorId: id } });
    }
    if (regionIds) {
      await prisma.flavorRegion.deleteMany({ where: { flavorId: id } });
    }
    if (availabilityZoneIds) {
      await prisma.flavorAvailabilityZone.deleteMany({ where: { flavorId: id } });
    }

    // Handle schedules update
    if (schedules) {
      const toDelete = schedules.filter((s: any) => s.deleted && s.id).map((s: any) => s.id);
      const toUpdate = schedules.filter((s: any) => s.id && !s.deleted);
      const toCreate = schedules.filter((s: any) => !s.id && !s.deleted);
      if (toDelete.length > 0) {
        await prisma.availabilitySchedule.deleteMany({ where: { id: { in: toDelete }, targetType: 'FLAVOR', targetId: id } });
      }
      for (const s of toUpdate) {
        await prisma.availabilitySchedule.update({
          where: { id: s.id },
          data: {
            regionId: s.regionId,
            azId: s.azId,
            zoneId: s.zoneId,
            availableFrom: s.availableFrom ? new Date(s.availableFrom) : null,
            availableUntil: s.availableUntil ? new Date(s.availableUntil) : null,
            status: s.status || 'STANDARD',
          },
        });
      }
      if (toCreate.length > 0) {
        await prisma.availabilitySchedule.createMany({
          data: toCreate.map((s: any) => ({
            targetType: 'FLAVOR',
            targetId: id,
            regionId: s.regionId,
            azId: s.azId,
            zoneId: s.zoneId,
            availableFrom: s.availableFrom ? new Date(s.availableFrom) : null,
            availableUntil: s.availableUntil ? new Date(s.availableUntil) : null,
            status: s.status || 'STANDARD',
          })),
        });
      }
    }

    const flavor = await prisma.flavor.update({
      where: { id },
      data: {
        ...flavorData,
        zones: zoneIds ? { create: zoneIds.map((zid) => ({ zoneId: zid })) } : undefined,
        regions: regionIds ? { create: regionIds.map((rid) => ({ regionId: rid })) } : undefined,
        availabilityZones: availabilityZoneIds ? { create: availabilityZoneIds.map((azId) => ({ availabilityZoneId: azId })) } : undefined,
      },
      include: { profile: { select: { id: true, name: true, slug: true, icon: true, color: true } }, zones: { include: { zone: true } }, regions: { include: { region: true } }, availabilityZones: { include: { availabilityZone: true } }, _count: { select: { variants: true } } },
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

// ===================== FLAVOR FIELD DEFINITIONS =====================

// GET /api/admin/categories/:id/field-definitions
router.get('/categories/:id/field-definitions', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const defs = await prisma.flavorFieldDefinition.findMany({
      where: { categoryId: id },
      orderBy: { order: 'asc' },
    });
    res.json(defs);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/categories/:id/field-definitions
router.post('/categories/:id/field-definitions', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const data = fieldDefinitionSchema.parse(req.body);

    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const exists = await prisma.flavorFieldDefinition.findUnique({
      where: { categoryId_key: { categoryId: id, key: data.key } },
    });
    if (exists) return res.status(409).json({ error: `Field "${data.key}" already exists for this category` });

    const def = await prisma.flavorFieldDefinition.create({
      data: { ...data, categoryId: id },
    });
    res.status(201).json(def);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/categories/:id/field-definitions/:key
router.patch('/categories/:id/field-definitions/:key', async (req, res, next) => {
  try {
    const { id, key } = req.params;
    idParamSchema.parse(id);
    const data = fieldDefinitionSchema.partial().parse(req.body);

    const def = await prisma.flavorFieldDefinition.findUnique({
      where: { categoryId_key: { categoryId: id, key } },
    });
    if (!def) return res.status(404).json({ error: 'Field definition not found' });

    // Renaming the key would orphan existing flavor attributes — forbid it
    if (data.key && data.key !== key) {
      return res.status(400).json({ error: 'Key cannot be changed (existing flavors reference it). Delete and recreate instead.' });
    }

    const updated = await prisma.flavorFieldDefinition.update({
      where: { categoryId_key: { categoryId: id, key } },
      data,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/categories/:id/field-definitions/:key
router.delete('/categories/:id/field-definitions/:key', async (req, res, next) => {
  try {
    const { id, key } = req.params;
    idParamSchema.parse(id);

    const def = await prisma.flavorFieldDefinition.findUnique({
      where: { categoryId_key: { categoryId: id, key } },
    });
    if (!def) return res.status(404).json({ error: 'Field definition not found' });

    await prisma.flavorFieldDefinition.delete({ where: { categoryId_key: { categoryId: id, key } } });

    // Strip the now-undefined key from existing flavors of this category
    const flavors = await prisma.flavor.findMany({ where: { categoryId: id, NOT: { attributes: { equals: {} } } } });
    for (const f of flavors) {
      const attrs = (f.attributes as Record<string, unknown> | null) || {};
      if (key in attrs) {
        const { [key]: _removed, ...rest } = attrs;
        await prisma.flavor.update({ where: { id: f.id }, data: { attributes: rest as any } });
      }
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ===================== FLAVOR PROFILES (Profile × Size grid) =====================
// Unrelated to PerformanceProfile (metric model). Owned per Category.
// slug is unique per category and must not be renamed after creation.

const flavorProfileSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  order: z.number().int().optional(),
});

// GET /api/admin/categories/:id/flavor-profiles
router.get('/categories/:id/flavor-profiles', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const profiles = await (prisma as any).flavorProfile.findMany({
      where: { categoryId: id },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(profiles);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/categories/:id/flavor-profiles
router.post('/categories/:id/flavor-profiles', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const data = flavorProfileSchema.parse(req.body);

    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const slug = data.slug || slugify(data.name);
    const exists = await (prisma as any).flavorProfile.findUnique({
      where: { categoryId_slug: { categoryId: id, slug } },
    });
    if (exists) return res.status(409).json({ error: `Flavor profile "${slug}" already exists for this category` });

    const profile = await (prisma as any).flavorProfile.create({
      data: { ...data, slug, categoryId: id },
    });
    res.status(201).json(profile);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/categories/:id/flavor-profiles/:profileId
router.patch('/categories/:id/flavor-profiles/:profileId', async (req, res, next) => {
  try {
    const { id, profileId } = req.params;
    idParamSchema.parse(id);
    idParamSchema.parse(profileId);
    const data = flavorProfileSchema.partial().parse(req.body);

    const profile = await (prisma as any).flavorProfile.findUnique({
      where: { id: profileId },
    });
    if (!profile || profile.categoryId !== id) {
      return res.status(404).json({ error: 'Flavor profile not found' });
    }

    // Renaming the slug would break the Profile × Size grid references — forbid it
    if (data.slug && data.slug !== profile.slug) {
      return res.status(400).json({ error: 'Slug cannot be changed (existing flavors reference it). Delete and recreate instead.' });
    }
    const { slug: _slug, ...updateData } = data;

    const updated = await (prisma as any).flavorProfile.update({
      where: { id: profileId },
      data: updateData,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/categories/:id/flavor-profiles/:profileId
router.delete('/categories/:id/flavor-profiles/:profileId', async (req, res, next) => {
  try {
    const { id, profileId } = req.params;
    idParamSchema.parse(id);
    idParamSchema.parse(profileId);

    const profile = await (prisma as any).flavorProfile.findUnique({ where: { id: profileId } });
    if (!profile || profile.categoryId !== id) {
      return res.status(404).json({ error: 'Flavor profile not found' });
    }

    const flavorCount = await prisma.flavor.count({ where: { profileId } });
    if (flavorCount > 0) {
      return res.status(409).json({
        error: `Cannot delete flavor profile with ${flavorCount} attached flavor(s). Please reassign or remove them first.`,
      });
    }

    await (prisma as any).flavorProfile.delete({ where: { id: profileId } });
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
