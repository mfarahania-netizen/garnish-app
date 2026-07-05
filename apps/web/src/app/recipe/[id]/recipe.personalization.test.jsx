import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';

// Phase 2 — applying a substitution actually changes the ingredient on the recipe (was the founder's
// «کلیک هیچ اثری ندارد»). Uses the REAL usePersonalization layer; only the network + data are mocked.
const READY = {
  id: '1', title: 'کوکو سبزی', imageUrl: null, categories: [], cookTimeText: '۹۰ دقیقه',
  difficultyText: 'متوسط', servingsText: '۴ نفر', description: '', author: '',
  ingredients: [{ name: 'کره', amountText: '۲ قاشق' }, { name: 'پیاز', amountText: '۱ عدد' }, { name: 'جعفری اختیاری', amountText: 'کمی' }],
  steps: [], tips: [], faq: [], tools: [], mealTypes: [],
  chefTips: [], commonMistakes: [], servingSuggestions: [], authoredSwaps: [],
};
vi.mock('./useRecipeDetail', () => ({
  useRecipeDetail: () => ({ status: 'ready', recipe: READY, nutrition: { calories: null, state: 'unavailable' }, fit: null, substitutions: [], integrity: null, gris: null, refetch: vi.fn() }),
}));
vi.mock('../../../components/ges/substitution', () => ({
  fetchSubstitutions: vi.fn(async () => ({ items: [{ name: 'روغن زیتون', basis: 'explicit_option', reason: 'جایگزین ثبت‌شده برای کره' }], resolvedId: 'ing_olive_oil', resultStatus: 'ok' })),
  qualityOf: () => ({ label: 'جایگزین مطمئن', rank: 1 }),
}));
vi.mock('../../../lib/apiClient', () => ({ default: { post: vi.fn(async () => ({ data: { nutrition: { perServing: null, coverage: 'none' }, notes: [] } })), get: vi.fn(async () => ({ data: {} })) } }));
vi.mock('../../../hooks/useAnalytics', () => ({ useAnalytics: () => ({ trackEvent: vi.fn() }) }));
vi.mock('../../../hooks/useFavoritesQuery', () => ({ useFavoritesQuery: () => ({ isFavorite: () => false, addFavorite: vi.fn(), removeFavorite: vi.fn() }) }));
vi.mock('../../../context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({ token: 'test-token', user: null, isLoading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn() }),
}));

import RecipeDetailPage from './page';

const renderPage = () => renderWithProviders(<RecipeDetailPage />, { route: '/recipe/1', path: '/recipe/:id' });

beforeEach(() => sessionStorage.clear());

describe('Recipe Detail — apply substitution (Phase 2)', () => {
  it('picking a grounded swap replaces the ingredient name and shows «به‌جای X»', async () => {
    renderPage();
    // open the per-ingredient swap sheet for کره
    fireEvent.click(screen.getByRole('button', { name: 'جایگزین برای کره' }));
    // grounded option + its WHY appear
    const option = await screen.findByText('روغن زیتون');
    expect(screen.getByText('جایگزین ثبت‌شده برای کره')).toBeInTheDocument();
    fireEvent.click(option);
    expect(screen.getByRole('button', { name: /اعمال جایگزین/ })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /اعمال جایگزین/ }));
    expect(await screen.findByText('جایگزین شد: کره ← روغن زیتون')).toBeInTheDocument();
    expect(screen.getByText('به‌جای کره')).toBeInTheDocument();
  });

  it('removing an ingredient marks it «حذف شد» and offers an undo', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'حذف جعفری اختیاری' }));
    expect(await screen.findByText('حذف شد')).toBeInTheDocument();
    // the action flips to a restore affordance
    expect(screen.getByRole('button', { name: 'برگرداندن جعفری اختیاری' })).toBeInTheDocument();
  });
});
