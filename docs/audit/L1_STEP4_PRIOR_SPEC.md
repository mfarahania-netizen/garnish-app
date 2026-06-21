# L1 Step 4 — Learned per-(recipe × cohort) Prior — Build Spec

Source: `l1-step4-prior` forge (7-agent design panel → 3-lens judge → synthesis). Aligns with `L1_PLAN.md` step 4.
Status: **design locked**. Build is multi-turn, guardian-looped, all atoms byte-identical + default-OFF.

## Chosen approach — ANGLE A (synthetic-feature VALUE + WeightSource WEIGHT), with C's calibration + B's safety grafted
- The learned per-(recipe×scope) posterior reward-rate enters as ONE new score component `recipePrior` in the
  EXISTING `weightedScore()` sum. Its default WEIGHT is pinned to **exactly 0.0** in `defaultWeights`.
- A new `@Optional` `RecipePriorService` computes the component **VALUE**; the existing `L1_WEIGHT_SOURCE` seam
  owns its **WEIGHT** (a future `LearnedWeightSource` raises 0→~0.10). Orthogonal composition, no double-wiring.
- This is exactly what `L1_PLAN.md` step 4 mandates ("wire as a cohort-aware WeightSource"). Angles B/C invented a
  parallel seam the plan doesn't call for.
- **Calibration graft (C):** store `mean`/`populationMu` as CENTERED deviations in [-1,1] (reward-rate minus the
  global slate baseline). Component VALUE = `0.5 + 0.5*clamp(hierarchicalPrior(...), -1, 1)` → neutral posterior 0
  → 0.5 (same neutral midpoint as effortFit/skillFit), on the same scale as every other feature, constant at cold
  start (constant ⇒ cannot reorder).
- **Safety graft (B):** env kill-switch `L1_RECIPE_PRIOR_ENABLED` (default OFF) + value clamp; learner unions
  `cook_complete` UserEvent so cooks logged outside attribution are not lost (NO-LOST-SIGNALS).

## Prisma model (additive, NO FK — mirrors RecommendationServedItem)
```prisma
model RecipePrior {
  id           String   @id @default(uuid())
  recipeId     String
  scope        String   // population | cohort | person
  scopeKey     String   // '' | deriveCohortKey(...) | userId
  n            Float    @default(0)  // IPS effective sample size Σw behind `mean`
  mean         Float    @default(0)  // CENTERED IPS-weighted reward deviation in [-1,1]
  posterior    Float    @default(0)  // cached hierarchicalPrior output (convenience)
  populationMu Float    @default(0)  // CENTERED curated cold-start anchor (population rows; 0 elsewhere)
  rewardM2     Float    @default(0)  // Welford running variance (forward-looking; unused on read path)
  updatedAt    DateTime @updatedAt
  @@unique([recipeId, scope, scopeKey])  // learner upsert key
  @@index([scope, scopeKey])
  @@index([recipeId])                     // batch-fetch a candidate set in one findMany
}
```
**Critical invariant:** `mean`/`populationMu` are CENTERED at 0. Empty/neutral table ⇒ posterior 0 ⇒ component
0.5 constant ⇒ byte-identical. A raw [0,1] store would silently break this (covered by an invariant test).
Defensive access both paths: `(this.prisma as any).recipePrior?.findMany` → missing table = neutral.

## Two new read-path files
- `recipe-prior.source.ts` — token `L1_RECIPE_PRIOR_SOURCE` + interface `RecipePriorSource.valuesForSlate(userId,
  recipeIds, context?) => Promise<Map<string,number> | null>` (BATCHED, value in [0,1], 0.5 neutral, null=defer).
- `recipe-prior.service.ts` — `enabled()` flag (default OFF); resolveFacets (User.locale/country + prefs +
  context.occasion) → deriveCohortKey; ONE `findMany` for the whole slate (population/cohort/person rows);
  hierarchicalPrior(κ=DEFAULT_KAPPA=10) → `0.5 + 0.5*dev`; fail-safe `.catch → null` (neutral).

## Ranker wiring — 5 byte-identical edits to ranking.service.ts (weightedScore/normalizeWeights UNCHANGED)
1. `defaultWeights`: add `recipePrior: 0.0` (11th key; sum stays 1.00; others byte-identical after renormalize).
2. Interfaces `ScoreBreakdown` + `ContributionBreakdown`: add `recipePrior: number;`.
3. Constructor: add `@Optional() @Inject(L1_RECIPE_PRIOR_SOURCE) private readonly recipePriorSource?: RecipePriorSource`.
4. `rankWithFeatureVector`: PREFETCH once before the Promise.all map (no N+1):
   `const priorValues = this.recipePriorSource ? (await this.recipePriorSource.valuesForSlate(userId, candidateIds, context).catch(()=>null)) ?? new Map() : new Map();`
