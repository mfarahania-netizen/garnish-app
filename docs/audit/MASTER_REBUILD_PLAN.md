# THE MASTER REBUILD PLAN — Garnish

**Status:** the single authoritative rebuild route. Supersedes any feature-by-feature plan.
**Author stance:** lead architect, decisive, evidence-only. Every claim is grounded in `file:line` confirmed from source.
**Bar:** the founder's vision (TikTok/Spotify-for-food + "reads my mind" + never-abandon-the-user), not the category.
**Date:** 2026-06-20.
**Inputs synthesized:** `_rebuild/ai.md`, `PERSONALIZATION_{AUDIT,STANDARD,ROADMAP}.md`, `_findings/{algorithm,integrity,mindreading,data,architecture}.md`, `_map/profile.md`, `_research/FOUNDER_REQUIREMENTS.md`.

---

## 0. The thesis — validated, with one correction

**Thesis:** rebuild by **LAYER, not by feature**. Build the shared intelligence **FOUNDATION (L0) once**; then every feature (recsys, AI, planner, gamification, Food-DNA) is a **thin consumer** that *reads* L0. Sequencing by feature — "personalization first, then AI" — rebuilds both on a **severed foundation**, then re-wires both when the foundation lands = **double rework**.

**Verdict: the thesis is correct and the evidence is overwhelming.** Five independent adversarial audits converge on a single root cause from five angles: **the foundation is severed at the same joints that every feature depends on.**

- **AI** fails closed without `getLivingUserProfile()` and reuses the recsys `assessRecipeFit()` allergy logic (`ai.md:120-182`). Build AI before L0 → wire mock profile reads, later swap to real, re-test the entire allergy gate. Explicit rework.
- **Recsys** is a heuristic re-sort over a profile **hardwired to empty observations** (`profile-read.service.ts:112` — *confirmed*: `buildUserFoodIdentityGraph([], { mode: 'shadow' })`). Every user is cold forever.
- **The cook loop is severed** — *confirmed at source*: the web emits `cook_complete` with `{recipeId}` (`useCook.js:101`), but `processor.registry.ts:22-49` maps only `recommendation_cook` (which the web **never** emits), and `event-router.service.ts:9-13` silently no-ops any unmapped type (`if (processor) {...}`, no else). **Cooking teaches nothing.**
- **Context** is absent by construction — `GET /recommendations` takes only `userId`+`limit` (`recommendation.controller.ts:36-39`); every "mind-reading" surface is theater (`useHomeData.js:95-110`).
- **Consent** is not enforced at ingest — *confirmed*: `analytics.service.ts:57-99` writes `UserEvent` after only `eventQuality.assess`, no consent read; routing is fire-and-forget `.catch(console.error)` (`:94`). GDPR Art. 6/7 exposure.
- **Gamification / Food-DNA** read the same `getLivingUserProfile` / observation substrate (`_map/profile.md:78-95`).

All five wounds are in **L0**. Fix L0 once and all consumers light up; fix them per-feature and you re-fix L0 five times.

**The one correction to the inputs.** The roadmap and `ai.md` both imply a **partly parallel** path (e.g. `ai.md §8` Phase 1–4 lets behavior-engine maturity be "optional/last"; the roadmap interleaves observability late). **That is wrong for a zero-rework rebuild.** Two things the inputs under-prioritize must move *into* L0, before any consumer:
1. **Consent-at-ingest + the full `SignalObservation` contract + `UserEvent.recipeId`** are **L0 data-contract changes**, not L1 polish. Every consumer writes/reads through them; landing them after a consumer means a migration + a re-test of that consumer. The Standard's own contract table (`PERSONALIZATION_STANDARD.md:304-316`) marks all three **"add"** — they belong in the spine.
2. **The admin observability pipeline** (founder R8: "don't delete one second"; the meat→mushroom behavioral cabin) is an **L0 read surface**, not an L3 nicety. It is how the founder *sees* the loop close; without it the rebuild is unfalsifiable. The shadow tree's "control-plane/activation-review" theater is **deleted** and replaced by a thin honest event/observation viewer over L0.

