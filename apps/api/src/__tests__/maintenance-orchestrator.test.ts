import request from 'supertest';
import express from 'express';

var prismaMock: any = {};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => prismaMock),
  ResiliencyLevel: { STANDARD: 'STANDARD', HA: 'HA', MULTI_AZ: 'MULTI_AZ' },
  InstanceStatus: { PENDING: 'PENDING', PROVISIONING: 'PROVISIONING', RUNNING: 'RUNNING', STOPPED: 'STOPPED', TERMINATED: 'TERMINATED' },
  HealthStatus: { HEALTHY: 'HEALTHY', DEGRADED: 'DEGRADED', UNHEALTHY: 'UNHEALTHY' },
  LifecyclePhase: { RELEASED: 'RELEASED', NORMAL_SUPPORT: 'NORMAL_SUPPORT', EXTENDED_SUPPORT: 'EXTENDED_SUPPORT', NO_SUPPORT: 'NO_SUPPORT', EOL: 'EOL' },
  MaintenanceStatus: { SCHEDULED: 'SCHEDULED', IN_PROGRESS: 'IN_PROGRESS', COMPLETED: 'COMPLETED', CANCELLED: 'CANCELLED' },
  Environment: { PRD: 'PRD', DEV: 'DEV', STG: 'STG' },
}));

import { maintenanceOrchestratorRoutes } from '../routes/maintenance-orchestrator';

