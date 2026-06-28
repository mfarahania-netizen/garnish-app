import { emojiFor } from './ingredient-emoji';

describe('emojiFor', () => {
  it('maps known ingredients to a specific emoji', () => {
    expect(emojiFor('گوجه')).toBe('🍅');
    expect(emojiFor('مرغ')).toBe('🍗');
    expect(emojiFor('شیر')).toBe('🥛');
  });

  it('handles colloquial spellings (ریحون=ریحان, گشنیج=گشنیز)', () => {
    expect(emojiFor('ریحون')).toBe('🌿');
    expect(emojiFor('گشنیج')).toBe('🌿');
  });

  it('matches on substring so a quantity-prefixed name still resolves', () => {
    expect(emojiFor('یه ماست')).toBe('🥛');
  });

  // The founder's hard requirement: «هر چیزی باید آیکن داشته باشه، هر چیزی» — never blank.
  it('falls back to the aisle icon for unmapped ingredients', () => {
    expect(emojiFor('یه چیزِ کاملاً ناشناخته', 'herbs')).toBe('🌿');
    expect(emojiFor('یه چیزِ کاملاً ناشناخته', 'protein')).toBe('🍖');
    expect(emojiFor('یه چیزِ کاملاً ناشناخته', 'other')).toBe('🛒');
  });

  it('never returns an empty string, even with no name and no aisle', () => {
    expect(emojiFor('', undefined)).toBe('🛒');
    expect(emojiFor(null)).toBe('🛒');
    expect(emojiFor('zzz-unknown')).toBe('🛒');
  });
});