Everything else in the inputs holds. Net: **L0 is slightly bigger than the roadmap's "Phase NOW," and absolutely nothing consumer-facing precedes it.**

---

## 1. The dependency graph (the proof of the sequence)

Read bottom-up. Each tier **only reads the tiers below it**. An arrow means "cannot be correct until."

```
                 ┌─────────────────────────────────────────────────────────┐
  L3 CONSUMERS   │ Proactive/Notif │ Planner+Shopping+Pantry │ Gamification │
  (thin readers) │                 │                         │  + Food-DNA  │
                 └─────────┬───────────────────┬─────────────────────┬──────┘
                           │ reads ranked feed  │ reads profile+ctx   │ reads profile+signals
                 ┌─────────▼────────────────────▼─────────────────────▼──────┐
  L2 AI          │ grounded assistant: getLivingUserProfile() + L1 taste     │
  (founder #1)   │ vector + assessRecipeFit() reuse + HARD allergy gate      │
                 └───────────────────────────┬───────────────────────────────┘
                                             │ reads taste model + ranked candidates
                 ┌───────────────────────────▼───────────────────────────────┐
  L1 RECOMMENDER │ retrieval → learned ranking → re-rank(bandit) → explain    │
  (learning)     │ taste embeddings · collective trio · context re-score     │
                 └───────────────────────────┬───────────────────────────────┘
                                             │ reads living profile + counters + context + signals
                 ┌───────────────────────────▼───────────────────────────────┐
  L0 FOUNDATION  │ ① total event capture + consent@ingest                     │
  (the spine —   │ ② signal routing that CLOSES THE COOK LOOP                 │
   everything    │ ③ unified hydrated taste/identity model (getLivingProfile) │
   reads it)     │ ④ real-time RecommendationContext object                   │
                 │ ⑤ admin/observability pipeline (founder R8)                │
                 │    + Phase-0 counters · full SignalObservation contract    │
                 └────────────────────────────────────────────────────────────┘
```

**The ordered dependency list (who depends on what — the locked sequence):**

1. **`UserEvent` capture + consent-at-ingest** depends on nothing. *Everything* depends on it (every signal, counter, profile, ranker feature). → **build first.**
2. **Signal routing (cook loop) + full `SignalObservation` contract** depends on (1). The taste model, counters, profile hydration all depend on it.
3. **`getLivingUserProfile` hydration** depends on (2). The **allergy gate, recsys, AI, gamification, Food-DNA all depend on it** — this is the single most-depended-on node (`_map/profile.md:78-95`, `data.md:11`).
4. **Phase-0 counters** depend on (1). Deflation, cohort priors, bandit posteriors, ranker calibration all depend on them (`PERSONALIZATION_STANDARD.md:138`).
5. **`RecommendationContext` object** depends on (1) for recent-cooks/pantry. The contextual ranker, briefing, proactive layer depend on it.
6. **Observability pipeline** depends on (1)+(2)+(3) — it is the read view. The founder's verification depends on it.
7. **L1 recommender** depends on 3,4,5 (profile + counters + context).
8. **L2 AI** depends on (3) [allergy gate, fail-closed] **and** L1 [taste vector + `assessRecipeFit` reuse] (`ai.md:343-346`).
9. **L3 consumers** depend on L1 (ranked feed) and L0 (profile/context/signals); each is a thin reader.

There is exactly **one** correct order. It is not negotiable: 1 → 2 → 3 → {4,5,6} → 7 → 8 → 9.

---

## 2. The LAYERED rebuild sequence — no rework, each layer states what it unblocks

### L0 — FOUNDATION (the spine everything reads)

> **Unblocks: literally everything.** No consumer is correct until L0 is. This is the only layer with no upstream dependency, and the only one whose absence causes *rework* (not just absence) in every layer above.

