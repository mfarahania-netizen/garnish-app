import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import AISheet from './AISheet';

// grounded substitution fetch is mocked so swap tests stay deterministic + offline
vi.mock('./substitution', () => ({
  fetchSubstitutions: vi.fn(async () => ({
    items: [{ name: 'روغن زیتون', basis: 'explicit_option', reason: 'جایگزین ثبت‌شده برای کره' }],
    resolvedId: 'ing_olive_oil',
    resultStatus: 'ok',
  })),
  qualityOf: (basis) => (basis === 'explicit_option' ? { label: 'جایگزین مطمئن', rank: 1 } : { label: 'هم‌نقش', rank: 2 }),
}));

// FIX 2 guard: the recipe «شخصی‌سازی» sheet must PROPOSE in-context (apply/dismiss) and must NEVER
// dump the user into the generic assistant or auto-apply.
describe('AISheet — in-context, proposes-not-auto', () => {
  it('servings: proposes a change and applies only on explicit confirm (no auto-apply)', () => {
    const onApplyServings = vi.fn();
    renderWithProviders(<AISheet opened onClose={vi.fn()} recipeTitle="کوکو سبزی" baseServings={4} onApplyServings={onApplyServings} />);

    // menu → pick servings
    fireEvent.click(screen.getByRole('button', { name: 'تنظیم تعداد نفرات' }));
    // proposal shown, nothing applied yet
    expect(screen.getByText('برای چند نفر تنظیمش کنم؟')).toBeInTheDocument();
    expect(onApplyServings).not.toHaveBeenCalled();
    // explicit confirm applies
    fireEvent.click(screen.getByRole('button', { name: /بله، اعمال کن/ }));
    expect(onApplyServings).toHaveBeenCalledTimes(1);
  });

  it('swap is in-context and Apply is disabled until an option is picked (no navigation, no auto-apply)', () => {
    renderWithProviders(<AISheet opened onClose={vi.fn()} recipeTitle="کوکو سبزی" baseServings={4} onApplyServings={vi.fn()} ingredients={[]} onApplySwap={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'جایگزینِ مواد' }));
    expect(screen.getByText('کدام ماده را جایگزین کنم؟')).toBeInTheDocument();
    // propose-not-auto: the apply button exists but is disabled with nothing picked; no route to the assistant
    expect(screen.getByRole('button', { name: /اعمال جایگزین/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /فعلاً تغییر نده/ })).toBeInTheDocument();
    expect(screen.queryByText(/دستیار گارنیش/)).not.toBeInTheDocument();
  });

  it('swap: pick an ingredient → pick a grounded option → Apply calls onApplySwap with the real target', async () => {
    const onApplySwap = vi.fn();
    renderWithProviders(<AISheet opened onClose={vi.fn()} recipeTitle="کوکو سبزی" baseServings={4} onApplyServings={vi.fn()} ingredients={[{ name: 'کره' }]} onApplySwap={onApplySwap} />);
    fireEvent.click(screen.getByRole('button', { name: 'جایگزینِ مواد' }));
    fireEvent.click(screen.getByRole('button', { name: 'کره' }));
    // grounded option appears, with its WHY
    const option = await screen.findByText('روغن زیتون');
    expect(screen.getByText('جایگزین ثبت‌شده برای کره')).toBeInTheDocument();
    // apply is armed only after picking the option
    fireEvent.click(option);
    fireEvent.click(screen.getByRole('button', { name: /اعمال جایگزین/ }));
    expect(onApplySwap).toHaveBeenCalledWith('کره', 'روغن زیتون', expect.objectContaining({ basis: 'explicit_option' }));
  });

  it('discloses AI + the hedge (disclosed, hedged)', () => {
    renderWithProviders(<AISheet opened onClose={vi.fn()} recipeTitle="کوکو سبزی" baseServings={4} onApplyServings={vi.fn()} />);
    expect(screen.getByText('AI')).toBeInTheDocument();
    expect(screen.getByText(/ممکن است اشتباه کند/)).toBeInTheDocument();
  });
});
