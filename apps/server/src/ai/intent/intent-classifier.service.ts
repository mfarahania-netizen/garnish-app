import { Injectable } from '@nestjs/common';

/**
 * IntentClassifierService (AI_INTERNALIZATION_ARCH · AI_DESIGN_SPEC §2) — the deterministic COST GOVERNOR.
 *
 * A PURE function over the turn text + a light AssistantContext. Zero network, zero LLM, sub-millisecond, fully
 * unit-testable. It decides whether a turn is answered for €0 (deterministic) or (rarely) reaches a model, and it
 * enforces the safety rule: a safety-relevant query is NEVER silently answered at a cheap tier on low confidence.
 *
 * Output drives least-privilege tool routing + tier selection in the orchestrator. The classifier may only
 * DOWNGRADE cost when it is confident AND the intent is non-safety; any ambiguity fails toward MORE safety/cost.
 */

export type IntentName =
  | 'greeting_smalltalk'
  | 'unit_conversion'
  | 'timer_or_time'
  | 'scaling'
  | 'substitution'
  | 'technique_whyitworks'
  | 'ingredient_facts'
  | 'recipe_discovery'
  | 'personal_plan_or_history'
  | 'nutrition_query'
  | 'during_cook_problem'
  | 'stated_constraint'
  | 'medical_or_health_advice'
  | 'out_of_domain'
  | 'feedback'
  | 'low_confidence_fallback';

/** NONE/CHEAP/STRONG = model-cost tiers; REFUSE = deterministic decline; SPECIAL = the conversational-allergy flow (§3). */
export type IntentTier = 'NONE' | 'CHEAP' | 'STRONG' | 'REFUSE' | 'SPECIAL';
export type IntentDataScope = 'none' | 'recipe' | 'recipe_step' | 'ingredient' | 'corpus' | 'user' | 'full';
export type IntentConfidence = 'high' | 'medium' | 'low';

export interface AssistantContext {
  route?: string | null;
  hasRecipeContext?: boolean;
  currentStepIndex?: number | null;
  locale?: string | null;
}

export interface IntentClassification {
  intent: IntentName;
  tier: IntentTier;
  dataScope: IntentDataScope;
  safetyRelevant: boolean;
  confidence: IntentConfidence;
  matched: string[]; // anchors that fired — for explainability/telemetry
}

interface IntentSpec {
  intent: IntentName;
  safetyRelevant: boolean;
  baseTier: IntentTier;
  dataScope: IntentDataScope;
  anchors: string[]; // fa/nl/en keywords (normalized at load)
}

