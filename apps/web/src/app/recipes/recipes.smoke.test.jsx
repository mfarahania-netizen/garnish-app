import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';

// Mock the HTTP client so the catalogue query is deterministic (no network). `post` covers the AuthProvider guest
// mint that now runs on mount (logged-out harness) — without it the provider would throw `post is not a function`.
const get = vi.fn();
const post = vi.fn().mockResolvedValue({ data: { token: 'guest-jwt', user: { id: 'g', isGuest: true }, deviceKey: 'dk' } });
vi.mock('../../lib/apiClient', () => ({ default: { get: (...a) => get(...a), post: (...a) => post(...a) } }));

import RecipesPage from './page';

describe('RecipesPage smoke', () => {
  it('renders the catalogue grid from GET /recipes', async () => {
    get.mockResolvedValue({ data: [
      { id: '1', title: 'قورمه سبزی', cookingTime: 90, difficulty: 'medium' },
      { id: '2', title: 'کوکو سبزی', cookingTime: 45, difficulty: 'easy' },
    ] });
    renderWithProviders(<RecipesPage />, { route: '/recipes' });
    expect(screen.getByRole('heading', { level: 1, name: 'رسپی‌ها' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('قورمه سبزی')).toBeInTheDocument());
    expect(screen.getByText('کوکو سبزی')).toBeInTheDocument();
  });

  it('renders the empty state when there are no recipes', async () => {
    get.mockResolvedValue({ data: [] });
    renderWithProviders(<RecipesPage />, { route: '/recipes' });
    await waitFor(() => expect(screen.getByText('فعلاً دستوری نیست')).toBeInTheDocument());
  });

  it('renders an error state with retry on failure', async () => {
    get.mockRejectedValue(new Error('500'));
    renderWithProviders(<RecipesPage />, { route: '/recipes' });
    await waitFor(() => expect(screen.getByText('رسپی‌ها بارگذاری نشد')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /تلاش دوباره/ })).toBeInTheDocument();
  });
});
