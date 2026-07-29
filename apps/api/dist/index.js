"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = require("express-rate-limit");
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const products_1 = require("./routes/products");
const categories_1 = require("./routes/categories");
const forecasts_1 = require("./routes/forecasts");
const flavors_1 = require("./routes/flavors");
const dependencies_1 = require("./routes/dependencies");
const users_1 = require("./routes/users");
const admin_1 = require("./routes/admin");
dotenv_1.default.config();
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
exports.prisma = prisma;
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)({ origin: process.env.FRONTEND_URL || '*' }));
app.use((0, helmet_1.default)());
app.use((0, express_rate_limit_1.rateLimit)({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
}));
app.use(express_1.default.json());
// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// API Routes
app.use('/api/products', products_1.productRoutes);
app.use('/api/categories', categories_1.categoryRoutes);
app.use('/api/forecasts', forecasts_1.forecastRoutes);
app.use('/api/flavors', flavors_1.flavorRoutes);
app.use('/api/dependencies', dependencies_1.dependencyRoutes);
app.use('/api/users', users_1.userRoutes);
// Conditional admin API key protection (active only when ADMIN_API_KEY is set)
const adminAuth = (req, res, next) => {
    const key = process.env.ADMIN_API_KEY;
    if (!key)
        return next();
    const provided = req.headers['x-admin-api-key'];
    if (provided !== key) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};
app.use('/api/admin', adminAuth, admin_1.adminRoutes);
// 404 handler
app.use((_req, res) => {
    res.status(404).json({ error: 'Not Found' });
});
// Global error handler
app.use((err, _req, res, _next) => {
    if (res.headersSent) {
        return;
    }
    console.error('Unhandled error:', err.message);
    // Zod validation errors
    if (err instanceof zod_1.ZodError) {
        return res.status(400).json({
            error: 'Validation Error',
            details: err.errors.map((e) => ({
                path: e.path.join('.'),
                message: e.message,
            })),
        });
    }
    // Prisma unique constraint errors
    if (err.code === 'P2002') {
        const target = err.meta?.target ? err.meta.target.join(', ') : 'field';
        return res.status(409).json({
            error: 'Conflict',
            message: `A record with this ${target} already exists`,
        });
    }
    // Prisma foreign key constraint errors
    if (err.code === 'P2003') {
        return res.status(409).json({
            error: 'Constraint Violation',
            message: 'The referenced record does not exist or cannot be modified due to existing relations',
        });
    }
    // Prisma record not found
    if (err.code === 'P2025') {
        return res.status(404).json({
            error: 'Not Found',
            message: err.meta?.cause || 'Record not found',
        });
    }
    const statusCode = err.status || 500;
    const message = statusCode >= 500 ? 'Internal Server Error' : (err.message || 'Internal Server Error');
    res.status(statusCode).json({
        error: message,
    });
});
app.listen(PORT, () => {
    console.log(`🚀 API server running on port ${PORT}`);
});
