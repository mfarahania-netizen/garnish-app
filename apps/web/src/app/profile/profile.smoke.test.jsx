import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';

// Mock the data hook so no network happens; we drive every status branch by hand.
vi.mock('./useProfile', () => ({ useProfile: vi.fn() }));
import { useProfile } from './useProfile';

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
    expect(screen.getByText('خروج از حساب')).toBeInTheDocument();
  });

  it('renders the DNA breakdown view', () => {
    useProfile.mockReturnValue(readyShape());
    renderWithProviders(<ProfilePage initialView="dna" />);
    // h1 + section headings verbatim from DnaView.
    expect(screen.getByRole('heading', { level: 1, name: 'شناسهٔ ذائقه' })).toBeInTheDocument();
    expect(screen.getByText('تفکیکِ ابعاد')).toBeInTheDocument();
    expect(screen.getByText('آشتیِ صادقانه')).toBeInTheDocument();
  });
});
