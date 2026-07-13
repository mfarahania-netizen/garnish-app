import { PrismaService } from '../prisma/prisma.service';
import { ConsentService } from './consent.service';
import {
  CURRENT_PRIVACY_POLICY_VERSION,
  CURRENT_TERMS_POLICY_VERSION,
  TERMS_LAWFUL_BASIS,
} from './consent.constants';

type ConsentRow = {
  purpose: string;
  status: string;
  policyVersion: string | null;
  createdAt?: Date;
};
type CreatedConsent = Record<string, unknown>;

function make(rows: ConsentRow[] = []) {
  const created: CreatedConsent[] = [];
  const create = jest.fn(({ data }: { data: CreatedConsent }) => {
    created.push(data);
    return Promise.resolve({ id: 'c1', ...data });
  });
  const findMany = jest.fn(() => Promise.resolve(rows));
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(0),
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'u1' }]),
    userConsent: {
      create,
      findMany,
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };
  const prismaMock = {
    ...tx,
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx)),
  };
  return {
    svc: new ConsentService(prismaMock as unknown as PrismaService),
    created,
    findMany,
  };
}

describe('ConsentService (L0/B)', () => {
  const previousAnalyticsSwitch = process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
  const previousPersonalizationSwitch = process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;

  afterEach(() => {
    if (previousAnalyticsSwitch === undefined) delete process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
    else process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = previousAnalyticsSwitch;
    if (previousPersonalizationSwitch === undefined) delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
    else process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = previousPersonalizationSwitch;
  });
  it('grantPurpose appends a granted, lawful-basis-stamped UserConsent row', async () => {
    const { svc, created } = make();
    await svc.grantPurpose('u1', 'personalization', {
      source: 'settings',
      ip: '1.2.3.4',
    });
    expect(created[0]).toMatchObject({
      userId: 'u1',
      purpose: 'personalization',
      status: 'granted',
      lawfulBasis: 'consent',
      policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
      source: 'settings',
      ip: '1.2.3.4',
    });
  });

  it('records an explicit decline separately from a withdrawal', async () => {
    const { svc, created } = make();
    await svc.declinePurpose('u1', 'analytics', { source: 'onboarding' });
    await svc.withdrawPurpose('u1', 'analytics', { source: 'settings' });
    expect(created[0]).toMatchObject({
      status: 'declined',
      policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
      source: 'onboarding',
      withdrawnAt: null,
    });
    expect(created[1]).toMatchObject({
      status: 'withdrawn',
      policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
      source: 'settings',
    });
    expect(created[1]?.withdrawnAt).toBeInstanceOf(Date);
  });

  it('uses the server-owned Terms version and a legal-review-pending basis marker', async () => {
    const { svc, created } = make();
    await svc.grantPurpose('u1', 'terms', { source: 'onboarding' });
    expect(created[0]).toMatchObject({
      purpose: 'terms',
      status: 'granted',
      lawfulBasis: TERMS_LAWFUL_BASIS,
      policyVersion: CURRENT_TERMS_POLICY_VERSION,
      source: 'onboarding',
    });
  });

  it('grantedPurposes always includes core and reflects the latest decision per purpose', async () => {
    const { svc } = make([
      { purpose: 'personalization', status: 'granted', policyVersion: CURRENT_PRIVACY_POLICY_VERSION },
      { purpose: 'analytics', status: 'granted', policyVersion: CURRENT_PRIVACY_POLICY_VERSION },
      { purpose: 'personalization', status: 'withdrawn', policyVersion: CURRENT_PRIVACY_POLICY_VERSION },
      { purpose: 'notifications', status: 'declined', policyVersion: null },
    ]);
    const granted = await svc.grantedPurposes('u1');
    expect([...granted].sort()).toEqual(['analytics', 'core']);
  });

  it('hasPurpose is fail-closed for non-core and open for core', async () => {
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
    const open = make([{
      purpose: 'personalization',
      status: 'granted',
      policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
    }]);
    expect(await open.svc.hasPurpose('u1', 'personalization')).toBe(true);
    expect(await open.svc.hasPurpose('u1', 'core')).toBe(true);
    const closed = make([]);
    expect(await closed.svc.hasPurpose('u1', 'personalization')).toBe(false);
    expect(await closed.svc.hasPurpose('u1', 'core')).toBe(true);
  });

  it('rejects an optional grant recorded under a stale policy version', async () => {
    process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = 'true';
    const stale = make([{
      purpose: 'analytics',
      status: 'granted',
      policyVersion: 'privacy-stale',
    }]);
    expect(await stale.svc.hasPurpose('u1', 'analytics')).toBe(false);
  });

  it('grantedPurposes is core-only and never throws on a DB error', async () => {
    const { svc, findMany } = make();
    findMany.mockRejectedValueOnce(new Error('db'));
    expect([...(await svc.grantedPurposes('u1'))]).toEqual(['core']);
  });

  it('records optional grants but keeps runtime processing disabled by default pending purpose-matrix approval', async () => {
    delete process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
    delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
    const { svc } = make([
      { purpose: 'analytics', status: 'granted', policyVersion: CURRENT_PRIVACY_POLICY_VERSION },
      { purpose: 'personalization', status: 'granted', policyVersion: CURRENT_PRIVACY_POLICY_VERSION },
    ]);

    expect([...(await svc.grantedPurposes('u1'))]).toEqual(
      expect.arrayContaining(['core', 'analytics', 'personalization']),
    );
    await expect(svc.hasPurpose('u1', 'analytics')).resolves.toBe(false);
    await expect(svc.hasPurpose('u1', 'personalization')).resolves.toBe(false);
  });

  it('returns the maximum latest current-policy grant epoch for all required purposes', async () => {
    process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = 'true';
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
    const analyticsAt = new Date('2026-07-01T00:00:00.000Z');
    const oldPersonalizationAt = new Date('2026-07-02T00:00:00.000Z');
    const withdrawalAt = new Date('2026-07-03T00:00:00.000Z');
    const regrantAt = new Date('2026-07-04T00:00:00.000Z');
    const { svc } = make([
      { purpose: 'analytics', status: 'granted', policyVersion: CURRENT_PRIVACY_POLICY_VERSION, createdAt: analyticsAt },
      { purpose: 'personalization', status: 'granted', policyVersion: CURRENT_PRIVACY_POLICY_VERSION, createdAt: oldPersonalizationAt },
      { purpose: 'personalization', status: 'withdrawn', policyVersion: CURRENT_PRIVACY_POLICY_VERSION, createdAt: withdrawalAt },
      { purpose: 'personalization', status: 'granted', policyVersion: CURRENT_PRIVACY_POLICY_VERSION, createdAt: regrantAt },
    ]);

    await expect(
      svc.currentGrantEpoch('u1', ['analytics', 'personalization']),
    ).resolves.toEqual(regrantAt);
  });

  it('currentGrantEpoch fails closed for analytics withdrawal, stale policy, runtime OFF, or ledger error', async () => {
    process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = 'true';
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
    const now = new Date();
    const withdrawn = make([
      { purpose: 'analytics', status: 'withdrawn', policyVersion: CURRENT_PRIVACY_POLICY_VERSION, createdAt: now },
      { purpose: 'personalization', status: 'granted', policyVersion: CURRENT_PRIVACY_POLICY_VERSION, createdAt: now },
    ]);
    await expect(
      withdrawn.svc.currentGrantEpoch('u1', ['analytics', 'personalization']),
    ).resolves.toBeNull();

    const stale = make([
      { purpose: 'analytics', status: 'granted', policyVersion: 'privacy-stale', createdAt: now },
      { purpose: 'personalization', status: 'granted', policyVersion: CURRENT_PRIVACY_POLICY_VERSION, createdAt: now },
    ]);
    await expect(
      stale.svc.currentGrantEpoch('u1', ['analytics', 'personalization']),
    ).resolves.toBeNull();

    delete process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
    const runtimeOff = make([]);
    await expect(
      runtimeOff.svc.currentGrantEpoch('u1', ['analytics', 'personalization']),
    ).resolves.toBeNull();
    expect(runtimeOff.findMany).not.toHaveBeenCalled();

    process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = 'true';
    const unreadable = make([]);
    unreadable.findMany.mockRejectedValueOnce(new Error('ledger unavailable'));
    await expect(
      unreadable.svc.currentGrantEpoch('u1', ['analytics', 'personalization']),
    ).resolves.toBeNull();
  });
});
