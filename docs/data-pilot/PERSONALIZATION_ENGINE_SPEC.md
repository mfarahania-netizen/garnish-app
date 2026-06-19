# مهندسی شخصی‌سازی و جایگزینی گارنیش — مشخصات کامل (Personalization & Substitution Engine Spec)

سند مرجع و قابل‌اجرا (code-grounded). نسخه ۱.۰ — ۱۴۰۵/۰۳/۳۰.

> هدف معماری: یک موتور جایگزینی و شخصی‌سازی که «بهترین در جهان» و **آینده‌نگر** باشد؛ یعنی افزودن یک «دلیلِ» جدید (مثلاً «کم‌سدیم» یا «بدون‌پیاز در روزه») فردا، یک **پیکربندی** باشد نه یک بازنویسی. این سند روی چهار سامانهٔ موجود سوار می‌شود و هیچ‌کدام را نمی‌شکند:
> 1. **Ingredient DB** — هر رسپی به مواد اولیه با `id` ارجاع می‌دهد؛ ~۲۴۹ از ۲۹۱ ماده‌ی استفاده‌شده اکنون از USDA قفل‌شده (`source_locked`) و دارای `substitutionOptions: [{name, reason}]` هستند. هر جایگزین باید به یک ماده‌ی **واقعی** در DB با `id` اشاره کند.
> 2. **Allergy HARD filter** — فقط آلرژی‌های **اعلام‌شده** را می‌خواند، ساختاراً جداست و **byte-identical/frozen** است. جایگزینی به‌خاطر آلرژی همیشه «حذف اجباری» است، نه «نرم‌کردن».
> 3. **FI-4.1 soft taste** — کاربر می‌تواند per-ingredient like/dislike بزند؛ این سیگنالِ تصحیحِ ماندگار (`UserBehaviorSignal`, `signalType='ingredient_correction'`) را رنکر می‌خواند.
> 4. **GRIS** — پایهٔ رسپی: story، ingredients (با weight + role + swap)، steps (با flame + time + sees + recovery + doneness)، nutrition.

---

## ۰. اصول حاکم (Invariants — این‌ها هرگز نقض نمی‌شوند)

این هفت اصل، قراردادِ ایمنی موتورند. هر تستِ طلایی (golden test) باید این‌ها را تضمین کند:

- **I1 — تقدمِ مطلق آلرژی (Allergy supremacy):** فیلتر سختِ آلرژی **آخرین** مرحلهٔ خط لوله است و روی هر خروجی (رسپی پایه **و** هر جایگزینِ پیشنهادی) دوباره اجرا می‌شود. هیچ سیگنال نرمی (taste/cost/health/ease) نمی‌تواند آن را بازنویسی، نرم‌وزن یا دور بزند.
- **I2 — هرگز آلرژن را بازنگردان (Never reintroduce):** یک جایگزین فقط وقتی صادر می‌شود که `to.allergenTags ∩ user.declaredAllergens = ∅`. اگر پروفایلِ آلرژنِ جایگزین **نامعلوم** باشد → **default-deny** (پیشنهاد نمی‌شود)، نه fail-open.
- **I3 — اتحادِ قیدها (Union of constraints):** کاربر می‌تواند چند آلرژن/قید سخت هم‌زمان داشته باشد. جایگزین باید در برابر **اجتماع** همهٔ قیدهای سخت تمیز باشد، نه فقط قیدی که قرار است حل کند.
- **I4 — تفکیک سخت/نرم در مسیر کد:** «dislike عدس» (soft, down-rank) و «آلرژی به عدس» (hard, exclude) **دو مسیر کد کاملاً جدا** دارند. مسیر taste هرگز روی gate آلرژی اثر نمی‌گذارد.
- **I5 — Grounding:** هر `to` یک `ingredientId` واقعیِ موجود در DB است. هیچ id جدیدی هرگز تولید نمی‌شود. هر نسبت/دما/زمان از یک منبع curated یا قاعده‌ی grounded می‌آید — هیچ عددی از LLM آزاد ساخته نمی‌شود (rail‌های live LLM عمداً OFF می‌مانند).
- **I6 — صداقتِ ادعا:** موتور فقط می‌تواند بگوید «در فهرست مواد این رسپی، آلرژن X وجود ندارد». **نمی‌تواند** بگوید «برای آنافیلاکسی امن است» (cross-contact از روی فهرست مواد غیرقابل‌اثبات است). هر ادعای allergen-free با disclaimer و راهنمای جلوگیری از cross-contact همراه است.
- **I7 — افزایشی بودن (Additive):** همهٔ تغییرات schema افزایشی‌اند. مسیر سرد (`getLivingUserProfile`) و فیلتر آلرژی **byte-identical** می‌مانند. افزودنِ reason جدید = افزودن یک ردیف به رجیستری دلایل + داده، نه تغییر کد هسته.

