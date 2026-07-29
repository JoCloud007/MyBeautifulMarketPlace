"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var prismaMock = {};
jest.mock('@prisma/client', () => ({
    PrismaClient: jest.fn().mockImplementation(() => {
        console.log('PrismaClient called, prismaMock =', prismaMock);
        return prismaMock;
    }),
}));
test('debug', () => {
    console.log('In test, prismaMock =', prismaMock);
    expect(true).toBe(true);
});
