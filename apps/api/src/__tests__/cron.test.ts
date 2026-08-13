const mockUpdateMany = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    productLifecycle: {
      updateMany: mockUpdateMany,
    },
  })),
  LifecyclePhase: {
    RELEASED: 'RELEASED',
    NORMAL_SUPPORT: 'NORMAL_SUPPORT',
    EXTENDED_SUPPORT: 'EXTENDED_SUPPORT',
    NO_SUPPORT: 'NO_SUPPORT',
    EOL: 'EOL',
  },
}));

jest.mock('node-cron', () => ({
  schedule: jest.fn(),
}));

import { updateLifecyclePhases } from '../cron';

describe('Lifecycle Phase Cron Jobs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('updates RELEASED -> NORMAL_SUPPORT when release date has passed and normal support not ended', async () => {
    mockUpdateMany.mockResolvedValue({ count: 3 });

    await updateLifecyclePhases();

    const now = expect.any(Date);
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          phase: 'RELEASED',
          releaseDate: { lte: now },
          normalSupportEnd: { gte: now },
        },
        data: { phase: 'NORMAL_SUPPORT' },
      })
    );
  });

  it('updates NORMAL_SUPPORT -> EXTENDED_SUPPORT when normal support has ended', async () => {
    mockUpdateMany.mockResolvedValue({ count: 2 });

    await updateLifecyclePhases();

    const now = expect.any(Date);
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          phase: 'NORMAL_SUPPORT',
          normalSupportEnd: { lt: now },
        },
        data: { phase: 'EXTENDED_SUPPORT' },
      })
    );
  });

  it('updates EXTENDED_SUPPORT -> NO_SUPPORT when extended support has ended', async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    await updateLifecyclePhases();

    const now = expect.any(Date);
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          phase: 'EXTENDED_SUPPORT',
          extendedSupportEnd: { lt: now },
        },
        data: { phase: 'NO_SUPPORT' },
      })
    );
  });

  it('updates NO_SUPPORT -> EOL when eolDate is more than 30 days past', async () => {
    mockUpdateMany.mockResolvedValue({ count: 5 });

    await updateLifecyclePhases();

    const thirtyDaysAgo = expect.any(Date);
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          phase: 'NO_SUPPORT',
          eolDate: { lt: thirtyDaysAgo },
        },
        data: { phase: 'EOL' },
      })
    );
  });

  it('calls updateMany exactly 4 times per run', async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });

    await updateLifecyclePhases();

    expect(mockUpdateMany).toHaveBeenCalledTimes(4);
  });

  it('logs completion after updates', async () => {
    mockUpdateMany.mockResolvedValue({ count: 2 });

    await updateLifecyclePhases();

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Lifecycle phases updated')
    );
  });

  it('propagates errors for testability (production cron wrapper catches them)', async () => {
    mockUpdateMany.mockRejectedValue(new Error('Database connection failed'));

    await expect(updateLifecyclePhases()).rejects.toThrow('Database connection failed');
  });
});
