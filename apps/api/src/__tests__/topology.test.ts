import request from 'supertest';
import express from 'express';

var prismaMock: any = {};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => prismaMock),
}));

import { topologyRoutes } from '../routes/topology';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/topology', topologyRoutes);
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
  });
  return app;
}

describe('Topology Routes', () => {
  beforeEach(() => {
    prismaMock.application = {
      findMany: jest.fn(),
    };
    prismaMock.product = {
      findMany: jest.fn(),
    };
    prismaMock.instance = {
      findMany: jest.fn(),
    };
    prismaMock.dependency = {
      findMany: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe('GET /api/topology', () => {
    it('should return nodes and edges for the dependency graph', async () => {
      prismaMock.application.findMany.mockResolvedValue([
        {
          id: 'app-1',
          name: 'E-Commerce',
          continuityLevel: { name: 'SERIOUS', color: 'orange' },
          _count: { instances: 2 },
        },
        {
          id: 'app-2',
          name: 'Analytics',
          continuityLevel: { name: 'MODERATE', color: 'yellow' },
          _count: { instances: 1 },
        },
      ]);

      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          name: 'VM Debian 12',
          category: { name: 'Compute' },
          _count: { instances: 2 },
        },
        {
          id: 'prod-2',
          name: 'Object Storage',
          category: { name: 'Data' },
          _count: { instances: 1 },
        },
      ]);

      prismaMock.instance.findMany.mockResolvedValue([
        { applicationId: 'app-1', productId: 'prod-1' },
        { applicationId: 'app-1', productId: 'prod-2' },
        { applicationId: 'app-2', productId: 'prod-1' },
      ]);

      prismaMock.dependency.findMany.mockResolvedValue([
        { id: 'dep-1', productId: 'prod-1', dependsOnId: 'prod-2', type: 'REQUIRED' },
      ]);

      const app = createApp();
      const res = await request(app).get('/api/topology');

      expect(res.status).toBe(200);
      expect(res.body.nodes).toHaveLength(4);
      expect(res.body.edges).toHaveLength(5); // 3 instance + 1 dependency + 1 related (app-1 & app-2 share prod-1)

      const appNodes = res.body.nodes.filter((n: any) => n.type === 'APPLICATION');
      const productNodes = res.body.nodes.filter((n: any) => n.type === 'PRODUCT');
      expect(appNodes).toHaveLength(2);
      expect(productNodes).toHaveLength(2);

      expect(appNodes[0]).toMatchObject({
        id: 'app-1',
        name: 'E-Commerce',
        type: 'APPLICATION',
        continuityLevel: 'SERIOUS',
        continuityColor: 'orange',
        instanceCount: 2,
      });

      expect(productNodes[0]).toMatchObject({
        id: 'prod-1',
        name: 'VM Debian 12',
        type: 'PRODUCT',
        category: 'Compute',
        instanceCount: 2,
      });

      const instanceEdges = res.body.edges.filter((e: any) => e.type === 'INSTANCE');
      const dependencyEdges = res.body.edges.filter((e: any) => e.type === 'DEPENDENCY');
      const relatedEdges = res.body.edges.filter((e: any) => e.type === 'RELATED');

      expect(instanceEdges).toHaveLength(3);
      expect(dependencyEdges).toHaveLength(1);
      expect(relatedEdges).toHaveLength(1);

      expect(instanceEdges[0]).toMatchObject({
        source: 'app-1',
        target: 'prod-1',
        type: 'INSTANCE',
        label: 'uses',
      });

      expect(dependencyEdges[0]).toMatchObject({
        source: 'prod-1',
        target: 'prod-2',
        type: 'DEPENDENCY',
        label: 'required',
      });
    });

    it('should return empty topology when no data exists', async () => {
      prismaMock.application.findMany.mockResolvedValue([]);
      prismaMock.product.findMany.mockResolvedValue([]);
      prismaMock.instance.findMany.mockResolvedValue([]);
      prismaMock.dependency.findMany.mockResolvedValue([]);

      const app = createApp();
      const res = await request(app).get('/api/topology');

      expect(res.status).toBe(200);
      expect(res.body.nodes).toEqual([]);
      expect(res.body.edges).toEqual([]);
    });

    it('should not duplicate instance edges for multiple instances of same app-product pair', async () => {
      prismaMock.application.findMany.mockResolvedValue([
        { id: 'app-1', name: 'App', continuityLevel: { name: 'LOW', color: 'green' }, _count: { instances: 2 } },
      ]);
      prismaMock.product.findMany.mockResolvedValue([
        { id: 'prod-1', name: 'Product', category: { name: 'Compute' }, _count: { instances: 2 } },
      ]);
      prismaMock.instance.findMany.mockResolvedValue([
        { applicationId: 'app-1', productId: 'prod-1' },
        { applicationId: 'app-1', productId: 'prod-1' },
      ]);
      prismaMock.dependency.findMany.mockResolvedValue([]);

      const app = createApp();
      const res = await request(app).get('/api/topology');

      expect(res.status).toBe(200);
      const instanceEdges = res.body.edges.filter((e: any) => e.type === 'INSTANCE');
      expect(instanceEdges).toHaveLength(1);
    });

    it('should handle errors gracefully', async () => {
      prismaMock.application.findMany.mockRejectedValue(new Error('Database error'));

      const app = createApp();
      const res = await request(app).get('/api/topology');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Database error');
    });

    it('should deduplicate related edges when 3+ apps share a product', async () => {
      prismaMock.application.findMany.mockResolvedValue([
        { id: 'app-1', name: 'App1', continuityLevel: { name: 'LOW', color: 'green' }, _count: { instances: 1 } },
        { id: 'app-2', name: 'App2', continuityLevel: { name: 'LOW', color: 'green' }, _count: { instances: 1 } },
        { id: 'app-3', name: 'App3', continuityLevel: { name: 'LOW', color: 'green' }, _count: { instances: 1 } },
      ]);
      prismaMock.product.findMany.mockResolvedValue([
        { id: 'prod-1', name: 'Shared', category: { name: 'Compute' }, _count: { instances: 3 } },
      ]);
      prismaMock.instance.findMany.mockResolvedValue([
        { applicationId: 'app-1', productId: 'prod-1' },
        { applicationId: 'app-2', productId: 'prod-1' },
        { applicationId: 'app-3', productId: 'prod-1' },
      ]);
      prismaMock.dependency.findMany.mockResolvedValue([]);

      const app = createApp();
      const res = await request(app).get('/api/topology');

      expect(res.status).toBe(200);
      // C(3,2) = 3 related edges
      const relatedEdges = res.body.edges.filter((e: any) => e.type === 'RELATED');
      expect(relatedEdges).toHaveLength(3);
      // Verify no duplicate pairs
      const pairs = new Set(relatedEdges.map((e: any) => {
        const sorted = [e.source, e.target].sort();
        return `${sorted[0]}-${sorted[1]}`;
      }));
      expect(pairs.size).toBe(3);
    });

    it('should handle different dependency types (REQUIRED vs RECOMMENDED)', async () => {
      prismaMock.application.findMany.mockResolvedValue([]);
      prismaMock.product.findMany.mockResolvedValue([
        { id: 'prod-1', name: 'A', category: { name: 'Compute' }, _count: { instances: 0 } },
        { id: 'prod-2', name: 'B', category: { name: 'Data' }, _count: { instances: 0 } },
      ]);
      prismaMock.instance.findMany.mockResolvedValue([]);
      prismaMock.dependency.findMany.mockResolvedValue([
        { id: 'dep-1', productId: 'prod-1', dependsOnId: 'prod-2', type: 'REQUIRED' },
        { id: 'dep-2', productId: 'prod-2', dependsOnId: 'prod-1', type: 'RECOMMENDED' },
      ]);

      const app = createApp();
      const res = await request(app).get('/api/topology');

      expect(res.status).toBe(200);
      const dependencyEdges = res.body.edges.filter((e: any) => e.type === 'DEPENDENCY');
      expect(dependencyEdges).toHaveLength(2);
      expect(dependencyEdges.find((e: any) => e.id === 'dep-dep-1')).toMatchObject({
        label: 'required',
        source: 'prod-1',
        target: 'prod-2',
      });
      expect(dependencyEdges.find((e: any) => e.id === 'dep-dep-2')).toMatchObject({
        label: 'recommended',
        source: 'prod-2',
        target: 'prod-1',
      });
    });

    it('should handle applications with zero instances', async () => {
      prismaMock.application.findMany.mockResolvedValue([
        { id: 'app-1', name: 'EmptyApp', continuityLevel: { name: 'LOW', color: 'green' }, _count: { instances: 0 } },
      ]);
      prismaMock.product.findMany.mockResolvedValue([]);
      prismaMock.instance.findMany.mockResolvedValue([]);
      prismaMock.dependency.findMany.mockResolvedValue([]);

      const app = createApp();
      const res = await request(app).get('/api/topology');

      expect(res.status).toBe(200);
      expect(res.body.nodes).toHaveLength(1);
      expect(res.body.nodes[0]).toMatchObject({
        id: 'app-1',
        name: 'EmptyApp',
        instanceCount: 0,
      });
      expect(res.body.edges).toEqual([]);
    });

    it('should handle products with zero instances', async () => {
      prismaMock.application.findMany.mockResolvedValue([]);
      prismaMock.product.findMany.mockResolvedValue([
        { id: 'prod-1', name: 'UnusedProduct', category: { name: 'Storage' }, _count: { instances: 0 } },
      ]);
      prismaMock.instance.findMany.mockResolvedValue([]);
      prismaMock.dependency.findMany.mockResolvedValue([]);

      const app = createApp();
      const res = await request(app).get('/api/topology');

      expect(res.status).toBe(200);
      expect(res.body.nodes).toHaveLength(1);
      expect(res.body.nodes[0]).toMatchObject({
        id: 'prod-1',
        name: 'UnusedProduct',
        category: 'Storage',
        instanceCount: 0,
      });
    });

    it('should not create related edges when only one app uses a product', async () => {
      prismaMock.application.findMany.mockResolvedValue([
        { id: 'app-1', name: 'Solo', continuityLevel: { name: 'LOW', color: 'green' }, _count: { instances: 1 } },
      ]);
      prismaMock.product.findMany.mockResolvedValue([
        { id: 'prod-1', name: 'Product', category: { name: 'Compute' }, _count: { instances: 1 } },
      ]);
      prismaMock.instance.findMany.mockResolvedValue([
        { applicationId: 'app-1', productId: 'prod-1' },
      ]);
      prismaMock.dependency.findMany.mockResolvedValue([]);

      const app = createApp();
      const res = await request(app).get('/api/topology');

      expect(res.status).toBe(200);
      const relatedEdges = res.body.edges.filter((e: any) => e.type === 'RELATED');
      expect(relatedEdges).toHaveLength(0);
      const instanceEdges = res.body.edges.filter((e: any) => e.type === 'INSTANCE');
      expect(instanceEdges).toHaveLength(1);
    });

    it('should handle apps sharing multiple products without duplicate related edges', async () => {
      prismaMock.application.findMany.mockResolvedValue([
        { id: 'app-1', name: 'App1', continuityLevel: { name: 'LOW', color: 'green' }, _count: { instances: 2 } },
        { id: 'app-2', name: 'App2', continuityLevel: { name: 'LOW', color: 'green' }, _count: { instances: 2 } },
      ]);
      prismaMock.product.findMany.mockResolvedValue([
        { id: 'prod-1', name: 'P1', category: { name: 'Compute' }, _count: { instances: 2 } },
        { id: 'prod-2', name: 'P2', category: { name: 'Data' }, _count: { instances: 2 } },
      ]);
      prismaMock.instance.findMany.mockResolvedValue([
        { applicationId: 'app-1', productId: 'prod-1' },
        { applicationId: 'app-1', productId: 'prod-2' },
        { applicationId: 'app-2', productId: 'prod-1' },
        { applicationId: 'app-2', productId: 'prod-2' },
      ]);
      prismaMock.dependency.findMany.mockResolvedValue([]);

      const app = createApp();
      const res = await request(app).get('/api/topology');

      expect(res.status).toBe(200);
      // Only 1 related edge between app-1 and app-2, even though they share 2 products
      const relatedEdges = res.body.edges.filter((e: any) => e.type === 'RELATED');
      expect(relatedEdges).toHaveLength(1);
      expect(relatedEdges[0].source).not.toBe(relatedEdges[0].target);
    });

    it('should handle mixed null and defined fields gracefully', async () => {
      prismaMock.application.findMany.mockResolvedValue([
        { id: 'app-1', name: 'App', continuityLevel: { name: 'LOW', color: null }, _count: { instances: 0 } },
      ]);
      prismaMock.product.findMany.mockResolvedValue([
        { id: 'prod-1', name: 'Prod', category: { name: null }, _count: { instances: 0 } },
      ]);
      prismaMock.instance.findMany.mockResolvedValue([]);
      prismaMock.dependency.findMany.mockResolvedValue([]);

      const app = createApp();
      const res = await request(app).get('/api/topology');

      expect(res.status).toBe(200);
      expect(res.body.nodes).toHaveLength(2);
      expect(res.body.nodes[0].continuityColor).toBeNull();
      expect(res.body.nodes[1].category).toBeNull();
    });
  });
});
