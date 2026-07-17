import { act, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const trackEvent = vi.hoisted(() => vi.fn());
const posthog = vi.hoisted(() => ({
  __loaded: true,
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
  reset: vi.fn(),
  capture: vi.fn(),
}));
vi.mock('./hooks/useAnalytics', () => ({ useAnalytics: () => ({ trackEvent }) }));
vi.mock('posthog-js', () => ({ default: posthog }));

import { RouteTracker } from './App';
import { disableAnalytics, enableAnalytics } from './lib/analytics-init';

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  trackEvent.mockReset();
  disableAnalytics();
  vi.clearAllMocks();
});

it('collects no navigation/click state before canonical analytics consent', async () => {
  sessionStorage.setItem('g_prevPage', '/account-a');
  sessionStorage.setItem('g_enterTs', String(Date.now() - 1000));
  sessionStorage.setItem('g_clicks', '4');

  render(<MemoryRouter initialEntries={['/settings']}><RouteTracker /></MemoryRouter>);
  act(() => document.dispatchEvent(new MouseEvent('click', { bubbles: true })));

  await waitFor(() => expect(sessionStorage.getItem('g_prevPage')).toBeNull());
  expect(sessionStorage.getItem('g_enterTs')).toBeNull();
  expect(sessionStorage.getItem('g_clicks')).toBeNull();
  expect(trackEvent).not.toHaveBeenCalled();
});

it('starts collecting only after runtime consent is enabled', async () => {
  enableAnalytics();

  render(<MemoryRouter initialEntries={['/settings']}><RouteTracker /></MemoryRouter>);
  await waitFor(() => expect(trackEvent).toHaveBeenCalledWith('page_view', {
    page: '/settings',
    from: null,
  }));
  act(() => document.dispatchEvent(new MouseEvent('click', { bubbles: true })));

  expect(sessionStorage.getItem('g_prevPage')).toBe('/settings');
  expect(sessionStorage.getItem('g_clicks')).toBe('1');
});
