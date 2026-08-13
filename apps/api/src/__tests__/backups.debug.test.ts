import request from 'supertest';
import express from 'express';
import { backupRoutes } from '../routes/backups';

var prismaMock: any = {};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => prismaMock),
  BackupStatus: {
    PENDING: 'PENDING',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
  },
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/backups', backupRoutes);
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.log('DEBUG ERROR:', err.name, err.message, err.stack?.split('\n').slice(0,3));
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

beforeEach(() => {
  prismaMock.instance = {
    findUnique: jest.fn().mockResolvedValue({ id: '00000000-0000-0000-0000-000000000001', name: 'VM-1' }),
  };
  prismaMock.backup = {
    create: jest.fn().mockResolvedValue({ id: 'bkp-1' }),
  };
  prismaMock.$transaction = jest.fn((cb: any) => cb(prismaMock));
  jest.clearAllMocks();
});

test('debug backup create', async () => {
  const app = createApp();
  const res = await request(app)
    .post('/api/backups/instances/00000000-0000-0000-0000-000000000001/backups')
    .send({ name: 'Test' });

  console.log('STATUS:', res.status);
  console.log('BODY:', res.body);
});
