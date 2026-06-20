import { describe, it, expect } from 'vitest';
import { parseGrisName, swapsList, patchStepText, personalizationSummary, stripGrisIds } from './personalize';

describe('ges/personalize', () => {
  describe('parseGrisName', () => {
    it('splits the human name from the grounding id suffix', () => {
      expect(parseGrisName('گوشت گوسفند خام (خردشده) — ing_lamb_meat_raw')).toEqual({ display: 'گوشت گوسفند خام (خردشده)', ingredientId: 'ing_lamb_meat_raw' });
    });
    it('leaves a plain name untouched', () => {
      expect(parseGrisName('پیاز')).toEqual({ display: 'پیاز', ingredientId: null });
    });
  });

  it('swapsList flattens the swaps map to {from,to} pairs', () => {
    expect(swapsList({ کره: { to: 'روغن زیتون' }, x: { to: '' } })).toEqual([{ from: 'کره', to: 'روغن زیتون' }]);
  });

  describe('patchStepText', () => {
    it('rewrites an exact ingredient reference and notes removals', () => {
      const r = patchStepText('کره را آب کن و قارچ را اضافه کن', [{ from: 'کره', to: 'روغن زیتون' }], ['قارچ']);
      expect(r.text).toBe('روغن زیتون را آب کن و قارچ را اضافه کن');
      expect(r.caveats).toContain('بدون قارچ');
      expect(r.changed).toBe(true);
    });
    it('is a no-op when nothing matches', () => {
      const r = patchStepText('پیاز را سرخ کن', [{ from: 'کره', to: 'روغن' }], []);
      expect(r).toEqual({ text: 'پیاز را سرخ کن', caveats: [], changed: false });
    });
    it('matches the core word when the step uses a short form (remove cascade)', () => {
      // step says «گوشت», removed ingredient is the full «گوشت گوسفند خام (خردشده/قیمه‌ای)»
      const r = patchStepText('گوشت را تفت دهید تا رنگ بگیرد', [], ['گوشت گوسفند خام (خردشده/قیمه‌ای)']);
      expect(r.caveats).toContain('بدون گوشت');
      expect(r.changed).toBe(true);
    });
    it('swaps the core word in a step (swap cascade)', () => {
      const r = patchStepText('گوشت را تفت دهید', [{ from: 'گوشت گوسفند خام (خردشده/قیمه‌ای)', to: 'گوشت گوساله' }], []);
      expect(r.text).toBe('گوشت گوساله را تفت دهید');
    });
  });

  describe('stripGrisIds — authoring-metadata scrub', () => {
    it('removes a leaked «(اصلاح واحد منبع …)» note', () => {
      expect(stripGrisIds('۱/۴ قاشق چای‌خوری ساییده (اصلاح واحد منبع از «۲ قاشق غذاخوری»)')).toBe('۱/۴ قاشق چای‌خوری ساییده');
    });
  });

  describe('stripGrisIds', () => {
    it('removes an embedded «با ing_xxx» phrase from free GRIS text', () => {
      expect(stripGrisIds('چلو یا کتهٔ ایرانی (برنج سفید با ing_basmati_rice_raw) · سبزی')).toBe('چلو یا کتهٔ ایرانی (برنج سفید) · سبزی');
    });
    it('removes a bare/suffix id token and leaves clean text', () => {
      expect(stripGrisIds('گوشت گوساله — ing_veal_meat_raw')).toBe('گوشت گوساله');
      expect(stripGrisIds('سبزی خوردن و ترشی')).toBe('سبزی خوردن و ترشی');
    });
  });

  it('personalizationSummary lists every active change', () => {
    expect(personalizationSummary({ servedFor: 8, swaps: { کره: { to: 'روغن زیتون' } }, removed: ['قارچ'] }))
      .toEqual(['۸ نفر', 'کره ← روغن زیتون', 'بدون قارچ']);
    expect(personalizationSummary({})).toEqual([]);
  });
});
