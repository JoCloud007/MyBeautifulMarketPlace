"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.forecastRoutes = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const db_1 = require("../db");
const router = (0, express_1.Router)();
exports.forecastRoutes = router;
const forecastLineSchema = zod_1.z.object({
    productId: zod_1.z.string().uuid(),
    flavorId: zod_1.z.string().uuid(),
    azCode: zod_1.z.string().min(1),
    quantity: zod_1.z.number().int().min(1),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
});
const createForecastSchema = zod_1.z.object({
    requestedBy: zod_1.z.string().min(1),
    requesterEmail: zod_1.z.string().email(),
    targetDate: zod_1.z.string().datetime().optional(),
    lines: zod_1.z.array(forecastLineSchema).min(1),
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
// GET /api/forecasts/stats
router.get('/stats', async (_req, res, next) => {
    try {
        const [total, pending, approved, rejected] = await Promise.all([
            db_1.prisma.forecast.count(),
            db_1.prisma.forecast.count({ where: { status: client_1.ApprovalStatus.PENDING } }),
            db_1.prisma.forecast.count({ where: { status: client_1.ApprovalStatus.APPROVED } }),
            db_1.prisma.forecast.count({ where: { status: client_1.ApprovalStatus.REJECTED } }),
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
        for (const line of data.lines) {
            const flavor = await db_1.prisma.flavor.findUnique({ where: { id: line.flavorId } });
            if (!flavor) {
                return res.status(404).json({ error: `Flavor not found: ${line.flavorId}` });
            }
            if (flavor.productId !== line.productId) {
                return res.status(409).json({ error: `Flavor ${line.flavorId} does not belong to product ${line.productId}` });
            }
            const az = await db_1.prisma.availabilityZone.findUnique({ where: { code: line.azCode } });
            if (!az) {
                return res.status(404).json({ error: `Availability zone not found: ${line.azCode}` });
            }
            const offered = await db_1.prisma.productAvailabilityZone.findFirst({
                where: { productId: line.productId, availabilityZoneId: az.id },
            });
            if (!offered) {
                return res.status(409).json({ error: `Product ${line.productId} is not available in zone ${line.azCode}` });
            }
        }
        const forecast = await db_1.prisma.forecast.create({
            data: {
                requestedBy: data.requestedBy,
                requesterEmail: data.requesterEmail,
                targetDate: data.targetDate ? new Date(data.targetDate) : null,
                justification: data.justification,
                lines: {
                    create: data.lines.map((line) => ({
                        productId: line.productId,
                        flavorId: line.flavorId,
                        azCode: line.azCode,
                        quantity: line.quantity,
                        metadata: line.metadata || undefined,
                    })),
                },
            },
            include: { lines: { include: { product: true, flavor: true } } },
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
        idParamSchema.parse(id);
        const data = updateForecastSchema.parse(req.body);
        const forecast = await db_1.prisma.forecast.update({
            where: { id },
            data: {
                status: data.status,
                reviewedBy: data.reviewedBy,
                reviewedAt: new Date(),
                rejectionReason: data.rejectionReason || null,
            },
            include: { lines: { include: { product: true, flavor: true } } },
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
        idParamSchema.parse(id);
        await db_1.prisma.forecast.delete({ where: { id } });
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
