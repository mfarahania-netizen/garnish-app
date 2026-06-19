# برنامهٔ اولویت‌بندی‌شدهٔ رفعِ نقص‌های لایهٔ تعاملِ دستور (Recipe-Interaction Fix Plan)

> منبع: ممیزیِ تعاملِ صفحهٔ دستور (servings-scaling · swap-apply · remove · cook/GRIS · performance · interaction-gaps).
> قرارداد مرجع: `docs/data-pilot/PERSONALIZATION_ENGINE_SPEC.md` (بخش‌های ۰، ۲، ۳، ۵، ۶، ۸).
> این سند تنها برنامهٔ ساخت است؛ هیچ کدی هنوز نوشته نشده.

## خلاصهٔ وضعیت

سه قابلیتِ هستهٔ شخصی‌سازی روی صفحهٔ دستور **معماری‌شان ناقص** است: مقیاس‌بندیِ سروینگ، اعمالِ جایگزینی (swap)، و حذفِ ماده. هر سه به یک چیزِ مشترک نیاز دارند که هنوز وجود ندارد: **یک لایهٔ واحدِ «حالتِ شخصی‌سازیِ نشست» (personalization-state layer)** که صفحهٔ دستور + کوک‌مود از آن بخوانند. تا وقتی این لایه ساخته نشود، حتی قابلیت‌های نیمه‌موجود (نمایشِ پیشنهادِ swap) هم بی‌اثر می‌مانند.

شمارش بر اساس شدت: **بحرانی ۱۰ · مهم/زیاد ۱۲ · متوسط ۱۲ · کم ۵** (و چند موردِ هم‌پوشان میان حوزه‌ها).

---

## بحرانی (Blocker — قابلیت اصلاً کار نمی‌کند)

