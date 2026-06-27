import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAssistant } from './useAssistant';

// Run the REAL hook (not mocked) so we exercise send() end-to-end. Only the network + analytics are stubbed.
vi.mock('../../hooks/useAnalytics', () => ({ useAnalytics: () => ({ trackEvent: vi.fn() }) }));
vi.mock('../../lib/apiClient', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: {} })), // /ai/conversations, /ai/opener on mount
    post: vi.fn(() => Promise.resolve({ data: { reply: 'برنامهٔ هفته‌ات چیده و ثبت شد.', conversationId: 'c1' } })),
    patch: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

/**
 * REGRESSION GUARD for the founder's live bug: the chat builds a week plan, the slots ARE saved server-side, but the
 * meal-plan screen kept showing its stale React-Query cache (['plan','current']) — so it looked like nothing happened.
 * The fix: useAssistant must invalidate the surfaces a write-action can touch after every reply. This test fails if
 * that invalidation is ever removed.
 */
describe('useAssistant — refreshes action surfaces after a reply', () => {
  it('invalidates the meal-plan / shopping / favorites caches once the chat replies', async () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const wrapper = ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useAssistant(), { wrapper });

    await act(async () => {
      await result.current.send('برنامهٔ کل هفته رو برام بچین');
    });

    const invalidatedKeys = spy.mock.calls.map((c) => c[0]?.queryKey?.[0]).filter(Boolean);
    // the meal-plan screen reads ['plan','current']; invalidating ['plan'] prefix-matches it → it refetches on open.
    expect(invalidatedKeys).toContain('plan');
    expect(invalidatedKeys).toContain('shopping');
    expect(invalidatedKeys).toContain('favorites');
  });
});
