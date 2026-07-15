import { validate } from 'class-validator';
import { TrackEventDto } from './analytics.controller';

const dto = (overrides: Partial<TrackEventDto> = {}) =>
  Object.assign(new TrackEventDto(), {
    type: 'page_view',
    page: '/settings',
    sessionId: '550e8400-e29b-41d4-a716-446655440000',
    payload: {},
    ...overrides,
  });

describe('TrackEventDto public ingest boundary', () => {
  it('accepts a bounded canonical client event', async () => {
    await expect(validate(dto())).resolves.toEqual([]);
  });

  it('rejects unknown event injection and oversized routing metadata', async () => {
    const errors = await validate(dto({
      type: 'attacker_defined_event',
      page: `/${'x'.repeat(300)}`,
      sessionId: 's'.repeat(129),
    }));
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['type', 'page', 'sessionId']),
    );
  });

  it('rejects a known server-only event forged by an authenticated browser user', async () => {
    const errors = await validate(dto({ type: 'cron_behavior_engine_run' }));
    expect(errors.map((error) => error.property)).toContain('type');
  });

  it.each([
    { page: '/settings?email=person@example.com' },
    { page: '/user/09123456789' },
    { sessionId: 'person@example.com' },
    { sessionId: '09123456789' },
  ])('rejects PII-shaped dedicated routing metadata: %o', async (value) => {
    const errors = await validate(dto(value));
    expect(errors.map((error) => error.property)).toContain(
      'page' in value ? 'page' : 'sessionId',
    );
  });
});
