import { CURRENT_PRIVACY_POLICY_VERSION } from '../consent/consent.constants';
import { EventEnrichmentService } from './event-enrichment.service';

const epoch = new Date('2026-07-13T00:00:00.000Z');

function make(granted: boolean, consentPurpose: string | null = 'personalization') {
  const event = {
    id: 'event-1',
    userId: 'user-1',
    type: 'ai_message_send',
    payload: '{}',
    enrichment: null,
    consentPurpose,
    timestamp: new Date(epoch.getTime() + 1_000),
  };
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(0),
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'user-1' }]),
    userConsent: {
      findMany: jest.fn().mockResolvedValue(granted
        ? ['analytics', 'personalization'].map((purpose) => ({
            id: `consent-${purpose}`,
            purpose,
            status: 'granted',
            policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
            createdAt: epoch,
          }))
        : []),
    },
    userEvent: {
      findUnique: jest.fn().mockResolvedValue(event),
      updateMany,
    },
  };
  const prisma: any = {
    ...tx,
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx)),
  };
  const currentGrantEpoch = jest.fn().mockResolvedValue(granted ? epoch : null);
  const service = new EventEnrichmentService(prisma, { currentGrantEpoch } as any);
  return { service, prisma, tx, currentGrantEpoch, updateMany };
}

describe('EventEnrichmentService consent and provenance boundary', () => {
  const oldAnalytics = process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
  const oldPersonalization =
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;

  beforeEach(() => {
    process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = 'true';
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
  });

  afterAll(() => {
    if (oldAnalytics === undefined)
      delete process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
    else process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = oldAnalytics;
    if (oldPersonalization === undefined)
      delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
    else
      process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED =
        oldPersonalization;
  });

  it.each([null, 'analytics'])('does not inspect consent or enrich a %s-provenance event', async (purpose) => {
    const { service, currentGrantEpoch, updateMany } = make(true, purpose);
    await service.enrichEvent('event-1', { message: 'پیاز' });
    expect(currentGrantEpoch).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('suppresses the write when joint consent is not current', async () => {
    const { service, updateMany } = make(false);
    await service.enrichEvent('event-1', { message: 'پیاز' });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('writes only through tx with locked epoch and provenance predicates', async () => {
    const { service, prisma, updateMany } = make(true);
    await service.enrichEvent('event-1', { message: 'پیاز' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'event-1',
        userId: 'user-1',
        consentPurpose: 'personalization',
        enrichment: null,
        timestamp: { gte: epoch },
      },
      data: { enrichment: expect.any(String) },
    });
  });
});
