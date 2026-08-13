import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAdminAuth } from '../middleware/auth';

const router = Router();

const idParamSchema = z.string().uuid();

const createFlavorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  vcpu: z.number().int().min(0, 'vCPU must be a non-negative integer'),
  ramGb: z.number().int().min(0, 'RAM must be a non-negative integer'),
  description: z.string().optional(),
  productId: z.string().uuid('Invalid product ID'),
});

const updateFlavorSchema = z.object({
  name: z.string().min(1).optional(),
  vcpu: z.number().int().min(0).optional(),
  ramGb: z.number().int().min(0).optional(),
  description: z.string().optional(),
  productId: z.string().uuid().optional(),
});

// GET /api/flavors
router.get('/', async (req, res, next) => {
  try {
    const { productId } = req.query;
    const where: any = {};

    if (productId && typeof productId === 'string') {
      where.productId = productId;
    }

    const flavors = await prisma.flavor.findMany({
      where,
      include: {
        product: { include: { category: true } },
        _count: { select: { forecastLines: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(flavors);
  } catch (err) {
    next(err);
  }
});

// POST /api/flavors
router.post('/', requireAdminAuth, async (req, res, next) => {
  try {
    const data = createFlavorSchema.parse(req.body);

    // Verify product exists
    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const flavor = await prisma.flavor.create({
      data,
      include: {
        product: { include: { category: true } },
      },
    });

    res.status(201).json(flavor);
  } catch (err) {
    next(err);
  }
});

// GET /api/flavors/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const flavor = await prisma.flavor.findUnique({
      where: { id },
      include: {
        product: { include: { category: true } },
        _count: { select: { forecastLines: true } },
      },
    });

    if (!flavor) {
      return res.status(404).json({ error: 'Flavor not found' });
    }

    res.json(flavor);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/flavors/:id
router.patch('/:id', requireAdminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);
    const data = updateFlavorSchema.parse(req.body);

    // If productId is being updated, verify the new product exists
    if (data.productId) {
      const product = await prisma.product.findUnique({ where: { id: data.productId } });
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
    }

    const flavor = await prisma.flavor.update({
      where: { id },
      data,
      include: {
        product: { include: { category: true } },
      },
    });

    res.json(flavor);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/flavors/:id
router.delete('/:id', requireAdminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    idParamSchema.parse(id);

    // Check if flavor has associated forecasts
    const flavor = await prisma.flavor.findUnique({
      where: { id },
      include: { _count: { select: { forecastLines: true } } },
    });

    if (flavor && flavor._count.forecastLines > 0) {
      return res.status(409).json({
        error: 'Cannot delete flavor with existing forecasts. Please delete forecasts first.',
      });
    }

    await prisma.flavor.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as flavorRoutes };
