# FI-PHASE-2.1 — PROMOTE-SCORER: adapter + source-of-truth (decision doc)
**Read-only · authored by Claude Code from the live repo · 2026-06-19**

> Decision-only. **No code changed.** The brief proposed promoting the shadow scorer as the live scoring core
> (Option C). My finding from the live code: **promote-as-is would create a second source of truth AND orphan
> the learn-from-rejection just shipped in FI-STEP-1.** I recommend **graft (iii)** — same end (the proven
> scorer math becomes the live engine) with ONE source of truth and the least divergence risk. Reasoning,
> evidence, and the 2.2 build plan below. The advisor should verify the candidate-field map + the
> two-store/source-of-truth finding against the code.

---

## TL;DR
- **Recommendation: (iii) GRAFT** the shadow scorer's per-user math (context-conditioned `effortFit`, asymmetric `skillFit`, mealSlot routine-fit; cuisine-affinity deferred until the graph is hydrated) into the existing live `RankingService`, reading the existing **feature-vector** — and keep the shadow code as the validated reference spec.
- **Why not promote-as-is (i):** the shadow scorer reads the **identity-graph** (`UserFoodIdentityGraph` ← `SignalObservation`), a *different* materialization than the live **feature-vector** (← `UserBehaviorSignal`). The rec path uses the feature-vector (`ranking.service.ts:123`), and **FI-STEP-1's `applyNegativeFeedback` writes `UserBehaviorSignal`, not the graph** — so promoting the graph-reading scorer would make a user's dismiss stop affecting their live recs. Promote would also need the graph built/maintained on the rec request path (a second store) and the graph's `cuisineAffinities` are **empty in v1** (`profile-dimension-aggregation.ts:148-154`), so the "richer" cuisine term is inert anyway.
- **One source of truth:** the **feature-vector** (`UserBehaviorSignal`), which the live ranker AND FI-STEP-1 already use.
- **Cold-start, response shape, allergy, collective:** all safe/preserved under graft (details in §3–§5).

---

## 1. Candidate-field adapter map
The shadow scorer's `scoreOne(graph, candidate, ctx, history)` needs these per-candidate fields. The live
ranker loads recipes with: `id, title, cookingTime, difficulty, cost, diet, mealType, servings, categories,
createdAt, nutrition, ingredients[{name, ingredient{…}}], searchTerms` (`ranking.service.ts:143-190`). Mapping:

