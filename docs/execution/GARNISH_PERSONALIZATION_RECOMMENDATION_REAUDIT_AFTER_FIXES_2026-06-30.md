# گزارش بازبینی دوم سیستم پیشنهاد، شخصی‌سازی، پایش و یادگیری Garnish

تاریخ: 2026-06-30  
دامنه: `apps/server/src`، مسیرهای مرتبط در `apps/web/src`، اسکیماهای Prisma، ادمین/observability مرتبط با recsys  
نوع کار: فقط ممیزی و گزارش؛ هیچ فایل اجرایی اپ تغییر داده نشده است.

## 1. Reality Check

[قطعی] ادعای «کل سند انجام شد» درست نیست. بخشی از کارها واقعاً انجام شده، اما چند ایراد حیاتی هنوز باقی است و بعضی اصلاح‌ها فقط ظاهر مسئله را حل کرده‌اند. مهم‌ترین نمونه: `favorite_remove` به‌جای کم‌کردن علاقه، در مسیر live signal می‌تواند علاقه را بیشتر کند، و تست جدید هم همین رفتار غلط را به‌عنوان انتظار درست تثبیت کرده است.

[قطعی] سیستم از حالت قبلی بهتر شده: routeهای جدید، outbox، signal processorها، consent ledger، AI context hydration، slate logging و recsys-health backend اضافه شده‌اند. اما هنوز در سطح «بین‌المللی، launch-grade و بدون سیم‌کشی قطع» نیست.

[احتمالاً] اگر این نسخه با همین وضعیت لانچ شود، پیشنهادها در ظاهر کار می‌کنند، ولی یادگیری رفتاری ناپایدار، privacy gate نیمه‌فعال، attribution ناقص و داشبورد کنترل ناکامل باعث می‌شود نتوانید با اطمینان بگویید «مرکز فرماندهی دقیق» دارید.

## 2. درجه اطمینان

- [قطعی] یافته‌های مربوط به مسیرهای کد، routeها، eventها و نبود مصرف‌کننده‌ها مستقیماً از سورس استخراج شده‌اند.
- [احتمالاً] ارزیابی اثر محصولی/ریسک بین‌المللی بر اساس استانداردهای رایج privacy، recommender systems، observability و UX dashboard است.
- [نامطمئن] تست‌ها کامل اجرا نشدند: دو فرمان targeted test با `CI=true` بعد از 184 ثانیه timeout شدند. بنابراین سبز بودن تست‌ها را تأیید نمی‌کنم.

## 3. خلاصه مدیریتی

وضعیت بعد از اصلاحات:

| حوزه | وضعیت | جمع‌بندی بی‌تعارف |
|---|---:|---|
| Safety gate در recipe paths | نیمه‌کامل | `GET /recipes/:id` و `GET /recipes/:id/full` بهتر شده‌اند، اما `POST /recipes/:id/personalize` هنوز gate ندارد. |
| favorite remove | خراب | backend processor نوشته شده، ولی factor غلط است و frontend اصلاً event حذف favorite را نمی‌فرستد. |
| consent/privacy | نیمه‌کامل | consent ledger و settings/onboarding وجود دارد، اما production default هنوز `log` است، نه `enforce`. |
| event routing/outbox | بهتر ولی ناقص | outbox اضافه شده، اما idempotency واقعی نیست و partial processing می‌تواند سیگنال را گم یا تکراری کند. |
| personalization actions | نیمه‌کامل | swap/remove/scale به backend می‌رسند، اما resolver ضعیف و correction event ندارد. |
| recommendation attribution | ناقص | click/save/cook تا حدی وصل‌اند، اما dismiss، recipe-page save و بعضی مسیرهای plan/whisper requestId ندارند. |
| learning / L1 prior | scaffold شده، نه live | prior learner و service اضافه شده‌اند، ولی default-off هستند و weight هم صفر است. |
| admin/observability | backend دارد، UI ندارد | `/admin/observability/recsys-health` ساخته شده اما در admin frontend مصرف نمی‌شود. |
| AI context | بهتر ولی محدود | فقط با personalization consent سیگنال می‌خواند؛ explain recommendation هنوز generic است. |
| تست‌ها | قابل اتکا نیست | بعضی تست‌ها رفتار غلط را validate می‌کنند؛ اجرای targeted test هم timeout شد. |

## 4. مواردی که واقعاً انجام شده‌اند

### 4.1 مسیرهای مستقیم recipe تا حدی ایمن شده‌اند

[قطعی] در `apps/server/src/recipes/recipes.controller.ts`:

- `findAll` limit را clamp می‌کند و خروجی را از `RecipeSafetyFilterService.filter` عبور می‌دهد.
- `GET /recipes/:id` برای کاربر لاگین‌شده با `safeIds` hard-block می‌کند.
- `GET /recipes/:id/full` قبل از برگرداندن full recipe با `safeIds` hard-block می‌کند.

ارزش: مسیرهای Home، Discover، recipe detail basic/full و cook mode امن‌تر شده‌اند.

