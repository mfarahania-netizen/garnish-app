import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import NotificationsPage from './page';

// The harness wraps every screen in AuthProvider, which reads localStorage at mount.
// This jsdom run has no localStorage global, so provide a minimal in-memory stub here
// (the setup file stubs matchMedia/observers but not storage). Logged-out baseline = no token.
if (!globalThis.localStorage) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

// Mock the data hook so no network happens; each test supplies a complete shape.
vi.mock('./useNotifications', () => ({ useNotifications: vi.fn() }));
import { useNotifications } from './useNotifications';

// A trivial icon component matching what the hook's metaFor() would return (n.Icon).
const StubIcon = (props) => <svg data-testid="stub-icon" {...props} />;

// Base shape the page always reads; per-test we override `status` (+ items/unread).
const baseShape = () => ({
  status: 'ready',
  items: [],
  unread: 0,
  refetch: vi.fn(),
  markRead: vi.fn(),
  markAll: vi.fn(),
});

describe('NotificationsPage smoke', () => {
  it('renders the loading state (skeletons)', () => {
    useNotifications.mockReturnValue({ ...baseShape(), status: 'loading' });
    const { container } = renderWithProviders(<NotificationsPage />);
    // Header is always present.
    expect(screen.getByRole('heading', { name: 'اعلان‌ها' })).toBeInTheDocument();
    // Stable signal for loading: the calm skeleton placeholders are rendered.
    expect(container.querySelectorAll('.g-skeleton').length).toBeGreaterThan(0);
  });

  it('renders the error state with a retry affordance', () => {
    const refetch = vi.fn();
    useNotifications.mockReturnValue({ ...baseShape(), status: 'error', refetch });
    renderWithProviders(<NotificationsPage />);
    expect(screen.getByRole('heading', { name: 'اعلان‌ها بارگذاری نشد' })).toBeInTheDocument();
    // Retry affordance.
    expect(screen.getByRole('button', { name: 'تلاش دوباره' })).toBeInTheDocument();
  });

  it('renders the empty state', () => {
    useNotifications.mockReturnValue({ ...baseShape(), status: 'empty' });
    renderWithProviders(<NotificationsPage />);
    expect(screen.getByRole('heading', { name: 'فعلاً خبری نیست' })).toBeInTheDocument();
  });

  it('renders the ready state with notification rows', () => {
    useNotifications.mockReturnValue({
      ...baseShape(),
      status: 'ready',
      unread: 1,
      items: [
        {
          id: 'n1',
          title: 'رکوردت در خطره',
          body: 'امروز هنوز آشپزی نکردی.',
          isRead: false,
          timeText: 'همین حالا',
          recipeId: null,
          Icon: StubIcon,
          tone: 'brand',
        },
        {
          id: 'n2',
          title: 'نشانِ تازه باز شد',
          body: '',
          isRead: true,
          timeText: 'دیروز',
          recipeId: 'r-42',
          Icon: StubIcon,
          tone: 'success',
        },
      ],
    });
    renderWithProviders(<NotificationsPage />);
    // Each row is a button labelled by its title; unread prefixes "خوانده‌نشده، ".
    expect(screen.getByRole('button', { name: 'خوانده‌نشده، رکوردت در خطره' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'نشانِ تازه باز شد' })).toBeInTheDocument();
    // With unread > 0 the "mark all read" affordance is shown.
    expect(screen.getByRole('button', { name: 'همه را خواندم' })).toBeInTheDocument();
  });
});