---

## ۱. ابعادِ دلیل (Reason Dimensions) — رجیستریِ داده‌محور

قلبِ آینده‌نگری: دلایل **داده** هستند نه شاخهٔ `if/else`. یک `ReasonRegistry` نسخه‌دار، هر دلیل را با نوعش (HARD/SOFT) و رفتارش تعریف می‌کند. افزودن دلیل جدید = یک ردیف تازه.

| reasonTag | نوع | چه می‌کند (whatItDoes) |
|---|---|---|
| `allergy` | **HARD** | حذف اجباریِ ماده؛ مصرف‌کنندهٔ فیلتر سختِ frozen؛ هرگز نرم نمی‌شود؛ جایگزین باید آلرژن‌پاک باشد. |
| `observance` (شامل `no_pork`, halal, kosher, روزه) | **HARD** | قیدِ چندمحوری مذهبی/آیینی (گوشت غیرحلال، الکل در عرقیات، ژلاتین/مایه‌پنیر حیوانی، خوک و مشتقات). حذف یا swap اجباری؛ موارد *مشبوه* (mushbooh) flag می‌شوند نه silently مجاز. تمایز «بدون مادهٔ ممنوع» از «دارای گواهی». |
| `intolerance` (lactose, celiac/gluten, FODMAP) | **HARD (آستانه‌دار)** | عدم‌تحملِ پزشکی؛ celiac عملاً صفر-تحمل گلوتن. جدا از allergy و جدا از preference؛ آستانه/شدت مخصوص خود. |
| `taste_dislike` | SOFT | down-rank + پیشنهادِ حذف/جایگزینِ ماده‌ی موردِ بیزاری؛ از FI-4.1/FI-2.3 خوانده می‌شود؛ کاربر هنوز رسپی را می‌بیند. |
| `taste_add` | SOFT | افزودن ماده‌ای که کاربر دوست دارد (مثلاً «سیر بیشتر»)؛ up-rank ملایم و افزودن آیتم. |
| `availability` | SOFT (re-ranker) | «با چیزی که دارم بپز»؛ ترجیح موادِ در-انبار؛ کاهش خریدِ لازم؛ flag «مادهٔ تمام‌شده». |
| `cost` | SOFT (re-ranker) | swapِ ارزان‌تر روی موادِ **پشتیبان** (نه ماده‌ی قهرمان)؛ نمایش delta هزینهٔ هر وعده. |
| `health` | SOFT (re-ranker) | بهبود ماکرو/پروفایل (پروتئین/فیبر بیشتر، قند/چربی کمتر)؛ swap کوچک و قابل‌تشخیص؛ هرگز ادعای درمانی. |
| `ease_skill_time` | SOFT (re-ranker) | جایگزینی برای کاهش مهارت/زمان/مرحله (مثلاً لوبیای پخته‌ی کنسروی به‌جای خشک)؛ از effortFit/skillFit (FI-2.2) تغذیه می‌شود. |

**قاعدهٔ تقدم (precedence) وقتی چند دلیل هم‌زمان فعال‌اند:** `HARD` همیشه قبل از `SOFT`. درون HARD، حذف‌ها اجتماع می‌شوند (I3). درون SOFT، re-rankerها روی **مجموعهٔ کاندیدای از-پیش-ایمن‌شده** اعمال می‌شوند، هرگز به‌عنوان فیلتر اولیه. ترتیب SOFT قابل‌پیکربندی است (وزن‌ها در ReasonRegistry).

> **چرا این ابعاد آینده‌نگرند:** هر دلیل یک رکوردِ `{tag, kind: HARD|SOFT, weight, filterFn|rankFn, copy}` است. افزودن «low_sodium» فردا = افزودن یک ردیف SOFT با یک rankFn کوچک؛ هیچ تغییری در cascade، nutrition، یا allergy gate لازم نیست.