نقص باقی‌مانده: `POST /recipes/:id/personalize` در همان کنترلر هنوز بدون `safeIds` به `richness.personalize` می‌رود.

### 4.2 event taxonomy و processor registry گسترده‌تر شده‌اند

[قطعی] در `apps/server/src/behavior-engine/routing/processor.registry.ts` routeهای زیر اضافه/وصل شده‌اند:

- `favorite_remove`
- `cook_complete`
- `recipe_cooked`
- `shopping_add_manual`
- `shopping_add_from_plan`
- `shopping_add_from_fav`
- `portion_scaled`
- `ingredient_swapped`
- `ingredient_removed`

ارزش: سیستم از حالت «فرانت event می‌فرستد ولی backend نمی‌شنود» تا حدی خارج شده است.

نقص باقی‌مانده: `start_cooking_click` هنوز route ندارد، با اینکه frontend آن را می‌فرستد و `getDataMaturity` هم آن را می‌شمارد.

### 4.3 signal processor برای personalization اضافه شده

[قطعی] `apps/server/src/behavior-engine/processors/personalization.signal-processor.ts` اضافه شده و:

- `portion_scaled` را به `routine.serving_size` تبدیل می‌کند.
- `ingredient_removed` را در صورت resolve شدن ingredient به aversion تبدیل می‌کند.
- `ingredient_swapped` را به aversion برای `from` و affinity برای `to` تبدیل می‌کند.

نقص باقی‌مانده: resolver فقط exact match روی `nameFa/nameEn` دارد و event برگشتی برای undo/restore ندارد.

### 4.4 outbox و fast-path routing اضافه شده‌اند

[قطعی] `AnalyticsService.trackEvent` بعد از ذخیره `UserEvent`، یک `EventOutbox` می‌سازد و `processNow` را fire-and-forget اجرا می‌کند. اسکیما هم `EventOutbox.eventId @unique` دارد.

ارزش: crash بین write event و route event تا حدی قابل بازیابی شده است.

نقص باقی‌مانده: idempotency واقعی هنوز transactional/complete نیست. توضیح دقیق در بخش P0.

### 4.5 L1 prior scaffold شده است

[قطعی] `RecipePriorService`، `RecipePriorLearnerService`، `RecommendationServedItem` و `RecipePrior` اضافه شده‌اند. `RecommendationPipelineService` به هر پاسخ `requestId` می‌دهد و slate logging دارد.

نقص باقی‌مانده: این فعلاً live learning فعال نیست:

- `L1_RECIPE_PRIOR_ENABLED` باید `true` شود.
- `L1_RECIPE_PRIOR_LEARN_ENABLED` باید `true` شود.
- وزن `recipePrior` در ranker صفر است.
- `L1_WEIGHT_SOURCE` provider در module ثبت نشده است.

### 4.6 AI behavioral context بهتر شده

[قطعی] `BehavioralContextSnapshotService` بدون personalization consent اصلاً `userBehaviorSignal` را query نمی‌کند و با consent فقط signalهای non-sensitive را coarse bucket می‌کند.

ارزش: این privacy-safeتر از خواندن خام همه سیگنال‌هاست.

نقص باقی‌مانده: در نبود consent، AI عملاً cold-start می‌ماند؛ explain recommendation هنوز فقط generic reason می‌دهد.

### 4.7 backend recsys health ساخته شده

[قطعی] `GET /admin/observability/recsys-health` اضافه شده و outbox، signals، consent، priors و registry coverage را برمی‌گرداند.

نقص باقی‌مانده: در `apps/web/src/app/admin` هیچ مصرف‌کننده‌ای برای `recsys-health` پیدا نشد. پس این هنوز «برج مراقبت UI» نیست.

## 5. P0 - ایرادهای حیاتی که هنوز باید اصلاح شوند

### P0-1. `favorite_remove` هنوز غلط است و می‌تواند علاقه را افزایش دهد

شواهد:

- `apps/server/src/behavior-engine/processors/recipe.signal-processor.ts:25-29`
- `apps/server/src/behavior-engine/signals/signal-calculator.service.ts:81-105`
- `apps/server/src/behavior-engine/processors/recipe.signal-processor.spec.ts` تست می‌کند `applyNegativeFeedback('u1','r1',0.3)` صدا زده شود.

مشکل:

`applyNegativeFeedback` مقدار `factor` را به value اضافه می‌کند:

```ts
newValue = Math.max(0, existing.value + factor)
```

پس برای کم‌کردن علاقه باید `-0.3` ارسال شود، نه `0.3`. کد فعلی:

```ts
await this.signalCalculator.applyNegativeFeedback(userId, recipeId, 0.3);
```

اثر:

- `SignalObservation` منفی ثبت می‌شود، اما `UserBehaviorSignal` live می‌تواند مثبت‌تر شود.
- ranker که از `UserBehaviorSignal` و feature vector تغذیه می‌شود، ممکن است بعد از unfavorite هنوز همان سبک/ingredient را بیشتر دوست داشته باشد.
- تست جدید اشتباه است چون به‌جای semantic assertion، فراخوانی غلط را assert کرده است.

