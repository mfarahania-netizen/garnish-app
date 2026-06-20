# 🛡️ GUARDIAN LOG — Garnish oversight

> Ruthless, evidence-based oversight against the recorded sources of truth (EXECUTION_LEDGER, FOUNDER_REQUIREMENTS,
> MASTER_REBUILD_PLAN, AI_STANDARD, IDEAS_AND_GAPS, auto-memory). Every claim carries file:line / commit / requirement id.
> No flattery. Newest entry on top.

---

## 2026-06-20 — Entry 3 (post-fix REVIEW loop: 3 iterations on H1/H2 → SAFETY converged)
The 2-reviewer post-fix loop ran 3 passes and caught real gaps my earlier fixes missed — exactly its job:
- iter-1: H3 approved; H1/H2 reworked (the live fix covered /recommendations but NOT GET /recipes — Home/Discover still showed peanut/pork).
- iter-2: reworked again — one reusable RecipeSafetyFilterService on ALL serving paths + optional-auth + fail-closed at source.
- iter-3 (this): closed the remaining SAFETY-material gaps the reviewers found:
  - ✅ pork tokens made comprehensive (salami/pepperoni/mortadella/sausage/gelatin/…) so the fallback catches pork in the ~700 un-authored recipes where `containsPork` defaults false.
  - ✅ OptionalJwtGuard no longer fails OPEN on an expired/invalid token (token-present-but-bad → 401, not silent anonymous).
  - ✅ killed a SECOND weaker leak: meal-plans.service.generateSmartPlan used a declared-only exact-match allergy filter → now routes through the shared gate.
  - ✅ controller-wiring spec proves findAll/search/similar call the gate with the user id (anonymous → undefined).

**SAFETY CONVERGED:** no allergen/pork leak remains on any user-facing serving path; the gate is fail-closed.
**Accepted NON-safety follow-ups (tracked, do NOT block):** (1) GET /recipes pagination under-fills when an
authed user's unsafe recipes are dropped after skip/take (over-fetch+recount); (2) the gate does a 2nd
recipe.findMany (let it accept already-loaded rows); (3) full per-ingredient pork tagging of the 1008-item
dictionary (data pass, like the allergen audit) so the flag — not just tokens — is authoritative; (4) route
briefing-composer through the shared gate too (it already drops both, just not via the service — drift risk).

---

## 2026-06-20 — Entry 2 (synthesis of 38 verifier-confirmed findings → de-duped to 18 issues, ranked)

**Stance:** every finding below was independently confirmed by a second guardian against live source. The 38 raw
findings collapse to **18 distinct issues** (the L0-gate drift appeared 5×, the live-path allergy hole 4×, no-pork 3×,
the observability viewer 3×, European occasions 2×, dead i18n 2×). Entry-1 status is reconciled at the bottom: several
entry-1 fixes **shipped** (consent fail-closed, no_pork *classification*, Sizdah-Bedar, context wired into the live ranker)
but introduced or exposed **new** high-severity gaps. The headline regression: **L1 was unblocked on a gate that was
silently narrowed from 6 criteria to 2**, and **the allergy HARD filter does not hold on the primary live feed**.

### 🔴 HIGH

**H1 — The allergy HARD filter is BYPASSED on the live recommendation feed for every user with history.**
The protected `assessRecipeFit → drop 'avoid_allergen'` gate runs **only** in the cold-start bucket, and
`getColdStartRecipes()` returns `[]` once a user has >5 events in 30 days (`candidate-generator.ts:262-269`). The other
7 buckets (similar/embedding/collaborative/trending/health/seasonal/inventory) and `ranking.service.rank()`
(`ranking.service.ts:148-269`) apply **no** allergen filter — they only score. Live path:
`recommendation.controller.ts:38 → RecommendationPipelineService.getRecommendations → generate()+rank()`, surfaced in
Home/Discover/Favorites (`useHomeData.js:29`, `useDiscovery.js:106`, `useFavorites.js:31`). The offline eval harness
enforces zero-leak; the **live serving path does not**. A returning user with a declared peanut/dairy allergy can be
served allergen-conflicting recipes. This is the founder's non-negotiable invariant, byte-identical only where it is
barely used.
**Fix:** apply the deterministic HARD gate (reuse `getLivingUserProfile` + `assessRecipeFit`) to the FULL merged
candidate set, post-generation/pre-or-post-rank, for ALL users — drop `avoid_allergen` **and** `avoid_constraint`. Fail
closed: if the profile can't load, return nothing. Add a live-path spec (active user, declared peanut → zero peanut in
GET /recommendations). Also covers the `/recipes`-sourced popular/fresh rails which have no filter either.

