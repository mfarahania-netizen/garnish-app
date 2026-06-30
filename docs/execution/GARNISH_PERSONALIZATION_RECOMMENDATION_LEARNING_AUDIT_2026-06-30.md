# گزارش ممیزی سیستم شخصی سازی، پیشنهاد، پایش و یادگیری Garnish

تاریخ: 2026-06-30  
محدوده اصلی: `apps/server/src`  
محدوده های متصل بررسی شده: `apps/web/src/hooks`، `apps/web/src/app/home`، `apps/web/src/app/recipe/[id]`، `apps/web/src/app/cook/[id]`، `apps/web/src/app/plan`  
نوع خروجی: فقط گزارش. هیچ کد اپلیکیشن تغییر داده نشده است.

## 1. Reality Check

[قطعی] سیستم فعلی یک «مرکز فرماندهی یادگیری و پیشنهاد بین المللی» کامل نیست. قطعات مهمی دارد که جهت گیری درست دارند، مثل hard safety gate، requestId برای attribution، outbox، feature vector، living profile و shadow/evaluation scaffolding؛ اما چند بخش حیاتی یا به مسیر زنده وصل نیستند، یا eventها به پردازنده درست نمی رسند، یا مدل یادگیری هنوز بیشتر rule-based است تا learning-grade.

[قطعی] جمله «همه چیز را می شود در یک روز کامل و بی ریسک درست کرد» برای این سطح سیستم درست نیست. در یک روز می شود P0های لانچ را بست و مسیر را پایدار کرد؛ اما تبدیل آن به recommender بین المللی، privacy-aware، explainable، eval-driven و learning-grade نیاز به چند موج کار دارد. اگر همه چیز در یک روز با عجله patch شود، ریسک regression در allergy safety، consent، attribution و ranking بالا می رود.

[احتمالاً] بهترین مسیر این است: در روز اول فقط P0/P1های wiring، safety، consent، idempotency و event taxonomy fix شوند؛ سپس در موج دوم ranking/evaluation/AI context عمیق تر شود. این تصمیم نسبت اثر به ریسک بهتری دارد.

## 2. حکم کلی

[قطعی] سیستم پیشنهاد و شخصی سازی فعلی قابل لانچ خام و کنترل شده است، اما قابل ادعا به عنوان «پنل/سیستم بین المللی حرفه ای در سطح بهترین اپ های دنیا» نیست.

[قطعی] ریسک های اصلی لانچ:

- P0: بعضی eventهای مهم فرانت در behavior engine مصرف نمی شوند یا معنی غلط پیدا می کنند.
- P0: مسیر detail/cook از `GET /recipes/:id` می تواند hard safety invariant را دور بزند.
- P0: consent gate پیش فرض `off` است و personalization routing ممکن است بدون opt-in واقعی انجام شود.
- P0: outbox at-least-once است ولی پردازنده ها idempotent نیستند؛ retry می تواند سیگنال یادگیری را دو بار اعمال کند.
- P1: RecipePrior/L1 learning کد و تست دارد، اما providerهای آن به مسیر ranking زنده تزریق نشده اند.
- P1: AI context عملاً رفتار واقعی کاربر را نمی خواند و `recentSignals` خالی است.
- P1: feature vector در هر درخواست پیشنهاد بازسازی و DB-write می شود؛ این برای scale و latency ضعیف است.
- P1: quality/reward metrics دو منبع را با هم جمع می کنند و احتمال double-count دارد.

## 3. نقشه واقعی سیستم

[قطعی] مسیر فعلی پیشنهاد:

1. `GET /recommendations` در `apps/server/src/recommendation/recommendation.controller.ts`
2. `RecommendationPipelineService.getRecommendations`
3. `FeatureStoreService.buildFeatureVector`
4. `CandidateGeneratorService.generate`
5. `RankingService.rank`
6. `RecommendationCountersService.logSlate`
7. فرانت Home با `useImpressionObserver` impression را به `POST /recommendations/impression` می فرستد.
8. `AnalyticsService.trackEvent` event را ذخیره می کند.
9. `EventOutboxService` event را به `ProcessorRegistry` و processorها می رساند.
10. processorها `SignalObservation`، `UserBehaviorSignal` و `RecommendationAttributionEvent` می سازند.

[قطعی] سیستم های متصل:

- Home: `apps/web/src/app/home/lib/useHomeData.js` و `apps/web/src/app/home/page.jsx`
- Cook mode: `apps/web/src/app/cook/[id]/useCook.js`
- Recipe detail و personalization cascade: `apps/web/src/app/recipe/[id]/useRecipeDetail.js` و `apps/server/src/recipes/intelligence/recipe-richness.service.ts`
- Meal plan: `apps/server/src/meal-plans/meal-plans.service.ts` و `apps/web/src/app/plan/page.jsx`
- AI: `apps/server/src/ai/context/behavioral-context-snapshot.service.ts`، `apps/server/src/ai/tools/get-user-food-context.tool.ts`، `apps/server/src/ai/tools/explain-recommendation.tool.ts`
- Profile/living profile: `apps/server/src/behavior-engine/profile/read/profile-read.service.ts`
- Analytics/event learning: `apps/server/src/analytics/analytics.service.ts`، `apps/server/src/behavior-engine/routing/*`، `apps/server/src/behavior-engine/processors/*`