| Shadow field | Used by | On live recipe? | Verdict — derivation |
|---|---|---|---|
| `estimatedEffort` (very_low…very_high) | `effortFit` via `EFFORT_LEVEL` (`shadow:44`) | No column | **Derivable** — band `cookingTime` (e.g. ≤15→very_low, ≤30→low, ≤60→medium, ≤90→high, >90→very_high), optionally nudged by `difficulty` |
| `skillLevel` (beginner/intermediate/advanced) | `skillFit` via `SKILL_LEVEL` (`shadow:45`) | No column | **Derivable** — map `difficulty` (easy→beginner, medium→intermediate, hard→advanced); default intermediate if missing |
| `mealSlot` | `routineFit` slot-match | `mealType` present | **Derivable** — first/﹡matching token of `mealType` (the planner's `parseMealTypes` is the reference) |
| `cuisineTags[]` | `cuisineAffinityMatch` (taste) | `region` + `categories` present (no `cuisineTags`) | **Derivable** — `[region]` (+ cuisine-ish category tokens). NOTE: the graph's `cuisineAffinities` are empty in v1, so this term is **inert until hydration** regardless |
| `estimatedTimeMinutes` | `metadataCompleteness` | `cookingTime` present | **Derivable** — `= cookingTime` |
| `noveltyTags` | `noveltyFit` + completeness | No column | **Absent** — pass `[]` (non-null → counts as present; `noveltyFit` defaults to 0.5 "not novel"). Genuinely absent as data, but safe-defaulted |
| `safetyFlags` | `safetyMagnitude` (block/suppress) | derived upstream | **N/A** — allergy is HARD-filtered UPSTREAM of ranking; surfaced candidates are already safe → pass `[]` |
| `DecisionContext` (weekday/dayPart/mealSlot) | `effortFit` weekday lean, `routineFit` | request context | **Derivable** — server time → weekday/dayPart; slot per meal |

**`metadataCompleteness` (`shadow:62-66`)** counts `[estimatedEffort, skillLevel, mealSlot, cuisineTags?.length, noveltyTags, estimatedTimeMinutes]` present/6 and feeds `confidencePenalty` (down-weights when <0.6). **Conclusion: every field is present or derivable; if we derive all six (noveltyTags=`[]`), completeness = 6/6 → no spurious penalty.** Leaving any `null` would wrongly dampen scores — so the derivation helper is mandatory, not optional. **No field is a true blocker.**

## 2. The source-of-truth fork — recommendation: **(iii) GRAFT**
**The two representations (both materializations of the SAME event stream, via different writers):**
- **feature-vector** — `featureStore.getFeatureVector(userId)` ← `UserBehaviorSignal` (`feature-store.service.ts:16`), written by `signal-calculator.updateSignal` / **`applyNegativeFeedback`** (FI-STEP-1). **The live ranker reads this** (`ranking.service.ts:123`).
- **identity-graph** — `buildUserFoodIdentityGraph` ← `SignalObservation` (written by the processors' `signalObservation.create`), surfaced via `getLivingUserProfile`. **The shadow scorer reads this. The rec path does NOT build it.**

| Option | One source of truth? | Divergence risk | Migration cost | Verdict |
|---|---|---|---|---|
| (i) graph-single (promote as-is) | **No** — would add the graph as a 2nd live store, and the live ranker/FI-STEP-1 stay on the feature-vector | **High** — **orphans FI-STEP-1** (dismiss writes `UserBehaviorSignal`, not the graph); empty `cuisineAffinities` give no gain; graph must be built per request | High (build/maintain graph on rec path; re-plumb candidate adapter; reconcile two stores) | ✗ defeats the purpose |
| (ii) feature-vector→graph adapter | Nominally one, but you maintain a lossy adapter | Medium — flat signal names (`likes_chicken`, `time_poor`) don't map cleanly to the graph's typed dims (`explorationScore`, `techniqueConfidence`…) | Medium — brittle adapter to keep in sync | ✗ awkward, hidden 2nd shape |
| **(iii) graft** | **Yes — the feature-vector** (already the live + FI-STEP-1 store) | **Lowest** — additive components in the live ranker; shadow stays the spec | Low–med — new scoring components + a derivation helper in `ranking.service.ts` | ✅ **recommended** |

**Why graft wins:** it keeps the **feature-vector as the single live user-model** (so FI-STEP-1's learn-from-rejection stays connected and there's no second store), brings over exactly the shadow math that the engine-proof validated (weekday-leaned `effortFit`, asymmetric `skillFit`, mealSlot routine-fit), and leaves the shadow scorer + its proofs intact as the reference. The cuisine-affinity term is deferred (it's empty in v1 in *both* engines) — graft it when the graph/affinities are hydrated, as a later step, without re-architecting.

**One source of truth guaranteed:** the live ranker reads only `feature-vector` + derived recipe attributes; no graph is introduced on the rec path; the shadow stack stays shadow.

## 3. Cold-start (empty profile, zero signals)
Safe, already handled — graft inherits it. `resolveWeightsForMaturity` (`ranking.service.ts:790-801`): when
`_data_behavioralReliability < 0.65` it applies `coldStartWeightBlend` (tilt to content: recipeUnderstanding /
ingredientIntelligence / popularity). A zero-signal user → sparse feature-vector → low reliability → content
tilt → relevant-by-content output, no errors. The grafted `effortFit`/`skillFit` with no learned effort/skill
signal resolve to **neutral defaults** (shadow `userSkill` floors ~0.56; `desiredEffort` from neutral
`quick01` → mid) and are down-weighted by the maturity blend anyway → they don't distort cold-start. Declared
onboarding prefs still flow via the existing `signal_pref_*` features. **No risk of irrelevant output or
zero-signal errors.**

## 4. Explainability + response shape — preserved
Graft adds entries to the existing `ScoreBreakdown` (`effortFit`, `skillFit`, …) with weights; the existing
`contributionCalculator.calculate(scores, weights)` + `explainability.service` already turn any scores map
into `contributions` + `explanation`, and `matchedSignals` is already populated. The route, response contract,
impression/exposure, and `why` are unchanged. **`scores` / `contributions` / `matchedSignals` / `explanation`
all preserved** — the UI + impression/exposure paths are unaffected.

## 5. Recommendation + safe build plan for FI-PHASE-2.2
**Recommendation: (iii) GRAFT** — port the shadow scorer's per-user math into the live `RankingService` over
the feature-vector; keep the shadow code as the proven spec; collective never grafted (pilot-gated).

**Files 2.2 would change:**
- `recommendation/pipeline/ranking.service.ts` — add a derivation helper (or new `recipe-attributes.ts`) for `estimatedEffort`/`skillLevel`/`mealSlot`/`cuisineTags`/`estimatedTimeMinutes` from `cookingTime`/`difficulty`/`mealType`/`region`/`categories`; add `effortFit` (weekday-leaned) + `skillFit` (asymmetric) + mealSlot routine-fit as scoring components reading the feature-vector + a `DecisionContext`; extend `SCORING_WEIGHTS` and wire into `weightedScore` + contributions. **Reconcile with the existing `behaviorFit` effort bits (time_poor/quick_meal_lover) to avoid double-counting effort** — replace those with the cleaner `effortFit`, don't stack them.
- tests: a ranker before/after proof + a derivation-helper unit spec.

**Stays frozen in 2.2:** the HARD allergy filter (`recipe-fit`/`recipe-integrity`/candidate pre-filter) + `getLivingUserProfile` (byte-identical); the shadow stack + `productUseEnabled`/`liveRankingChangedForUser` (graft copies the math, does NOT enable the shadow); **collective OFF**; cuisine-affinity deferred (graph empty in v1).

**Proof for 2.2 (no allergy touch, no collective, reproducible on the zip via jest + mocked prisma — mirrors the FI-STEP-1 ranker-effect spec):**
1. **Effort/skill effect:** a seeded feature-vector with a high quick-meal / low-skill signal ranks a quick/beginner recipe above a long/advanced one; flipping the signal flips the order — proving the grafted `effortFit`/`skillFit` move the **live** score.
2. **Cold-start:** an empty feature-vector returns a sane content-tilted list, no error.
3. **Allergy intact:** a seeded allergen recipe is never surfaced (hard filter upstream, unchanged).
4. **No double-count:** effort is scored once (effortFit), not also via behaviorFit.

---
```
FI-PHASE-2.1 — PROMOTE-SCORER DECISION (read-only)
candidate fields: present <cookingTime,difficulty,mealType,region,categories → so mealSlot/estimatedTimeMinutes/cuisineTags derivable> / derivable <estimatedEffort(from cookingTime±difficulty), skillLevel(from difficulty), mealSlot(from mealType), cuisineTags(from region+categories), estimatedTimeMinutes(=cookingTime), safetyFlags(=[] — allergy upstream)> / absent <noveltyTags → safe-default []>
source-of-truth recommendation: (iii) graft — because promote reads the identity-graph (a 2nd store the rec path doesn't build) and would ORPHAN FI-STEP-1's negative feedback (which writes the feature-vector); graft keeps ONE store (feature-vector) the ranker+FI-STEP-1 already use
ONE source of truth guaranteed by this choice: Y — live ranker reads only the feature-vector + derived recipe attrs; no graph on the rec path; shadow stays shadow
cold-start behavior on empty profile: safe — resolveWeightsForMaturity (<0.65 reliability → coldStartWeightBlend content tilt); grafted effort/skill resolve to neutral defaults + are down-weighted; no errors
response shape (scores/contributions/explanation) preserved: Y — grafted components are new ScoreBreakdown entries; contributionCalculator + explainability already generalize
allergy filter + getLivingUserProfile stay byte-identical in the plan: Y
collective stays OFF/gated: Y (never grafted; pilot-gated)
recommended next-step (2.2) build plan + files: graft effortFit/skillFit/mealSlot-context into ranking.service.ts (+ derivation helper) over the feature-vector; reconcile behaviorFit effort to avoid double-count; extend SCORING_WEIGHTS; jest before/after proof (effort/skill effect + cold-start + allergy intact); shadow/collective/allergy/profile frozen
design doc written to docs/audit/FI_PHASE_2_PROMOTE_DESIGN.md: Y
NO code changes (read-only): Y
```

## After the doc
STOP — no build. Founder + advisor read this; the advisor verifies the candidate-field map + the two-store /
source-of-truth finding against the code. If accepted, FI-PHASE-2.2 implements the graft along the plan in §5.
**Headline for the decision: "promote" as literally framed would fork the source of truth and disconnect the
learn-from-rejection we just shipped — graft reaches the same destination (the proven scorer math, live) with
one source of truth and far less risk.**