---

## ۲. مدلِ هر یال (Per-Edge Data Model) — `SubstitutionEdge`

یک swap یک «جفت نام→نام» نیست؛ یک **بردارِ کارکرد + مجموعه‌قاعده‌ی ویرایش** است. هر یال این فیلدها را دارد:

| field | purpose |
|---|---|
| `fromIngredientId` | ماده‌ی مبدأ (ارجاع واقعی DB). |
| `toIngredientId` | ماده‌ی مقصد (ارجاع واقعی DB؛ هرگز رشته‌ی آزاد). برای remove، `null`. |
| `reasonTags: string[]` | یک یا چند دلیل از رجیستری بخش ۱ (یک یال می‌تواند هم‌زمان `cost` و `availability` را برآورده کند). |
| `kindResolved: HARD\|SOFT` | از پرشدت‌ترین reasonTag مشتق می‌شود (اگر هر تگ HARD باشد، یال HARD است). |
| `quantityAdjust` | `{ multiplier: number, basis: 'weight'\|'volume'\|'count', note?: string }` — ضریب مقدار (پیش‌فرض داخلی بر پایهٔ **گرم/وزن**، نمایش به cup تبدیل می‌شود). `count`/«to taste» به‌جای ضرب، non-scalable flag می‌خورد. |
| `dependentDeltas: Delta[]` | ویرایش‌های زنجیره‌ای روی **سایر** مواد (مثل «مایع را ¼ cup کم کن»، «½ تری‌بیکینگ‌سودا اضافه کن»). هر Delta: `{ ingredientId, op: 'reduce'\|'add'\|'replace', amount, unit, reason }`. |
| `qualityMatch: 'perfect'\|'good'\|'acceptable'` | درجهٔ سه‌سطحی، تابع چندمحوره (flavorSim × functionalMatch × ratioPenalty). همیشه **نظرِ موتور** با «چرا»، قابلِ override کاربر. |
| `flavorImpact` / `textureImpact` | جملهٔ کوتاهِ انسانی («روغن مرطوب‌تر و ماندگارتر می‌کند ولی پوسته‌ای و برشته نمی‌شود»). |
| `roleCoverage: Role[]` | کدام نقش‌های functional ماده‌ی مبدأ پوشش داده می‌شود (structure/leavening/binding/fat/acid/sweetener/aromatic/bulk/thickener/browning/emulsifier/protein). swap فقط وقتی مجاز است که نقش‌های **بحرانی** را بپوشاند. |
| `tempDelta` / `timeDelta` | تغییر دما/زمان پخت (مثلاً honey→sugar: دما −۲۵°F). به cascade تزریق می‌شود. |
| `stepImpact: StepImpactRule[]` | چگونه مراحل پخت تغییر می‌کنند (بخش ۳). هر rule: `{ kind: 'retime'\|'restage'\|'insert'\|'remove'\|'rephrase', target, payload }`. |
| `allergenTagsTo: string[]` | tagهای canonical آلرژنِ مقصد (برای I2؛ از Ingredient.allergens خوانده می‌شود). |
| `confidence: number` | اعتماد یال (curated explicit > same-role peer). برای رتبه‌بندی و نمایش caveat. |
| `source` | منبع grounding (`curated_substitutionOptions` / `same_category_peer` / `function_rule` + استناد KingArthur/ATK/SeriousEats در metadata). |
| `gates: string[]` | پیش‌شرط‌های صدور یال (مثلاً `requires_acid_in_recipe` برای soda↔powder؛ `cap_eggs<=3` برای جایگزینِ تخم‌مرغ). |

> یال‌ها در دو لایه زندگی می‌کنند: (الف) یال‌های **curated** (از `Ingredient.substitutionOptions`، authoritative)؛ (ب) یال‌های **function-rule** (از قواعد grounded مثل soda↔powder، honey↔sugar، fresh↔dried herb، butter↔oil، egg-replacer، meat↔tofu). لایهٔ curated همیشه بر same-category peer مقدم است (همان منطق فعلیِ `suggest-substitutions.tool.ts`).

---

