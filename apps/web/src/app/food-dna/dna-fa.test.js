import { describe, it, expect } from 'vitest';
import {
  DNA_TITLE_FA, bandFa, bandLineFa, dimFa, dimLineFa, metricFa,
  questionPromptFa, questionOptionsFa, summaryFa,
} from './dna-fa';

describe('dna-fa localization', () => {
  describe('bandLineFa', () => {
    it('never uses the English trustGuidance; returns Persian per band', () => {
      expect(bandLineFa('empty')).toMatch(/تازه شروع شده/);
      expect(bandLineFa('mature')).toMatch(/روشن/);
      expect(bandLineFa('developing')).not.toMatch(/reasonable to personalize/);
    });
    it('includes the evidence count when > 0', () => {
      const line = bandLineFa('developing', 7);
      expect(line).toContain('۷'); // Persian digit
      expect(line).toMatch(/وعدهٔ پخته‌شده/);
    });
    it('unknown band falls back gracefully (no English)', () => {
      expect(bandLineFa('bogus', 0)).toMatch(/بیشتر بپزی/);
    });
  });

  describe('bandFa caption', () => {
    it('maps every known band', () => {
      expect(bandFa('empty').caption).toBe('تازه شروع شده');
      expect(bandFa('forming').caption).toBe('در حالِ شکل‌گیری');
      expect(bandFa('developing').caption).toBe('در حالِ رشد');
      expect(bandFa('mature').caption).toBe('روشن و پخته');
    });
  });

  describe('metricFa', () => {
    it('maps numeric metrics to a calm Persian level, not a bare %', () => {
      expect(metricFa('quickMeal', 0.7)).toBe('علاقه به غذای سریع: زیاد');
      expect(metricFa('quickMeal', 0.4)).toBe('علاقه به غذای سریع: متوسط');
      expect(metricFa('quickMeal', 0.1)).toBe('علاقه به غذای سریع: کم');
    });
    it('maps known flavor tokens to Persian', () => {
      expect(metricFa('flavorPattern', 'smoky/herby')).toBe('طعم‌های پسندیده: دودی و گیاهی');
    });
    it('DROPS unknown metric keys (never leaks the raw English key)', () => {
      expect(metricFa('someUnknownKey', 0.5)).toBeNull();
    });
    it('DROPS a flavor string with any unmapped token (never leaks English)', () => {
      expect(metricFa('flavorPattern', 'smoky/foobar')).toBeNull();
    });
  });

  describe('dimLineFa', () => {
    it('builds Persian from status + evidence, never from English safeExplanation', () => {
      const line = dimLineFa('effort', 'usable', 4);
      expect(line).toMatch(/زمان و حوصله/);
      expect(line).toContain('۴');
      expect(line).not.toMatch(/behavioral signal/);
    });
  });

  describe('questionPromptFa', () => {
    it('maps a known question id to a Persian prompt', () => {
      expect(questionPromptFa({ id: 'dietary.pattern' })).toBe('الگوی غذایی‌ات رو چطور توصیف می‌کنی؟');
    });
    it('falls back to a warm Persian generic, never English, for unknown ids', () => {
      expect(questionPromptFa({ id: 'unknown.thing' })).toMatch(/سلیقه/);
      expect(questionPromptFa({ id: 'unknown.thing' })).not.toMatch(/[A-Za-z]{4,}/);
    });
  });

  describe('questionOptionsFa', () => {
    it('maps dietary.pattern options to Persian labels', () => {
      const opts = questionOptionsFa({ id: 'dietary.pattern', options: ['omnivore', 'vegetarian', 'vegan'] });
      expect(opts).toEqual([
        { key: 'omnivore', label: 'همه‌چیزخوار' },
        { key: 'vegetarian', label: 'گیاهی با تخم‌مرغ و لبنیات' },
        { key: 'vegan', label: 'گیاه‌خوار' },
      ]);
    });
    it('DROPS unmappable options so no English leaks', () => {
      const opts = questionOptionsFa({ id: 'dietary.pattern', options: ['omnivore', 'totally_unknown'] });
      expect(opts).toEqual([{ key: 'omnivore', label: 'همه‌چیزخوار' }]);
    });
  });

  describe('summaryFa', () => {
    it('synthesizes a Persian one-liner from dimension signals', () => {
      const dims = [
        { key: 'taste', confidence: 0.6, metrics: [{ key: 'flavorPattern', value: 'smoky/herby' }] },
        { key: 'effort', confidence: 0.5, metrics: [{ key: 'quickMeal', value: 0.7 }] },
      ];
      expect(summaryFa(dims)).toMatch(/دودی و گیاهی/);
      expect(summaryFa(dims)).toMatch(/سریع می‌پزی/);
    });
    it('returns empty when there is too little signal', () => {
      expect(summaryFa([])).toBe('');
      expect(summaryFa([{ key: 'taste', confidence: 0, metrics: [] }])).toBe('');
    });
  });

  it('the page title is one consistent Persian name', () => {
    expect(DNA_TITLE_FA).toBe('شناسهٔ ذائقهٔ تو');
  });
});
