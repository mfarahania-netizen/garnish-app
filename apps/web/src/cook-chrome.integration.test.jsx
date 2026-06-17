import { screen } from '@testing-library/react';
import { renderWithProviders } from './test/renderWithProviders';

// Integration guard for FIX 1: prove the REAL route tree wraps /cook/:id in AppShell, so Cook Mode
// genuinely renders the app TopBar (back chevron) + BottomNav around the cook content. Mounts the
// actual <AppRoutes> (exported from App.jsx) under a MemoryRouter at /cook/1 — not a hand-rebuilt tree.

// Mock the cook data hook so the step view renders deterministically (no network).
vi.mock('./app/cook/[id]/useCook', () => ({ useCook: vi.fn() }));
import { useCook } from './app/cook/[id]/useCook';

// Mock the HTTP client so any chrome query (e.g. the drawer profile) never hits the network.
vi.mock('./lib/apiClient', () => ({ default: { get: vi.fn().mockResolvedValue({ data: {} }), post: vi.fn().mockResolvedValue({ data: {} }) } }));

import { AppRoutes } from './App';

const readyCook = {
  status: 'ready',
  recipe: { id: '1', title: 'خورش قورمه‌سبزی' },
  refetch: vi.fn(),
  step: 0,
  total: 3,
  currentStep: 'سبزی را تفت بده.',
  finished: false,
  next: vi.fn(),
  prev: vi.fn(),
  loggedIn: false,
  streakWeeks: 0,
  sheetOpen: false,
  openHelp: vi.fn(),
  closeHelp: vi.fn(),
  help: { loading: false, text: null, error: false },
};

describe('Cook Mode renders inside the app shell (FIX 1)', () => {
  it('shows the app TopBar (back) + BottomNav around the cook content at /cook/:id', () => {
    useCook.mockReturnValue(readyCook);
    renderWithProviders(<AppRoutes />, { route: '/cook/1' });

    // cook content present
    expect(screen.getByText('مرحلهٔ ۱ از ۳')).toBeInTheDocument();
    // app TopBar present (back chevron on this pushed route) + the wordmark link to home
    expect(screen.getByRole('button', { name: 'بازگشت' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'گارنیش — خانه' })).toBeInTheDocument();
    // app BottomNav present (a primary tab)
    expect(screen.getByRole('link', { name: 'خانه' })).toBeInTheDocument();
  });
});
