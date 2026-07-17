import { CURRENT_PRIVACY_POLICY_VERSION } from '../consent/consent.constants';
import { GovernanceInsightsService } from './governance-insights.service';

function make(decisions: unknown[] = []) {
  const prisma: any = {
    experiment: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'exp-1',
        name: 'ranking-v2',
        variantA: {},
        variantB: {},
      }),
    },
    experimentAssignment: { count: jest.fn().mockResolvedValue(4) },
    userConsent: { findMany: jest.fn().mockResolvedValue(decisions) },
    userEvent: { count: jest.fn().mockResolvedValue(100) },
    user: { count: jest.fn().mockResolvedValue(25) },
  };
  return { prisma, service: new GovernanceInsightsService(prisma) };
}

describe('GovernanceInsightsService', () => {
  const previousRuntime = process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;

  afterEach(() => {
    if (previousRuntime === undefined)
      delete process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
    else process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = previousRuntime;
  });

  it('counts only current-consent population events from each grant epoch', async () => {
    process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = 'true';
    const epoch = new Date('2026-07-05T00:00:00Z');
    const h = make([
      {
        userId: 'u1',
        status: 'granted',
        policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
        createdAt: epoch,
      },
    ]);

    const summary = await h.service.getGovernanceSummary();

    expect(summary).toMatchObject({
      retentionPolicyDays: 365,
      activeAssignments: 4,
      recentEventVolume: 100,
      recentEventVolumeAvailable: true,
      recentEventVolumeReason: 'current_consent_epoch',
      totalUsers: 25,
    });
    expect(summary.activeExperiment).toMatchObject({
      id: 'exp-1',
      name: 'ranking-v2',
    });
    expect(h.prisma.userEvent.count).toHaveBeenCalledWith({
      where: {
        consentPurpose: { in: ['analytics', 'personalization'] },
        OR: [{ userId: 'u1', timestamp: { gte: epoch } }],
      },
    });
  });

  it('analytics runtime OFF reports unavailable before consent or UserEvent IO', async () => {
    delete process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
    const h = make();

    const summary = await h.service.getGovernanceSummary();

    expect(summary.recentEventVolume).toBeNull();
    expect(summary.recentEventVolumeAvailable).toBe(false);
    expect(summary.recentEventVolumeReason).toBe('analytics_runtime_disabled');
    expect(h.prisma.userConsent.findMany).not.toHaveBeenCalled();
    expect(h.prisma.userEvent.count).not.toHaveBeenCalled();
    expect(h.prisma.experiment.findFirst).toHaveBeenCalled();
    expect(h.prisma.user.count).toHaveBeenCalled();
  });

  it('latest withdrawal is an honest zero before UserEvent IO', async () => {
    process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = 'true';
    const h = make([
      {
        userId: 'u1',
        status: 'granted',
        policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
        createdAt: new Date('2026-07-01T00:00:00Z'),
      },
      {
        userId: 'u1',
        status: 'withdrawn',
        policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
        createdAt: new Date('2026-07-02T00:00:00Z'),
      },
    ]);

    const summary = await h.service.getGovernanceSummary();

    expect(summary.recentEventVolume).toBe(0);
    expect(summary.recentEventVolumeAvailable).toBe(true);
    expect(h.prisma.userEvent.count).not.toHaveBeenCalled();
  });

  it('consent read error reports unavailable before UserEvent IO', async () => {
    process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = 'true';
    const h = make();
    h.prisma.userConsent.findMany.mockRejectedValueOnce(
      new Error('ledger unavailable'),
    );

    const summary = await h.service.getGovernanceSummary();

    expect(summary.recentEventVolume).toBeNull();
    expect(summary.recentEventVolumeAvailable).toBe(false);
    expect(summary.recentEventVolumeReason).toBe(
      'consent_or_event_read_unavailable',
    );
    expect(h.prisma.userEvent.count).not.toHaveBeenCalled();
  });
});