/* ───────────────────────── Normalization (fa/nl/en) ───────────────────────── */

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** Persian: map ي/ك/ة, strip ZWNJ + diacritics, Eastern-Arabic digits → ASCII; shared: lowercase, fold, collapse ws. */
export function normalizeText(input: unknown): string {
  let s = typeof input === 'string' ? input : '';
  if (!s) return '';
  s = s.replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)));
  s = s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
  s = s.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/ئ/g, 'ی').replace(/ؤ/g, 'و').replace(/آ|أ|إ/g, 'ا').replace(/ة/g, 'ه');
  s = s.replace(/‌/g, ' ').replace(/[ً-ٰٕ]/g, ''); // ZWNJ → space; strip harakat + hamza-above/below
  s = s.replace(/['’`]/g, ''); // strip apostrophes: can't → cant, i'm → im
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); // Latin diacritic fold
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/* ───────────────────────── Structural detectors ───────────────────────── */

const NUMBER_RE = /\b\d+([.,]\d+)?\b/;
const UNIT_TOKENS = ['گرم', 'کیلو', 'فنجان', 'پیمانه', 'قاشق', 'لیتر', 'میلی', 'cup', 'cups', 'gram', 'grams', 'gr', 'kg', 'ml', 'liter', 'litre', 'tbsp', 'tsp', 'eetlepel', 'theelepel', 'kopje'];
const PERSON_TOKENS = ['نفر', 'نفره', 'persoon', 'personen', 'people', 'persons', 'serving', 'servings', 'porties'];

const hasNumber = (t: string) => NUMBER_RE.test(t);
const hasUnit = (t: string) => UNIT_TOKENS.some((u) => t.includes(u));
const hasPerson = (t: string) => PERSON_TOKENS.some((u) => t.includes(u));

/* ───────────────────────── Intent lexicons (governed param) ───────────────────────── */

const RAW_INTENTS: IntentSpec[] = [
  { intent: 'greeting_smalltalk', safetyRelevant: false, baseTier: 'NONE', dataScope: 'none',
    anchors: ['سلام', 'درود', 'خوبی', 'ممنون', 'مرسی', 'خداحافظ', 'صبح بخیر', 'عصر بخیر', 'شب بخیر', 'وقت بخیر', 'سلام علیکم', 'hoi', 'hallo', 'hi', 'hello', 'hey', 'thanks', 'thank you', 'bedankt', 'dank je', 'goedemorgen'] },
  { intent: 'unit_conversion', safetyRelevant: false, baseTier: 'NONE', dataScope: 'none',
    anchors: ['چند فنجان', 'چند گرم', 'چند پیمانه', 'چند قاشق', 'تبدیل', 'in cups', 'in grams', 'to grams', 'to cups', 'how many cups', 'how many grams', 'convert', 'omrekenen', 'hoeveel gram', 'hoeveel kopjes'] },
  { intent: 'timer_or_time', safetyRelevant: false, baseTier: 'NONE', dataScope: 'recipe',
    anchors: ['چقدر بپزه', 'بپزه', 'بپزد', 'بجوشه', 'چند دقیقه', 'چقدر طول', 'چقدر زمان', 'کی آماده', 'how long', 'how many minutes', 'cooking time', 'hoe lang', 'hoeveel minuten', 'kooktijd', 'gaartijd'] },
  { intent: 'scaling', safetyRelevant: true, baseTier: 'CHEAP', dataScope: 'recipe',
    anchors: ['برای چند نفر', 'دو برابر', 'نصفش', 'نصف کن', 'مقدار برای', 'verdubbel', 'halveren', 'double the', 'halve the', 'scale', 'portie'] },
  { intent: 'substitution', safetyRelevant: true, baseTier: 'CHEAP', dataScope: 'recipe',
    anchors: ['جایگزین', 'جانشین', 'به جای', 'جای', 'عوضش', 'نداشتم چی', 'نداشتم', 'نداشتیم', 'نباشه چی', 'تموم شده چی', 'vervang', 'vervanging', 'in plaats van', 'substitute', 'instead of', 'replace', 'swap'] },
  { intent: 'technique_whyitworks', safetyRelevant: false, baseTier: 'CHEAP', dataScope: 'recipe',
    anchors: ['چرا باید', 'چرا تفت', 'به چه دلیل', 'فایده', 'waarom', 'why do i', 'why should', 'what does it do', 'techniek'] },
  { intent: 'ingredient_facts', safetyRelevant: false, baseTier: 'CHEAP', dataScope: 'ingredient',
    anchors: ['چیه', 'چیست', 'چی هست', 'درباره', 'wat is', 'what is', 'tell me about', 'wat zijn'] },
  { intent: 'recipe_discovery', safetyRelevant: true, baseTier: 'CHEAP', dataScope: 'corpus',
    anchors: ['چی بپزم', 'یه غذای', 'غذای سریع', 'پیشنهاد غذا', 'چی درست کنم', 'wat kan ik koken', 'recept voor', 'iets snels', 'what can i cook', 'recipe for', 'suggest a', 'something quick', 'wat zal ik koken'] },
  { intent: 'personal_plan_or_history', safetyRelevant: false, baseTier: 'CHEAP', dataScope: 'user',
    anchors: ['برنامه ام', 'برنامه این هفته', 'چی پختم', 'لیست خریدم', 'تاریخچه', 'mijn plan', 'mijn weekmenu', 'mijn lijst', 'my plan', 'my week', 'my meal plan', 'what did i cook', 'my shopping list'] },
  { intent: 'nutrition_query', safetyRelevant: true, baseTier: 'CHEAP', dataScope: 'ingredient',
    anchors: ['کالری', 'کالریه', 'چربی', 'پروتئین', 'قند', 'کربوهیدرات', 'فیبر', 'ارزش غذایی', 'تغذیه ای', 'تغذیه‌ای', 'calorie', 'calories', 'calorieen', 'hoeveel calorieen', 'protein', 'eiwit', 'koolhydraten', 'fiber', 'vezels', 'how much fat', 'sugar', 'nutrition', 'voedingswaarde'] },
  { intent: 'during_cook_problem', safetyRelevant: true, baseTier: 'STRONG', dataScope: 'recipe_step',
    anchors: ['بریده شد', 'برید', 'شور شد', 'سوخت', 'شفته شد', 'ته گرفت', 'خراب شد', 'سفت نشد', 'وا رفت', 'نپخت', 'نپخته', 'غلیظ شد', 'رقیق شد', 'بو میده', 'بوی زهم', 'بوی بد', 'سفت موند', 'سفت مونده', 'له شد', 'geschift', 'aangebrand', 'te zout', 'mislukt', 'curdled', 'burnt', 'too salty', 'too watery', 'not setting', 'went wrong', 'broke', 'soggy', 'mushy'] },
  { intent: 'stated_constraint', safetyRelevant: true, baseTier: 'SPECIAL', dataScope: 'user', anchors: [] },
  { intent: 'medical_or_health_advice', safetyRelevant: true, baseTier: 'REFUSE', dataScope: 'none', anchors: [] },
  { intent: 'out_of_domain', safetyRelevant: false, baseTier: 'REFUSE', dataScope: 'none',
    anchors: ['آب و هوا', 'هواشناسی', 'هوا چطور', 'چند درجه', 'فوتبال', 'بازی پرسپولیس', 'بازی استقلال', 'نتیجه بازی', 'سیاست', 'انتخابات', 'بیت کوین', 'ارز دیجیتال', 'شعر', 'فیلم', 'سریال', 'آهنگ', 'موزیک', 'ماشین چی', 'خودرو', 'موبایل', 'لپ تاپ', 'برنامه نویسی', 'اخبار', 'ترجمه کن', 'پایتخت', 'تعطیل', 'تعطیله', 'weer', 'voetbal', 'politiek', 'weather', 'football', 'soccer', 'politics', 'bitcoin', 'stock', 'translate this'] },
  { intent: 'feedback', safetyRelevant: false, baseTier: 'NONE', dataScope: 'user',
    anchors: ['جواب خوب', 'خوب بود', 'عالی بود', 'کمک کرد', 'بد بود', 'اشتباه بود', 'goed antwoord', 'slecht antwoord', 'dat hielp', 'good answer', 'that helped', 'not helpful', 'wrong answer', 'thumbs up', 'thumbs down'] },
];

// pre-normalize anchors so Persian digits/diacritics/ZWNJ in the lexicon match the normalized text
const INTENTS: IntentSpec[] = RAW_INTENTS.map((s) => ({ ...s, anchors: [...new Set(s.anchors.map(normalizeText).filter(Boolean))] }));

/** generic question-openers — present in many intents, so weak signal (weight 1). */
const WEAK_ANCHORS = new Set(['چیه', 'چیست', 'چی هست', 'چطور', 'چی', 'what is', 'wat is', 'wat zijn', 'tell me about', 'waarom', 'why do i'].map(normalizeText));

/* ── High-recall SAFETY overrides (recall ≥ 99% by design; over-trigger is acceptable, precision can be lower) ── */

const STATED_CONSTRAINT_PATTERNS: RegExp[] = [
  // Persian — allergy/sensitivity (noun forms strong; verb forms + "به X حساس"); space-tolerant نمی (ZWNJ→space)
  /حساسیت|آلرژی|الرژی/,
  /حساسم|حساسه|حساسن|حساسند/,
  /به ?.{0,20}حساس/,
  /اذیتم ?میکنه|اذیت ?میکنه|بهم ?نمیساز|نمیساز(ه|د)|تحمل ?نمیکنم|تحمل ?ندارم|عدم تحمل/,
  /نمی ?تونم.{0,15}بخورم|نمی ?خورم|نباید بخورم|پرهیز ?(میکنم|دارم|از)/,
  // Dutch (recall-first for the Holland launch — over-trigger is acceptable; safety route)
  /allergisch|allergie|intoleran(t|tie)/,
  /kan geen .{0,24}(eten|drinken|verdragen|verteren|hebben|verdraag|lusten|koken|gebruiken)\b/,
  /\b(eet|drink|verdraag|verteer|lust) geen\b/,
  /\bverdraag ik niet\b|\bkan ik niet (?:eten|drinken|verdragen|verteren|hebben)\b/,
  /\b(?:geeft|geven|bezorgt|bezorgen) (?:mij|me|mn) (?:buikpijn|jeuk|uitslag|huiduitslag|diarree|krampen)\b/,
  /\b(?:krijg|word|wordt) (?:ik )?(?:uitslag|jeuk|huiduitslag|buikpijn|diarree|krampen) van\b/,
  // English (apostrophes already stripped → cant / im)
  /\baller(g|j)(y|ies|ic)/,
  /\balerg(y|ic|ies)\b/, // common misspelling
  /\bintoleran(t|ce)\b/,
  /\bsensitiv(e|ity) to\b/,
  /\b(cant|cannot|can not) (have|eat|tolerate|do)\b/,
  /\breact(s|ion)? to\b/,
  /\bmakes? me (sick|ill)\b/,
  /\bi avoid\b/,
  /\bno (nuts|dairy|gluten|shellfish|eggs?|peanuts?|soy|sesame|fish)\b/,
  // aversion declaration ("X is bad for me") — runs before scoring so it beats the 'slecht'/'sugar' anchors
  /\b(?:slecht|niet goed) voor (?:mij|me)\b/,
  /\b(?:is|are) bad for me\b/,
  // symptom-reaction declarations → route into the capture flow rather than a generic answer
  /\bgives? me (?:a )?(?:rash|hives|stomach ?ache|stomach pain|cramps|diarr?hea|itch(?:ing|y)?)\b|\bbreak(?:s)? out in\b/,
  /\bi (?:get|break out in) (?:a )?(?:rash|hives|itch|stomach)/,
  /\b(?:word|wordt) ziek van|\bziek van\b/,
  /حالم.{0,4}بد ?میشه|معده.{0,8}خراب/,
];

// Conditions/treatment context ONLY — NOT bare food/nutrition homonyms (قند/چربی/kidney/liver/قرص), so legit
// cooking queries (sugar content, kidney beans, a liver dish, قرص نان/مرغ) are NOT falsely refused.
const MEDICAL_PATTERNS: RegExp[] = [
  // Persian — conditions; باردار/بارداری bounded so a pregnancy-CELEBRATION cake is not refused
  /دیابت|قند خون|قندم|قند دارم|چربی خون|تری ?گلیسیرید|کلسترول|فشار خون|فشارم|فشار بالا|نقرس|تیروی?ید|کم ?خونی|رفلاکس|کبد چرب|سنگ کلیه|بیماری کلی|نارسایی کلی|سرطان|باردارم|حامله|دوران بارداری|بارداری.{0,8}(بخورم|رژیم|مجاز|چی)|شیرده|رژیم درمانی|رژیم لاغری|اختلال خوردن|بیماری قلبی|مشکل قلبی|ناراحتی قلبی|دارو/,
  /برای (قلبم|کلیه ?ام|کبدم|گوارشم|معده ?ام|استخوان).{0,10}(خوبه|مفید|بهتر|بد)/,
  // symptom / diagnosis / treatment framing (not a food query) → decline + redirect to a professional
  /تشخیص ?بده|علائم|نشانه ?ها(ی)? ?بیماری|درمان ?کنم|درمانش ?چیه|بیمارم|مریضم|سرماخورد(م|گی)|تب ?دارم|سرفه ?دارم/,
  // Dutch — conditions; diabetes/zwanger bounded; organ "goed voor mijn X"
  /\b(?:suikerziekte|diabetes|bloedsuiker|bloeddruk|cholesterol|jicht|schildklier|bloedarmoede|coeliakie|reflux|nier(?:ziekte|stenen|probleem)|leverziekte|hartkwaal|hart(?:probleem|aandoening|ziekte)|kanker|borstvoeding|eetstoornis|medicijn)/,
  /\bik ben zwanger|tijdens.{0,12}zwangerschap|zwanger.{0,10}(eten|mag ik|veilig|dieet)/,
  /\bgoed (?:voor|tegen) (?:mijn )?(?:hart|nier|lever|spijsvertering|darmen|botten|gewricht|bloed)/,
  // English — conditions; diabetes/pregnan bounded (so diabetic-friendly / pregnancy cake PASS); organ indirect
  /\b(?:diabetes|blood sugar|high sugar|blood pressure|hypertension|cholesterol|triglyceride|gout|thyroid|anemi|celiac|coeliac|ibs|crohn|reflux|gerd|kidney (?:disease|stone|problem)|renal|liver disease|fatty liver|heart (?:disease|condition|problem)|cancer|breastfeed|eating disorder|prescrib|my meds|medication)/,
  /\bi(?: am|m)? (?:a )?(?:diabetic|anemic|celiac|coeliac|pregnant)\b/,
  /\bdiabetics?\b(?![ -]friendly)|\bdiabetici\b|\bdiabeet\b/, // person-noun "diabetic(s)" but NOT "diabetic-friendly"
  /\b(?:during|in) pregnan|pregnan\w* (?:diet|safe|can i eat)|safe.{0,15}pregnan/,
  /\b(?:good|safe) for my (?:heart|kidneys?|liver|bowel|gut|digestion|immune|bones?|joints?|blood)/,
  /\bketo\b.{0,15}\b(safe|for me|ok)\b/,
  // temporal/condition framing only — "is X safe with/for me" is overwhelmingly FOOD-safety, not medical
  /\bis .{0,25} safe (?:during|while|when)\b/,
];

@Injectable()
export class IntentClassifierService {
  classify(text: unknown, _ctx: AssistantContext = {}): IntentClassification {
    const t = normalizeText(text);
    if (!t || t.length < 2) return this.fallback([]);

    // 1) SAFETY OVERRIDES FIRST (high recall — a missed allergy/medical query is the only truly costly error)
    if (MEDICAL_PATTERNS.some((re) => re.test(t))) {
      return { intent: 'medical_or_health_advice', tier: 'REFUSE', dataScope: 'none', safetyRelevant: true, confidence: 'high', matched: ['medical_pattern'] };
    }
    if (STATED_CONSTRAINT_PATTERNS.some((re) => re.test(t))) {
      return { intent: 'stated_constraint', tier: 'SPECIAL', dataScope: 'user', safetyRelevant: true, confidence: 'high', matched: ['stated_constraint_pattern'] };
    }

    // 2) score lexicon intents (single-word anchors match on TOKEN boundary so 'hi' never fires inside 'this')
    const tokens = new Set(t.split(/[^\p{L}\p{N}]+/u).filter(Boolean));
    const weightOf = (a: string) => (WEAK_ANCHORS.has(a) ? 1 : a.includes(' ') ? 3 : 2);
    const fires = (a: string) => (a.includes(' ') ? t.includes(a) : tokens.has(a));

    const scores = new Map<IntentName, { score: number; matched: string[] }>();
    for (const spec of INTENTS) {
      let score = 0;
      const matched: string[] = [];
      for (const a of spec.anchors) if (fires(a)) { score += weightOf(a); matched.push(a); }
      if (score > 0) scores.set(spec.intent, { score, matched });
    }

    // 3) structural boosts
    const boost = (intent: IntentName, by: number, tag: string) => {
      const cur = scores.get(intent) ?? { score: 0, matched: [] };
      cur.score += by;
      cur.matched.push(tag);
      scores.set(intent, cur);
    };
    if (hasNumber(t) && hasUnit(t)) boost('unit_conversion', 3, '#num+unit');
    if (hasPerson(t) && (hasNumber(t) || t.includes('چند') || t.includes('hoeveel'))) boost('scaling', 3, '#person+count');
    if (hasNumber(t) && (t.includes('دقیقه') || t.includes('minu'))) boost('timer_or_time', 2, '#minutes');

    if (scores.size === 0) return this.fallback([]);

    // 4) winner + confidence
    const ranked = [...scores.entries()].sort((a, b) => b[1].score - a[1].score);
    const [winnerIntent, winner] = ranked[0];
    const runnerUp = ranked[1]?.[1].score ?? 0;
    const spec = INTENTS.find((s) => s.intent === winnerIntent)!;
    const confidence: IntentConfidence =
      winner.score >= 4 || (winner.score >= 2 && winner.score - runnerUp >= 2) ? 'high' : 'medium';

    // 5) routing rules + fail-toward-cost safety rule (§2.3 / §2.4)
    let tier = spec.baseTier;
    if (tier === 'NONE' && !(confidence === 'high' && !spec.safetyRelevant)) tier = 'CHEAP';
    if (spec.safetyRelevant && confidence !== 'high' && (tier === 'NONE' || tier === 'CHEAP')) tier = 'STRONG';

    return { intent: winnerIntent, tier, dataScope: spec.dataScope, safetyRelevant: spec.safetyRelevant, confidence, matched: winner.matched };
  }

  /** low-confidence / no signal → STRONG + full grounding, treated as safety-relevant (fail toward safety). */
  private fallback(matched: string[]): IntentClassification {
    return { intent: 'low_confidence_fallback', tier: 'STRONG', dataScope: 'full', safetyRelevant: true, confidence: 'low', matched };
  }
}
