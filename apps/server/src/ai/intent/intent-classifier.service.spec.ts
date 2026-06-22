import { IntentClassifierService, normalizeText, IntentName } from './intent-classifier.service';

const svc = new IntentClassifierService();
const intentOf = (text: string, ctx?: any): IntentName => svc.classify(text, ctx).intent;

describe('IntentClassifierService (AI_DESIGN_SPEC §2 — deterministic cost governor)', () => {
  describe('normalizeText (fa/nl/en)', () => {
    it('maps Eastern-Arabic digits, ي/ك, strips ZWNJ + diacritics, lowercases + folds', () => {
      expect(normalizeText('۲۰۰ گرم')).toBe('200 گرم');
      expect(normalizeText('كيوي')).toBe('کیوی');
      expect(normalizeText('برنامه‌ام')).toBe('برنامه ام'); // ZWNJ → space
      expect(normalizeText('Calorieën')).toBe('calorieen'); // lower + diacritic fold
    });
  });

  // ── CRITICAL SAFETY RECALL (target ≥99%): every allergy declaration → stated_constraint; medical → refuse ──
  describe('safety recall — stated_constraint (allergy declarations)', () => {
    const declarations = [
      'راستی من به گردو حساسیت دارم',
      'من به بادام‌زمینی حساسم',
      'آلرژی به تخم‌مرغ دارم',
      'نمیتونم لبنیات بخورم',
      'ik ben allergisch voor walnoten',
      'ik heb een allergie voor pinda',
      "i'm allergic to peanuts",
      'i am allergic to shellfish',
      "i can't eat gluten",
      'i have a nut allergy',
      'i am intolerant to lactose',
    ];
    it.each(declarations)('classifies «%s» as stated_constraint (SPECIAL flow)', (text) => {
      const r = svc.classify(text);
      expect(r.intent).toBe('stated_constraint');
      expect(r.tier).toBe('SPECIAL');
      expect(r.safetyRelevant).toBe(true);
    });

    it('a stated allergy + a request still routes to the constraint flow first (capture before answering)', () => {
      expect(intentOf('من به گردو حساسم، جایگزینش چیه؟')).toBe('stated_constraint');
    });
  });

  describe('safety recall — medical_or_health_advice (refuse)', () => {
    const medical = [
      'برای دیابتم چی بخورم؟',
      'با فشار خون بالا چی نخورم',
      'من باردارم چی بخورم',
      'برای کلسترول بالا رژیم بده',
      'wat moet ik eten met diabetes',
      'ik ben zwanger wat mag ik eten',
      'what should i eat for my diabetes',
      'is this safe during pregnancy',
      'i take blood pressure medication, what diet',
    ];
    it.each(medical)('classifies «%s» as medical_or_health_advice (REFUSE)', (text) => {
      const r = svc.classify(text);
      expect(r.intent).toBe('medical_or_health_advice');
      expect(r.tier).toBe('REFUSE');
      expect(r.safetyRelevant).toBe(true);
    });
  });

  // ── intent accuracy across the lexicon set ──
  describe('intent classification (fa/nl/en)', () => {
    const cases: Array<[string, IntentName]> = [
      ['سلام', 'greeting_smalltalk'],
      ['hoi', 'greeting_smalltalk'],
      ['thanks a lot', 'greeting_smalltalk'],
      ['۲۰۰ گرم چند فنجونه؟', 'unit_conversion'],
      ['200 g in cups', 'unit_conversion'],
      ['hoeveel gram is een kopje', 'unit_conversion'],
      ['این چقدر باید بپزه؟', 'timer_or_time'],
      ['how long to cook this', 'timer_or_time'],
      ['hoe lang koken', 'timer_or_time'],
      ['این رو برای ۶ نفر کن', 'scaling'],
      ['scale this for 6 people', 'scaling'],
      ['voor 6 personen', 'scaling'],
      ['جایگزینِ گردو چیه؟', 'substitution'],
      ['vervanging voor boter', 'substitution'],
      ['what can i use instead of butter', 'substitution'],
      ['چرا باید پیاز رو تفت بدم؟', 'technique_whyitworks'],
      ['waarom moet ik aanbraden', 'technique_whyitworks'],
      ['یه غذای گیاهیِ سریع چی بپزم؟', 'recipe_discovery'],
      ['what can i cook with chicken', 'recipe_discovery'],
      ['wat kan ik koken vanavond', 'recipe_discovery'],
      ['تو برنامهٔ این هفته‌ام چی دارم؟', 'personal_plan_or_history'],
      ['what is on my meal plan', 'personal_plan_or_history'],
      ['کالریِ این غذا چنده؟', 'nutrition_query'],
      ['hoeveel calorieën zitten hierin', 'nutrition_query'],
      ['how much protein is in this', 'nutrition_query'],
      ['سُسم بریده شد چیکار کنم', 'during_cook_problem'],
      ['mijn saus is geschift', 'during_cook_problem'],
      ['my rice is too mushy', 'during_cook_problem'],
      ['آب و هوا چطوره؟', 'out_of_domain'],
      ['what is the weather today', 'out_of_domain'],
      ['این جواب خیلی خوب بود', 'feedback'],
      ['that helped a lot', 'feedback'],
    ];
    it.each(cases)('«%s» → %s', (text, expected) => {
      expect(intentOf(text)).toBe(expected);
    });

    it('meets the ≥92% accuracy bar on the labeled set', () => {
      const correct = cases.filter(([t, e]) => intentOf(t) === e).length;
      expect(correct / cases.length).toBeGreaterThanOrEqual(0.92);
    });
  });

  // ── routing rules (§2.3 / §2.4): fail toward more safety/cost, never less ──
  describe('routing rules', () => {
    it('NONE only for a deterministic non-safety intent at HIGH confidence', () => {
      const r = svc.classify('۲۰۰ گرم چند فنجان است؟');
      expect(r.intent).toBe('unit_conversion');
      expect(r.tier).toBe('NONE');
    });

    it('during_cook_problem is always STRONG', () => {
      expect(svc.classify('سُسم بریده شد').tier).toBe('STRONG');
    });

    it('gibberish / unknown → low_confidence_fallback at STRONG with full grounding (never a cheap silent answer)', () => {
      const r = svc.classify('asdkjqwe zxcv');
      expect(r.intent).toBe('low_confidence_fallback');
      expect(r.tier).toBe('STRONG');
      expect(r.safetyRelevant).toBe(true);
      expect(r.dataScope).toBe('full');
    });

    it('empty / too-short input fails toward the safe fallback', () => {
      expect(svc.classify('').intent).toBe('low_confidence_fallback');
      expect(svc.classify('  ').tier).toBe('STRONG');
    });

    it('a safety-relevant intent never lands at NONE', () => {
      for (const t of ['جایگزینِ گردو چیه؟', 'کالریش چنده', 'voor 6 personen']) {
        expect(svc.classify(t).tier).not.toBe('NONE');
      }
    });
  });
});
