import { describe, expect, it } from 'vitest';
import { deriveUserStatsView } from './UsersTab';

describe('UsersTab stats status', () => {
  it('never turns a failed stats request into zero guests', () => {
    const view = deriveUserStatsView({ isError: true, data: undefined });
    expect(view.queryStatus).toBe('error');
    expect(view.guests).toEqual({ status: 'error', value: undefined });
    expect(view.total.value).toBeUndefined();
  });

  it('distinguishes loading, unavailable fields, and real zeroes', () => {
    expect(deriveUserStatsView({ isLoading: true }).guests.status).toBe('loading');
    expect(deriveUserStatsView({ data: { total: 10 } }).guests.status).toBe('unavailable');
    expect(deriveUserStatsView({ data: { guests: 0 } }).guests).toEqual({ status: 'real', value: 0 });
  });
});
