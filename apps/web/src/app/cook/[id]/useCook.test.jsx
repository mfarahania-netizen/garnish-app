import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// FIX 3: finishing the last cook step must emit the CANONICAL `cook_complete` event (the type the
// gamification engine counts) — not the old uncounted `recipe_cooked`.
const trackEvent = vi.fn();
vi.mock('../../../hooks/useAnalytics', () => ({ useAnalytics: () => ({ trackEvent }) }));
let detailValue = { status: 'ready', recipe: { id: '1', steps: ['s1', 's2'] }, gris: null, refetch: vi.fn() };
vi.mock('../../recipe/[id]/useRecipeDetail', () => ({ useRecipeDetail: () => detailValue }));
vi.mock('../../../lib/apiClient', () => ({ default: { get: vi.fn().mockResolvedValue({ data: {} }) } }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ token: 'test-token' }) }));

import { useCook } from './useCook';

const wrapper = ({ children }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

beforeEach(() => {
  sessionStorage.clear();
  detailValue = { status: 'ready', recipe: { id: '1', steps: ['s1', 's2'] }, gris: null, refetch: vi.fn() };
});

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

describe('useCook — GRIS-aware + personalized (Phase 5)', () => {
  it('cooks from gris.steps with structured duration, not the flat text steps', () => {
    detailValue = {
      status: 'ready',
      recipe: { id: '7', steps: ['flat only'], servingsText: '۴ نفر' },
      gris: { steps: [{ order: 1, title: 'سرخ‌کردن', instruction: 'کره را آب کن', durationMin: 5, flame: 'medium' }] },
      refetch: vi.fn(),
    };
    const { result } = renderHook(() => useCook('7'), { wrapper });
    expect(result.current.isGris).toBe(true);
    expect(result.current.total).toBe(1);
    expect(result.current.currentStep.durationMin).toBe(5); // structured, not regex-parsed
    expect(result.current.currentStep.flame).toBe('medium');
  });

  it('reflects a session swap in the step text', () => {
    sessionStorage.setItem('garnish:personalization:9', JSON.stringify({ swaps: { کره: { to: 'روغن زیتون' } } }));
    detailValue = {
      status: 'ready',
      recipe: { id: '9', steps: [], servingsText: '۴ نفر' },
      gris: { steps: [{ order: 1, instruction: 'کره را آب کن', durationMin: 3 }] },
      refetch: vi.fn(),
    };
    const { result } = renderHook(() => useCook('9'), { wrapper });
    expect(result.current.currentStep.instruction).toBe('روغن زیتون را آب کن');
  });
});
