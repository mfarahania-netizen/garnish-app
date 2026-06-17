import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import AISheet from './AISheet';

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

  it('swap is handled in-context (no navigation to the generic assistant)', () => {
    renderWithProviders(<AISheet opened onClose={vi.fn()} recipeTitle="کوکو سبزی" baseServings={4} onApplyServings={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'جایگزینِ مواد' }));
    // an in-context, hedged note + a dismiss — never a link/route to the assistant
    expect(screen.getByRole('button', { name: 'باشه' })).toBeInTheDocument();
    expect(screen.queryByText(/دستیار گارنیش/)).not.toBeInTheDocument();
  });

  it('discloses AI + the hedge (disclosed, hedged)', () => {
    renderWithProviders(<AISheet opened onClose={vi.fn()} recipeTitle="کوکو سبزی" baseServings={4} onApplyServings={vi.fn()} />);
    expect(screen.getByText('AI')).toBeInTheDocument();
    expect(screen.getByText(/ممکن است اشتباه کند/)).toBeInTheDocument();
  });
});