## 4. P0 - مواردی که قبل از لانچ باید اصلاح شوند

### P0-1. مسیر recipe detail/cook hard safety را کامل enforce نمی کند

[قطعی] `RecipesController.findAll/search/similar` از `RecipeSafetyFilterService` استفاده می کند، اما `GET /recipes/:id` عمومی است و safety filter ندارد. شواهد: `apps/server/src/recipes/recipes.controller.ts:41`, `:59`, `:64`, `:72` برای لیست/سرچ/similar و `:82-84` برای `GET :id` بدون safety. `RecipesService.findOne` فقط active/public بودن را چک می کند، نه allergy/observance را. شواهد: `apps/server/src/recipes/recipes.service.ts:67`.

[قطعی] مسیر logged-in detail از `GET /recipes/:id/full` می آید، اما `RecipeRichnessService.getRichRecipe` زیرش `this.recipes.findOne(id)` را می خواند و fit/safety را محاسبه می کند، نه اینکه recipe ناامن را الزاماً block کند. شواهد: `apps/server/src/recipes/intelligence/recipe-richness.service.ts:61`.

ریسک:

- کاربر با allergy/halal/no-pork ممکن است از لینک مستقیم یا cook page به دستور unsafe برسد.
- سیستم پیشنهاد امن است ولی صفحه پخت invariant را می شکند؛ این برای اپ غذایی ریسک اعتباری و ایمنی دارد.

راه حل پیشنهادی:

- `GET /recipes/:id` را با `OptionalJwtGuard` owner-aware کنید.
- برای کاربر login شده، بعد از `findOne` همان `RecipeSafetyFilterService.safeIds(userId, [id])` یا `assessRecipeFit` را enforce کنید.
- برای `GET /recipes/:id/full` اگر `fit.recommendation` برابر `avoid_allergen` یا `avoid_constraint` بود، recipe body را برنگردانید یا response را با status ایمن و بدون مراحل/مواد برگردانید.
- Cook mode باید اگر recipe unsafe شد اصلاً session پخت نسازد.

معیار پذیرش:

- کاربر دارای allergy با لینک مستقیم `recipes/:id` و `recipes/:id/full` recipe ناسازگار را دریافت نکند.
- cook page برای recipe unsafe وارد step mode نشود.
- تست e2e/contract: list/search/detail/full/cook همه یک invariant مشترک داشته باشند.

### P0-2. `favorite_remove` اشتباه پردازش می شود

[قطعی] `ProcessorRegistry`، `favorite_remove` را به `RecipeSignalProcessor` route می کند. شواهد: `apps/server/src/behavior-engine/routing/processor.registry.ts:25`.

[قطعی] `RecipeSignalProcessor` برای `favorite_remove` منطق منفی ندارد. چون `cooked=false` و `event.type !== favorite_add`، در انتها `signalName` به `views_recipe` تبدیل می شود و یک observation خنثی/مثبت نما ثبت می کند. شواهد: `apps/server/src/behavior-engine/processors/recipe.signal-processor.ts`.

ریسک:

- برداشتن علاقه مندی به جای کاهش علاقه، نویز به پروفایل می دهد.
- ranking ممکن است recipeهای حذف شده را همچنان مناسب فرض کند.

راه حل پیشنهادی:

- `favorite_remove` یا به recommendation/negative feedback processor برود، یا در `RecipeSignalProcessor` جداگانه `applyNegativeFeedback(userId, recipeId, -0.2/-0.3)` بگیرد.
- برای `favorite_remove` هیچ `views_recipe` ثبت نشود.
- event-specific test اضافه شود.

معیار پذیرش:

- `favorite_remove` باعث `views_recipe` نشود.
- اگر recipeId دارد، signalهای ingredient/taste مربوطه کمی کاهش یابد.

### P0-3. shopping eventهای واقعی فرانت به behavior processor نمی رسند

[قطعی] taxonomy فرانت و سرور `shopping_add_manual` و `shopping_add_from_plan` را دارند. شواهد: `apps/web/src/lib/eventTaxonomy.js:38-39` و `apps/server/src/analytics/event-taxonomy.ts:41-42`.

[قطعی] `useShopping.js` این eventها را emit می کند. شواهد: `apps/web/src/app/shopping-list/useShopping.js:185`, `:200`.

[قطعی] `ProcessorRegistry` فقط `shopping_item_add`, `shopping_item_toggle`, `shopping_item_remove` را به `ShoppingSignalProcessor` route می کند. شواهد: `apps/server/src/behavior-engine/routing/processor.registry.ts:38-40`.

ریسک:

- خرید دستی و خرید از برنامه غذایی وارد یادگیری نمی شود.
- routine.shopping_day_pattern در registry تعریف شده ولی داده واقعی فرانت به پردازنده live نمی رسد.
- پیشنهادهای pantry/inventory و meal-plan feedback ناقص می مانند.

راه حل پیشنهادی:

