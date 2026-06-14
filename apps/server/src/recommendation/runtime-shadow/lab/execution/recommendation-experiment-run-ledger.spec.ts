import { createRunLedger, blockLedger, finalizeLedger, emptyCounters } from './recommendation-experiment-run-ledger';

describe('experiment run ledger', () => {
  it('createRunLedger → not_started, zeroed counters, safe flags', () => {
    const l = createRunLedger('exec-1', '2026-06-15T00:00:00.000Z');
    expect(l.status).toBe('not_started');
    expect(l.completedAt).toBeNull();
    expect(l.counters).toEqual(emptyCounters());
    expect(l.safety).toEqual({ liveRankingChanged: false, userResponseChanged: false, traceExposedToUser: false, productUseEnabled: false });
    expect(l.redactedFailureDetails).toEqual([]);
  });
  it('blockLedger → blocked + reason', () => {
    const l = blockLedger(createRunLedger('exec-1'), 'kill_switch');
    expect(l.status).toBe('blocked');
    expect(l.redactedFailureDetails).toContain('kill_switch');
  });
  it('finalizeLedger clean → completed', () => {
    expect(finalizeLedger(createRunLedger('exec-1')).status).toBe('completed');
  });
  it('finalizeLedger with escaped failure → failed_safe', () => {
    const l = createRunLedger('exec-1');
    l.counters.failuresEscaped = 1;
    expect(finalizeLedger(l).status).toBe('failed_safe');
  });
  it('finalizeLedger with raw leak → failed_safe', () => {
    const l = createRunLedger('exec-1');
    l.counters.rawLeakBlocks = 1;
    expect(finalizeLedger(l).status).toBe('failed_safe');
  });
  it('ledger is leak-free (no raw ids/pii)', () => {
    expect(JSON.stringify(createRunLedger('exec-1'))).not.toMatch(/@|postgres:\/\/|"userText"|"recipeBody"/i);
  });
});
