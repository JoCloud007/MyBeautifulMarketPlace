"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRoutes = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const index_1 = require("../index");
const router = (0, express_1.Router)();
exports.userRoutes = router;
const idParamSchema = zod_1.z.string().uuid();
const createUserSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    name: zod_1.z.string().min(1, 'Name is required'),
    role: zod_1.z.enum([client_1.UserRole.USER]).optional(),
});
const updateUserSchema = zod_1.z.object({
    email: zod_1.z.string().email().optional(),
    name: zod_1.z.string().min(1).optional(),
    role: zod_1.z.enum([client_1.UserRole.ADMIN, client_1.UserRole.USER]).optional(),
});
// GET /api/users
router.get('/', async (_req, res, next) => {
    try {
        const users = await index_1.prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
        });
        res.json(users);
    }
    catch (err) {
        next(err);
    }
});
// POST /api/users
router.post('/', async (req, res, next) => {
    try {
        const data = createUserSchema.parse(req.body);
        // Check for duplicate email
        const existing = await index_1.prisma.user.findUnique({ where: { email: data.email } });
        if (existing) {
            return res.status(409).json({ error: 'Email already in use' });
        }
        const user = await index_1.prisma.user.create({ data });
        res.status(201).json(user);
    }
    catch (err) {
        next(err);
    }
});
// GET /api/users/:id
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = await index_1.prisma.user.findUnique({ where: { id } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    }
    catch (err) {
        next(err);
    }
});
// PATCH /api/users/:id
router.patch('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        idParamSchema.parse(id);
        const data = updateUserSchema.parse(req.body);
        // Check for duplicate email if updating email
        if (data.email) {
            const existing = await index_1.prisma.user.findUnique({ where: { email: data.email } });
            if (existing && existing.id !== id) {
                return res.status(409).json({ error: 'Email already in use' });
            }
        }
        const user = await index_1.prisma.user.update({ where: { id }, data });
        res.json(user);
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/users/:id
router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        idParamSchema.parse(id);
        await index_1.prisma.user.delete({ where: { id } });
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
