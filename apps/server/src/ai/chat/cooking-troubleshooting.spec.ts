import { matchTroubleshooting, TROUBLESHOOTING } from './cooking-troubleshooting';

describe('matchTroubleshooting', () => {
  const cases: [string, string][] = [
    ['چرا برنجم شفته شد؟', 'rice_mushy'],
    ['برنجم سفت موند چیکار کنم', 'rice_hard'],
    ['ته‌دیگم چسبید', 'tahdig_stuck'],
    ['تهدیگم درنیومد', 'tahdig_stuck'],
    ['ته دیگم نرم شد و طلایی نشد', 'tahdig_soft'],
    ['چرا کباب کوبیده ریخت؟', 'koobideh_fell'],
    ['کوبیده‌هام از سیخ افتاد', 'koobideh_fell'],
    ['چرا کوفته وا رفت؟', 'koofteh_fell'],
    ['جوجه‌ام خشک شد چرا', 'chicken_dry'],
    ['مرغم وسطش خام موند', 'chicken_raw'],
    ['چرا خورشم لعاب نداره؟', 'khoresh_thin'],
    ['گوشت خورشم سفت موند', 'meat_tough'],
    ['سس بشاملم برید', 'sauce_curdled'],
    ['غذام شور شد', 'too_salty'],
    ['ته قابلمه سوخت', 'burned_bottom'],
    ['کیکم ور نیومد', 'dough_no_rise'],
  ];

  it.each(cases)('maps «%s» → %s', (prompt, id) => {
    expect(matchTroubleshooting(prompt)?.id).toBe(id);
  });

  it('returns null when no failure is described', () => {
    expect(matchTroubleshooting('چرا آسمون آبیه؟')).toBeNull();
    expect(matchTroubleshooting('با مرغ چی بپزم؟')).toBeNull();
    expect(matchTroubleshooting('')).toBeNull();
  });

  it('prefers a dish-specific entry over a general one', () => {
    // «برنجم ته گرفت» has both the general burned-bottom symptom AND a dish; dish-specific rules win when present
    const r = matchTroubleshooting('کوفته‌هام وا رفت و شور شد');
    expect(r?.id).toBe('koofteh_fell'); // specific dish beats the general too_salty
  });

  it('every entry has non-empty guidance (no stub content)', () => {
    for (const e of TROUBLESHOOTING) {
      expect(e.cause.length).toBeGreaterThan(10);
      expect(e.fix.length).toBeGreaterThan(10);
      expect(e.prevent.length).toBeGreaterThan(10);
      expect(e.symptom.length).toBeGreaterThan(0);
    }
  });
});