**H2 — `no_pork` / halal / kosher is NOT enforced on the live feed; the user-facing copy claims it IS.**
`recipe-fit.ts` correctly classifies pork as `culturalConflict → recommendation 'avoid_constraint'`, fitScore 0
(`recipe-fit.ts:94-99,156-159`), but crucially sets `safe = !allergenConflict` (line 99) — pork is marked **safe**. Every
downstream hard-drop keys on `avoid_allergen`/`allergenConflict`, never `avoid_constraint`/`culturalConflict`:
`candidate-generator.ts:323` (filter), `meal-plan-planner.service.ts:86`, `briefing-composer.ts:90`,
`offline-metrics.ts:31`. So a pork dish is scored 0 but **stays a candidate** (and is actively planned into a halal
user's meal plan, and passes the daily-pick filter). The ranker never calls `assessRecipeFit` at all. Meanwhile
`declared-dimension-registry.ts:70` now tells the user pork-avoidance **"is enforced in recommendations"** — a new,
more-specific, still-false claim (the prior false copy was "applied as recipe constraints"). Commit 9a717b32's message
claims "pork is excluded"; it is half-enforced at best.
**Fix:** every consumer that drops `avoid_allergen` must also drop `avoid_constraint` (or check
`fit.safety.culturalConflict`), driven by the authoritative `Recipe.containsPork` flag; add a no_pork/halal web toggle
that persists to the dimension the filter reads; add a halal-user-+-pork-recipe regression spec. Until enforced
everywhere, change the `safeExplanationTemplate` to "being added (not yet enforced)".

**H3 — The LOCKED L0 EXIT GATE was narrowed from 6 criteria to 2, declared MET, and L1 was unblocked.**
`MASTER_REBUILD_PLAN.md:145` + checklist items 6-11 define the gate as: (6) Phase-0 counters + impression/position/
propensity/reward log, (7) context plumbing, (8) durable outbox routing, (9) admin observability viewer, (10) the
cook-N-stews end-to-end integration test, (11) DELETE the 148-file shadow tree — with "No consumer work starts until
this passes." `EXECUTION_LEDGER.md:9-13` declares "🚦 L0 EXIT GATE: برآورده شد" citing **only** clause-1 (cook→stew,
69dc9053) + clause-2 (context, 55e70b78), then "حالا L1 مجاز است". **Verified still-missing:** no `Counter`/`Impression`/
`Outbox` model in `schema.prisma`; no outbox/durable routing anywhere; the shadow tree is still exactly **148 files**;
no admin observability viewer; no integration test (only unit specs). This is the exact gate-bypass the founder built
the gate to prevent.
**Fix (pick ONE, in writing):** (a) restore "L0 EXIT GATE: NOT MET — remaining: counters, durable outbox, observability
viewer, shadow deletion, integration test" and keep L1 blocked; OR (b) formally amend MASTER_REBUILD_PLAN to split a
narrow "ranker-loop gate" (the 2 met clauses) from the substrate items and re-gate L1 on the substrate, recording WHY.
Do not leave a green ledger over an unmet locked gate.

**H4 — The gate's own mandated end-to-end integration test does not exist; it was passed with mocks, and the live demo
was relabeled "optional".** Clause 1's cook-loop spec MOCKS `applyPositiveFeedback`
(`recipe.signal-processor.cook-loop.spec.ts:14-17`) — it only asserts the fn was called, never that a real stew's
categories yield `likes_stew → boosted rank`; the real extractor (`signal-calculator.service.ts:234-264`) has **no
spec**. Clause 2's pipeline spec passes `context = undefined` (`recommendation-pipeline.service.spec.ts:71`) so the live
`ContextService.now → rank(...,liveContext)` seam has zero coverage. `EXECUTION_LEDGER.md:13` marks the live e2e demo
"اختیاری" (optional) — directly contradicting the gate making it mandatory. The commit itself admits "A live end-to-end
app demo would seal it."
**Fix:** write the actual gate test — seed a stew with خورشت/آب‌پز categories, POST N real `cook_complete`s
(un-mocked extractor), assert the next live GET /recommendations ranks stews higher AND differs by time-of-day AND every
event carries `consentPurpose`. Remove "اختیاری" — it IS the gate.

**H5 — Founder R8 admin observability viewer ("don't delete one second" / meat→mushroom behavioral cabin) is entirely
unbuilt — it is the rebuild's own acceptance surface, yet the gate was declared met without it.**
The plan deliberately pulled R8 INTO L0 (`MASTER_REBUILD_PLAN.md:28,137-141`: "without it the rebuild is unfalsifiable"),
with the data contract at :140 (`eventStream(userId)`, `observations(userId)`, `profileTrace` declared→observed→reconciled,
`counters(recipeId)`). `EXECUTION_LEDGER.md:47` R8 = "✅ ثبت" (recorded, not built). Verified: `admin.controller.ts` is a
generic pre-existing analytics dashboard over raw UserEvent/UserBehaviorProfile — it exposes none of the L0 contract
surfaces; grep for `eventStream|profileTrace|observations(userId)|counters(recipeId)` = 0 non-spec hits. The only
"observability/loop-close" code is the shadow lab's self-observing activation-review (the theater the plan orders
deleted). Without this viewer the founder literally cannot SEE the loop close, so "gate met" is unverifiable.
**Fix:** build the thin PII-free admin-gated read-only viewer over L0 tables; keep it at the TOP of the L0-remaining
queue. It is both R8 and the gate's acceptance test.

