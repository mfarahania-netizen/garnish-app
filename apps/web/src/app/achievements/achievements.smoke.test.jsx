import { screen } from '@testing-library/react';
import { IconToolsKitchen2 } from '@tabler/icons-react';
import { renderWithProviders } from '../../test/renderWithProviders';
import AchievementsPage from './page';

// Mock the data hook so no network happens; each test sets a complete, realistic shape.
vi.mock('./useAchievements', () => ({ useAchievements: vi.fn() }));
import { useAchievements } from './useAchievements';

// The render harness wraps in the REAL AuthProvider, which dereferences
// localStorage.getItem('token') unconditionally at mount. localStorage is not available
// in this vitest/jsdom run, so the provider throws before the page renders. Replace it with
// a passthrough provider + a logged-out useAuth. (This page never calls useAuth — only
// useNavigate and useAchievements, which is mocked above.)
vi.mock('../../context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    user: null,
    token: '',
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

// A complete "ready" shape mirroring useAchievements' real return object.
function readyShape(overrides = {}) {
  return {
    status: 'ready',
    refetch: vi.fn(),
    isNewUser: false,
    streak: {
      weeks: 3,
      longest: 5,
      atRisk: true,
      graceUsed: false,
      kindMessage: 'ادامه بده، عالیه!',
      state: 'active',
    },
    badges: [
      { key: 'first_cook', title: 'اولین آشپزی', description: 'اولین غذات رو پختی — شروع عالی!', Icon: IconToolsKitchen2, earned: true },
      { key: 'cook_5', title: '۵ آشپزی', description: '۵ بار آشپزی کردی.', Icon: IconToolsKitchen2, earned: false },
    ],
    earnedCount: 1,
    mastery: { level: 2, levelName: 'آشپز خانگی', progressToNext: 0.4, basis: 'بر اساس ۱۲ پخت' },
    masteryIcon: IconToolsKitchen2,
    ...overrides,
  };
}

describe('AchievementsPage smoke', () => {
  beforeEach(() => {
    useAchievements.mockReset();
  });

  it('renders the loading state', () => {
    useAchievements.mockReturnValue({ status: 'loading', refetch: vi.fn() });
    renderWithProviders(<AchievementsPage />);
    expect(screen.getByRole('status', { name: 'در حال بارگذاری دستاوردها' })).toBeInTheDocument();
  });

  it('renders the error state with a retry affordance', () => {
    const refetch = vi.fn();
    useAchievements.mockReturnValue({ status: 'error', refetch });
    renderWithProviders(<AchievementsPage />);
    expect(screen.getByRole('heading', { name: 'بارگذاری نشد' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /تلاش دوباره/ })).toBeInTheDocument();
  });

  it('renders the new-user empty state', () => {
    useAchievements.mockReturnValue(readyShape({ isNewUser: true }));
    renderWithProviders(<AchievementsPage />);
    expect(screen.getByRole('heading', { name: 'دستاوردها' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'اولین پختت اولین نشانته' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'یه دستور پیدا کن' })).toBeInTheDocument();
  });

  it('renders the ready state for a returning user', () => {
    useAchievements.mockReturnValue(readyShape());
    renderWithProviders(<AchievementsPage />);
    expect(screen.getByRole('heading', { name: 'دستاوردها' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'نشان‌ها' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'مهارت‌ها' })).toBeInTheDocument();
  });
});
