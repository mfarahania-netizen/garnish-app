import { render, screen } from '@testing-library/react';
import { RouteFallback, createAppQueryClient, shouldRetryQuery } from './App';

describe('app performance foundation', () => {
  it('uses a calm announced route fallback', () => {
    render(<RouteFallback />);
    expect(screen.getByRole('status')).toHaveTextContent('در حال آماده‌سازی صفحه');
  });

  it('keeps queries briefly fresh and retries only transient failures once', () => {
    const client = createAppQueryClient();
    const defaults = client.getDefaultOptions();
    expect(defaults.queries).toMatchObject({
      staleTime: 30_000,
      gcTime: 300_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    });
    expect(defaults.queries.retry).toBe(shouldRetryQuery);
    expect(shouldRetryQuery(0, { response: { status: 503 } })).toBe(true);
    expect(shouldRetryQuery(1, { response: { status: 503 } })).toBe(false);
    expect(shouldRetryQuery(0, { response: { status: 401 } })).toBe(false);
    expect(defaults.mutations.retry).toBe(false);
    client.clear();
  });
});