L0 is five organs. For each: the **data contract** and the **precise broken joint to fix**.

#### ① Total event capture + consent-at-ingest (fixes the GDPR gap)

- **Broken joint:** `analytics.service.ts:57-99` — `trackEvent` writes `UserEvent` after only `eventQuality.assess`; **no `ConsentState` read**. Consent is enforced only in the *offline* signal layer (`signal-observation-engine.ts:88-95`), which never runs on ingest. EU-targeted app → direct GDPR Art. 6/7 exposure (`data.md:13`, `AUDIT C10`).
- **Broken joint:** `UserEvent` has **no `recipeId` column** (*confirmed* `schema.prisma:385-403`: `type`, `payload` stringified JSON only). Trending/popularity group on `payload` substring (`candidate-generator.ts:192-209`) — fragile (`data.md:17`).
- **Data contract (the canonical event envelope):**
  ```
  UserEvent {
    id, userId, type, timestamp, sessionId?, page?, duration?,
    recipeId        String?    // ADD — first-class, indexed, replaces payload-scan
    consentPurpose  String     // ADD — stamped at ingest: core|analytics|personalization
    payload         String?    // demote to true extras only
  }
  ```
- **Fix:** read `ConsentState` in `trackEvent` (or a `ConsentGuard`); `core` always written, `analytics`/`personalization` dropped-or-tagged by grant; stamp `consentPurpose` on every row; add+backfill `recipeId`; index `@@index([userId, type, recipeId, timestamp])`.

#### ② Signal routing that CLOSES THE COOK LOOP

- **Broken joint (the deepest wound):** `processor.registry.ts:22-49` maps `recommendation_cook`/`recommendation_save` but **the web never emits those** (`integrity.md:15`); it emits `cook_complete` (`useCook.js:101`, *confirmed*). `event-router.service.ts:9-13` silently no-ops unmapped types. → **cooking is a personalization no-op** (`AUDIT C1`).
- **Broken joint:** the positive extractor `extractSignalsFromRecipe`→`likes_stew`/`likes_chicken` fires only on those dead events (`signal-calculator.service.ts:60-67`) → dead code (`AUDIT C3`). `favorite_add`/`recipe_view` write only `likes_high_protein`/`prefers_vegetarian` via hardcoded **Persian** name-matching (`recipe.signal-processor.ts:20-53`) — silently always-false for the NL/EU corpus (`data.md:18`, M2).
- **Broken joint:** `favorite_remove` writes a *positive* observation regardless (`processor.registry.ts:25`, `recipe.signal-processor.ts:57-64` — `AUDIT M6`). Routing is fire-and-forget `.catch(console.error)` (`analytics.service.ts:94`) — can race the feature rebuild (`integrity.md:18`).
- **Broken joint:** `SignalObservation` is a thin `{signalName, eventId, weight}` row (*confirmed* `schema.prisma:575-585`) — cannot carry `confidence`/`strength`/`value`/`consentPurpose`/`privacyClass`; the observed graph is **rebuilt from fabricated means** (`recommendation-shadow-a8-adapters.ts:62-77`, `data.md:15`).
- **Data contract (the full observation, persisted):**
  ```
  SignalObservation {
    id, userId, signalName, eventId, observedAt,
    weight, strength, confidence  Float
    value           Json?     // structured payload (per-ingredient, cuisine)
    privacyClass    String
    consentPurpose  String
  }
  ```
- **Fix:** register `cook_complete` → `applyPositiveFeedback(userId, recipeId, ~0.4)` + `extractSignalsFromRecipe` + per-ingredient signals + full `SignalObservation` write; re-point `favorite_add` through the same extractor; add a `favorite_remove` negative branch; derive nutrition/diet tags from **structured** `nutritionPer100g`/`dietFlags`/`allergens`, not name lists; add the **`cuisine_affinity`** signal keyed on `cuisine.primary`/`region` (already *designed* `signal-registry.ts:111`); route high-value events through a **durable outbox with await+retry**, delete the orphan `recommendation_cook`/`save` taxonomy constants.

