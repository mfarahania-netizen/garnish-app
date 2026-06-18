import { screen } from '@testing-library/react';
import { renderWithProviders } from './test/renderWithProviders';
import { AppRoutes } from './App';

// jsdom here exposes no Storage and AuthProvider reads localStorage at mount; provide a minimal in-memory
// Storage so the routes mount logged-out (legal pages are public). Local to this file (no shared file touched).
if (!('localStorage' in globalThis) || globalThis.localStorage == null) {
  const makeStore = () => {
    const map = new Map();
    return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k), clear: () => map.clear(), key: (i) => [...map.keys()][i] ?? null, get length() { return map.size; } };
  };
  Object.defineProperty(globalThis, 'localStorage', { value: makeStore(), configurable: true });
  Object.defineProperty(globalThis, 'sessionStorage', { value: makeStore(), configurable: true });
}

// The onboarding consent links (target=_blank to /terms and /privacy) previously hit no route → 404.
// These prove the public legal routes now resolve to real pages.
describe('public legal routes — onboarding consent links no longer 404', () => {
  it('/terms resolves to the Terms page (not NotFound)', () => {
    renderWithProviders(<AppRoutes />, { route: '/terms' });
    expect(screen.getByRole('heading', { name: 'شرایط استفاده' })).toBeInTheDocument();
  });

  it('/privacy resolves to the Privacy page (not NotFound)', () => {
    renderWithProviders(<AppRoutes />, { route: '/privacy' });
    expect(screen.getByRole('heading', { name: 'حریم خصوصی' })).toBeInTheDocument();
  });
});
