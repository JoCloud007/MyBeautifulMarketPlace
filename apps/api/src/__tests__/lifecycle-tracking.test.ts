import request from 'supertest';
import express from 'express';

var prismaMock: any = {};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => prismaMock),
  InstanceStatus: {
    PENDING: 'PENDING',
    PROVISIONING: 'PROVISIONING',
    RUNNING: 'RUNNING',
    STOPPED: 'STOPPED',
    TERMINATED: 'TERMINATED',
  },
  HealthStatus: {
    HEALTHY: 'HEALTHY',
    DEGRADED: 'DEGRADED',
    UNHEALTHY: 'UNHEALTHY',
  },
  LifecyclePhase: {
    RELEASED: 'RELEASED',
    NORMAL_SUPPORT: 'NORMAL_SUPPORT',
    EXTENDED_SUPPORT: 'EXTENDED_SUPPORT',
    NO_SUPPORT: 'NO_SUPPORT',
    EOL: 'EOL',
  },
  MaintenanceStatus: {
    SCHEDULED: 'SCHEDULED',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
  },
  ResiliencyLevel: {
    STANDARD: 'STANDARD',
    HA: 'HA',
    MULTI_AZ: 'MULTI_AZ',
  },
}));

import { instanceRoutes } from '../routes/instances';
import { maintenanceOrchestratorRoutes } from '../routes/maintenance-orchestrator';

function createInstanceApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/instances', instanceRoutes);
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation Error',
        details: err.errors.map((e: any) => ({ path: e.path.join('.'), message: e.message })),
      });
    }
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
  });
  return app;
}

function createOrchestratorApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/maintenance-orchestrator', maintenanceOrchestratorRoutes);
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation Error',
        details: err.errors.map((e: any) => ({ path: e.path.join('.'), message: e.message })),
      });
    }
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
  });
  return app;
}