## ۳. قواعد آبشار (Cascade Rules) — وقتی ماده عوض می‌شود، مراحل چطور بازمشتق می‌شوند

این تمایزِ کلیدی است: گارنیش هرگز کل رسپی را با LLM بازنمی‌نویسد. cascade دو حالت دارد و قاعدهٔ روشنی برای انتخاب بینشان:

### ۳.۱ Rule-based patch (پیش‌فرض، ترجیحی)
وقتی `stepImpact` یال **بسته (closed-form)** است — یعنی تغییر را می‌توان با ویرایش‌های موضعی و قطعی روی مراحل اعمال کرد:
- **retime:** مرحله‌ای که `to` در آن پخته می‌شود، `timeDelta`/`tempDelta` می‌گیرد (tofu زودتر از گوشت برشته می‌شود؛ braise ۹۰ دقیقه‌ای گوشت → simmer کوتاه).
- **restage:** تغییرِ «کِی در روش» (سبزی خشک اول با مایع؛ سبزی تازه آخر و خارج از حرارت؛ slurry نشاسته در مایع سرد). فیلدِ `addStage: early|finish` ماده را به مرحلهٔ درست منتقل می‌کند.
- **insert:** مرحله‌ی لازمِ تازه (press tofu ۱۰–۳۰ دقیقه، gel کردن flax ۱۰ دقیقه، marinate، pre-cook عدس).
- **remove:** حذف مرحله‌ای که دیگر بی‌معناست (مثلاً «خامه بگیر» وقتی روغن جای کره آمده).
- **rephrase:** بازنویسی متنِ مرحله با جایگزینی نام ماده + درج caveat (بدون تغییر منطق پخت).

هر mutation روی GRIS با حفظِ فیلدهای غنیِ مرحله انجام می‌شود: **flame** (شدت شعله), **time**, **sees** (نشانهٔ بصری/visual cue), **recovery** (اقدام نجات اگر خراب شد), **doneness** (نشانهٔ آماده‌شدن). این فیلدها از یال (`flame`/`time` از `tempDelta`/`timeDelta`؛ `sees`/`doneness` از پروفایلِ بافت/پختِ ماده‌ی مقصد) دوباره مشتق می‌شوند.

### ۳.۲ GRIS regeneration of affected steps (استثنا، محدود و gated)
فقط وقتی stepImpact **باز/ساختارشکن** است: چند swap هم‌زمان در یک بِیکِ نسبت-حساس (شیمی leavening عوض شده)، یا تبدیل دایتیِ کل‌رسپی (meat→vegan کل غذا). در این حالت:
- فقط **مراحلِ متأثر** (نه کل رسپی) از GRIS بازتولید می‌شوند، با همان contractِ فیلدهای flame/time/sees/recovery/doneness.
- خروجی **پیش از نمایش** دوباره از فیلتر سختِ آلرژی و functional-check عبور می‌کند (I1/I2).
- نتیجه به‌عنوان «رسپیِ مشتق‌شدهٔ تأییدنشده» برچسب می‌خورد و caveat اعتماد می‌گیرد (چند swap هم‌زمان = یک رسپیِ جدیدِ validate‌نشده).

### قاعدهٔ انتخاب (decision rule)
```
if edge.stepImpact همه closed-form  AND  تعداد swapهای هم‌زمان روی یک بِیکِ نسبت-حساس ≤ ۱:
        → rule-based patch
else (چند swap نسبت-حساس | diet-convert کل‌رسپی | نقش بحرانی بدون قاعدهٔ بسته):
        → GRIS regeneration فقط روی مراحل متأثر، با re-gate آلرژی/functional
```

---

## ۴. مثال کارشده — آبشارِ chicken → tofu (به‌خاطر observance/taste/health)

پروفایل: کاربر گیاه‌خوار شده (`taste_add` گیاهی + `health` پروتئین گیاهی). رسپی پایه (GRIS): «خوراک مرغ»، یک ماده `ing_chicken_breast`، یک مرحله: *flame: متوسط‌-بالا، time: ۱۸ دقیقه، sees: «سطح طلایی»، recovery: «اگر چسبید روغن اضافه کن»، doneness: «دمای مغز ۷۴°C»*.

