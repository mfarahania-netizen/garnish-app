import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import FoodDnaRing from './FoodDnaRing';

const renderRing = (ui) => render(<MantineProvider>{ui}</MantineProvider>);

describe('FoodDnaRing qualitative mode', () => {
  it('renders the same static ornament for different heuristic values', () => {
    const { container, rerender } = renderRing(
      <FoodDnaRing value={0.12} caption="در حال رشد" showValue={false} displayMode="qualitative" />,
    );
    const firstArc = container.querySelector('[data-food-dna-arc="qualitative"]');
    const firstDash = firstArc.getAttribute('stroke-dasharray');

    expect(screen.getByRole('img', { name: 'در حال رشد' })).toHaveAttribute('data-ring-mode', 'qualitative');
    expect(firstArc).not.toHaveAttribute('stroke-dashoffset');

    rerender(
      <MantineProvider>
        <FoodDnaRing value={0.91} caption="در حال رشد" showValue={false} displayMode="qualitative" />
      </MantineProvider>,
    );
    const secondArc = container.querySelector('[data-food-dna-arc="qualitative"]');
    expect(secondArc).toHaveAttribute('stroke-dasharray', firstDash);
    expect(secondArc).not.toHaveAttribute('stroke-dashoffset');
    expect(screen.queryByText(/٪/)).not.toBeInTheDocument();
  });

  it('defaults hidden-value rings to qualitative mode', () => {
    renderRing(<FoodDnaRing value={0.73} caption="در حال شکل‌گیری" showValue={false} />);
    expect(screen.getByRole('img', { name: 'در حال شکل‌گیری' })).toHaveAttribute('data-ring-mode', 'qualitative');
  });
});