راه‌حل پیشنهادی:

1. API `applyNegativeFeedback` را از `factor` مبهم به `magnitude` مثبت + direction داخلی تبدیل کنید، یا همه callerها را enforce کنید که مقدار منفی می‌دهند.
2. `favorite_remove` باید `applyNegativeFeedback(userId, recipeId, -0.3)` یا API جدید `applyNegativeFeedback(userId, recipeId, { magnitude: 0.3 })` داشته باشد.
3. تست باید اثر واقعی را assert کند: اگر signal قبلی `0.7` است، بعد از favorite_remove باید کمتر شود، نه صرفاً اینکه متد صدا شده.

معیار پذیرش:

- favorite add سپس favorite remove روی یک recipe، value سیگنال‌های مربوط به ingredient/dish را کاهش دهد.
- هیچ تستی نباید `0.3` مثبت را برای negative feedback قبول کند.

### P0-2. frontend اصلاً `favorite_remove` را emit نمی‌کند

شواهد:

- Home: `apps/web/src/app/home/page.jsx:232-242`
- Recipe detail: `apps/web/src/app/recipe/[id]/page.jsx:361-366`

مشکل:

در add، `favorite_add` و گاهی `recommendation_save` ارسال می‌شود. در remove فقط toast نمایش داده می‌شود. یعنی حتی اگر backend درست شود، اکثر حذف‌های واقعی favorite وارد یادگیری نمی‌شوند.

اثر:

- کاربر چیزی را از ذخیره‌ها حذف می‌کند، اما سیستم هنوز آن را preference مثبت می‌بیند.
- `getDataMaturity` حذف favorite را می‌شمارد، اما producer واقعی در این مسیرها وجود ندارد.
- attribution برای recommendation save/remove کامل نمی‌شود.

راه‌حل پیشنهادی:

1. در Home و Recipe Detail بعد از `removeFavorite` موفق، `trackEvent('favorite_remove', { recipeId })` ارسال شود.
2. اگر recipe از recommendation آمده، یک event جداگانه برای attribution منفی/اصلاح reward در نظر بگیرید، مثل `recommendation_unsave` یا `recommendation_remove_save`؛ اگر نمی‌خواهید event جدید بسازید، حداقل `favorite_remove` را با `requestId` emit کنید.
3. تست frontend برای add/remove متقارن اضافه شود.

معیار پذیرش:

- حذف favorite در Home، Recipe Detail، Favorites screen و هر جای دیگر دقیقاً یک `favorite_remove` معتبر تولید کند.

### P0-3. consent gate در production هنوز enforce نیست

شواهد:

- `apps/server/src/analytics/analytics.service.ts:109-135`
- default: `NODE_ENV === 'production' ? 'log' : 'off'`

مشکل:

در production اگر `EVENT_CONSENT_GATE_MODE` تنظیم نشود، سیستم فقط log می‌کند که «would skip»، اما event را همچنان به personalization routing می‌فرستد.

اثر:

- از نگاه GDPR/بین‌المللی، این opt-in واقعی نیست.
- `eventData.consentPurpose` برای کاربر بدون consent برابر `analytics` می‌شود، ولی همان event وارد signal engine و personalization می‌شود.
- backend AI context consent-gated است، اما behavior engine نه؛ این دو سیاست privacy با هم ناسازگارند.

راه‌حل پیشنهادی:

1. برای production default را `enforce` کنید.
2. اگر نگران cold-start هستید، onboarding/settings grant consent واقعی دارد؛ پس مشکل باید در activation UX حل شود، نه با bypass privacy.
3. signalهای analytics-only را از personalization-only جدا کنید؛ همه eventها نباید یک gate یکسان داشته باشند.
4. در admin/recsys-health metric بسازید: `personalization_routed_without_consent_count`.

معیار پذیرش:

- در production و بدون personalization consent، `UserEvent` ذخیره شود ولی هیچ `SignalObservation` یا `UserBehaviorSignal` personalization ساخته نشود.

### P0-4. idempotency guard ناقص است و partial processing را خراب می‌کند

شواهد:

- `apps/server/src/behavior-engine/processors/safe-payload.ts:24-27`
- `SignalObservation` در Prisma unique روی `eventId` ندارد.
- `RecommendationAttributionEvent` هم `eventId` ندارد و unique ندارد.
- `RecommendationSignalProcessor` اول attribution می‌نویسد، بعد observation.

مشکل:

`alreadyConsumed` فقط می‌پرسد آیا برای این `eventId` یک `SignalObservation` وجود دارد یا نه. این برای exactly-once کافی نیست.

سناریوهای شکست:

1. یک processor چند observation می‌سازد؛ وسط کار fail می‌کند؛ retry چون یک observation وجود دارد کل event را skip می‌کند. بخشی از سیگنال‌ها برای همیشه گم می‌شوند.
2. `RecommendationSignalProcessor` اول `RecommendationAttributionEvent` می‌سازد؛ اگر قبل از ساخت observation crash کند، retry دوباره attribution می‌سازد. reward duplicate می‌شود.
3. batch impression با چند `recipeId`: اگر recipe اول نوشته شود و recipe دوم fail کند، retry کل batch را skip می‌کند.

