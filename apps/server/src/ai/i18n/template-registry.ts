/**
 * fa/nl/en TemplateRegistry (Dimension 1 — multilingual conversational UX, «Dutch required»).
 *
 * Every DETERMINISTIC user-facing assistant string lives here in Persian, Dutch and English, so a Dutch (or
 * English) user never hits a Persian-only dead-end. The recipe CORPUS itself (titles/ingredients/steps) is a
 * separate corpus-i18n effort (Dimension 7); this registry covers the SCAFFOLDING + the deterministic answers
 * the assistant composes. `{slot}` placeholders are filled by `t(key, locale, vars)`.
 *
 * HONEST NOTE: the fa is native-quality; the nl/en are FUNCTIONAL (built by the engineer) and must pass a
 * native Persian + Dutch review before the EU launch (AI_MASTER_SPEC Dim-1/12 external gate). Wrong nl/en
 * phrasing is a quality bug, never a safety one — the deterministic safety gate is language-independent.
 */

export type Locale = 'fa' | 'nl' | 'en';

/** Map a BCP-47 tag (User.locale, e.g. «nl-NL») to a supported template locale; default fa (Iran-sandbox-first). */
export function resolveLocale(raw: unknown): Locale {
  const s = String(raw ?? '').toLowerCase();
  if (s.startsWith('nl')) return 'nl';
  if (s.startsWith('en')) return 'en';
  return 'fa';
}

type Entry = Record<Locale, string>;