1. **انتخاب یال:** `from=ing_chicken_breast → to=ing_tofu_firm`, `reasonTags=[taste_add, health]`, `kindResolved=SOFT`, `roleCoverage=[protein]`, `confidence=good`.
2. **مقدار:** `quantityAdjust={multiplier: 1.0, basis: weight}` (تقریباً ۱:۱ وزنی). `qualityMatch='good'` (پروتئین پوشش داده شد؛ بافت و طعم تغییر می‌کند).
3. **dependentDeltas:** `add روغن +1 tbsp` (توفو چربیِ ذوب‌شده ندارد، Maillard به روغن نیاز دارد).
4. **stepImpact (rule-based patch — همه closed-form):**
   - **insert** پیش از مرحلهٔ پخت: *«توفو را ۲۰ دقیقه press کن تا آبش برود» (sees: «سفت و خشک‌سطح»)* + اختیاری *marinate ۳۰ دقیقه*.
   - **retime:** زمان پخت ۱۸→حدود ۱۰–۱۲ دقیقه (توفو سریع‌تر برشته می‌شود، collagen‌ای برای شکستن نیست).
   - **restage/rephrase:** متن: «مرغ» → «توفو»؛ flame همان متوسط‌-بالا (برای brown شدن سطحِ خشک).
   - **doneness بازمشتق:** «دمای مغز ۷۴°C» (ایمنیِ مرغ) → «هر طرف طلایی‌-طلایی، ~۴–۵ دقیقه» (نشانهٔ توفو از `cookingBehavior` ماده). **recovery بازمشتق:** «اگر چسبید، حرارت کم و روغن بیشتر».
5. **بازمحاسبهٔ زنده:** nutrition و health-score از وزن×`nutritionPer100g` توفو + روغنِ اضافه‌شده دوباره حساب می‌شوند (بخش ۵).
6. **re-gate آلرژی (I1/I2):** توفو = **soy**. اگر کاربر آلرژی soy اعلام کرده بود، این یال **هرگز صادر نمی‌شد** و موتور به جایگزینِ بعدیِ آلرژن‌پاک (مثلاً نخود/seitan با چکِ gluten) می‌رفت — یا اگر هیچ‌کدام تمیز نبود، default-deny + پیام صادقانه.

> این مثال نشان می‌دهد چرا swap «نام→نام» خطرناک است: بدون press/retime/doneness/recovery، نتیجه توفویِ خام‌-آبکیِ بی‌مزه است؛ و بدون re-gate، soy می‌توانست بی‌صدا وارد شود.

---

## ۵. add / remove / like / dislike فراتر از ۱:۱

موتور باید بیش از swapِ یک‌به‌یک را مدل کند:

- **REMOVE (حذف ساده):** `to=null`. اگر ماده نقشِ بحرانی نداشته باشد (مثلاً جعفریِ تزئینی) → فقط remove + rephrase مرحله. اگر نقشِ بحرانی داشته باشد (binder/leavener) → remove **ممنوع** مگر همراه با جایگزینی که نقش را پوشش دهد (cascade به regeneration می‌رود).
- **ADD (افزودن):** ماده‌ی جدید با وزن/نقش وارد می‌شود؛ یک مرحلهٔ `insert` با flame/time/sees/doneness از `cookingBehavior` ماده ساخته می‌شود؛ nutrition بازمحاسبه می‌شود. برای `taste_add` (سیر بیشتر) صرفاً مقدار افزایش می‌یابد (no new step).
- **LIKE (FI-4.1):** یک سیگنالِ `ingredient_correction` مثبت (LIKE_VALUE=0.5، locked) می‌نویسد؛ up-rankِ ملایمِ نامتقارن (ضعیف‌تر از aversion، برای حفظِ exploration). می‌تواند `taste_add` را پیشنهاد دهد.
- **DISLIKE (FI-4.1):** سیگنالِ منفی (DISLIKE_VALUE=−0.7، locked)؛ down-rankِ نرم + پیشنهادِ swapِ `taste_dislike`. **هرگز** حذفِ سخت — کاربر هنوز رسپی را می‌بیند (تضمینِ ساختاریِ soft≠hard، اثبات‌شده در `fi-phase-2-3-ingredient-soft-taste.spec.ts`).
- **چندتایی (non-1:1):** یک حذف می‌تواند چند add را trigger کند (مثل ATK که برای کوکیِ vegan تخم‌مرغ را حذف و فرمول را با soda+powder+روغن نارگیل **بازمهندسی** کرد) — این به‌صراحت مسیر GRIS-regeneration است، نه patch.

