"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.flavorRoutes = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../db");
const router = (0, express_1.Router)();
exports.flavorRoutes = router;
const idParamSchema = zod_1.z.string().uuid();
const createFlavorSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    vcpu: zod_1.z.number().int().min(0, 'vCPU must be a non-negative integer'),
    ramGb: zod_1.z.number().int().min(0, 'RAM must be a non-negative integer'),
    description: zod_1.z.string().optional(),
    productId: zod_1.z.string().uuid('Invalid product ID'),
});
const updateFlavorSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    vcpu: zod_1.z.number().int().min(0).optional(),
    ramGb: zod_1.z.number().int().min(0).optional(),
    description: zod_1.z.string().optional(),
    productId: zod_1.z.string().uuid().optional(),
});
// GET /api/flavors
router.get('/', async (req, res, next) => {
    try {
        const { productId } = req.query;
        const where = {};
        if (productId && typeof productId === 'string') {
            where.productId = productId;
        }
        const flavors = await db_1.prisma.flavor.findMany({
            where,
            include: {
                product: { include: { category: true } },
                _count: { select: { forecastLines: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(flavors);
    }
    catch (err) {
        next(err);
    }
});
// POST /api/flavors
router.post('/', async (req, res, next) => {
    try {
        const data = createFlavorSchema.parse(req.body);
        // Verify product exists
        const product = await db_1.prisma.product.findUnique({ where: { id: data.productId } });
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        const flavor = await db_1.prisma.flavor.create({
            data,
            include: {
                product: { include: { category: true } },
            },
        });
        res.status(201).json(flavor);
    }
    catch (err) {
        next(err);
    }
});
// GET /api/flavors/:id
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const flavor = await db_1.prisma.flavor.findUnique({
            where: { id },
            include: {
                product: { include: { category: true } },
                _count: { select: { forecastLines: true } },
            },
        });
        if (!flavor) {
            return res.status(404).json({ error: 'Flavor not found' });
        }
        res.json(flavor);
    }
    catch (err) {
        next(err);
    }
});
// PATCH /api/flavors/:id
router.patch('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        idParamSchema.parse(id);
        const data = updateFlavorSchema.parse(req.body);
        // If productId is being updated, verify the new product exists
        if (data.productId) {
            const product = await db_1.prisma.product.findUnique({ where: { id: data.productId } });
            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }
        }
        const flavor = await db_1.prisma.flavor.update({
            where: { id },
            data,
            include: {
                product: { include: { category: true } },
            },
        });
        res.json(flavor);
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/flavors/:id
router.delete('/:id', async (req, res, next) => {
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