function createApp() {
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

function makeApp(id: string, name: string, clName: string, overrides: any = {}) {
  return {
    id,
    name,
    continuityLevel: {
      id: `cl-${clName.toLowerCase()}`,
      name: clName,
      rtoMinutes: clName === 'LOW' ? 1440 : clName === 'MODERATE' ? 480 : clName === 'SERIOUS' ? 240 : 60,
      rpoMinutes: clName === 'LOW' ? 240 : clName === 'MODERATE' ? 60 : clName === 'SERIOUS' ? 15 : 5,
      description: `${clName} level`,
      color: clName === 'LOW' ? 'green' : clName === 'MODERATE' ? 'yellow' : clName === 'SERIOUS' ? 'orange' : 'red',
      ...overrides.continuityLevel,
    },
    ...overrides,
  };
}

function makeInstance(id: string, appId: string, opts: any = {}) {
  return {
    id,
    applicationId: appId,
    status: opts.status ?? 'RUNNING',
    azCode: opts.azCode ?? 'eu-west-1a',
    environment: opts.environment ?? 'DEV',
    healthChecks: opts.healthChecks ?? [{ status: 'HEALTHY' }],
    product: opts.product ?? { name: 'VM' },
    lifecycle: opts.lifecycle ?? null,
    ...opts,
  };
}

describe('Intelligent Maintenance Orchestrator — Lifecycle-Aware Scheduling & Alerting', () => {
  beforeEach(() => {
    prismaMock.application = { findMany: jest.fn(), findUnique: jest.fn() };
    prismaMock.instance = { findMany: jest.fn(), count: jest.fn() };
    prismaMock.productLifecycle = { findMany: jest.fn(), count: jest.fn() };
    prismaMock.maintenanceWindow = { findMany: jest.fn(), count: jest.fn() };
    prismaMock.healthCheck = { count: jest.fn() };
    jest.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Alerts
  // ═══════════════════════════════════════════════════════════════════════
  describe('GET /api/maintenance-orchestrator/alerts', () => {
    it('returns empty array when no data exists', async () => {
      prismaMock.application.findMany.mockResolvedValue([]);
      prismaMock.instance.findMany.mockResolvedValue([]);
      prismaMock.productLifecycle.findMany.mockResolvedValue([]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/alerts');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('generates EXTREME compliance alert for <3 running instances and <3 AZs', async () => {
      const app = makeApp('app-ext', 'ExtApp', 'EXTREME');
      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('i1', 'app-ext', { azCode: 'eu-west-1a' }),
      ]);
      prismaMock.productLifecycle.findMany.mockResolvedValue([]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/alerts');
      expect(res.status).toBe(200);
      const complianceAlert = res.body.find((a: any) => a.id === 'compliance-app-ext');
      expect(complianceAlert).toBeDefined();
      expect(complianceAlert.severity).toBe('CRITICAL');
      expect(complianceAlert.message).toMatch(/2 critical infrastructure gap/);
    });

    it('generates SERIOUS compliance alert for <2 AZs', async () => {
      const app = makeApp('app-ser', 'SerApp', 'SERIOUS');
      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('i1', 'app-ser', { azCode: 'eu-west-1a' }),
        makeInstance('i2', 'app-ser', { azCode: 'eu-west-1a' }),
      ]);
      prismaMock.productLifecycle.findMany.mockResolvedValue([]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/alerts');
      expect(res.status).toBe(200);
      const complianceAlert = res.body.find((a: any) => a.id === 'compliance-app-ser');
      expect(complianceAlert).toBeDefined();
      expect(complianceAlert.severity).toBe('CRITICAL');
    });

    it('does NOT generate compliance alert when MODERATE app meets HA in 2 AZs', async () => {
      const app = makeApp('app-mod', 'ModApp', 'MODERATE');
      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('i1', 'app-mod', { azCode: 'eu-west-1a' }),
        makeInstance('i2', 'app-mod', { azCode: 'eu-west-1b' }),
      ]);
      prismaMock.productLifecycle.findMany.mockResolvedValue([]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/alerts');
      expect(res.status).toBe(200);
      const complianceAlert = res.body.find((a: any) => a.category === 'COMPLIANCE');
      expect(complianceAlert).toBeUndefined();
    });

    it('generates extended support ending WARNING alert', async () => {
      const extEnd = new Date();
      extEnd.setDate(extEnd.getDate() + 10);
      prismaMock.application.findMany.mockResolvedValue([]);
      prismaMock.instance.findMany.mockResolvedValue([]);
      prismaMock.productLifecycle.findMany.mockResolvedValue([
        {
          id: 'lc-1',
          productId: 'p1',
          product: { id: 'p1', name: 'OldProduct' },
          version: '1.0',
          phase: 'EXTENDED_SUPPORT',
          eolDate: new Date('2025-01-01'),
          extendedSupportEnd: extEnd,
        },
      ]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/alerts');
      expect(res.status).toBe(200);
      const extAlert = res.body.find((a: any) => a.id === 'lifecycle-extended-lc-1');
      expect(extAlert).toBeDefined();
      expect(extAlert.severity).toBe('WARNING');
      expect(extAlert.title).toMatch(/Extended support ending/);
    });

    it('generates overlapping alert for same INSTANCE (not just same app)', async () => {
      const now = new Date();
      const start1 = new Date(now.getTime() + 24 * 3600000);
      const end1 = new Date(start1.getTime() + 2 * 3600000);
      const start2 = new Date(start1.getTime() + 1 * 3600000);
      const end2 = new Date(start2.getTime() + 2 * 3600000);
      prismaMock.application.findMany.mockResolvedValue([]);
      prismaMock.instance.findMany.mockResolvedValue([]);
      prismaMock.productLifecycle.findMany.mockResolvedValue([]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([
        { id: 'mw-1', title: 'A', status: 'SCHEDULED', startTime: start1, endTime: end1, applicationId: null, instanceId: 'inst-1' },
        { id: 'mw-2', title: 'B', status: 'SCHEDULED', startTime: start2, endTime: end2, applicationId: null, instanceId: 'inst-1' },
      ]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/alerts');
      expect(res.status).toBe(200);
      const overlapAlert = res.body.find((a: any) => a.id === 'overlap-mw-1-mw-2');
      expect(overlapAlert).toBeDefined();
      expect(overlapAlert.severity).toBe('WARNING');
    });

    it('does NOT generate overlap alert for different apps and different instances', async () => {
      const now = new Date();
      const start1 = new Date(now.getTime() + 24 * 3600000);
      const end1 = new Date(start1.getTime() + 2 * 3600000);
      const start2 = new Date(start1.getTime() + 1 * 3600000);
      const end2 = new Date(start2.getTime() + 2 * 3600000);
      prismaMock.application.findMany.mockResolvedValue([]);
      prismaMock.instance.findMany.mockResolvedValue([]);
      prismaMock.productLifecycle.findMany.mockResolvedValue([]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([
        { id: 'mw-1', title: 'A', status: 'SCHEDULED', startTime: start1, endTime: end1, applicationId: 'app-a', instanceId: null },
        { id: 'mw-2', title: 'B', status: 'SCHEDULED', startTime: start2, endTime: end2, applicationId: 'app-b', instanceId: null },
      ]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/alerts');
      expect(res.status).toBe(200);
      const overlapAlert = res.body.find((a: any) => a.id === 'overlap-mw-1-mw-2');
      expect(overlapAlert).toBeUndefined();
    });

    it('counts multiple overlapping window pairs independently', async () => {
      const now = new Date();
      const base = new Date(now.getTime() + 24 * 3600000);
      prismaMock.application.findMany.mockResolvedValue([]);
      prismaMock.instance.findMany.mockResolvedValue([]);
      prismaMock.productLifecycle.findMany.mockResolvedValue([]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([
        { id: 'mw-1', title: 'A', status: 'SCHEDULED', startTime: base, endTime: new Date(base.getTime() + 3600000), applicationId: 'app-1', instanceId: null },
        { id: 'mw-2', title: 'B', status: 'SCHEDULED', startTime: new Date(base.getTime() + 1800000), endTime: new Date(base.getTime() + 5400000), applicationId: 'app-1', instanceId: null },
        { id: 'mw-3', title: 'C', status: 'SCHEDULED', startTime: new Date(base.getTime() + 1800000), endTime: new Date(base.getTime() + 5400000), applicationId: 'app-1', instanceId: null },
      ]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/alerts');
      expect(res.status).toBe(200);
      const overlaps = res.body.filter((a: any) => a.id.startsWith('overlap-'));
      expect(overlaps.length).toBe(3); // (1,2), (1,3), (2,3)
    });

    it('does NOT generate upcoming alert for window >24h away', async () => {
      const now = new Date();
      const in48h = new Date(now.getTime() + 48 * 3600000);
      prismaMock.application.findMany.mockResolvedValue([]);
      prismaMock.instance.findMany.mockResolvedValue([]);
      prismaMock.productLifecycle.findMany.mockResolvedValue([]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([
        {
          id: 'mw-far',
          title: 'Far Away',
          status: 'SCHEDULED',
          startTime: in48h,
          endTime: new Date(in48h.getTime() + 3600000),
          applicationId: null,
          instanceId: null,
        },
      ]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/alerts');
      expect(res.status).toBe(200);
      const upcomingAlert = res.body.find((a: any) => a.id === 'upcoming-mw-far');
      expect(upcomingAlert).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Schedule Recommendations
  // ═══════════════════════════════════════════════════════════════════════
  describe('GET /api/maintenance-orchestrator/schedule', () => {
    it('skips app with 0 instances (no recommendation)', async () => {
      const app = makeApp('app-empty', 'EmptyApp', 'LOW');
      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/schedule');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('recommends Sunday 2AM for LOW with 4h duration', async () => {
      const app = makeApp('app-low', 'LowApp', 'LOW');
      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([makeInstance('i1', 'app-low')]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/schedule');
      expect(res.status).toBe(200);
      expect(res.body[0].suggestedWindow.durationHours).toBe(4);
      const start = new Date(res.body[0].suggestedWindow.startTime);
      expect(start.getDay()).toBe(0); // Sunday
      expect(start.getHours()).toBe(2);
    });

    it('recommends Saturday 0AM for EXTREME with 1h duration', async () => {
      const app = makeApp('app-ext', 'ExtApp', 'EXTREME');
      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('i1', 'app-ext'),
        makeInstance('i2', 'app-ext'),
        makeInstance('i3', 'app-ext'),
      ]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/schedule');
      expect(res.status).toBe(200);
      expect(res.body[0].suggestedWindow.durationHours).toBe(1);
      const start = new Date(res.body[0].suggestedWindow.startTime);
      expect(start.getDay()).toBe(6); // Saturday
      expect(start.getHours()).toBe(0);
    });

    it('skips week when existing window conflicts', async () => {
      const app = makeApp('app-low', 'LowApp', 'LOW');
      const now = new Date();
      // Find next Sunday at 2AM
      let nextSunday = new Date(now);
      nextSunday.setDate(nextSunday.getDate() + 1); // at least 1 day blackout
      while (nextSunday.getDay() !== 0) {
        nextSunday.setDate(nextSunday.getDate() + 1);
      }
      nextSunday.setHours(2, 0, 0, 0);

      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([makeInstance('i1', 'app-low')]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([
        {
          id: 'mw-1',
          title: 'Conflicting',
          status: 'SCHEDULED',
          startTime: nextSunday,
          endTime: new Date(nextSunday.getTime() + 3600000),
          applicationId: 'app-low',
          instanceId: null,
        },
      ]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/schedule');
      expect(res.status).toBe(200);
      const start = new Date(res.body[0].suggestedWindow.startTime);
      // Should be the Sunday after next
      const daysDiff = Math.round((start.getTime() - nextSunday.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBe(7);
    });

    it('marks impact as MEDIUM when unhealthy instances exist', async () => {
      const app = makeApp('app-mod', 'ModApp', 'MODERATE');
      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('i1', 'app-mod', { healthChecks: [{ status: 'UNHEALTHY' }] }),
        makeInstance('i2', 'app-mod'),
      ]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/schedule');
      expect(res.status).toBe(200);
      expect(res.body[0].estimatedImpact).toBe('MEDIUM');
      expect(res.body[0].rationale.some((r: string) => r.includes('unhealthy'))).toBe(true);
    });

    it('gives EXTREME highest priority (1) and LOW lowest (4)', async () => {
      const appExt = makeApp('app-ext', 'ExtApp', 'EXTREME');
      const appSer = makeApp('app-ser', 'SerApp', 'SERIOUS');
      const appMod = makeApp('app-mod', 'ModApp', 'MODERATE');
      const appLow = makeApp('app-low', 'LowApp', 'LOW');
      prismaMock.application.findMany.mockResolvedValue([appLow, appMod, appSer, appExt]);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('i1', 'app-low'),
        makeInstance('i2', 'app-mod'),
        makeInstance('i3', 'app-ser'),
        makeInstance('i4', 'app-ext'),
      ]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/schedule');
      expect(res.status).toBe(200);
      expect(res.body.map((r: any) => ({ name: r.affectedApplicationName, priority: r.priority }))).toEqual([
        { name: 'ExtApp', priority: 1 },
        { name: 'SerApp', priority: 2 },
        { name: 'ModApp', priority: 3 },
        { name: 'LowApp', priority: 4 },
      ]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Impact Analysis
  // ═══════════════════════════════════════════════════════════════════════
  describe('POST /api/maintenance-orchestrator/impact', () => {
    it('returns CRITICAL risk for EXTREME app maintaining all 3 instances', async () => {
      const app = makeApp('a0000000-0000-0000-0000-000000000001', 'ExtApp', 'EXTREME');
      prismaMock.application.findUnique.mockResolvedValue(app);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', { azCode: 'eu-west-1a' }),
        makeInstance('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', { azCode: 'eu-west-1b' }),
        makeInstance('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', { azCode: 'eu-west-1c' }),
      ]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const res = await request(createApp())
        .post('/api/maintenance-orchestrator/impact')
        .send({
          applicationId: 'a0000000-0000-0000-0000-000000000001',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 3600000).toISOString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.riskLevel).toBe('CRITICAL');
      expect(res.body.canProceed).toBe(false);
      expect(res.body.complianceImpact.gapsCreated).toContain('Active-Active requirement violated during maintenance');
    });

    it('allows SERIOUS app maintaining 1 of 2 instances with MEDIUM risk and reduced score', async () => {
      const app = makeApp('a0000000-0000-0000-0000-000000000002', 'SerApp', 'SERIOUS');
      prismaMock.application.findUnique.mockResolvedValue(app);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', { azCode: 'eu-west-1a' }),
        makeInstance('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', { azCode: 'eu-west-1b' }),
      ]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const res = await request(createApp())
        .post('/api/maintenance-orchestrator/impact')
        .send({
          applicationId: 'a0000000-0000-0000-0000-000000000002',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 3600000).toISOString(),
          affectedInstanceIds: ['b0000000-0000-0000-0000-000000000004'],
        });

      expect(res.status).toBe(200);
      expect(res.body.riskLevel).toBe('MEDIUM');
      expect(res.body.canProceed).toBe(true);
      expect(res.body.complianceImpact.projectedScore).toBe(80);
      expect(res.body.complianceImpact.gapsCreated).toContain('Multi-AZ requirement violated during maintenance');
    });

    it('includes lifecycle warnings when instances have EOL lifecycle', async () => {
      const app = makeApp('a0000000-0000-0000-0000-000000000003', 'LowApp', 'LOW');
      prismaMock.application.findUnique.mockResolvedValue(app);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', {
          product: { name: 'OldDB' },
          lifecycle: { version: '1.0', phase: 'EOL' },
        }),
      ]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const res = await request(createApp())
        .post('/api/maintenance-orchestrator/impact')
        .send({
          applicationId: 'a0000000-0000-0000-0000-000000000003',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 3600000).toISOString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.lifecycleWarnings).toHaveLength(1);
      expect(res.body.lifecycleWarnings[0].phase).toBe('EOL');
      expect(res.body.lifecycleWarnings[0].warning).toMatch(/OldDB 1.0/);
      expect(res.body.recommendations.some((r: string) => r.includes('EOL'))).toBe(true);
    });

    it('returns LOW risk for LOW app even when all instances maintained', async () => {
      const app = makeApp('a0000000-0000-0000-0000-000000000004', 'LowApp', 'LOW');
      prismaMock.application.findUnique.mockResolvedValue(app);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000004'),
      ]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const res = await request(createApp())
        .post('/api/maintenance-orchestrator/impact')
        .send({
          applicationId: 'a0000000-0000-0000-0000-000000000004',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 3600000).toISOString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.riskLevel).toBe('LOW');
      expect(res.body.canProceed).toBe(true);
    });

    it('affects only specified instance IDs when provided with LOW risk for MODERATE', async () => {
      const app = makeApp('a0000000-0000-0000-0000-000000000005', 'ModApp', 'MODERATE');
      prismaMock.application.findUnique.mockResolvedValue(app);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000005', { azCode: 'eu-west-1a' }),
        makeInstance('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000005', { azCode: 'eu-west-1b' }),
      ]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const res = await request(createApp())
        .post('/api/maintenance-orchestrator/impact')
        .send({
          applicationId: 'a0000000-0000-0000-0000-000000000005',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 3600000).toISOString(),
          affectedInstanceIds: ['b0000000-0000-0000-0000-000000000008'],
        });

      expect(res.status).toBe(200);
      expect(res.body.canProceed).toBe(true);
      expect(res.body.riskLevel).toBe('LOW');
      expect(res.body.affectedApplications[0].impact).toMatch(/1 instance/);
    });

    it('returns blue-green recommendation for EXTREME continuity', async () => {
      const app = makeApp('a0000000-0000-0000-0000-000000000006', 'ExtApp', 'EXTREME');
      prismaMock.application.findUnique.mockResolvedValue(app);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000006'),
        makeInstance('b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000006'),
        makeInstance('b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000006'),
      ]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const res = await request(createApp())
        .post('/api/maintenance-orchestrator/impact')
        .send({
          applicationId: 'a0000000-0000-0000-0000-000000000006',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 3600000).toISOString(),
          affectedInstanceIds: ['b0000000-0000-0000-0000-000000000010'],
        });

      expect(res.status).toBe(200);
      expect(res.body.recommendations.some((r: string) => r.includes('blue-green'))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Stats
  // ═══════════════════════════════════════════════════════════════════════
  describe('GET /api/maintenance-orchestrator/stats', () => {
    it('counts unhealthy instances from healthCheck table', async () => {
      prismaMock.application.findMany.mockResolvedValue([]);
      prismaMock.instance.findMany.mockResolvedValue([]);
      prismaMock.instance.count.mockResolvedValue(5);
      prismaMock.healthCheck.count.mockResolvedValue(2);
      prismaMock.maintenanceWindow.count.mockResolvedValue(0);
      prismaMock.productLifecycle.count.mockResolvedValue(0);
      prismaMock.productLifecycle.findMany = jest.fn().mockResolvedValue([]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/stats');
      expect(res.status).toBe(200);
      expect(res.body.unhealthyInstances).toBe(2);
    });

    it('counts lifecycle transitions within 30 days', async () => {
      prismaMock.application.findMany.mockResolvedValue([]);
      prismaMock.instance.findMany.mockResolvedValue([]);
      prismaMock.instance.count.mockResolvedValue(0);
      prismaMock.healthCheck.count.mockResolvedValue(0);
      prismaMock.maintenanceWindow.count.mockResolvedValue(0);
      prismaMock.productLifecycle.count.mockResolvedValue(3);
      prismaMock.productLifecycle.findMany = jest.fn().mockResolvedValue([]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/stats');
      expect(res.status).toBe(200);
      expect(res.body.lifecycleTransitions30Days).toBe(3);
    });

    it('infoAlerts equals upcoming maintenance windows', async () => {
      prismaMock.application.findMany.mockResolvedValue([]);
      prismaMock.instance.findMany.mockResolvedValue([]);
      prismaMock.instance.count.mockResolvedValue(0);
      prismaMock.healthCheck.count.mockResolvedValue(0);
      prismaMock.maintenanceWindow.count.mockResolvedValue(5);
      prismaMock.productLifecycle.count.mockResolvedValue(0);
      prismaMock.productLifecycle.findMany = jest.fn().mockResolvedValue([]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/stats');
      expect(res.status).toBe(200);
      expect(res.body.infoAlerts).toBe(5);
      expect(res.body.upcomingMaintenanceWindows).toBe(5);
    });

    it('counts warningAlerts from unhealthy instances', async () => {
      const app = makeApp('app-low', 'LowApp', 'LOW');
      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('i1', 'app-low', { healthChecks: [{ status: 'UNHEALTHY' }] }),
      ]);
      prismaMock.instance.count.mockResolvedValue(1);
      prismaMock.healthCheck.count.mockResolvedValue(1);
      prismaMock.maintenanceWindow.count.mockResolvedValue(0);
      prismaMock.productLifecycle.count.mockResolvedValue(0);
      prismaMock.productLifecycle.findMany = jest.fn().mockResolvedValue([]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/stats');
      expect(res.status).toBe(200);
      expect(res.body.warningAlerts).toBeGreaterThanOrEqual(1);
    });

    it('counts criticalAlerts from EOL lifecycle products', async () => {
      prismaMock.application.findMany.mockResolvedValue([]);
      prismaMock.instance.findMany.mockResolvedValue([]);
      prismaMock.instance.count.mockResolvedValue(0);
      prismaMock.healthCheck.count.mockResolvedValue(0);
      prismaMock.maintenanceWindow.count.mockResolvedValue(0);
      prismaMock.productLifecycle.count.mockResolvedValue(0);
      prismaMock.productLifecycle.findMany = jest.fn().mockResolvedValue([
        { id: 'lc-1', phase: 'EOL', eolDate: new Date('2020-01-01'), extendedSupportEnd: new Date('2019-01-01') },
      ]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/stats');
      expect(res.status).toBe(200);
      expect(res.body.criticalAlerts).toBeGreaterThanOrEqual(1);
    });

    it('totalAlerts = critical + warning + info', async () => {
      const app = makeApp('app-low', 'LowApp', 'LOW');
      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('i1', 'app-low', { healthChecks: [{ status: 'UNHEALTHY' }] }),
      ]);
      prismaMock.instance.count.mockResolvedValue(1);
      prismaMock.healthCheck.count.mockResolvedValue(1);
      prismaMock.maintenanceWindow.count.mockResolvedValue(2);
      prismaMock.productLifecycle.count.mockResolvedValue(0);
      prismaMock.productLifecycle.findMany = jest.fn().mockResolvedValue([
        { id: 'lc-1', phase: 'EOL', eolDate: new Date('2020-01-01'), extendedSupportEnd: new Date('2019-01-01') },
      ]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/stats');
      expect(res.status).toBe(200);
      expect(res.body.totalAlerts).toBe(res.body.criticalAlerts + res.body.warningAlerts + res.body.infoAlerts);
    });
  });
});
