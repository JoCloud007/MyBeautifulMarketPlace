"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.forecastRoutes = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const index_1 = require("../index");
const router = (0, express_1.Router)();
exports.forecastRoutes = router;
const createForecastSchema = zod_1.z.object({
    productId: zod_1.z.string().uuid(),
    flavorId: zod_1.z.string().uuid(),
    requestedBy: zod_1.z.string().min(1),
    requesterEmail: zod_1.z.string().email(),
    quantity: zod_1.z.number().int().min(1),
    justification: zod_1.z.string().optional(),
});
const idParamSchema = zod_1.z.string().uuid();
const updateForecastSchema = zod_1.z.object({
    status: zod_1.z.enum(['PENDING', 'APPROVED', 'REJECTED']),
    reviewedBy: zod_1.z.string().min(1),
    rejectionReason: zod_1.z.string().optional(),
}).refine((data) => {
    if (data.status === 'REJECTED') {
        return !!data.rejectionReason && data.rejectionReason.trim().length > 0;
    }
    return true;
}, {
    message: 'rejectionReason is required when status is REJECTED',
    path: ['rejectionReason'],
});
// GET /api/forecasts
router.get('/', async (_req, res, next) => {
    try {
        const forecasts = await index_1.prisma.forecast.findMany({
            include: { product: { include: { category: true } }, flavor: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(forecasts);
    }
    catch (err) {
        next(err);
    }
});
// GET /api/forecasts/stats
router.get('/stats', async (_req, res, next) => {
    try {
        const [total, pending, approved, rejected] = await Promise.all([
            index_1.prisma.forecast.count(),
            index_1.prisma.forecast.count({ where: { status: client_1.ApprovalStatus.PENDING } }),
            index_1.prisma.forecast.count({ where: { status: client_1.ApprovalStatus.APPROVED } }),
            index_1.prisma.forecast.count({ where: { status: client_1.ApprovalStatus.REJECTED } }),
        ]);
        res.json({ total, pending, approved, rejected });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/forecasts
router.post('/', async (req, res, next) => {
    try {
        const data = createForecastSchema.parse(req.body);
        // Verify that the flavor belongs to the product
        const flavor = await index_1.prisma.flavor.findUnique({ where: { id: data.flavorId } });
        if (!flavor) {
            return res.status(404).json({ error: 'Flavor not found' });
        }
        if (flavor.productId !== data.productId) {
            return res.status(409).json({ error: 'The selected flavor does not belong to the specified product' });
        }
        const forecast = await index_1.prisma.forecast.create({
            data,
            include: { product: true, flavor: true },
        });
        res.status(201).json(forecast);
    }
    catch (err) {
        next(err);
    }
});
// PATCH /api/forecasts/:id
router.patch('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const data = updateForecastSchema.parse(req.body);
        const forecast = await index_1.prisma.forecast.update({
            where: { id },
            data: {
                status: data.status,
                reviewedBy: data.reviewedBy,
                reviewedAt: new Date(),
                rejectionReason: data.rejectionReason || null,
            },
            include: { product: true, flavor: true },
        });
        res.json(forecast);
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/forecasts/:id
router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        await index_1.prisma.forecast.delete({ where: { id } });
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