راه‌حل پیشنهادی:

1. برای هر side effect یک idempotency key واقعی اضافه کنید:
   - `SignalObservation`: unique روی `(eventId, signalName, recipeId, value/source)` با null-safe strategy.
   - `RecommendationAttributionEvent`: اضافه‌کردن `eventId` و unique روی `(eventId, recipeId, eventType)`.
2. هر processor باید transaction داشته باشد یا step-level upsert.
3. `alreadyConsumed(eventId)` کلی را حذف یا فقط برای single-effect processorها استفاده کنید.
4. تست crash/partial بنویسید: یک create موفق، create بعدی fail، retry باید فقط missing side effect را بسازد.

معیار پذیرش:

- redelivery event هیچ duplicate reward نسازد و هیچ missing side effect را به خاطر observation اول skip نکند.

### P0-5. `POST /recipes/:id/personalize` safety gate ندارد

شواهد:

- `apps/server/src/recipes/recipes.controller.ts:120-125`

مشکل:

`GET /:id/full` gate دارد، اما personalization cascade مستقیماً `richness.personalize(id, userId, body)` را صدا می‌زند.

اثر:

- اگر کاربر به هر روش endpoint را صدا بزند، personalized nutrition/swap/cascade برای recipe ناسازگار با allergy/observance ممکن است پردازش شود.
- invariant «همه مسیرهای user-facing recipe ایمن هستند» کامل نیست.

راه‌حل پیشنهادی:

قبل از `richness.personalize` همان check زیر اضافه شود:

```ts
if (!(await this.safety.safeIds(req.user.userId, [id])).length) {
  throw new ForbiddenException('recipe_unsafe_for_profile');
}
```

معیار پذیرش:

- recipe unsafe در `GET /full` و `POST /personalize` هر دو 403 بدهد.

### P0-6. `start_cooking_click` emit و count می‌شود، اما route نمی‌شود

شواهد:

- frontend emit: `apps/web/src/app/cook/[id]/useCook.js:66-74`
- taxonomy دارد: `apps/server/src/analytics/event-taxonomy.ts`
- `getDataMaturity` آن را qualified حساب می‌کند: `apps/server/src/behavior-engine/feature-store/feature-store.service.ts`
- registry route ندارد: `apps/server/src/behavior-engine/routing/processor.registry.ts`

مشکل:

سیستم data maturity را با یک event بالا می‌برد که در behavior engine هیچ اثری ندارد.

اثر:

- maturity score خوش‌بینانه و گمراه‌کننده می‌شود.
- cooking intent که قبل از cook_complete signal مهمی است، وارد feature/ranking نمی‌شود.
- admin/AI ممکن است فکر کنند user data richer است، در حالی که processor چیزی یاد نگرفته.

راه‌حل پیشنهادی:

1. `start_cooking_click` را به processor مناسب route کنید.
2. وزن آن باید کمتر از `cook_complete` باشد، مثلاً observation `started_cooking_recipe` با weight حدود `0.7`.
3. اگر recipe بعداً `cook_complete` شد، intent نباید duplicate بیش‌ازحد بسازد؛ با event-level distinct یا confidence decay کنترل شود.

معیار پذیرش:

- شروع cook session یک observation و feature قابل مشاهده بسازد.
- maturity فقط eventهایی را count کند که واقعاً routed یا explicitly analytics-only هستند.

## 6. P1 - ایرادهای مهم قبل از لانچ جدی

### P1-1. `recommendation_dismiss` بدون `requestId` است

شواهد:

- `apps/web/src/hooks/useDismissRecommendation.js:21`
- Home استفاده: `apps/web/src/app/home/page.jsx:294`
- Plan swap: `apps/web/src/app/plan/page.jsx:219`

مشکل:

Dismiss فقط `{ recipeId }` دارد. پس learner نمی‌تواند dismissal را به served slate دقیق join کند.

راه‌حل:

- `dismiss(recipeId, requestId)` بسازید.
- Home باید `dismiss(p.recipeId, p.requestId)` صدا بزند.
- Plan swap اگر recommendation source/requestId ندارد، یا source جدا داشته باشد یا وارد off-policy reward نشود.

### P1-2. Recipe Detail save، `recommendation_save` نمی‌فرستد

شواهد:

- `apps/web/src/app/recipe/[id]/page.jsx:361-366`
- `recommendationAttribution.js` برای recall ساخته شده اما این صفحه از آن استفاده نمی‌کند.

مشکل:

اگر کاربر از recommendation وارد detail شود و آنجا save کند، فقط `favorite_add` ثبت می‌شود، نه reward قابل join با slate.

راه‌حل:

- در Recipe Detail بعد از `favorite_add`، `recallRecommendation(id)` را بخوانید و اگر وجود داشت `recommendation_save` با `requestId` emit کنید.

### P1-3. L1 prior live نیست؛ فقط scaffold است

