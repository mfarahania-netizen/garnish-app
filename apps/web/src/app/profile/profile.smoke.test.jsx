import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';

// Mock the data hook so no network happens; we drive every status branch by hand.
vi.mock('./useProfile', () => ({ useProfile: vi.fn() }));
import { useProfile } from './useProfile';
vi.mock('../../hooks/useAnalytics', () => ({ useAnalytics: () => ({ trackEvent: vi.fn() }) }));

// The render harness wraps in the REAL AuthProvider, which dereferences
// localStorage.getItem('token') unconditionally at mount. localStorage is not available
// in this vitest/jsdom run (node warns "--localstorage-file was not provided"), so the
// provider throws before the page renders. Replace it with a passthrough provider + a
// logged-out useAuth (the page only reads { logout } from useAuth, safely destructured).
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

import ProfilePage from './page';

// A realistic, COMPLETE "ready" shape — every field the page dereferences:
// header.*, dna.{score,bandLabel,traits[],forming,breakdown[],reconciliation}, progress.*, known.{dietLabel,allergens[]}.
function readyShape() {
  return {
    status: 'ready',
    refetch: vi.fn(),
    header: {
      name: 'تست کاربر',
      avatar: null,
      isGuest: false,
      initial: 'ت',
      since: 'خرداد ۱۴۰۳',
      cooksText: '۱۲ دستور پخته',
      streakWeeks: 3,
    },
    dna: {
      band: 'developing',
      bandLabel: 'در حال رشد',
      score: 0.62,
      traits: ['تند', 'گیاهی', 'سریع'],
      breakdown: [
        { key: 'spice', label: 'تندی', value: 0.7, band: 'high' },
        { key: 'effort', label: 'سادگی', value: 0.4, band: 'med' },
        { key: 'novelty', label: 'تازگی', value: 0.2, band: 'low' },
      ],
      reconciliation: { specific: true, declared: 'گیاه‌خوار', observed: 'مرغ' },
      forming: false,
    },
    progress: {
      streakWeeks: 3,
      totalCooks: 12,
      badges: 4,
    },
    known: {
      dietLabel: 'گیاه‌خوار',
      allergens: ['بادام‌زمینی', 'لبنیات'],
    },
    control: {
      allergyGuardActive: true,
      personalizationGranted: true,
      completeness: 62,
    },
  };
}

describe('ProfilePage smoke', () => {
  it('renders the loading skeleton without throwing', () => {
    useProfile.mockReturnValue({ status: 'loading', refetch: vi.fn() });
    const { container } = renderWithProviders(<ProfilePage initialView="profile" />);
    // No ready/error landmarks should appear in the skeleton state.
    expect(container.firstChild).toBeTruthy();
    expect(screen.queryByText('پیشرفتِ تو')).not.toBeInTheDocument();
    expect(screen.queryByText('پروفایل بارگذاری نشد')).not.toBeInTheDocument();
  });

  it('renders the error state with a retry affordance', () => {
    useProfile.mockReturnValue({ status: 'error', refetch: vi.fn() });
    renderWithProviders(<ProfilePage initialView="profile" />);
    // Verbatim title from page.jsx, plus the retry button label from ErrorState.
    expect(screen.getByText('پروفایل بارگذاری نشد')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تلاش دوباره' })).toBeInTheDocument();
  });

  it('renders the ready profile view', () => {
    useProfile.mockReturnValue(readyShape());
    renderWithProviders(<ProfilePage initialView="profile" />);
    // h1 = header.name; section headings are verbatim from ProfileView.
    expect(screen.getByRole('heading', { level: 1, name: 'تست کاربر' })).toBeInTheDocument();
    expect(screen.getByText('پیشرفتِ تو')).toBeInTheDocument();
    expect(screen.getByText('آنچه از تو می‌دانیم')).toBeInTheDocument();
    expect(screen.getByText('دسترسی سریع')).toBeInTheDocument();
    expect(screen.queryByText('تاریخچهٔ پخت')).not.toBeInTheDocument();
    expect(screen.getByText('خروج از حساب')).toBeInTheDocument();
  });

  it('opens a real profile edit dialog from the pencil button', () => {
    useProfile.mockReturnValue(readyShape());
    renderWithProviders(<ProfilePage initialView="profile" />);
    fireEvent.click(screen.getByRole('button', { name: 'ویرایش پروفایل' }));
    expect(screen.getByText('ویرایش پروفایل')).toBeInTheDocument();
    expect(screen.getByLabelText('نام نمایشی')).toHaveValue('تست کاربر');
  });

  it('degrades honestly when gamification is unavailable (null progress)', () => {
    // Secondary /gamification/me failed → the hook keeps status 'ready' (critical reads ok) but
    // sets progress=null + cooksText=''. The page must still render + show the honest unavailable
    // note instead of zeroed stat cards or a blanked screen.
    const shape = readyShape();
    shape.progress = null;
    shape.header.cooksText = '';
    shape.header.streakWeeks = 0;
    useProfile.mockReturnValue(shape);
    renderWithProviders(<ProfilePage initialView="profile" />);
    expect(screen.getByRole('heading', { level: 1, name: 'تست کاربر' })).toBeInTheDocument();
    expect(screen.getByText('پیشرفتِ تو')).toBeInTheDocument();
    expect(screen.getByText('پیشرفتت این لحظه در دسترس نیست — کمی بعد دوباره سر بزن.')).toBeInTheDocument();
    // No fabricated "پخته‌شده" stat-card label should appear when progress is null.
    expect(screen.queryByText('پخته‌شده')).not.toBeInTheDocument();
  });

  it('shows Food DNA as a summary card, not a duplicate internal detail view', () => {
    useProfile.mockReturnValue(readyShape());
    renderWithProviders(<ProfilePage initialView="dna" />);
    expect(screen.getByRole('button', { name: 'شناسهٔ ذائقه — مشاهده جزئیات' })).toBeInTheDocument();
    expect(screen.queryByText('تفکیکِ ابعاد')).not.toBeInTheDocument();
    expect(screen.queryByText('آشتیِ صادقانه')).not.toBeInTheDocument();
  });
});
