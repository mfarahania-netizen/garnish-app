import { sanitizePayload, isKnownEventType } from './payload-sanitizer';

describe('sanitizePayload — analytics ingest privacy (advisor audit)', () => {
  it('drops free-text / PII keys', () => {
    const out = sanitizePayload({
      query: 'مرغ با قارچ برای رضا 0912', message: 'hi my name is Ali', name: 'Ali',
      phone: '09123456789', email: 'a@b.com', note: 'secret', recipeId: 'r1', position: 3,
    });
    expect(out).toEqual({ recipeId: 'r1', position: 3 });
    expect(JSON.stringify(out)).not.toMatch(/مرغ|Ali|0912|secret|a@b/);
  });

  it('keeps structured non-PII signal fields untouched', () => {
    const payload = { recipeId: 'r1', recipeIds: ['a', 'b'], position: 2, propensity: 0.42, requestId: 'req', cooked: true, count: 7 };
    expect(sanitizePayload(payload)).toEqual(payload);
  });

  it('caps over-long strings (free text smuggled under an allowed key)', () => {
    const long = 'x'.repeat(500);
    const out = sanitizePayload({ label: long }) as any;
    expect(out.label.length).toBe(120);
  });

  it('redacts at nested levels and inside arrays', () => {
    const out = sanitizePayload({ ctx: { query: 'private', recipeId: 'r1' }, items: [{ message: 'hi', id: 1 }] }) as any;
    expect(out.ctx).toEqual({ recipeId: 'r1' });
    expect(out.items[0]).toEqual({ id: 1 });
  });

  it('is null-safe and never throws', () => {
    expect(sanitizePayload(null)).toBeNull();
    expect(sanitizePayload(undefined)).toBeNull();
    expect(sanitizePayload('a string')).toBeNull();
    expect(sanitizePayload(42 as any)).toBeNull();
  });
});

describe('isKnownEventType — taxonomy (observe, do not drop)', () => {
  it('recognizes canonical types', () => {
    expect(isKnownEventType('cook_complete')).toBe(true);
    expect(isKnownEventType('recommendation_impression')).toBe(true);
    expect(isKnownEventType('admin_view')).toBe(true);
  });
  it('flags unknown types (caller still stores them)', () => {
    expect(isKnownEventType('totally_made_up_event')).toBe(false);
  });
});