- `shopping_add_manual`, `shopping_add_from_plan`, `shopping_add_from_fav` را route کنید.
- processor باید payloadهای متفاوت را بفهمد: `added`, `items`, `source`, `recipeId/planId`.
- feature maturity باید این eventها را qualified بداند.

معیار پذیرش:

- add from plan یک `SignalObservation` با family grocery/routine بسازد.
- shopping maturity با این eventها بالا برود.

### P0-4. personalization interactionها emit می شوند ولی live learning آن ها را مصرف نمی کند

[قطعی] `usePersonalization` سه event مهم را emit می کند: `portion_scaled`, `ingredient_swapped`, `ingredient_removed`. شواهد: `apps/web/src/hooks/usePersonalization.js:62`, `:67`, `:79`.

[قطعی] این eventها در `EventType` تعریف شده اند. شواهد: `apps/server/src/analytics/event-taxonomy.ts:152-154`.

[قطعی] در `ProcessorRegistry` هیچ processor برای این سه event وجود ندارد.

ریسک:

- قوی ترین سیگنال های taste/session personalization فقط در analytics ذخیره می شوند و وارد UserBehaviorSignal/SignalObservation موثر نمی شوند.
- کاربر که قارچ را حذف می کند یا کره را با روغن زیتون swap می کند، ranking آینده واقعاً از آن یاد نمی گیرد.

راه حل پیشنهادی:

- processor اختصاصی `PersonalizationSignalProcessor` بسازید.
- `ingredient_removed` باید ingredient aversion نرم ایجاد کند.
- `ingredient_swapped` باید `from` را aversion نرم و `to` را affinity نرم بدهد، فقط اگر ingredient dictionary resolve شد.
- `portion_scaled` بیشتر routine/serving/family-size signal است، نه taste مستقیم.

معیار پذیرش:

- حذف ingredient باعث `signal_ing_*` منفی یا observation قابل بازسازی شود.
- swap به ingredient resolved وصل شود و بدون resolve شدن ادعای یادگیری قطعی نکند.

### P0-5. consent gate پیش فرض برای personalization قابل دفاع نیست

[قطعی] در `AnalyticsService.trackEvent` مقدار `EVENT_CONSENT_GATE_MODE` پیش فرض `off` است. شواهد: `apps/server/src/analytics/analytics.service.ts:109-120`.

[قطعی] وقتی gate off باشد، event با `consentPurpose=analytics` ذخیره می شود ولی routing personalization ادامه پیدا می کند. شواهد: `apps/server/src/analytics/analytics.service.ts:126-138`.

ریسک:

- برای لانچ بین المللی/EU، routing رفتار به personalization بدون opt-in مشخص ریسک privacy/GDPR دارد.
- Living profile در بعضی جاها consent-aware است، اما analytics-to-learning gate default off کل معماری را از زیر می شکند.

راه حل پیشنهادی:

- برای production، default را `enforce` کنید یا لااقل محیط production را enforce کنید.
- eventهای core مثل `cook_complete` برای functionality/gamification مجاز بمانند، اما personalization-derived signals فقط با personalization consent ساخته شوند.
- اگر consent نیست، event raw برای analytics aggregate بماند ولی processorهای personalization اجرا نشوند.

معیار پذیرش:

- کاربر بدون personalization consent، `UserBehaviorSignal` و `SignalObservation` taste/reco شخصی سازی شده نگیرد.
- aggregate analytics همچنان کار کند.

### P0-6. outbox at-least-once است، processorها idempotent نیستند

[قطعی] خود `EventOutboxService` می گوید semantics فعلی at-least-once است و exactly-once نیست. شواهد: `apps/server/src/behavior-engine/routing/event-outbox.service.ts`.

[قطعی] processorها `signalObservation.create` و `recommendationAttributionEvent.create` را بدون unique/idempotency key می زنند. شواهد: `apps/server/src/behavior-engine/processors/recommendation.signal-processor.ts`، `recipe.signal-processor.ts`، `meal-plan.signal-processor.ts`، `shopping.signal-processor.ts`.

ریسک:

- اگر route موفق شود ولی done-mark شکست بخورد، retry می تواند signal و attribution را دوباره اعمال کند.
- `applyPositiveFeedback` و `applyNegativeFeedback` additive هستند؛ duplicate processing پروفایل را کج می کند.

راه حل پیشنهادی:

- برای هر derived row یک idempotency key تعریف شود: `eventId + processor + recipeId + signalName`.
- برای `RecommendationAttributionEvent` unique روی `eventId/recipeId` بهتر از فقط requestId است. اگر schema eventId ندارد، اضافه شود.
- processorها قبل از اعمال feedback بررسی کنند که event قبلاً مصرف نشده باشد.

معیار پذیرش:

- rerun outbox روی همان event تعداد observation/attribution را زیاد نکند.
- feedback value دوبار update نشود.

### P0-7. `JSON.parse(event.payload)` بدون guard در processorها می تواند outbox را dead-letter کند

[قطعی] `RecipeSignalProcessor`, `RecommendationSignalProcessor`, `MealPlanSignalProcessor` payload را مستقیم parse می کنند. شواهد: `apps/server/src/behavior-engine/processors/recipe.signal-processor.ts`, `recommendation.signal-processor.ts`, `meal-plan.signal-processor.ts`.

