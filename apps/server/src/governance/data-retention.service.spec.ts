import { DataRetentionService } from './data-retention.service';
import { RETENTION_DESTRUCTIVE_FLAG } from '../retention/retention.service';

/**
 * E39-1E-1 — proves the legacy retention cron is neutralized: it deletes NOTHING by default and
 * refuses destructive mode. Prisma is mocked; no real DB, no deletion.
 */
const PRUNABLE = [
  'userEvent', 'userSession', 'signalObservation', 'userBehaviorTimeline', 'recommendationExposure',
  'recommendationAttributionEvent', 'featureContributionLog', 'userOutcome', 'recommendationMetrics',
];

function makeMockPrisma() {
  const p: Record<string, { count: jest.Mock; deleteMany: jest.Mock }> = {};
  for (const m of PRUNABLE) p[m] = { count: jest.fn(async () => 0), deleteMany: jest.fn() };
  return p;
}

describe('DataRetentionService legacy cron (E39-1E-1 guard)', () => {
  const ORIGINAL = process.env[RETENTION_DESTRUCTIVE_FLAG];
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env[RETENTION_DESTRUCTIVE_FLAG];
    else process.env[RETENTION_DESTRUCTIVE_FLAG] = ORIGINAL;
  });

  it('default (flag unset): runs DRY-RUN and calls deleteMany on NOTHING', async () => {
    delete process.env[RETENTION_DESTRUCTIVE_FLAG];
    const p = makeMockPrisma();
    await new DataRetentionService(p as never).cleanupOldEvents();

    // the old destructive path (userEvent.deleteMany) is never invoked
    for (const m of PRUNABLE) expect(p[m].deleteMany).not.toHaveBeenCalled();
    // dry-run did run (count was queried)
    expect(p.userEvent.count).toHaveBeenCalled();
  });

  it('flag explicitly false: still no deletion', async () => {
    process.env[RETENTION_DESTRUCTIVE_FLAG] = 'false';
    const p = makeMockPrisma();
    await new DataRetentionService(p as never).cleanupOldEvents();
    for (const m of PRUNABLE) expect(p[m].deleteMany).not.toHaveBeenCalled();
  });

  it('destructive mode (flag=true): refuses (throws, NOT implemented) and deletes nothing', async () => {
    process.env[RETENTION_DESTRUCTIVE_FLAG] = 'true';
    const p = makeMockPrisma();
    await expect(new DataRetentionService(p as never).cleanupOldEvents()).rejects.toThrow(/NOT implemented/);
    for (const m of PRUNABLE) expect(p[m].deleteMany).not.toHaveBeenCalled();
  });

  it('never logs raw user data (PII-free)', async () => {
    delete process.env[RETENTION_DESTRUCTIVE_FLAG];
    const logSpy = jest.spyOn(require('@nestjs/common').Logger.prototype, 'log').mockImplementation(() => undefined);
    const p = makeMockPrisma();
    await new DataRetentionService(p as never).cleanupOldEvents();
    const logged = logSpy.mock.calls.map((c) => String(c[0])).join(' | ');
    expect(logged).not.toMatch(/@|\b(ip|email|password)\b/i);
    expect(logged).toContain('DRY-RUN');
    logSpy.mockRestore();
  });
});