---

## ۶. nutrition + health-score زنده (Live recompute)

- **منبعِ حقیقت:** برای هر ماده، `weight(g) × Ingredient.nutritionPer100g / 100`، جمع روی همهٔ مواد پس از cascade. توفوِ source-locked عددِ معتبر دارد؛ اگر ماده‌ای `nutritionConfidence` پایین داشته باشد، نتیجه با flagِ «تخمینی» نمایش داده می‌شود (no silent precision).
- **همگام با هر edit:** هر swap/add/remove که وزن یا dependentDeltas را عوض کند، بلافاصله `Nutrition{calories,protein,carbs,fat,fiber}` و health-score را بازمحاسبه می‌کند. dependentDeltas (مثل +روغن) هم در جمع لحاظ می‌شوند.
- **health-score:** تابعِ همان ماکروها (پروتئین/فیبر بالاتر و قند/چربی/سدیمِ پایین‌تر امتیاز می‌گیرند) — هم‌راستا با لنزِ GLP-1/پروتئین‌محورِ ۲۰۲۶. هیچ ادعای پزشکی/درمانی صادر نمی‌شود.
- **invariantِ ایمنی:** بازمحاسبهٔ nutrition هرگز روی gate آلرژی اثر نمی‌گذارد و بالعکس — مسیرها جدا می‌مانند (I4).

---

## ۷. invariantهای فیلتر سختِ آلرژی (هرگز بازنگرداندن)

- فیلتر آلرژی **frozen/byte-identical** می‌ماند؛ فقط `declared allergies` را می‌خواند (هرگز سیگنال‌های taste).
- موتورِ جایگزینی **downstream** آن اجرا می‌شود و خروجی‌اش **دوباره** از آن عبور می‌کند: یال فقط اگر `to.allergenTags ∩ declared = ∅` صادر می‌شود (I2).
- **default-deny روی ناشناخته:** اگر آلرژنِ مقصد نامعلوم باشد، پیشنهاد نمی‌شود.
- **اتحاد (I3):** swapِ رفعِ آلرژن A نباید آلرژن B را وارد کند (almond-milk برای milk-allergy → tree-nut؛ soy-yogurt برای milk → soy؛ همه رد).
- **resolve به tag canonical:** هرگز match روی رشتهٔ نام (casein/whey=milk؛ Worcestershire/anchovy=fish؛ soy lecithin=soy؛ semolina/seitan=wheat). از `analyzeRecipeIntegrity().derivedAllergens` (resolved از فرهنگ مواد) استفاده می‌شود.
- **PAL/«may contain»** سیگنالِ uncertaintyِ جداست؛ نبودش اثباتِ نبودِ آلرژن نیست (I6).
- **تستِ طلایی:** برای هر آلرژنِ اعلام‌شده، هیچ مشتقِ شناخته‌شدهٔ آن هرگز در خروجی ظاهر نشود؛ هر کاندیدای حذف‌شده log می‌شود (auditability) — همان الگوی `dropped[]` در `suggest-substitutions.tool.ts`.

---

## ۸. اتصال به چهار سامانهٔ موجود (Integration)

- **Ingredient DB:** `to`/`from`/`dependentDeltas` همه به `ingredientId` واقعی اشاره می‌کنند. لایهٔ curated از `Ingredient.substitutionOptions` می‌آید (authoritative؛ منطقِ «curated > same-category peer» در `suggest-substitutions.tool.ts` حفظ می‌شود). `allergens`, `nutritionPer100g`, `tasteProfile`, `textureProfile`, `cookingBehavior`, `dietFlags` فیلدهای Json موجودند که یال و cascade از آن‌ها تغذیه می‌کنند.
- **Allergy HARD filter:** موتور هرگز فیلتر را تغییر نمی‌دهد؛ آن را به‌عنوان gate نهایی صدا می‌زند (`analyzeRecipeIntegrity` + `recipeSafetyCheck`/`assessRecipeFit`). رسپیِ `recommendation==='avoid_allergen'` هرگز سطح‌بندی نمی‌شود.
- **FI-4.1 soft taste:** like/dislike موتور همان `UserBehaviorSignal{signalType:'ingredient_correction'}` را می‌نویسد که `TasteCorrectionService` مدیریت می‌کند؛ رنکر (FI-2.3) بدون تغییر آن را به‌عنوان `signal_ing_*` می‌خواند. `taste_dislike`/`taste_add` از این سیگنال‌ها مشتق می‌شوند.
- **GRIS:** cascade روی steps با حفظِ فیلدهای flame/time/sees/recovery/doneness عمل می‌کند (patch یا regeneration محدود). `ingredients.role` و `ingredients.swap`ِ GRIS، roleCoverage و یال‌های پیش‌فرض را تغذیه می‌کنند. effortFit/skillFit (FI-2.2) دلیلِ `ease_skill_time` را تغذیه می‌کنند.

