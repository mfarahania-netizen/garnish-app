import { GovernanceInsightsService } from './governance-insights.service';

describe('GovernanceInsightsService', () => {
  it('returns a compact governance summary', async () => {
    const prisma: any = {
      experiment: { findFirst: jest.fn().mockResolvedValue({ id: 'exp-1', name: 'ranking-v2', variantA: {}, variantB: {} }) },
      experimentAssignment: { count: jest.fn().mockResolvedValue(4) },
      userEvent: { count: jest.fn().mockResolvedValue(100) },
      user: { count: jest.fn().mockResolvedValue(25) },
    };

    const service = new GovernanceInsightsService(prisma);
    const summary = await service.getGovernanceSummary();

    expect(summary).toMatchObject({
      retentionPolicyDays: 365,
      activeAssignments: 4,
      recentEventVolume: 100,
      totalUsers: 25,
    });
    expect(summary.activeExperiment).toMatchObject({ id: 'exp-1', name: 'ranking-v2' });
  });
});
