import { safeJsonPayload, alreadyConsumed } from './safe-payload';

// recsys audit P0-7: a malformed/legacy outbox payload must NEVER throw (which would dead-letter the outbox).
describe('safeJsonPayload (recsys P0-7)', () => {
  it('parses valid JSON', () => {
    expect(safeJsonPayload({ payload: '{"recipeId":"r1"}' })).toEqual({ recipeId: 'r1' });
  });
  it('returns {} for malformed JSON (no throw)', () => {
    expect(safeJsonPayload({ payload: '{bad json' })).toEqual({});
  });
  it('returns {} for null / missing payload', () => {
    expect(safeJsonPayload({ payload: null })).toEqual({});
    expect(safeJsonPayload({})).toEqual({});
    expect(safeJsonPayload(null)).toEqual({});
  });
  it('returns {} for non-object JSON (a bare number/string)', () => {
    expect(safeJsonPayload({ payload: '42' })).toEqual({});
    expect(safeJsonPayload({ payload: '"hi"' })).toEqual({});
  });
});

// recsys audit P0-6: the idempotency guard — a redelivered event must not re-derive signals.
describe('alreadyConsumed (recsys P0-6)', () => {
  it('false for an empty eventId', async () => {
    expect(await alreadyConsumed({}, '')).toBe(false);
  });
  it('true when an observation already exists for the event', async () => {
    const prisma = { signalObservation: { findFirst: jest.fn().mockResolvedValue({ id: 'x' }) } };
    expect(await alreadyConsumed(prisma, 'e1')).toBe(true);
  });
  it('false when none exists', async () => {
    const prisma = { signalObservation: { findFirst: jest.fn().mockResolvedValue(null) } };
    expect(await alreadyConsumed(prisma, 'e1')).toBe(false);
  });
  it('false (process anyway) on a query error — preserves at-least-once', async () => {
    const prisma = { signalObservation: { findFirst: jest.fn().mockRejectedValue(new Error('db')) } };
    expect(await alreadyConsumed(prisma, 'e1')).toBe(false);
  });
});
