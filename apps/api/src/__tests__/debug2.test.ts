var x: any;

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn().mockImplementation(() => {
    console.log('readFileSync called, x =', x);
    return x;
  }),
}));

import fs from 'fs';

x = { hello: 'world' };

test('debug closure', () => {
  const result = (fs as any).readFileSync();
  console.log('result =', result);
  expect(result).toBe(x);
});