5. In the `scores` object: `recipePrior: priorValues.get(recipe.id) ?? 0.5` (NEUTRAL midpoint, not 0).
`weightedScore` picks up `recipePrior` via Object.entries; at weight 0.0 contributes `0.5*0 = 0`. finalScore untouched.

## Learning loop — recipe-prior-learner.service.ts (batch @Cron, default-OFF `L1_RECIPE_PRIOR_LEARN_ENABLED`)
1. JOIN on `requestId`: RecommendationServedItem ⋈ RecommendationAttributionEvent; UNION `cook_complete`/`recommendation_cook` UserEvent (no lost signals).
2. REWARD: reuse `recommendation-reward.service` value map (cook +1.0/save +0.6/click +0.2/dismiss -0.8/ignore -0.4); served-but-no-action = reward 0; then CENTER (subtract window baseline), clamp [-1,1].
3. IPS weight: `w = clip(1/max(propensity, 0.02), 1, 20)` (clipped self-normalized; over-shown items not over-credited).
4. THREE scopes (person/cohort/population) via deriveCohortKey; weighted-Welford per (recipeId,scope,scopeKey); n += w.
5. SEED populationMu from curated editorial popularity (CENTERED; neutral=0 until authored).
6. UPSERT on @@unique; cache posterior; servedAt watermark for incremental.
Shrinkage is the regularizer, applied at READ time (κ=10): 2 person clicks barely move off cohort/population.
**Honesty:** propensity is softmax over a DETERMINISTIC ranker ⇒ IPS is JOINABLE-but-BIASED until L1.5 bandit. DoD says "joinable", never "unbiased".

## Cold-start proof (4 independent guarantees, any one sufficient — non-negotiable byte-identical)
(A) weight = 0.0 → term is `value*0 = 0` for every candidate. (B) source UNregistered (today) → neutral 0.5
constant. (C) env flag OFF → valuesForSlate null → neutral. (D) empty/neutral table → posterior 0 → 0.5 constant.
Behavior changes ONLY once cohort/person rows accrue n>0 AND a human raises the weight.

## Build order
1. Schema + migration `l1_recipe_prior` (no FK); `prisma migrate dev` + `generate`.
2. `recipe-prior.source.ts` (token + interface; pure types).
3. Ranker wiring (5 edits); run existing ranking.service.spec.ts → must stay green.
4. **Byte-identical regression spec FIRST (TDD gate):** deep-equal full ranked array, source unregistered, vs frozen snapshot.
5. `recipe-prior.service.ts` read path + unit tests (value math, fail-safe, flag gate, N+1=1 query).
6. `recipe-prior-learner.service.ts` batch + tests (IPS, no-lost-signals, hierarchy borrow, cohort-key reuse).
7. GDPR: `tx.recipePrior.deleteMany({ where: { scope:'person', scopeKey: userId } })` in erasure.service $transaction + spec (no-FK rows don't cascade).
8. Leave module UNregistered (default OFF). Document one-line activation.
9. Offline replay gate (founder) before raising weight: prove lift BEYOND outcomeFit.

## Test list (15) — see forge output; gates: byte-identical, order-invariance, centering invariant, value math,
cold-start E2E (nl-NL), IPS weighting, no-lost-signals, hierarchy borrow, cohort-key reuse, N+1=1, fail-safe,
flag gate, erasure (E39), pipeline integration, activation smoke (minority-protection invariant).

## Status — BUILT + guardian-verified (default-OFF)
Seam atom `9f1e3255` · logic `79332d43` · guardian-loop fixes `b39be3c3` (canonical reward scale, funnel argmax,
EU-occasion cohort, cook-max) · re-review CLEAN (fixesSound, no rework). Full suite green. Activation pending
(founder-gated, below).

## Deferred hardening (guardian re-review, LOW — not a defect, not a regression)
- **Serve-time cohortKey persistence.** Today the learner re-derives the cohortKey from the user's CURRENT profile;
  if a user's country/diet/skill changes between serve-time and the nightly batch, the learner writes under the
  new-profile key while the reader reads under the current key — a transient cohort mismatch (minor accuracy
  loss, inherent to any profile-keyed cohort, default-OFF). Fix when convenient: persist the resolved cohortKey
  on RecommendationServedItem at serve time and have the learner reuse it verbatim. Orthogonal to activation.

## Open questions — ALL activation-time (none block the build; defaults below; plan already addresses)
1. **Activation authority/timing** — ship default-OFF now; gate weight>0 behind offline-replay lift + L1.5 bandit (per plan). Founder call only when activating.
2. **Curated populationMu authoring** — Europe gateway map + occasion calendar; founder content review loop. Neutral (0, byte-identical) until authored — a CONTENT gate, not engineering.
3. **Reward-value table** — reuse the shared `recommendation-reward.service` map (recommendation). Divergent mapping = founder product call.
4. **κ per-scope** — ship single κ=10; per-scope is a later control-plane knob.
5. **Double-count vs outcomeFit** — offline-replay gate is the bar (prove lift beyond outcomeFit) before weight>0.
