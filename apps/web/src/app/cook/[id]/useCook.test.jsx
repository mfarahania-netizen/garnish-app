import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// FIX 3: finishing the last cook step must emit the CANONICAL `cook_complete` event (the type the
// gamification engine counts) — not the old uncounted `recipe_cooked`.
const trackEvent = vi.fn();
const trackEventConfirmed = vi.fn();
vi.mock('../../../hooks/useAnalytics', () => ({ useAnalytics: () => ({ trackEvent, trackEventConfirmed }) }));
let detailValue = { status: 'ready', recipe: { id: '1', steps: ['s1', 's2'] }, gris: null, refetch: vi.fn() };
vi.mock('../../recipe/[id]/useRecipeDetail', () => ({ useRecipeDetail: () => detailValue }));
vi.mock('../../../lib/apiClient', () => ({ default: { get: vi.fn().mockResolvedValue({ data: {} }) } }));
let authToken = 'test-token';
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ token: authToken }) }));

import { useCook } from './useCook';

const wrapper = ({ children }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

beforeEach(() => {
  vi.clearAllMocks();
  trackEvent.mockImplementation(() => undefined);
  trackEventConfirmed.mockResolvedValue({ id: 'event-1' });
  authToken = 'test-token';
  localStorage.clear();
  sessionStorage.clear();
  detailValue = { status: 'ready', recipe: { id: '1', steps: ['s1', 's2'] }, gris: null, refetch: vi.fn() };
});

describe('useCook — finish records the cook', () => {
  it('finishes only after cook_complete receives a stored first-party acknowledgement', async () => {
    const { result } = renderHook(() => useCook('1'), { wrapper });
    expect(result.current.total).toBe(2);
    await act(async () => { await result.current.next(); }); // step 0 → 1 (the last step)
    await act(async () => { await result.current.next(); }); // await stored completion
    expect(result.current.finished).toBe(true);
    expect(result.current.completion.status).toBe('saved');
    expect(trackEventConfirmed).toHaveBeenCalledWith('cook_complete', { recipeId: '1' });
    // never the old uncounted type
    expect(trackEventConfirmed).not.toHaveBeenCalledWith('recipe_cooked', expect.anything());
  });

  it('does not show a finished state when first-party persistence fails', async () => {
    trackEventConfirmed.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useCook('1'), { wrapper });
    await act(async () => { await result.current.next(); });
    await act(async () => { await result.current.next(); });
    expect(result.current.finished).toBe(false);
    expect(result.current.completion.status).toBe('error');
  });

  it('finishes locally for a guest without claiming persisted completion or accepting feedback', async () => {
    authToken = '';
    const { result } = renderHook(() => useCook('1'), { wrapper });
    await act(async () => { await result.current.next(); });
    await act(async () => { await result.current.next(); });
    expect(result.current.finished).toBe(true);
    expect(result.current.completion.status).toBe('local_only');
    expect(trackEventConfirmed).not.toHaveBeenCalledWith('cook_complete', expect.anything());
    await expect(result.current.submitFeedback('positive')).resolves.toBe(false);
    expect(trackEventConfirmed).not.toHaveBeenCalledWith('feedback_positive', expect.anything());
  });

  it('keeps a confirmed completion saved when secondary recommendation telemetry throws', async () => {
    localStorage.setItem('garnish:rec-attribution', JSON.stringify({
      1: { requestId: 'request-1', ts: Date.now() },
    }));
    trackEvent.mockImplementation((type) => {
      if (type === 'recommendation_cook') throw new Error('posthog unavailable');
    });
    const { result } = renderHook(() => useCook('1'), { wrapper });
    await act(async () => { await result.current.next(); });
    await act(async () => { await result.current.next(); });
    expect(result.current.finished).toBe(true);
    expect(result.current.completion.status).toBe('saved');
    expect(trackEventConfirmed).toHaveBeenCalledWith('cook_complete', { recipeId: '1' });
  });

  it.each([
    ['positive', 'feedback_positive'],
    ['negative', 'feedback_negative'],
  ])('persists %s feedback and marks success only after ack', async (sentiment, eventType) => {
    const { result } = renderHook(() => useCook('1'), { wrapper });
    await act(async () => { await result.current.next(); });
    await act(async () => { await result.current.next(); });
    await act(async () => { await result.current.submitFeedback(sentiment); });
    expect(trackEventConfirmed).toHaveBeenCalledWith(eventType, { recipeId: '1', source: 'cook_finish' });
    expect(result.current.feedback).toEqual({ status: 'saved', sentiment });
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
