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

import { complianceRoutes } from '../routes/compliance';
import { maintenanceOrchestratorRoutes } from '../routes/maintenance-orchestrator';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/compliance', complianceRoutes);
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

// ═══════════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════════

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
    ...opts,
  };
}

function makeForecast(id: string, appId: string, lines: any[]) {
  return { id, applicationId: appId, lines };
}

const UUID_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const UUID_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const UUID_C = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const UUID_D = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const UUID_Z = '00000000-0000-0000-0000-000000000000';

// ═══════════════════════════════════════════════════════════════════════
//  Compliance Engine
// ═══════════════════════════════════════════════════════════════════════

describe('Continuity Compliance Engine — Automated RTO/RPO Scoring & Gap Detection', () => {
  beforeEach(() => {
    prismaMock.application = { findMany: jest.fn() };
    prismaMock.instance = { findMany: jest.fn() };
    prismaMock.forecast = { findMany: jest.fn() };
    prismaMock.productLifecycle = { findMany: jest.fn() };
    prismaMock.maintenanceWindow = { findMany: jest.fn(), count: jest.fn() };
    prismaMock.healthCheck = { count: jest.fn() };
    prismaMock.application.findUnique = jest.fn();
    prismaMock.instance.count = jest.fn();
    prismaMock.productLifecycle.count = jest.fn();
    jest.clearAllMocks();
  });

  describe('GET /api/compliance', () => {
    it('returns empty array when no applications exist', async () => {
      prismaMock.application.findMany.mockResolvedValue([]);
      prismaMock.instance.findMany.mockResolvedValue([]);
      prismaMock.forecast.findMany.mockResolvedValue([]);

      const app = createApp();
      const res = await request(app).get('/api/compliance');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    // ── LOW ──
    it('LOW app with 1 running healthy instance in PRD is COMPLIANT (score 100)', async () => {
      const app = makeApp('app-low', 'LowApp', 'LOW');
      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([makeInstance('i1', 'app-low', { environment: 'PRD' })]);
      prismaMock.forecast.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/compliance');
      expect(res.status).toBe(200);
      expect(res.body[0].score).toBe(100);
      expect(res.body[0].status).toBe('COMPLIANT');
      expect(res.body[0].gaps).toHaveLength(0);
    });

    it('LOW app with 0 running instances is NON_COMPLIANT (score 70)', async () => {
      const app = makeApp('app-low', 'LowApp', 'LOW');
      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([makeInstance('i1', 'app-low', { status: 'STOPPED' })]);
      prismaMock.forecast.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/compliance');
      expect(res.status).toBe(200);
      expect(res.body[0].score).toBe(70);
      expect(res.body[0].status).toBe('NON_COMPLIANT');
      expect(res.body[0].gaps).toContainEqual(
        expect.objectContaining({ severity: 'CRITICAL', category: 'INSTANCE_COUNT', message: 'No running instances' })
      );
    });

    it('LOW app with unhealthy instance is AT_RISK (score 90)', async () => {
      const app = makeApp('app-low', 'LowApp', 'LOW');
      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('i1', 'app-low', { healthChecks: [{ status: 'UNHEALTHY' }] }),
      ]);
      prismaMock.forecast.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/compliance');
      expect(res.status).toBe(200);
      expect(res.body[0].score).toBe(90);
      expect(res.body[0].status).toBe('AT_RISK');
      expect(res.body[0].gaps).toContainEqual(
        expect.objectContaining({ severity: 'WARNING', category: 'HEALTH' })
      );
    });

    // ── MODERATE ──
    it('MODERATE app with 2 running instances in 2 AZs + HA in PRD is COMPLIANT (score 100)', async () => {
      const app = makeApp('app-mod', 'ModApp', 'MODERATE');
      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('i1', 'app-mod', { azCode: 'eu-west-1a', environment: 'PRD' }),
        makeInstance('i2', 'app-mod', { azCode: 'eu-west-1b', environment: 'PRD' }),
      ]);
      prismaMock.forecast.findMany.mockResolvedValue([makeForecast('f1', 'app-mod', [{ resiliency: 'HA' }])]);

      const res = await request(createApp()).get('/api/compliance');
      expect(res.status).toBe(200);
      expect(res.body[0].score).toBe(100);
      expect(res.body[0].status).toBe('COMPLIANT');
      expect(res.body[0].gaps).toHaveLength(0);
    });

    it('MODERATE app with only 1 running instance is NON_COMPLIANT (score 60)', async () => {
      const app = makeApp('app-mod', 'ModApp', 'MODERATE');
      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([makeInstance('i1', 'app-mod')]);
      prismaMock.forecast.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/compliance');
      expect(res.status).toBe(200);
      expect(res.body[0].score).toBe(60);
      expect(res.body[0].status).toBe('NON_COMPLIANT');
      expect(res.body[0].gaps).toContainEqual(
        expect.objectContaining({ severity: 'CRITICAL', category: 'INSTANCE_COUNT' })
      );
      expect(res.body[0].gaps).toContainEqual(
        expect.objectContaining({ severity: 'WARNING', category: 'RESILIENCY' })
      );
    });

    it('MODERATE app with 2 instances in single AZ is AT_RISK (score 90)', async () => {
      const app = makeApp('app-mod', 'ModApp', 'MODERATE');
      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('i1', 'app-mod', { azCode: 'eu-west-1a' }),
        makeInstance('i2', 'app-mod', { azCode: 'eu-west-1a' }),
      ]);
      prismaMock.forecast.findMany.mockResolvedValue([makeForecast('f1', 'app-mod', [{ resiliency: 'HA' }])]);

      const res = await request(createApp()).get('/api/compliance');
      expect(res.status).toBe(200);
      expect(res.body[0].score).toBe(90);
      expect(res.body[0].status).toBe('AT_RISK');
      expect(res.body[0].gaps).toContainEqual(
        expect.objectContaining({ severity: 'WARNING', category: 'AZ_DISTRIBUTION', message: 'HA instances are in a single availability zone' })
      );
    });

    it('MODERATE app without HA resiliency is AT_RISK (score 85)', async () => {
      const app = makeApp('app-mod', 'ModApp', 'MODERATE');
      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('i1', 'app-mod', { azCode: 'eu-west-1a' }),
        makeInstance('i2', 'app-mod', { azCode: 'eu-west-1b' }),
      ]);
      prismaMock.forecast.findMany.mockResolvedValue([makeForecast('f1', 'app-mod', [{ resiliency: 'STANDARD' }])]);

      const res = await request(createApp()).get('/api/compliance');
      expect(res.status).toBe(200);
      expect(res.body[0].score).toBe(85);
      expect(res.body[0].status).toBe('AT_RISK');
      expect(res.body[0].gaps).toContainEqual(
        expect.objectContaining({ severity: 'WARNING', category: 'RESILIENCY', message: 'No HA resiliency configured in forecasts' })
      );
    });

    // ── SERIOUS ──
    it('SERIOUS app with 2 running instances in 2 AZs + MULTI_AZ in PRD is COMPLIANT (score 100)', async () => {
      const app = makeApp('app-ser', 'SerApp', 'SERIOUS');
      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('i1', 'app-ser', { azCode: 'eu-west-1a', environment: 'PRD' }),
        makeInstance('i2', 'app-ser', { azCode: 'eu-west-1b', environment: 'PRD' }),
      ]);
      prismaMock.forecast.findMany.mockResolvedValue([makeForecast('f1', 'app-ser', [{ resiliency: 'MULTI_AZ' }])]);

      const res = await request(createApp()).get('/api/compliance');
      expect(res.status).toBe(200);
      expect(res.body[0].score).toBe(100);
      expect(res.body[0].status).toBe('COMPLIANT');
      expect(res.body[0].gaps).toHaveLength(0);
    });

    it('SERIOUS app with only 1 running instance is NON_COMPLIANT (score 40)', async () => {
      const app = makeApp('app-ser', 'SerApp', 'SERIOUS');
      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([makeInstance('i1', 'app-ser')]);
      prismaMock.forecast.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/compliance');
      expect(res.status).toBe(200);
      expect(res.body[0].score).toBe(40);
      expect(res.body[0].status).toBe('NON_COMPLIANT');
      expect(res.body[0].gaps).toContainEqual(
        expect.objectContaining({ severity: 'CRITICAL', category: 'INSTANCE_COUNT' })
      );
      expect(res.body[0].gaps).toContainEqual(
        expect.objectContaining({ severity: 'CRITICAL', category: 'RESILIENCY' })
      );
      expect(res.body[0].gaps).toContainEqual(
        expect.objectContaining({ severity: 'CRITICAL', category: 'AZ_DISTRIBUTION' })
      );
    });

    it('SERIOUS app with instances in single AZ is AT_RISK (score 80)', async () => {
      const app = makeApp('app-ser', 'SerApp', 'SERIOUS');
      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('i1', 'app-ser', { azCode: 'eu-west-1a', environment: 'PRD' }),
        makeInstance('i2', 'app-ser', { azCode: 'eu-west-1a', environment: 'PRD' }),
      ]);
      prismaMock.forecast.findMany.mockResolvedValue([makeForecast('f1', 'app-ser', [{ resiliency: 'MULTI_AZ' }])]);

      const res = await request(createApp()).get('/api/compliance');
      expect(res.status).toBe(200);
      expect(res.body[0].score).toBe(80);
      expect(res.body[0].status).toBe('AT_RISK');
      expect(res.body[0].gaps).toContainEqual(
        expect.objectContaining({ severity: 'CRITICAL', category: 'AZ_DISTRIBUTION' })
      );
    });

    it('SERIOUS app with unhealthy PRD instance is AT_RISK (score 90)', async () => {
      const app = makeApp('app-ser', 'SerApp', 'SERIOUS');
      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('i1', 'app-ser', { azCode: 'eu-west-1a', environment: 'PRD', healthChecks: [{ status: 'UNHEALTHY' }] }),
        makeInstance('i2', 'app-ser', { azCode: 'eu-west-1b', environment: 'PRD' }),
      ]);
      prismaMock.forecast.findMany.mockResolvedValue([makeForecast('f1', 'app-ser', [{ resiliency: 'MULTI_AZ' }])]);

      const res = await request(createApp()).get('/api/compliance');
      expect(res.status).toBe(200);
      expect(res.body[0].score).toBe(90);
      expect(res.body[0].status).toBe('AT_RISK');
      expect(res.body[0].gaps).toContainEqual(
        expect.objectContaining({ severity: 'WARNING', category: 'HEALTH', message: '1 unhealthy instance(s) in production' })
      );
    });

    // ── EXTREME ──
    it('EXTREME app with 3 running instances in 3 AZs + MULTI_AZ in PRD is COMPLIANT (score 100)', async () => {
      const app = makeApp('app-ext', 'ExtApp', 'EXTREME');
      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('i1', 'app-ext', { azCode: 'eu-west-1a', environment: 'PRD' }),
        makeInstance('i2', 'app-ext', { azCode: 'eu-west-1b', environment: 'PRD' }),
        makeInstance('i3', 'app-ext', { azCode: 'eu-west-1c', environment: 'PRD' }),
      ]);
      prismaMock.forecast.findMany.mockResolvedValue([makeForecast('f1', 'app-ext', [{ resiliency: 'MULTI_AZ' }])]);

      const res = await request(createApp()).get('/api/compliance');
      expect(res.status).toBe(200);
      expect(res.body[0].score).toBe(100);
      expect(res.body[0].status).toBe('COMPLIANT');
      expect(res.body[0].gaps).toHaveLength(0);
    });

    it('EXTREME app with only 2 running instances is NON_COMPLIANT (score 60)', async () => {
      const app = makeApp('app-ext', 'ExtApp', 'EXTREME');
      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('i1', 'app-ext', { azCode: 'eu-west-1a', environment: 'PRD' }),
        makeInstance('i2', 'app-ext', { azCode: 'eu-west-1b', environment: 'PRD' }),
      ]);
      prismaMock.forecast.findMany.mockResolvedValue([makeForecast('f1', 'app-ext', [{ resiliency: 'MULTI_AZ' }])]);

      const res = await request(createApp()).get('/api/compliance');
      expect(res.status).toBe(200);
      expect(res.body[0].score).toBe(60);
      expect(res.body[0].status).toBe('NON_COMPLIANT');
      expect(res.body[0].gaps).toContainEqual(
        expect.objectContaining({ severity: 'CRITICAL', category: 'INSTANCE_COUNT' })
      );
    });

    it('EXTREME app with instances spanning only 2 AZs is AT_RISK (score 80)', async () => {
      const app = makeApp('app-ext', 'ExtApp', 'EXTREME');
      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('i1', 'app-ext', { azCode: 'eu-west-1a', environment: 'PRD' }),
        makeInstance('i2', 'app-ext', { azCode: 'eu-west-1b', environment: 'PRD' }),
        makeInstance('i3', 'app-ext', { azCode: 'eu-west-1a', environment: 'PRD' }),
      ]);
      prismaMock.forecast.findMany.mockResolvedValue([makeForecast('f1', 'app-ext', [{ resiliency: 'MULTI_AZ' }])]);

      const res = await request(createApp()).get('/api/compliance');
      expect(res.status).toBe(200);
      expect(res.body[0].score).toBe(80);
      expect(res.body[0].status).toBe('AT_RISK');
      expect(res.body[0].gaps).toContainEqual(
        expect.objectContaining({ severity: 'CRITICAL', category: 'AZ_DISTRIBUTION' })
      );
    });

    it('EXTREME app with unhealthy instances is AT_RISK (score 85)', async () => {
      const app = makeApp('app-ext', 'ExtApp', 'EXTREME');
      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('i1', 'app-ext', { azCode: 'eu-west-1a', environment: 'PRD', healthChecks: [{ status: 'UNHEALTHY' }] }),
        makeInstance('i2', 'app-ext', { azCode: 'eu-west-1b', environment: 'PRD' }),
        makeInstance('i3', 'app-ext', { azCode: 'eu-west-1c', environment: 'PRD' }),
      ]);
      prismaMock.forecast.findMany.mockResolvedValue([makeForecast('f1', 'app-ext', [{ resiliency: 'MULTI_AZ' }])]);

      const res = await request(createApp()).get('/api/compliance');
      expect(res.status).toBe(200);
      expect(res.body[0].score).toBe(85);
      expect(res.body[0].status).toBe('AT_RISK');
      expect(res.body[0].gaps).toContainEqual(
        expect.objectContaining({ severity: 'CRITICAL', category: 'HEALTH' })
      );
    });

    it('EXTREME app with degraded instances loses extra points (score 75)', async () => {
      const app = makeApp('app-ext', 'ExtApp', 'EXTREME');
      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('i1', 'app-ext', { azCode: 'eu-west-1a', healthChecks: [{ status: 'DEGRADED' }] }),
        makeInstance('i2', 'app-ext', { azCode: 'eu-west-1b' }),
        makeInstance('i3', 'app-ext', { azCode: 'eu-west-1c' }),
      ]);
      prismaMock.forecast.findMany.mockResolvedValue([makeForecast('f1', 'app-ext', [{ resiliency: 'MULTI_AZ' }])]);

      const res = await request(createApp()).get('/api/compliance');
      expect(res.status).toBe(200);
      expect(res.body[0].score).toBe(90); // 100 - 10 for degraded
      expect(res.body[0].gaps).toContainEqual(
        expect.objectContaining({ severity: 'WARNING', category: 'HEALTH', message: '1 degraded instance(s)' })
      );
    });

    it('EXTREME app with stopped PRD instance gets ENVIRONMENT warning (score 70)', async () => {
      const app = makeApp('app-ext', 'ExtApp', 'EXTREME');
      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('i1', 'app-ext', { azCode: 'eu-west-1a', environment: 'PRD', status: 'STOPPED' }),
        makeInstance('i2', 'app-ext', { azCode: 'eu-west-1b', environment: 'PRD' }),
        makeInstance('i3', 'app-ext', { azCode: 'eu-west-1c', environment: 'PRD' }),
      ]);
      prismaMock.forecast.findMany.mockResolvedValue([makeForecast('f1', 'app-ext', [{ resiliency: 'MULTI_AZ' }])]);

      const res = await request(createApp()).get('/api/compliance');
      expect(res.status).toBe(200);
      expect(res.body[0].score).toBe(70);
      expect(res.body[0].gaps).toContainEqual(
        expect.objectContaining({ severity: 'WARNING', category: 'ENVIRONMENT', message: 'Stopped instance(s) in production environment' })
      );
    });

    // ── General gaps ──
    it('adds INFO gap when instances exist but none in PRD', async () => {
      const app = makeApp('app-low', 'LowApp', 'LOW');
      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('i1', 'app-low', { environment: 'DEV' }),
      ]);
      prismaMock.forecast.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/compliance');
      expect(res.status).toBe(200);
      expect(res.body[0].gaps).toContainEqual(
        expect.objectContaining({ severity: 'INFO', category: 'ENVIRONMENT', message: 'No instances in production environment' })
      );
    });

    it('sorts results by score ascending (worst first)', async () => {
      const appLow = makeApp('app-low', 'LowApp', 'LOW');
      const appExt = makeApp('app-ext', 'ExtApp', 'EXTREME');
      prismaMock.application.findMany.mockResolvedValue([appLow, appExt]);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('i1', 'app-low', { status: 'STOPPED' }), // score 70
        makeInstance('i2', 'app-ext', { azCode: 'eu-west-1a', status: 'STOPPED' }), // score 45
      ]);
      prismaMock.forecast.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/compliance');
      expect(res.status).toBe(200);
      expect(res.body[0].score).toBe(45);
      expect(res.body[1].score).toBe(70);
    });

    it('clamps score to minimum 0 (EXTREME with all penalties yields 20)', async () => {
      const app = makeApp('app-ext', 'ExtApp', 'EXTREME');
      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('i1', 'app-ext', { azCode: 'eu-west-1a', status: 'STOPPED', environment: 'PRD', healthChecks: [{ status: 'UNHEALTHY' }] }),
      ]);
      prismaMock.forecast.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/compliance');
      expect(res.status).toBe(200);
      expect(res.body[0].score).toBe(20);
      expect(res.body[0].status).toBe('NON_COMPLIANT');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Maintenance Orchestrator — Alerts
  // ═══════════════════════════════════════════════════════════════════════
  describe('GET /api/maintenance-orchestrator/alerts', () => {
    it('generates compliance alert for LOW app with 0 running instances', async () => {
      const app = makeApp('app-low', 'LowApp', 'LOW');
      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([makeInstance('i1', 'app-low', { status: 'STOPPED' })]);
      prismaMock.productLifecycle.findMany.mockResolvedValue([]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/alerts');
      expect(res.status).toBe(200);
      const complianceAlert = res.body.find((a: any) => a.category === 'COMPLIANCE');
      expect(complianceAlert).toBeDefined();
      expect(complianceAlert.severity).toBe('CRITICAL');
      expect(complianceAlert.title).toMatch(/Compliance gap/);
    });

    it('generates health alert for unhealthy instance', async () => {
      const app = makeApp('app-low', 'LowApp', 'LOW');
      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('i1', 'app-low', { healthChecks: [{ status: 'UNHEALTHY' }] }),
      ]);
      prismaMock.productLifecycle.findMany.mockResolvedValue([]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/alerts');
      expect(res.status).toBe(200);
      const healthAlert = res.body.find((a: any) => a.category === 'HEALTH');
      expect(healthAlert).toBeDefined();
      expect(healthAlert.severity).toBe('WARNING');
      expect(healthAlert.title).toMatch(/unhealthy instance/);
    });

    it('generates lifecycle EOL alert for product at EOL', async () => {
      prismaMock.application.findMany.mockResolvedValue([]);
      prismaMock.instance.findMany.mockResolvedValue([]);
      prismaMock.productLifecycle.findMany.mockResolvedValue([
        {
          id: 'lc-1',
          productId: 'p1',
          product: { id: 'p1', name: 'OldProduct' },
          version: '1.0',
          phase: 'EOL',
          eolDate: new Date('2024-01-01'),
          extendedSupportEnd: new Date('2023-06-01'),
        },
      ]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/alerts');
      expect(res.status).toBe(200);
      const eolAlert = res.body.find((a: any) => a.id === 'lifecycle-eol-reached-lc-1');
      expect(eolAlert).toBeDefined();
      expect(eolAlert.severity).toBe('CRITICAL');
      expect(eolAlert.title).toMatch(/Product reached EOL/);
    });

    it('generates upcoming EOL alert for product within 30 days', async () => {
      const eolDate = new Date();
      eolDate.setDate(eolDate.getDate() + 15);
      prismaMock.application.findMany.mockResolvedValue([]);
      prismaMock.instance.findMany.mockResolvedValue([]);
      prismaMock.productLifecycle.findMany.mockResolvedValue([
        {
          id: 'lc-1',
          productId: 'p1',
          product: { id: 'p1', name: 'ExpiringProduct' },
          version: '2.0',
          phase: 'NO_SUPPORT',
          eolDate,
          extendedSupportEnd: new Date('2023-06-01'),
        },
      ]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/alerts');
      expect(res.status).toBe(200);
      const eolAlert = res.body.find((a: any) => a.id === 'lifecycle-eol-lc-1');
      expect(eolAlert).toBeDefined();
      expect(eolAlert.severity).toBe('CRITICAL');
      expect(eolAlert.title).toMatch(/approaching EOL/);
    });

    it('generates overdue maintenance window alert', async () => {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      prismaMock.application.findMany.mockResolvedValue([]);
      prismaMock.instance.findMany.mockResolvedValue([]);
      prismaMock.productLifecycle.findMany.mockResolvedValue([]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([
        {
          id: 'mw-1',
          title: 'Patch Tuesday',
          status: 'SCHEDULED',
          startTime: new Date(yesterday.getTime() - 3600000),
          endTime: yesterday,
          applicationId: null,
          instanceId: null,
        },
      ]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/alerts');
      expect(res.status).toBe(200);
      const overdueAlert = res.body.find((a: any) => a.id === 'overdue-mw-1');
      expect(overdueAlert).toBeDefined();
      expect(overdueAlert.severity).toBe('WARNING');
      expect(overdueAlert.title).toMatch(/Overdue maintenance/);
    });

    it('generates upcoming maintenance window alert within 24h', async () => {
      const now = new Date();
      const in12h = new Date(now.getTime() + 12 * 3600000);
      prismaMock.application.findMany.mockResolvedValue([]);
      prismaMock.instance.findMany.mockResolvedValue([]);
      prismaMock.productLifecycle.findMany.mockResolvedValue([]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([
        {
          id: 'mw-1',
          title: 'DB Upgrade',
          status: 'SCHEDULED',
          startTime: in12h,
          endTime: new Date(in12h.getTime() + 3600000),
          applicationId: null,
          instanceId: null,
        },
      ]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/alerts');
      expect(res.status).toBe(200);
      const upcomingAlert = res.body.find((a: any) => a.id === 'upcoming-mw-1');
      expect(upcomingAlert).toBeDefined();
      expect(upcomingAlert.severity).toBe('INFO');
      expect(upcomingAlert.title).toMatch(/starting soon/);
    });

    it('generates overlapping maintenance windows alert for same app', async () => {
      const now = new Date();
      const start1 = new Date(now.getTime() + 24 * 3600000);
      const end1 = new Date(start1.getTime() + 2 * 3600000);
      const start2 = new Date(start1.getTime() + 1 * 3600000);
      const end2 = new Date(start2.getTime() + 2 * 3600000);
      prismaMock.application.findMany.mockResolvedValue([]);
      prismaMock.instance.findMany.mockResolvedValue([]);
      prismaMock.productLifecycle.findMany.mockResolvedValue([]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([
        { id: 'mw-1', title: 'A', status: 'SCHEDULED', startTime: start1, endTime: end1, applicationId: 'app-1', instanceId: null },
        { id: 'mw-2', title: 'B', status: 'SCHEDULED', startTime: start2, endTime: end2, applicationId: 'app-1', instanceId: null },
      ]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/alerts');
      expect(res.status).toBe(200);
      const overlapAlert = res.body.find((a: any) => a.id === 'overlap-mw-1-mw-2');
      expect(overlapAlert).toBeDefined();
      expect(overlapAlert.severity).toBe('WARNING');
      expect(overlapAlert.title).toBe('Overlapping maintenance windows');
    });

    it('sorts alerts by severity: CRITICAL first', async () => {
      const eolDate = new Date();
      eolDate.setDate(eolDate.getDate() + 15);
      prismaMock.application.findMany.mockResolvedValue([]);
      prismaMock.instance.findMany.mockResolvedValue([]);
      prismaMock.productLifecycle.findMany.mockResolvedValue([
        {
          id: 'lc-1',
          productId: 'p1',
          product: { id: 'p1', name: 'ExpiringProduct' },
          version: '2.0',
          phase: 'NO_SUPPORT',
          eolDate,
          extendedSupportEnd: new Date('2023-06-01'),
        },
      ]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/alerts');
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].severity).toBe('CRITICAL');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Maintenance Orchestrator — Impact Analysis
  // ═══════════════════════════════════════════════════════════════════════
  describe('POST /api/maintenance-orchestrator/impact', () => {
    it('returns 404 for non-existent application', async () => {
      prismaMock.application.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .post('/api/maintenance-orchestrator/impact')
        .send({
          applicationId: UUID_Z,
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 3600000).toISOString(),
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/Application not found/);
    });

    it('returns 400 for invalid request body', async () => {
      const res = await request(createApp())
        .post('/api/maintenance-orchestrator/impact')
        .send({
          applicationId: 'not-a-uuid',
          startTime: 'not-a-date',
          endTime: 'not-a-date',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('computes impact for MODERATE app maintaining all instances', async () => {
      const app = makeApp(UUID_A, 'ModApp', 'MODERATE');
      prismaMock.application.findUnique.mockResolvedValue(app);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance(UUID_B, UUID_A, { azCode: 'eu-west-1a', product: { name: 'VM' }, lifecycle: null }),
        makeInstance(UUID_C, UUID_A, { azCode: 'eu-west-1b', product: { name: 'VM' }, lifecycle: null }),
      ]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const res = await request(createApp())
        .post('/api/maintenance-orchestrator/impact')
        .send({
          applicationId: UUID_A,
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 3600000).toISOString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.canProceed).toBe(false);
      expect(res.body.riskLevel).toBe('CRITICAL');
      expect(res.body.complianceImpact.projectedScore).toBeLessThan(100);
      expect(res.body.complianceImpact.gapsCreated).toContain('HA pair broken during maintenance');
    });

    it('detects conflicting maintenance windows', async () => {
      const app = makeApp(UUID_A, 'ModApp', 'MODERATE');
      const now = new Date();
      prismaMock.application.findUnique.mockResolvedValue(app);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance(UUID_B, UUID_A, { product: { name: 'VM' }, lifecycle: null }),
        makeInstance(UUID_C, UUID_A, { product: { name: 'VM' }, lifecycle: null }),
      ]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([
        {
          id: 'mw-1',
          title: 'Existing',
          startTime: now,
          endTime: new Date(now.getTime() + 7200000),
          status: 'SCHEDULED',
          applicationId: UUID_A,
          instanceId: null,
        },
      ]);

      const res = await request(createApp())
        .post('/api/maintenance-orchestrator/impact')
        .send({
          applicationId: UUID_A,
          startTime: now.toISOString(),
          endTime: new Date(now.getTime() + 3600000).toISOString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.conflictingWindows).toHaveLength(1);
      expect(res.body.conflictingWindows[0].title).toBe('Existing');
      expect(res.body.riskLevel).toBe('CRITICAL');
      expect(res.body.canProceed).toBe(false);
    });

    it('allows proceeding for LOW app with spare instance', async () => {
      const app = makeApp(UUID_A, 'LowApp', 'LOW');
      prismaMock.application.findUnique.mockResolvedValue(app);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance(UUID_B, UUID_A, { product: { name: 'VM' }, lifecycle: null }),
        makeInstance(UUID_C, UUID_A, { product: { name: 'VM' }, lifecycle: null }),
      ]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const res = await request(createApp())
        .post('/api/maintenance-orchestrator/impact')
        .send({
          applicationId: UUID_A,
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 3600000).toISOString(),
          affectedInstanceIds: [UUID_B],
        });

      expect(res.status).toBe(200);
      expect(res.body.canProceed).toBe(true);
      expect(res.body.riskLevel).toBe('LOW');
      expect(res.body.complianceImpact.projectedScore).toBe(100);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Maintenance Orchestrator — Schedule Recommendations
  // ═══════════════════════════════════════════════════════════════════════
  describe('GET /api/maintenance-orchestrator/schedule', () => {
    it('returns recommendations sorted by priority (EXTREME first)', async () => {
      const appExt = makeApp('app-ext', 'ExtApp', 'EXTREME');
      const appLow = makeApp('app-low', 'LowApp', 'LOW');
      prismaMock.application.findMany.mockResolvedValue([appLow, appExt]);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('i1', 'app-low'),
        makeInstance('i2', 'app-ext'),
      ]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/schedule');
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
      expect(res.body[0].affectedApplicationName).toBe('ExtApp');
      expect(res.body[0].priority).toBe(1);
      expect(res.body[1].affectedApplicationName).toBe('LowApp');
      expect(res.body[1].priority).toBe(4);
    });

    it('recommendation includes rationale and impact estimate', async () => {
      const app = makeApp('app-ser', 'SerApp', 'SERIOUS');
      prismaMock.application.findMany.mockResolvedValue([app]);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('i1', 'app-ser'),
        makeInstance('i2', 'app-ser'),
      ]);
      prismaMock.maintenanceWindow.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/schedule');
      expect(res.status).toBe(200);
      expect(res.body[0].rationale.length).toBeGreaterThan(0);
      expect(res.body[0].estimatedImpact).toBe('MEDIUM');
      expect(res.body[0].suggestedWindow.durationHours).toBe(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Maintenance Orchestrator — Stats
  // ═══════════════════════════════════════════════════════════════════════
  describe('GET /api/maintenance-orchestrator/stats', () => {
    it('aggregates stats correctly', async () => {
      const appExt = makeApp('app-ext', 'ExtApp', 'EXTREME');
      const appLow = makeApp('app-low', 'LowApp', 'LOW');
      prismaMock.application.findMany.mockResolvedValue([appLow, appExt]);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('i1', 'app-low', { status: 'STOPPED' }),
        makeInstance('i2', 'app-ext', { azCode: 'eu-west-1a' }),
      ]);
      prismaMock.instance.count.mockResolvedValue(2);
      prismaMock.healthCheck.count.mockResolvedValue(0);
      prismaMock.maintenanceWindow.count.mockResolvedValue(3);
      prismaMock.productLifecycle.count.mockResolvedValue(1);
      prismaMock.productLifecycle.findMany = jest.fn().mockResolvedValue([]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/stats');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        unhealthyInstances: 0,
        upcomingMaintenanceWindows: 3,
        lifecycleTransitions30Days: 1,
      });
      expect(res.body.recommendations).toBe(2);
    });

    it('counts critical alerts from compliance gaps', async () => {
      const appExt = makeApp('app-ext', 'ExtApp', 'EXTREME');
      prismaMock.application.findMany.mockResolvedValue([appExt]);
      prismaMock.instance.findMany.mockResolvedValue([
        makeInstance('i1', 'app-ext', { azCode: 'eu-west-1a' }),
      ]);
      prismaMock.instance.count.mockResolvedValue(1);
      prismaMock.healthCheck.count.mockResolvedValue(0);
      prismaMock.maintenanceWindow.count.mockResolvedValue(0);
      prismaMock.productLifecycle.count.mockResolvedValue(0);
      prismaMock.productLifecycle.findMany = jest.fn().mockResolvedValue([]);

      const res = await request(createApp()).get('/api/maintenance-orchestrator/stats');
      expect(res.status).toBe(200);
      expect(res.body.criticalAlerts).toBeGreaterThanOrEqual(1);
      expect(res.body.totalAlerts).toBeGreaterThanOrEqual(1);
    });
  });
});