#### ③ The unified hydrated taste/identity model

- **Broken joint:** `profile-read.service.ts:112` (*confirmed*) passes `[]` empty observations to `buildUserFoodIdentityGraph([], { mode: 'shadow' })` — so the "0.80 observed weight" maturity formula is **unreachable at runtime**; every user cold forever (`AUDIT C2`, `data.md:11`). Yet `getFoodDnaProjection` (`:141-147`) *already* hydrates from real `SignalObservation` — the correct path exists, it is simply not used by the live profile.
- **Data contract:** `getLivingUserProfile(userId)` → `LivingUserProfile v2` (`living-profile.ts:105-122`): `reconciled.dimensions.{allergies(declared-only),dietary_pattern,effort,skill}` + `observed` (taste/cuisine vectors, hydrated) + `maturity` band. **Invariant: allergies declared-only forever; taste/effort/skill observed** (`profile.md:83-88`, `STANDARD Pillar 10`).
- **Fix:** make `getLivingUserProfile` hydrate observed dims from persisted `SignalObservation` **the same way `getFoodDnaProjection` does**, behind consent+safety gate. This single change makes warm-up real and is what AI/recsys/gamification all wait on.

#### ④ The real-time context object

- **Broken joint:** `recommendation.controller.ts:36-39` / `pipeline.getRecommendations(userId, limit)` thread **zero** context; recs byte-identical at 8am/11pm (`AUDIT C6`, `mindreading.md:16`). No `PantryItem` model exists (*confirmed*: no `model Pantry*` in schema). The time-aware `Daily Briefing` (`briefing.controller.ts`) is built but **no web screen calls it** (`mindreading.md:19`).
- **Data contract:**
  ```
  RecommendationContext { now, mealSlot, season, occasion, recentCooks[], pantry[], household }
  PantryItem { userId, ingredient, qty, addedAt, staleAt }   // ADD model
  ```
- **Fix:** plumb `RecommendationContext` from the request into the ranker; start with **time-of-day → mealType candidate gating** (smallest change that makes 8am ≠ 8pm and unlocks every later context signal); add `PantryItem`; default `match_pantry_recipes` to read it (today re-typed every message — `match-pantry-recipes.tool.ts:30`).

#### ⑤ The admin/observability pipeline (founder R8)

- **Broken joint:** the *existing* observability is the shadow "control-plane/activation-review" — ~2,200 LOC whose verdict is hardcoded `promotionAllowed:false` (`recommendation-founder-review-evidence-pack.ts:21`, `architecture.md:15`). It observes *itself*, not the user loop. Founder R8 ("don't delete one second"; meat→mushroom behavioral cabin) has **no honest read surface.**
- **Data contract:** read-only views over L0 — `eventStream(userId)`, `observations(userId)`, `profileTrace(userId)` (declared→observed→reconciled), `counters(recipeId)`. PII-free, owner/admin gated.
- **Fix:** **delete** the shadow control-plane; build a thin honest viewer over L0's tables. This is how the founder *watches the loop close* — the rebuild's acceptance test surface.

**Also in L0 — Phase-0 counters (substrate for L1):** materialize per-recipe and per-cohort rolling counters `{impressions, views, quick_exits, cook_complete, favorite, skip, not_interested}` + impression log with `position`+`propensity`+`reward` (`STANDARD:138,311`). Every event is logged; it is simply not aggregated. **This unblocks the entire collective trio + bandit + ranker calibration with arithmetic.**

> **L0 exit criterion:** an integration test proves *cook N stews → stew-similar recipes rank higher on the next `GET /recommendations`*, recs differ by time-of-day, every `UserEvent` carries `consentPurpose`, and the admin viewer shows the loop closing for a real user. **No consumer work starts until this passes.**

---

### L1 — THE LEARNING RECOMMENDER (per `PERSONALIZATION_STANDARD`)

