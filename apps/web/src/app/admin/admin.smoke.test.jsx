import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import AdminPage from './page';

// Mock the data hook so no network happens; the page reads everything off useAdmin().
vi.mock('./useAdmin', () => ({ useAdmin: vi.fn() }));
import { useAdmin } from './useAdmin';

// The harness wraps in the real AuthProvider, which touches localStorage at mount.
// jsdom in this runner reports localStorage unavailable (no --localstorage-file), so
// stub AuthProvider to a pass-through. The page never calls useAuth() itself (only the
// mocked useAdmin does), so an admin user keeps the logged-in baseline intact.
vi.mock('../../context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    user: { name: 'تست', phone: '09120000000', isAdmin: true },
    token: 't',
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

// Realistic RANGES the header maps over (matches the hook's RANGES constant).
const ranges = [
  { id: 1, label: '۲۴ ساعت' },
  { id: 7, label: '۷ روز' },
  { id: 30, label: '۳۰ روز' },
];

// Complete `d` shape for the ready branch — every field the page dereferences.
const fullData = () => ({
  growth: {
    users: { real: true, value: 1240 },
    cooks: { real: true, value: 312 },
    searches: { real: true, value: 980 },
    ai: { real: false, value: 0 },
  },
  latency: { real: true, p50: 120, p95: 340, total: 500 },
  eventQuality: { real: true, rate: 0.97, sampled: 200 },
  guards: {
    cases: 50,
    blocked: 12,
    byGuard: { ai_safety: 5, prompt_injection: 4, nutrition_claim: 3 },
    source: 'fixture-corpus',
  },
  allergen: { pass: true, leaks: 0, indicator: 'گذراند' },
  notif: { posture: 'dry-run', realSendEnabled: false },
  foodDna: { real: true, bands: { empty: 10, forming: 8, developing: 5, mature: 2 }, sampled: 25 },
  recsys: {
    real: true,
    offline: {
      coverage: { value: 0.82, threshold: 0.5, pass: true, note: '' },
      diversity: { value: 0.64, threshold: 0.5, pass: true, note: '' },
    },
    allergySafety: { pass: true },
  },
  readiness: { jobs: [], destructive: false },
});

const baseHook = (overrides) => ({
  status: 'ready',
  isAdmin: true,
  ranges,
  days: 30,
  setDays: vi.fn(),
  refetchAll: vi.fn(),
  d: fullData(),
  ...overrides,
});

describe('AdminPage smoke', () => {
  it('renders the auth (loading-gate) state', () => {
    useAdmin.mockReturnValue(baseHook({ status: 'auth' }));
    const { container } = renderWithProviders(<AdminPage />);
    // The auth gate renders only a centered Mantine Loader.
    expect(container.querySelector('.mantine-Loader-root')).toBeTruthy();
  });

  it('renders the denied state with a home affordance', () => {
    useAdmin.mockReturnValue(baseHook({ status: 'denied', isAdmin: false }));
    renderWithProviders(<AdminPage />);
    expect(screen.getByRole('heading', { name: 'دسترسی محدود' })).toBeInTheDocument();
    expect(screen.getByText('این بخش فقط برای مدیران است.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'خانه' })).toBeInTheDocument();
  });

  it('renders the loading state with the header chrome', () => {
    useAdmin.mockReturnValue(baseHook({ status: 'loading' }));
    const { container } = renderWithProviders(<AdminPage />);
    expect(screen.getByRole('heading', { name: 'پنل مدیریت' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'به‌روزرسانی' })).toBeInTheDocument();
    expect(container.querySelector('.mantine-Loader-root')).toBeTruthy();
  });

  it('renders the error state with a retry affordance', () => {
    useAdmin.mockReturnValue(baseHook({ status: 'error' }));
    renderWithProviders(<AdminPage />);
    expect(screen.getByText('بارگذاری نشد')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تلاش دوباره' })).toBeInTheDocument();
  });

  it('renders the ready dashboard with its sections', () => {
    useAdmin.mockReturnValue(baseHook({ status: 'ready' }));
    renderWithProviders(<AdminPage />);
    expect(screen.getByRole('heading', { name: 'پنل مدیریت' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'رشد و فعالیت' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ایمنی و انطباق' })).toBeInTheDocument();
    expect(screen.getByText('سامانه آمادهٔ راه‌اندازی')).toBeInTheDocument();
  });
});
