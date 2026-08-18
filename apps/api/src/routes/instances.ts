import { Router } from 'express';
import { InstanceStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db';

const router = Router();

const ipSchema = z.string().regex(/^(\d{1,3}\.){3}\d{1,3}$|^([0-9a-fA-F:]+)$/, 'Invalid IP address').optional();
const hostnameSchema = z.string().regex(/^[a-zA-Z0-9][-a-zA-Z0-9.]*[a-zA-Z0-9]$/, 'Invalid hostname').max(253, 'Hostname too long').optional();
const metadataSchema = z.object({
  osVersion: z.string().optional(),
}).catchall(z.unknown()).optional();

const createInstanceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  forecastId: z.string().uuid().optional(),
  applicationId: z.string().uuid(),
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  flavorId: z.string().uuid(),
  azCode: z.string().min(1),
  status: z.enum(['PENDING', 'PROVISIONING', 'RUNNING', 'STOPPED']).default('PENDING'),
  environment: z.enum(['PRD', 'DEV', 'STG']).default('DEV'),
  ipAddress: ipSchema,
  hostname: hostnameSchema,
  metadata: metadataSchema,
});

const updateInstanceSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['PENDING', 'PROVISIONING', 'RUNNING', 'STOPPED', 'TERMINATED']).optional(),
  environment: z.enum(['PRD', 'DEV', 'STG']).optional(),
  variantId: z.string().uuid().optional().nullable(),
  flavorId: z.string().uuid().optional(),
  ipAddress: ipSchema,
  hostname: hostnameSchema,
  startedAt: z.coerce.date().nullable().optional(),
  stoppedAt: z.coerce.date().nullable().optional(),
  terminatedAt: z.coerce.date().nullable().optional(),
  metadata: metadataSchema,
});

const idParamSchema = z.string().uuid();

const instanceInclude = {
  application: { include: { continuityLevel: true } },
  product: { include: { category: true } },
  variant: { include: { os: true, osVersion: true } },
  flavor: true,
  az: true,
  forecast: true,
} as const;

// GET /api/instances
router.get('/', async (req, res, next) => {
  try {
    const querySchema = z.object({
      applicationId: z.string().uuid().optional(),
      productId: z.string().uuid().optional(),
      variantId: z.string().uuid().optional(),
      status: z.enum(['PENDING', 'PROVISIONING', 'RUNNING', 'STOPPED', 'TERMINATED']).optional(),
      environment: z.enum(['PRD', 'DEV', 'STG']).optional(),
    });
    const parsed = querySchema.parse(req.query);
    const where: any = {};
    if (parsed.applicationId) where.applicationId = parsed.applicationId;
    if (parsed.productId) where.productId = parsed.productId;
    if (parsed.variantId) where.variantId = parsed.variantId;
    if (parsed.status) where.status = parsed.status;
    if (parsed.environment) where.environment = parsed.environment;

    const instances = await prisma.instance.findMany({
      where,
      include: instanceInclude,
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
      include: instanceInclude,
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

    const instance = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Validate relations
      const application = await tx.application.findUnique({ where: { id: data.applicationId } });
      if (!application) {
        throw Object.assign(new Error(`Application not found: ${data.applicationId}`), { status: 404 });
      }
      const product = await tx.product.findUnique({
        where: { id: data.productId },
        include: { category: true },
      });
      if (!product) {
        throw Object.assign(new Error(`Product not found: ${data.productId}`), { status: 404 });
      }
      const flavor = await tx.flavor.findUnique({ where: { id: data.flavorId } });
      if (!flavor) {
        throw Object.assign(new Error(`Flavor not found: ${data.flavorId}`), { status: 404 });
      }
      const az = await tx.availabilityZone.findUnique({ where: { code: data.azCode } });
      if (!az) {
        throw Object.assign(new Error(`Availability zone not found: ${data.azCode}`), { status: 404 });
      }
      if (data.forecastId) {
        const forecast = await tx.forecast.findUnique({ where: { id: data.forecastId } });
        if (!forecast) {
          throw Object.assign(new Error(`Forecast not found: ${data.forecastId}`), { status: 404 });
        }
      }

      // Validate variant for compute products
      if (product.category.slug === 'compute') {
        if (!data.variantId) {
          throw Object.assign(new Error('variantId is required for Compute products'), { status: 400 });
        }
        const variant = await tx.productVariant.findFirst({
          where: { id: data.variantId, productId: data.productId },
        });
        if (!variant) {
          throw Object.assign(new Error(`Variant not found for this product`), { status: 404 });
        }
        if (variant.flavorId !== data.flavorId) {
          throw Object.assign(new Error('flavorId does not match the variant\'s flavor'), { status: 400 });
        }
      } else if (data.variantId) {
        throw Object.assign(new Error('variantId can only be set for Compute products'), { status: 400 });
      }

      const createData: any = {
        name: data.name,
        description: data.description,
        forecastId: data.forecastId,
        applicationId: data.applicationId,
        productId: data.productId,
        variantId: data.variantId,
        flavorId: data.flavorId,
        azCode: data.azCode,
        status: data.status,
        environment: data.environment,
        ipAddress: data.ipAddress,
        hostname: data.hostname,
        metadata: data.metadata as any,
      };

      return tx.instance.create({
        data: createData,
        include: instanceInclude,
      });
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

    const existing = await prisma.instance.findUnique({
      where: { id },
      include: { product: { include: { category: true } } },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    if (data.variantId !== undefined) {
      if (existing.product.category.slug === 'compute' && !data.variantId) {
        return res.status(400).json({ error: 'variantId is required for Compute products' });
      }
      if (data.variantId) {
        if (existing.product.category.slug !== 'compute') {
          return res.status(400).json({ error: 'variantId can only be set for Compute products' });
        }
        const variant = await prisma.productVariant.findFirst({
          where: { id: data.variantId, productId: existing.productId },
        });
        if (!variant) {
          return res.status(404).json({ error: 'Variant not found for this product' });
        }
        if (data.flavorId && variant.flavorId !== data.flavorId) {
          return res.status(400).json({ error: 'flavorId does not match the variant\'s flavor' });
        }
      }
    }

    const updatePayload: any = { ...data };
    if (updatePayload.metadata) {
      updatePayload.metadata = updatePayload.metadata as any;
    }
    const updated = await prisma.instance.update({
      where: { id },
      data: updatePayload,
      include: instanceInclude,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/instances/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const existing = await prisma.instance.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    await prisma.instance.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as instanceRoutes };
