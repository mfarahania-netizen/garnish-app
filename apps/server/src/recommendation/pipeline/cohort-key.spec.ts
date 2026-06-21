import { deriveCohortKey, regionKey, activeOccasionKey, facetsFromUser } from './cohort-key';

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

  describe('activeOccasionKey', () => {
    it('prefers the EUROPEAN occasion (Europe launch is the priority)', () => {
      expect(activeOccasionKey({ occasion: { key: 'yalda' }, europeanOccasion: { key: 'christmas' } })).toBe('christmas');
    });
    it('falls back to the Persian occasion when no EU occasion is active', () => {
      expect(activeOccasionKey({ occasion: { key: 'yalda' }, europeanOccasion: { key: 'none' } })).toBe('yalda');
    });
    it('returns null on an ordinary day (both none / missing)', () => {
      expect(activeOccasionKey({ occasion: { key: 'none' }, europeanOccasion: { key: 'none' } })).toBeNull();
      expect(activeOccasionKey({})).toBeNull();
      expect(activeOccasionKey(null)).toBeNull();
    });
  });

  describe('facetsFromUser', () => {
    it('maps user + occasion to facets (null-safe)', () => {
      const f = facetsFromUser({ country: 'NL', locale: 'nl-NL', preferences: { diet: 'vegetarian', skillLevel: 'beginner' } }, 'christmas');
      expect(f).toEqual({ country: 'NL', locale: 'nl-NL', diet: 'vegetarian', skill: 'beginner', occasion: 'christmas' });
      expect(facetsFromUser(null)).toEqual({ country: null, locale: null, diet: null, skill: null, occasion: null });
    });
  });
});