**H6 — European / Gregorian occasions are still entirely absent from the "every second" context engine — declared CORE
to the launch market, not deferred.** `FOUNDER_REQUIREMENTS.md:12` + `IDEAS_AND_GAPS.md:135-141` (#16): European/Dutch
occasions + the Gregorian calendar are CORE to the GENERAL-public Europe launch. `real-time-context.ts:9-12` contains
only a comment ("a European occasion provider must be added here"); `real-time-context.ts:79` hardwires
`occasion: persianOccasion(jalali)`; `jalali.ts` computes only Persian occasions. For a Dutch user, Christmas / Easter /
King's Day / Sinterklaas do not exist.
**Fix:** add a `europeanOccasion` provider (Christmas, Easter, NYE, King's Day, Sinterklaas) keyed off the same
Gregorian date, as the PRIMARY launch path; Persian occasions become cultural-discovery for everyone.

**H7 — The entire web UI is hardcoded Persian with no working language path — contradicting the founder's emphatic
general-European directive.** `index.html:2` is hardwired `<html lang="fa" dir="rtl">`; onboarding option labels +
headings/buttons are Farsi-only (`steps.js`, `onboarding/page.jsx`); ~1,100+ hardcoded Arabic-script literals across
60 app files. A Dutch user with zero Persian cannot read or operate a single screen. (See H8 — the i18n skeleton exists
but is wired to nothing.)
**Fix:** treat full EN/NL localization as a CORE launch blocker. Wire `I18nProvider`, default by Accept-Language for NL,
migrate onboarding first (the entry funnel), then home/discover/recipe/assistant. Add a Dutch (nl) catalog — EN alone
is not the launch language for Holland.

**H8 — An i18n system was BUILT but wired to NOTHING (dead code) on the exact axis the founder named as the launch
market.** `apps/web/src/i18n/` has `I18nProvider.jsx`, `useTranslation.js`, `en.json`, `fa.json`, but grep for
`I18nProvider`/`useTranslation` outside the two definition files = ZERO consumers; `main.jsx` renders `<App/>` with no
provider; `DEFAULT_LANG='fa'`; `en.json` is 32 lines (nav/auth only). The settings "زبان" control is a no-op stub
("English coming soon"). Localization theater.
**Fix:** wire it now (H7) or record honestly in the ledger that localization is unbuilt and launch-blocking.

**H9 — All recipe CONTENT (titles, ingredients, units, steps) is Persian-only with no translation field — including
non-Persian dishes.** `recipes-step-pilot.json` stores Sticky Toffee Pudding as "پودینگ تافی خرما", units as "گرم",
steps in Persian; `schema.prisma` Recipe/RecipeStep/RecipeIngredient have single-locale string fields, no
`title_en`/`locale`. GRIS/R12 enrichment is Persian-only. A Dutch user cannot read what a recipe is, what to buy, or how
to cook it. Not tracked in IDEAS_AND_GAPS.
**Fix:** decide + record the recipe-content localization strategy BEFORE more enrichment batches harden the Persian-only
shape (per-recipe localized title/ingredient/step fields + localized units for en/nl).

### 🟡 MEDIUM

**M1 — Phase-0 counters (impressions/views/quick_exits/cook/favorite/skip + impression log with position/propensity/
reward) do not exist, yet L1 is unblocked.** The plan (`MASTER_REBUILD_PLAN.md:143`, item 6) calls these "the arithmetic
substrate [that] unblocks the entire collective trio + bandit + ranker calibration." No `Counter`/`Impression` model in
`schema.prisma`; `RecommendationMetrics` is a global daily aggregate, not per-recipe/cohort rolling counters.
**Fix:** land Phase-0 counters + impression/reward log as the first L1-adjacent commit before any deflation/cohort/bandit
work, else L1 builds on nothing (the reactive-rework the layered plan exists to prevent).

**M2 — Durable signal routing (outbox + await/retry), an L0 spine deliverable, was never built — high-value events route
fire-and-forget.** `analytics.service.ts:117-119` routes via `.catch(err => console.error(...))` (not awaited, no retry);
`event-router.service.ts` is a bare `await processor.process()`. No `outbox` anywhere. A cook signal lost to a transient
failure silently breaks the loop the gate claims is proven. (Consent fail-CLOSED itself is correctly fixed —
`analytics.service.ts:109 .catch(() => false)`.)
**Fix:** implement the durable outbox (persist → await + retry) before relying on the loop in production / before Europe
go-live. It is an explicit L0 gate item, not later polish.

**M3 — Context boost re-ranks an allergen/pork-unfiltered candidate set — "every second" polish ships above a missing
safety floor.** `ranking.service.ts:242` multiplies `finalScore` by `contextBoost` (≤1.25×, raise-only) over candidates
with no prior allergy/pork screen (depends on H1/H2). It cannot make anything safe; it amplifies an unsafe set.
**Fix:** order the live pipeline as generate → HARD safety gate (allergen + pork, fail-closed) → rank/contextBoost →
slice, so the boost can never resurrect a dropped unsafe dish.

**M4 — EXECUTION_LEDGER contradicts itself on the L0 gate.** Top banner (`:9-13`) declares the gate MET and the context
engine "در رنکرِ زنده جاری است (55e70b78)"; §5 (`:68`) still says "EXIT GATE برآورده نشده … هنوز به رنکر سیم نیست". Line
68 is stale post-fix and contradicts the banner — the drift the founder hates, inside the single source of truth.
**Fix:** update or remove line 68 so §5 agrees with the banner. Pick one truth.

**M5 — Misleading safety docstring.** `candidate-generator.ts:276-278` asserts an allergen-conflicting recipe is "NEVER
returned" as a global guarantee, but it's scoped only to the cold-start bucket (`fitRank`). It invites the false
assumption that `fitRank` is the universal allergen gate (the root of H1).
**Fix:** make it true (filter all buckets) or scope it honestly ("NEVER returned via cold-start; behavioral buckets need
their own allergen filter — gap").

**M6 — Context timezone is hardcoded to the server/Tehran clock, not threaded per-user.**
`recommendation-pipeline.service.ts:44` calls `this.context?.now(new Date())` with no `timeZone` (explicit
`TODO(europe)` on :43), so it defaults to `IRAN_TZ` + Iran weekend (`real-time-context.ts:62-63`);
`ranking.service.ts:214 isIranWeekday(new Date())` uses the server clock. An Amsterdam user is scored against Tehran
time-of-day/season/weekend — the per-user contextual claim is server-global.
**Fix:** thread the user's timezone/locale from profile/location into `context.now(date, { timeZone, weekendDays })` and
`isIranWeekday`. Until then, soften any "per-user context" claim.

**M7 — Onboarding captures no locale / country / language / timezone signal.** `steps.js`/`question-bank.ts`/
`declared-dimension-registry.ts` collect work/household/diet/allergens/dislikes/goals/skill/budget — no locale dimension.
Even after i18n is wired there is no first-class field to drive language default, timezone, weekend, or occasion framing
for a new Dutch user (this single field ties together H6/H7/M6).
**Fix:** add a locale/country (and derived timezone) capture early in onboarding for the European launch.

**M8 — Swap / scale / remove still emit ZERO analytics events — the new recipe-personalization UI enlarged the
observability hole.** `usePersonalization.js:53-67` (`setServedFor`/`applySwap`/`toggleRemoved`) write only to
sessionStorage; the recipe page tracks only `recipe_view`/`favorite_add`/`mealplan_add`. `AI_STANDARD.md:99` +
`IDEAS_AND_GAPS.md:96-101` (#11) name this the #1 prerequisite — the L1 ranker is starved of its best signal.
**Fix:** emit `ingredient_swap` / `recipe_scale` / `ingredient_remove` (recipeId + from/to + scaleFactor) via the
existing `/analytics` trackEvent path. (Note: the surface was introduced by d80fc0c7, not a4f77ead.)

**M9 — The 148-file runtime-shadow/lab/control-plane tree is built-but-consumed-by-nothing — process-theater the plan
ordered deleted.** `recommendation-pipeline.service.ts:82-106` runs the shadow after the response and "intentionally
discards" it; `promotionAllowed:false` is a hardcoded literal type; default-OFF; ~13k LOC of maintenance weight for a
solo founder.
**Fix:** extract the 1-2 promote-worthy signals (cuisine + collective) the plan flags, then delete the shadow tree.

**M10 — Stale memory: `garnish-food-dna-activation.md` still says hydration is "DORMANT until phase B" though phase B
shipped (9a294066 + fa852873).** A future session will re-investigate a solved problem. This was an entry-1 DO-NEXT and
was not done.
**Fix:** mark phase B DONE, state the loop is live on consent, remove the "phase B is next" line.

**M11 — README cadence missed; root README.md is ~75 commits stale with claims the founder would grade false.**
Last touched c70d6219 (2026-06-18); `README.md:17,46` still say "recipes 200" + "Nutrition is not source-locked" —
contradicted by 45e2ed30 (≥227 USDA-locked). (Caveat: `data/README.md` still asserts `productionNutritionLock=false` at
the recipe-production level, so the root claim is stale/over-absolute, not flatly fabricated.)
**Fix:** refresh README.md + docs/README.md (nutrition lock, recipe/GRIS counts, L0/consent/AI_STANDARD state); honor
the ~6-prompt cadence.

**M12 — R14 full factual allergen audit (milk/coconut) sits in indefinite "deferred" with no date or owner.**
`EXECUTION_LEDGER.md:53` R14 = "✅ انجام · ⏳ ممیزیِ فاکتیِ کامل (شیر/نارگیل) به‌تعویق". A safety item on a
catastrophic-miss path, flagged twice, still unowned. (The hard filter + parser hardening 4eac343c did ship.)
**Fix:** schedule + complete it with a concrete deadline tied to the launch / live-AI gate; record the gate in the
ledger.

**M13 — GUARDIAN_LOG had only ONE entry and was never updated after fixes — resolved findings unmarked, open ones not
carried forward.** The guardian's own externalized-truth discipline was decaying (this Entry 2 is the corrective pass).
**Fix:** make annotating the log part of the fix cycle (done below — entry-1 reconciliation).

### 🟢 LOW

**L1 — Dead signals.** `signal-calculator.service.ts:256,261` persist `likes_steamed` (بخارپز) and `prefers_keto`
(ketogenic) on every matching cook/favorite, but `ranking.service.ts:110-126 signalTokenMap` has no entry for either —
the ranker silently ignores them. Fix: add both to `signalTokenMap` or stop emitting them.

**L2 — Context boost is invisible to explainability.** `contextBoost` (`ranking.service.ts:278-297`) multiplies
`finalScore` but pushes no `matchedSignal`/reason (e.g. `context_winter_stew`, `context_dinner`, `context_yalda`),
against the founder's R7 transparency bar. Fix: push an honest context tag into `matchedSignals` and surface it.

**L3 — Cook-RESULT feedback loop ("how did it go?" + photo + what-went-wrong) is entirely missing.** Correctly tracked
(`IDEAS_AND_GAPS.md:32-37` #2) but it is the outcome signal R9's WHY-inference engine depends on. Fix: keep #2 explicitly
linked as an R9 prerequisite so it is sequenced with L2.5 lifecycle work.

**L4 — Persian-only health-goal strings in dead code.** `recommendation.service.ts:36`
`['کاهش وزن','تناسب اندام','سلامت قلب']` can never match a European user's goal IDs. NOTE: `RecommendationService` is
**orphan/dead** code (not in `recommendation.module.ts`, imported nowhere) — the live path is the pipeline. Fix: delete
`recommendation.service.ts` + its spec (also resolves the stale Persian heuristic).

### 🔁 ENTRY-1 RECONCILIATION

- **RESOLVED:** consent fail-CLOSED (`analytics.service.ts:109 .catch(() => false)`); no_pork *classification*
  (`recipe-fit.ts` avoid_constraint) — but enforcement still missing → **H2**; Sizdah-Bedar reordered (`jalali.ts:61`);
  ContextModule registered + wired into the live ranker (55e70b78) + cook→stew signal (69dc9053) — entry-1 #11 closed.
- **STILL OPEN (carried forward):** #2 European occasions → **H6**; #3 observability viewer → **H5**; #6 milk/coconut →
  **M12**; #8 README → **M11**; #9/#10 gate drift → **H3**; #15 stale memory → **M10**.
- **NEW since entry-1:** H1 (live allergy hole), H4 (gate test theater), H7/H8/H9 (i18n + recipe-content monolingual),
  M1/M2 (counters + outbox absent), M8 (uninstrumented swap UI).

---

## 2026-06-20 — Entry 1 (synthesis of 3 auditors, 20 raw findings → de-duped + source-verified)

**Verification stance:** every claim below was re-checked against live source today. Where a raw finding's number was wrong
it is corrected here (e.g. shadow tree is **148 files**, not 385 — matches MASTER_REBUILD_PLAN.md:194's own "148 files confirmed";
the 385 figure was inflated). Two findings were sharpened by a NEW founder directive the auditors hadn't fully weighted:
**FOUNDER_REQUIREMENTS.md:7-13 (2026-06-20) — the Europe launch now targets the GENERAL European population, NOT the diaspora;
European occasions + the Gregorian calendar are CORE, not deferred localization.** This reframes the pork and occasion items.

### 🔴 FORGOTTEN / DROPPED (things we lost)

1. **[HIGH] `no_pork` / halal soft-filter decided + half-built, but enforcement is missing — pork dishes are NOT filtered for users who opt out.**
   - Decision: `garnish-data-quality-initiative.md` PORK decision (2026-06-19) — keep pork dishes BUT a "no pork" toggle + soft filter so opt-out/halal users "never see pork dishes (soft filter, like an allergen)."
   - Built half: `schema.prisma:189` has `Recipe.containsPork`; `recipes.service.ts:74-81` reads it; `declared-dimension-registry.ts:70` defines `dietary.cultural_constraints` with a `no_pork` option whose `safeExplanationTemplate` claims **"applied as recipe constraints."**
   - **VERIFIED unwired:** grep for `cultural_constraints`/`no_pork`/`containsPork` across `apps/server/src` returns the dimension definition + `question-bank.ts:37` + the recipe read + data scripts ONLY. **ZERO references in `apps/server/src/recommendation/` or any fit/filter path** (grep returned no files). So the dimension's "applied as recipe constraints" explanation is **literally false** — a no_pork/halal user is still shown carbonara, feijoada, full-English, etc.
   - Under the NEW general-European target this is still valid (halal/no-pork users exist in any general population) — it is a real dietary-constraint feature, not just a diaspora concern.
   - **Action:** wire `no_pork` (and `halal`) in `cultural_constraints` to exclude `Recipe.containsPork=true` in the candidate/fit filter (mirror the allergen soft-filter); add the onboarding/preference toggle on web (web references pork nowhere). Until wired, fix the false `safeExplanationTemplate`.

2. **[HIGH — NEW, auditors missed this] European / Gregorian occasions are entirely absent from the context engine, contradicting the founder's CORE-launch directive.**
   - `FOUNDER_REQUIREMENTS.md:12`: "European occasions + the Gregorian calendar are CORE to the launch (not a deferred localization)."
   - **VERIFIED:** `apps/server/src/context/` has Jalali/Persian occasions only (`jalali.ts` persianOccasion = nowruz/yalda/chaharshanbe_suri/sizdah_bedar). grep for `christmas|easter|gregorianOccasion|europeanOccasion` in `context/` = **zero hits**. The "every second" context engine has no Christmas, no Easter, no European weekend-meal/holiday awareness — for an app whose stated primary audience is the Dutch/European general public.
   - **Action:** add a Gregorian/European occasion detector alongside `persianOccasion` (Christmas, Easter, NYE, etc.), keyed off the same `RecommendationContext`. Persian occasions stay as cultural-discovery moments (per the directive), but European occasions are the CORE path and are currently nonexistent.

3. **[MEDIUM] Admin/observability "watch the loop close" viewer (founder R8 — "don't delete one second", meat→mushroom behavioral cabin) is still UNBUILT — and it is the rebuild's own acceptance-test surface.**
   - `MASTER_REBUILD_PLAN.md:137-141` + checklist item 9 (:244) move observability INTO L0 ("not an L3 nicety… how the founder sees the loop close; without it the rebuild is unfalsifiable").
   - `EXECUTION_LEDGER.md:41` R8 = "✅ ثبت · L0" (recorded, NOT built); L0 row (:26) + §5 (:62) still list "مشاهده‌پذیریِ ادمین" as remaining. No viewer commit in the log.
   - This is correctly *tracked* (not lost) but it is now the **highest-value unbuilt L0 item** since the context object shipped. Without it the L0 EXIT test (:145 "admin viewer shows the loop closing for a real user") cannot pass.
   - **Action:** keep it at the TOP of the L0-remaining queue. Build the thin read-only event/observation/profile-trace/counters viewer over L0 tables (per :140).

### 🟡 CARELESS / INCOMPLETE (quality)

4. **[HIGH] Consent-at-ingest gate FAILS OPEN, contradicting commit 9a294066's own "fail-CLOSED for non-core" claim.**
   - **VERIFIED `analytics.service.ts:107`:** `const allowed = await this.consent.hasPurpose(data.userId, 'personalization').catch(() => true);` — on ANY throw, `allowed = true` → the event is routed into the signal engine (line 115) even under `enforce`. For a GDPR/Holland launch a consent-lookup failure must NOT result in processing personal (non-core) data.
   - **Action:** change `.catch(() => true)` → `.catch(() => false)` (fail closed). Add a spec where `hasPurpose` rejects and assert the event is stored-but-not-routed. This must land BEFORE flipping `EVENT_CONSENT_GATE_MODE=enforce`, else enforce mode is undermined by the catch.

5. **[MEDIUM] Dead/unreachable Sizdah-Bedar branch — it can NEVER be emitted; silently misclassified as nowruz.**
   - **VERIFIED `jalali.ts:61-62`:** line 61 `if (jm === 1 && jd <= 13) return { key:'nowruz', fa: jd===13 ? 'سیزده‌بدر' : 'نوروز' }` returns FIRST on Farvardin 13, so line 62 `if (jm === 1 && jd === 13) return { key:'sizdah_bedar' }` is **unreachable**. `occasion.key` is always `'nowruz'` on Sizdah-Bedar (only the `fa` label flips). Consumers key off `occasion.key`, so the distinct outdoor/picnic occasion collapses into Nowruz. The `OccasionKey` type advertises `'sizdah_bedar'` as real; `real-time-context.spec.ts` never tests Farvardin 13 so it passed unnoticed.
   - **Action:** fold the branch — `jm===1 && jd<=13` → `key: jd===13 ? 'sizdah_bedar' : 'nowruz'`; delete the dead line 62; add a spec asserting `occasion.key==='sizdah_bedar'` on Farvardin 13.

6. **[MEDIUM] R14 full factual allergen audit (milk/coconut) is deferred and still open — an allergen-SAFETY item parked on the one path where a miss is catastrophic.**
   - `EXECUTION_LEDGER.md:47` R14: "✅ انجام · ⏳ ممیزیِ فاکتیِ کامل (شیر/نارگیل) به‌تعویق". Tracked (good) but unresolved; nothing since `4eac343c` closes it.
   - **Action:** schedule + complete the milk/coconut factual derivation audit BEFORE any live-AI flip or production allergen claims. Safety items should not stay "deferred" indefinitely.

7. **[LOW] Europe-weekend default keyed on an exact timezone STRING — non-canonical Iran zones silently get the European weekend.**
   - **VERIFIED `real-time-context.ts:59`:** `const weekendDays = opts.weekendDays || (timeZone === IRAN_TZ ? [4,5] : [0,6]);` with `IRAN_TZ='Asia/Tehran'`. Any other Iran IANA alias (e.g. `'Iran'`) falls into `[0,6]` (Sun+Sat, European) — wrong for Iran (Thu+Fri). The `opts.weekendDays` seam exists but nothing populates it.
   - **Action:** derive weekend from a country/locale field (the real signal) or normalize Iran aliases. Low priority given the general-European pivot, but it is a correctness bug in a file whose whole purpose is locale-correctness.

8. **[LOW] Stale Persian-only health-goal strings in the live ranker, against the general-European pivot.**
   - **VERIFIED `recommendation.service.ts:36`:** `healthGoals.some(g => ['کاهش وزن','تناسب اندام','سلامت قلب'].includes(g))` — hardcoded Persian goal labels. A Dutch/European user's health goals will never match. (This whole heuristic is slated for L1 replacement anyway — see DRIFT #11 — but flagged as a concrete symptom of the diaspora→general drift.)

### 🧭 DRIFT / PATH (are we on the layered no-rework path?)

9. **[HIGH] The L0 EXIT GATE was never met, yet consumer-layer work already shipped — the locked gate is being bypassed.**
   - `MASTER_REBUILD_PLAN.md:145` "No consumer work starts until this passes" + :246 "✅ GATE". The gate requires: Phase-0 counters, durable outbox routing, admin observability viewer, shadow-tree deletion, and the L0 EXIT integration test.
   - **VERIFIED unmet:** no `model Counter`/`model Impression` in `schema.prisma` (grep: only `SignalObservation`:582 and `PantryItem`:630 exist — note PantryItem IS already present, correcting a raw finding); the shadow tree the plan orders DELETED (:228 step 10/11) is **still fully present — 148 files** under `runtime-shadow/`; no counters/outbox/observability/shadow-deletion/exit-test commit in the log. Meanwhile recipe-perso (a consumer surface, `a4f77ead`) + GRIS render already shipped.
   - The plan itself (`8b297627`) was authored AFTER recipe-perso phases 0-6 already shipped — i.e. the route was "locked" partly to rationalize a sequence that had already drifted.
   - **Action (pick ONE, in writing — do not keep both the gate and the violation live):** (a) finish L0 to its exit criterion (counters + durable routing + delete the 148-file shadow tree + write the cook-N-stews integration test) before any new L1/L2/L3 BUILD; OR (b) explicitly amend the plan to de-gate L0 and record WHY.

10. **[HIGH] The EXECUTION_LEDGER narrates L0 as effectively done ("A·B·C·D زنده", "loop proven") while the binary EXIT GATE is unmet — exactly the "careless / forgotten as the session grows" failure the founder named.**
   - `EXECUTION_LEDGER.md:26` "🟢 A·B·C·D زنده؛ context+admin مانده" + §5 (:60-63) lists three co-equal parallel NOW tracks (batch-04, L0, AI standard). A green-sounding ledger over an unmet gate is how the path is silently lost.
   - **Action:** add ONE explicit binary line at the TOP of the ledger: **"L0 EXIT GATE: NOT MET — remaining: counters, durable outbox, observability viewer, shadow deletion, integration test. No further L1/L2/L3 BUILD until met."** Make §5's "NOW" name a SINGLE L0 task, not three parallel tracks.

11. **[HIGH] The "every second" context engine (founder R5, 2 commits) is wired to NOTHING in the live recsys path — built into a vacuum.**
   - **VERIFIED:** `ContextModule`/`ContextService`/`buildRealTimeContext` importers = the 4 files inside `apps/server/src/context/` ONLY. `app.module.ts` has **no ContextModule import** (grep: no matches). The live entrypoint `recommendation.controller.ts:38` still calls `pipeline.getRecommendations(userId, +limit)` with ZERO context; `recommendation.service.ts:12` is still the old Prisma where-clause heuristic (diet/region/healthGoals). The context object **cannot** make 8am≠8pm because the ranker never receives it — this is the exact AUDIT C6 joint L0 ④ was meant to fix.
   - Also note the in-code comments (`context.service.ts:5-8`, `context.module.ts:4`) assert it is "injected by the L1 ranker + L2a assistant" — **aspirational, not live.** EXECUTION_LEDGER §2/§5 and commit `184a2254` present it as a delivered L0 brick.
   - **Action:** plumb `RecommendationContext` request → controller → `service.getRecommendations`, starting with time-of-day→mealType candidate gating (the plan's smallest-change-that-proves-it, :135). Until consumed, the "every second" commits are theater. Either wire it or downgrade the comments to "designed to be injected (not yet wired)".

12. **[MEDIUM] Effort is dominated by R12 data-enrichment (GRIS batches) + recipe-perso premium-render UI — both consumer/content work ABOVE an incomplete L0 — while the learning-engine foundation is half-built.**
   - The large majority of the last ~40 commits are data batches (`3153381f`, `45e2ed30`, `fd1c17a1`, …) + recipe-perso phases 0-6 + GRIS render (`a4f77ead`, `d80fc0c7`..`b6a465ff`). `EXECUTION_LEDGER.md:45` R12 shows 74/~700 done with batch-04 in background. Meanwhile `recommendation.service.ts:12` has 0% of the learning rebuild and the 148-file shadow tree is undeleted. recipe-perso "recipe knows you" is `IDEAS_AND_GAPS` Idea #1, explicitly → L1/L2 (build AFTER the foundation).
   - **Action:** background data batches may run in parallel (fine), but they must NOT substitute for L0 completion. The next ENGINE commit should be an L0 item (counters / context-wiring / shadow deletion), not batch-05 or more render polish.

13. **[MEDIUM] Deep AI work (AI_STANDARD.md + SOTA research) produced while L1 (the ranker AI must ground on) is ~0% learning — premature vs the locked 1→2→3 sequence.**
   - Research-NOW is sanctioned (`FOUNDER_REQUIREMENTS.md:143` + ledger R10 "DEEP AI RESEARCH starts NOW (background)"). BUT `MASTER_REBUILD_PLAN.md:167-176` is explicit that L2 depends on L1's taste vector + shared `assessRecipeFit`, and the live ranker has none of the funnel/embeddings/collective trio.
   - **Action:** keep AI as RESEARCH/STANDARD only (correct). Add an explicit ledger guard: **NO AI_STANDARD phase past "Phase 0 observability" gets BUILT until L1's exit test (the 4 founder acceptance tests) passes.** Treating "the standard is written" as license to start building L2 ahead of L1 is the single biggest on-path risk.

### ✅ ON-TRACK (confirmed)

14. **The genuine L0 core — cook loop, cuisine-affinity extractor, consent-at-ingest, consent-gated observed hydration — was built in correct dependency order and proven end-to-end on a real DB.** Commits `88e52e1d` (cook loop / AUDIT C1), `54c48f84` (cuisine-affinity → Food-DNA graph), `7432143e` (additive schema: SignalObservation + recipeId + consent/pantry), `2882d37d` (consent-gated hydration), `9a294066` (consent wiring + ingest gate), `fa852873` (live cook→signal→consent→hydration verified). Matches MASTER_REBUILD_PLAN §4 steps 1-5. **This is real, not theater — protect it.** (Caveat: the ingest gate's fail-open catch — item #4 — weakens it.)

15. **The food-dna-activation memory's "DORMANT hydration" warning is now RESOLVED/STALE — consent-grant wiring shipped.** `garnish-food-dna-activation.md` warned grantConsent never set the personalization purpose. Now built: ConsentService (`consent/consent.service.ts`), `users.service.ts:155-163` mirrors grants into the purpose ledger, `9a294066` + `fa852873`. **Action: update `garnish-food-dna-activation.md` to mark phase B DONE (9a294066) and drop the DORMANT warning, so a future session doesn't re-investigate a solved problem.**

16. **Internal-only health-score rule is holding — no visible A–E / Nutri-Score grade leaked to UI (EU legal guardrail).** grep for `nutriScore/healthGrade/letterGrade` in `apps/web/src` found no nutrition-grade render. Keep the guardrail when the recipe-page rebuild lands (badge/raw-value only).

17. **Byte-identical invariants (getLivingUserProfile cold-start + allergy filter) appear respected by recent context/consent work.** The context engine (`184a2254`) is standalone and never imports the profile; consent wiring kept ConsentLog/cold-start byte-identical; gate default `off` preserves routing. Re-verify the green suite still covers cold-start AFTER the `.catch(() => false)` fix (item #4) lands.

### 🎯 DO-NEXT (prioritized correction + reminder list)

1. **Make the L0 gate binary & visible (5 min, highest leverage):** add the "L0 EXIT GATE: NOT MET" line to the TOP of EXECUTION_LEDGER (item #10) and collapse §5's three parallel tracks to one L0 task. This is the single fix that stops the session-drift the founder named.
2. **Fix the consent fail-open (item #4):** `.catch(() => true)` → `.catch(() => false)` in `analytics.service.ts:107` + a rejecting-hasPurpose spec. Must precede any `EVENT_CONSENT_GATE_MODE=enforce` flip. Add a ledger launch-gate: "before Europe go-live, set enforce, fail-closed verified."
3. **Wire the context engine into the live ranker (item #11)** OR downgrade its "injected by L1/L2a" comments to "not yet wired." Built-but-unwired is the exact theater this audit exists to kill.
4. **Wire `no_pork`/halal to actually filter `containsPork` (item #1)** and fix the false `safeExplanationTemplate` until it does.
5. **Fix the unreachable Sizdah-Bedar branch (item #5)** + add the Farvardin-13 spec.
6. **Add European/Gregorian occasions to the context engine (item #2)** — CORE to the launch per the founder's general-population pivot, currently nonexistent.
7. **Keep the admin observability viewer (item #3) at the top of the L0-remaining queue** — it is how the founder verifies R8 and is required for the L0 exit test.
8. **Refresh README.md + docs/README.md** (last touched `c70d6219`, 2026-06-18; ~47 commits since): correct README.md:17 "recipes 200"/"Nutrition is not source-locked" (both FALSE — 258 USDA-locked `45e2ed30`, 74 GRIS), and README.md:14 (still E47 A1–A12, no L0/consent/AI_STANDARD). Per `garnish-readme-cadence.md` (~every 6 prompts).
9. **Update `garnish-food-dna-activation.md`** to drop the resolved DORMANT warning (item #15).
10. **Guard AI at Phase-0 (item #13):** ledger note — no AI_STANDARD phase past Phase-0 observability builds until L1's exit test passes.

---
