"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.availabilityZoneRoutes = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../db");
const router = (0, express_1.Router)();
exports.availabilityZoneRoutes = router;
const createAZSchema = zod_1.z.object({
    code: zod_1.z.string().min(1, 'Code is required').max(100),
    name: zod_1.z.string().min(1, 'Name is required').max(100),
    city: zod_1.z.string().min(1, 'City is required').max(100),
    country: zod_1.z.string().min(1, 'Country is required').max(100),
    region: zod_1.z.string().min(1, 'Region is required').max(100),
    latitude: zod_1.z.number().min(-90).max(90),
    longitude: zod_1.z.number().min(-180).max(180),
    isActive: zod_1.z.boolean().optional(),
});
const updateAZSchema = createAZSchema.partial();
const idParamSchema = zod_1.z.string().uuid();
// GET /api/availability-zones
router.get('/', async (_req, res, next) => {
    try {
        const zones = await db_1.prisma.availabilityZone.findMany({
            include: {
                productAvailabilities: {
                    include: { product: { select: { id: true, name: true, slug: true } } },
                },
            },
            orderBy: { region: 'asc' },
        });
        res.json(zones);
    }
    catch (err) {
        next(err);
    }
});
// GET /api/availability-zones/:id
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        idParamSchema.parse(id);
        const zone = await db_1.prisma.availabilityZone.findUnique({
            where: { id },
            include: {
                productAvailabilities: {
                    include: { product: { select: { id: true, name: true, slug: true } } },
                },
            },
        });
        if (!zone) {
            return res.status(404).json({ error: 'Availability zone not found' });
        }
        res.json(zone);
    }
    catch (err) {
        next(err);
    }
});
// POST /api/availability-zones
router.post('/', async (req, res, next) => {
    try {
        const data = createAZSchema.parse(req.body);
        const existing = await db_1.prisma.availabilityZone.findUnique({ where: { code: data.code } });
        if (existing) {
            return res.status(409).json({ error: 'An availability zone with this code already exists' });
        }
        const zone = await db_1.prisma.availabilityZone.create({
            data,
            include: {
                productAvailabilities: {
                    include: { product: { select: { id: true, name: true, slug: true } } },
                },
            },
        });
        res.status(201).json(zone);
    }
    catch (err) {
        next(err);
    }
});
// PATCH /api/availability-zones/:id
router.patch('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        idParamSchema.parse(id);
        const data = updateAZSchema.parse(req.body);
        if (data.code) {
            const existing = await db_1.prisma.availabilityZone.findUnique({ where: { code: data.code } });
            if (existing && existing.id !== id) {
                return res.status(409).json({ error: 'An availability zone with this code already exists' });
            }
        }
        const zone = await db_1.prisma.availabilityZone.update({
            where: { id },
            data,
            include: {
                productAvailabilities: {
                    include: { product: { select: { id: true, name: true, slug: true } } },
                },
            },
        });
        res.json(zone);
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/availability-zones/:id
router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        idParamSchema.parse(id);
        // Check for linked products
        const zone = await db_1.prisma.availabilityZone.findUnique({
            where: { id },
            include: { _count: { select: { productAvailabilities: true } } },
        });
        if (!zone) {
            return res.status(404).json({ error: 'Availability zone not found' });
        }
        if (zone._count.productAvailabilities > 0) {
            return res.status(409).json({
                error: 'Cannot delete availability zone with linked products. Please remove product associations first.',
            });
        }
        await db_1.prisma.availabilityZone.delete({ where: { id } });
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
