import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test/renderWithProviders';
import IngredientListSection from './IngredientListSection.jsx';

describe('recipe ingredient section v3 smoke', () => {
  it('renders structured RTL rows without title-dash-prep fallback', () => {
    const onAskSwap = vi.fn();
    const onToggleRemove = vi.fn();

    renderWithProviders(
      <IngredientListSection
        sections={[
          {
            title: 'مواد اصلی',
            items: [
              {
                titleFa: 'پیاز زرد',
                iconKey: 'aromatic',
                amountLabel: 'مقدار: ۱ عدد متوسط',
                preparationLabel: 'حالت آماده‌سازی: نگینی',
                roleLabel: 'نقش: پایهٔ طعم',
                canRemove: false,
                canSubstitute: true,
              },
            ],
          },
        ]}
        renderItemProps={() => ({ canAskSwap: true, canRemove: false, onAskSwap, onToggleRemove })}
      />,
    );

    expect(screen.getByText('پیاز زرد')).toBeInTheDocument();
    expect(screen.queryByText('پیاز زرد — نگینی')).not.toBeInTheDocument();
    expect(screen.getByText('مقدار: ۱ عدد متوسط')).toBeInTheDocument();
    expect(screen.getByText('حالت آماده‌سازی: نگینی')).toBeInTheDocument();
    expect(screen.getByText('نقش: پایهٔ طعم')).toBeInTheDocument();
    expect(screen.getByText('پیاز زرد').closest('[data-ingredient-row="true"]')).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('button', { name: 'جایگزین برای پیاز زرد' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'حذف پیاز زرد' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'جایگزین برای پیاز زرد' }));
    expect(onAskSwap).toHaveBeenCalledTimes(1);
  });

  it('shows remove action only when allowed', () => {
    const onToggleRemove = vi.fn();
    renderWithProviders(
      <IngredientListSection
        sections={[{ title: 'برای سرو', items: [{ titleFa: 'جعفری تازه', iconKey: 'herb', amountLabel: 'مقدار: کمی', canRemove: true }] }]}
        renderItemProps={() => ({ canRemove: true, onToggleRemove })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'حذف جعفری تازه' }));
    expect(onToggleRemove).toHaveBeenCalledTimes(1);
  });
});
