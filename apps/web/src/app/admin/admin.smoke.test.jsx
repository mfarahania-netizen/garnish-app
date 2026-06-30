import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';

// useNarrow() (page.jsx) reads window.matchMedia — jsdom lacks it; polyfill before any mount.
beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = (q) => ({ matches: false, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; } });
  }
});

// Controllable auth state — hoisted so the (hoisted) vi.mock factory can read it.
const { authState } = vi.hoisted(() => ({ authState: { value: null } }));
vi.mock('../../context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => authState.value,
  ONBOARDED_KEY: 'garnish.onboarded',
}));

// Stub the default tab body — the smoke test targets the SHELL (gate / sidebar nav / topbar),
// not recharts + react-query inside each tab.
vi.mock('./tabs/OverviewTab', () => ({ default: () => <div data-testid="tab-overview">overview</div> }));

import AdminPage from './page';

const mk = (over) => ({ user: null, token: '', isLoading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn(), ...over });
const ADMIN = mk({ user: { name: 'تست', isAdmin: true, isGuest: false }, token: 't' });
const GUEST = mk({ user: { isAdmin: false, isGuest: true }, token: 'g' });
const LOADING = mk({ isLoading: true });

describe('AdminPage smoke (sidebar architecture)', () => {
  it('shows a loader while auth resolves', () => {
    authState.value = LOADING;
    const { container } = renderWithProviders(<AdminPage />);
    expect(container.querySelector('.mantine-Loader-root')).toBeTruthy();
  });

  it('shows the admin login card for a non-admin visitor', () => {
    authState.value = GUEST;
    renderWithProviders(<AdminPage />);
    expect(screen.getByText('ورود مدیران')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'پنل مدیریت گارنیش' })).toBeInTheDocument();
  });

  it('renders the sidebar nav + active tab + topbar for an admin', () => {
    authState.value = ADMIN;
    renderWithProviders(<AdminPage />);
    expect(screen.getByRole('button', { name: 'نمای کلی' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'هوش مصنوعی' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ایمنی و انطباق' })).toBeInTheDocument();
    expect(screen.getByTestId('tab-overview')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'به‌روزرسانی' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'خروجی JSON' })).not.toBeInTheDocument();
  });
});