| # | چه چیزی | ریشه | رفع | فایل‌ها |
|---|---------|------|-----|---------|
| C1 | تغییرِ سروینگ در AISheet (۴→۸) مقدارِ موادِ دستورِ flat را بازمحاسبه نمی‌کند؛ کاربر همان مقدار را می‌بیند. | `servedFor` ذخیره می‌شود ولی ضریبِ `newServings/baseServings` هرگز محاسبه/اعمال نمی‌شود. | ابزارِ `scaleIngredient(ing,new,base)` (parse→ضرب→format)؛ `useMemo` کلیددار روی `servedFor`+`baseServings`؛ نمایشِ `scaledAmount`. | `apps/web/src/app/recipe/[id]/page.jsx:380-394,224,389` |
| C2 | موادِ GRIS (`weightG`/`volume`) با تغییرِ سروینگ مقیاس نمی‌خورند؛ قراردادِ §۶ نقض است. | به `GrisRecipe` فقط `gris` پاس می‌شود، بدون `servedFor`/`baseServings`؛ render مستقیم. | پاس‌دادنِ `servedFor`+`baseServings`؛ `scaleFactor` داخل کامپوننت؛ مقیاسِ `weightG`(گردکردن) و parse+scale برای `volume`؛ memoize. | `apps/web/src/app/recipe/[id]/page.jsx:377` · `apps/web/src/components/ges/GrisRecipe.jsx:128` |
| C3 | در حالتِ swapِ AISheet کلیک روی پیشنهاد هیچ اثری ندارد؛ آیتم‌ها `<Box>`ِ فقط‌نمایشی‌اند. | بدون `pickedSwap` state، بدون onClick، بدون دکمهٔ Apply. | `pickedSwap` state؛ تبدیل به `<UnstyledButton>` با حالتِ active؛ دکمهٔ «اعمالِ این جایگزین» که `onApplySwap?.()` صدا بزند. | `apps/web/src/components/ges/AISheet.jsx:32,35,155-159,168-170` |
| C4 | `RecipeDetailPage` نه callbackِ دریافتِ swap دارد نه state؛ نامِ ماده هرگز عوض نمی‌شود. | بدون `onApplySwap`، بدون `appliedSwaps` state؛ همیشه `ing.name` خام render می‌شود. | `appliedSwaps` state؛ هندلرِ `applySwap(from,to)`؛ پاس‌دادنِ `onApplySwap`؛ نمایشِ `appliedSwaps[ing.name] \|\| ing.name`. | `apps/web/src/app/recipe/[id]/page.jsx:214-226,384-391,521` |
| C5 | `SubSheet` (انتخاب‌گرِ per-ingredient) هم آیتم‌ها را به‌صورتِ `<Box>`ِ غیرتعاملی نشان می‌دهد. | بدون onClick، بدون callbackِ apply (فقط props ‌`sub,onClose`). | props ‌`onApplySwap,pickedIngredient`؛ `<UnstyledButton>` با highlight؛ دکمهٔ Apply؛ اتصال به همان `applySwap`. | `apps/web/src/app/recipe/[id]/page.jsx:175,196-200` |
| C6 | پذیرشِ swap هیچ cascade روی مراحل اعمال نمی‌کند (§۳: retime/restage/rephrase)؛ مرحله‌ها immutable می‌مانند. | هیچ فراخوانیِ endpointِ cascade وجود ندارد؛ steps مستقیم render می‌شوند. | `POST /recipes/:id/cascade` (یا گسترشِ `/full` با queryِ swaps/servings)؛ merge در `mutatedSteps`؛ بازمحاسبهٔ تغذیه/متادیتای متأثر. | `apps/web/src/app/recipe/[id]/page.jsx:214-534,469-479` · `apps/server/src/recipes/intelligence/recipe-richness.service.ts` |
| C7 | امضای `AISheet` propِ `onApplySwap` ندارد؛ کامپوننتِ صرفاً نمایشی است. | خطِ ۳۲ فاقدِ `onApplySwap`. | افزودن `onApplySwap` به signature و صداکردنِ آن هنگامِ Apply؛ پاس‌دادن از والد. | `apps/web/src/components/ges/AISheet.jsx:32` · `apps/web/src/app/recipe/[id]/page.jsx:521` |
| C8 | هیچ affordanceی برای **حذفِ کاملِ ماده** وجود ندارد؛ فقط «جایگزین؟» هست. | لیستِ مواد فقط دکمهٔ `askSub` دارد؛ AISheet حالتِ remove ندارد. | دکمهٔ حذف (آیکن trash) کنارِ هر ماده؛ حالتِ بصریِ «حذف‌شده»؛ `removedIngredients: Set<string>` در state. | `apps/web/src/app/recipe/[id]/page.jsx:384-391` · `apps/web/src/components/ges/AISheet.jsx` |
| C9 | کوک‌مود به‌جای GRIS v2 از `recipe.steps`ِ flat می‌خواند؛ متادیتای flame/tempC/durationMin/sees/recovery/doneness کاملاً گم می‌شود. | `const steps = detail.recipe?.steps`؛ `detail.gris` هرگز چک نمی‌شود. | اولویت با GRIS: `detail.gris?.steps?.length ? gris.steps : recipe.steps`؛ استخراجِ `s.instruction` برای آبجکت و string برای قدیمی؛ پاس‌دادنِ gris به UI. | `apps/web/src/app/cook/[id]/useCook.js:45,86` · `useRecipeDetail.js:102` |
| C10 | کوک‌مود UIِ مخصوصِ GRIS را render نمی‌کند؛ همهٔ نشانه‌های بصری/دما/شعله گم می‌شوند. | فقط `c.currentStep`ِ متنی render می‌شود. | render شرطیِ GRIS-aware (flame/temp/duration/sees/recovery/doneness) شبیهِ GrisRecipe؛ fallback برای stringِ قدیمی. | `apps/web/src/app/cook/[id]/page.jsx:183` · `apps/web/src/components/ges/GrisRecipe.jsx:149-161` |