// One place for every deterministic string. Keep keys stable; add a locale by filling all three.
const TEMPLATES: Record<string, Entry> = {
  // ── disclosure / framing ──────────────────────────────────────────────
  assistant_header: {
    fa: '🤖 دستیار آشپزی گارنیش:',
    nl: '🤖 Garnish kookassistent:',
    en: '🤖 Garnish cooking assistant:',
  },
  ai_disclosure_header: {
    fa: '🤖 دستیار هوش مصنوعی گارنیش (اطلاعات عمومی، نه توصیهٔ پزشکی):',
    nl: '🤖 Garnish AI-assistent (algemene info, geen medisch advies):',
    en: '🤖 Garnish AI assistant (general info, not medical advice):',
  },
  cooking_guidance_note: {
    fa: 'ℹ️ راهنماییِ آشپزیه؛ بسته به دستور و موادت ممکنه کمی فرق کنه.',
    nl: 'ℹ️ Kookadvies; afhankelijk van je recept en ingrediënten kan het iets verschillen.',
    en: 'ℹ️ Cooking guidance; it may vary a bit with your recipe and ingredients.',
  },
  // ── non-recipe intents ────────────────────────────────────────────────
  greeting: {
    fa: 'سلام! 👋 من دستیار آشپزی گارنیشم. بگو چی دوست داری بپزی یا چه موادی توی خونه داری تا کمکت کنم.',
    nl: 'Hallo! 👋 Ik ben de kookassistent van Garnish. Vertel wat je wilt koken of welke ingrediënten je in huis hebt, dan help ik je.',
    en: "Hi! 👋 I'm the Garnish cooking assistant. Tell me what you'd like to cook or what ingredients you have, and I'll help.",
  },
  feedback_thanks: {
    fa: 'خوشحالم که به کارت اومد! 🙌 هر وقت سؤال آشپزی داشتی — جایگزین، ایدهٔ غذا یا طرز تهیه — در خدمتم.',
    nl: 'Fijn dat het hielp! 🙌 Heb je een kookvraag — een vervanging, een gerecht-idee of een bereiding — ik help graag.',
    en: 'Glad it helped! 🙌 Whenever you have a cooking question — a substitute, a dish idea or a method — I’m here.',
  },
  medical_decline: {
    fa: 'من نمی‌تونم توصیهٔ پزشکی یا رژیمِ درمانی بدم؛ برای این موضوع بهتره با پزشک یا متخصصِ تغذیه مشورت کنی. اما اگه بخوای، می‌تونم غذاهای سادهٔ خوش‌طعم از رسپی‌های گارنیش برات پیدا کنم — فقط بگو چه موادی دوست داری.',
    nl: 'Ik kan geen medisch of dieetadvies geven; raadpleeg daarvoor een arts of diëtist. Maar als je wilt, kan ik wel eenvoudige, lekkere gerechten uit de Garnish-recepten zoeken — zeg gewoon welke ingrediënten je lekker vindt.',
    en: 'I can’t give medical or therapeutic-diet advice; please consult a doctor or dietitian for that. But if you like, I can find simple, tasty dishes from the Garnish recipes — just tell me which ingredients you enjoy.',
  },
  out_of_domain: {
    fa: 'من فقط توی آشپزی و رسپی‌ها می‌تونم کمکت کنم 🍳 — یه ماده یا غذایی بگو تا برات پیدا کنم یا جایگزینش رو پیشنهاد بدم.',
    nl: 'Ik kan alleen helpen met koken en recepten 🍳 — noem een ingrediënt of gerecht, dan zoek ik het voor je of stel ik een vervanging voor.',
    en: 'I can only help with cooking and recipes 🍳 — name an ingredient or dish and I’ll find it for you or suggest a substitute.',
  },
  technique_to_cookmode: {
    fa: 'سؤال خوبیه! توضیحِ گام‌به‌گامِ تکنیک‌ها رو داخل «حالت پخت» (Cook Mode) هر رسپی می‌بینی. اسم غذایی که داری می‌پزی رو بگو تا پیداش کنم و مرحله‌به‌مرحله راهنماییت کنم.',
    nl: 'Goede vraag! Stap-voor-stap uitleg van technieken vind je in de «Kookmodus» (Cook Mode) van elk recept. Noem het gerecht dat je maakt, dan zoek ik het en begeleid ik je stap voor stap.',
    en: 'Good question! Step-by-step technique explanations live in each recipe’s «Cook Mode». Tell me the dish you’re making and I’ll find it and guide you step by step.',
  },
  // ── empty / clarifier ─────────────────────────────────────────────────
  empty_allergy_filtered: {
    fa: 'بر اساس رسپی‌های گارنیش، گزینه‌ای که با آلرژی‌های اعلام‌شده‌ات بسازد پیدا نشد. می‌تونی مواد یا سؤالت رو طور دیگه‌ای بپرسی.',
    nl: 'In de Garnish-recepten vond ik geen optie die past bij je opgegeven allergieën. Probeer je ingrediënten of vraag anders te formuleren.',
    en: 'Among the Garnish recipes I found none that fit your declared allergies. Try rephrasing your ingredients or question.',
  },
  empty_neutral: {
    fa: 'متوجه نشدم دقیقاً چی می‌خوای 🙂 — یه ماده، یه غذا یا موادی که داری بنویس تا برات پیدا کنم.',
    nl: 'Ik snap niet precies wat je bedoelt 🙂 — schrijf een ingrediënt, een gerecht of wat je in huis hebt, dan zoek ik het.',
    en: 'I didn’t quite get what you want 🙂 — write an ingredient, a dish, or what you have on hand and I’ll find it.',
  },
  unsafe_set_unavailable: {
    fa: 'الان نمی‌تونم به‌صورت امن برات پیشنهاد شخصی‌سازی‌شده بدم. لطفاً کمی بعد دوباره تلاش کن.',
    nl: 'Ik kan je nu geen veilige, persoonlijke suggestie geven. Probeer het zo nog eens.',
    en: 'I can’t safely give you a personalized suggestion right now. Please try again shortly.',
  },
  // ── recipe list ───────────────────────────────────────────────────────
  recipe_list_intro: {
    fa: 'بر اساس رسپی‌های گارنیش، این گزینه‌ها رو برات پیدا کردم:',
    nl: 'Op basis van de Garnish-recepten vond ik deze opties voor je:',
    en: 'Based on the Garnish recipes, here are some options for you:',
  },
  recipe_time_unknown: { fa: 'زمان نامشخص', nl: 'tijd onbekend', en: 'time n/a' },
  recipe_minutes: { fa: '{n} دقیقه', nl: '{n} min', en: '{n} min' },
  recipe_list_footer_allergy: {
    fa: '📚 این {n} پیشنهاد از رسپی‌های گارنیش انتخاب شده و غذاهایی که با آلرژی‌های اعلام‌شده‌ات تداخل داشتند کنار گذاشته شدند (اطلاعاتی است، نه تضمین؛ همیشه فهرست کامل مواد رو بررسی کن).',
    nl: '📚 Deze {n} suggesties komen uit de Garnish-recepten; gerechten die botsten met je opgegeven allergieën zijn weggelaten (informatief, geen garantie; controleer altijd de volledige ingrediëntenlijst).',
    en: '📚 These {n} suggestions are from the Garnish recipes; dishes conflicting with your declared allergies were left out (informational, not a guarantee; always check the full ingredient list).',
  },
  recipe_list_footer_plain: {
    fa: '📚 این {n} پیشنهاد از رسپی‌های گارنیش انتخاب شده (اطلاعاتی است، نه تضمین؛ همیشه فهرست کامل مواد رو بررسی کن).',
    nl: '📚 Deze {n} suggesties komen uit de Garnish-recepten (informatief, geen garantie; controleer altijd de volledige ingrediëntenlijst).',
    en: '📚 These {n} suggestions are from the Garnish recipes (informational, not a guarantee; always check the full ingredient list).',
  },
  // ── nutrition ─────────────────────────────────────────────────────────
  nutrition_line: {
    fa: '**{name}** (هر ۱۰۰ گرم): {parts}.',
    nl: '**{name}** (per 100 g): {parts}.',
    en: '**{name}** (per 100 g): {parts}.',
  },
  nutrition_disclaimer: {
    fa: 'ℹ️ عددها تقریبی و بر اساس ۱۰۰ گرمِ مادهٔ خام است؛ توصیهٔ تغذیه‌ای یا پزشکی نیست.',
    nl: 'ℹ️ De waarden zijn bij benadering, per 100 g rauw ingrediënt; geen voedings- of medisch advies.',
    en: 'ℹ️ Values are approximate, per 100 g of the raw ingredient; not nutritional or medical advice.',
  },
  nutrition_ask: {
    fa: 'برای ارزشِ غذایی، اسمِ خودِ ماده رو بگو (مثلاً «کالری برنج» یا «پروتئین عدس»). برای کالریِ یک غذای کامل هم صفحهٔ همون رسپی رو ببین. من توصیهٔ تغذیه‌ای/پزشکی نمی‌دم.',
    nl: 'Voor voedingswaarde: noem het ingrediënt zelf (bijv. «calorieën rijst» of «eiwit linzen»). Voor de calorieën van een heel gerecht, bekijk de receptpagina. Ik geef geen voedings- of medisch advies.',
    en: 'For nutrition, name the ingredient itself (e.g. «calories rice» or «protein lentils»). For a whole dish’s calories, see the recipe page. I don’t give nutritional or medical advice.',
  },
  nutrient_calories: { fa: '{v} کالری', nl: '{v} kcal', en: '{v} kcal' },
  nutrient_protein: { fa: '{v} گرم پروتئین', nl: '{v} g eiwit', en: '{v} g protein' },
  nutrient_carbs: { fa: '{v} گرم کربوهیدرات', nl: '{v} g koolhydraten', en: '{v} g carbs' },
  nutrient_fat: { fa: '{v} گرم چربی', nl: '{v} g vet', en: '{v} g fat' },
  nutrient_fiber: { fa: '{v} گرم فیبر', nl: '{v} g vezels', en: '{v} g fiber' },
  // ── troubleshooting ───────────────────────────────────────────────────
  ts_why: { fa: '**چرا این‌طور شد:** {cause}', nl: '**Waarom dit gebeurde:** {cause}', en: '**Why this happened:** {cause}' },
  ts_now: { fa: '**الان چی‌کار کن:** {fix}', nl: '**Wat je nu kunt doen:** {fix}', en: '**What to do now:** {fix}' },
  ts_next: { fa: '**دفعهٔ بعد:** {prevent}', nl: '**Volgende keer:** {prevent}', en: '**Next time:** {prevent}' },
  // ── §3 conversational allergy (frame; the allergen LABELS stay canonical — corpus i18n is Dim 7) ──
  allergy_offer: {
    fa: 'متوجه شدم که به {names} حساسیت داری. می‌خوای به پروفایلت اضافه‌اش کنم تا همیشه از غذاهات حذفش کنم و ایمن بمونی؟',
    nl: 'Ik begrijp dat je allergisch bent voor {names}. Zal ik het aan je profiel toevoegen zodat ik het altijd uit je gerechten weglaat en je veilig blijft?',
    en: 'I understand you’re allergic to {names}. Shall I add it to your profile so I always leave it out of your dishes and keep you safe?',
  },
  allergy_offer_unknown: {
    fa: 'به‌نظر رسید یک حساسیت گفتی، ولی مطمئن نشدم دقیقاً کدوم ماده — اسمش رو بگو یا توی پروفایلت اضافه‌اش کن تا همیشه ایمن نگهت دارم.',
    nl: 'Het leek of je een allergie noemde, maar ik weet niet zeker welk ingrediënt — noem het, of voeg het toe in je profiel, dan houd ik je altijd veilig.',
    en: 'It sounded like you mentioned an allergy, but I’m not sure which ingredient — tell me its name or add it in your profile so I always keep you safe.',
  },
  // ── substitution (frame; the swap notes/«why» come from the dictionary data — Dim 7 content) ──
  substitution_intro: {
    fa: 'برای «{name}» این جایگزین‌ها رو از فرهنگ مواد اولیهٔ گارنیش پیدا کردم:',
    nl: 'Voor «{name}» vond ik deze vervangingen in de Garnish-ingrediëntengids:',
    en: 'For «{name}» I found these substitutes in the Garnish ingredient guide:',
  },
  substitution_none: {
    fa: 'برای «{name}» جایگزینی در داده‌های گارنیش پیدا نکردم.',
    nl: 'Voor «{name}» vond ik geen vervanging in de Garnish-gegevens.',
    en: 'I couldn’t find a substitute for «{name}» in the Garnish data.',
  },
  substitution_footer: {
    fa: 'ℹ️ همیشه فهرست کامل مواد رو بررسی کن؛ این راهنماییِ آشپزی است، نه توصیهٔ پزشکی.',
    nl: 'ℹ️ Controleer altijd de volledige ingrediëntenlijst; dit is kookadvies, geen medisch advies.',
    en: 'ℹ️ Always check the full ingredient list; this is cooking guidance, not medical advice.',
  },
  // ── safe blocked / error states ──────────────────────────────────────
  blocked_rejected: {
    fa: 'در حال حاضر امکان پردازش این درخواست نیست. لطفاً بعداً دوباره تلاش کن.',
    nl: 'Dit verzoek kan nu niet worden verwerkt. Probeer het later opnieuw.',
    en: 'This request can’t be processed right now. Please try again later.',
  },
  blocked_error: {
    fa: 'مشکلی پیش اومد. لطفاً دوباره تلاش کن.',
    nl: 'Er ging iets mis. Probeer het opnieuw.',
    en: 'Something went wrong. Please try again.',
  },
  list_sep: { fa: '، ', nl: ', ', en: ', ' },
  // ── conversational repair (turn a dead-end into ONE concrete next step) ──
  repair_constraint: {
    fa: 'با محدودیتی که گفتی غذای امنی پیدا نکردم. می‌خوای محدودیت رو بردارم و دوباره بگردم، یا یه غذای دیگه بگیم؟',
    nl: 'Met de beperking die je noemde vond ik geen veilig gerecht. Zal ik de beperking loslaten en opnieuw zoeken, of proberen we een ander gerecht?',
    en: 'With the constraint you gave I couldn’t find a safe dish. Shall I drop the constraint and search again, or try a different dish?',
  },
  repair_ingredient: {
    fa: '«{name}» رو شناختم ولی غذای کاملی باهاش پیدا نکردم. می‌خوای جایگزین‌های «{name}» رو بگم، یا یه مادهٔ دیگه بگو تا برات بگردم؟',
    nl: 'Ik herken «{name}», maar vond er geen volledig gerecht mee. Wil je vervangers voor «{name}», of noem een ander ingrediënt dan zoek ik verder?',
    en: 'I recognized «{name}», but found no full dish with it. Want substitutes for «{name}», or name another ingredient and I’ll keep looking?',
  },
  blocked_vision: {
    fa: 'تحلیل تصویر در این نسخه در دسترس نیست؛ من فقط دستیار آشپزی متنی هستم. لطفاً مواد یا اسم غذا را بنویس. (Image analysis is not available in this build.)',
    nl: 'Beeldanalyse is in deze versie niet beschikbaar; ik ben alleen een tekstuele kookassistent. Schrijf je ingrediënten of de naam van het gerecht.',
    en: 'Image analysis is not available in this build; I’m a text-only cooking assistant. Please write your ingredients or the dish name.',
  },
  blocked_injection: {
    fa: 'این درخواست قابل پردازش نیست. لطفاً سؤال آشپزی‌ات را ساده و مستقیم بپرس.',
    nl: 'Dit verzoek kan niet worden verwerkt. Stel je kookvraag eenvoudig en direct.',
    en: 'This request can’t be processed. Please ask your cooking question simply and directly.',
  },
  blocked_safety: {
    fa: 'من فقط دستیار آشپزی گارنیش هستم و نمی‌تونم در زمینهٔ پزشکی، رژیم درمانی یا موارد حساس کمک کنم. لطفاً یک سؤال آشپزی بپرس.',
    nl: 'Ik ben alleen de Garnish-kookassistent en kan niet helpen met medische, therapeutische-dieet of gevoelige onderwerpen. Stel een kookvraag.',
    en: 'I’m only the Garnish cooking assistant and can’t help with medical, therapeutic-diet or sensitive topics. Please ask a cooking question.',
  },
  blocked_nutrition: {
    fa: 'نمی‌تونم ادعای تغذیه‌ای یا سلامتی بدم؛ اما می‌تونم رسپی و پیشنهاد آشپزی ارائه بدم.',
    nl: 'Ik kan geen voedings- of gezondheidsclaims doen; wel kan ik recepten en kooksuggesties geven.',
    en: 'I can’t make nutritional or health claims; but I can offer recipes and cooking suggestions.',
  },
  blocked_cost: {
    fa: 'درخواست‌های زیادی در این بازه ثبت شده. لطفاً کمی بعد دوباره امتحان کن.',
    nl: 'Er zijn te veel verzoeken in deze periode. Probeer het zo nog eens.',
    en: 'Too many requests in this window. Please try again shortly.',
  },
  ts_ask: {
    fa: 'کمکت می‌کنم رفعش کنیم — فقط بگو کدوم غذا بود و دقیقاً چی شد (مثلاً «برنجم شفته شد» یا «ته‌دیگم چسبید»). اگر بخوای می‌تونم جایگزینِ مواد یا یه ایدهٔ غذای دیگه هم بدم.',
    nl: 'Ik help je het op te lossen — zeg welk gerecht het was en wat er precies gebeurde (bijv. «mijn rijst werd papperig» of «mijn tahdig plakte»). Desgewenst geef ik ook een vervanging of een ander gerecht-idee.',
    en: 'I’ll help you fix it — tell me which dish it was and what exactly happened (e.g. «my rice went mushy» or «my tahdig stuck»). If you like, I can also suggest a substitute or another dish idea.',
  },
};

/** Fill `{slot}` placeholders. */
function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_m, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

/** Resolve a template by key + locale (falls back to fa if a locale string is missing), filling vars. */
export function t(key: string, locale: Locale, vars?: Record<string, string | number>): string {
  const entry = TEMPLATES[key];
  if (!entry) return key; // missing key is a dev error, surfaced loudly rather than crashing a turn
  return interpolate(entry[locale] ?? entry.fa, vars);
}

/** Exposed for tests: every key + its locales. */
export const TEMPLATE_KEYS = Object.keys(TEMPLATES);
export const __TEMPLATES_FOR_TEST = TEMPLATES;