ریسک:

- یک payload خراب یا legacy می تواند processor را throw کند و outbox retry/dead-letter شود.
- سیگنال های بعدی همان کاربر/رویداد معطل یا noisy می شوند.

راه حل پیشنهادی:

- helper مشترک `safeJsonPayload(event)` بسازید.
- اگر payload خراب است، observation خطای غیرشخصی/diagnostic بسازید یا graceful skip کنید.
- dead-letter dashboard برای outbox لازم است.

## 5. P1 - سیم کشی های ناقص و یادگیری نیمه فعال

### P1-1. RecipePrior/L1 learning ساخته شده ولی به ranking زنده وصل نیست

[قطعی] `RecipePriorService`, `RecipePriorLearnerService`, `L1_RECIPE_PRIOR_SOURCE`, `L1_WEIGHT_SOURCE` وجود دارند و تست هم دارند. شواهد: `apps/server/src/recommendation/pipeline/recipe-prior.service.ts`, `recipe-prior-learner.service.ts`, `ranking.service.ts:11-12`, `:180-183`.

[قطعی] در `RecommendationModule` provider برای `RecipePriorService`, `RecipePriorLearnerService`, `{ provide: L1_RECIPE_PRIOR_SOURCE, useClass: RecipePriorService }` و `L1_WEIGHT_SOURCE` دیده نشد. شواهد: `apps/server/src/recommendation/recommendation.module.ts:43`.

[قطعی] وزن `recipePrior` در defaultWeights صفر است. شواهد: `apps/server/src/recommendation/pipeline/ranking.service.ts:112`.

ریسک:

- تیم ممکن است فکر کند learning prior فعال است، اما در ranking live اثری ندارد.
- cron learner نیز اگر provider نشده باشد، scheduled job اجرا نمی شود.

راه حل پیشنهادی:

- providerها را صریح اضافه کنید، اما activation را default-off نگه دارید.
- admin/founder review باید نشان دهد: prior table rows، last refresh، coverage، offline lift، activation status.
- قبل از non-zero weight، offline replay و shadow evidence لازم است.

معیار پذیرش:

- وقتی `L1_RECIPE_PRIOR_ENABLED=true` و `L1_PRIOR_STEP5_WEIGHT>0` است، ranker واقعاً `RecipePriorService.valuesForSlate` را call کند.
- وقتی env خاموش است، خروجی byte-identical بماند.

### P1-2. SignalObservationEngine canonical وجود دارد ولی live ingest هنوز legacy processor است

[قطعی] `extractSignalObservations` و signal registry/QA gate وجود دارند. شواهد: `apps/server/src/behavior-engine/signals/signal-observation-engine.ts:173`.

[قطعی] مسیر live analytics فعلی از `EventOutboxService -> ProcessorRegistry -> legacy processors` می رود، نه از canonical engine.

ریسک:

- دو حقیقت موازی داریم: canonical signal registry و legacy processor behavior.
- QA gate ممکن است سبز باشد، اما production همان mapping را اجرا نکند.
- بعضی signalهای registry مثل `routine.shopping_day_pattern`, `reco.exposure_fatigue`, `skill.cook_completion_growth` در live دقیقاً همان derivation را ندارند.

راه حل پیشنهادی:

- یک مرحله shadow: live event را همزمان به `extractSignalObservations` بدهید و diff بین canonical و legacy را لاگ کنید.
- بعد از همگرایی، legacy processors را به adapterهای canonical تبدیل کنید.
- registry باید source of truth باشد؛ processorها نباید map جداگانه بسازند.

### P1-3. AI personalization هنوز به رفتار واقعی کاربر وصل نیست

[قطعی] `BehavioralContextSnapshotService` فقط `diet`, `skillLevel`, `budget` را می خواند و `signals` را `{}` می گذارد. شواهد: `apps/server/src/ai/context/behavioral-context-snapshot.service.ts`.

[قطعی] `GetUserFoodContextTool` مقدار `recentSignals: []` برمی گرداند. شواهد: `apps/server/src/ai/tools/get-user-food-context.tool.ts`.

[قطعی] `ExplainRecommendationTool` فقط وجود `RecommendationExposure` را چک می کند و explanation generic می دهد. شواهد: `apps/server/src/ai/tools/explain-recommendation.tool.ts`.

ریسک:

- AI نمی تواند توضیح دقیق و شخصی سازی شده بدهد، حتی وقتی ranker matchedSignals و scoreBreakdown دارد.
- کاربر ممکن است احساس کند AI جدا از رفتار واقعی اوست.

راه حل پیشنهادی:

- snapshot AI را از living profile + redacted top signals + data maturity تغذیه کنید.
- برای explain recommendation از `FeatureContributionLog`, `matchedSignals`, `requestId`, `reasonSignals` استفاده شود؛ بدون افشای score داخلی.
- حساسیت ها/health/allergy فقط به شکل safety constraint و با consent/control مناسب وارد شوند.

معیار پذیرش:

- AI بتواند بگوید «چون اخیراً چند غذای سریع ذخیره کردی» فقط وقتی evidence واقعی وجود دارد.
- بدون evidence، limited-data honest بماند.