---

## مهم / زیاد (High — قابلیت کار می‌کند ولی شکننده یا ناقص)

| # | چه چیزی | ریشه | رفع | فایل‌ها |
|---|---------|------|-----|---------|
| H1 | پاسخِ APIِ flat دادهٔ ساختاریِ مقدار ندارد (فقط `amountText`)؛ مقیاس‌بندی به parseِ شکنندهٔ رشته نیاز دارد. | mapِ مواد فقط `name`+`amountText`؛ نبودِ `{amount,unit}`. | ایده‌آل: گسترشِ API با `{amount,unit}`. کوتاه‌مدت: `parseAmountText(text)→{amount,unit}` با پشتیبانیِ واحدهای فارسی/انگلیسی + تست. | `apps/web/src/app/recipe/[id]/useRecipeDetail.js:67-70` |
| H2 | کوک‌مود شخصی‌سازیِ صفحهٔ دستور (سروینگ/swap/remove) را دریافت نمی‌کند. | `servedFor` فقط local؛ ناوبری به cook بدون state؛ `useRecipeDetail` مستقلاً refetch می‌کند. | لایهٔ مشترکِ `CookSessionContext`/sessionStorage (ترجیحی) یا queryParam؛ اعمالِ مقدار/مرحله در cook. | `apps/web/src/app/recipe/[id]/page.jsx:224,516` · `apps/web/src/app/cook/[id]/page.jsx`,`useCook.js:37` |
| H3 | parseِ مدتِ مرحله با regex روی متنِ فارسی به‌جای `durationMin`ِ ساختاریِ GRIS. | `stepMinutes()` همیشه regex می‌زند. | اگر آبجکتِ GRIS بود `step.durationMin` مستقیم؛ وگرنه fallbackِ regex؛ پاس‌دادنِ خودِ آبجکتِ مرحله. | `apps/web/src/app/cook/[id]/page.jsx:18-34` · `useCook.js` |
| H4 | هیچ منطقِ cascade (client/server) برای بازمحاسبهٔ مراحل پس از swap نیست (§۳). | نبودِ stepImpact/quantityAdjust/dependentDeltas. | دوفازی: `POST /recipes/:id/personalize` (patch قاعده‌مند یا GRIS-regen) → بازگشتِ stepsِ تنظیم‌شده. | `apps/server/src/*` · `apps/web/src/*` · `AISheet.jsx` |
| H5 | §۲ `quantityAdjust` هنگامِ swap اعمال نمی‌شود (honey→sugar ضریب عوض می‌کند). | مقادیر static از `amountText`. | ذخیرهٔ `quantityAdjust` از پاسخِ cascade؛ نمایشِ مقدارِ تنظیم‌شده («½ پیمانه (تنظیم‌شده برای توفو)»). | `apps/web/src/app/recipe/[id]/page.jsx:384-391` |
| H6 | پس از اعمالِ swap هیچ بازخوردِ بصری نیست (نام/مقدار بدون تغییر، بدون toast/badge). | بدون indicator روی مادهٔ swap‌شده. | toastِ «جایگزین شد: A → B»؛ chip/«جایگزین‌شده»؛ به‌روزرسانیِ مقدار در صورتِ scaling. | `apps/web/src/app/recipe/[id]/page.jsx:387` |
| H7 | مدلِ داده برای حذف/optional نبودِ کامل: `RecipeIngredient` فیلدِ `isRemoved`/`isOptional`/`status` ندارد. | اسکیمای فقط id/recipeId/.../order. | افزودنِ additiveِ `isRemoved Boolean @default(false)` (+ اختیاری `removedAt`)؛ یا جدولِ سبکِ `RecipeCustomization`. | `apps/server/prisma/schema.prisma:235-248` |
| H8 | endpointی برای toggleِ حذفِ ماده نیست؛ `/full` فقط‌خواندنی و `PATCH /recipes/:id` متادیتایی است. | نبودِ مسیرِ اختصاصیِ ویرایشِ ماده. | `POST /recipes/:id/ingredients/:ingredientId/remove` (یا state-toggle) با احرازِ مالکیت یا نوشتن در overrideِ نشست. | `apps/server/src/recipes/recipes.controller.ts:70-86` |
| H9 | حذفِ ماده cascadeِ متنِ مرحله ندارد؛ «قارچ اضافه کن» همچنان نمایش داده می‌شود (نقضِ §۳). | steps خام render می‌شوند؛ بدونِ rephrase/remove. | `cascadeRemoval()`: parseِ ارجاع به مادهٔ حذف‌شده → rephrase؛ برای مراحلِ بحرانی → remove/insert. | `apps/web/src/app/recipe/[id]/page.jsx:469-479` · `recipe-richness.service.ts` |
| H10 | هشدارِ حذفِ مادهٔ بحرانی نیست (تخم‌مرغ در کیک ≠ قارچِ تزئینی)؛ `functionalRoles` در اسکیما نیست. | فقط `cookingBehavior Json`؛ بدونِ نقش؛ بدونِ چکِ بحرانی‌بودن. | افزودنِ `functionalRoles Json`؛ هشدار/جایگزینیِ اجباری هنگامِ حذفِ نقشِ بحرانی (§۲). | `apps/server/prisma/schema.prisma:198-233` |
| H11 | تغذیه پس از حذفِ ماده بازمحاسبه نمی‌شود؛ کالری/ماکروها بیات و گمراه‌کننده. | nutrition از queryِ والد، بدونِ بازمحاسبهٔ زنده. | `POST /recipes/:id/nutrition/recompute` (یا override در `/full`)؛ `Σ(وزن×per100g/100)`؛ برچسبِ «دوباره‌محاسبه‌شده». | `apps/web/src/app/recipe/[id]/page.jsx:446-462` · `useRecipeDetail.js` |
| H12 | پیشنهادهای swap بدونِ متادیتا (score/flavorImpact/confidence)؛ کاربر نمی‌داند «بهترین» کدام است. | UI فقط `name` را برمی‌دارد و groundingِ API را دور می‌ریزد. | حفظ/پاس‌دادنِ آبجکتِ کاملِ substitution؛ کارت با کیفیت/اعتماد/تأثیر و رتبه (۱/۵). | `apps/web/src/components/ges/AISheet.jsx:54,155-159` · `suggest-substitutions.tool.ts` |
| H13 | عدم‌قطعیتِ swap-vs-cook: اگر کاربر swap را Apply نکند و واردِ cook شود، دستورِ اصلی نمایش داده می‌شود. | swap فقط local؛ بدونِ دکمهٔ Apply؛ ناوبریِ cook با idِ خام. | دکمهٔ «اعمالِ این جایگزین» (تا انتخاب نشده disabled)؛ اتصال به `onApplySwap`؛ persist در sessionStorage برای cook. | `apps/web/src/components/ges/AISheet.jsx:131-173` · `page.jsx:516` |
| H14 | موادِ GRIS با سروینگ مقیاس نمی‌خورند (تکرارِ ریشهٔ C2 در گپ‌های اضافی). | `weightG`/`volume` مستقیم؛ بدونِ propهای سروینگ. | پاس‌دادنِ سروینگ + `scaleFactor` + memoize (هم‌ریشه با C2). | `apps/web/src/components/ges/GrisRecipe.jsx:128` · `page.jsx:377` |
| P1 | عدم‌memoization: AISheet با هر تغییرِ stateِ نامرتبطِ والد re-render می‌شود. | بدونِ `React.memo`؛ `onApplyServings` inline؛ `ingNames` بدونِ useMemo؛ والدِ یکپارچه. | `React.memo` روی AISheet؛ `useCallback` برای callbackها؛ `useMemo` برای `ingNames`؛ جداسازیِ/wrapِ AISheet. | `apps/web/src/components/ges/AISheet.jsx:32,37-38` · `page.jsx:526-527,214-533` |

