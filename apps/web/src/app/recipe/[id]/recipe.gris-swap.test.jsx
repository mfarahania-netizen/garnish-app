import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';

// GRIS v2.1: tapping «جایگزین؟» on a GRIS ingredient surfaces the recipe's OWN dish-aware swaps first
// («پیشنهادِ این دستور») — the founder's complaint («گوشت گوسفند → باید گوساله/مغز/قارچ باشد»).
const GRIS = {
  story: { hook: 'یک خورش اصیل' },
  glance: { servings: 4, activeTimeMin: 35, totalTimeMin: 210 },
  ingredients: [
    { ingredientId: 'ing_lamb_shank_raw', name: 'ماهیچه گوسفندی', weightG: 650, volume: '۲ تکهٔ بزرگ', role: 'پروتئین اصلی', component: 'خورش', swap: 'گردن گوسفند یا ماهیچه گاو', swaps: [
      { ingredientId: 'ing_lamb_neck_raw', name: 'گردن گوسفند', note: 'هم‌نقش؛ کمی چرب‌تر' },
      { ingredientId: 'ing_beef_shank_raw', name: 'ماهیچه گاو', note: 'زمان پخت کمی بیشتر' },
    ] },
  ],
  steps: [{ order: 1, title: 'پخت', instruction: 'ماهیچه را بپزید', flame: 'low', durationMin: 180, usesIngredientIds: ['ing_lamb_shank_raw'] }],
};
const READY = {
  id: 'g1', title: 'دیزی', imageUrl: null, categories: [], cookTimeText: '۳ ساعت', difficultyText: 'متوسط',
  servingsText: '۴ نفر', description: '', author: '', ingredients: [], steps: [], tips: [], faq: [], tools: [],
  mealTypes: [], chefTips: [], commonMistakes: [], servingSuggestions: [], authoredSwaps: [],
};
vi.mock('./useRecipeDetail', () => ({
  useRecipeDetail: () => ({ status: 'ready', recipe: READY, nutrition: { calories: null, state: 'unavailable' }, fit: null, substitutions: [], integrity: null, gris: GRIS, refetch: vi.fn() }),
}));
vi.mock('../../../components/ges/substitution', () => ({
  fetchSubstitutions: vi.fn(async () => ({ items: [{ name: 'گوشت بز', basis: 'explicit_option', reason: 'هم‌نقش پروتئینی' }], resolvedId: 'ing_goat', resultStatus: 'ok' })),
  qualityOf: (b) => (b === 'authored' ? { label: 'پیشنهادِ این دستور', rank: 0 } : { label: 'جایگزین مطمئن', rank: 1 }),
}));
vi.mock('../../../lib/apiClient', () => ({ default: { post: vi.fn(async () => ({ data: { nutrition: { perServing: null, coverage: 'none' }, notes: [] } })), get: vi.fn(async () => ({ data: {} })) } }));
vi.mock('../../../hooks/useAnalytics', () => ({ useAnalytics: () => ({ trackEvent: vi.fn() }) }));
vi.mock('../../../hooks/useFavoritesQuery', () => ({ useFavoritesQuery: () => ({ isFavorite: () => false, addFavorite: vi.fn(), removeFavorite: vi.fn() }) }));
vi.mock('../../../context/AuthContext', () => ({ AuthProvider: ({ children }) => children, useAuth: () => ({ token: 'test-token', user: null, isLoading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn() }) }));

import RecipeDetailPage from './page';
const renderPage = () => renderWithProviders(<RecipeDetailPage />, { route: '/recipe/g1', path: '/recipe/:id' });
beforeEach(() => sessionStorage.clear());

describe('Recipe Detail — GRIS dish-aware swap sheet (v2.1)', () => {
  it('clicking «جایگزین؟» shows the recipe’s own dish-aware swaps first, labeled «پیشنهادِ این دستور»', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'جایگزین برای ماهیچه گوسفندی' }));
    // dish-authored swaps render immediately (no fetch needed) with the dish label
    expect(await screen.findByText('گردن گوسفند')).toBeInTheDocument();
    expect(screen.getByText('ماهیچه گاو')).toBeInTheDocument();
    expect(screen.getAllByText('پیشنهادِ این دستور').length).toBeGreaterThan(0);
    // applying one swaps the ingredient on the recipe
    fireEvent.click(screen.getByText('گردن گوسفند'));
    expect(await screen.findByText('جایگزین شد: ماهیچه گوسفندی ← گردن گوسفند')).toBeInTheDocument();
  });
});