### P1-4. FeatureStore در هر request پیشنهاد، snapshot و feature rows را بازنویسی می کند

[قطعی] `FeatureStoreService.buildFeatureVector` در ابتدا `snapshotBuilder.buildAll(userId)` را اجرا می کند. شواهد: `apps/server/src/behavior-engine/feature-store/feature-store.service.ts:12-13`.

[قطعی] سپس `userFeatureVector.upsert` و delete/create کامل `userFeature` را انجام می دهد. شواهد: همان فایل.

ریسک:

- هر بار باز کردن Home می تواند DB write amplification ایجاد کند.
- latency recommendation زیاد می شود.
- under load، lock/contention و هزینه افزایش می یابد.

راه حل پیشنهادی:

- Feature build را event-driven یا scheduled کنید.
- در request path فقط cached vector را بخوانید و اگر stale بود async refresh queue شود.
- برای cold-start، lightweight in-memory/on-demand بدون delete/create کامل.

معیار پذیرش:

- `GET /recommendations` در حالت معمول DB write نکند مگر stale refresh async.
- latency p95 قبل/بعد اندازه گیری شود.

### P1-5. Data maturity eventهای مهم را حساب نمی کند

[قطعی] `qualifiedTypes` در `FeatureStoreService.getDataMaturity` شامل `cook_complete`, `start_cooking_click`, `shopping_add_from_plan`, `shopping_add_manual`, `ingredient_swapped`, `ingredient_removed`, `portion_scaled` نیست. شواهد: `apps/server/src/behavior-engine/feature-store/feature-store.service.ts:328-349`.

ریسک:

- کاربر واقعی که آشپزی و personalization انجام می دهد، هنوز cold/warming دیده می شود.
- ranking weights به اشتباه cold-start می مانند.

راه حل پیشنهادی:

- qualified eventها را بر اساس taxonomy و signal registry بازتعریف کنید.
- cook_complete باید maturity را بالا ببرد، نه فقط recommendation_cook.
- personalization actions باید با وزن مناسب وارد maturity شوند.

### P1-6. Candidate generation کند و rule-heavy است

[قطعی] `CandidateGeneratorService.generate` bucketها را با `await` داخل آرایه یکی یکی اجرا می کند. شواهد: `apps/server/src/recommendation/pipeline/candidate-generator.ts:30-39`.

[قطعی] بعضی bucketها brittle هستند: trending روی کل `payload` groupBy می کند؛ inventory exact ingredient name match دارد؛ health/seasonal بر `categories contains` متکی است. شواهد: `candidate-generator.ts`.

ریسک:

- latency بالا می رود.
- ranking از pool ضعیف شروع می کند؛ ranker قوی روی candidate ضعیف معجزه نمی کند.
- internationalization ضعیف می شود چون token/categoryها mixed Persian/English و string contains هستند.

راه حل پیشنهادی:

- bucketها را `Promise.allSettled` کنید.
- event payload را با denormalized `recipeId` برای trending query کنید.
- inventory را به ingredientId/dictionary resolution وصل کنید.
- source metadata را همراه candidate نگه دارید تا diversity/explainability/evaluation بفهمد هر candidate از کجا آمده.

### P1-7. Recommendation metrics احتمال double-count دارد

[قطعی] `RecommendationEvaluatorService.collectAttributionMetrics` هم `RecommendationAttributionEvent` و هم `UserEvent` را با event typeهای recommendation جمع می کند. شواهد: `apps/server/src/recommendation/evaluation/recommendation-evaluator.service.ts:144-179`.

[قطعی] `RecommendationRewardService` هم همین الگو را دارد. شواهد: `apps/server/src/recommendation/evaluation/recommendation-reward.service.ts`.

ریسک:

- چون attribution خودش از UserEvent ساخته می شود، metrics ممکن است دو برابر شود.
- CTR/save/cook/funnel score قابل اعتماد نمی ماند.

راه حل پیشنهادی:

- یک source of truth انتخاب کنید: attribution table برای recommendation funnel، UserEvent برای fallback فقط وقتی attribution غایب است.
- dedupe بر اساس `eventId` یا `requestId+recipeId+eventType+timestamp window`.

### P1-8. Served slate logging fire-and-forget است

[قطعی] `RecommendationPipelineService` `counters.logSlate` را fire-and-forget اجرا می کند. شواهد: `apps/server/src/recommendation/pipeline/recommendation-pipeline.service.ts:60-63`.

[قطعی] `RecommendationCountersService.logSlate` failure را swallow می کند و 0 برمی گرداند. شواهد: `apps/server/src/recommendation/pipeline/recommendation-counters.service.ts:34`.

ریسک:

- requestId در response به client می رود ولی served rows ممکن است ذخیره نشده باشند.
- learner join برای IPS/prior ناقص می شود.

راه حل پیشنهادی:

- برای production، slate logging باید یا awaited با timeout کوتاه باشد، یا durable outbox جدا داشته باشد.
- اگر logging fail شد، response باید trackingPolicy را degraded کند یا metric alert بسازد.

## 6. Ranking و explainability

