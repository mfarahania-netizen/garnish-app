import { ExposureTrackingService } from './exposure-tracking.service';

describe('ExposureTrackingService', () => {
  let prisma: {
    $executeRaw: jest.Mock;
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
  };
  let service: ExposureTrackingService;

  beforeEach(() => {
    prisma = {
      $executeRaw: jest.fn(),
      $queryRaw: jest.fn(),
      $transaction: jest.fn((queries) => Promise.all(queries)),
    };
    service = new ExposureTrackingService(prisma as any);
  });

  it('tracks one exposure row', async () => {
    await service.trackExposure('user-1', 'recipe-1');

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('tracks unique exposure rows in batch', async () => {
    await service.trackExposures('user-1', [
      'recipe-1',
      'recipe-1',
      'recipe-2',
    ]);

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('does not write when batch is empty', async () => {
    await service.trackExposures('user-1', []);

    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('calculates capped penalty from repeated exposures and negative feedback', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ count: 6 }])
      .mockResolvedValueOnce([{ count: 2 }])
      .mockResolvedValueOnce([{ count: 1 }]);

    const penalty = await service.getPenalty('user-1', 'recipe-1');

    expect(penalty).toBe(0.28);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(3);
  });

  it('returns zero penalty when there is no exposure or negative feedback', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }]);

    const penalty = await service.getPenalty('user-1', 'recipe-1');

    expect(penalty).toBe(0);
  });
});