---

## متوسط (Medium — صیقل و اعتماد)

| # | چه چیزی | ریشه | رفع | فایل‌ها |
|---|---------|------|-----|---------|
| M1 | toastِ «مقدارها رو متناسب کن» اقرار به نبودِ scaling است؛ پس از رفعِ C1/C2 نادرست می‌شود. | پیامِ hardcode به‌عنوانِ workaround. | پیامِ «برای N نفر تنظیم شد — مقدارها تنظیم شدند» + indicatorِ بصری؛ شرطی بر اساسِ وجودِ scaling. | `apps/web/src/app/recipe/[id]/page.jsx:527` |
| M2 | dependentDeltaهای حذف (§۲) پشتیبانی نمی‌شوند (حذفِ قارچ → کاهشِ مایع). | فقط swap در tool؛ بدونِ `RemovalEdge`. | `RemovalEdge{ingredientId,dependentDeltas,stepImpact}` در `Ingredient.removalOptions`؛ اعمال در cascade. | `apps/server/src/ai/tools/suggest-substitutions.tool.ts` · schema |
| M3 | AISheet حالتِ remove ندارد (فقط servings/swap/time). | `OPTIONS` فقط سه‌تایی. | افزودنِ `{key:'remove',label:'حذف ماده‌ای',Icon:IconTrash}` + selector + تأیید + undo. | `apps/web/src/components/ges/AISheet.jsx:17-21` |
| M4 | کوک‌مود موادِ حذف‌شده را لحاظ نمی‌کند؛ متنِ مرحله ممکن است هنوز به آن‌ها ارجاع دهد. | steps از `useRecipeDetail` بدونِ removal-awareness. | پارامترِ دومِ `removedIngredients` به useCook؛ فیلتر/rephrase؛ یا step-overrideِ user-scoped. | `apps/web/src/app/cook/[id]/useCook.js:45` · `page.jsx:183` |
| M5 | سیستمِ dislike/like معنایِ remove/skip ندارد. | `TasteStance` فقط like/dislike/neutral؛ dislike نرم است. | افزودنِ stanceِ `skip`/`remove` (جدا از dislike) با remove-suggestionِ سطحِ دستور + opt-in در cook. | `apps/server/src/behavior-engine/signals/taste-correction.service.ts:18-28` |
| M6 | پس از حذف، هیچ validationی که دستور معتبر بماند نیست (§۰ I1–I3/I5). | endpointِ حذف `analyzeRecipeIntegrity`/safety را صدا نمی‌زند. | `validateRecipeAfterRemoval()`: چکِ نقشِ بحرانی + re-gateِ آلرژن + بازگشتِ `{ok,warning,suggestedRemediations}`. | endpointِ حذف (جدید) |
| M7 | خطاهای APIِ swap/sub خاموش‌اند؛ «یافت نشد» با «خطای موقت» یکسان دیده می‌شود. | catch فقط `items:[]` می‌گذارد؛ بدونِ flagِ error. | `error:boolean` در state؛ پیامِ متفاوت + دکمهٔ «دوباره امتحان کن». | `apps/web/src/components/ges/AISheet.jsx:48-60` · `page.jsx:272-284` |
| M8 | مقادیرِ غیرعددی («به‌مزه»/«به‌اندازه») مقیاس‌پذیر نیستند و indicator ندارند. | `amountText` خام render می‌شود. | برچسبِ «(ثابت)»/قفل؛ استایلِ متفاوت برای مواردِ غیرمقیاس‌پذیر هنگامِ تغییرِ سروینگ. | `apps/web/src/app/recipe/[id]/page.jsx:389` |
| M9 | WhyChip فقط برای fitِ غیرآلرژن است؛ کاربرِ آلرژن نمی‌تواند دلیل را ببیند. | شرطِ `!isAllergen`. | render کردنِ WhyChip برای آلرژن هم + لینک به مدیریتِ آلرژن در پروفایل. | `apps/web/src/app/recipe/[id]/page.jsx:337-346` |
| M10 | بدونِ loading/disabled روی chipِ ماده؛ کلیک‌های سریع → race condition. | بدونِ `disabled`/AbortController. | `disabled={swap.loading}`؛ spinner؛ AbortController برای لغوِ درخواستِ قبلی. | `apps/web/src/components/ges/AISheet.jsx:139,48-60` |
| M11 | تأثیرِ طعم/بافتِ swap هرگز نمایش داده نمی‌شود. | `flavorImpact`/`quantityAdjust` در mapِ hook دور ریخته می‌شود. | حفظ/نمایشِ `flavorImpact` به‌صورتِ متنِ ثانویه/tooltip زیرِ گزینه‌ها. | `apps/web/src/app/recipe/[id]/useRecipeDetail.js:87-92` · `page.jsx:411-420` |
| M12 | برچسبِ reasonها (cost/availability...) data-driven/i18n نیست؛ reasonِ جدید کدنویسی می‌خواهد (نقضِ I7). | نام‌گذاریِ hardcode per-enum. | `ReasonRegistry` (lookupِ tag→برچسبِ فارسی) به‌جای hardcode؛ آینده‌نگرِ reasonهای جدید. | `apps/web/src/app/home/lib/reasons.js` · `useRecipeDetail.js:105` |