[قطعی] Ranker از چند component معقول استفاده می کند: tasteAffinity، behaviorFit، outcomeFit، effortFit، skillFit، novelty، popularity، recency، recipeUnderstanding، ingredientIntelligence و recipePrior. شواهد: `apps/server/src/recommendation/pipeline/ranking.service.ts`.

[احتمالاً] مشکل اصلی ranker کمبود component نیست؛ مشکل این است که داده ورودی و feedback loop هنوز دقیق و یکپارچه نیست.

ایرادهای مهم:

- [قطعی] effort weekday با `isIranWeekday(new Date())` محاسبه می شود، نه timezone/country کاربر. برای Europe/international launch دقیق نیست.
- [قطعی] prior learned default off است و provider ندارد؛ بنابراین «یادگیری از reward» هنوز live نیست.
- [احتمالاً] popularity و exposure penalty با `payload LIKE` در `ExposureTrackingService` brittle هستند. شواهد: `apps/server/src/recommendation/exposure/exposure-tracking.service.ts`.
- [قطعی] `GET /recommendations/compare` برای کاربر authenticated معمولی در controller وجود دارد و debug/analysis-heavy به نظر می رسد. شواهد: `apps/server/src/recommendation/recommendation.controller.ts:143`.

راه حل پیشنهادی:

- user locale/timezone را از profile/context وارد ranker کنید.
- debug routeها را admin/internal کنید.
- exposure/reward queries را از JSON string LIKE به فیلد denormalized یا JSON query امن منتقل کنید.
- reasonهای کاربر-facing را از score داخلی جدا نگه دارید، اما از evidence واقعی بسازید.

## 7. Meal plan و Cook به عنوان loop یادگیری

[قطعی] برنامه هفتگی و cook mode به سیستم یادگیری وصل هستند، اما ناقص.

نقاط مثبت:

- [قطعی] plan page `mealplan_add`, `mealplan_remove`, `cook_complete` emit می کند. شواهد: `apps/web/src/app/plan/page.jsx:230`, `:236`.
- [قطعی] cook mode `start_cooking_click`, `cook_complete`, و اگر attribution وجود داشته باشد `recommendation_cook` emit می کند. شواهد: `apps/web/src/app/cook/[id]/useCook.js:74`, `:115`, `:119`.
- [قطعی] `recommendationAttribution.js` requestId را برای save/cook بعدی نگه می دارد. شواهد: `apps/web/src/lib/recommendationAttribution.js:39-63`.

کمبودها:

- [قطعی] `start_cooking_click` در behavior processor route نشده؛ فقط analytics/intelligence مصرف می کند.
- [قطعی] `mealplan_add` در `MealPlanSignalProcessor` planning signal می سازد، اما recipeId را به عنوان weak positive taste feedback اعمال نمی کند.
- [احتمالاً] `cook_complete` از plan page بدون requestId است؛ برای برنامه غذایی شاید باید attribution به plan slot/source داشته باشد، نه recommendation.
- [قطعی] cook mode اگر کاربر مستقیماً به recipe برسد، requestId ندارد و `recommendation_cook` نمی فرستد؛ این درست است، اما funnel باید organic cook را جدا تحلیل کند.

راه حل پیشنهادی:

- `start_cooking_click` را به cook funnel processor وصل کنید: start بدون complete باید drop-off signal بدهد.
- `mealplan_add` با recipeId باید weak positive برای recipe/taste بسازد، با وزن کمتر از cook/save.
- `mealplan_remove` همان recipe را weak negative کند؛ این بخش تا حدی وجود دارد.
- `cook_complete` از plan باید `source=meal_plan` و plan slot context را به outcome planner وصل کند.

## 8. UX/Product: آیا حس «برج مراقبت» دارد؟

[احتمالاً] از سمت کاربر، Home تجربه ای نسبتاً command-center دارد؛ اما از سمت سیستم یادگیری، کاربر هنوز feedbackهایش را به شکل شفاف نمی بیند.

کمبودهای UX:

- [قطعی] dismiss در Home optimistic removal دارد، اما دلیل/گزینه های feedback مثل «این غذا را دوست ندارم»، «موادش را نمی خواهم»، «زمانش زیاد است» تفکیک نشده است. شواهد: `apps/web/src/hooks/useDismissRecommendation.js`.
- [احتمالاً] یک dismiss ساده برای یادگیری کافی نیست؛ برای recommender حرفه ای باید reason-coded negative feedback باشد.
- [قطعی] Food DNA maturity نشان داده می شود، اما trace دقیق «چه چیزی باعث این شناخت شد» محدود است.
- [قطعی] AI explain recommendation generic است و evidenceهای ranker را نشان نمی دهد.

راه حل پیشنهادی:

- dismiss reason sheet با گزینه های کوتاه اضافه شود: not my taste، too much time، ingredient dislike، already cooked، diet mismatch.
- هر reason به processor جدا یا payload structured برود.
- Food DNA صفحه باید top signals، confidence، last updated، و controls برای correction داشته باشد.
- user-facing explanation باید بدون درصد داخلی ولی evidence-driven باشد.

## 9. Backend code quality