شواهد:

- `apps/server/src/recommendation/recommendation.module.ts:52-59`
- `apps/server/src/recommendation/pipeline/recipe-prior.service.ts:23-32`
- `apps/server/src/recommendation/pipeline/recipe-prior-learner.service.ts:30-36`
- `RankingService.defaultWeights.recipePrior = 0`

مشکل:

کد L1 اضافه شده اما default-off است. این به‌خودی‌خود بد نیست؛ بدی وقتی است که به‌عنوان «یادگیری live انجام شد» گزارش شود.

راه‌حل:

- در گزارش داخلی و admin واضح بنویسید: `prior_status: scaffolded | collecting | learning | active`.
- activation باید پشت offline replay، kill switch، threshold و founder approval باشد.

### P1-4. slate logging fire-and-forget است و sessionId ندارد

شواهد:

- `apps/server/src/recommendation/pipeline/recommendation-pipeline.service.ts:60-63`
- `RecommendationServedItem.sessionId` در schema هست اما pipeline پاس نمی‌دهد.

مشکل:

اگر process بعد از response و قبل از write بمیرد، served slate از دست می‌رود. برای off-policy learning این داده قابل بازسازی نیست.

راه‌حل:

- برای launch یا await با timeout کوتاه بگذارید، یا `RecommendationServedItem` را در outbox/durable job ببرید.
- `sessionId` را از request/user session وارد pipeline کنید.

### P1-5. `recommendation_impression` endpoint array cap ندارد

شواهد:

- `apps/server/src/recommendation/recommendation.controller.ts:48-96`

مشکل:

`recipeIds` dedupe می‌شود، اما سقف تعداد ندارد. کلاینت بد یا خراب می‌تواند آرایه بزرگ بفرستد و write/event storm بسازد.

راه‌حل:

- cap مثل 50 یا 100 بگذارید.
- rejected reason برای `too_many_recipe_ids`.

### P1-6. search limit clamp نشده

شواهد:

- `apps/server/src/recipes/recipes.controller.ts:52-59`

مشکل:

`parseInt(query.limit) || 10` مقدار منفی/خیلی بزرگ را محدود نمی‌کند.

راه‌حل:

- مثل `findAll`: `Math.min(50, Math.max(1, parseInt(...)))`.

### P1-7. derived behavior signals بخش بزرگی از رفتار واقعی را نادیده می‌گیرد

شواهد:

- `buildDerivedBehaviorSignals` فقط این‌ها را می‌خواند: `recipe_view`, `favorite_add`, `recommendation_click`, `recommendation_save`, `recommendation_cook`, `mealplan_add`.

مشکل:

Eventهای مهم مثل `favorite_remove`, `recommendation_dismiss`, `recommendation_ignore`, `cook_complete`, `ingredient_removed`, `ingredient_swapped`, `shopping_*` در derived featureها نیستند.

اثر:

- feature vector تصویر ناقصی از کاربر دارد.
- negative feedback و personalization edits در ranking downstream کمتر اثر می‌گذارند.

راه‌حل:

- derived behavior را با taxonomy registry همسو کنید.
- negative features جدا بسازید: avoidance، friction، undo، fatigue.

### P1-8. shopping behavior هنوز کامل وارد موتور نمی‌شود

شواهد:

- frontend فقط `shopping_add_manual` و `shopping_add_from_plan` را emit می‌کند.
- `toggle`, `remove`, `clearChecked`, `clearAll` در `apps/web/src/app/shopping-list/useShopping.js` event نمی‌فرستند.
- backend shopping controller/service هم analytics injection ندارد.

مشکل:

Processor برای `shopping_item_remove` و `shopping_item_toggle` هست، اما producer واقعی در CRUD paths نیست.

راه‌حل:

- یا frontend همه shopping mutations را track کند.
- یا بهتر: backend service بعد از mutation، analytics event owner-scoped بسازد تا همه clientها و AI tools هم پوشش داده شوند.

### P1-9. shopping signals معنایی و noisy هستند

شواهد:

- `shopping_add_manual` و `shopping_item_add` باعث `budget_sensitive` می‌شوند.

مشکل:

اضافه‌کردن دستی خرید لزوماً budget-sensitive نیست. ممکن است فقط grocery organization باشد.

راه‌حل:

- signal را به `grocery.list_builder` یا `routine.shopping_planner` تغییر دهید.
- budget را فقط از price/cost choices، low-cost recipe preference یا explicit preference استخراج کنید.

### P1-10. personalization resolver ضعیف است

شواهد:

- `PersonalizationSignalProcessor.resolveIngredient` فقط exact match می‌کند.

مشکل:

نام ingredient در UI ممکن است با مقدار، prep، نیم‌فاصله، زبان، alias یا authored swap فرق داشته باشد. نتیجه: `personalization_unresolved` زیاد و learning کم‌اثر.

راه‌حل:

- از ingredient resolver/alias dictionary موجود استفاده کنید.
- fuzzy + normalized Persian/Arabic folds + ingredientId از UI metadata را ترجیح دهید.

