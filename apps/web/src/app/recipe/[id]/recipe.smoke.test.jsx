import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';
import RecipeDetailPage from './page';

// jsdom in this config exposes no Storage (the shared setup stubs matchMedia/
// observers but not localStorage), and AuthProvider reads localStorage.getItem
// at mount. Provide a minimal in-memory Storage so the harness mounts
// logged-out. Local to this test file — no shared file is touched.
if (!('localStorage' in globalThis) || globalThis.localStorage == null) {
  const makeStore = () => {
    const map = new Map();
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
      clear: () => map.clear(),
      key: (i) => [...map.keys()][i] ?? null,
      get length() {
        return map.size;
      },
    };
  };
  Object.defineProperty(globalThis, 'localStorage', { value: makeStore(), configurable: true });
  Object.defineProperty(globalThis, 'sessionStorage', { value: makeStore(), configurable: true });
}

// Mock the data hook so no network happens; each test sets a realistic, complete
// return shape for the state under test.
vi.mock('./useRecipeDetail', () => ({ useRecipeDetail: vi.fn() }));
import { useRecipeDetail } from './useRecipeDetail';

const renderPage = () =>
  renderWithProviders(<RecipeDetailPage />, { route: '/recipe/1', path: '/recipe/:id' });

// A COMPLETE ready-state shape mirroring every field page.jsx dereferences.
const readyValue = () => ({
  status: 'ready',
  recipe: {
    id: '1',
    isLiteFood: false,
    title: 'خورش قورمه‌سبزی',
    imageUrl: null,
    categories: ['غذای اصلی', 'ایرانی'],
    cookTimeText: '۹۰ دقیقه',
    difficultyText: 'متوسط',
    servingsText: '۴ نفر',
    description: 'یک خورش سنتی و خوش‌عطر.',
    author: 'سرآشپز رضا',
    ingredients: [
      { name: 'سبزی قورمه', amountText: '۳۰۰ گرم' },
      { name: 'لوبیا قرمز', amountText: '۱ پیمانه' },
    ],
    steps: ['سبزی را تفت بده.', 'گوشت و لوبیا را اضافه کن.'],
    tips: ['لیمو عمانی را سوراخ کن.'],
    faq: [{ q: 'چقدر بپزد؟', a: 'حدود دو ساعت.' }],
    tools: [],
    mealTypes: [],
    chefTips: [],
    commonMistakes: [],
    servingSuggestions: [],
    authoredSwaps: [],
  },
  nutrition: { calories: '۴۲۰', state: 'estimate' },
  fit: {
    recommendation: 'great_fit',
    label: 'مناسبِ تو',
    reasons: ['کم‌چرب', 'پروتئین بالا'],
    allergens: [],
  },
  substitutions: [],
  integrity: null,
  refetch: vi.fn(),
});