[قطعی] کد در بعضی بخش ها defensive و safety-aware است، اما consistency مشکل دارد.

ایرادها:

- [قطعی] چند فایل متن/کامنت mojibake دارند یا encoding نمایش آن خراب است. این در خروجی فارسی و maintainability بد است.
- [قطعی] چند route placeholder با 501 در `RecommendationController` وجود دارد. این صداقت خوبی است، اما برای API production باید یا internal/admin شوند یا از public surface حذف شوند.
- [قطعی] `limit` در `GET /recommendations` DTO/validation ندارد و مستقیم `+limit` می شود؛ برای NaN/negative/huge باید clamp شود.
- [احتمالاً] raw SQL در چند جا برای backward compatibility استفاده شده؛ برای لانچ باید در migration/client generation debt ثبت شود.
- [قطعی] processorها error handling مشترک ندارند.

راه حل پیشنهادی:

- DTO validation برای recommendation endpoints.
- shared event payload parser.
- producer/consumer contract tests.
- remove/internalize debug endpoints.
- encoding audit برای فایل های فارسی.

## 10. Test Plan پیشنهادی برای Claude Code

### P0 tests

- Safety invariant:
  - `GET /recipes`
  - `GET /recipes/search`
  - `GET /recipes/:id`
  - `GET /recipes/:id/full`
  - cook page data path  
  همه برای allergy/no-pork یکسان fail-closed باشند.

- Event routing:
  - `favorite_remove` منفی/neutral درست، نه `views_recipe`.
  - `shopping_add_manual` و `shopping_add_from_plan` route شوند.
  - `ingredient_removed/swapped/portion_scaled` route شوند.
  - `start_cooking_click` route شود.

- Idempotency:
  - یک outbox event دوبار route شود و فقط یک attribution/observation/feedback effect بسازد.

- Consent:
  - بدون personalization consent، analytics ذخیره شود ولی personalization signal ساخته نشود.
  - با consent، signal ساخته شود.

### P1 tests

- RecipePrior DI:
  - provider در module فعال باشد.
  - env off خروجی byte-identical.
  - env on call به `valuesForSlate`.

- Metrics dedupe:
  - UserEvent + AttributionEvent برای یک action double-count نشود.

- AI context:
  - recent safe signals با consent در snapshot بیاید.
  - بدون consent خالی بماند.

## 11. اولویت بندی اجرایی

### اولویت 1 - حیاتی برای لانچ

[قطعی] این ها باید قبل از لانچ بسته شوند:

1. Enforce hard safety روی `recipes/:id`, `recipes/:id/full`, cook path.
2. Fix `favorite_remove`.
3. Route shopping_add_manual/from_plan.
4. Route personalization actions.
5. Consent gate production enforce/log با تصمیم شفاف.
6. Idempotency حداقلی برای processorهای recommendation/recipe.
7. Validate و clamp recommendation limit.
8. Internal/admin کردن debug/compare و placeholder routeها.

### اولویت 2 - مهم برای کیفیت بین المللی

1. RecipePrior provider wiring و activation dashboard.
2. FeatureStore async/stale-cache redesign.
3. AI context hydration از living profile و safe signals.
4. Metrics dedupe.
5. timezone/locale واقعی برای ranker.
6. Candidate bucket parallelization و dictionary-based inventory.
7. Dismiss reason feedback.

### اولویت 3 - بعد از لانچ

1. Canonical SignalObservationEngine را source-of-truth کنید.
2. Bandit/randomized exploration با propensity واقعی.
3. Offline replay suite و cohort fairness evaluation.
4. Full admin command center برای recsys health، dead letters، signal coverage، consent coverage، conversion funnel.

## 12. Definition of Done برای «سیستم بین المللی قابل دفاع»

[قطعی] تا وقتی این معیارها پاس نشوند، ادعای international-grade قابل دفاع نیست:

- Safety invariant: هیچ مسیر user-facing recipe برای user authed، allergy/observance hard constraints را دور نزند.
- Consent invariant: personalization learning بدون consent انجام نشود.
- No lost/no double signals: outbox retry سیگنال را نه گم کند نه دوبار اعمال کند.
- Attribution integrity: impression/click/save/cook به requestId/served slate وصل شود یا honest organic بماند.
- Metrics integrity: funnel metrics double-count نشود.
- Explainability: هر پیشنهاد top reasons evidence-based داشته باشد، نه generic.
- AI alignment: AI همان living profile و safe signals را ببیند، نه snapshot خالی.
- International context: timezone/locale/occasion/diet labels hardcoded ایران-only نباشند.
- Admin observability: dead-letter، signal coverage، consent coverage، feature freshness، prior freshness، CTR/CVR/friction by surface دیده شود.

## 13. نتیجه عملی

[قطعی] برای لانچ هفته آینده، مسیر درست این نیست که همه چیز را یکباره «هوشمندتر» کنیم. مسیر درست این است که اول سیم کشی و ایمنی را قابل اعتماد کنیم: safety، consent، event routing، idempotency، attribution و metrics. بعد از آن می شود prior learning، AI context و ranker optimization را با evidence فعال کرد.