---

## کم (Low)

| # | چه چیزی | رفع | فایل‌ها |
|---|---------|-----|---------|
| L1 | parseِ `servingsText` شکننده/بدونِ تست/fallbackِ خاموش به ۴. | استخراجِ `extractBaseServings(text):number` به `components/ges/format.js` + تستِ فارسی/لاتین/ترکیبی + warning. | `apps/web/src/app/recipe/[id]/page.jsx:293-296` |
| L2 | Drawer حتی با `opened=false` هزینهٔ layout/blur/focus دارد؛ همیشه mount است. | render شرطی + انتقالِ `overlayProps`/`transitionProps`/styles به `useMemo`. | `apps/web/src/components/ges/AISheet.jsx:62-191` |
| L3 | حذفِ مرحله/مدت بدونِ scaleِ زمان با سروینگ. | اعمالِ `scaleFactor` روی `durationMin`ِ GRIS؛ یادداشتِ محدودیت برای stringِ flat. | `apps/web/src/app/cook/[id]/page.jsx`,`useCook.js` |
| L4 | help-drawerِ cook دکمهٔ retry ندارد. | دکمهٔ «دوباره امتحان کن» وقتی `help.error`. | `apps/web/src/app/cook/[id]/useCook.js:71-75` · `page.jsx:230` |
| L5 | accessibility: دکمهٔ «جایگزین؟» پیوندِ معناییِ روشن به نامِ ماده ندارد + سند/ADRِ remove نیست. | `aria-describedby`/ساختارِ روشن‌تر؛ نگارشِ RFC «Remove/Optional Ingredient». | `page.jsx:388` · `PERSONALIZATION_ENGINE_SPEC.md §۵` |

