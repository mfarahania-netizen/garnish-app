import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';

// jsdom in this Node runner does not expose localStorage, and the shared harness
// wraps every screen in AuthProvider, which reads localStorage.getItem('token')
// at mount. The global setup stubs matchMedia/ResizeObserver/etc. but not
// localStorage, so provide a minimal in-memory stub here (logged-out baseline:
// getItem('token') → null). Test-file-local; touches no shared file.
if (!globalThis.localStorage) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

// Mock the data hook so no network happens and we can drive each status branch.
vi.mock('./useDiscovery', () => ({ useDiscovery: vi.fn() }));
import { useDiscovery } from './useDiscovery';

import DiscoveryPage from './page';

// A complete, realistic baseline matching the hook's return shape. Each test
// overrides `status` (and any branch-specific fields) on top of this.
function baseShape(overrides = {}) {
  return {
    input: '',
    setInput: vi.fn(),
    query: '',
    active: false,
    status: 'browse',
    popular: [],
    forYou: [],
    results: { safe: [], flagged: [], total: 0 },
    filters: {},
    toggleFilter: vi.fn(),
    setQueryNow: vi.fn(),
    clear: vi.fn(),
    refetch: vi.fn(),
    ...overrides,
  };
}

const railItem = (id) => ({
  recipeId: id,
  title: 'قورمه سبزی',
  seed: 123,
  cookTimeText: '۴۵ دقیقه',
  difficultyText: 'متوسط',
});

const resultCard = (id, extra = {}) => ({
  id,
  title: 'کباب کوبیده',
  seed: 456,
  cookTimeText: '۳۰ دقیقه',
  difficultyText: 'آسان',
  reasons: ['کباب', 'گوشت'],
  allergen: null,
  cats: [],
  cookingTime: 30,
  ...extra,
});

describe('DiscoveryPage smoke', () => {
  it('renders the browse state (default, no query) with both rails', () => {
    useDiscovery.mockReturnValue(
      baseShape({
        status: 'browse',
        popular: [railItem('p1'), railItem('p2')],
        forYou: [railItem('f1')],
      }),
    );

    renderWithProviders(<DiscoveryPage />);

    // search bar is always present
    expect(screen.getByRole('searchbox', { name: 'جستجو' })).toBeInTheDocument();
    // browse landmarks (rail titles, verbatim from source)
    expect(screen.getByRole('heading', { name: 'دستهٔ وعده' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'محبوب‌ها' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'بر اساس آشپزخونه‌ات' })).toBeInTheDocument();
  });

  it('renders the loading state while a search is in flight', () => {
    useDiscovery.mockReturnValue(baseShape({ status: 'loading', active: true, query: 'سوشی' }));

    renderWithProviders(<DiscoveryPage />);

    // search bar still present; no browse heading while loading
    expect(screen.getByRole('searchbox', { name: 'جستجو' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'محبوب‌ها' })).not.toBeInTheDocument();
  });

  it('renders the error state with a retry affordance', () => {
    const refetch = vi.fn();
    useDiscovery.mockReturnValue(
      baseShape({ status: 'error', active: true, query: 'کباب', refetch }),
    );

    renderWithProviders(<DiscoveryPage />);

    expect(screen.getByRole('heading', { name: 'جستجو در دسترس نیست' })).toBeInTheDocument();
    // the single retry affordance (button label verbatim from ErrorState default)
    expect(screen.getByRole('button', { name: /تلاش دوباره/ })).toBeInTheDocument();
  });

  it('renders the no-results (unmet search) state for the queried term', () => {
    useDiscovery.mockReturnValue(
      baseShape({ status: 'noresults', active: true, query: 'سوشی' }),
    );

    renderWithProviders(<DiscoveryPage />);

    // heading interpolates the query verbatim: «{query}» رو پیدا نکردیم
    expect(screen.getByRole('heading', { name: '«سوشی» رو پیدا نکردیم' })).toBeInTheDocument();
  });

  it('renders the results state with safe and flagged cards', () => {
    useDiscovery.mockReturnValue(
      baseShape({
        status: 'results',
        active: true,
        query: 'کباب',
        results: {
          safe: [resultCard('r1')],
          flagged: [resultCard('r2', { title: 'املت', allergen: 'تخم‌مرغ' })],
          total: 2,
        },
      }),
    );

    renderWithProviders(<DiscoveryPage />);

    // result count line ("۲ نتیجه") + the demote-not-hidden divider, both verbatim
    expect(screen.getByText('۲ نتیجه')).toBeInTheDocument();
    expect(screen.getByText('برای ایمنی پایین‌تر')).toBeInTheDocument();
    // a result card rendered
    expect(screen.getByRole('heading', { name: 'کباب کوبیده' })).toBeInTheDocument();
  });
});