### P1-11. undo/restore personalization یادگیری اشتباه را اصلاح نمی‌کند

شواهد:

- `usePersonalization.toggleRemoved` فقط هنگام remove event می‌فرستد؛ restore event ندارد.
- `clearSwap` event اصلاحی ندارد.
- `reset` event ندارد.

مشکل:

کاربر ممکن است اشتباهی ماده‌ای را حذف کند و برگرداند، اما سیستم همچنان aversion یاد می‌گیرد.

راه‌حل:

- `ingredient_restored`, `ingredient_swap_cleared`, `personalization_reset` اضافه کنید یا payload action را `add/remove` کنید.

### P1-12. AI explain recommendation هنوز evidence-driven نیست

شواهد:

- `apps/server/src/ai/tools/explain-recommendation.tool.ts` فقط وجود `RecommendationExposure` را چک می‌کند و generic reasons می‌دهد.

مشکل:

برای محصول بین‌المللی، explanation باید grounded باشد: کدام signal، کدام feature contribution، کدام safety/freshness دلیل پیشنهاد بوده.

راه‌حل:

- از `scoreBreakdown`, `matchedSignals`, `FeatureContributionLog` یا reason payload خود recommendation استفاده کنید.
- متن باید privacy-safe و بدون health/allergy leakage باشد.

### P1-13. recsys-health UI ندارد

شواهد:

- backend endpoint هست: `apps/server/src/admin/observability.controller.ts:49-53`
- در `apps/web/src/app/admin` مصرف‌کننده `recsys-health` پیدا نشد.

مشکل:

برای «برج مراقبت» API کافی نیست. اپراتور باید در admin UI ببیند:

- outbox backlog/dead letter
- consent routed/blocked
- signal coverage by processor
- stale priors
- attribution join rate
- unsafe recipe block count
- unresolved personalization rate

راه‌حل:

- یک tab یا panel در Admin بسازید: `Recsys Health`.
- رنگ‌بندی threshold داشته باشد، نه فقط عدد خام.

### P1-14. ranking هنوز timezone/international context را کامل رعایت نمی‌کند

شواهد:

- pipeline `this.context?.now(new Date())` می‌گیرد.
- ranker هنوز `isIranWeekday(new Date())` و context بدون user timezone دارد.

مشکل:

برای اپ بین‌المللی، weekend/weekday، meal time و occasion باید user locale/timezone-aware باشد.

راه‌حل:

- timezone/profile/location را به `ContextService` بدهید.
- ranker نباید خودش `new Date()` hardcoded بزند.

### P1-15. hardcoded Persian ingredient/type extraction هنوز زیاد است

شواهد:

- `SignalCalculatorService.extractSignalsFromRecipe`
- shopping UI aisle inference
- recipe processor high-protein tokens

مشکل:

برای بین‌المللی شدن، string includes فارسی/انگلیسی کافی نیست. باید ingredientId/category/taxonomy-first باشد.

راه‌حل:

- signal extraction را روی `Ingredient.category`, `dietFlags`, `tasteProfile`, `nutritionPer100g`, `recipe.searchTerms` و canonical taxonomy ببرید.

### P1-16. Candidate collaborative از health goals استفاده می‌کند

مشکل:

استفاده از health goals برای user similarity حساس است. حتی اگر فقط داخلی باشد، باید purpose-aware و explainability-safe باشد.

راه‌حل:

- یا فقط non-sensitive goals را وارد collaborative کنید.
- یا health-goal similarity را فقط با explicit personalization consent و بدون exposure در explanation استفاده کنید.

## 7. P2 - ایرادهای بهبود و سخت‌کاری حرفه‌ای

### P2-1. `useImpressionObserver` dedupe را فقط با recipeId انجام می‌دهد

اگر یک recipe در دو slate/requestId متفاوت در یک session دیده شود، فقط اولین impression گزارش می‌شود. برای UX ممکن است خوب باشد؛ برای off-policy learning دقیق نیست.

راه‌حل: dedupe key را `(recipeId, requestId, surface)` کنید.

### P2-2. `useImpressionObserver` هنگام ref null cleanup دقیق ندارد

ref callback فقط node جدید را observe می‌کند؛ هنگام unmount node قبلی را از map حذف نمی‌کند. ریسک memory/stale observation کم ولی واقعی است.

### P2-3. metrics با `Math.max(attribution impressions, exposure count)` mismatch را پنهان می‌کند

راه‌حل: علاوه بر metric نهایی، `impression_source_mismatch` و `served_to_viewed_ratio` بسازید.

### P2-4. `RecommendationServedItem` unique ندارد

اگر logging retry/partial یا double response رخ دهد، duplicateها قابل جلوگیری در DB نیستند.

راه‌حل: unique نسبی روی `(requestId, recipeId, position)` یا idempotency key.

### P2-5. `eventData.consentPurpose` فقط personalization/analytics را stamp می‌کند

برای eventهای core مثل auth/cook operational، طبقه‌بندی دقیق‌تر لازم است. الان default analytics ممکن است provenance را مبهم کند.