[احتمالاً] اگر Claude Code یک روز کامل دارد، scope روز اول باید P0 باشد. اگر در همان روز وارد bandit، model learning، UIهای بزرگ یا refactor کامل SignalObservationEngine شود، احتمال regression بالا می رود.

قدم بعدی پیشنهادی:

1. یک branch فقط برای P0 stabilization ساخته شود.
2. قبل از هر fix، تست های failing contract نوشته شود.
3. بعد از P0، همین گزارش به issue list تبدیل شود و P1ها جداگانه اجرا شوند.

---

## 14. وضعیت اجرا — Claude (2026-06-30)

این بخش بعد از اجرای سند اضافه شد. دقیقاً مطابق §13: روی یک branch جدا (`audit/recsys-p0`) و test-first؛ کلِ P0 + یک P1 کم‌ریسک انجام شد و **عمداً** وارد ناحیه‌های regression-risk (ranker/shadow/refactor) که §13 هشدار داده **نشدیم**.

### P0 — کامل (۸/۸)، هرکدام تست‌دار + verify + commit

| # | کار | commit | تست/verify |
|---|---|---|---|
| P0-1 | hard allergy gate روی مسیرهای مستقیم recipe (`:id` + `:id/full`) | `aecf77b2` | e2e `recsys-safety` 5/5 (anonymous 200 · allergic 403 · safe 200) |
| P0-2 | `favorite_remove` سیگنال منفی شد، نه `views_recipe` | `f09bd071` | unit |
| P0-3 | رویدادهای واقعی `shopping_add_*` به یادگیری route شدند | `0bf4b5d8` | unit |
| P0-4 | `PersonalizationSignalProcessor` جدید (swap/remove/scale) + honesty-gate | `dde91cfa` | unit |
| P0-5 | consent gate پیش‌فرض env-based (`log` در production، `off` در dev) | `c0177296` | admin pipeline 200 |
| P0-6 | idempotency guard — رویداد redeliver-شده دیگر دوبار اعمال نمی‌شود | `9a1d983f` | processors 37/37 |
| P0-7 | `safeJsonPayload` در همه پردازنده‌ها (payload خراب dead-letter نکند) | `45c0923d` | unit |
| P0-8 | clamp کردن limit + admin-gate کردن مسیرهای debug (`compare`/`lifestyle`) | `2f27a4d0` | live: limit=99999→200 · compare(non-admin)→403 |

پاک‌سازی: حذف duplicate مردهٔ `routing/shopping.signal-processor.ts` (`a083b877`).

**یکپارچگی پنل ادمین (نگرانی اصلی شما) — تأیید شد سالم:** یک ایجنت کل مسیر را code-review کرد: هیچ سیگنیچر سرویسی که ادمین صدا می‌زند عوض نشده؛ ردیف‌های جدید `SignalObservation` با reader ادمین null-safe سازگارند؛ consent gate در dev byte-identical است و `userEvent.create` همیشه (صرف‌نظر از gate) اجرا می‌شود پس شمارش‌های ادمین خالی نمی‌شوند؛ DI سالم. تأیید live: analytics + observability همه ۲۰۰.

### P1 — مطابق §13 به‌صورت issue list، نه اجرای الان

P1-5 (data maturity) انجام شد (`e28b91fd`): forward-value روشن + کم‌ریسک (شمردن cook/shop/personalization در بلوغ؛ feature-store 6/6؛ هنوز پشت consent gate خاموش). بقیهٔ P1 دقیقاً طبق §13 («prior learning، AI context، ranker optimization را **بعد از P0 با evidence** فعال کن») به موجِ post-launch موکول شد — هرکدام با دلیلِ code-grounded:

- **P1-1 ranker/prior learning** — به داده نیاز دارد + در trackِ L1 founder-gated شماست (قدم بعدیِ تأییدشده offline-replay است، نه سیم‌کشیِ live ranker). **تصمیم با شما.**
- **P1-2 SignalObservationEngine shadow** — §13 صراحتاً refactor کاملش را regression-risk خوانده؛ post-launch.
- **P1-3 AI context hydration** — با بازسازی فعال AI (#23) هم‌پوشان + پشت همان consent-grantِ هنوز-wire-نشده؛ در دلِ #23 انجام شود نه patch جدا.
- **P1-4 feature-store async/cache** — بهینهٔ latency در مقیاس؛ post-launch.
- **P1-6 candidate parallelization** — latency در مقیاس؛ post-launch.
- **P1-7 metrics dedupe** — پشت همان migrationِ attribution-key (attribution فاقد `eventId` است) که P0-6 به L1 موکول کرد؛ در ~۰ ترافیک عددش ~۰.
- **P1-8 slate durability** — عمداً fire-and-forget برای latency؛ durable-کردن outbox می‌خواهد؛ post-launch.

**نکتهٔ عملیاتی push:** credential helper (`manager`) در محیط non-interactive گیر می‌کند، پس ۴ commit آخر فقط **local** روی `audit/recsys-p0` هستند؛ remote تا `45c0923d` دارد. وقتی برگشتید: `git push origin audit/recsys-p0`. همه‌چیز تست‌شده، server سالم (۰ خطای کامپایل)، و امن است.
