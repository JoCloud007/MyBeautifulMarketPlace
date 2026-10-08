import request from 'supertest';
import express from 'express';

var prismaMock: any = {};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => {
    console.log('PrismaClient constructor called');
    return prismaMock;
  }),
  ApprovalStatus: { PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED' },
  ForecastStatus: {
    DRAFT: 'DRAFT', PENDING_TECH: 'PENDING_TECH', PENDING_MANAGER: 'PENDING_MANAGER',
    PENDING_BUDGET: 'PENDING_BUDGET', APPROVED: 'APPROVED', REJECTED: 'REJECTED', CANCELLED: 'CANCELLED',
  },
  ForecastAction: {
    CREATE: 'CREATE', UPDATE: 'UPDATE', SUBMIT: 'SUBMIT', APPROVE: 'APPROVE',
    REJECT: 'REJECT', CANCEL: 'CANCEL', RESUBMIT: 'RESUBMIT',
  },
  Role: {
    ADMIN: 'ADMIN', REQUESTER: 'REQUESTER', TECH_LEAD: 'TECH_LEAD', MANAGER: 'MANAGER', FINANCE: 'FINANCE',
  },
}));

import { forecastRoutes } from '../routes/forecasts';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/forecasts', forecastRoutes);
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error('ROUTE ERROR:', err.message);
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
  });
  return app;
}

test('debug forecast route', async () => {
  prismaMock.forecast = {
    findMany: jest.fn().mockResolvedValue([{ id: 'f1' }]),
  };
  console.log('prismaMock before request:', prismaMock);

  const app = createApp();
  const res = await request(app).get('/api/forecasts');

  console.log('Response status:', res.status);
  console.log('Response body:', res.body);
  console.log('findMany calls:', prismaMock.forecast.findMany.mock?.calls?.length);
});
