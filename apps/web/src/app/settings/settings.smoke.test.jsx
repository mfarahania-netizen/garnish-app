import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import SettingsPage from './page';

// Mock the data hook so no network happens; each test sets a realistic shape.
vi.mock('./useSettings', () => ({ useSettings: vi.fn() }));
import { useSettings } from './useSettings';

// The harness wraps in the REAL AuthProvider, which dereferences
// localStorage.getItem('token') unguarded at mount — and jsdom's localStorage is
// not available in this Vitest setup (--localstorage-file not provided), so it
// throws before the page can render. The page itself never calls useAuth (only
// the now-mocked useSettings hook does), so a passthrough AuthProvider is a safe,
// faithful substitute that lets the page mount.
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

// A complete, realistic READY shape covering every field the page dereferences.
const readyShape = () => ({
  status: 'ready',
  refetch: vi.fn(),
  patternOptions: [
    { id: 'omnivore', label: 'همه‌چیزخوار' },
    { id: 'vegan', label: 'وگان' },
  ],
  allergenOptions: [
    { id: 'gluten', label: 'گلوتن' },
    { id: 'dairy', label: 'لبنیات' },
  ],
  pattern: 'omnivore',
  allergens: { gluten: true },
  choosePattern: vi.fn(),
  toggleAllergen: vi.fn(),
  notif: { briefing: true, streak: true, reengage: false, quiet: true },
  toggleNotif: vi.fn(),
  consent: { personalization: false, analytics: false },
  toggleConsent: vi.fn(),
  account: { phone: '09120000000', email: 'test@example.com' },
  exportData: vi.fn(),
  deleteAccount: vi.fn(),
  busy: false,
  toast: null,
});

describe('SettingsPage smoke', () => {
  it('renders the ready state with the page heading and sections', () => {
    useSettings.mockReturnValue(readyShape());
    renderWithProviders(<SettingsPage />);
    // h1 landmark, copied verbatim from the page source.
    expect(screen.getByRole('heading', { level: 1, name: 'تنظیمات' })).toBeInTheDocument();
    // a section head + a chip option from the realistic shape.
    expect(screen.getByRole('heading', { level: 2, name: 'پروفایل غذایی' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'وگان' })).toBeInTheDocument();
  });

  it('renders the loading state (skeletons, no throw)', () => {
    useSettings.mockReturnValue({ ...readyShape(), status: 'loading' });
    const { container } = renderWithProviders(<SettingsPage />);
    expect(container.querySelector('.g-skeleton')).toBeInTheDocument();
    // none of the ready landmarks should be present
    expect(screen.queryByRole('heading', { level: 1, name: 'تنظیمات' })).not.toBeInTheDocument();
  });

  it('renders the error state with a retry affordance', () => {
    useSettings.mockReturnValue({ ...readyShape(), status: 'error' });
    renderWithProviders(<SettingsPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'تنظیمات بارگذاری نشد' })).toBeInTheDocument();
    // retry button label copied verbatim from source.
    expect(screen.getByRole('button', { name: 'تلاش دوباره' })).toBeInTheDocument();
  });
});
