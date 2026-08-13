import { Router } from 'express';
import { prisma } from '../db';

const router = Router();

// GET /api/topology
// Returns an interactive graph of App-to-App & App-to-Product dependencies
router.get('/', async (_req, res, next) => {
  try {
    // Fetch all applications with continuity levels and instance counts
    const applications = await prisma.application.findMany({
      take: 5000,
      include: {
        continuityLevel: true,
        _count: { select: { instances: true } },
      },
    });

    // Fetch all products with categories
    const products = await prisma.product.findMany({
      take: 5000,
      include: {
        category: true,
        _count: { select: { instances: true } },
      },
    });

    // Fetch all instances (for app-to-product edges)
    const instances = await prisma.instance.findMany({
      take: 5000,
      select: {
        applicationId: true,
        productId: true,
      },
    });

    // Fetch all product dependencies (for product-to-product edges)
    const dependencies = await prisma.dependency.findMany({
      take: 5000,
      select: {
        id: true,
        productId: true,
        dependsOnId: true,
        type: true,
      },
    });

    // Build nodes
    const nodes = [
      ...applications.map((app) => ({
        id: app.id,
        name: app.name,
        type: 'APPLICATION' as const,
        continuityLevel: app.continuityLevel?.name ?? 'LOW',
        continuityColor: app.continuityLevel?.color ?? 'green',
        instanceCount: app._count.instances,
      })),
      ...products.map((product) => ({
        id: product.id,
        name: product.name,
        type: 'PRODUCT' as const,
        category: product.category.name,
        instanceCount: product._count.instances,
      })),
    ];

    // Build edges
    const edges: { id: string; source: string; target: string; type: 'INSTANCE' | 'DEPENDENCY' | 'RELATED'; label?: string }[] = [];

    // App-to-Product edges (from instances)
    const instanceEdgeSet = new Set<string>();
    for (const inst of instances) {
      const key = `${inst.applicationId}-${inst.productId}`;
      if (!instanceEdgeSet.has(key)) {
        instanceEdgeSet.add(key);
        edges.push({
          id: `inst-${inst.applicationId}-${inst.productId}`,
          source: inst.applicationId,
          target: inst.productId,
          type: 'INSTANCE',
          label: 'uses',
        });
      }
    }

    // Product-to-Product edges (from dependencies)
    for (const dep of dependencies) {
      edges.push({
        id: `dep-${dep.id}`,
        source: dep.productId,
        target: dep.dependsOnId,
        type: 'DEPENDENCY',
        label: dep.type.toLowerCase(),
      });
    }

    // App-to-App edges (derived: apps sharing a product are related)
    const productToApps = new Map<string, string[]>();
    for (const inst of instances) {
      const list = productToApps.get(inst.productId) || [];
      if (!list.includes(inst.applicationId)) {
        list.push(inst.applicationId);
      }
      productToApps.set(inst.productId, list);
    }

    const relatedEdgeSet = new Set<string>();
    for (const [, appIds] of productToApps) {
      if (appIds.length > 1) {
        for (let i = 0; i < appIds.length; i++) {
          for (let j = i + 1; j < appIds.length; j++) {
            const a = appIds[i];
            const b = appIds[j];
            const key = a < b ? `${a}-${b}` : `${b}-${a}`;
            if (!relatedEdgeSet.has(key)) {
              relatedEdgeSet.add(key);
              edges.push({
                id: `rel-${key}`,
                source: a,
                target: b,
                type: 'RELATED',
                label: 'shared product',
              });
            }
          }
        }
      }
    }

    res.json({ nodes, edges });
  } catch (err) {
    next(err);
  }
});

export { router as topologyRoutes };