---

## ترتیب پیشنهادیِ ساخت

**نکتهٔ کلیدی:** سه قابلیتِ بحرانی (scaling · swap-apply · remove) و انتقالِ آن‌ها به cook، همگی به یک **«لایهٔ واحدِ حالتِ شخصی‌سازیِ نشست»** متکی‌اند. این لایه را یک‌بار بساز، بعد همهٔ آن‌ها روی آن سوار می‌شوند.

1. **فاز ۰ — زیرساختِ مشترک (هم‌ریشهٔ همه‌چیز):**
   - ابزارهای خالص: `parseAmountText` (H1) + `extractBaseServings` (L1) + `scaleIngredient` (C1) — با تست. اول‌اند چون deterministic و بدونِ وابستگی‌اند.
   - **لایهٔ حالتِ شخصی‌سازی**: `CookSessionContext`/sessionStorage که `servedFor` + `appliedSwaps` + `removedIngredients` را نگه دارد و هم صفحهٔ دستور و هم cook از آن بخوانند (H2 + پایهٔ C4/C8). این تنها قطعهٔ معماری است که قفلِ هر سه قابلیت را باز می‌کند.

2. **فاز ۱ — مقیاس‌بندیِ سروینگ (سریع‌ترین بُرد):** C1 + C2 + H14، سپس M1/M8 (پیام/indicator). فقط front-end، بدونِ APIِ جدید، بلافاصله ارزشِ دیدنی.

