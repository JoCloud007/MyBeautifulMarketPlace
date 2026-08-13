import request from 'supertest';
import express from 'express';
import { forecastRoutes } from '../routes/forecasts';

var prismaMock: any = {};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => prismaMock),
  ApprovalStatus: {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
  },
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/forecasts', forecastRoutes);
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

describe('Debug3 Forecast - import BEFORE jest.mock', () => {
  beforeEach(() => {
    prismaMock.forecast = {
      findMany: jest.fn().mockResolvedValue([]),
    };
    jest.clearAllMocks();
  });

  it('should fail due to import order', async () => {
    const app = createApp();
    const res = await request(app).get('/api/forecasts');
    console.log('STATUS:', res.status);
    console.log('BODY:', res.body);
    expect(res.status).toBe(200);
  });
});