describe('RecipeDetailPage smoke', () => {
  it('renders the loading state without throwing', () => {
    useRecipeDetail.mockReturnValue({ status: 'loading', refetch: vi.fn() });
    renderPage();
    // The loading branch is skeleton-only: assert the terminal states are absent.
    expect(screen.queryByText('دستور بارگذاری نشد')).not.toBeInTheDocument();
    expect(screen.queryByText('بپز')).not.toBeInTheDocument();
  });

  it('renders the error state with a retry affordance', () => {
    useRecipeDetail.mockReturnValue({ status: 'error', refetch: vi.fn() });
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'دستور بارگذاری نشد' }),
    ).toBeInTheDocument();
    expect(screen.getByText('تلاش دوباره')).toBeInTheDocument();
  });

  it('renders the empty state (same fallback) with the retry affordance', () => {
    useRecipeDetail.mockReturnValue({ status: 'empty', refetch: vi.fn() });
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'دستور بارگذاری نشد' }),
    ).toBeInTheDocument();
    expect(screen.getByText('تلاش دوباره')).toBeInTheDocument();
  });

  it('renders the ready state with the recipe and the cook CTA', () => {
    useRecipeDetail.mockReturnValue(readyValue());
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'خورش قورمه‌سبزی' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'مواد لازم' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'روش پخت' }),
    ).toBeInTheDocument();
    expect(screen.getByText('سبزی را تفت بده.')).toBeInTheDocument();
    // nutrition is now a quiet, default-closed disclosure (was a big always-on block)
    expect(
      screen.getByRole('button', { name: /غذایی/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('شروع پخت')).toBeInTheDocument();
    expect(screen.getByText('۲ مرحله پخت')).toBeInTheDocument();
  });

  it('does not show the cook CTA for a simple no-cook recipe', () => {
    const v = readyValue();
    v.recipe.title = 'پنیر و گردو';
    v.recipe.categories = ['میان‌وعده'];
    v.recipe.description = 'یک بشقاب ساده و بدون پخت.';
    v.recipe.ingredients = [{ name: 'پنیر' }, { name: 'گردو' }];
    v.recipe.steps = ['پنیر و گردو را در بشقاب بچین و سرو کن.'];
    useRecipeDetail.mockReturnValue(v);
    renderPage();

    expect(screen.queryByText('بپز')).not.toBeInTheDocument();
    expect(screen.getByText('جزئیات آماده‌سازی')).toBeInTheDocument();
    expect(screen.getByText('۱ مرحله آماده‌سازی')).toBeInTheDocument();
  });

  it('shows an unavailable action, never a working cook CTA, when valid steps are missing', () => {
    const v = readyValue();
    v.recipe.steps = [' ', { instruction: '' }];
    useRecipeDetail.mockReturnValue(v);
    renderPage();

    expect(screen.getByText('مراحل پخت ثبت نشده')).toBeInTheDocument();
    expect(screen.getByText('فعلاً قابل شروع نیست')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'شروع پخت' })).not.toBeInTheDocument();
  });

  it('omits richness sections gracefully when empty (no swaps/tools headings, no fabricated content)', () => {
    useRecipeDetail.mockReturnValue(readyValue());
    renderPage();
    expect(screen.queryByRole('heading', { name: 'جایگزین‌های پیشنهادی' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'ابزار لازم' })).not.toBeInTheDocument();
  });

  it('surfaces the computed richness the UI used to drop: substitutions, tools, mealType, integrity coverage', () => {
    const v = readyValue();
    v.recipe.tools = ['قابلمه', 'هاون'];
    v.recipe.mealTypes = ['شام'];
    v.substitutions = [{ ingredient: 'لوبیا قرمز', reason: 'allergen', options: ['لوبیا چیتی', 'نخود'] }];
    v.integrity = { total: 2, resolved: 2 };
    useRecipeDetail.mockReturnValue(v);
    renderPage();
    // grounded personalized swap (was computed by /full but dropped by the UI before)
    expect(screen.getByRole('heading', { name: 'جایگزین برای حساسیت‌های تو' })).toBeInTheDocument();
    expect(screen.getByText('لوبیا چیتی، نخود')).toBeInTheDocument();
    // tools now live in a disclosure accordion (was an always-on block); expand it to see the tool
    const toolsBtn = screen.getByRole('button', { name: /ابزار لازم/ });
    expect(toolsBtn).toBeInTheDocument();
    fireEvent.click(toolsBtn);
    expect(screen.getByText('قابلمه')).toBeInTheDocument();
    expect(screen.getByText('شام')).toBeInTheDocument();
    expect(screen.getByText('۲ از ۲ ماده در پایگاه شناخته‌شده')).toBeInTheDocument();
  });

  it('S3 Option-2: renders DISTINCT premium sections when authored fields are present (not the merged tips blob)', () => {
    const v = readyValue();
    v.recipe.chefTips = ['کره را آب کن'];
    v.recipe.commonMistakes = ['زیاد هم نزن'];
    v.recipe.servingSuggestions = ['با نان سرو کن'];
    v.recipe.authoredSwaps = ['به‌جای زعفران، زردچوبه'];
    useRecipeDetail.mockReturnValue(v);
    renderPage();
    expect(screen.getByRole('button', { name: /نکات سرآشپز/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /اشتباهات رایج/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /پیشنهاد سرو/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /جایگزین‌ها/ })).toBeInTheDocument();
    // the merged generic tips accordion is NOT shown when distinct sections exist
    expect(screen.queryByRole('button', { name: /^نکته‌ها$/ })).not.toBeInTheDocument();
  });

  it('S3 Option-2: falls back to the merged tips accordion when no distinct fields (back-compat)', () => {
    const v = readyValue(); // chefTips/etc. empty, tips populated
    useRecipeDetail.mockReturnValue(v);
    renderPage();
    expect(screen.getByRole('button', { name: /نکته‌ها/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /نکات سرآشپز/ })).not.toBeInTheDocument();
  });

  it('renders Lite Food through the compact body and does not leak authored/internal richness fields', () => {
    const v = readyValue();
    v.recipe.id = 'garnish_lite_fa_094_fde3c956';
    v.recipe.isLiteFood = true;
    v.recipe.description = 'یک آیتم سریع و سبک برای مصرف روزمره.';
    v.recipe.steps = ['مواد را آماده کن.', 'همان موقع سرو کن.'];
    v.recipe.tips = ['Meal Plan'];
    v.recipe.chefTips = ['ingredientId should never render'];
    v.recipe.commonMistakes = ['unresolved import'];
    v.recipe.servingSuggestions = ['Shopping List'];
    v.recipe.authoredSwaps = ['GRIS metadata database DB'];
    v.recipe.faq = [{ q: 'readyForImport', a: 'source-backed' }];
    useRecipeDetail.mockReturnValue(v);
    renderPage();

    expect(screen.getByRole('heading', { name: 'مواد لازم' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'روش سریع' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /نکات سرآشپز/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /اشتباهات رایج/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /جایگزین‌ها/ })).not.toBeInTheDocument();
    for (const term of ['ingredientId', 'unresolved', 'Meal Plan', 'Shopping List', 'GRIS', 'metadata', 'database', 'DB', 'readyForImport', 'source-backed']) {
      expect(screen.queryByText(new RegExp(term))).not.toBeInTheDocument();
    }
  });
});
