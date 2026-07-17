import { t, resolveLocale, TEMPLATE_KEYS, __TEMPLATES_FOR_TEST } from './template-registry';

describe('TemplateRegistry', () => {
  it('resolves a BCP-47 tag to a supported locale (default fa)', () => {
    expect(resolveLocale('nl-NL')).toBe('nl');
    expect(resolveLocale('en-US')).toBe('en');
    expect(resolveLocale('fa-IR')).toBe('fa');
    expect(resolveLocale(undefined)).toBe('fa');
    expect(resolveLocale('de')).toBe('fa'); // unsupported → fa
  });

  it('renders per-locale and fills {slots}', () => {
    expect(t('greeting', 'nl')).toMatch(/Garnish/);
    expect(t('greeting', 'en')).toMatch(/cooking assistant/i);
    expect(t('recipe_minutes', 'en', { n: 30 })).toBe('30 min');
    expect(t('nutrition_line', 'en', { name: 'rice', parts: '365 kcal' })).toBe('**rice** (per 100 g): 365 kcal.');
  });

  it('EVERY template has all three locales filled (no fa-only dead-end)', () => {
    for (const key of TEMPLATE_KEYS) {
      const e = __TEMPLATES_FOR_TEST[key];
      for (const loc of ['fa', 'nl', 'en'] as const) {
        expect(typeof e[loc]).toBe('string');
        expect(e[loc].length).toBeGreaterThan(0);
      }
    }
  });

  it('a missing key returns the key itself (loud dev error, never a crash)', () => {
    expect(t('no_such_key', 'fa')).toBe('no_such_key');
  });

  it('allergy copy is informational and never promises absolute safety', () => {
    const copy = ['allergy_offer', 'allergy_offer_unknown']
      .flatMap((key) => Object.values(__TEMPLATES_FOR_TEST[key]))
      .join(' ');
    expect(copy).not.toMatch(/always|keep you safe|همیشه|altijd|veilig blijft/i);
    expect(copy).toMatch(/not a safety guarantee|تضمین ایمنی نیست|geen veiligheidsgarantie/i);
  });
});
