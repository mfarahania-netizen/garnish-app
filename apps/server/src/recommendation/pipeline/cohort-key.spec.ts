import { deriveCohortKey, regionKey } from './cohort-key';

describe('cohort-key — L1 cold-start prior join key', () => {
  describe('regionKey', () => {
    it('uses explicit country, normalized', () => {
      expect(regionKey({ country: 'NL' })).toBe('nl');
    });
    it('falls back to the BCP-47 locale region subtag', () => {
      expect(regionKey({ locale: 'nl-NL' })).toBe('nl');
      expect(regionKey({ locale: 'fa-IR' })).toBe('ir');
    });
    it('prefers explicit country over locale', () => {
      expect(regionKey({ country: 'BE', locale: 'nl-NL' })).toBe('be');
    });
    it('returns null when neither is known', () => {
      expect(regionKey({})).toBeNull();
      expect(regionKey({ locale: 'nl' })).toBeNull(); // no region subtag
    });
  });

  describe('deriveCohortKey', () => {
    it('is deterministic regardless of input field order (facets sorted)', () => {
      const a = deriveCohortKey({ country: 'NL', diet: 'vegetarian', occasion: 'christmas' });
      const b = deriveCohortKey({ occasion: 'christmas', diet: 'vegetarian', country: 'NL' });
      expect(a).toBe(b);
      expect(a).toBe('country=nl;diet=vegetarian;occasion=christmas');
    });
    it('omits missing facets → fewer facets yield a broader cohort', () => {
      expect(deriveCohortKey({ country: 'NL' })).toBe('country=nl');
      expect(deriveCohortKey({ country: 'NL', diet: 'halal' })).toBe('country=nl;diet=halal');
    });
    it('normalizes values (case/spacing)', () => {
      expect(deriveCohortKey({ skill: ' Beginner ' })).toBe('skill=beginner');
    });
    it('returns null when no facet is known (caller falls back to population)', () => {
      expect(deriveCohortKey({})).toBeNull();
      expect(deriveCohortKey({ diet: '   ' })).toBeNull();
    });
  });
});
