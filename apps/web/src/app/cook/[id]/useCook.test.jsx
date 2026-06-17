import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// FIX 3: finishing the last cook step must emit the CANONICAL `cook_complete` event (the type the
// gamification engine counts) — not the old uncounted `recipe_cooked`.
const trackEvent = vi.fn();
vi.mock('../../../hooks/useAnalytics', () => ({ useAnalytics: () => ({ trackEvent }) }));
vi.mock('../../recipe/[id]/useRecipeDetail', () => ({
  useRecipeDetail: () => ({ status: 'ready', recipe: { id: '1', steps: ['s1', 's2'] }, refetch: vi.fn() }),
}));
vi.mock('../../../lib/apiClient', () => ({ default: { get: vi.fn().mockResolvedValue({ data: {} }) } }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ token: 'test-token' }) }));

import { useCook } from './useCook';

const wrapper = ({ children }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

describe('useCook — finish records the cook', () => {
  it('emits cook_complete (with recipeId) when the last step is finished', () => {
    const { result } = renderHook(() => useCook('1'), { wrapper });
    expect(result.current.total).toBe(2);
    act(() => result.current.next()); // step 0 → 1 (the last step)
    act(() => result.current.next()); // finish
    expect(result.current.finished).toBe(true);
    expect(trackEvent).toHaveBeenCalledWith('cook_complete', { recipeId: '1' });
    // never the old uncounted type
    expect(trackEvent).not.toHaveBeenCalledWith('recipe_cooked', expect.anything());
  });
});
