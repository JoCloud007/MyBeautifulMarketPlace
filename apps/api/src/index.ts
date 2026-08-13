import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { ZodError } from 'zod';

import { productRoutes } from './routes/products';
import { categoryRoutes } from './routes/categories';
import { forecastRoutes } from './routes/forecasts';
import { flavorRoutes } from './routes/flavors';
import { dependencyRoutes } from './routes/dependencies';
import { userRoutes } from './routes/users';
import { adminRoutes } from './routes/admin';
import { availabilityZoneRoutes } from './routes/availability-zones';
import { applicationRoutes } from './routes/applications';
import { continuityLevelRoutes } from './routes/continuity-levels';
import { instanceRoutes } from './routes/instances';
import { healthCheckRoutes } from './routes/health-checks';
import { maintenanceWindowRoutes } from './routes/maintenance-windows';
import { startCronJobs } from './cron';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], connectSrc: ["'self'", "http://localhost:3001", "http://127.0.0.1:3001"] } } }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
}));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/forecasts', forecastRoutes);
app.use('/api/flavors', flavorRoutes);
app.use('/api/dependencies', dependencyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/availability-zones', availabilityZoneRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/continuity-levels', continuityLevelRoutes);
app.use('/api/instances', instanceRoutes);
app.use('/api/health-checks', healthCheckRoutes);
app.use('/api/maintenance-windows', maintenanceWindowRoutes);

// Conditional admin API key protection (active only when ADMIN_API_KEY is set)
const adminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const key = process.env.ADMIN_API_KEY;
  if (!key) return next();
  const provided = req.headers['x-admin-api-key'];
  if (provided !== key) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};
app.use('/api/admin', adminAuth, adminRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (res.headersSent) {
    return;
  }

  console.error('Unhandled error:', err.message);

  // Zod validation errors
  if (err instanceof ZodError) {
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
  startCronJobs();
});

export { prisma };
