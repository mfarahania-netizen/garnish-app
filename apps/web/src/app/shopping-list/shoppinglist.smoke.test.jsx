import { screen, within, fireEvent } from '@testing-library/react';
import { IconSalad, IconMeat } from '@tabler/icons-react';
import { renderWithProviders } from '../../test/renderWithProviders';
import ShoppingListPage from './page';

vi.mock('./useShopping', () => ({ useShopping: vi.fn() }));
import { useShopping } from './useShopping';

// jsdom in this environment provides no localStorage, which AuthProvider (pulled in by the
// render harness) touches synchronously on mount. The page never reads auth, so replace the
// provider with a passthrough to keep this smoke test scoped + deterministic (no network/storage).
vi.mock('../../context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({ token: '', user: null, isLoading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn() }),
}));

// Baseline matching the hook's return shape so the page never derefs an undefined field.
function baseHook(overrides = {}) {
  return {
    status: 'ready',
    refetch: vi.fn(),
    groups: [],
    total: 0,
    done: 0,
    checkedOf: vi.fn(() => false),
    toggle: vi.fn(),
    remove: vi.fn(),
    addManual: vi.fn(),
    buildFromPlan: vi.fn(),
    clearChecked: vi.fn(),
    clearAll: vi.fn(),
    updateItem: vi.fn(),
    pantryItems: [],
    addToPantry: vi.fn(),
    addPantryName: vi.fn(),
    removeFromPantry: vi.fn(),
    busy: false,
    ...overrides,
  };
}

describe('ShoppingListPage smoke', () => {
  it('renders the loading state', () => {
    useShopping.mockReturnValue(baseHook({ status: 'loading', total: 0, done: 0 }));
    renderWithProviders(<ShoppingListPage />);
    // Header title is present in every state; subtitle shows the weekly-list fallback when total is 0.
    expect(screen.getByText('لیست خرید')).toBeInTheDocument();
    expect(screen.getByText('لیستِ خرید هفته')).toBeInTheDocument();
  });

  it('renders the error state with a retry affordance', () => {
    useShopping.mockReturnValue(baseHook({ status: 'error' }));
    renderWithProviders(<ShoppingListPage />);
    expect(screen.getByText('یه مشکلی پیش اومد')).toBeInTheDocument();
    // Retry affordance.
    expect(screen.getByRole('button', { name: /تلاش دوباره/ })).toBeInTheDocument();
  });

  it('renders the empty state', () => {
    useShopping.mockReturnValue(baseHook({ status: 'empty' }));
    renderWithProviders(<ShoppingListPage />);
    expect(screen.getByText('لیستت خالیه')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ساختن از برنامه/ })).toBeInTheDocument();
  });

  it('renders the ready state with grouped items', () => {
    const groups = [
      {
        key: 'produce',
        label: 'میوه و سبزی',
        Icon: IconSalad,
        order: 1,
        items: [
          { id: 'p1', name: 'گوجه', amount: 2, unit: 'عدد', category: 'vegetable', isChecked: false },
          { id: 'p2', name: 'خیار', amount: 3, unit: 'عدد', category: 'vegetable', isChecked: false },
        ],
      },
      {
        key: 'protein',
        label: 'گوشت و پروتئین',
        Icon: IconMeat,
        order: 2,
        items: [{ id: 'm1', name: 'مرغ', amount: 1, unit: 'کیلو', category: 'meat', isChecked: true }],
      },
    ];
    useShopping.mockReturnValue(
      baseHook({
        status: 'ready',
        groups,
        total: 3,
        done: 1,
        checkedOf: vi.fn((it) => !!it.isChecked),
      }),
    );
    renderWithProviders(<ShoppingListPage />);

    // Group headings (h2) render verbatim from the mock.
    expect(screen.getByRole('heading', { level: 2, name: 'میوه و سبزی' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'گوشت و پروتئین' })).toBeInTheDocument();

    // Item rows render and the checked row exposes its toggle state.
    const checkedRow = screen.getByRole('button', { name: /مرغ/ });
    expect(checkedRow).toHaveAttribute('aria-pressed', 'true');
    expect(within(checkedRow).getByText('گرفتم')).toBeInTheDocument();

    // The manual-add affordance is always present.
    expect(screen.getByRole('button', { name: 'افزودن' })).toBeInTheDocument();
  });

  it('each item is deletable — the trash control calls remove()', () => {
    const remove = vi.fn();
    const groups = [{
      key: 'produce', label: 'میوه و سبزی', Icon: IconSalad, order: 1,
      items: [{ id: 'p1', name: 'گوجه', amount: 2, unit: 'عدد', category: 'vegetable', isChecked: false }],
    }];
    useShopping.mockReturnValue(baseHook({ status: 'ready', groups, total: 1, done: 0, remove }));
    renderWithProviders(<ShoppingListPage />);
    const del = screen.getByRole('button', { name: 'حذف از لیست' });
    expect(del).toBeInTheDocument();
    fireEvent.click(del);
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
