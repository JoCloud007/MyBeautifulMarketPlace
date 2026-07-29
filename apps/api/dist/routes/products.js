"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productRoutes = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const index_1 = require("../index");
const router = (0, express_1.Router)();
exports.productRoutes = router;
const productQuerySchema = zod_1.z.object({
    category: zod_1.z.string().optional(),
    os: zod_1.z.string().optional(),
    flavor: zod_1.z.string().optional(),
    search: zod_1.z.string().max(200).optional(),
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
        const products = await index_1.prisma.product.findMany({
            where,
            include: {
                category: true,
                flavors: true,
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
        // Check for duplicate slug
        const existing = await index_1.prisma.product.findUnique({ where: { slug: data.slug } });
        if (existing) {
            return res.status(409).json({ error: 'A product with this slug already exists' });
        }
        const product = await index_1.prisma.product.create({
            data,
            include: {
                category: true,
                flavors: true,
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
        const product = await index_1.prisma.product.findUnique({
            where: { slug },
            include: {
                category: true,
                flavors: true,
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
        // Check for duplicate slug if updating slug
        if (data.slug) {
            const existing = await index_1.prisma.product.findUnique({ where: { slug: data.slug } });
            if (existing && existing.id !== id) {
                return res.status(409).json({ error: 'A product with this slug already exists' });
            }
        }
        const product = await index_1.prisma.product.update({
            where: { id },
            data,
            include: {
                category: true,
                flavors: true,
                dependencies: {
                    include: { dependsOn: { include: { category: true } } },
                },
                dependentProducts: {
                    include: { product: { include: { category: true } } },
                },
            },
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
        const product = await index_1.prisma.product.findUnique({
            where: { id },
            include: {
                _count: { select: { flavors: true, dependencies: true, dependentProducts: true, forecasts: true } },
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
        if (product._count.forecasts > 0)
            blocks.push('forecasts');
        if (blocks.length > 0) {
            return res.status(409).json({
                error: `Cannot delete product with existing ${blocks.join(', ')}. Please remove them first.`,
            });
        }
        await index_1.prisma.product.delete({ where: { id } });
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
        const product = await index_1.prisma.product.findUnique({ where: { slug } });
        if (!product)
            return res.status(404).json({ error: 'Product not found' });
        const forecasts = await index_1.prisma.forecast.findMany({
            where: { productId: product.id },
            include: { flavor: true, product: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(forecasts);
    }
    catch (err) {
        next(err);
    }
});
