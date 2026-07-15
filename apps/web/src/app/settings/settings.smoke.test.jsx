import { fireEvent, screen } from '@testing-library/react';
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
  consentStatus: 'ready',
  refetch: vi.fn(),
  patternOptions: [
    { id: 'omnivore', label: 'همه‌چیزخوار' },
    { id: 'vegan', label: 'وگان' },
  ],
  allergenOptions: [
    { id: 'gluten', label: 'گلوتن' },
    { id: 'dairy', label: 'لبنیات' },
  ],
  legacyAllergenOptions: [],
  pattern: 'omnivore',
  allergens: { gluten: true },
  choosePattern: vi.fn(),
  toggleAllergen: vi.fn(),
  removeLegacyAllergen: vi.fn(),
  notif: { briefing: true, streak: true, reengage: false, quiet: true },
  toggleNotif: vi.fn(),
  consent: { personalization: false, analytics: false },
  consentActive: { personalization: false, analytics: false },
  consentRuntimeAvailable: { personalization: true, analytics: true },
  consentBusy: { personalization: false, analytics: false },
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
    expect(screen.getByRole('switch', { name: 'آمارِ استفادهٔ اختیاری' })).toBeInTheDocument();
    expect(screen.queryByText('آمارِ ناشناس')).not.toBeInTheDocument();
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

  it('keeps a historical deferred allergen visible and removable', () => {
    const shape = readyShape();
    shape.legacyAllergenOptions = [{ id: 'lupin', label: 'لوپین' }];
    useSettings.mockReturnValue(shape);
    renderWithProviders(<SettingsPage />);
    screen.getByRole('button', { name: 'حذف لوپین' }).click();
    expect(shape.removeLegacyAllergen).toHaveBeenCalledWith('lupin');
  });

  it('locks optional consent and exposes a focused retry when canonical state is unknown', () => {
    const shape = readyShape();
    shape.consentStatus = 'error';
    useSettings.mockReturnValue(shape);
    renderWithProviders(<SettingsPage />);

    expect(screen.getByRole('switch', { name: 'آمارِ استفادهٔ اختیاری' })).toBeDisabled();
    screen.getByRole('button', { name: 'تلاش دوباره برای بارگذاری رضایت' }).click();
    expect(shape.refetch).toHaveBeenCalledTimes(1);
  });

  it('marks notification controls as unavailable instead of claiming local choices are operational', () => {
    const shape = readyShape();
    useSettings.mockReturnValue(shape);
    renderWithProviders(<SettingsPage />);

    expect(screen.getByText(/این تنظیمات هنوز به سرویس ارسال اعلان متصل نیستند/)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'بریفینگِ هفتگی' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'بریفینگِ هفتگی' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('switch', { name: 'ساعتِ آرام' })).toBeDisabled();
    expect(shape.toggleNotif).not.toHaveBeenCalled();
  });

  it('requires explicit typed confirmation before permanent account deletion', async () => {
    const shape = readyShape();
    useSettings.mockReturnValue(shape);
    renderWithProviders(<SettingsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'حذف حساب' }));
    expect(await screen.findByRole('dialog', { name: 'حذف دائمی حساب' })).toBeInTheDocument();
    const confirmButton = screen.getByRole('button', { name: 'حذف دائمی حساب' });
    const confirmationInput = screen.getByLabelText(/برای تأیید، عبارت/);
    expect(confirmButton).toBeDisabled();

    fireEvent.change(confirmationInput, { target: { value: 'حذف' } });
    expect(confirmButton).toBeDisabled();
    fireEvent.change(confirmationInput, { target: { value: 'حذف حساب' } });
    expect(confirmButton).toBeEnabled();
    fireEvent.click(confirmButton);

    expect(shape.deleteAccount).toHaveBeenCalledTimes(1);
  });
});
