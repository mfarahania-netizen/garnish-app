import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// REAL-hook test (FE-PLAN-AND-MODALS): exercises the actual useMealPlan body — breakfast meal row,
// the propose() body, and removeSlot()'s real DELETE + honest success/failure contract.

const get = vi.fn();
const post = vi.fn();
const del = vi.fn();
vi.mock('../../lib/apiClient', () => ({
  default: { get: (...a) => get(...a), post: (...a) => post(...a), delete: (...a) => del(...a) },
}));

import { useMealPlan } from './useMealPlan';

function wrapper({ children }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  del.mockReset();
  get.mockResolvedValue({ data: { slots: [] } });
});

describe('useMealPlan — breakfast + delete (real hook)', () => {
  it('exposes a breakfast meal row first, then lunch + dinner', async () => {
    const { result } = renderHook(() => useMealPlan(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.meals.map((m) => m.key)).toEqual(['breakfast', 'lunch', 'dinner']);
  });

  it('propose() asks the planner for breakfast, lunch AND dinner', async () => {
    post.mockResolvedValue({ data: { slots: [] } });
    const { result } = renderHook(() => useMealPlan(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { await result.current.propose(); });
    expect(post).toHaveBeenCalledWith('/meal-plans/propose', { days: 7, meals: ['breakfast', 'lunch', 'dinner'] });
  });

  it('removeSlot() DELETEs the real slot path and returns true on success', async () => {
    del.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useMealPlan(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    let ok;
    await act(async () => { ok = await result.current.removeSlot(2, 'dinner'); });
    expect(del).toHaveBeenCalledWith('/meal-plans/slots/2/dinner');
    expect(ok).toBe(true);
  });

  it('removeSlot() returns false on failure (never claims a delete that did not happen)', async () => {
    del.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useMealPlan(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    let ok;
    await act(async () => { ok = await result.current.removeSlot(0, 'lunch'); });
    expect(del).toHaveBeenCalledWith('/meal-plans/slots/0/lunch');
    expect(ok).toBe(false);
  });
});
