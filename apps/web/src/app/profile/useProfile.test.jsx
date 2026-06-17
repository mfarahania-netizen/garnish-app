import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// REAL-hook test (not a hook-mock smoke test): it executes the actual useProfile body so the
// ready-branch object construction is exercised — exactly the path a mocked-hook smoke test can
// NEVER reach. This is the regression guard for the `allergens`/`allergies` ReferenceError that
// shipped latent (masked while /gamification/me was 500ing) and only fired once ready ran.

const get = vi.fn();
vi.mock('../../lib/apiClient', () => ({ default: { get: (...a) => get(...a) } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ token: 'test-token' }) }));

import { useProfile } from './useProfile';

const ME = { name: 'تست', createdAt: '2024-06-01T00:00:00Z' };
const PROFILE = { maturity: { band: 'developing', overallScore: 0.6 } };
const PREFS = { diet: 'vegetarian', allergies: ['peanut', 'dairy'] };
const GAM = { stats: { totalCooks: 5 }, streak: { currentWeeks: 2 }, achievements: { earned: [{ key: 'a' }, { key: 'b' }] } };

function routeOk(url) {
  if (url === '/users/me') return Promise.resolve({ data: ME });
  if (url === '/profile') return Promise.resolve({ data: PROFILE });
  if (url === '/users/preferences') return Promise.resolve({ data: PREFS });
  if (url === '/gamification/me') return Promise.resolve({ data: GAM });
  return Promise.reject(new Error(`unexpected ${url}`));
}

function wrapper({ children }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useProfile (real hook)', () => {
  it('builds the ready shape — known.allergens is defined (no ReferenceError)', async () => {
    get.mockImplementation(routeOk);
    const { result } = renderHook(() => useProfile(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    // The exact field that crashed before: it must be a real array, localized.
    expect(Array.isArray(result.current.known.allergens)).toBe(true);
    expect(result.current.known.allergens.length).toBe(2);
    expect(result.current.progress).not.toBeNull();
    expect(result.current.progress.totalCooks).toBe(5);
  });

  it('stays ready + degrades when /gamification/me fails (progress=null, allergens still ok)', async () => {
    get.mockImplementation((url) => (url === '/gamification/me' ? Promise.reject(new Error('500')) : routeOk(url)));
    const { result } = renderHook(() => useProfile(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.progress).toBeNull();
    expect(Array.isArray(result.current.known.allergens)).toBe(true);
    expect(result.current.header.cooksText).toBe('');
  });
});
