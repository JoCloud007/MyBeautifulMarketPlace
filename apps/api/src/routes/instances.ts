import { Router } from 'express';
import { InstanceStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db';

const router = Router();

const createInstanceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  forecastId: z.string().uuid().optional(),
  applicationId: z.string().uuid(),
  productId: z.string().uuid(),
  flavorId: z.string().uuid(),
  azCode: z.string().min(1),
  status: z.enum(['PENDING', 'PROVISIONING', 'RUNNING', 'STOPPED', 'TERMINATED']).default('PENDING'),
  environment: z.enum(['PRD', 'DEV', 'STG']).default('DEV'),
  ipAddress: z.string().optional(),
  hostname: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const updateInstanceSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['PENDING', 'PROVISIONING', 'RUNNING', 'STOPPED', 'TERMINATED']).optional(),
  environment: z.enum(['PRD', 'DEV', 'STG']).optional(),
  ipAddress: z.string().optional(),
  hostname: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const idParamSchema = z.string().uuid();

// GET /api/instances
router.get('/', async (req, res, next) => {
  try {
    const { applicationId, productId, status, environment } = req.query;
    const where: any = {};
    if (applicationId) where.applicationId = String(applicationId);
    if (productId) where.productId = String(productId);
    if (status) where.status = String(status);
    if (environment) where.environment = String(environment);

    const instances = await prisma.instance.findMany({
      where,
      include: {
        application: { include: { continuityLevel: true } },
        product: { include: { category: true } },
        flavor: true,
        az: true,
        forecast: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(instances);
  } catch (err) {
    next(err);
  }
});

// GET /api/instances/stats
router.get('/stats', async (_req, res, next) => {
  try {
    const [total, pending, provisioning, running, stopped, terminated] = await Promise.all([
      prisma.instance.count(),
      prisma.instance.count({ where: { status: InstanceStatus.PENDING } }),
      prisma.instance.count({ where: { status: InstanceStatus.PROVISIONING } }),
      prisma.instance.count({ where: { status: InstanceStatus.RUNNING } }),
      prisma.instance.count({ where: { status: InstanceStatus.STOPPED } }),
      prisma.instance.count({ where: { status: InstanceStatus.TERMINATED } }),
    ]);

    res.json({ total, pending, provisioning, running, stopped, terminated });
  } catch (err) {
    next(err);
  }
});

// GET /api/instances/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const instance = await prisma.instance.findUnique({
      where: { id },
      include: {
        application: { include: { continuityLevel: true } },
        product: { include: { category: true } },
        flavor: true,
        az: true,
        forecast: true,
      },
    });
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    res.json(instance);
  } catch (err) {
    next(err);
  }
});

// POST /api/instances
router.post('/', async (req, res, next) => {
  try {
    const data = createInstanceSchema.parse(req.body);

    // Validate relations
    const application = await prisma.application.findUnique({ where: { id: data.applicationId } });
    if (!application) {
      return res.status(404).json({ error: `Application not found: ${data.applicationId}` });
    }
    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    if (!product) {
      return res.status(404).json({ error: `Product not found: ${data.productId}` });
    }
    const flavor = await prisma.flavor.findUnique({ where: { id: data.flavorId } });
    if (!flavor) {
      return res.status(404).json({ error: `Flavor not found: ${data.flavorId}` });
    }
    if (flavor.productId !== data.productId) {
      return res.status(409).json({ error: `Flavor ${data.flavorId} does not belong to product ${data.productId}` });
    }
    const az = await prisma.availabilityZone.findUnique({ where: { code: data.azCode } });
    if (!az) {
      return res.status(404).json({ error: `Availability zone not found: ${data.azCode}` });
    }
    if (data.forecastId) {
      const forecast = await prisma.forecast.findUnique({ where: { id: data.forecastId } });
      if (!forecast) {
        return res.status(404).json({ error: `Forecast not found: ${data.forecastId}` });
      }
    }

    const instance = await prisma.instance.create({
      data: {
        name: data.name,
        description: data.description,
        forecastId: data.forecastId,
        applicationId: data.applicationId,
        productId: data.productId,
        flavorId: data.flavorId,
        azCode: data.azCode,
        status: data.status,
        environment: data.environment,
        ipAddress: data.ipAddress,
        hostname: data.hostname,
        metadata: data.metadata,
      },
      include: {
        application: { include: { continuityLevel: true } },
        product: { include: { category: true } },
        flavor: true,
        az: true,
        forecast: true,
      },
    });
    res.status(201).json(instance);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/instances/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const data = updateInstanceSchema.parse(req.body);

    const instance = await prisma.instance.update({
      where: { id },
      data,
      include: {
        application: { include: { continuityLevel: true } },
        product: { include: { category: true } },
        flavor: true,
        az: true,
        forecast: true,
      },
    });

    res.json(instance);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/instances/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    await prisma.instance.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as instanceRoutes };
