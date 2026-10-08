import request from 'supertest';
import express from 'express';
import { forecastRoutes } from '../routes/forecasts';

var prismaMock: any = {};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => {
    return new Proxy(
      {},
      {
        get(_target, prop: string) {
          return prismaMock?.[prop] ?? {};
        },
      }
    );
  }),
  ForecastStatus: {
    DRAFT: 'DRAFT',
    PENDING_TECH: 'PENDING_TECH',
    PENDING_MANAGER: 'PENDING_MANAGER',
    PENDING_BUDGET: 'PENDING_BUDGET',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    CANCELLED: 'CANCELLED',
  },
  ForecastAction: {
    CREATE: 'CREATE', UPDATE: 'UPDATE', SUBMIT: 'SUBMIT', APPROVE: 'APPROVE',
    REJECT: 'REJECT', CANCEL: 'CANCEL', RESUBMIT: 'RESUBMIT',
  },
  Role: {
    ADMIN: 'ADMIN', REQUESTER: 'REQUESTER', TECH_LEAD: 'TECH_LEAD', MANAGER: 'MANAGER', FINANCE: 'FINANCE',
  },
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/forecasts', forecastRoutes);
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.log('ERROR:', err);
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

describe('Debug Forecast', () => {
  beforeEach(() => {
    prismaMock.forecast = {
      findMany: jest.fn().mockResolvedValue([]),
    };
    jest.clearAllMocks();
  });

  it('should debug 500', async () => {
    console.log('prismaMock id:', prismaMock === undefined, prismaMock === null, typeof prismaMock, Object.keys(prismaMock));
    console.log('prismaMock.forecast:', prismaMock.forecast === undefined);
    const app = createApp();
    const res = await request(app).get('/api/forecasts');
    console.log('STATUS:', res.status);
    console.log('BODY:', res.body);
    expect(res.status).toBe(200);
  });
});