### P2-6. `enrichmentService.enrichEvent` بدون await/catch مستقیم صدا زده می‌شود

اگر `enrichEvent` promise rejection بدهد، رفتار runtime وابسته به Node/Nest است. بهتر است catch explicit داشته باشد.

### P2-7. `mealplan_remove` دلیل ندارد

حذف از برنامه همیشه dislike نیست؛ ممکن است reschedule یا schedule conflict باشد. reason-coded remove کیفیت یادگیری را بالا می‌برد.

### P2-8. onboarding dish dislike `recommendation_dismiss` بدون requestId است

این برای cold-start خوب است، اما نباید در off-policy reward با recommendation slate قاطی شود. source باید `onboarding` باشد و learner آن را جدا وزن‌دهی کند.

## 8. ماتریس وضعیت سند قبلی بعد از اصلاحات

| آیتم سند قبلی | وضعیت فعلی | توضیح |
|---|---:|---|
| P0 safety direct paths | نیمه‌کامل | basic/full انجام شده؛ personalize باقی مانده. |
| P0 favorite_remove | ناموفق | backend bug دارد؛ frontend event نمی‌فرستد؛ تست غلط است. |
| P0 shopping add events | نیمه‌کامل | manual/from_plan route شده؛ toggle/remove واقعی هنوز producer ندارد. |
| P0 personalization processor | نیمه‌کامل | processor هست؛ resolver/undo/correction ناقص. |
| P0 consent gate | ناموفق برای production-grade | log-only default در production. |
| P0 idempotency | نیمه‌کامل/خطرناک | outbox هست؛ consumer idempotency ناقص. |
| P0 payload safe JSON | انجام شده | parser امن‌تر شده. |
| P0 limit/debug endpoints | نیمه‌کامل | recommendation clamp و admin guard بهتر شده؛ search/impression cap باقی. |
| P1 data maturity | نیمه‌کامل | eventهای بیشتری می‌شمارد اما `start_cooking_click` را بدون route حساب می‌کند. |
| P1 candidate parallelization | انجام شده | `Promise.allSettled` و fail isolation بهتر شده. |
| P1 slate/counter logging | نیمه‌کامل | schema/logging هست اما fire-and-forget و بدون sessionId. |
| P1 L1 prior | scaffold | فعال نیست و weight صفر است. |
| P1 metrics dedupe | تا حدی انجام شده | double count کمتر شده اما discrepancy پنهان می‌شود. |
| P1 feature vector cache | انجام شده با tradeoff | latency بهتر؛ feedback real-time تا TTL عقب می‌افتد. |
| P1 AI context | نیمه‌کامل | consent-safe؛ explain recommendation هنوز ضعیف. |
| P1 recsys health | backend-only | UI ادمین ندارد. |

## 9. بررسی طراحی/UX سیستم پایش و مرکز فرماندهی

[قطعی] برای per-user observability در Admin یک cabin وجود دارد (`UsersTab` از `/admin/observability/user/:id/*` استفاده می‌کند). این خوب است.

[قطعی] برای system-level recsys health UI وجود ندارد. این یعنی مدیر محصول نمی‌تواند از پنل ببیند:

- آیا outbox dead letter دارد؟
- آیا consent enforcement در حال bypass است؟
- چند درصد personalization actions resolve نشده‌اند؟
- `favorite_remove` واقعاً اثر منفی گذاشته یا نه؟
- attribution join rate بین served slate و reward چقدر است؟
- L1 prior آخرین بار کی آموزش دیده؟
- signal registry coverage چند درصد live است؟

پیشنهاد UI:

1. Admin tab جدید: `Recsys Health`.
2. بالای صفحه 6 status tile:
   - Signal Pipeline
   - Consent Gate
   - Attribution Join
   - Safety Gate
   - Learning Priors
   - Personalization Resolve Rate
3. هر tile باید status داشته باشد: `green / amber / red`.
4. زیر آن جدول drill-down:
   - event type
   - produced count
   - routed count
   - observation count
   - error/dead count
   - unresolved count
5. برای هر red item، action پیشنهادی مستقیم نمایش داده شود.

معیار موفقیت:

- ادمین در کمتر از ۳۰ ثانیه بفهمد سیستم پیشنهاد سالم است یا نه.
- در کمتر از ۲ دقیقه بفهمد مشکل از producer، router، processor، consent، safety یا learner است.

## 10. ریسک‌های امنیت، privacy و compliance

### ریسک 1: personalization بدون consent enforce

[قطعی] مهم‌ترین privacy risk همین است. raw event ذخیره شدن یک بحث است؛ route شدن به personalization profile بدون opt-in بحث دیگری است.

### ریسک 2: ابهام provenance در consentPurpose

[احتمالاً] چون eventهای routed بدون consent با `analytics` stamp می‌شوند، بعداً audit سخت می‌شود: event به ظاهر analytics بوده اما اثر personalization ساخته است.

### ریسک 3: health goal در collaborative filtering

[احتمالاً] اگر health goals در similarity استفاده شود، باید explicit consent و explainability guard قوی داشته باشد.