3. **فاز ۲ — اعمالِ swap (لایهٔ UI):** C3 + C4 + C5 + C7 (انتخاب/state/callback)، سپس H6/H12/H13 و M7/M10/M11 (بازخورد/متادیتا/خطا/race). هنوز بدونِ cascadeِ سرور — swap فقط نام را عوض می‌کند.

4. **فاز ۳ — حذفِ ماده (UI + داده):** C8 + M3 (UI/AISheet remove)، H7 (اسکیمای additive)، H8 (endpoint)، H10/M6 (نقشِ بحرانی + validation). با swap هم‌خانواده است چون هر دو روی همان لایهٔ حالت و همان مدلِ override می‌نشینند.

5. **فاز ۴ — Cascadeِ سرور (سنگین، مشترکِ swap+remove):** H4 + C6 + H5 + H9 + H11 + M2. منطقِ retime/rephrase/quantityAdjust/nutrition یک‌جا در `recipe-richness.service.ts` — هم swap و هم remove از همان `cascade*()` استفاده می‌کنند.

6. **فاز ۵ — یکپارچگیِ GRIS در cook:** C9 + C10 + H3 + M4 + L3. cook را GRIS-aware کن و حالتِ شخصی‌سازیِ فاز ۰ را مصرف کن.

7. **فاز ۶ — صیقل و آینده‌نگری:** P1/L2 (performance)، M5 (stanceِ skip)، M9/M12 (WhyChip/ReasonRegistry/I7)، L4/L5 (retry/a11y/RFC).

---

## خلاصهٔ فارسی (~۱۴۰ کلمه)

این ممیزی ۳۹ نقص را برمی‌شمارد: **۱۰ بحرانی، ۱۲ مهم، ۱۲ متوسط، ۵ کم**. سه قابلیتِ هستهٔ شخصی‌سازی روی صفحهٔ دستور معماری‌شان ناقص است و هیچ‌یک واقعاً کار نمی‌کند: مقیاس‌بندیِ سروینگ (مقدارها هرگز بازمحاسبه نمی‌شوند)، اعمالِ جایگزینی (پیشنهادها فقط‌نمایشی‌اند و state/cascade ندارند) و حذفِ کاملِ ماده (به‌کلی غایب). سه رفعِ مهم‌تر: (۱) ساختِ یک لایهٔ واحدِ «حالتِ شخصی‌سازیِ نشست» که هر سه قابلیت و کوک‌مود از آن بخوانند؛ (۲) مقیاس‌بندیِ سروینگ برای موادِ flat و GRIS؛ (۳) لایهٔ cascadeِ سرور (retime/rephrase/quantityAdjust/nutrition) که هم swap و هم remove از آن استفاده کنند. ترتیبِ پیشنهادیِ ساخت: فاز۰ زیرساخت و لایهٔ حالتِ مشترک → فاز۱ مقیاس‌بندی → فاز۲ اعمالِ swap → فاز۳ حذف → فاز۴ cascadeِ سرور → فاز۵ یکپارچگیِ GRIS در cook → فاز۶ صیقل و عملکرد. کلید این است که فاز۰ قفلِ هر سه را هم‌زمان باز می‌کند.
