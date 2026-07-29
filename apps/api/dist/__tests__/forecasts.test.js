"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
const forecasts_1 = require("../routes/forecasts");
var prismaMock = {};
jest.mock('@prisma/client', () => ({
    PrismaClient: jest.fn().mockImplementation(() => prismaMock),
    ApprovalStatus: {
        PENDING: 'PENDING',
        APPROVED: 'APPROVED',
        REJECTED: 'REJECTED',
    },
}));
function createApp() {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use('/api/forecasts', forecasts_1.forecastRoutes);
    app.use((err, _req, res, _next) => {
        if (err.name === 'ZodError') {
            return res.status(400).json({
                error: 'Validation Error',
                details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
            });
        }
        res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
    });
    return app;
}
describe('Forecast Routes', () => {
    beforeEach(() => {
        prismaMock.forecast = {
            findMany: jest.fn(),
            count: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        };
        jest.clearAllMocks();
    });
    describe('GET /api/forecasts', () => {
        it('should list all forecasts with product and flavor', async () => {
            const forecasts = [
                {
                    id: 'f1',
                    productId: 'p1',
                    flavorId: 'fl1',
                    requestedBy: 'Alice',
                    requesterEmail: 'alice@example.com',
                    quantity: 3,
                    status: 'PENDING',
                    product: { id: 'p1', name: 'VM Debian', category: { id: 'c1', name: 'Compute' } },
                    flavor: { id: 'fl1', name: 'Small', vcpu: 2, ramGb: 4 },
                },
            ];
            prismaMock.forecast.findMany.mockResolvedValue(forecasts);
            const app = createApp();
            const res = await (0, supertest_1.default)(app).get('/api/forecasts');
            expect(res.status).toBe(200);
            expect(res.body).toEqual(forecasts);
            expect(prismaMock.forecast.findMany).toHaveBeenCalledWith({
                include: { product: { include: { category: true } }, flavor: true },
                orderBy: { createdAt: 'desc' },
            });
        });
        it('should return empty array when no forecasts exist', async () => {
            prismaMock.forecast.findMany.mockResolvedValue([]);
            const app = createApp();
            const res = await (0, supertest_1.default)(app).get('/api/forecasts');
            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });
    });
    describe('GET /api/forecasts/stats', () => {
        it('should return correct stats aggregation', async () => {
            prismaMock.forecast.count
                .mockResolvedValueOnce(10)
                .mockResolvedValueOnce(3)
                .mockResolvedValueOnce(5)
                .mockResolvedValueOnce(2);
            const app = createApp();
            const res = await (0, supertest_1.default)(app).get('/api/forecasts/stats');
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ total: 10, pending: 3, approved: 5, rejected: 2 });
            expect(prismaMock.forecast.count).toHaveBeenCalledTimes(4);
            expect(prismaMock.forecast.count).toHaveBeenNthCalledWith(2, { where: { status: 'PENDING' } });
            expect(prismaMock.forecast.count).toHaveBeenNthCalledWith(3, { where: { status: 'APPROVED' } });
            expect(prismaMock.forecast.count).toHaveBeenNthCalledWith(4, { where: { status: 'REJECTED' } });
        });
        it('should handle zero counts', async () => {
            prismaMock.forecast.count.mockResolvedValue(0);
            const app = createApp();
            const res = await (0, supertest_1.default)(app).get('/api/forecasts/stats');
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ total: 0, pending: 0, approved: 0, rejected: 0 });
        });
    });
    describe('POST /api/forecasts', () => {
        it('should create a forecast with valid data', async () => {
            const payload = {
                productId: 'p1',
                flavorId: 'fl1',
                requestedBy: 'Bob',
                requesterEmail: 'bob@example.com',
                quantity: 2,
                justification: 'Need compute',
            };
            const created = { id: 'f-new', ...payload, status: 'PENDING', product: { id: 'p1' }, flavor: { id: 'fl1' } };
            prismaMock.forecast.create.mockResolvedValue(created);
            const app = createApp();
            const res = await (0, supertest_1.default)(app).post('/api/forecasts').send(payload);
            expect(res.status).toBe(201);
            expect(res.body).toEqual(created);
            expect(prismaMock.forecast.create).toHaveBeenCalledWith({
                data: payload,
                include: { product: true, flavor: true },
            });
        });
        it('should reject invalid email', async () => {
            const payload = {
                productId: 'p1',
                flavorId: 'fl1',
                requestedBy: 'Bob',
                requesterEmail: 'not-an-email',
                quantity: 1,
            };
            const app = createApp();
            const res = await (0, supertest_1.default)(app).post('/api/forecasts').send(payload);
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Validation Error');
        });
        it('should reject zero quantity', async () => {
            const payload = {
                productId: 'p1',
                flavorId: 'fl1',
                requestedBy: 'Bob',
                requesterEmail: 'bob@example.com',
                quantity: 0,
            };
            const app = createApp();
            const res = await (0, supertest_1.default)(app).post('/api/forecasts').send(payload);
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Validation Error');
        });
        it('should reject missing required fields', async () => {
            const payload = { productId: 'p1', flavorId: 'fl1' };
            const app = createApp();
            const res = await (0, supertest_1.default)(app).post('/api/forecasts').send(payload);
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Validation Error');
        });
        it('should reject invalid UUID for productId', async () => {
            const payload = {
                productId: 'not-a-uuid',
                flavorId: 'fl1',
                requestedBy: 'Bob',
                requesterEmail: 'bob@example.com',
                quantity: 1,
            };
            const app = createApp();
            const res = await (0, supertest_1.default)(app).post('/api/forecasts').send(payload);
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Validation Error');
        });
    });
    describe('PATCH /api/forecasts/:id', () => {
        it('should approve a forecast and set reviewedAt', async () => {
            const id = 'f1';
            const payload = { status: 'APPROVED', reviewedBy: 'Admin' };
            const updated = {
                id,
                status: 'APPROVED',
                reviewedBy: 'Admin',
                reviewedAt: '2024-01-01T00:00:00.000Z',
                product: { id: 'p1' },
                flavor: { id: 'fl1' },
            };
            prismaMock.forecast.update.mockResolvedValue(updated);
            const app = createApp();
            const res = await (0, supertest_1.default)(app).patch(`/api/forecasts/${id}`).send(payload);
            expect(res.status).toBe(200);
            expect(res.body).toEqual(updated);
            expect(prismaMock.forecast.update).toHaveBeenCalledWith({
                where: { id },
                data: {
                    status: 'APPROVED',
                    reviewedBy: 'Admin',
                    reviewedAt: expect.any(Date),
                    rejectionReason: null,
                },
                include: { product: true, flavor: true },
            });
        });
        it('should reject a forecast with rejectionReason', async () => {
            const id = 'f1';
            const payload = { status: 'REJECTED', reviewedBy: 'Admin', rejectionReason: 'Budget exceeded' };
            const updated = {
                id,
                status: 'REJECTED',
                reviewedBy: 'Admin',
                reviewedAt: '2024-01-01T00:00:00.000Z',
                rejectionReason: 'Budget exceeded',
                product: { id: 'p1' },
                flavor: { id: 'fl1' },
            };
            prismaMock.forecast.update.mockResolvedValue(updated);
            const app = createApp();
            const res = await (0, supertest_1.default)(app).patch(`/api/forecasts/${id}`).send(payload);
            expect(res.status).toBe(200);
            expect(res.body.rejectionReason).toBe('Budget exceeded');
        });
        it('should reject invalid status enum', async () => {
            const payload = { status: 'UNKNOWN', reviewedBy: 'Admin' };
            const app = createApp();
            const res = await (0, supertest_1.default)(app).patch('/api/forecasts/f1').send(payload);
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Validation Error');
        });
        it('should reject missing reviewedBy', async () => {
            const payload = { status: 'APPROVED' };
            const app = createApp();
            const res = await (0, supertest_1.default)(app).patch('/api/forecasts/f1').send(payload);
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Validation Error');
        });
    });
    describe('DELETE /api/forecasts/:id', () => {
        it('should delete a forecast', async () => {
            prismaMock.forecast.delete.mockResolvedValue({});
            const app = createApp();
            const res = await (0, supertest_1.default)(app).delete('/api/forecasts/f1');
            expect(res.status).toBe(204);
            expect(prismaMock.forecast.delete).toHaveBeenCalledWith({ where: { id: 'f1' } });
        });
        it('should propagate not-found errors', async () => {
            const err = new Error('Record not found');
            err.code = 'P2025';
            prismaMock.forecast.delete.mockRejectedValue(err);
            const app = createApp();
            const res = await (0, supertest_1.default)(app).delete('/api/forecasts/nonexistent');
            expect(res.status).toBe(500);
        });
    });
});