### ریسک 4: admin observability مقادیر raw signal value را نشان می‌دهد

[احتمالاً] الان allergy values در profile trace redacted هستند، اما signal observation `value` generic است. اگر در آینده processorها value آزاد ذخیره کنند، UI admin ممکن است داده حساس نشان دهد. باید schema و redaction policy برای `SignalObservation.value` قفل شود.

## 11. اولویت اجرای اصلاحات برای Claude Code

### اولویت 1 - حیاتی، قبل از هر demo/launch

1. اصلاح semantic واقعی `favorite_remove` در backend و تست اثر value.
2. emit کردن `favorite_remove` از همه UIهای save/remove.
3. production consent gate را enforce کنید یا launch claim personalization را محدود کنید.
4. idempotency واقعی با eventId/unique/transaction برای side effects.
5. safety gate برای `POST /recipes/:id/personalize`.
6. route و process کردن `start_cooking_click` یا حذف آن از data maturity تا زمان route شدن.

### اولویت 2 - مهم برای «سطح بالا»

1. requestId برای dismiss و recipe-detail save.
2. shopping toggle/remove producer در backend یا frontend.
3. recsys-health UI در پنل ادمین.
4. cap برای impression recipeIds و clamp برای search limit.
5. personalization resolver مبتنی بر ingredientId/alias.
6. undo/correction events برای personalization.
7. derived behavior signals را با negative/personalization/shopping/cook کامل کنید.
8. slate logging durableتر و همراه sessionId.

### اولویت 3 - بعد از تثبیت پایه

1. activation plan برای L1 prior با offline replay و kill switch.
2. explanation evidence-driven برای AI و WhyChip.
3. timezone/locale-aware ranking context.
4. حذف hardcoded Persian token extraction و حرکت به taxonomy-first.
5. discrepancy metrics برای served/viewed/attributed.

## 12. تست‌هایی که باید اضافه یا اصلاح شوند

### تست‌های backend ضروری

1. `favorite_remove` باید مقدار signal را کم کند.
2. `favorite_add` سپس `favorite_remove` روی همان recipe نباید final affinity را افزایش دهد.
3. `POST /recipes/:id/personalize` برای unsafe recipe باید 403 بدهد.
4. `start_cooking_click` باید routed شود و observation بسازد.
5. outbox redelivery بعد از partial failure نباید duplicate attribution بسازد.
6. batch impression partial failure باید فقط missing recipeIdها را retry کند.
7. production `EVENT_CONSENT_GATE_MODE` default باید بدون consent هیچ signal نسازد.
8. `recommendation_dismiss` با requestId باید attribution join بسازد.

### تست‌های frontend ضروری

1. Home unfavorite => `favorite_remove`.
2. Recipe detail unfavorite => `favorite_remove`.
3. Recipe detail save after recommendation click => `recommendation_save` با recalled requestId.
4. Dismiss card => `recommendation_dismiss` با requestId.
5. Personalization restore/clear => correction event.
6. Shopping remove/toggle/clear => event مناسب یا backend event.

## 13. نتیجه عملی

[قطعی] سیستم بعد از اصلاحات بهتر شده، اما هنوز launch-grade نیست. مشکل اصلی دیگر «نبود کد» نیست؛ مشکل «معنای غلط سیگنال‌ها، attribution ناقص، privacy gate نیمه‌فعال و observability بدون UI» است.

قدم بعدی پیشنهادی برای Claude Code:

1. اول P0-1 تا P0-6 را دقیقاً با تست semantic اصلاح کند.
2. بعد P1-1 تا P1-8 را برای وصل‌کردن attribution و observability کامل کند.
3. تا وقتی `favorite_remove`, consent enforce و idempotency واقعی حل نشده‌اند، ادعای «سیستم یادگیری دقیق و بین‌المللی» قابل دفاع نیست.

## 14. وضعیت اجرای تست در این ممیزی

فرمان‌های targeted زیر برای اعتبارسنجی اجرا شدند، اما هر دو بعد از 184 ثانیه timeout شدند:

```powershell
$env:CI='true'; pnpm --dir apps/server test -- behavior-engine/processors/recipe.signal-processor.spec.ts behavior-engine/processors/shopping.signal-processor.spec.ts behavior-engine/processors/personalization.signal-processor.spec.ts behavior-engine/processors/fi-step-1-learn-from-rejection.spec.ts behavior-engine/routing/event-outbox.service.spec.ts recommendation/recommendation-requestid-capstone.spec.ts --runInBand
```

```powershell
$env:CI='true'; pnpm --dir apps/web test src/hooks/usePersonalization.test.js src/hooks/useImpressionObserver.test.jsx src/components/ges/RecipeCard.dismiss.test.jsx src/app/cook/[id]/useCook.test.jsx --runInBand
```

[نامطمئن] بنابراین وضعیت سبز بودن تست‌ها تأیید نشده است. علاوه بر آن، حداقل یک تست موجود برای `favorite_remove` حتی اگر پاس شود، رفتار غلط را تأیید می‌کند.