> **Unblocks: AI's taste grounding (L2) and the ranked feed every L3 consumer reads.** Builds *only* on L0 — reads the hydrated profile, the counters, the context object. Nothing here re-touches L0.

Built as the Standard's two-stage funnel, in ROI order (each is arithmetic over L0, not GPUs):

1. **Two-stage funnel, named** (Pillar 3): Retrieval (union 8 buckets + dedup, **seed candidates from `cook_complete`/`favorite_add`** — today cooks don't even pull neighbors, `candidate-generator.ts:84,116`) → Ranking → Re-rank. Fix trending to group on the new `recipeId` column.
2. **Collective trio** (Pillar 5, founder examples #1–#3): **(a)** popularity **deflation** — Beta/Wilson two-sided accept-rate, cohort-conditioned (replaces `(views+favorites*2)/250` `ranking.service.ts:509-518`); **(b)** **hierarchical shrinkage prior** global→cohort→user (region switches on with markets — covers "users like you" until embeddings); **(c)** **item-item co-engagement CF** ("cooked A → cooked B", replaces the health-goal join `candidate-generator.ts:166-190`).
3. **Thompson bandit explore slot** (Pillar 6 — the flywheel): ~10–20% of slots sampled from each dish's `Beta(α+pos, β+neg)` posterior over L0 counters; higher early, annealed; keeps explore flowing to deflated dishes (reversible, never a ban).
4. **Learned ranking** (Pillar 4): keep the 10-component blend as the **cold-start fallback only**; calibrate components into empirical p(cook|shown)/p(skip|shown) from L0 counters; train a **LambdaMART/logistic ranker** on the impression log (temporal split) when labels accrue. Deterministic experiment bucketing `hash(userId+expId)` (replaces `Math.random()` `experiment-engine.service.ts:25`). Split the 1,179-LOC god-service (*confirmed*).
5. **Taste embeddings** (Pillar 2): recipe content embedding from ingredient feature vectors (ships at zero interactions — the moat); user vector = commitment-weighted centroid of engaged recipes. **The same object the user sees and tunes.**
6. **Transparency** (Pillar 8): "Because you cooked X" reasons from concrete history (substrate exists: `assessRecipeFit`, contribution calculator) — replaces debug-panel percentages (`explainability.service.ts:11-26`); tunable Taste-DNA where edits are training signal.
7. **Honest evaluation** (Pillar 9): replace the **circular synthetic nDCG proof** (`recommendation-learning-proof.ts:76-124`, `AUDIT C7`) with temporal held-out eval + interleaving; **allergy-violation-rate = 0** as a release gate.

> **L1 exit criterion:** all four founder acceptance tests pass on real pilot users (individual loop · collective deflation with minority survival · regional-prior decay · legible+tunable).

---

### L2 — AI grounded in the L0 living profile + L1 taste model (the founder's #1)

> **Unblocks: the founder's #1 priority — an assistant that knows the user.** Depends on **both** L0 (the fail-closed allergy gate) **and** L1 (the taste vector + the *shared* `assessRecipeFit`).

**Why it is near-worthless before L0** (`ai.md:120-182`): the AI's *entire safety contract* is reading the **same reconciled allergy set** the recommender uses. Before L0:
- It must wire **placeholder profile reads** → later swap to real `getLivingUserProfile()` → **re-test the whole allergy gate.**
- It must **reimplement recipe filtering** → later match the audited `assessRecipeFit()` → divergence risk on a *safety* path.
- Its maturity is stuck "forming" because the snapshot's `signals` is always empty (`behavioral-context-snapshot.service.ts:41`) — **fixed for free by L0 ③'s hydration.**

So AI built first = guaranteed rework on the one path where a bug is catastrophic (a peanut recipe to a peanut-allergic user). Built after L0+L1, AI is a **thin consumer**: `getLivingUserProfile()` → `assessRecipeFit()` filter → grounded reply, with the live-LLM path (currently wired-but-off, `model-provider.factory.ts:51-53`) gaining a real taste vector to ground on. The deterministic grounded reply already works today (`ai.md:300-303`) — L0+L1 make it *personal* instead of generic.

---

### L3 — CONSUMERS (each a thin reader of L0/L1)

> **Unblocks: the felt product surface.** Each is a thin reader; none re-touches L0/L1. Build in parallel once L1 lands.

- **Proactive / notifications** (`mindreading.md:22`, R5/R11): wire `GET /briefing/today` to a real Home hero sourced from L1's ranker+context (not `findAll(0,12)`); add a real push channel; consented meal-time/low-pantry/saved-not-cooked triggers; frequency-capped, killable (founder: care, not nagging). **Lifecycle/retention "WHY" engine** (R9) lives here as a thin reader of L0's signal stream → per-state intervention.
- **Meal-planning + shopping/pantry** (R11): planner reads L1 ranked feed + L0 `RecommendationContext`; shopping derives from the plan; the real `PantryItem` (L0 ④) replaces the **fake pantry rail** (`useHomeData.js:95-101`) with true matches + proactive low-pantry nudge.
- **Gamification + Food-DNA** (R11): both already read the L0 profile/signal substrate (`_map/profile.md`); Food-DNA becomes the **editable Taste Portrait** (L1 #6) — edits flow back as training signal. Gamification counts the now-real `cook_complete`.

---

## 3. KEEP / DELETE / EXTRACT ("imagine we have nothing", done right)

### DELETE (prune now — zero user-facing regression; web references none of it)

- **The ~13k-LOC shadow/lab/control-plane tree** (`runtime-shadow/` = *148 files confirmed* / ~9,092 LOC + 4,196 test LOC). Output "intentionally discarded" (`recommendation-pipeline.service.ts:76-79`); activation verdict hardcoded `promotionAllowed:false` (`recommendation-founder-review-evidence-pack.ts:21`). The single biggest maintenance liability for a solo founder (`architecture.md` verdict: ~90% gold-plating). **Before deleting, EXTRACT the 1–2 ideas worth keeping (below); delete the rest including the "founder-review/activation-review" labs (~2,200 LOC of process-theater) and the 4,196 LOC of "prove OFF stays OFF" tests.**
- **The circular synthetic "learning proof"** (`recommendation-learning-proof.ts:76-124`) — proves nothing about real users; replaced by L1's temporal eval.
- **Dead taxonomy constants** — `recommendation_cook`/`recommendation_save` (`eventTaxonomy.js:128-130`, zero emitters); the international cuisine token maps over a Persian corpus (`taste-affinity.builder.ts:20-38`).
- **Theater surfaces** — the fake pantry rail (`useHomeData.js:95-101`), the hardcoded "AI Whisper" `recList[0]`+"برای امشب" (`:108-110`), the 7 honest-but-dead `NotImplementedException` admin routes (`recommendation.controller.ts:114-211`).
- **The dry-run-forever retention prune** (`retention.service.ts:27-37`) — replace with a real scheduled prune, not carried as scaffolding.

### EXTRACT (to `research/` — earned later, not deleted)

- **Cuisine affinity + collective co-occurrence signals** (`recommendation/intelligence/*`) — genuinely good, imported by zero live files (`architecture.md:16`). **Promote the two into L1's live path; extract the rest to `research/` until earned on the live path.**
- **The offline-eval harness** (`evaluation/offline-metrics.ts`) — keep as the seed of L1's honest temporal eval.

### KEEP (the real substrate — do not touch)

- **The HARD three-layer allergy gate** — inviolable, the category's strongest trust moat (`profile.md:83-88`, `AUDIT §2`). The model for L0 ③.
- **The ingredient-level content data moat** (per-ingredient taste/texture/nutrition/role + GRIS + USDA-locked nutrition) — the asset that lets a *learning* engine work at low scale (`STANDARD:11`).
- **Candidate-source diversity** (the 8-bucket generator — a two-stage funnel in embryo) and **exposure de-dup**.
- **The live negative (dismiss) loop** — the one correctly-wired taste path (`useDismissRecommendation.js:21`).
- **The explainability substrate** (`assessRecipeFit`, `ContributionCalculatorService`) — feeds L1's "because you cooked X".

---

## 4. THE FIRST SPRINT — the exact, ordered, do-this-now checklist for L0

L0 is unambiguous and everything waits on it. Do these in order; each is verifiable.

1. **Schema migration — the L0 data contracts (do first, one migration):**
   - `UserEvent`: add `recipeId String?` (+ backfill from `payload`) and `consentPurpose String`; add `@@index([userId, type, recipeId, timestamp])`. *(`schema.prisma:385-403`)*
   - `SignalObservation`: add `strength`, `confidence Float`, `value Json?`, `privacyClass String`, `consentPurpose String`. *(`schema.prisma:575-585`)*
   - Add `model PantryItem { userId, ingredient, qty, addedAt, staleAt }`.
2. **Consent-at-ingest:** in `analytics.service.ts:trackEvent`, read `ConsentState`; write `core` always, drop/tag `analytics`/`personalization` by grant; stamp `consentPurpose` on every `UserEvent`. *(`:57-99`)*
3. **Close the cook loop:** register `cook_complete` in `processor.registry.ts` → processor that calls `applyPositiveFeedback(userId, recipeId, ~0.4)` + `extractSignalsFromRecipe` + per-ingredient signals + full `SignalObservation` write. *(`processor.registry.ts:22-49`, `event-router.service.ts:9-13`)*
4. **Fix the extractors:** re-point `favorite_add` through `extractSignalsFromRecipe`; add a `favorite_remove` negative branch; derive nutrition/diet from **structured** fields not Persian name lists; add the `cuisine_affinity` signal keyed on `cuisine.primary`/`region`. *(`recipe.signal-processor.ts:20-64`, `signal-registry.ts:111`)*
5. **Hydrate the live profile:** make `getLivingUserProfile` hydrate observed taste/cuisine/effort/skill from persisted `SignalObservation` **the same way `getFoodDnaProjection` does** (`:141-147`), behind consent+safety; **allergies stay declared-only**. *(`profile-read.service.ts:112`)*

Then, to satisfy the L0 exit criterion: **(6)** materialize Phase-0 counters + impression/reward log; **(7)** plumb a minimal `RecommendationContext` (time-of-day → mealType gating) into the pipeline; **(8)** make routing durable (outbox + await/retry, kill `.catch(console.error)`); **(9)** build the thin admin observability viewer over L0; **(10)** write the integration test: *cook N stews → stew-similar rank higher next fetch* + *recs differ by time-of-day* + *every event carries consentPurpose*. **(11)** delete/extract the shadow tree (frees the budget; do after the promote-worthy signals are extracted).

---

## 5. The one-screen ordered master checklist (whole app, dependency-ordered)

```
L0 FOUNDATION  (BLOCKS EVERYTHING — build first, exit-gated)
 [ ]  1. Schema: UserEvent.recipeId + consentPurpose; SignalObservation full contract; PantryItem
 [ ]  2. Consent-at-ingest in trackEvent (GDPR gap)                          ← unblocks lawful collection
 [ ]  3. Close cook loop: register cook_complete → positive feedback+signals ← unblocks ALL personalization
 [ ]  4. Fix extractors (favorite_add/remove, structured tags, cuisine_affinity)
 [ ]  5. Hydrate getLivingUserProfile from real SignalObservation            ← unblocks recsys/AI/gamif/DNA
 [ ]  6. Phase-0 counters + impression/position/propensity/reward log         ← unblocks collective trio+bandit
 [ ]  7. RecommendationContext object (time→mealType first) + PantryItem      ← unblocks context+proactive
 [ ]  8. Durable signal routing (outbox, await+retry)
 [ ]  9. Admin observability viewer over L0 (founder R8)
 [ ] 10. DELETE shadow tree (~13k LOC) / EXTRACT cuisine+collective to research/
 [ ] 11. L0 EXIT TEST: cook→stew loop closes · recs differ by time · consent stamped  ✅ GATE

L1 LEARNING RECOMMENDER  (reads L0 only)
 [ ] 12. Name the two-stage funnel; seed candidates from cooks; fix trending (recipeId)
 [ ] 13. Collective trio: deflation (Beta/Wilson) · cohort shrinkage prior · item-item CF
 [ ] 14. Thompson bandit explore slot (flywheel; reversible deflation)
 [ ] 15. Learned ranking: calibrate→LambdaMART on temporal split; blend=cold fallback; split god-service
 [ ] 16. Taste embeddings (recipe content vector + user centroid)
 [ ] 17. "Because you cooked X" reasons + tunable Taste-DNA (edits=training signal)
 [ ] 18. Honest eval: temporal held-out + interleaving; allergy-violation-rate=0 gate
 [ ] 19. L1 EXIT TEST: 4 founder acceptance tests pass on real pilot users     ✅ GATE

L2 AI  (reads L0 profile + L1 taste; founder #1)
 [ ] 20. Wire grounded reply → getLivingUserProfile + assessRecipeFit reuse (no re-impl)
 [ ] 21. Personalize on L1 taste vector; enable live-LLM path with grounding injection + output gate

L3 CONSUMERS  (thin readers of L0/L1 — parallel after L1)
 [ ] 22. Proactive/notifications: briefing hero + push channel + consented triggers; lifecycle "WHY" engine (R9)
 [ ] 23. Meal-planning + shopping + real pantry (replace fake rail) + low-pantry nudge
 [ ] 24. Gamification (real cook_complete) + editable Food-DNA Taste Portrait
```

---

## 10-LINE EXECUTIVE SUMMARY

1. **Locked sequence — rebuild by LAYER, not feature:** L0 FOUNDATION → L1 LEARNING RECOMMENDER → L2 AI → L3 CONSUMERS. Verified: all five audited wounds (severed cook loop, empty-observation profile, zero context, no consent-at-ingest, dead intelligence) sit in L0, and AI/recsys/planner/gamification/Food-DNA all *read* L0 — so sequencing by feature rebuilds both AI and recsys on a severed foundation = double rework.
2. **One correction to the inputs:** consent-at-ingest, the full `SignalObservation` contract + `UserEvent.recipeId`, and the admin observability pipeline are **L0 spine work, not later polish** — landing them after a consumer forces a migration + re-test of that consumer.
3. **First 5 concrete steps (the L0 sprint):**
   (1) schema migration — `UserEvent.recipeId`+`consentPurpose`, full `SignalObservation` contract, `PantryItem`;
   (2) consent-at-ingest in `analytics.service.ts:trackEvent` (closes the GDPR gap);
   (3) close the cook loop — register `cook_complete` in `processor.registry.ts` → `applyPositiveFeedback`+`extractSignalsFromRecipe`+full observation write;
   (4) fix the extractors — `favorite_add/remove`, structured (not Persian-name) tags, add `cuisine_affinity`;
   (5) hydrate `getLivingUserProfile` from real `SignalObservation` (allergies stay declared-only).
4. **Top-3 to delete now:** (a) the ~13k-LOC shadow/lab/control-plane tree (148 files, output discarded, `promotionAllowed:false`) — extract cuisine+collective signals first, then delete; (b) the circular synthetic nDCG "learning proof"; (c) the theater — fake pantry rail, hardcoded "AI Whisper", dead `recommendation_cook/save` constants and 501 admin routes.
5. **Gate:** no consumer work begins until the L0 exit test passes — *cook N stews → stew-similar rank higher next fetch*, recs differ by time-of-day, every event carries `consentPurpose`.

**FILE:** `C:\dev\garnish-app\docs\audit\MASTER_REBUILD_PLAN.md`