describe('Instance Lifecycle Tracking & EOL Warnings', () => {
  beforeEach(() => {
    prismaMock.instance = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    prismaMock.application = {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    };
    prismaMock.product = {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    };
    prismaMock.flavor = {
      findUnique: jest.fn(),
    };
    prismaMock.availabilityZone = {
      findUnique: jest.fn(),
    };
    prismaMock.forecast = {
      findUnique: jest.fn(),
    };
    prismaMock.productLifecycle = {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    };
    prismaMock.healthCheck = {
      findMany: jest.fn(),
      count: jest.fn(),
    };
    prismaMock.maintenanceWindow = {
      findMany: jest.fn(),
      count: jest.fn(),
    };
    prismaMock.upgradePath = {
      findMany: jest.fn(),
    };
    jest.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // INSTANCE LIFECYCLE TRACKING
  // ═══════════════════════════════════════════════════════════════════════

  describe('Instance Lifecycle Tracking', () => {
    const validPayload = {
      name: 'lifecycle-instance',
      applicationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      productId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      flavorId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      azCode: 'eu-west-1a',
    };

    function mockRelationsValid() {
      prismaMock.application.findUnique.mockResolvedValue({ id: validPayload.applicationId });
      prismaMock.product.findUnique.mockResolvedValue({ id: validPayload.productId });
      prismaMock.flavor.findUnique.mockResolvedValue({ id: validPayload.flavorId, productId: validPayload.productId });
      prismaMock.availabilityZone.findUnique.mockResolvedValue({ id: 'az1', code: validPayload.azCode });
    }

    it('GET /api/instances includes lifecycle data in response', async () => {
      const instances = [
        {
          id: 'i1',
          name: 'web-server-01',
          lifecycle: { id: 'lc1', version: '2.0', phase: 'NORMAL_SUPPORT', eolDate: new Date('2025-12-31').toISOString() },
          application: { id: 'a1', name: 'App1' },
          product: { id: 'p1', name: 'VM' },
          flavor: { id: 'f1', name: 'Small' },
          az: { id: 'az1', code: 'eu-west-1a' },
          forecast: null,
        },
      ];
      prismaMock.instance.findMany.mockResolvedValue(instances);

      const app = createInstanceApp();
      const res = await request(app).get('/api/instances');

      expect(res.status).toBe(200);
      expect(res.body[0].lifecycle).toEqual(instances[0].lifecycle);
      expect(prismaMock.instance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({ lifecycle: true }),
        })
      );
    });

    it('GET /api/instances/:id returns instance with lifecycle', async () => {
      const instance = {
        id: 'i1',
        name: 'db-server',
        lifecycle: { id: 'lc1', version: '1.0', phase: 'EXTENDED_SUPPORT', eolDate: new Date('2024-06-01').toISOString() },
        application: { id: 'a1', name: 'App1' },
        product: { id: 'p1', name: 'VM' },
        flavor: { id: 'f1', name: 'Large' },
        az: { id: 'az1', code: 'us-east-1a' },
        forecast: null,
      };
      prismaMock.instance.findUnique.mockResolvedValue(instance);

      const app = createInstanceApp();
      const res = await request(app).get('/api/instances/11111111-1111-1111-1111-111111111111');

      expect(res.status).toBe(200);
      expect(res.body.lifecycle).toEqual(instance.lifecycle);
    });

    it('POST /api/instances creates instance with lifecycleId linked to product', async () => {
      mockRelationsValid();
      const lifecycleId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
      prismaMock.productLifecycle.findUnique.mockResolvedValue({ id: lifecycleId, productId: validPayload.productId, version: '3.0', phase: 'NORMAL_SUPPORT' });

      const created = {
        id: 'i-new',
        ...validPayload,
        lifecycleId,
        status: 'PENDING',
        environment: 'DEV',
        application: { id: validPayload.applicationId },
        product: { id: validPayload.productId },
        flavor: { id: validPayload.flavorId },
        lifecycle: { id: lifecycleId, version: '3.0', phase: 'NORMAL_SUPPORT' },
        az: { id: 'az1', code: validPayload.azCode },
        forecast: null,
      };
      prismaMock.instance.create.mockResolvedValue(created);

      const app = createInstanceApp();
      const res = await request(app).post('/api/instances').send({ ...validPayload, lifecycleId });

      expect(res.status).toBe(201);
      expect(res.body.lifecycleId).toBe(lifecycleId);
      expect(res.body.lifecycle.version).toBe('3.0');
      expect(prismaMock.instance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lifecycleId }),
        })
      );
    });

    it('POST /api/instances rejects lifecycleId that does not belong to product', async () => {
      mockRelationsValid();
      const lifecycleId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
      prismaMock.productLifecycle.findUnique.mockResolvedValue({ id: lifecycleId, productId: 'other-product-id' });

      const app = createInstanceApp();
      const res = await request(app).post('/api/instances').send({ ...validPayload, lifecycleId });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('does not belong to product');
      expect(prismaMock.instance.create).not.toHaveBeenCalled();
    });

    it('POST /api/instances rejects nonexistent lifecycleId', async () => {
      mockRelationsValid();
      prismaMock.productLifecycle.findUnique.mockResolvedValue(null);

      const app = createInstanceApp();
      const res = await request(app).post('/api/instances').send({ ...validPayload, lifecycleId: 'dddddddd-dddd-dddd-dddd-dddddddddddd' });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Lifecycle not found');
    });

    it('PATCH /api/instances/:id updates lifecycleId', async () => {
      const lifecycleId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
      prismaMock.productLifecycle.findUnique.mockResolvedValue({ id: lifecycleId, productId: 'p1' });
      prismaMock.instance.findUnique.mockResolvedValue({ id: 'i1', productId: 'p1' });
      prismaMock.instance.update.mockResolvedValue({
        id: 'i1',
        lifecycleId,
        application: { id: 'a1' },
        product: { id: 'p1' },
        flavor: { id: 'f1' },
        lifecycle: { id: lifecycleId, version: '4.0', phase: 'RELEASED' },
        az: { id: 'az1' },
        forecast: null,
      });

      const app = createInstanceApp();
      const res = await request(app).patch('/api/instances/11111111-1111-1111-1111-111111111111').send({ lifecycleId });

      expect(res.status).toBe(200);
      expect(res.body.lifecycleId).toBe(lifecycleId);
      expect(res.body.lifecycle.version).toBe('4.0');
    });

    it('PATCH /api/instances/:id rejects lifecycleId not belonging to product', async () => {
      const lifecycleId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
      prismaMock.productLifecycle.findUnique.mockResolvedValue({ id: lifecycleId, productId: 'other-product' });
      prismaMock.instance.findUnique.mockResolvedValue({ id: 'i1', productId: 'p1' });

      const app = createInstanceApp();
      const res = await request(app).patch('/api/instances/11111111-1111-1111-1111-111111111111').send({ lifecycleId });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('does not belong to product');
    });

    it('PATCH /api/instances/:id clears lifecycleId when null is sent', async () => {
      prismaMock.instance.update.mockResolvedValue({
        id: 'i1',
        lifecycleId: null,
        application: { id: 'a1' },
        product: { id: 'p1' },
        flavor: { id: 'f1' },
        lifecycle: null,
        az: { id: 'az1' },
        forecast: null,
      });

      const app = createInstanceApp();
      const res = await request(app).patch('/api/instances/11111111-1111-1111-1111-111111111111').send({ lifecycleId: null });

      expect(res.status).toBe(200);
      expect(res.body.lifecycleId).toBeNull();
      expect(res.body.lifecycle).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // EOL WARNINGS — MAINTENANCE ORCHESTRATOR ALERTS
  // ═══════════════════════════════════════════════════════════════════════

  describe('EOL Warning Alerts', () => {
    it('GET /api/maintenance-orchestrator/alerts generates CRITICAL alert for product approaching EOL (NO_SUPPORT, <=30 days)', async () => {
      const now = new Date();
      const eolDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days from now

      prismaMock.productLifecycle.findMany.mockResolvedValue([
        {
          id: 'lc1',
          phase: 'NO_SUPPORT',
          eolDate,
          extendedSupportEnd: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          product: { id: 'p1', name: 'Legacy VM' },
        },
      ]);
      prismaMock.application.findMany.mockResolvedValue([]);
      prismaMock.instance.findMany.mockResolvedValue([]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const app = createOrchestratorApp();
      const res = await request(app).get('/api/maintenance-orchestrator/alerts');

      expect(res.status).toBe(200);
      const alerts = res.body;
      const eolAlert = alerts.find((a: any) => a.id === 'lifecycle-eol-lc1');
      expect(eolAlert).toBeDefined();
      expect(eolAlert.severity).toBe('CRITICAL');
      expect(eolAlert.category).toBe('LIFECYCLE');
      expect(eolAlert.title).toContain('approaching EOL');
      expect(eolAlert.message).toContain('Legacy VM');
      expect(eolAlert.suggestedAction).toContain('Plan migration');
    });

    it('GET /api/maintenance-orchestrator/alerts generates WARNING for extended support ending (EXTENDED_SUPPORT, <=30 days)', async () => {
      const now = new Date();
      const extendedEnd = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days from now
      const eolDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

      prismaMock.productLifecycle.findMany.mockResolvedValue([
        {
          id: 'lc2',
          phase: 'EXTENDED_SUPPORT',
          eolDate,
          extendedSupportEnd: extendedEnd,
          product: { id: 'p2', name: 'Midlife DB' },
        },
      ]);
      prismaMock.application.findMany.mockResolvedValue([]);
      prismaMock.instance.findMany.mockResolvedValue([]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const app = createOrchestratorApp();
      const res = await request(app).get('/api/maintenance-orchestrator/alerts');

      expect(res.status).toBe(200);
      const alerts = res.body;
      const extAlert = alerts.find((a: any) => a.id === 'lifecycle-extended-lc2');
      expect(extAlert).toBeDefined();
      expect(extAlert.severity).toBe('WARNING');
      expect(extAlert.category).toBe('LIFECYCLE');
      expect(extAlert.title).toContain('Extended support ending');
      expect(extAlert.message).toContain('Midlife DB');
    });

    it('GET /api/maintenance-orchestrator/alerts generates CRITICAL alert for EOL reached products', async () => {
      const now = new Date();

      prismaMock.productLifecycle.findMany.mockResolvedValue([
        {
          id: 'lc3',
          phase: 'EOL',
          eolDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
          extendedSupportEnd: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
          product: { id: 'p3', name: 'Dead OS' },
        },
      ]);
      prismaMock.application.findMany.mockResolvedValue([]);
      prismaMock.instance.findMany.mockResolvedValue([]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const app = createOrchestratorApp();
      const res = await request(app).get('/api/maintenance-orchestrator/alerts');

      expect(res.status).toBe(200);
      const alerts = res.body;
      const eolReachedAlert = alerts.find((a: any) => a.id === 'lifecycle-eol-reached-lc3');
      expect(eolReachedAlert).toBeDefined();
      expect(eolReachedAlert.severity).toBe('CRITICAL');
      expect(eolReachedAlert.title).toContain('reached EOL');
      expect(eolReachedAlert.message).toContain('No further patches');
    });

    it('GET /api/maintenance-orchestrator/alerts returns empty when no lifecycle concerns exist', async () => {
      const now = new Date();
      // Lifecycle far from EOL
      prismaMock.productLifecycle.findMany.mockResolvedValue([
        {
          id: 'lc-safe',
          phase: 'NORMAL_SUPPORT',
          eolDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
          extendedSupportEnd: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
          product: { id: 'p-safe', name: 'Safe Product' },
        },
      ]);
      prismaMock.application.findMany.mockResolvedValue([]);
      prismaMock.instance.findMany.mockResolvedValue([]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const app = createOrchestratorApp();
      const res = await request(app).get('/api/maintenance-orchestrator/alerts');

      expect(res.status).toBe(200);
      const alerts = res.body;
      const lifecycleAlerts = alerts.filter((a: any) => a.category === 'LIFECYCLE');
      expect(lifecycleAlerts.length).toBe(0);
    });

    it('POST /api/maintenance-orchestrator/impact includes lifecycle warnings for affected instances', async () => {
      const appId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      prismaMock.application.findUnique.mockResolvedValue({
        id: appId,
        name: 'TestApp',
        continuityLevel: { id: 'cl1', name: 'LOW' },
      });

      const instances = [
        {
          id: '11111111-1111-1111-1111-111111111111',
          status: 'RUNNING',
          azCode: 'az1',
          applicationId: appId,
          productId: 'p1',
          product: { id: 'p1', name: 'LegacyDB' },
          lifecycle: { id: 'lc1', version: '1.0', phase: 'EOL' },
          healthChecks: [],
        },
        {
          id: '22222222-2222-2222-2222-222222222222',
          status: 'RUNNING',
          azCode: 'az2',
          applicationId: appId,
          productId: 'p2',
          product: { id: 'p2', name: 'ModernDB' },
          lifecycle: { id: 'lc2', version: '5.0', phase: 'NORMAL_SUPPORT' },
          healthChecks: [],
        },
      ];
      prismaMock.instance.findMany.mockResolvedValue(instances);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);
      prismaMock.instance.count.mockResolvedValue(2);
      prismaMock.healthCheck.count.mockResolvedValue(0);

      const app = createOrchestratorApp();
      const res = await request(app)
        .post('/api/maintenance-orchestrator/impact')
        .send({
          applicationId: appId,
          startTime: new Date(Date.now() + 86400000).toISOString(),
          endTime: new Date(Date.now() + 172800000).toISOString(),
          affectedInstanceIds: ['11111111-1111-1111-1111-111111111111'],
        });

      expect(res.status).toBe(200);
      expect(res.body.lifecycleWarnings).toBeDefined();
      expect(res.body.lifecycleWarnings.length).toBe(1);
      expect(res.body.lifecycleWarnings[0].productName).toBe('LegacyDB');
      expect(res.body.lifecycleWarnings[0].phase).toBe('EOL');
      expect(res.body.recommendations.some((r: string) => r.includes('upgrading'))).toBe(true);
    });

    it('POST /api/maintenance-orchestrator/impact returns empty lifecycleWarnings when no instances have lifecycles', async () => {
      const appId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      prismaMock.application.findUnique.mockResolvedValue({
        id: appId,
        name: 'TestApp',
        continuityLevel: { id: 'cl1', name: 'LOW' },
      });

      prismaMock.instance.findMany.mockResolvedValue([
        {
          id: 'i1',
          status: 'RUNNING',
          azCode: 'az1',
          applicationId: appId,
          productId: 'p1',
          product: { id: 'p1', name: 'ProductA' },
          lifecycle: null,
          healthChecks: [],
        },
      ]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);
      prismaMock.instance.count.mockResolvedValue(1);
      prismaMock.healthCheck.count.mockResolvedValue(0);

      const app = createOrchestratorApp();
      const res = await request(app)
        .post('/api/maintenance-orchestrator/impact')
        .send({
          applicationId: appId,
          startTime: new Date(Date.now() + 86400000).toISOString(),
          endTime: new Date(Date.now() + 172800000).toISOString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.lifecycleWarnings).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════

  describe('Edge Cases', () => {
    it('allows instance creation without lifecycleId (optional field)', async () => {
      const payload = {
        name: 'no-lifecycle-instance',
        applicationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        productId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        flavorId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        azCode: 'eu-west-1a',
      };
      prismaMock.application.findUnique.mockResolvedValue({ id: payload.applicationId });
      prismaMock.product.findUnique.mockResolvedValue({ id: payload.productId });
      prismaMock.flavor.findUnique.mockResolvedValue({ id: payload.flavorId, productId: payload.productId });
      prismaMock.availabilityZone.findUnique.mockResolvedValue({ id: 'az1', code: payload.azCode });
      prismaMock.instance.create.mockResolvedValue({
        id: 'i-no-lc',
        ...payload,
        status: 'PENDING',
        environment: 'DEV',
        lifecycle: null,
        application: { id: payload.applicationId },
        product: { id: payload.productId },
        flavor: { id: payload.flavorId },
        az: { id: 'az1' },
        forecast: null,
      });

      const app = createInstanceApp();
      const res = await request(app).post('/api/instances').send(payload);

      expect(res.status).toBe(201);
      expect(res.body.lifecycle).toBeNull();
      expect(prismaMock.productLifecycle.findUnique).not.toHaveBeenCalled();
    });

    it('filters instances by lifecycle phase are not supported directly but lifecycle data is included', async () => {
      // Verify the API doesn't crash when querying instances that have various lifecycle states
      const instances = [
        { id: 'i1', name: 'a', lifecycle: { phase: 'EOL' }, application: { id: 'a1' }, product: { id: 'p1' }, flavor: { id: 'f1' }, az: { id: 'az1' }, forecast: null },
        { id: 'i2', name: 'b', lifecycle: null, application: { id: 'a1' }, product: { id: 'p1' }, flavor: { id: 'f1' }, az: { id: 'az1' }, forecast: null },
        { id: 'i3', name: 'c', lifecycle: { phase: 'NORMAL_SUPPORT' }, application: { id: 'a1' }, product: { id: 'p1' }, flavor: { id: 'f1' }, az: { id: 'az1' }, forecast: null },
      ];
      prismaMock.instance.findMany.mockResolvedValue(instances);

      const app = createInstanceApp();
      const res = await request(app).get('/api/instances');

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(3);
      expect(res.body[0].lifecycle.phase).toBe('EOL');
      expect(res.body[1].lifecycle).toBeNull();
      expect(res.body[2].lifecycle.phase).toBe('NORMAL_SUPPORT');
    });
  });
});
