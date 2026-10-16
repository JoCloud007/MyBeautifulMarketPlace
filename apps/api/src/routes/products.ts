import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { generateSlug } from '../lib/slugify';
import { autoTransitionName } from '../lib/transition-name';

const router = Router();

const productQuerySchema = z.object({
  category: z.string().optional(),
  computeType: z.enum(['PHYSICAL', 'VIRTUAL']).optional(),
  search: z.string().max(200).optional(),
});

const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().optional(),
  categoryId: z.string().uuid('Invalid category ID'),
  computeType: z.enum(['PHYSICAL', 'VIRTUAL']).optional(),
  documentation: z.string().optional().nullable(),
  roadmap: z.string().optional().nullable(),
  os: z.string().optional(),
  initialReleaseDate: z.string().datetime().or(z.date()).optional(),
  productEOLDate: z.string().datetime().or(z.date()).optional(),
  status: z.enum(['BACKLOG', 'OPPORTUNITY', 'AVAILABLE', 'AVAILABLE_PILOT_PENDING', 'DELAY_PENDING', 'CANCELLED']).optional(),
  isActive: z.boolean().optional(),
  zoneIds: z.array(z.string().uuid()).optional(),
  regionIds: z.array(z.string().uuid()).optional(),
  availabilityZoneIds: z.array(z.string().uuid()).max(50).optional(),
});

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

const idParamSchema = z.string().uuid();

const createVariantSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  // OS fields are optional: storage products (NAS, Object Storage) bind a
  // flavor through their variant without any operating system.
  osId: z.string().uuid('Invalid OS ID').optional().nullable(),
  osVersionId: z.string().uuid('Invalid OS version ID').optional().nullable(),
  flavorId: z.string().uuid('Invalid flavor ID'),
  availabilityZoneIds: z.array(z.string().uuid()).max(50).optional(),
  zoneIds: z.array(z.string().uuid()).optional(),
  continuityLevelId: z.string().uuid().optional().nullable(),
  productVersionId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
  availabilityType: z.enum(['STANDARD', 'RECOMMENDED', 'RESTRICTED', 'ON_DEMAND']).optional(),
});

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  computeType: z.enum(['PHYSICAL', 'VIRTUAL']).optional().nullable(),
  documentation: z.string().optional().nullable(),
  roadmap: z.string().optional().nullable(),
  os: z.string().optional().nullable(),
  initialReleaseDate: z.string().datetime().or(z.date()).optional(),
  productEOLDate: z.string().datetime().or(z.date()).optional(),
  status: z.enum(['BACKLOG', 'OPPORTUNITY', 'AVAILABLE', 'AVAILABLE_PILOT_PENDING', 'DELAY_PENDING', 'CANCELLED']).optional(),
  isActive: z.boolean().optional(),
  zoneIds: z.array(z.string().uuid()).optional(),
  regionIds: z.array(z.string().uuid()).optional(),
  availabilityZoneIds: z.array(z.string().uuid()).max(50).optional(),
  schedules: z.array(scheduleSchema).optional(),
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

    if (filters.computeType) {
      where.computeType = filters.computeType;
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

    const products = await prisma.product.findMany({
      where,
      include: {
        category: { include: { flavorFieldDefinitions: { orderBy: { order: 'asc' } } } },
        variants: {
          where: { isActive: true },
          include: {
            os: { include: { zones: { include: { zone: true } } } },
            osVersion: true,
            flavor: { include: { profile: { select: { id: true, name: true, slug: true, icon: true, color: true, order: true } }, zones: { include: { zone: true } } } },
            availabilityZones: { include: { availabilityZone: true } },
            zones: { include: { zone: true } },
            continuityLevel: true,
          },
        },
        dependencies: {
          include: { dependsOn: { include: { category: true } } },
        },
        dependentProducts: {
          include: { product: { include: { category: true } } },
        },
        upgradeFrom: { include: { fromProduct: { select: { id: true, name: true, slug: true } } } },
        upgradeTo: { include: { toProduct: { select: { id: true, name: true, slug: true } } } },
        zones: { include: { zone: true } },
        regions: { include: { region: true } },
        availabilityZones: { include: { availabilityZone: true } },
        productVersions: {
          include: {
            variants: { include: { os: true } },
            regions: { include: { region: true } },
            zones: { include: { zone: true } },
            availabilityZones: { include: { availabilityZone: true } },
          },
        },
        performanceProfiles: { include: { metrics: true } },
        _count: { select: { variants: { where: { isActive: true } }, instances: true } },
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

    // Verify category exists
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Validate computeType: required for Compute category, disallowed for others
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

    const { zoneIds, regionIds, availabilityZoneIds, ...productData } = data;
    const slug = data.slug || generateSlug('product', data.name);

    try {
      const product = await prisma.product.create({
        data: {
          ...productData,
          slug,
          zones: zoneIds ? { create: zoneIds.map((zid) => ({ zoneId: zid })) } : undefined,
          regions: regionIds ? { create: regionIds.map((rid) => ({ regionId: rid })) } : undefined,
          availabilityZones: availabilityZoneIds ? { create: availabilityZoneIds.map((azId) => ({ availabilityZoneId: azId })) } : undefined,
        },
        include: {
          category: { include: { flavorFieldDefinitions: { orderBy: { order: 'asc' } } } },
          variants: {
            where: { isActive: true },
            include: {
              os: { include: { zones: { include: { zone: true } } } },
              osVersion: true,
              flavor: { include: { profile: { select: { id: true, name: true, slug: true, icon: true, color: true, order: true } }, zones: { include: { zone: true } } } },
              availabilityZones: { include: { availabilityZone: true } },
              zones: { include: { zone: true } },
              continuityLevel: true,
            },
          },
          dependencies: {
            include: { dependsOn: { include: { category: true } } },
          },
          dependentProducts: {
            include: { product: { include: { category: true } } },
          },
          zones: { include: { zone: true } },
          regions: { include: { region: true } },
          availabilityZones: { include: { availabilityZone: true } },
          productVersions: {
            include: {
              variants: { include: { os: true } },
              regions: { include: { region: true } },
              zones: { include: { zone: true } },
              availabilityZones: { include: { availabilityZone: true } },
            },
          },
          _count: { select: { variants: { where: { isActive: true } } } },
        },
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

// GET /api/products/:id/variants
router.get('/:id/variants', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const variants = await prisma.productVariant.findMany({
      where: { productId: id },
      include: {
        os: true,
        osVersion: true,
        flavor: { include: { profile: { select: { id: true, name: true, slug: true, icon: true, color: true, order: true } } } },
        availabilityZones: { include: { availabilityZone: true } },
        zones: { include: { zone: true } },
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
      include: { category: { include: { flavorFieldDefinitions: { orderBy: { order: 'asc' } } } } },
    });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    // Any product can carry variants — that is how a flavor is bound to a
    // product (and how the product appears in the Marketplace Matrix).
    // Storage products (NAS, Object Storage) have flavors but no OS.

    if (data.osId) {
      const os = await prisma.operatingSystem.findUnique({ where: { id: data.osId } });
      if (!os) {
        return res.status(404).json({ error: 'OS not found' });
      }
    }

    if (data.osId && data.osVersionId) {
      const osVersion = await prisma.osVersion.findFirst({
        where: { id: data.osVersionId, osId: data.osId },
      });
      if (!osVersion) {
        return res.status(404).json({ error: 'OS version not found or does not belong to the specified OS' });
      }
    }

    const flavor = await prisma.flavor.findUnique({ where: { id: data.flavorId } });
    if (!flavor) {
      return res.status(404).json({ error: 'Flavor not found' });
    }

    if (data.continuityLevelId) {
      const cl = await prisma.continuityLevel.findUnique({ where: { id: data.continuityLevelId } });
      if (!cl) {
        return res.status(404).json({ error: 'Continuity level not found' });
      }
    }

    if (data.productVersionId) {
      const pv = await prisma.productVersion.findUnique({ where: { id: data.productVersionId } });
      if (!pv) {
        return res.status(404).json({ error: 'Product version not found' });
      }
    }

    if (data.availabilityZoneIds && data.availabilityZoneIds.length > 0) {
      const uniqueAzIds = [...new Set(data.availabilityZoneIds)];
      if (uniqueAzIds.length !== data.availabilityZoneIds.length) {
        return res.status(400).json({ error: 'Duplicate availability zone IDs are not allowed' });
      }
      const zones = await prisma.availabilityZone.findMany({
        where: { id: { in: data.availabilityZoneIds } },
      });
      if (zones.length !== data.availabilityZoneIds.length) {
        return res.status(400).json({ error: 'One or more availability zones do not exist' });
      }
    }

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

    const variant = await prisma.productVariant.create({
      data: {
        productId: id,
        name: data.name,
        osId: data.osId ?? undefined,
        osVersionId: data.osVersionId ?? undefined,
        flavorId: data.flavorId,
        continuityLevelId: data.continuityLevelId,
        productVersionId: data.productVersionId,
        isActive: data.isActive,
        availabilityType: data.availabilityType,
        availabilityZones: data.availabilityZoneIds
          ? { create: data.availabilityZoneIds.map((azId) => ({ availabilityZoneId: azId })) }
          : undefined,
        zones: data.zoneIds
          ? { create: data.zoneIds.map((zid) => ({ zoneId: zid })) }
          : undefined,
      },
      include: {
        os: true,
        osVersion: true,
        flavor: { include: { profile: { select: { id: true, name: true, slug: true, icon: true, color: true, order: true } } } },
        availabilityZones: { include: { availabilityZone: true } },
        zones: { include: { zone: true } },
        continuityLevel: true,
      },
    });

    res.status(201).json(variant);
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:slug
router.get('/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    z.string().min(1).regex(/^[a-z0-9-]+$/).parse(slug);
    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        category: { include: { flavorFieldDefinitions: { orderBy: { order: 'asc' } } } },
        variants: {
          where: { isActive: true },
          include: {
            os: { include: { zones: { include: { zone: true } } } },
            osVersion: true,
            flavor: { include: { profile: { select: { id: true, name: true, slug: true, icon: true, color: true, order: true } }, zones: { include: { zone: true } } } },
            availabilityZones: { include: { availabilityZone: true } },
            zones: { include: { zone: true } },
            continuityLevel: true,
          },
        },
        dependencies: {
          include: { dependsOn: { include: { category: true } } },
        },
        dependentProducts: {
          include: { product: { include: { category: true } } },
        },
        upgradeFrom: { include: { fromProduct: { select: { id: true, name: true, slug: true } } } },
        upgradeTo: { include: { toProduct: { select: { id: true, name: true, slug: true } } } },
        zones: { include: { zone: { include: { availabilityZones: { include: { availabilityZone: true } } } } } },
        regions: { include: { region: true } },
        availabilityZones: { include: { availabilityZone: true } },
        productVersions: {
          include: {
            variants: { include: { os: true } },
            regions: { include: { region: true } },
            zones: { include: { zone: true } },
            availabilityZones: { include: { availabilityZone: true } },
          },
        },
        performanceProfiles: { include: { metrics: true } },
        _count: { select: { variants: { where: { isActive: true } }, instances: true } },
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

    const existingProduct = await prisma.product.findUnique({
      where: { id },
      include: { category: { include: { flavorFieldDefinitions: { orderBy: { order: 'asc' } } } } },
    });
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
    } else if (data.slug) {
      const existing = await prisma.product.findUnique({ where: { slug: data.slug } });
      if (existing && existing.id !== id) {
        return res.status(409).json({ error: 'A product with this slug already exists' });
      }
      updateData.slug = data.slug;
    }

    // Validate categoryId exists when provided
    let targetCategory: { id: string; name: string; slug: string } | null = existingProduct.category;
    if (data.categoryId) {
      targetCategory = await prisma.category.findUnique({ where: { id: data.categoryId }, select: { id: true, name: true, slug: true } });
      if (!targetCategory) {
        return res.status(400).json({ error: 'Category not found' });
      }
    }

    // Validate computeType: required for Compute category, clear when switching to non-compute
    if (targetCategory.name.toLowerCase() === 'compute') {
      if (data.computeType === undefined && !existingProduct.computeType) {
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

    const { zoneIds, regionIds, availabilityZoneIds, schedules, ...productData } = data;

    // Handle zone links update
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

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...productData,
        zones: zoneIds ? { create: zoneIds.map((zid) => ({ zoneId: zid })) } : undefined,
        regions: regionIds ? { create: regionIds.map((rid) => ({ regionId: rid })) } : undefined,
        availabilityZones: availabilityZoneIds ? { create: availabilityZoneIds.map((azId) => ({ availabilityZoneId: azId })) } : undefined,
      },
      include: {
        category: { include: { flavorFieldDefinitions: { orderBy: { order: 'asc' } } } },
        variants: {
          where: { isActive: true },
          include: {
            os: { include: { zones: { include: { zone: true } } } },
            osVersion: true,
            flavor: { include: { profile: { select: { id: true, name: true, slug: true, icon: true, color: true, order: true } }, zones: { include: { zone: true } } } },
            availabilityZones: { include: { availabilityZone: true } },
            zones: { include: { zone: true } },
            continuityLevel: true,
          },
        },
        dependencies: {
          include: { dependsOn: { include: { category: true } } },
        },
        dependentProducts: {
          include: { product: { include: { category: true } } },
        },
        zones: { include: { zone: true } },
        regions: { include: { region: true } },
        availabilityZones: { include: { availabilityZone: true } },
        productVersions: {
          include: {
            variants: { include: { os: true } },
            regions: { include: { region: true } },
            zones: { include: { zone: true } },
            availabilityZones: { include: { availabilityZone: true } },
          },
        },
        _count: { select: { variants: { where: { isActive: true } } } },
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
        flavor: { include: { profile: { select: { id: true, name: true, slug: true, icon: true, color: true, order: true } } } },
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
      include: { category: { include: { flavorFieldDefinitions: { orderBy: { order: 'asc' } } } } },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Any product can carry variants — that is how a flavor is bound to a
    // product (and how the product appears in the Marketplace Matrix).
    // Storage products (NAS, Object Storage) have flavors but no OS.

    if (data.osId) {
      const os = await prisma.operatingSystem.findUnique({ where: { id: data.osId } });
      if (!os) {
        return res.status(404).json({ error: 'Operating system not found' });
      }
    }

    if (data.osId && data.osVersionId) {
      const osVersion = await prisma.osVersion.findFirst({
        where: { id: data.osVersionId, osId: data.osId },
      });
      if (!osVersion) {
        return res.status(404).json({ error: 'OS version not found or does not belong to the selected OS' });
      }
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
        osId: data.osId ?? undefined,
        osVersionId: data.osVersionId ?? undefined,
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
        flavor: { include: { profile: { select: { id: true, name: true, slug: true, icon: true, color: true, order: true } } } },
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

// ── Upgrade paths (product transitions) ────────────────────────────

const createUpgradePathSchema = z.object({
  toProductId: z.string().uuid('Invalid target product ID'),
  fromVersion: z.string().min(1),
  toVersion: z.string().min(1),
  migrationType: z.enum(['IN_PLACE', 'REBUILD', 'BLUE_GREEN', 'SNAPSHOT']).optional(),
  notes: z.string().optional().nullable(),
});

// GET /api/products/:id/upgrade-paths — transitions from and to this product
// Legacy alias: reads from Transition (the single source of truth) so the
// drawer and the Transitions page always show the same rows.
router.get('/:id/upgrade-paths', async (req, res, next) => {
  try {
    const id = idParamSchema.parse(req.params.id);
    const [outgoing, incoming] = await Promise.all([
      prisma.transition.findMany({
        where: { fromProductId: id },
        include: {
          fromProduct: { select: { id: true, name: true, slug: true } },
          toProduct: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transition.findMany({
        where: { toProductId: id },
        include: {
          fromProduct: { select: { id: true, name: true, slug: true } },
          toProduct: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    res.json({ outgoing, incoming });
  } catch (err) {
    next(err);
  }
});

// POST /api/products/:id/upgrade-paths — declare a transition from this product to another
router.post('/:id/upgrade-paths', async (req, res, next) => {
  try {
    const id = idParamSchema.parse(req.params.id);
    const data = createUpgradePathSchema.parse(req.body);

    const [product, target] = await Promise.all([
      prisma.product.findUnique({ where: { id } }),
      prisma.product.findUnique({ where: { id: data.toProductId } }),
    ]);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (!target) return res.status(404).json({ error: 'Target product not found' });

    // Legacy alias: writes to Transition (name auto-generated). Self-transitions
    // (version bumps) are supported — same rule as POST /:id/transitions.
    const name = autoTransitionName({
      fromProductName: product.name,
      toProductName: target.name,
      fromVersion: data.fromVersion,
      toVersion: data.toVersion,
    });
    const path = await prisma.transition.create({
      data: {
        name,
        slug: generateSlug('transition', name),
        fromProductId: id,
        toProductId: data.toProductId,
        fromVersion: data.fromVersion,
        toVersion: data.toVersion,
        migrationType: data.migrationType || 'REBUILD',
        status: 'AVAILABLE',
        notes: data.notes || null,
      },
      include: {
        fromProduct: { select: { id: true, name: true, slug: true } },
        toProduct: { select: { id: true, name: true, slug: true } },
      },
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
    const existing = await prisma.transition.findUnique({ where: { id: pathId } });
    if (!existing || existing.fromProductId !== id) {
      return res.status(404).json({ error: 'Upgrade path not found for this product' });
    }
    await prisma.transition.delete({ where: { id: pathId } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── Transitions (first-class product transitions) ──────────────────

const createTransitionSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().optional().nullable(),
  fromProductId: z.string().uuid('Invalid source product ID'),
  toProductId: z.string().uuid('Invalid target product ID'),
  // Free-text versions: required for kind=PRODUCT (validated in the route),
  // ignored for kind=OS where they are auto-filled from OsVersion.version.
  fromVersion: z.string().min(1).optional(),
  toVersion: z.string().min(1).optional(),
  kind: z.enum(['PRODUCT', 'OS']).optional(),
  fromOsVersionId: z.string().uuid('Invalid source OS version ID').nullable().optional(),
  toOsVersionId: z.string().uuid('Invalid target OS version ID').nullable().optional(),
  migrationType: z.enum(['IN_PLACE', 'REBUILD', 'BLUE_GREEN', 'SNAPSHOT']).optional(),
  status: z.enum(['BACKLOG', 'OPPORTUNITY', 'AVAILABLE', 'AVAILABLE_PILOT_PENDING', 'DELAY_PENDING', 'CANCELLED']).optional(),
  availableFrom: z.string().datetime().or(z.date()).optional().nullable(),
  eolDate: z.string().datetime().or(z.date()).optional().nullable(),
  notes: z.string().optional().nullable(),
});

const updateTransitionSchema = createTransitionSchema.partial().omit({ fromProductId: true, toProductId: true });

function transitionInclude() {
  return {
    fromProduct: { select: { id: true, name: true, slug: true } },
    toProduct: { select: { id: true, name: true, slug: true } },
    // OS-kind transitions carry explicit OsVersion sources (with their OS).
    fromOsVersion: {
      select: {
        id: true,
        version: true,
        osId: true,
        os: { select: { id: true, name: true, family: true } },
      },
    },
    toOsVersion: {
      select: {
        id: true,
        version: true,
        osId: true,
        os: { select: { id: true, name: true, family: true } },
      },
    },
  };
}

// GET /api/products/transitions/all — every declared transition
router.get('/transitions/all', async (req, res, next) => {
  try {
    const transitions = await prisma.transition.findMany({
      include: transitionInclude(),
      orderBy: { createdAt: 'desc' },
    });
    res.json(transitions);
  } catch (err) {
    next(err);
  }
});

// GET /api/products/transitions/:id
router.get('/transitions/:id', async (req, res, next) => {
  try {
    const id = idParamSchema.parse(req.params.id);
    const transition = await prisma.transition.findUnique({
      where: { id },
      include: transitionInclude(),
    });
    if (!transition) return res.status(404).json({ error: 'Transition not found' });
    res.json(transition);
  } catch (err) {
    next(err);
  }
});

// POST /api/products/:id/transitions — declare a transition from this product
router.post('/:id/transitions', async (req, res, next) => {
  try {
    const fromId = idParamSchema.parse(req.params.id);
    const data = createTransitionSchema.parse({ ...req.body, fromProductId: fromId });

    const [source, target] = await Promise.all([
      prisma.product.findUnique({ where: { id: data.fromProductId } }),
      prisma.product.findUnique({ where: { id: data.toProductId } }),
    ]);
    if (!source) return res.status(404).json({ error: 'Source product not found' });
    if (!target) return res.status(404).json({ error: 'Target product not found' });

    // kind resolution:
    // - kind=OS sources versions from explicit OsVersion rows (both must
    //   exist); legacy fromVersion/toVersion strings are auto-filled from
    //   OsVersion.version and any free text in the payload is ignored.
    // - kind=PRODUCT (default) forces both OS FKs to null and keeps the
    //   free-text fromVersion/toVersion as today.
    const kind = data.kind ?? 'PRODUCT';
    let fromVersion: string;
    let toVersion: string;
    let fromOsVersionId: string | null = null;
    let toOsVersionId: string | null = null;

    if (kind === 'OS') {
      if (!data.fromOsVersionId || !data.toOsVersionId) {
        return res.status(400).json({ error: 'kind=OS requires both fromOsVersionId and toOsVersionId' });
      }
      const [fromOsVersion, toOsVersion] = await Promise.all([
        prisma.osVersion.findUnique({ where: { id: data.fromOsVersionId } }),
        prisma.osVersion.findUnique({ where: { id: data.toOsVersionId } }),
      ]);
      if (!fromOsVersion || !toOsVersion) {
        return res.status(404).json({ error: 'OsVersion not found' });
      }
      fromOsVersionId = fromOsVersion.id;
      toOsVersionId = toOsVersion.id;
      fromVersion = fromOsVersion.version;
      toVersion = toOsVersion.version;
    } else {
      if (!data.fromVersion || !data.toVersion) {
        return res.status(400).json({ error: 'fromVersion and toVersion are required for PRODUCT transitions' });
      }
      fromVersion = data.fromVersion;
      toVersion = data.toVersion;
    }

    // A self-transition (same product, version bump) is the common case
    // (e.g. Bare Metal bm-gen2 → bm-gen3) — fully supported.
    const name = data.name || autoTransitionName({
      fromProductName: source.name,
      toProductName: target.name,
      fromVersion,
      toVersion,
    });

    const slug = data.slug || generateSlug('transition', name);
    const transition = await prisma.transition.create({
      data: {
        name,
        slug,
        description: data.description || null,
        fromProductId: data.fromProductId,
        toProductId: data.toProductId,
        kind,
        fromVersion,
        toVersion,
        fromOsVersionId,
        toOsVersionId,
        migrationType: data.migrationType || 'REBUILD',
        status: data.status || 'BACKLOG',
        availableFrom: data.availableFrom ? new Date(data.availableFrom) : null,
        eolDate: data.eolDate ? new Date(data.eolDate) : null,
        notes: data.notes || null,
      },
      include: transitionInclude(),
    });
    res.status(201).json(transition);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/products/transitions/:id
router.patch('/transitions/:id', async (req, res, next) => {
  try {
    const id = idParamSchema.parse(req.params.id);
    const data = updateTransitionSchema.parse(req.body);
    const existing = await prisma.transition.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Transition not found' });

    // kind resolution (mirror of the create route):
    // - kind=OS: both OsVersion must exist; legacy fromVersion/toVersion are
    //   auto-filled from OsVersion.version (free text in the payload is
    //   ignored). Omitted FKs fall back to the stored ones.
    // - kind=PRODUCT (default path): force both OS FKs to null and keep the
    //   free-text fromVersion/toVersion as today.
    let kind: 'PRODUCT' | 'OS' | undefined;
    let fromOsVersionId: string | null | undefined;
    let toOsVersionId: string | null | undefined;
    let resolvedFromVersion: string | undefined;
    let resolvedToVersion: string | undefined;

    if (data.kind === 'OS') {
      const fromId = data.fromOsVersionId !== undefined ? data.fromOsVersionId : existing.fromOsVersionId;
      const toId = data.toOsVersionId !== undefined ? data.toOsVersionId : existing.toOsVersionId;
      if (!fromId || !toId) {
        return res.status(400).json({ error: 'kind=OS requires both fromOsVersionId and toOsVersionId' });
      }
      const [fromOsVersion, toOsVersion] = await Promise.all([
        prisma.osVersion.findUnique({ where: { id: fromId } }),
        prisma.osVersion.findUnique({ where: { id: toId } }),
      ]);
      if (!fromOsVersion || !toOsVersion) {
        return res.status(404).json({ error: 'OsVersion not found' });
      }
      kind = 'OS';
      fromOsVersionId = fromOsVersion.id;
      toOsVersionId = toOsVersion.id;
      resolvedFromVersion = fromOsVersion.version;
      resolvedToVersion = toOsVersion.version;
    } else if (data.kind !== undefined || data.fromOsVersionId !== undefined || data.toOsVersionId !== undefined) {
      kind = 'PRODUCT';
      fromOsVersionId = null;
      toOsVersionId = null;
    }

    const transition = await prisma.transition.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(resolvedFromVersion !== undefined
          ? { fromVersion: resolvedFromVersion }
          : data.fromVersion !== undefined ? { fromVersion: data.fromVersion } : {}),
        ...(resolvedToVersion !== undefined
          ? { toVersion: resolvedToVersion }
          : data.toVersion !== undefined ? { toVersion: data.toVersion } : {}),
        ...(kind !== undefined ? { kind } : {}),
        ...(fromOsVersionId !== undefined ? { fromOsVersionId } : {}),
        ...(toOsVersionId !== undefined ? { toOsVersionId } : {}),
        ...(data.migrationType !== undefined ? { migrationType: data.migrationType } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.availableFrom !== undefined ? { availableFrom: data.availableFrom ? new Date(data.availableFrom) : null } : {}),
        ...(data.eolDate !== undefined ? { eolDate: data.eolDate ? new Date(data.eolDate) : null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
      include: transitionInclude(),
    });
    res.json(transition);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/products/transitions/:id
router.delete('/transitions/:id', async (req, res, next) => {
  try {
    const id = idParamSchema.parse(req.params.id);
    await prisma.transition.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:id/transitions — transitions from and to this product
router.get('/:id/transitions', async (req, res, next) => {
  try {
    const id = idParamSchema.parse(req.params.id);
    const [outgoing, incoming] = await Promise.all([
      prisma.transition.findMany({
        where: { fromProductId: id },
        include: transitionInclude(),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transition.findMany({
        where: { toProductId: id },
        include: transitionInclude(),
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    res.json({ outgoing, incoming });
  } catch (err) {
    next(err);
  }
});

export { router as productRoutes };
