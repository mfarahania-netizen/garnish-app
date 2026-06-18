import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';

const READY = {
  id: '1', title: 'قورمه سبزی', imageUrl: null, categories: [], cookTimeText: '۹۰ دقیقه',
  difficultyText: 'متوسط', servingsText: '۴ نفر', description: '', author: '',
  ingredients: [], steps: [], tips: [], faq: [], tools: [], mealTypes: [],
};
vi.mock('./useRecipeDetail', () => ({
  useRecipeDetail: () => ({ status: 'ready', recipe: READY, nutrition: { calories: null, state: 'unavailable' }, fit: null, substitutions: [], integrity: null, refetch: vi.fn() }),
}));

const trackEvent = vi.fn();
vi.mock('../../../hooks/useAnalytics', () => ({ useAnalytics: () => ({ trackEvent }) }));

let favState;
vi.mock('../../../hooks/useFavoritesQuery', () => ({ useFavoritesQuery: () => favState }));

vi.mock('../../../context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({ token: 'test-token', user: null, isLoading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn() }),
}));

import RecipeDetailPage from './page';

const renderPage = () => renderWithProviders(<RecipeDetailPage />, { route: '/recipe/1', path: '/recipe/:id' });

beforeEach(() => {
  trackEvent.mockClear();
  favState = { isFavorite: () => false, addFavorite: vi.fn(), removeFavorite: vi.fn() };
});

describe('Recipe Detail — real favorites + recipe_view (FIX1/FIX4)', () => {
  it('fires exactly one recipe_view on mount (logged-in)', () => {
    renderPage();
    const views = trackEvent.mock.calls.filter((c) => c[0] === 'recipe_view');
    expect(views).toEqual([['recipe_view', { recipeId: '1' }]]);
  });

  it('save: confirmation toast + favorite_add fire ONLY after the call succeeds', () => {
    favState.addFavorite = vi.fn((id, opts) => opts?.onSuccess?.()); // simulate a successful write
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره' }));
    expect(favState.addFavorite).toHaveBeenCalledWith('1', expect.any(Object));
    expect(screen.getByText('به ذخیره‌ها اضافه شد')).toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalledWith('favorite_add', { recipeId: '1' });
  });

  it('save: NO success toast / NO favorite_add when the call has not succeeded (gated)', () => {
    favState.addFavorite = vi.fn(); // pending / never invokes onSuccess
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره' }));
    expect(favState.addFavorite).toHaveBeenCalled();
    expect(screen.queryByText('به ذخیره‌ها اضافه شد')).not.toBeInTheDocument();
    expect(trackEvent).not.toHaveBeenCalledWith('favorite_add', expect.anything());
  });
});
