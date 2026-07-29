"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dependencyRoutes = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const index_1 = require("../index");
const router = (0, express_1.Router)();
exports.dependencyRoutes = router;
const createDependencySchema = zod_1.z.object({
    productId: zod_1.z.string().uuid('Invalid product ID'),
    dependsOnId: zod_1.z.string().uuid('Invalid depends-on product ID'),
    type: zod_1.z.enum([client_1.DependencyType.REQUIRED, client_1.DependencyType.RECOMMENDED]),
    description: zod_1.z.string().optional(),
});
const updateDependencySchema = zod_1.z.object({
    type: zod_1.z.enum([client_1.DependencyType.REQUIRED, client_1.DependencyType.RECOMMENDED]).optional(),
    description: zod_1.z.string().optional(),
});
// GET /api/dependencies
router.get('/', async (req, res, next) => {
    try {
        const { productId, dependsOnId } = req.query;
        const where = {};
        if (productId && typeof productId === 'string') {
            where.productId = productId;
        }
        if (dependsOnId && typeof dependsOnId === 'string') {
            where.dependsOnId = dependsOnId;
        }
        const dependencies = await index_1.prisma.dependency.findMany({
            where,
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
// POST /api/dependencies
router.post('/', async (req, res, next) => {
    try {
        const data = createDependencySchema.parse(req.body);
        // Validate that both products exist
        const [product, dependsOn] = await Promise.all([
            index_1.prisma.product.findUnique({ where: { id: data.productId } }),
            index_1.prisma.product.findUnique({ where: { id: data.dependsOnId } }),
        ]);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        if (!dependsOn) {
            return res.status(404).json({ error: 'Depends-on product not found' });
        }
        // Prevent self-dependency
        if (data.productId === data.dependsOnId) {
            return res.status(400).json({ error: 'A product cannot depend on itself' });
        }
        // Check for circular dependency (would create A->B and B->A)
        const reverse = await index_1.prisma.dependency.findUnique({
            where: {
                productId_dependsOnId: {
                    productId: data.dependsOnId,
                    dependsOnId: data.productId,
                },
            },
        });
        if (reverse) {
            return res.status(409).json({ error: 'Circular dependencies are not allowed' });
        }
        // Check for duplicate dependency
        const existing = await index_1.prisma.dependency.findUnique({
            where: {
                productId_dependsOnId: {
                    productId: data.productId,
                    dependsOnId: data.dependsOnId,
                },
            },
        });
        if (existing) {
            return res.status(409).json({ error: 'This dependency already exists' });
        }
        const dependency = await index_1.prisma.dependency.create({
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
// GET /api/dependencies/:id
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const dependency = await index_1.prisma.dependency.findUnique({
            where: { id },
            include: {
                product: { include: { category: true } },
                dependsOn: { include: { category: true } },
            },
        });
        if (!dependency) {
            return res.status(404).json({ error: 'Dependency not found' });
        }
        res.json(dependency);
    }
    catch (err) {
        next(err);
    }
});
// PATCH /api/dependencies/:id
router.patch('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const data = updateDependencySchema.parse(req.body);
        const dependency = await index_1.prisma.dependency.update({
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
// DELETE /api/dependencies/:id
router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        await index_1.prisma.dependency.delete({ where: { id } });
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
