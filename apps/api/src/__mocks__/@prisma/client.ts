export const prismaMock: any = {};

export const PrismaClient = jest.fn().mockImplementation(() => prismaMock);
