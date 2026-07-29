"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
var prismaMock = {};
jest.mock('@prisma/client', () => ({
    PrismaClient: jest.fn().mockImplementation(() => {
        console.log('PrismaClient constructor called');
        return prismaMock;
    }),
    ApprovalStatus: { PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED' },
}));
const forecasts_1 = require("../routes/forecasts");
function createApp() {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use('/api/forecasts', forecasts_1.forecastRoutes);
    app.use((err, _req, res, _next) => {
        console.error('ROUTE ERROR:', err.message);
        res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
    });
    return app;
}
test('debug forecast route', async () => {
    prismaMock.forecast = {
        findMany: jest.fn().mockResolvedValue([{ id: 'f1' }]),
    };
    console.log('prismaMock before request:', prismaMock);
    const app = createApp();
    const res = await (0, supertest_1.default)(app).get('/api/forecasts');
    console.log('Response status:', res.status);
    console.log('Response body:', res.body);
    console.log('findMany calls:', prismaMock.forecast.findMany.mock?.calls?.length);
});
