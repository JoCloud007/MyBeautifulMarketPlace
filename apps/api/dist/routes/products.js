"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productRoutes = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../db");
const router = (0, express_1.Router)();
exports.productRoutes = router;
const productQuerySchema = zod_1.z.object({
    category: zod_1.z.string().optional(),
    os: zod_1.z.string().optional(),
    flavor: zod_1.z.string().optional(),
    search: zod_1.z.string().max(200).optional(),
    availabilityZoneIds: zod_1.z.string().optional(),
});
const createProductSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    slug: zod_1.z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
    description: zod_1.z.string().optional(),
    categoryId: zod_1.z.string().uuid('Invalid category ID'),
    os: zod_1.z.string().optional(),
    documentation: zod_1.z.string().optional(),
    roadmap: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional(),
    availabilityZoneIds: zod_1.z.array(zod_1.z.string().uuid()).max(50).optional(),
});
const idParamSchema = zod_1.z.string().uuid();
const updateProductSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    slug: zod_1.z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
    description: zod_1.z.string().optional(),
    categoryId: zod_1.z.string().uuid().optional(),
    os: zod_1.z.string().optional(),
    documentation: zod_1.z.string().optional(),
    roadmap: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional(),
    availabilityZoneIds: zod_1.z.array(zod_1.z.string().uuid()).max(50).optional(),
});
// GET /api/products
router.get('/', async (req, res, next) => {
    try {
        const filters = productQuerySchema.parse(req.query);
        const where = { isActive: true };
        if (filters.category) {
            where.category = { slug: filters.category };
        }
        if (filters.os) {
            where.os = { equals: filters.os, mode: 'insensitive' };
        }
        if (filters.search) {
            where.OR = [
                { name: { contains: filters.search, mode: 'insensitive' } },
                { description: { contains: filters.search, mode: 'insensitive' } },
            ];
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
        const products = await db_1.prisma.product.findMany({
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
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(products);
    }
    catch (err) {
        next(err);
    }
});
// POST /api/products
router.post('/', async (req, res, next) => {
    try {
        const data = createProductSchema.parse(req.body);
        const { availabilityZoneIds, ...productData } = data;
        // Check for duplicate slug
        const existing = await db_1.prisma.product.findUnique({ where: { slug: data.slug } });
        if (existing) {
            return res.status(409).json({ error: 'A product with this slug already exists' });
        }
        // Validate availabilityZoneIds exist
        if (availabilityZoneIds && availabilityZoneIds.length > 0) {
            const zones = await db_1.prisma.availabilityZone.findMany({ where: { id: { in: availabilityZoneIds } } });
            if (zones.length !== availabilityZoneIds.length) {
                return res.status(400).json({ error: 'One or more availability zones do not exist' });
            }
        }
        const product = await db_1.prisma.product.create({
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
            },
        });
        res.status(201).json(product);
    }
    catch (err) {
        next(err);
    }
});
// GET /api/products/:slug
router.get('/:slug', async (req, res, next) => {
    try {
        const { slug } = req.params;
        const product = await db_1.prisma.product.findUnique({
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
            },
        });
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(product);
    }
    catch (err) {
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
        // Check for duplicate slug if updating slug
        if (data.slug) {
            const existing = await db_1.prisma.product.findUnique({ where: { slug: data.slug } });
            if (existing && existing.id !== id) {
                return res.status(409).json({ error: 'A product with this slug already exists' });
            }
        }
        if (availabilityZoneIds) {
            // Validate new availabilityZoneIds exist before deleting old ones
            if (availabilityZoneIds.length > 0) {
                const zones = await db_1.prisma.availabilityZone.findMany({ where: { id: { in: availabilityZoneIds } } });
                if (zones.length !== availabilityZoneIds.length) {
                    return res.status(400).json({ error: 'One or more availability zones do not exist' });
                }
            }
        }
        const product = await db_1.prisma.$transaction(async (tx) => {
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
                },
            });
        });
        res.json(product);
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/products/:id
router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        idParamSchema.parse(id);
        // Check for related records that would block deletion
        const product = await db_1.prisma.product.findUnique({
            where: { id },
            include: {
                _count: { select: { flavors: true, dependencies: true, dependentProducts: true, forecastLines: true } },
            },
        });
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        const blocks = [];
        if (product._count.flavors > 0)
            blocks.push('flavors');
        if (product._count.dependencies > 0)
            blocks.push('dependencies');
        if (product._count.dependentProducts > 0)
            blocks.push('dependent products');
        if (product._count.forecastLines > 0)
            blocks.push('forecast lines');
        if (blocks.length > 0) {
            return res.status(409).json({
                error: `Cannot delete product with existing ${blocks.join(', ')}. Please remove them first.`,
            });
        }
        await db_1.prisma.product.delete({ where: { id } });
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
// GET /api/products/:slug/forecasts
router.get('/:slug/forecasts', async (req, res, next) => {
    try {
        const { slug } = req.params;
        const product = await db_1.prisma.product.findUnique({ where: { slug } });
        if (!product)
            return res.status(404).json({ error: 'Product not found' });
        const forecasts = await db_1.prisma.forecast.findMany({
            where: { lines: { some: { productId: product.id } } },
            include: { lines: { include: { flavor: true, product: true } } },
            orderBy: { createdAt: 'desc' },
        });
        res.json(forecasts);
    }
    catch (err) {
        next(err);
    }
});
