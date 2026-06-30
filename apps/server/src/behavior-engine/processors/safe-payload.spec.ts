import { safeJsonPayload } from './safe-payload';

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
