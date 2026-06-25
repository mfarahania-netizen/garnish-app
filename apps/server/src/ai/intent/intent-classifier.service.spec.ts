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
      // ── adversarial corpus (guardian wev0n68bj) — these previously MISSED ──
      'گردو اذیتم میکنه',
      'لاکتوز تحمل نمیکنم',
      'به گردو حساسم',
      'حساسه به گردو',
      'بچه‌ام به بادام حساسه',
      'پسرم به تخم مرغ آلرژی داره',
      'گوشت نمی‌خورم',
      'نمی خورم سویا',
      'ik kan geen noten eten',
      'ik eet geen gluten',
      'ik kan geen lactose verdragen',
      'mijn zoon is allergisch',
      'mijn dochter heeft een allergie',
      'im sensitive to gluten',
      "i can't have dairy",
      'i react to shellfish',
      'peanuts make me sick',
      'i avoid peanuts',
      'no dairy for me',
      'i have a peanut alergy',
      // Dutch aversion + symptom-reaction declarations (guardian w7cwv8ujr)
      'pinda is slecht voor mij',
      'melk is slecht voor me',
      'peanuts give me hives',
      'ik word ziek van noten',
      'گردو میخورم حالم بد میشه',
      // Dutch broad-verb + symptom-reaction declarations (guardian w90ifbn67 — these previously MISSED)
      'ik kan geen melk drinken',
      'ik krijg uitslag van noten',
      'soja geeft mij buikpijn',
      'walnoten verdraag ik niet',
      'eieren bezorgen me jeuk',
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
      // ── adversarial corpus (guardian) — condition phrased with a nutrition/everyday word ──
      'my blood sugar is high',
      'what to eat with high sugar',
      'قند دارم چی بخورم',
      'قندم بالاست',
      'چربی خونم بالاست',
      'فشارم بالاست',
      'تیروئید دارم',
      'رفلاکس دارم',
      'i am diabetic',
      'i am pregnant what can i eat',
      'i have celiac disease',
      'i have heart disease',
      'is keto safe for me',
      'ik heb suikerziekte',
      // indirect-medical (organ "good for my X", no disease word) — guardian w7cwv8ujr
      'what is good for my heart',
      'what is good for my kidneys',
      'wat is goed voor mijn hart',
      'wat is goed voor mijn nieren',
      'anti-cancer foods', // intentional conservative refuse (health-claim territory) — documented
      // bare person-noun "diabetic(s)" + nutrition anchor (3rd-pass systematic recall fix)
      'how much sugar for a diabetic',
      'sugar for diabetics',
      'calories for a diabetic',
      'calorieen voor diabetici',
    ];
    it.each(medical)('classifies «%s» as medical_or_health_advice (REFUSE)', (text) => {
      const r = svc.classify(text);
      expect(r.intent).toBe('medical_or_health_advice');
      expect(r.tier).toBe('REFUSE');
      expect(r.safetyRelevant).toBe(true);
    });
  });

  // ── over-refusal: legit FOOD queries that share a homonym with a condition must NOT be refused ──
  describe('no over-refusal of legit food queries (guardian)', () => {
    const foodNotMedical = [
      'قرص مرغ درست کنم',          // قرص = patty (not pill)
      'دستور قرص نان',
      'جگر مرغ چطور سرخ کنم',      // جگر = liver (food)
      'red kidney beans recipe',    // kidney = bean (not organ)
      'steak and kidney pie',
      'a hearty liver and onions dish',
      'is chicken safe to eat',     // food-safety, not medical
      'recept met lever',           // Dutch liver dish
      'کالریِ این غذا چنده',       // bare قند/nutrition stays nutrition
      'قند این شیرینی چقدره',
      // guardian w7cwv8ujr — adjectival / celebration uses must NOT refuse (CORE to the EU launch)
      'diabetic-friendly dessert',
      'diabetic friendly recipes',
      'pregnancy announcement cake',
      'zwangerschapsaankondiging taart',
      'heart-shaped cookies',
      'blood orange salad',
      'bloedworst recept',
      'sugar-free cake recipe',
      // "is X safe with/for me" = food-safety, not medical (3rd-pass over-refusal fix)
      'is it safe with nuts',
      'is the chicken safe with the sauce',
      'is this safe with kids around',
      'diabetic-friendly dessert', // still NOT refused after adding the diabetic person-noun pattern
    ];
    it.each(foodNotMedical)('does NOT refuse «%s» as medical', (text) => {
      expect(svc.classify(text).intent).not.toBe('medical_or_health_advice');
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
      ['جای پیاز چی بریزم؟', 'substitution'], // colloquial «جای X» (not «جایگزین»/«به جای»)
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
      ['dat is een slecht antwoord', 'feedback'], // bounded 'slecht antwoord' still feedback (not aversion)
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
