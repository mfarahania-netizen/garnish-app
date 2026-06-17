import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import FavoritesPage from './page';

// This jsdom run has no localStorage (node started without --localstorage-file),
// and the shared harness mounts the real AuthProvider, which reads
// localStorage.getItem('token') at mount. Provide a minimal in-memory stub so the
// logged-out baseline still works. Guarded so it never clobbers a real one.
if (!globalThis.localStorage) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

// Mock the data hook so no network happens — every test supplies a complete,
// realistic return shape for the status branch it exercises.
vi.mock('./useFavorites', () => ({ useFavorites: vi.fn() }));
import { useFavorites } from './useFavorites';

// The hook always returns this exact object shape; per-state we only vary
// status + the data array that branch reads.
const baseHook = () => ({
  status: 'ready',
  refetch: vi.fn(),
  saved: [],
  suggestions: [],
  unsave: vi.fn().mockResolvedValue(true),
  save: vi.fn().mockResolvedValue(true),
});

describe('FavoritesPage smoke', () => {
  it('renders the loading state', () => {
    useFavorites.mockReturnValue({ ...baseHook(), status: 'loading' });
    renderWithProviders(<FavoritesPage />);
    // The page header is always present.
    expect(screen.getByRole('heading', { level: 1, name: 'علاقه‌مندی‌ها' })).toBeInTheDocument();
  });

  it('renders the error state with a retry affordance', () => {
    useFavorites.mockReturnValue({ ...baseHook(), status: 'error' });
    renderWithProviders(<FavoritesPage />);
    expect(screen.getByText('ذخیره‌ها بارگذاری نشد')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /تلاش دوباره/ })).toBeInTheDocument();
  });

  it('renders the empty state with starter suggestions', () => {
    useFavorites.mockReturnValue({
      ...baseHook(),
      status: 'empty',
      suggestions: [
        { recipeId: 'r1', title: 'خورش قیمه', seed: 12 },
        { recipeId: 'r2', title: 'کوکو سبزی', seed: 34 },
        { recipeId: 'r3', title: 'آش رشته', seed: 56 },
      ],
    });
    renderWithProviders(<FavoritesPage />);
    expect(screen.getByRole('heading', { level: 2, name: 'هنوز چیزی ذخیره نکردی' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /کشفِ دستورها/ })).toBeInTheDocument();
  });

  it('renders the empty state with no suggestions', () => {
    useFavorites.mockReturnValue({ ...baseHook(), status: 'empty', suggestions: [] });
    renderWithProviders(<FavoritesPage />);
    expect(screen.getByRole('heading', { level: 2, name: 'هنوز چیزی ذخیره نکردی' })).toBeInTheDocument();
    expect(screen.getByText('بریم چند دستور کشف کنیم.')).toBeInTheDocument();
  });

  it('renders the ready state with saved recipes', () => {
    useFavorites.mockReturnValue({
      ...baseHook(),
      status: 'ready',
      saved: [
        { recipeId: 'a1', title: 'قورمه‌سبزی', seed: 7, cookTimeText: '۱ ساعت و ۳۰ دقیقه', difficultyText: 'متوسط' },
        { recipeId: 'a2', title: 'زرشک‌پلو با مرغ', seed: 9, cookTimeText: '۴۵ دقیقه', difficultyText: 'آسان' },
      ],
    });
    renderWithProviders(<FavoritesPage />);
    expect(screen.getByRole('heading', { level: 2, name: 'ذخیره‌شده‌ها' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'قورمه‌سبزی' })).toBeInTheDocument();
  });
});
