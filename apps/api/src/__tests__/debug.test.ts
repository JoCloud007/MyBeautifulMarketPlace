var prismaMock: any = {};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => {
    console.log('PrismaClient called, prismaMock =', prismaMock);
    return prismaMock;
  }),
}));

import { forecastRoutes } from '../routes/forecasts';

test('debug', () => {
  console.log('In test, prismaMock =', prismaMock);
  expect(true).toBe(true);
});
