import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';
import CookPage from './page';

// jsdom in this config exposes no Storage (the shared setup stubs matchMedia/
// observers but not localStorage), and AuthProvider reads localStorage.getItem
// at mount. Provide a minimal in-memory Storage so the harness mounts
// logged-out. Local to this test file — no shared file is touched.
if (!('localStorage' in globalThis) || globalThis.localStorage == null) {
  const makeStore = () => {
    const map = new Map();
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
      clear: () => map.clear(),
      key: (i) => [...map.keys()][i] ?? null,
      get length() {
        return map.size;
      },
    };
  };
  Object.defineProperty(globalThis, 'localStorage', { value: makeStore(), configurable: true });
  Object.defineProperty(globalThis, 'sessionStorage', { value: makeStore(), configurable: true });
}

// Mock the data hook so no network happens; each test sets a realistic, complete
// return shape for the state under test.
vi.mock('./useCook', () => ({ useCook: vi.fn() }));
import { useCook } from './useCook';

const renderPage = () =>
  renderWithProviders(<CookPage />, { route: '/cook/1', path: '/cook/:id' });

// A COMPLETE ready-state shape mirroring every field page.jsx dereferences.
// currentStep is intentionally free of any «دقیقه/ساعت» token so stepMinutes()
// returns 0 and the optional StepTimer (a setInterval owner) never mounts —
// keeping the smoke test deterministic.
const readyValue = (over = {}) => ({
  status: 'ready',
  recipe: { id: '1', title: 'خورش قورمه‌سبزی' },
  refetch: vi.fn(),
  step: 0,
  total: 3,
  currentStep: 'سبزی را با کمی روغن تفت بده تا خوش‌رنگ شود.',
  finished: false,
  next: vi.fn(),
  prev: vi.fn(),
  loggedIn: false,
  streakWeeks: 0,
  sheetOpen: false,
  openHelp: vi.fn(),
  closeHelp: vi.fn(),
  help: { loading: false, text: null, error: false },
  ...over,
});

describe('CookPage smoke', () => {
  it('renders the loading state without throwing', () => {
    useCook.mockReturnValue({ status: 'loading', refetch: vi.fn() });
    renderPage();
    // Loading branch is skeleton-only: assert the terminal landmarks are absent.
    expect(screen.queryByText('مراحل بارگذاری نشد')).not.toBeInTheDocument();
    expect(screen.queryByText('کمک برای این مرحله')).not.toBeInTheDocument();
  });

  it('renders the error state with a retry affordance', () => {
    useCook.mockReturnValue({ status: 'error', recipe: null, refetch: vi.fn() });
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'مراحل بارگذاری نشد' }),
    ).toBeInTheDocument();
    expect(screen.getByText('تلاش دوباره')).toBeInTheDocument();
  });

  it('renders the empty state (same fallback) with the retry affordance', () => {
    useCook.mockReturnValue({ status: 'empty', recipe: null, refetch: vi.fn() });
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'مراحل بارگذاری نشد' }),
    ).toBeInTheDocument();
    expect(screen.getByText('تلاش دوباره')).toBeInTheDocument();
  });

  it('renders the no-steps state (recipe present, total 0) without a retry', () => {
    useCook.mockReturnValue(
      readyValue({ total: 0, currentStep: '' }),
    );
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'این دستور مرحله‌ای ثبت‌نشده' }),
    ).toBeInTheDocument();
    // This fallback omits onRetry, so the retry button must NOT render.
    expect(screen.queryByText('تلاش دوباره')).not.toBeInTheDocument();
  });

  it('renders the finished state', () => {
    useCook.mockReturnValue(readyValue({ finished: true }));
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'آفرین — نوشِ جان!' }),
    ).toBeInTheDocument();
  });

  it('renders the ready/step state with the step UI', () => {
    useCook.mockReturnValue(readyValue());
    renderPage();
    expect(screen.getByText('کمک برای این مرحله')).toBeInTheDocument();
    expect(screen.getByText('بعدی')).toBeInTheDocument();
    // Cook now renders inside the app shell (TopBar provides back); the in-cook sub-header shows the
    // recipe title + step counter instead of its own X close.
    expect(screen.getByText('خورش قورمه‌سبزی')).toBeInTheDocument();
    expect(screen.getByText('مرحلهٔ ۱ از ۳')).toBeInTheDocument();
  });
});
