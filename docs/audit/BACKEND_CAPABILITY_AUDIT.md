# BACKEND CAPABILITY & WIRING AUDIT — full edition
**Read-only · evidence-based · authored by Claude Code from the live repo · 2026-06-19**

> **Method.** Eight parallel read-only investigators read the actual code under `apps/server/src`, `prisma/`,
> `scripts/`, and `apps/web/src` — not file names, comments, or prior reports. Every non-obvious claim cites
> `path:line`. **No code was changed** (`git status` after: only this report is new; `NO_SOURCE_CHANGES`).
> Where the truth differs from prior framing, it is stated plainly. This is the long edition: it contains the
> full inventories, the complete endpoint and frontend-call tables, the full signal registry, the full prisma
> model list, and the end-to-end serving trace.

## Reader's map
- [TL;DR](#tldr) · [§1 Module inventory](#section-1) · [§2 Wiring (102 endpoints + 55 calls)](#section-2) ·
  [§3 Intelligence deep-dive](#section-3) · [§4 Status classification](#section-4) · [§5 Gap vs target](#section-5) ·
  [§6 Recommendations](#section-6) · [Verdict block](#verdict)

---
<a name="tldr"></a>
## TL;DR — the five facts that matter

1. **Two recommendation engines exist; they are different code, and the one users see is the OLDER one.**
   - **LIVE (serves users):** `recommendation/pipeline/recommendation-pipeline.service.ts` → `pipeline/ranking.service.ts`. 8-component weighted score, real personalization, **wired** to home/discover/favorites via `GET /recommendations`.
   - **FROZEN SHADOW (never reaches users):** `recommendation/intelligence/*` (`recommendation-shadow-scorer.ts`, `collective-signal.ts`, `taste-affinity.ts`, `recommendation-learning-proof.ts`) + the whole `recommendation/runtime-shadow/**` lab. `productUseEnabled:false` (`recommendation-decision.types.ts:134`); the shadow result is computed after the response and **discarded** (`recommendation-pipeline.service.ts:79`). **The recent ENGINE-PROOF / A4 / ablation / skill-decoupled sprints all modified this shadow stack — none of it changes what any user sees.**
2. **The app does not learn from rejection.** `applyNegativeFeedback` exists (`behavior-engine/signals/signal-calculator.service.ts:67-98`) but **no frontend control emits** `recommendation_dismiss` / `not_interested` / `recipe_skip` / `quick_exit`. The rejection events that *are* emitted — `mealplan_remove`, `mealplan_clear`, `shopping_item_remove` — produce **no negative signal** (their processors ignore them).
3. **Collective ("N users rejected this") is proof-only** — `collective-signal.ts` is called only by the offline proof harness; no per-recipe aggregate column, no job, no live call site.
4. **Ingredient-level dislike learning: not built. Context-conditioning (mealType × calorie/effort): shadow-only.**
5. **~53% of endpoints are orphaned** — 16 recommendation diagnostics, ~20 admin analytics endpoints, the entire Daily Briefing engine (`/briefing/*`), INE preview, the runtime-shadow lab controllers, and NotImplemented stubs.

---
<a name="section-1"></a>
## SECTION 1 — Full module inventory (every folder/file, by domain)

> Legend: **LIVE** = on a production request path · **INTERNAL** = engine reached via pipeline/processors, not HTTP · **PROOF/EVAL** = harness/simulation/`*.spec.ts` only · **LEGACY/SUPERSEDED** = replaced, kept for back-compat · **DEAD** = unreachable/NotImplemented.

### 1.1 `ai/` — AI Core v1 (LIVE; live LLM off by default)
**Framework:** `ai-core.types.ts` (BehavioralContextSnapshot, ModelProvider, Tool, guards, errors), `ai-core.module.ts` (DI bundle).
**Orchestration/chat:** `orchestrator/ai-orchestrator.service.ts` (single entry: snapshot→prompt-injection→cost→safety→model→nutrition-claim→`AICallLog`); `chat/chat-orchestration.service.ts` (`/ai/chat` via orchestrator); `chat/grounded-reply.service.ts` (**HARD allergy gate**, filters corpus before composition); `chat/chat-message.service.ts` (persists `ChatMessage`).
**Providers:** `providers/model-provider.factory.ts` (**safe by default**: stub unless `AI_PROVIDER=gemini && AI_LIVE_ENABLED=true && key`), `gemini-model.provider.ts` (only Gemini caller), `stub-model.provider.ts` (default).
**Guards:** `guards/prompt-injection.guard.ts`, `guards/ai-safety.guard.ts`, `guards/nutrition-claim.guard.ts` (deterministic, EN+FA).
**Context/facts:** `context/behavioral-context-snapshot.service.ts` (minimal, non-sensitive only); `facts/user-fact.service.ts` (rejects sensitive facts).
**Cost:** `cost/ai-cost-controller.service.ts`, `ai-cost-policy.ts`, `ai-cost-rate-catalog.ts`, `persisted-daily-budget.service.ts`, `spend-alert.service.ts`.
**Logging:** `logging/ai-call-log.service.ts` (audit row per call; no prompt/PII).
**Tools (8, allow-listed):** `tools/tool-registry.service.ts` + `search-recipes`, `explain-recommendation`, `get-user-food-context`, `log-ai-feedback`, `suggest-substitutions`, `match-pantry-recipes`, `explain-recipe-step`, `suggest-pairings`, `grounding-utils.ts`. `assist/ai-assist.service.ts` is the bounded entry (one tool, nutrition-guarded).
**LEGACY:** `ai.service.ts` + `personalization.service.ts` (legacy deterministic search; chat now via orchestrator; back-compat only).
**PROOF/EVAL:** `eval/ai-eval.harness.ts`, `eval/eval-cases.ts`, `eval/output-safety/**` (evaluator + harness + regression corpus), `eval/live-smoke/**`, `eval/pilot-readiness/**`, all `*.spec.ts`.

### 1.2 `analytics/` — event ingest + product intelligence (ingest LIVE)
`analytics.service.ts` (ingest: quality gate → `UserEvent` write → `EventRouter`), `analytics.module.ts`, `analytics.controller.ts`.
**Contract:** `event-envelope.schema.ts` (Canonical Event Envelope v2), `event-envelope-runtime-guard.ts` (shadow validation, off|shadow|strict), `event-envelope.ingest-gate.ts`, `event-taxonomy.ts` (80+ event types), `event-producer-inventory.ts`.
**Quality:** `event-quality.service.ts` (`DELIBERATE_SIGNALS` bypass bot heuristics for cook_complete/favorite_add/…).
**Enrichment:** `event-enrichment.service.ts` (async derived fields).
**Intelligence (ANALYTICS-L4-16):** `intelligence/analytics-intelligence.service.ts` + `funnel.ts`/`trends.ts`/`cohort.ts`. **Reachable only via admin endpoints the admin UI doesn't call (see §2).**
**Ops (OPS-L4-18):** `intelligence/ops-intelligence.service.ts` + `ops-metrics.ts` (daily cron).

### 1.3 `recommendation/` — the largest module (~80 files; majority specs/shadow)
**LIVE pipeline:** `pipeline/recommendation-pipeline.service.ts` (orchestrates), `pipeline/candidate-generator.ts` (8 sources: similar, embedding, collaborative, trending, health, seasonal, inventory, cold_start), `pipeline/ranking.service.ts` (**the live ranker**), `ranking-model/contribution-calculator.ts`, `explainability/explainability.service.ts`, `exposure/exposure-tracking.service.ts`.
**Evaluation (LIVE cron + offline):** `evaluation/recommendation-evaluator.service.ts` (daily), `recommendation-reward.service.ts`, `recommendation-metrics.service.ts`, `recommendation-eval.harness.ts` (offline).
**INTERNAL types/diagnostics:** `intelligence/recommendation-decision.types.ts`, `recommendation-exposure-attribution.ts`, `recommendation-outcome-attribution.ts`, `recommendation-why-engine.ts`.
**PROOF/SHADOW (does NOT serve users):** `intelligence/recommendation-shadow-scorer.ts`, `intelligence/collective-signal.ts`, `intelligence/taste-affinity.ts`, `intelligence/recommendation-learning-proof.ts`, `intelligence/recommendation-decision-qa-gate.ts`, `intelligence/recommendation-decision-simulation-fixtures.ts`, **and the entire `runtime-shadow/`** subtree: `control-plane/**` (A10), `lab/activation-review/**` (A14, ~16 files), `lab/execution/**` (A13, ~10 files), `lab/founder-review/**` (A12, ~9 files). Whole subtree comment: shadow runs beside live ranking, after response, result discarded, never wired.
**SUPERSEDED:** `recommendation.service.ts` (legacy quick service).
**DEAD/NotImplemented:** `recommendation.controller.ts` methods `build-snapshots`/`run-signal-detector`/`build-identity`/`lifestyle`/`embedding/:id`/`debug-features` throw `NotImplementedException`. `diagnostics.controller.ts` (16 admin endpoints, none called).

### 1.4 `behavior-engine/` — profile + signals + feature store (profile LIVE)
**Profile (LIVE, canonical):** `profile/read/profile-read.service.ts` (`getLivingUserProfile`, `getFoodDnaProjection`, `submitAnswer`); `profile/read/living-profile.ts` (`composeLivingUserProfile`, `maturityFor`); `profile/read/food-dna-projection.ts` (thin S2 projection, honest cold-start); `profile/read/profile.controller.ts` (`/profile`, `/profile/dna`, `/profile/next-question`, `/profile/answer`).
**Declared:** `profile/declared/declared-profile.builder.ts` + `declared-dimension-registry.ts` (23 dims, consent-gated, banded).
**Observed graph:** `profile/user-food-identity-graph.builder.ts` (SignalObservations → 11-dim graph), `profile/profile-dimension-aggregation.ts` (per-dim builders — **`ingredientAffinities`/`cuisineAffinities` left empty, v1 limitation, `:154`**).
**Reconciliation/safety:** `profile/reconciliation/profile-reconciliation.ts` (**allergies always win**), `profile/profile-conflict-resolution.ts`, `profile/profile-privacy-gate.ts`, `profile/profile-qa-gate.ts`, `profile/profile-readiness-contracts.ts` (`safeForProductUse:false` in v1).
**Signals:** `signals/signal-registry.ts` (**37 active signals**, §3.1), `signals/signal-calculator.service.ts` (writes `UserBehaviorSignal`, `applyNegativeFeedback`).
**Processors:** `processors/recipe.signal-processor.ts`, `meal-plan.signal-processor.ts`, `recommendation.signal-processor.ts`, `shopping.signal-processor.ts`.
**Routing:** `routing/event-router.service.ts`, `routing/processor.registry.ts`.
**Feature store (feeds LIVE ranker):** `feature-store/feature-store.service.ts` + snapshot builders.
**SUPERSEDED:** `behavior-engine.service.ts` (legacy churn/consistency scores; not on active path). `behavior-engine.controller.ts` (empty stub).

### 1.5 `recipes/` — recipe data + intelligence + safety (LIVE)
`recipes.service.ts` (CRUD, `findOne`, `presentRecipe`), `recipes.controller.ts`.
**Intelligence/safety:** `intelligence/recipe-fit.ts` (`assessRecipeFit` — **HARD allergen veto** `:122-126`; `recipeSafetyCheck` `:59-80`), `intelligence/recipe-integrity.ts` (`analyzeRecipeIntegrity` — resolves vs 1008-item dictionary, derives allergens, normalizes vocab), `intelligence/recipe-richness.service.ts` (`/recipes/:id/full`), `intelligence/recipe-richness-mapping.spec.ts` (S3 proof).
**Search:** `search/recipe-search.service.ts` (TF-IDF + similar; reuses fit; `FIT_MULTIPLIER` avoid_allergen=0.05). **No parallel recommender.**

### 1.6 `meal-plans/` — weekly planning (LIVE)
`planner/meal-plan-planner.service.ts` (`/meal-plans/propose`: profile→integrity→fit→**HARD allergy exclude `:58-60`**→`deriveCourse`→generate), `planner/meal-plan-generator.ts` (proposes only, variety/effort/pantry), `planner/course.ts` (**S5 course gate**, `deriveCourse` `:37-53` — sauce/dessert/beverage never a main), `meal-plan-course-gate.spec.ts` (real-corpus proof).
**SUPERSEDED:** `meal-plans.service.ts::generateSmartPlan` (legacy basic filter; `/meal-plans/generate` still points here). Slot CRUD (`addMealSlot`, `removeMealSlot` `:189-191`) is LIVE.

### 1.7 Other domains (all LIVE unless noted)
`auth/` (JWT+bcrypt, `roles.guard.ts`, `roles.decorator.ts`) · `users/` (profile/prefs/consent + **GDPR** `erasure/` + `export/`) · `favorites/` (idempotent) · `shopping-list/` (PLANNER-L4-09; aggregates plan→list via `IngredientResolverService` + household scale) · `notifications/` (+ `ine/` Integrated Notification Engine: `ine.service.ts`, `ine-pipeline.ts`, `ine-simulator.ts`, `notification-triggers.ts`; dry-run) · `briefing/` (Daily Briefing HABIT-L4-12; composition-only — **NOT wired**, §2) · `gamification/` (server-authoritative from `cook_complete`; `engine/` streak/achievements/mastery) · `embeddings/recipe-embedding.service.ts` (deterministic content vector, used by ranking) · `experimentation/experiment-engine.service.ts` (A/B weights for ranker, bounded) · `ingredients/ingredient-resolver.service.ts` (free-text→ingredientId, boot-time index) · `lifestyle/lifestyle-graph.builder.ts` (persona scores) · `outcomes/` (health/adherence/behavior crons → `UserOutcome`) · `governance/` (insights + `data-retention.service.ts`) · `retention/retention.service.ts` (**dry-run only**, destructive gated) · `support/` · `admin/` (proxies analytics/ops) · `common/` (global exception filter + user serializer) · `shared/constants.ts` (`CONCEPT_MAP` FA↔EN) · `utils/date.utils.ts` (Iranian week = Saturday) · `config/env.validation.ts` (fail-fast boot guard) · `security/` (**spec-only** compliance proofs) · `prisma/` (service+module) · `main.ts`/`app.module.ts` (bootstrap).
**scripts/:** `recipes/import-phase-one-200-v0-6-1.js` (safe upsert importer), `data/phase-one-recipes.js` (mapper), `recipes/backfill-structured-richness-v0-6-1.js` (S3), `data/import-ingredients.js`/`import-aliases.js`, validators, `security/*-dry-run.cjs`.

---
<a name="section-2"></a>
## SECTION 2 — Frontend wiring map

**102 endpoints enumerated** (6 public · 71 jwt · 25 admin). **Web app calls ≈48 distinct endpoints.** ⇒ **≈54 ORPHANED (~53%)**. (Plus the `runtime-shadow/**` lab registers further controllers beyond the 102, all unreached.)

### 2.1 Complete endpoint inventory (102)
| Method · Path | Controller:line | Service | Guard | Wired? |
|---|---|---|---|---|
| POST `/analytics/event` | analytics.controller.ts:24 | analyticsService.trackEvent | jwt | ✅ useAnalytics |
| POST `/auth/register` | auth.controller.ts:13 | authService.register | public | ✅ AuthContext |
| POST `/auth/login` | auth.controller.ts:19 | authService.login | public | ✅ AuthContext |
| GET `/favorites` | favorites.controller.ts:10 | getFavorites | jwt | ✅ favorites |
| POST `/favorites/:recipeId` | favorites.controller.ts:15 | addFavorite | jwt | ✅ favorites |
| DELETE `/favorites/:recipeId` | favorites.controller.ts:20 | removeFavorite | jwt | ✅ favorites |
| GET `/feature-vector` | diagnostics.controller.ts:30 | featureStore.getFeatureVector | admin | ❌ |
| GET `/signals` | diagnostics.controller.ts:47 | userBehaviorSignal.findMany | admin | ❌ |
| GET `/outcomes` | diagnostics.controller.ts:64 | userOutcome.findMany | admin | ❌ |
| GET `/feature-importance` | diagnostics.controller.ts:81 | featureContributionLog.findMany | admin | ❌ |
| GET `/lifestyle` | diagnostics.controller.ts:101 | aggregated profile | admin | ❌ |
| GET `/recommendation-quality` | diagnostics.controller.ts:144 | evaluator.getLatestRecommendationQuality | admin | ❌ |
| GET `/recommendation-reward` | diagnostics.controller.ts:156 | evaluator.getLatestRecommendationReward | admin | ❌ |
| GET `/attribution` | diagnostics.controller.ts:168 | evaluator.getRecommendationAttribution | admin | ❌ |
| GET `/exposure-memory` | diagnostics.controller.ts:180 | exposureTracking.getExposureMemory | admin | ❌ |
| GET `/summary` | diagnostics.controller.ts:193 | aggregated | admin | ❌ |
| GET `/metrics` | diagnostics.controller.ts:221 | metrics.getLatestMetrics | admin | ❌ |
| GET `/governance` | diagnostics.controller.ts:241 | governanceInsights.getGovernanceSummary | admin | ❌ |
| GET `/report` | diagnostics.controller.ts:253 | aggregated | admin | ❌ |
| GET `/review-report` | diagnostics.controller.ts:271 | aggregated | admin | ❌ |
| GET `/support/tickets` | support.controller.ts:12 | getUserTickets | jwt | ✅ |
| GET `/support/tickets/:id` | support.controller.ts:17 | getTicketById | jwt | ✅ |
| POST `/support/tickets` | support.controller.ts:22 | createTicket | jwt | ✅ |
| POST `/support/tickets/:id/replies` | support.controller.ts:27 | addReply | jwt | ✅ |
| PATCH `/support/tickets/:id/close` | support.controller.ts:32 | closeTicket | jwt | ✅ |
| POST `/upload/avatar` | upload.controller.ts:10 | multer | jwt | ❌ (no caller found) |
| GET `/users/me` | users.controller.ts:14 | findById | jwt | ✅ |
| PATCH `/users/me` | users.controller.ts:20 | updateProfile | jwt | ✅ |
| GET `/users/preferences` | users.controller.ts:28 | getPreferences | jwt | ✅ |
| PUT `/users/preferences` | users.controller.ts:34 | updatePreferences | jwt | ✅ |
| POST `/users/consent` | users.controller.ts:41 | grantConsent | jwt | ✅ |
| GET `/users/me/export` | users.controller.ts:49 | exportUser | jwt | ✅ settings |
| DELETE `/users/me` | users.controller.ts:56 | deleteUser | jwt | ✅ settings |
| POST `/ai/chat` | ai.controller.ts:18 | chatOrchestration.handleChat | jwt | ✅ assistant |
| POST `/ai/substitutions` | ai.controller.ts:41 | assist.substitutions | jwt | ✅ ai-chat |
| POST `/ai/pantry-match` | ai.controller.ts:48 | assist.pantryMatch | jwt | ✅ ai-chat |
| GET `/ai/recipes/:id/technique` | ai.controller.ts:55 | assist.technique | jwt | ✅ cook |
| POST `/ai/pairings` | ai.controller.ts:62 | assist.pairings | jwt | ✅ ai-chat |
| GET `/recipes` | recipes.controller.ts:18 | findAll | public | ✅ |
| GET `/recipes/search` | recipes.controller.ts:35 | searchService.search | public | ✅ discover |
| GET `/recipes/:id/similar` | recipes.controller.ts:49 | searchService.similar | public | ❌ (no caller) |
| GET `/recipes/my` | recipes.controller.ts:54 | getMyRecipes | jwt | ✅ |
| GET `/recipes/:id` | recipes.controller.ts:60 | findOne | public | ✅ recipe/[id] |
| GET `/recipes/:id/full` | recipes.controller.ts:70 | richness.getRichRecipe | jwt | ✅ recipe/[id] |
| POST `/recipes` | recipes.controller.ts:76 | create | jwt | ✅ add-recipe |
| PATCH `/recipes/:id` | recipes.controller.ts:82 | update | jwt | ❌ (no caller) |
| GET `/meal-plans` | meal-plans.controller.ts:14 | getCurrentPlan | jwt | ✅ plan |
| POST `/meal-plans` | meal-plans.controller.ts:20 | savePlan | jwt | ✅ |
| POST `/meal-plans/slots` | meal-plans.controller.ts:26 | addMealSlot | jwt | ✅ plan, recipe |
| DELETE `/meal-plans/slots/:dayOfWeek/:mealType` | meal-plans.controller.ts:32 | removeMealSlot | jwt | ✅ plan |
| POST `/meal-plans/generate` | meal-plans.controller.ts:41 | generateSmartPlan (legacy) | jwt | ✅ planner hook |
| POST `/meal-plans/propose` | meal-plans.controller.ts:51 | planner.proposePlan | jwt | ✅ plan |
| GET `/shopping-list` | shopping-list.controller.ts:12 | getList | jwt | ✅ |
| POST `/shopping-list/items` | shopping-list.controller.ts:17 | addItems | jwt | ✅ |
| POST `/shopping-list/from-plan` | shopping-list.controller.ts:27 | buildFromPlan | jwt | ✅ |
| PATCH `/shopping-list/items/:id` | shopping-list.controller.ts:32 | toggleItem | jwt | ✅ |
| DELETE `/shopping-list/items/:id` | shopping-list.controller.ts:37 | removeItem | jwt | ✅ |
| GET `/notifications` | notifications.controller.ts:14 | getUserNotifications | jwt | ✅ |
| GET `/notifications/ine/preview` | notifications.controller.ts:23 | ine.previewForUser | jwt | ❌ |
| POST `/notifications/generate` | notifications.controller.ts:28 | generateSmartSuggestion | jwt | ⚠️ stale hook only |
| PATCH `/notifications/:id/read` | notifications.controller.ts:33 | markAsRead | jwt | ✅ |
| DELETE `/notifications/:id` | notifications.controller.ts:38 | deleteNotification | jwt | ⚠️ stale hook only |
| GET `/gamification/me` | gamification.controller.ts:15 | getSummary | jwt | ✅ |
| GET `/briefing/today` | briefing.controller.ts:15 | getTodayBriefing | jwt | ❌ **whole engine unsurfaced** |
| POST `/briefing/feedback` | briefing.controller.ts:20 | logFeedback | jwt | ❌ |
| GET `/admin/dashboard` | admin.controller.ts:14 | getDashboardStats | admin | ❌ |
| GET `/admin/tickets` | admin.controller.ts:17 | getAllTickets | admin | ❌ |
| POST `/admin/tickets/:id/respond` | admin.controller.ts:22 | respondToTicket | admin | ❌ |
| PATCH `/admin/tickets/:id/status` | admin.controller.ts:27 | updateTicketStatus | admin | ❌ |
| GET `/admin/recipes` | admin.controller.ts:32 | getAllRecipes | admin | ❌ |
| PATCH `/admin/recipes/:id/approve` | admin.controller.ts:37 | updateRecipeStatus | admin | ❌ |
| PATCH `/admin/recipes/:id/reject` | admin.controller.ts:40 | updateRecipeStatus | admin | ❌ |
| GET `/admin/users` | admin.controller.ts:45 | getAllUsers | admin | ❌ |
| GET `/admin/analytics/events` | admin.controller.ts:50 | getRecentEvents | admin | ❌ |
| GET `/admin/analytics/stats` | admin.controller.ts:67 | getAnalyticsStats | admin | ❌ |
| GET `/admin/analytics/search-queries` | admin.controller.ts:70 | getTopSearchQueries | admin | ❌ |
| GET `/admin/analytics/meal-planning` | admin.controller.ts:73 | getMealPlanningStats | admin | ❌ |
| GET `/admin/analytics/ai-interaction` | admin.controller.ts:76 | getAIInteractionStats | admin | ❌ |
| GET `/admin/analytics/user-stats` | admin.controller.ts:79 | getUserStats | admin | ✅ admin |
| GET `/admin/analytics/recipes-stats` | admin.controller.ts:82 | getRecipeStats | admin | ❌ |
| GET `/admin/analytics/shopping` | admin.controller.ts:85 | getShoppingAnalytics | admin | ❌ |
| GET `/admin/analytics/behavior-profiles` | admin.controller.ts:88 | getBehaviorProfiles | admin | ❌ |
| GET `/admin/analytics/page-views` | admin.controller.ts:91 | getPageViewStats | admin | ❌ |
| GET `/admin/analytics/system-health` | admin.controller.ts:94 | getSystemHealth | admin | ❌ |
| GET `/admin/analytics/funnels` | admin.controller.ts:98 | getFunnels | admin | ❌ |
| GET `/admin/analytics/trends` | admin.controller.ts:101 | getTrends | admin | ✅ admin |
| GET `/admin/analytics/cohorts` | admin.controller.ts:104 | getCohorts | admin | ❌ |
| GET `/admin/analytics/product-intelligence` | admin.controller.ts:107 | getProductIntelligence | admin | ✅ admin |
| GET `/admin/ops/health` | admin.controller.ts:111 | getOpsHealth | admin | ✅ admin |
| GET `/admin/ops/safety-compliance` | admin.controller.ts:114 | getOpsSafetyCompliance | admin | ✅ admin |
| GET `/admin/ops/economics` | admin.controller.ts:117 | getOpsEconomics | admin | ❌ |
| GET `/recommendations` | recommendation.controller.ts:34 | pipeline.getRecommendations | jwt | ✅ home/discover/favorites |
| POST `/recommendations/impression` | recommendation.controller.ts:41 | exposureTracking.trackExposures | jwt | ✅ useImpressionObserver |
| POST `/recommendations/build-snapshots` | recommendation.controller.ts:114 | NotImplemented | admin | ❌ DEAD |
| POST `/recommendations/run-signal-detector` | recommendation.controller.ts:121 | NotImplemented | admin | ❌ DEAD |
| POST `/recommendations/build-identity` | recommendation.controller.ts:128 | NotImplemented | admin | ❌ DEAD |
| GET `/recommendations/lifestyle` | recommendation.controller.ts:135 | NotImplemented | jwt | ❌ DEAD |
| GET `/recommendations/compare` | recommendation.controller.ts:141 | ranking.rankWithFeatureVector | jwt | ❌ |
| GET `/recommendations/embedding/:recipeId` | recommendation.controller.ts:197 | NotImplemented | admin | ❌ DEAD |
| GET `/recommendations/debug-features` | recommendation.controller.ts:205 | NotImplemented | admin | ❌ DEAD |
| GET `/recommendations/test-penalty/:recipeId` | recommendation.controller.ts:214 | exposureTracking.getPenalty | admin | ❌ |
| GET `/profile` | profile.controller.ts:18 | getLivingUserProfile | jwt | ✅ home/profile/NavDrawer |
| GET `/profile/dna` | profile.controller.ts:28 | getFoodDnaProjection | jwt | ✅ food-dna |
| GET `/profile/next-question` | profile.controller.ts:34 | getNextQuestion | jwt | ✅ food-dna |
| POST `/profile/answer` | profile.controller.ts:40 | submitAnswer | jwt | ✅ food-dna |
| (stub) `/behavior-engine` | behavior-engine.controller.ts:7 | none | admin | ❌ empty stub |

**Orphaned clusters:** recommendation diagnostics (16) · admin analytics/ops (~20 of 25) · briefing (2) · INE preview (1) · recommendation NotImplemented (7) · `/recipes/:id/similar`, `PATCH /recipes/:id`, `/upload/avatar` (no caller) · `/notifications/generate` + `DELETE /notifications/:id` (only in a stale `useNotificationsQuery` hook, not the live screen).

### 2.2 Frontend → backend call map (the 48 wired, with callers)
Auth/users: `/auth/login`,`/auth/register` (AuthContext.jsx:30,46); `/users/me` (AuthContext:19, settings/useSettings:30, profile/useProfile:38, home/useHomeData:28); `/users/me/export` (useSettings:118); `/users/preferences` GET (useSettings:31, useProfile:41, discover/useDiscovery:111) / PUT (useSettings:64, onboarding/useOnboarding:134, hooks/usePreferencesQuery:43); `PATCH /users/me` (useProfileQuery:46); `/users/consent` (useSettings:104, useOnboarding:132); `DELETE /users/me` (useSettings:136).
Profile/DNA: `/profile` (useProfile:39, useHomeData:30, NavDrawer:76); `/profile/dna` (useFoodDna:20); `/profile/next-question` (useFoodDna:30); `POST /profile/answer` (useFoodDna:40).
Recipes: `/recipes` (recipes/page:26, useHomeData:32, useDiscovery:101, useRecipes:7); `/recipes/:id` (useRecipeDetail:29); `/recipes/:id/full` (useRecipeDetail:28); `/recipes/search` (useDiscovery:118); `/recipes/my` (useProfileQuery:31); `POST /recipes` (AddRecipeContext:62).
Recommendations: `/recommendations` (useHomeData:29, useFavorites:31, useDiscovery:106); `POST /recommendations/impression` (useImpressionObserver:31).
Meal-plans: `/meal-plans` (useMealPlan:38, useMealPlannerQuery:13, useProfileQuery:26); `POST /meal-plans` (useMealPlannerQuery:50); `/meal-plans/propose` (useMealPlan:75); `/meal-plans/generate` (useMealPlannerQuery:40); `POST /meal-plans/slots` (recipe/[id]/page:216, useMealPlan:111,129, useMealPlannerQuery:22); `DELETE /meal-plans/slots/:d/:m` (useMealPlan:98, useMealPlannerQuery:31).
Favorites: `/favorites` (useFavorites:15, useFavoritesQuery:6, useProfileQuery:21); `POST/DELETE /favorites/:recipeId` (useFavorites:53,42; useFavoritesQuery:26,32).
Shopping: `/shopping-list` (useShopping:59); `POST /items` (useShopping:109, useShoppingListQuery:23); `/from-plan` (useShopping:122); `PATCH/DELETE /items/:id` (useShopping:89,98; useShoppingListQuery:33,43).
Notifications: `/notifications` (useNotifications:45, useNotificationsQuery:12); `PATCH /:id/read` (useNotifications:66,77; useNotificationsQuery:28).
Gamification: `/gamification/me` (useProfile:40, useHomeData:31, useCook:38, useAchievements:30).
AI: `/ai/chat` (assistant/useAssistant:37, ai-chat/aiEngine:34); `/ai/substitutions` (aiEngine:8); `/ai/pantry-match` (aiEngine:13); `/ai/pairings` (aiEngine:18); `GET /ai/recipes/:id/technique` (useCook:70, aiEngine:23).
Analytics/admin/support: `POST /analytics/event` (useAnalytics:9); `/admin/ops/health|safety-compliance`, `/admin/analytics/user-stats|trends|product-intelligence` (useAdmin:23-27); `/support/tickets*` (useSupportQuery).

---
<a name="section-3"></a>
## SECTION 3 — Intelligence / personalization deep-dive

### 3.1 The 37 active signals (`signal-registry.ts:107-181`)
| Family | Signals · allowed events · keyed-to |
|---|---|
| **taste (6)** | `ingredient_affinity` (recipe_saved/favorite_add/recommendation_save/cook_complete → ingredient) · `ingredient_avoidance` (recipe_dismissed/recommendation_dismiss/not_interested → ingredient) · `cuisine_affinity` (view/favorite/save/cook → cuisine) · `cuisine_exploration` · `flavor_pattern` · `repetition_preference` |
| **effort/skill (5)** | `quick_meal_preference` · `low_prep_tolerance` · `complex_recipe_readiness` · `skill.cook_completion_growth` *(planned)* · `skill.recipe_step_dropoff` |
| **routine (5)** | `meal_time_pattern` · `weekly_planning_pattern` · `shopping_day_pattern` · `late_night_decision` · `weekend_cooking_pattern` |
| **recommendation (6)** | `save_affinity` (+) · `dismiss_avoidance` (−) · `click_curiosity` · `cook_conversion` · `exposure_fatigue` · `repeat_success` |
| **notification (5)** | `open_affinity` (+) · `dismiss_fatigue` (−) · `quiet_hours_inferred` · `suppression_candidate` *(planned)* · `timing_fit` *(planned)* |
| **planner/grocery (6)** | `autofill_acceptance` · `plan_completion_intent` · **`plan_abandonment` (−, events mealplan_clear/mealplan_remove)** · `grocery.merge_preference` · `grocery.list_completion` · **`grocery.friction_signal` (−, events shopping_item_remove)** |
| **ai (4)** | `help_seeking_pattern` · `explanation_depth_preference` · `feedback_positive` (+) · `feedback_negative` (−) |
| **onboarding (5)** | `taste_seed` · `effort_seed` · `skill_seed` · `notification_preference_seed` *(planned)* · `exploration_seed` *(planned)* |

**Ingest flow:** `useAnalytics.js:6-24` (`trackEvent` → `POST /analytics/event`) → `analytics.service.ts` (quality gate :70 → `userEvent.create` :88 → `eventRouter.route` :94) → `processor.registry.ts:27-31` → domain processor → `SignalObservation` / `UserBehaviorSignal`.
**Confirmed emitted by the FE:** `recipe_view`, `favorite_add`, `mealplan_add`, `mealplan_remove`, `cook_complete`, `ai_message_send`, `onboarding_answered`, `shopping_item_add/toggle`, `recommendation_impression`. **Keyed to user + recipe** (cuisine/ingredient *derived* from the recipe).

### 3.2 Negative feedback — the exact code
**Path that works (if events arrived)** — `recommendation.signal-processor.ts:44-57`:
```
recommendation_dismiss | not_interested  → applyNegativeFeedback(userId, recipeId, -0.5)
recommendation_ignore  | recipe_skip     → applyNegativeFeedback(... -0.2)
quick_exit                                → applyNegativeFeedback(... -0.3)
```
→ `signal-calculator.service.ts:67-98`: loads the recipe (ingredients/categories/diet), extracts a **fixed coarse signal set** (`likes_chicken/beef/spicy/cheese/seafood/eggplant/mushroom`, `likes_grilled/fried/stew/baked/steamed`, `prefers_vegetarian/keto`; `:137-167`), and for each **decrements `UserBehaviorSignal.value` (`max(0, value+factor)`) and ×0.9 confidence**. Keyed: **per-user, per coarse signal** (composite key `userId_signalName`), recipe-derived — **not** true per-ingredient, not mealType, not cuisine.
**Why it's dormant:** no audited screen renders a dismiss/not-interested/skip affordance — home/discover/favorites render `RecipeCard`s with save + open only. ⇒ those events are essentially never emitted in production. *(Flagged for confirmation; no emitter found.)*
**Rejections that ARE emitted but produce no learning:** `meal-plan.signal-processor.ts:13-32` handles only `mealplan_add` (→ positive `consistent_meal_planner` 0.9) and writes a **flat `SignalObservation` weight 1.0** for *all* mealplan events (add/remove/clear identical); `mealplan_remove`/`mealplan_clear` get **no negative signal** despite `planner.plan_abandonment` being defined. `shopping_item_remove` → shopping processor handles only `_add` (`grocery.friction_signal` unprocessed). The slot DELETE is an honest row delete (`meal-plans.service.ts:189-191`).
**"Planned/saved but not cooked": not built** — no detector compares saves/plans against `cook_complete`.

### 3.3 Collective — proof-only
`collective-signal.ts` (`buildCollectiveModel`/`collectiveScore`/`blendCollective`) imported **only** by `recommendation-learning-proof.ts:21` (offline harness). No per-recipe aggregate column in `schema.prisma` (the `Recipe` model has no popularity/collective/score field), **no cron/job**, **no live call site**. The live `popularity` component is computed per-request in `ranking.service.ts` (`calculatePopularityScore` = recent `recipe_view` count + `favoriteRecipe`×2, ÷250) — count/recency-based, **reject-blind**, weight only 0.04.

### 3.4 What reaches the user TODAY — full live serving trace
`GET /recommendations?limit=N` → `RecommendationController.getRecommendations` (recommendation.controller.ts:34) → `RecommendationPipelineService.getRecommendations` (recommendation-pipeline.service.ts:31-82):
1. **`featureStore.buildFeatureVector(userId)`** (:32) → `snapshotBuilder.buildAll` upserts UserRetention/Identity/Health/Engagement snapshots; assembles a `Record<string,number>` from: `signal_${name}=value×confidence` (UserBehaviorSignal), `dim_${key}` (UserIdentityDimension), retention/outcome fields, `signal_pref_diet/skill/budget`, and UserBehaviorProfile (favoriteFoods/dislikedFoods/cookingSkill…). (feature-store.service.ts:12-165)
2. **`candidateGenerator.generate(userId, limit*5)`** (:34) → 8 sources (similar/embedding/collaborative/trending/health/seasonal/inventory/cold_start).
3. **`rankingService.rank(userId, candidateIds)`** (:39) → `ranking.service.ts:118-126`: gets `experimentEngine.getWeights(userId)` (A/B or default), loads recipes, and per recipe computes **8 components**: `tasteAffinity, behaviorFit, outcomeFit, novelty, popularity, recency, recipeUnderstanding, ingredientIntelligence`. **Default weights (`:79-88`): tasteAffinity 0.27, behaviorFit 0.22, outcomeFit 0.17, recipeUnderstanding 0.10, novelty 0.09, ingredientIntelligence 0.09, popularity 0.04, recency 0.02.** `rawScore = Σ score×weight` (`:211`); `finalScore = max(0, rawScore − exposurePenalty)` (`:216`); maturity blend tilts to content/popularity when `_data_behavioralReliability < 0.65`.
4. **Sort `b.finalScore − a.finalScore`** then `applyDiversity` (mealType −0.03, diet −0.02) (`:240`).
5. **`logFeatureContributions(top5)`** → writes `FeatureContributionLog` (`:840-871`).
6. **`maybeRunShadowRuntime(...)`** (`:79`) — shadow runs **after** the response, isolated try/catch, **result discarded**.
7. Returns each item with `scores`, `scoreBreakdown`, `contributions`, `matchedSignals`, `explanation`, `dataMaturity`, `trackingPolicy`.
**Impression:** `POST /recommendations/impression` (guard viewportMs≥1000 && visibleRatio≥0.5) → `exposure-tracking.service.ts:14-17` writes `RecommendationExposure` + a `recommendation_impression` `UserEvent`.
**Frozen flip:** `productUseEnabled` is a type-literal `false` (`recommendation-decision.types.ts:134`); A10 QA gate asserts `productUseEnabled===false && liveRankingChangedForUser===false` (`recommendation-shadow-a10-qa-gate.ts:34`). Amendment 2 (A2.2 freeze) = `DECISION_LOG.md` D11, **PROPOSED, pending founder ratification**. **The freeze applies to the SHADOW stack — the live RankingService is not frozen and does rank live.**

### 3.5 Ingredient-level & context-conditioned learning
- **Ingredient-level:** `taste-affinity.ts:31-55` computes top-N **positive** ingredient affinities from cook/save/view × recipe metadata — but it is **shadow-only** (imported only by `recommendation-shadow-scorer.ts:23`), and the identity graph leaves affinities empty (`profile-dimension-aggregation.ts:154`). Live ranker uses a heuristic `ingredientIntelligence` (token/metadata match), not learned affinity. **Dislike inference ("repeated reject of lentil dishes → down-rank lentils"): NOT BUILT.**
- **Context-conditioned:** weekday lean `desiredEffort = clamp01(0.2 + 0.6·(1−quick01) + 0.2·complex01 − (weekday?0.1:0))` (`recommendation-shadow-scorer.ts:109`) and mealSlot match (`:130-131`) exist **only in the shadow scorer**; the live `RankingService.rank()` takes **no context parameter**. MealType×{calorie,prep,cuisine,richness}: **NOT BUILT.**

### 3.6 Prisma models (38) — written-live vs schema-only
**Written on live paths:** User, UserPreference, Allergy/Cuisine/HealthGoal (+ UserAllergy/Cuisine/HealthGoal), Recipe, Ingredient, RecipeIngredient, RecipeStep, Nutrition, SearchTerm, FavoriteRecipe, MealPlan, MealSlot, ShoppingList/ShoppingItem, Notification, SupportTicket/TicketReply, UserSession, **UserEvent**, UserBehaviorProfile, **SignalObservation**, **UserBehaviorSignal**, UserIdentityDimension, UserBehaviorTimeline, UserFeatureVector, UserFeature, UserOutcome, User{Retention,Identity,Health,Engagement}Snapshot, **RecommendationExposure** (impression), **FeatureContributionLog** (serve), Experiment/ExperimentAssignment, AICallLog, AiSpendAlert, ChatMessage, UserFact, UserStreak/UserAchievement/UserProgress/GamificationEvent, and the GDPR ledgers (UserAuditLog, DataAccessLog, ConsentLog, ErasureEvent, PreferenceHistory).
**Schema-only (defined, no live writer):** `RecommendationAttributionEvent`, `RecommendationMetrics`, `RecommendationShadowTrace` (shadow, default-off).

---
<a name="section-4"></a>
## SECTION 4 — Status classification (per capability)

| Capability | Status | Evidence |
|---|---|---|
| Live recommendation ranking (8-component) | **BUILT+WIRED+LIVE** | ranking.service.ts:79-88,216,240; `/recommendations` wired |
| Candidate generation (8 sources) | BUILT+WIRED+LIVE | candidate-generator.ts |
| Exposure penalty + impression tracking | BUILT+WIRED+LIVE | exposure-tracking.service.ts |
| Feature vector (signals/snapshots/profile) | BUILT+WIRED+LIVE | feature-store.service.ts:12-165 |
| Living profile / Food DNA / declared answers | BUILT+WIRED+LIVE | profile-read.service.ts; `/profile*` |
| Allergy HARD filter (fit/integrity/planner/search) | BUILT+WIRED+LIVE | recipe-fit.ts:122-126; meal-plan-planner.service.ts:58-60 |
| Recipe richness `/recipes/:id/full` + S3 sections | BUILT+WIRED+LIVE | recipe-richness.service.ts |
| Meal-plan propose (course-gated, fit-ranked) | BUILT+WIRED+LIVE | meal-plan-planner.service.ts; `/propose` |
| Course gate (S5) | BUILT+WIRED+LIVE | course.ts:37-53 |
| Gamification (server-authoritative) | BUILT+WIRED+LIVE | gamification.service.ts |
| AI grounded assistant + 3 guards | BUILT+WIRED+LIVE (LLM stub default) | orchestrator; `/ai/*` |
| Signal ingest → UserBehaviorSignal | BUILT+WIRED+LIVE (partial event coverage) | analytics.service.ts:94; processors |
| Shopping-list sync from plan | BUILT+WIRED+LIVE | shopping-list.service.ts |
| Outcomes/analytics/ops crons | BUILT+LIVE (cron) | outcomes/*, analytics/intelligence/*, ops |
| GDPR export/erasure/consent/retention | BUILT+WIRED (retention dry-run only) | users/erasure, users/export, retention.service.ts |
| **Negative feedback (applyNegativeFeedback)** | **BUILT + NOT WIRED (dormant)** | path exists; no FE emitter (§3.2) |
| **mealplan/shopping rejection → learning** | **BUILT (vocab) + NOT PROCESSED** | registry defines; processors ignore |
| **Shadow scorer / collective / taste-affinity / learning-proof** | **BUILT + FROZEN/PROOF-ONLY** | productUseEnabled:false; discarded (:79) |
| **Runtime-shadow A10/A12/A13/A14 lab** | **PROOF-ONLY** | whole subtree, result discarded |
| **Recommendation diagnostics (16)** | **BUILT + NOT WIRED** | diagnostics.controller.ts |
| **Admin analytics/ops (most)** | **BUILT + NOT WIRED** | 5 of 25 called (useAdmin.js) |
| **Daily Briefing engine** | **BUILT + NOT WIRED** | `/briefing/*` uncalled |
| **INE preview** | **BUILT + NOT WIRED** | `/notifications/ine/preview` |
| `behavior-engine.service.ts`, `recommendation.service.ts`, `generateSmartPlan` | **SUPERSEDED** | replaced by graph / pipeline / planner |
| Recommendation NotImplemented endpoints (7) | **DEAD** | throw NotImplementedException |
| `RecommendationAttributionEvent`, `RecommendationMetrics`, `RecommendationShadowTrace` | BUILT (schema) + NOT WRITTEN live | no live writer |
| `/recipes/:id/similar`, `PATCH /recipes/:id`, `/upload/avatar` | BUILT + NOT WIRED | no FE caller |

---
<a name="section-5"></a>
## SECTION 5 — Gap vs the TARGET (Food Intelligence)

| # | Target | Verdict | Reason (evidence) |
|---|---|---|---|
| 1 | Ingredient-level implicit dislike learning (soft, ≠ allergies) | **MISSING** | only positive top-N affinities, shadow-only (taste-affinity.ts); dislike inference absent; applyNegativeFeedback dormant + coarse |
| 2 | Context × attribute preference (mealType × calorie/prep/cuisine/richness; weekday/weekend) | **PARTIAL (shadow-only)** | weekday + mealSlot in shadow scorer (:109,:130); live ranker context-blind; attribute conditioning not built |
| 3 | "Planned but not cooked" (per-user soft-negative + collective realism) | **MISSING** | no save/plan-vs-cook detector; collective proof-only |
| 4 | Behavioral course/slot appropriateness from collective reject-by-slot | **PARTIAL** | S5 course gate is rule/metadata-based (works); no *learned* reject-by-slot signal |
| 5 | Collective per-recipe/ingredient/mealType aggregate ("N rejected → calibrated score") | **MISSING (proof-only)** | collective-signal.ts proof-only; no aggregate column/job; live popularity is count/recency, reject-blind |
| 6 | Confidence + explainability + user-correctable inferred prefs | **PARTIAL** | live recs explain (contributions/matchedSignals/why-engine) + Food-DNA surfaces DNA; but no "that's wrong" correction UI |
| 7 | Two-speed learning (fast per-user live; slow collective at pilot) | **PARTIAL** | fast per-user = live RankingService (real); slow collective half is proof-only, not separated-and-live |
| 8 | Cold-start (declared prefs + content similarity until signals) | **PRESENT** | maturity blend <0.65 tilts to content/popularity; onboarding seeds declared profile |

**Score: 1 present · 4 partial · 3 missing.**

---
<a name="section-6"></a>
## SECTION 6 — Claude Code's own recommendations

**The uncomfortable headline (stated plainly):** the recommendation *intelligence* that recent sprints invested in — the shadow scorer, collective signal, taste-affinity, the ENGINE-PROOF learning curves, the effort/skill fix, the skill-decoupled validation — is a **parallel shadow stack that does not serve users.** Users get the older `RankingService`. Decide the relationship between these two engines before building more, or we keep proving an engine that isn't shipped.

**CUT (dead/redundant — flags only, no action taken):** `behavior-engine.service.ts`, `recommendation.service.ts`, `MealPlansService.generateSmartPlan`; the 7 NotImplemented recommendation routes; consider archiving the `runtime-shadow/**` A10/A12/A13/A14 lab (~50 files, all proof) to a branch pre-pilot.

**WIRE (built-but-orphaned, high value/low risk):**
1. **A "not interested / dislike" control on recipe cards** — single highest-leverage wire in the app; it *activates the already-built `applyNegativeFeedback` → UserBehaviorSignal → live RankingService* path that is sitting dormant.
2. **Daily Briefing** (`/briefing/today`) — a whole composed habit-loop with no screen.
3. **Admin analytics/ops** — ~20 endpoints compute real numbers; admin UI surfaces 5.

**Safe build order for the missing intelligence (no frozen-flip, no allergy change):**
1. Emit the rejections we already model (FE dismiss control) + make `meal-plan`/`shopping` processors handle `*_remove`/`*_clear` into `plan_abandonment`/`friction_signal`. Additive; feeds the *live* ranker.
2. Ingredient-level soft taste (decompose `applyNegativeFeedback` from the coarse fixed set to real per-ingredient soft scores, strictly out of the allergy path); add as a live feature.
3. "Saved/planned but not cooked" detector (deterministic over MealSlot/FavoriteRecipe vs cook_complete).
4. Context-conditioning in the **live** ranker (pass mealSlot/weekday into RankingService; the shadow scorer already has the math).
5. Collective per-recipe aggregate table + job — **pilot-gated** (needs real multi-user volume to calibrate).

**Must wait for the pilot:** anything collective/co-occurrence (#5) and online metrics (CTR/save/cook/retention) — no real multi-user data exists today, so building now is dormant or fits synthetic noise. Mechanism is proven; calibration needs users.

**Do NOT touch:** the allergy HARD filter (recipe-fit/recipe-integrity/planner pre-filter), `getLivingUserProfile`, and the frozen `productUseEnabled`/`liveRankingChangedForUser` flip — none of the above requires them to move.

---
<a name="verdict"></a>
```
BACKEND CAPABILITY AUDIT
modules inventoried: ~30 domain folders under apps/server/src (recommendation alone ~80 files, ≈70% specs/shadow) + 38 prisma models + scripts/
endpoints: 102 — WIRED ≈48 / ORPHANED ≈54 (~53%)  [+ runtime-shadow lab controllers, unreached]
services reachable from no controller (dead/internal): collective-signal, recommendation-learning-proof, taste-affinity, recommendation-shadow-scorer (intelligence/shadow); behavior-engine.service (legacy); feature-store/signal-calculator (internal via pipeline)
PROOF-ONLY engines: recommendation-shadow-scorer, collective-signal, taste-affinity, recommendation-learning-proof, entire runtime-shadow/** (A10/A12/A13/A14)
negative feedback recorded from meal-plan reject/remove/not-cooked: NO — applyNegativeFeedback exists but no FE emitter; mealplan_remove/clear + shopping_item_remove write flat/none; "not cooked" not detected
production collective per-recipe score exists: NO (proof-only; no column/job; live popularity is count/recency, reject-blind)
live-ranking flip status: shadow stack FROZEN (recommendation-decision.types.ts:134; recommendation-shadow-a10-qa-gate.ts:34) BUT live RankingService (pipeline/ranking.service.ts:79-88,216,240) ranks live + is WIRED
ingredient-level preference learning: PARTIAL (positive top-N, shadow-only) — dislike inference MISSING
context-conditioned preference learning: PARTIAL (weekday/mealSlot in shadow scorer; live ranker context-blind)
TARGET map (Section 5): 1 present / 4 partial / 3 missing
report written to docs/audit/BACKEND_CAPABILITY_AUDIT.md: Y
NO code changes made (audit only): Y (NO_SOURCE_CHANGES)
```

## After the report
STOP — no building. The founder + advisor turn this into the Food Intelligence roadmap; the advisor spot-checks
these findings against the code as a second net. **Single highest-leverage next move:** ship one "not
interested" control to activate the negative-feedback pipeline that is already built and waiting.
