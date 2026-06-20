import { describe, it, expect } from 'vitest';
import { parseGrisName, swapsList, patchStepText, personalizationSummary } from './personalize';

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
  });

  it('personalizationSummary lists every active change', () => {
    expect(personalizationSummary({ servedFor: 8, swaps: { کره: { to: 'روغن زیتون' } }, removed: ['قارچ'] }))
      .toEqual(['8 نفر', 'کره ← روغن زیتون', 'بدون قارچ']);
    expect(personalizationSummary({})).toEqual([]);
  });
});
