"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRoutes = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../db");
const router = (0, express_1.Router)();
exports.adminRoutes = router;
const productSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    slug: zod_1.z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
    description: zod_1.z.string().optional(),
    categoryId: zod_1.z.string().uuid(),
    os: zod_1.z.string().optional(),
    documentation: zod_1.z.string().optional(),
    roadmap: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional(),
    availabilityZoneIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
});
const flavorSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    vcpu: zod_1.z.number().int().min(0),
    ramGb: zod_1.z.number().int().min(0),
    description: zod_1.z.string().optional(),
});
const categorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    slug: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    icon: zod_1.z.string().optional(),
});
const dependencySchema = zod_1.z.object({
    productId: zod_1.z.string().uuid(),
    dependsOnId: zod_1.z.string().uuid(),
    type: zod_1.z.enum(['REQUIRED', 'RECOMMENDED']),
    description: zod_1.z.string().optional(),
});
const userSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    name: zod_1.z.string().min(1),
    role: zod_1.z.enum(['ADMIN', 'USER']).optional(),
});
const idParamSchema = zod_1.z.string().uuid();
// ===================== DASHBOARD =====================
// GET /api/admin/dashboard
router.get('/dashboard', async (_req, res, next) => {
    try {
        const [productCount, categoryCount, forecastCount, userCount, azCount] = await Promise.all([
            db_1.prisma.product.count(),
            db_1.prisma.category.count(),
            db_1.prisma.forecast.count(),
            db_1.prisma.user.count(),
            db_1.prisma.availabilityZone.count(),
        ]);
        const recentForecasts = await db_1.prisma.forecast.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: { lines: { include: { product: true, flavor: true } } },
        });
        res.json({
            counts: { products: productCount, categories: categoryCount, forecasts: forecastCount, users: userCount, availabilityZones: azCount },
            recentForecasts,
        });
    }
    catch (err) {
        next(err);
    }
});
// ===================== PRODUCTS =====================
// GET /api/admin/products
router.get('/products', async (_req, res, next) => {
    try {
        const products = await db_1.prisma.product.findMany({
            include: {
                category: true,
                flavors: true,
                availabilityZones: { include: { availabilityZone: true } },
                _count: { select: { forecastLines: true } },
            },
            orderBy: { updatedAt: 'desc' },
        });
        res.json(products);
    }
    catch (err) {
        next(err);
    }
});
// POST /api/admin/products
router.post('/products', async (req, res, next) => {
    try {
        const data = productSchema.parse(req.body);
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
            include: { category: true, flavors: true, availabilityZones: { include: { availabilityZone: true } } },
        });
        res.status(201).json(product);
    }
    catch (err) {
        next(err);
    }
});
// PATCH /api/admin/products/:id
router.patch('/products/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        idParamSchema.parse(id);
        const data = productSchema.partial().parse(req.body);
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
                include: { category: true, flavors: true, availabilityZones: { include: { availabilityZone: true } } },
            });
        });
        res.json(product);
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/admin/products/:id
router.delete('/products/:id', async (req, res, next) => {
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
// POST /api/admin/products/:id/flavors
router.post('/products/:id/flavors', async (req, res, next) => {
    try {
        const { id } = req.params;
        idParamSchema.parse(id);
        // Verify product exists
        const product = await db_1.prisma.product.findUnique({ where: { id } });
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        const data = flavorSchema.parse(req.body);
        const flavor = await db_1.prisma.flavor.create({
            data: { ...data, productId: id },
        });
        res.status(201).json(flavor);
    }
    catch (err) {
        next(err);
    }
});
// ===================== CATEGORIES =====================
// GET /api/admin/categories
router.get('/categories', async (_req, res, next) => {
    try {
        const categories = await db_1.prisma.category.findMany({
            include: { _count: { select: { products: true } } },
            orderBy: { name: 'asc' },
        });
        res.json(categories);
    }
    catch (err) {
        next(err);
    }
});
// POST /api/admin/categories
router.post('/categories', async (req, res, next) => {
    try {
        const data = categorySchema.parse(req.body);
        // Check for duplicate slug
        const existingSlug = await db_1.prisma.category.findUnique({ where: { slug: data.slug } });
        if (existingSlug) {
            return res.status(409).json({ error: 'A category with this slug already exists' });
        }
        // Check for duplicate name
        const existingName = await db_1.prisma.category.findUnique({ where: { name: data.name } });
        if (existingName) {
            return res.status(409).json({ error: 'A category with this name already exists' });
        }
        const category = await db_1.prisma.category.create({
            data,
            include: { _count: { select: { products: true } } },
        });
        res.status(201).json(category);
    }
    catch (err) {
        next(err);
    }
});
// PATCH /api/admin/categories/:id
router.patch('/categories/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        idParamSchema.parse(id);
        const data = categorySchema.partial().parse(req.body);
        const category = await db_1.prisma.category.update({
            where: { id },
            data,
            include: { _count: { select: { products: true } } },
        });
        res.json(category);
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/admin/categories/:id
router.delete('/categories/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        idParamSchema.parse(id);
        // Check if category has products
        const category = await db_1.prisma.category.findUnique({
            where: { id },
            include: { _count: { select: { products: true } } },
        });
        if (category && category._count.products > 0) {
            return res.status(409).json({
                error: 'Cannot delete category with existing products. Please reassign or delete products first.',
            });
        }
        await db_1.prisma.category.delete({ where: { id } });
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
// ===================== FLAVORS =====================
// GET /api/admin/flavors
router.get('/flavors', async (_req, res, next) => {
    try {
        const flavors = await db_1.prisma.flavor.findMany({
            include: { product: { include: { category: true } }, _count: { select: { forecastLines: true } } },
            orderBy: { createdAt: 'desc' },
        });
        res.json(flavors);
    }
    catch (err) {
        next(err);
    }
});
// PATCH /api/admin/flavors/:id
router.patch('/flavors/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        idParamSchema.parse(id);
        const data = flavorSchema.partial().parse(req.body);
        const flavor = await db_1.prisma.flavor.update({
            where: { id },
            data,
            include: { product: { include: { category: true } } },
        });
        res.json(flavor);
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/admin/flavors/:id
router.delete('/flavors/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        idParamSchema.parse(id);
        // Check if flavor has associated forecasts
        const flavor = await db_1.prisma.flavor.findUnique({
            where: { id },
            include: { _count: { select: { forecastLines: true } } },
        });
        if (flavor && flavor._count.forecastLines > 0) {
            return res.status(409).json({
                error: 'Cannot delete flavor with existing forecasts. Please delete forecasts first.',
            });
        }
        await db_1.prisma.flavor.delete({ where: { id } });
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
// ===================== DEPENDENCIES =====================
// GET /api/admin/dependencies
router.get('/dependencies', async (_req, res, next) => {
    try {
        const dependencies = await db_1.prisma.dependency.findMany({
            include: {
                product: { include: { category: true } },
                dependsOn: { include: { category: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(dependencies);
    }
    catch (err) {
        next(err);
    }
});
// POST /api/admin/dependencies
router.post('/dependencies', async (req, res, next) => {
    try {
        const data = dependencySchema.parse(req.body);
        const dependency = await db_1.prisma.dependency.create({
            data,
            include: {
                product: { include: { category: true } },
                dependsOn: { include: { category: true } },
            },
        });
        res.status(201).json(dependency);
    }
    catch (err) {
        next(err);
    }
});
// PATCH /api/admin/dependencies/:id
router.patch('/dependencies/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        idParamSchema.parse(id);
        const data = dependencySchema.partial().parse(req.body);
        const dependency = await db_1.prisma.dependency.update({
            where: { id },
            data,
            include: {
                product: { include: { category: true } },
                dependsOn: { include: { category: true } },
            },
        });
        res.json(dependency);
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/admin/dependencies/:id
router.delete('/dependencies/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        idParamSchema.parse(id);
        await db_1.prisma.dependency.delete({ where: { id } });
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
// ===================== FORECASTS =====================
// GET /api/admin/forecasts
router.get('/forecasts', async (_req, res, next) => {
    try {
        const forecasts = await db_1.prisma.forecast.findMany({
            include: { lines: { include: { product: { include: { category: true } }, flavor: true } } },
            orderBy: { createdAt: 'desc' },
        });
        res.json(forecasts);
    }
    catch (err) {
        next(err);
    }
});
// ===================== USERS =====================
// GET /api/admin/users
router.get('/users', async (_req, res, next) => {
    try {
        const users = await db_1.prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
        res.json(users);
    }
    catch (err) {
        next(err);
    }
});
// POST /api/admin/users
router.post('/users', async (req, res, next) => {
    try {
        const data = userSchema.parse(req.body);
        const user = await db_1.prisma.user.create({ data });
        res.status(201).json(user);
    }
    catch (err) {
        next(err);
    }
});
// PATCH /api/admin/users/:id
router.patch('/users/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        idParamSchema.parse(id);
        const data = userSchema.partial().parse(req.body);
        const user = await db_1.prisma.user.update({ where: { id }, data });
        res.json(user);
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        idParamSchema.parse(id);
        await db_1.prisma.user.delete({ where: { id } });
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
