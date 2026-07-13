import { describe, expect, it, vi } from 'vitest';
import { deriveOverviewData, getFailedOverviewSourceIds, retryFailedOverviewSources } from './useAdmin';

describe('deriveOverviewData', () => {
  it('keeps registered, guest, and total user counts distinct', () => {
    const result = deriveOverviewData({
      userStats: { totalUsers: 991, registeredUsers: 15, guestUsers: 976 },
      trends: {
        status: 'real',
        series: {
          cook_complete: [{ count: 2 }, { count: 3 }],
          search_query: [{ count: 7 }],
          ai_message_send: [{ count: 4 }],
        },
      },
    }, 30);

    expect(result.growth.registered).toEqual({ real: true, value: 15 });
    expect(result.growth.guests).toEqual({ real: true, value: 976 });
    expect(result.growth.total).toEqual({ real: true, value: 991 });
    expect(result.growth.cooks.value).toBe(5);
    expect(result.meta.windowDays).toBe(30);
  });

  it('does not present missing user counts as real zeroes', () => {
    const result = deriveOverviewData();
    expect(result.growth.registered).toEqual({ real: false, value: 0 });
    expect(result.growth.guests.real).toBe(false);
  });

  it('returns exact failed source ids and retries only those sources', async () => {
    const healthRefetch = vi.fn().mockResolvedValue({ data: {} });
    const trendsRefetch = vi.fn().mockResolvedValue({ data: {} });
    const queries = {
      health: { isError: false, refetch: healthRefetch },
      safety: { isError: false },
      userStats: { isError: false },
      trends: { isError: true, refetch: trendsRefetch },
      intel: { isError: false },
    };

    expect(getFailedOverviewSourceIds(queries)).toEqual(['activity-trends']);
    await retryFailedOverviewSources(queries);
    expect(trendsRefetch).toHaveBeenCalledOnce();
    expect(healthRefetch).not.toHaveBeenCalled();
  });
});
