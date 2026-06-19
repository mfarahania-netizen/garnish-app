import { describe, it, expect } from 'vitest';
import { extractBaseServings, parseQuantity, formatQuantity, scaleAmountText, scaleWeightG } from './scaling';

// The deterministic core of the recipe-personalization layer — every scaling feature relies on these.
describe('ges/scaling', () => {
  describe('extractBaseServings', () => {
    it('reads the count from Persian/Latin servings text', () => {
      expect(extractBaseServings('۴ نفر')).toBe(4);
      expect(extractBaseServings('Serves 6')).toBe(6);
      expect(extractBaseServings('۱۲ نفر')).toBe(12);
    });
    it('falls back (default 4) when no count is present', () => {
      expect(extractBaseServings('')).toBe(4);
      expect(extractBaseServings(null)).toBe(4);
      expect(extractBaseServings('چند نفر', 2)).toBe(2);
    });
  });

  describe('parseQuantity', () => {
    it('parses integers, decimals, fractions and vulgar glyphs', () => {
      expect(parseQuantity('۲ پیمانه').value).toBe(2);
      expect(parseQuantity('۱.۵ قاشق').value).toBeCloseTo(1.5);
      expect(parseQuantity('۱٫۵ قاشق').value).toBeCloseTo(1.5);
      expect(parseQuantity('۱/۲ قاشق').value).toBeCloseTo(0.5);
      expect(parseQuantity('½ قاشق').value).toBeCloseTo(0.5);
      expect(parseQuantity('۱ ½ پیمانه').value).toBeCloseTo(1.5);
    });
    it('flags to-taste / open amounts as non-scalable (never invents a number)', () => {
      expect(parseQuantity('به‌مزه')).toMatchObject({ scalable: false, value: null });
      expect(parseQuantity('کمی نمک')).toMatchObject({ scalable: false });
      expect(parseQuantity('to taste')).toMatchObject({ scalable: false });
      expect(parseQuantity('')).toMatchObject({ scalable: false });
    });
  });

  describe('formatQuantity', () => {
    it('snaps to clean Persian fractions and integers', () => {
      expect(formatQuantity(4)).toBe('۴');
      expect(formatQuantity(0.5)).toBe('½');
      expect(formatQuantity(1.5)).toBe('۱½');
      expect(formatQuantity(0.25)).toBe('¼');
    });
    it('falls back to a short Persian decimal when no clean fraction', () => {
      expect(formatQuantity(1.2)).toBe('۱٫۲');
      expect(formatQuantity(0)).toBe('');
    });
  });

  describe('scaleAmountText', () => {
    it('scales the number while keeping the unit tail', () => {
      expect(scaleAmountText('۲ پیمانه', 2)).toBe('۴ پیمانه');
      expect(scaleAmountText('۱/۲ قاشق', 2)).toBe('۱ قاشق');
      expect(scaleAmountText('۱ قاشق', 0.5)).toBe('½ قاشق');
    });
    it('scales both ends of a range', () => {
      expect(scaleAmountText('۲ تا ۳ قاشق', 2)).toBe('۴ تا ۶ قاشق');
    });
    it('returns the text unchanged for non-scalable amounts or factor 1', () => {
      expect(scaleAmountText('به‌مزه', 2)).toBe('به‌مزه');
      expect(scaleAmountText('۲ پیمانه', 1)).toBe('۲ پیمانه');
      expect(scaleAmountText('', 2)).toBe('');
    });
  });

  describe('scaleWeightG', () => {
    it('scales and rounds grams sensibly', () => {
      expect(scaleWeightG(50, 2)).toBe(100);
      expect(scaleWeightG(200, 1.5)).toBe(300);
      expect(scaleWeightG(33, 2)).toBe(66);
      expect(scaleWeightG(220, 0.5)).toBe(110);
    });
    it('returns null for non-numbers (no fabrication)', () => {
      expect(scaleWeightG('lots', 2)).toBeNull();
      expect(scaleWeightG(undefined, 2)).toBeNull();
    });
  });
});
