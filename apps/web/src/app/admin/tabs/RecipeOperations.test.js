import { describe, expect, it } from 'vitest';
import { buildRecipeQuery, RECIPE_OPERATIONS_COPY, recipeStatusLabel } from './RecipeOperations';
import { CONTENT_PRODUCT_COPY } from './ContentTab';

describe('RecipeOperations query', () => {
  it('sends only the explicit operational filters and pagination', () => {
    const query = new URLSearchParams(buildRecipeQuery({
      q: '  آش  ', status: 'pending', visibility: 'private', sort: 'title:asc', page: 3, limit: 20,
    }));

    expect(Object.fromEntries(query)).toEqual({
      page: '3', limit: '20', status: 'pending', visibility: 'private', sort: 'title', direction: 'asc', q: 'آش',
    });
    expect(recipeStatusLabel('active')).toBe('فعال');
  });

  it('uses concise Persian product copy while preserving explicit approval meaning', () => {
    const copy = [...Object.values(RECIPE_OPERATIONS_COPY), ...Object.values(CONTENT_PRODUCT_COPY)].join(' ');
    expect(copy).toContain('دستور غذا');
    expect(copy).toContain('نمای لحظه‌ای');
    expect(copy).toContain('مجوز محتوا');
    expect(copy).toContain('گزارش ممیزی');
    expect(copy).toContain('برای همهٔ کاربران قابل مشاهده می‌شود');
    expect(copy).not.toMatch(/رسپی|snapshot|Recipe|capability|audit|UserEvent|privacy-safe|intent|status=active|isPublic=true/);
  });
});
