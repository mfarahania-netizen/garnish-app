import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import RecipeCard from './RecipeCard';

/**
 * FI-STEP-1 — the "علاقه ندارم" control. Renders only on recommendation surfaces (onDismiss provided) and
 * never on allergen cards; tapping it calls onDismiss (which the parent uses to emit recommendation_dismiss
 * + optimistically remove the card) and does NOT trigger onOpen.
 */
describe('RecipeCard — not-interested control (FI-STEP-1)', () => {
  it('renders the dismiss control when onDismiss is provided and calls it on tap (not onOpen)', () => {
    const onDismiss = vi.fn();
    const onOpen = vi.fn();
    renderWithProviders(<RecipeCard title="قورمه سبزی" onDismiss={onDismiss} onOpen={onOpen} />);
    const btn = screen.getByRole('button', { name: /علاقه ندارم/ });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('does NOT render the dismiss control when onDismiss is absent', () => {
    renderWithProviders(<RecipeCard title="قورمه سبزی" onOpen={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /علاقه ندارم/ })).not.toBeInTheDocument();
  });

  it('does NOT render the dismiss control on an allergen card (safety surface, never dismissible)', () => {
    renderWithProviders(<RecipeCard title="میگو پلو" onDismiss={vi.fn()} onOpen={vi.fn()} allergen={{ name: 'میگو', text: '— حساسیت' }} />);
    expect(screen.queryByRole('button', { name: /علاقه ندارم/ })).not.toBeInTheDocument();
  });
});