---

## ۹. تغییرات schema (افزایشی — هیچ ستونِ موجودی تغییر نمی‌کند)

- **`SubstitutionEdge`** (جدول جدید، یا persist روی `Recipe.substitutions`/`Ingredient.substitutionOptions` به‌شکلِ توسعه‌یافته): فیلدهای بخش ۲.
- **`ReasonRegistry`** (جدول/سیدِ نسخه‌دار): ردیف هر دلیل `{tag, kind, weight, copy, version}` — افزودنِ reason جدید = یک ردیف.
- **`RecipeStep` افزوده‌ها (nullable):** `flame`, `sees`, `recovery`, `doneness`, `addStage('early'|'finish')` — تا GRIS غنی persist شود (اکنون فقط `instruction`/`duration` هست).
- **`Ingredient` افزوده‌ها (Json، nullable):** `functionalRoles: Role[]`, `allergenTagsCanonical: string[]`, `costPerServing`, `seasonality:{region,isoWeek[]}`, `palWarnings[]` — همه افزایشی روی مدلِ Json موجود.
- **`UserPantry`** (جدول جدید، برای `availability`): `{userId, ingredientId, lastConfirmedAt, qty?}` — conservative/recently-confirmed.
- **`PersonalizationAudit`** (جدول جدید): هر یالِ صادرشده/حذف‌شده + reasonTags + allergyGateResult — برای regression و auditability.

> همهٔ این‌ها I7 را رعایت می‌کنند: مسیر سردِ پروفایل و فیلتر آلرژی byte-identical می‌مانند؛ ستون‌های جدید nullable و default خنثی دارند.

---

## ۱۰. آینده‌نگری (Future-proofing)

- **دلیل به‌عنوان داده:** افزودنِ `low_sodium`/`no_onion_fasting`/`anti_inflammatory` = یک ردیف در `ReasonRegistry` + (اختیاری) یک rankFn کوچک. صفر تغییر در cascade/nutrition/allergy gate.
- **TAXONOMYِ آلرژنِ نسخه‌دار و jurisdiction-aware:** EU-14 در برابر US-Big-9 به‌عنوان داده؛ ابتکارِ آستانهٔ FDA (Feb 2026) با به‌روزرسانیِ داده جذب می‌شود، نه refactor.
- **یال‌ها لایه‌ای‌اند:** curated > function-rule > same-category peer؛ افزودنِ منبعِ جدید (مثلاً cost/season feed) فقط یک re-ranker روی مجموعهٔ ایمن است، نه فیلتر اولیه.
- **harnessِ اعتبارسنجی:** corpus حقیقتِ seedشده (AllRecipes/Food Network/Cook's Thesaurus/Food.com) با MAP/MRR/Recall@k؛ کیفیتِ درجه measurable و regression-tested است، نه «حسی».
- **gradeها قابل‌override:** هیچ درجه‌ای حقیقتِ مطلق نیست (SOTA MAP ~۰.۴۰)؛ همیشه «چرا» + override کاربر (هم‌راستا با FI-4.1).
- **disclaimer قانونی** روی هر سطحِ آلرژی/دایت (به‌تنهایی به اپ تکیه نکن؛ برچسب را بخوان؛ برای آلرژیِ شدید پزشک).

---

*پایان مشخصات — این سند منبعِ مرجعِ موتور است و باید با هر تغییرِ schema/قاعده به‌روز شود.*
