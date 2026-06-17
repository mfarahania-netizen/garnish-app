import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import PlanPage from './page';

// isolate the page from real analytics (the delete path fires trackEvent('mealplan_remove'))
vi.mock('../../hooks/useAnalytics', () => ({ useAnalytics: () => ({ trackEvent: vi.fn() }) }));

// jsdom on Node >=20 does not expose window.localStorage unless --localstorage-file
// is passed; the shared harness mounts AuthProvider which reads localStorage.getItem
// at mount. Provide a minimal in-memory stub if (and only if) the environment lacks
// one, so the logged-out AuthProvider baseline can mount. (setup.js does not cover this.)
if (!globalThis.localStorage) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
}

// Mock the data hook so no network happens. Each test sets a complete, realistic
// return shape for the state under test (see useMealPlan return object).
vi.mock('./useMealPlan', () => ({ useMealPlan: vi.fn() }));
import { useMealPlan } from './useMealPlan';

const MEALS = [
  { key: 'lunch', label: 'ناهار' },
  { key: 'dinner', label: 'شام' },
];

// Sat→Fri, 7 columns — the page .map()s m.week.days and reads label/isToday/monthFa/dayFa.
const DAY_LABELS = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
const buildDays = () =>
  DAY_LABELS.map((label, i) => ({
    dayOfWeek: i,
    label,
    dayFa: String(i + 1),
    monthFa: 'تیر',
    isToday: i === 0,
  }));

const baseWeek = { range: '۱ تا ۷ تیر', days: buildDays() };

// A complete base shape; per-test overrides flip the branch under test.
const makeHook = (overrides = {}) => ({
  status: 'ready',
  refetch: vi.fn(),
  week: baseWeek,
  meals: MEALS,
  filled: {},
  suggested: {},
  accepted: {},
  hasPlan: false,
  proposalActive: false,
  proposing: false,
  proposeError: false,
  applying: false,
  propose: vi.fn().mockResolvedValue(true),
  clearProposal: vi.fn(),
  acceptSlot: vi.fn().mockResolvedValue(true),
  acceptAll: vi.fn().mockResolvedValue({ ok: true, failed: 0, total: 0 }),
  removeSlot: vi.fn().mockResolvedValue(true),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PlanPage smoke', () => {
  it('renders the loading state (skeletons under the week header)', () => {
    useMealPlan.mockReturnValue(makeHook({ status: 'loading' }));
    renderWithProviders(<PlanPage />);
    // Header still renders in the loading branch.
    expect(screen.getByRole('heading', { name: 'برنامهٔ هفته' })).toBeInTheDocument();
  });

  it('renders the error state with a retry affordance', () => {
    const refetch = vi.fn();
    useMealPlan.mockReturnValue(makeHook({ status: 'error', refetch }));
    renderWithProviders(<PlanPage />);
    expect(screen.getByRole('heading', { name: 'برنامه بارگذاری نشد' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تلاش دوباره' })).toBeInTheDocument();
  });

  it('renders the empty-week state (no plan, no proposal)', () => {
    useMealPlan.mockReturnValue(makeHook({ hasPlan: false, proposalActive: false }));
    renderWithProviders(<PlanPage />);
    expect(screen.getByRole('heading', { name: 'بیا هفته‌ات رو با هم بچینیم' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'پیشنهاد بده' })).toBeInTheDocument();
  });

  it('renders the ready state with a saved plan (week grid + shopping link)', () => {
    useMealPlan.mockReturnValue(
      makeHook({
        hasPlan: true,
        proposalActive: false,
        filled: {
          '0:lunch': { recipeId: 'r1', title: 'قورمه‌سبزی', cookTimeText: '۹۰ دقیقه' },
        },
      }),
    );
    renderWithProviders(<PlanPage />);
    expect(screen.getByRole('heading', { name: 'برنامهٔ هفته' })).toBeInTheDocument();
    // The "make a shopping list from this plan" card appears for a saved plan.
    expect(screen.getByText('از این برنامه، لیست خرید بساز')).toBeInTheDocument();
  });

  it('renders the active-proposal state with the review bar', () => {
    useMealPlan.mockReturnValue(
      makeHook({
        proposalActive: true,
        hasPlan: false,
        suggested: {
          '0:lunch': { recipeId: 'r2', title: 'عدس‌پلو', conf: 'high', dayOfWeek: 0, mealType: 'lunch' },
        },
      }),
    );
    renderWithProviders(<PlanPage />);
    expect(screen.getByText('این یک پیشنهاد است — بازبینی کن و بپذیر')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'پذیرفتنِ برنامه' })).toBeInTheDocument();
  });

  // FIX 4: the redundant dead "دستیار" header button is gone (one clear «بچین» entry point remains).
  it('does NOT render the removed dead "دستیار" header button', () => {
    useMealPlan.mockReturnValue(makeHook({ hasPlan: false, proposalActive: false }));
    renderWithProviders(<PlanPage />);
    expect(screen.queryByRole('button', { name: 'دستیار' })).not.toBeInTheDocument();
  });

  // FIX 1: a filled slot has a real delete affordance; the success toast is gated on a real success.
  it('delete: tapping × calls removeSlot and shows the success toast ONLY on success', async () => {
    const removeSlot = vi.fn().mockResolvedValue(true);
    useMealPlan.mockReturnValue(makeHook({ hasPlan: true, filled: { '0:lunch': { recipeId: 'r1', title: 'قورمه‌سبزی', cookTimeText: '۹۰ دقیقه' } }, removeSlot }));
    renderWithProviders(<PlanPage />);
    fireEvent.click(screen.getByRole('button', { name: 'حذف از برنامه' }));
    expect(removeSlot).toHaveBeenCalledWith(0, 'lunch');
    expect(await screen.findByText('از برنامه حذف شد')).toBeInTheDocument();
  });

  it('delete: a FAILED delete shows an honest error toast, never a success message', async () => {
    const removeSlot = vi.fn().mockResolvedValue(false);
    useMealPlan.mockReturnValue(makeHook({ hasPlan: true, filled: { '0:lunch': { recipeId: 'r1', title: 'قورمه‌سبزی', cookTimeText: '۹۰ دقیقه' } }, removeSlot }));
    renderWithProviders(<PlanPage />);
    fireEvent.click(screen.getByRole('button', { name: 'حذف از برنامه' }));
    expect(await screen.findByText('حذف نشد، دوباره تلاش کن')).toBeInTheDocument();
    expect(screen.queryByText('از برنامه حذف شد')).not.toBeInTheDocument();
  });

  // FIX 2: the grid renders a breakfast (صبحانه) row when the hook provides the breakfast meal.
  it('renders a breakfast (صبحانه) row', () => {
    useMealPlan.mockReturnValue(makeHook({
      meals: [{ key: 'breakfast', label: 'صبحانه' }, { key: 'lunch', label: 'ناهار' }, { key: 'dinner', label: 'شام' }],
      hasPlan: true,
      filled: { '0:breakfast': { recipeId: 'rb', title: 'املت', cookTimeText: '۱۰ دقیقه' } },
    }));
    renderWithProviders(<PlanPage />);
    expect(screen.getAllByText('صبحانه').length).toBeGreaterThan(0);
  });
});
