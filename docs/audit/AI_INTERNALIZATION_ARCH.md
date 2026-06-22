# Garnish Internalized Intelligence Architecture

> ## ⚠ AUTHORITATIVE CORRECTIONS (verified against the live DB, 2026-06-22 — these OVERRIDE any contrary claim below)
> The post-design critique caught factual errors in §0/§4; I re-verified against the live `garnish_db` and the
> code. The corrected truths:
> 1. **The moat data is PRESENT and rich (the thesis is STRONGER than the draft said).** `substitutionOptions` is
>    populated on **995/1008** ingredients (rich objects: `replaceWithIngredientId, reason, impact{taste/texture/
>    nutrition/allergenRisk}, confidence, notesFa, bestUseCases`); `healthContext` on **1008/1008**. The draft's
>    "healthContext empty / substitutionOptions unused" is WRONG — ignore it.
> 2. **`suggest_substitutions` has a LIVE CORRECTNESS BUG (reclassify to P0 BUG-FIX, not enhancement).** Verified:
>    the curated objects key the target by `replaceWithIngredientId` (e.g. `ing_salt_table`) and have NO
>    `name/nameFa/label/value`, so `toStringArray()` (ai/tools/grounding-utils.ts:15) returns `[]` → `curatedCount=0`
>    (suggest-substitutions.tool.ts:79) → for non-source-locked ingredients it FALLS THROUGH to coarse same-category
>    peers (the exact `سیب‌زمینی→گوجه` junk the code comment warns against). The rich curated swaps are silently
>    dropped today. FIX = resolve `replaceWithIngredientId` → the referenced ingredient's name + surface the rich
>    object. This is the perfect first internalization win: zero-LLM, fixes a live low-quality answer, proves the thesis.
> 3. **The percentages are POST-ENRICHMENT DESIGN TARGETS, not launch-day numbers.** Zero-LLM ~70–78% (T0+T1) and
>    billed-generation ~12–18% assume GRIS richness at scale — but GRIS is a ~2-recipe pilot today, so launch-day
>    zero-LLM is LOWER until authoring lands. "<10% of interactions touch ANY model" is NOT achievable (messy
>    free-text parsing, T2, is irreducible) — but that parse is a CHEAP classify; "<10–15% bill GENERATION tokens"
>    IS the real, reachable cost target. Never conflate the two in a deck.
> 4. **Dutch deterministic templates must be P0, not "start early in P1."** Today there is ZERO Dutch in any
>    deterministic string, so the graceful-abstention fallback (a Persian recipe list) is a useless dead-end for the
>    Dutch general-public target until Dutch templates exist.
> 5. **Verify before banking:** `FeatureContributionLog` may be empty in the live serve path (ranker default-OFF) →
>    the explain-why engine could stay a stub; the admin metric-trees are greenfield (not "on existing"); the
>    `AssistantContext` typed ingest is a FE contract change across 5 surfaces (the P1 window is optimistic).
>
> ---

> The definitive architecture for Garnish's AI. Synthesizes four design tracks (query-universe split · deterministic intelligence layer · minimal-LLM boundary · admin L2b semantic layer) with the existing rails (`AI_DESIGN_SPEC.md` v2, `AI_STANDARD.md`). Code-grounded against `apps/server/src/ai/**`, `apps/server/prisma/schema.prisma`, the recommendation/ranking stack, the Prisma `Ingredient` dictionary, and `Recipe.gris` (GRIS v2.1). Provider = **Gemini** (free/sandbox · paid/EU), abstracted at the `ModelProvider` seam. Persian-first; EU/Holland **general-public** launch. Price = **€7/mo**.
>
> **THESIS.** A *giant deterministic intelligence engine* answers the vast majority of every-moment user help — recipe page, meal plan, shopping list, AI page, during-cook, any food/health question — at world-class quality with **ZERO LLM**. Gemini is a *tightly-grounded last resort* for the small residue that genuinely needs synthesis. **The same engine powers the ~200 admin params.** One unifying rule across both faces: **the deterministic core computes the answer/number; the LLM only narrates the sentence — it is never the source of a fact, a quantity, or a safety decision.**

---

## 0. Reality Check (verified in code 2026-06-22, not asserted)

[قطعی] These are confirmed by reading the real files — they define what we are building *from*:

- **The deterministic floor already exists and is large.** `grounded-reply.service.ts` runs the HARD allergy gate (`assessRecipeFit` + `analyzeRecipeIntegrity`), establishes the safe set FIRST, fails closed (`unsafe_set_unavailable`), re-screens live output (`screenLiveOutput`), and renders a real reply with NO model call (`composeDeterministicReply`). 8 read-only grounded tools are registered (`tool-registry.service.ts`). The honest-when-missing contract is *already implemented* at the tool layer via `resultStatus` enums (`ingredient_not_found` / `no_substitution_data` / `unavailable` / `empty_query`), not aspirational.
- **The data moat is prose-ready but partly thrown away.** `Ingredient` carries `tasteProfile`, `textureProfile`, `cookingBehavior`, `substitutionOptions`, `healthContext`, `aiContext`, `dietFlags`, `allergens`, `nutritionPer100g`, `cuisineRelevance`, `marketAvailability`, `recipeInputAliases` (all `Json?`, schema lines 209-235). `Recipe.gris` (line 194) carries `whyItWorks[]{point,explanation,testedBecause}`, `troubleshooting[]{problem,fix,stepRef}`, `steps[]{sees,doneness,recovery,durationMin,flame,weightG}`, `keep{storage,reheat,freeze}`, `swaps[]`. **Most user questions map to a FIELD, not a generation.**
- **The single biggest waste of existing data:** `suggest-substitutions.tool.ts` calls `toStringArray(source.substitutionOptions)` (lines 79, 117) — it discards `replaceWithIngredientId`, `impact{taste,texture,nutrition,allergenRisk}`, `confidence`, `bestUseCases`, `notesFa` and keeps only a guessed name. The rich graph data is authored and sitting unused.
- **Scaling/nutrition are already pure deterministic code** (`recipe-personalize.ts`): per-serving = Σ(weightG × per100g/100) ÷ baseServings; scaling multiplies weights and servings together (per-serving invariant); coverage flag (`full|partial|none`, ≥60%) instead of a fabricated number.
- **The cost system is blind.** `ai-cost-rate-catalog.ts` ships `PRODUCTION_RATE_CATALOG = []` → `estimateCostUsdFromCatalog` returns `cost: null`. `ai-cost-controller.service.ts` is an in-memory `Map` (resets on restart, drifts across instances).
- **Retrieval is keyword `contains`.** `grounded-reply.service.ts → retrieveCandidateIds → search_recipes` is Prisma substring — silent dead-end on synonyms.
- **Explain-why is a stub.** `explain-recommendation.tool.ts` only checks `RecommendationExposure` existence and returns one canned string. Meanwhile `FeatureContributionLog{userId,recipeId,featureKey,contribution,finalScore}` (schema 686-699) **already persists per-feature normalized contributions at serve time** — the exact raw material for deterministic explain-why, completely unused. Real `featureKey`s in code: `tasteAffinity`, `behaviorFit`, `outcomeFit`, `recency`, `quick_meal_lover`, `breakfast_person`, `comfort_food_lover`, `family_cook` (`diagnostics.controller.ts:443-448`).
- **The conversational-allergy hole is structural.** The gate reads allergens ONLY from `reconciled.dimensions.allergies` (`grounded-reply.service.ts:208`); a mid-chat "I'm allergic to walnuts" lands in the untrusted LLM turn the gate never reads → silently ignored. Closed in §4.4.
- **`healthContext` is empty on real records** (`{benefits,cautions,goodForGoals,avoidForGoals}` unpopulated); `nutritionConfidence` is `source_locked` on only ~258 ingredients; GRIS is a vertical-slice rollout, not all ~1,008 recipes.

**Non-negotiable invariant (unchanged):** the deterministic HARD allergy/safety gate lives OUTSIDE the LLM, runs pre-injection AND post-generation, fails closed, and is the only thing that decides "safe." No engine in this architecture may relax, reimplement, or bypass `assessRecipeFit` / `analyzeRecipeIntegrity`. Every engine calls *into* it.

---

## 1. The Layered Architecture (diagram-in-words)

Five layers, top to bottom. A turn flows **down** until it is answered; the goal of every layer is to *terminate the turn before it reaches the next, more expensive one*.

```
                       ┌──────────────────────────────────────────────────────────┐
  EVERY SURFACE  ───▶  │  L0  CONTEXT INGEST                                        │
  recipe page          │  typed AssistantContext per screen: {route, recipeId,     │
  meal plan            │  GRIS slice, focusedIngredientId+attrs, currentStepIndex, │
  shopping list        │  L0 derived signals, reconciledAllergenSet, locale}       │
  AI/chat page         └───────────────────────────┬──────────────────────────────┘
  during-cook                                       ▼
  free-form Q          ┌──────────────────────────────────────────────────────────┐
                       │  L1  DETERMINISTIC ROUTER (IntentClassifierService)        │
                       │  PURE function, sub-ms, ZERO network. normalize(fa/nl/en)  │
                       │  → {intent, modelTier NONE|CHEAP|STRONG, dataScope,        │
                       │     cacheable, safetyRelevant, confidence}                 │
                       │  THE COST GOVERNOR. Fails toward MORE cost/safety.         │
                       └───────────┬───────────────────────────────┬──────────────┘
                            tier=NONE / cache hit            tier=CHEAP|STRONG
                                   ▼                                ▼
   ┌──────────────────────────────────────────────┐   ┌──────────────────────────────┐
   │  L2  DETERMINISTIC INTELLIGENCE CORE (the     │   │  L3  ANSWER COMPOSITION       │
   │  "thousands of parameters" engine)            │   │  Engine 3: TemplateRegistry   │
   │  6 pure, userId-scoped, unit-tested engines:  │──▶│  typed slot schema per answer │
   │  E1 Substitution Graph                        │   │  type × per-locale template   │
   │  E2 Technique/Food-Science KB                 │   │  → world-class NL, 0 gen tokens│
   │  E4 Unit/Scaling Math                         │   └───────────────┬──────────────┘
   │  E5 Explain-Why (FeatureContributionLog)      │            answered? ──▶ RETURN ($0)
   │  E6 Per-User Reasoning (diet/allergy/skill)   │                   │ no / low-confidence
   │  + Hybrid+Alias Retrieval                     │                   ▼
   │  ALL call INTO the HARD allergy gate (E6a)    │   ┌──────────────────────────────┐
   └──────────────────────────────────────────────┘   │  L4  MINIMAL LLM (Gemini)     │
                                   ▲                    │  ONE call. Sees only the SAFE │
        same core, aggregated      │                    │  set + focused structured     │
   ┌───────────────────────────────┴───┐               │  attrs. PRE-grounding rails · │
   │  ADMIN FACE (L2b): MetricRegistry  │               │  bounded tool loop ≤3 ·       │
   │  ~200 params = (insight × family × │               │  POST output-validator ·      │
   │  entity); deterministic query,     │               │  abstain-with-alternative.    │
   │  LLM narrates the WHY only.        │               │  Caches ONLY post-gate.       │
   └────────────────────────────────────┘              └──────────────────────────────┘
```

**Layer contracts:**
- **L0 Context ingest.** Every screen emits a typed `AssistantContext` so "help with *this*" needs zero user explanation. This is the cheapest, highest-leverage primitive — it turns "what can I swap this for" into a fully-specified deterministic query with no NLU.
- **L1 Router.** The single component that decides €0 vs paid. A pure function — NOT a model call by default (§3). It is the lever that realizes the whole split: without it every turn defaults to a model and the zero-LLM share never materializes.
- **L2 Deterministic core.** Six pure engines + retrieval, each `userId`-scoped and fully unit-testable, ZERO model calls, ZERO network beyond Prisma. The "thousands of parameters" surface is the *product* (engines × ingredient-fields × recipe-fields × user-dimensions), not thousands of hand-written rules.
- **L3 Answer composition.** Renders structured truth from L2 into natural fa/nl/en prose via slot-filled templates. This is what makes a zero-LLM answer feel world-class — the data is already authored as prose-ready fields.
- **L4 Minimal LLM.** The exception, not the engine. Reached only for the residue L2/L3 cannot answer. Wrapped in grounding + validation + abstention gates so it can never be wrong or useless. **The LLM narrates the deterministic answer; scaling math, allergen filtering, and nutrition numbers are computed by L2 and the model is never their source.**

---

## 2. The Query-Tier Split (T0/T1/T2/T3) + realistic zero-LLM %

Four tiers by *generation cost*, mapped onto the layers above:

| Tier | Definition | Layers used | Generation tokens |
|---|---|---|---|
| **T0** | Pure DB + code | L0→L1→L2 | **0** |
| **T1** | Deterministic retrieval + templated slot-filled NL | L0→L1→L2→L3 | **0** |
| **T2** | LLM only to PARSE a messy free-text question, then deterministic answer | L1→L4(parse)→L2→L3 | **~0** (cheap classify, no output tokens) |
| **T3** | LLM GENERATES grounded prose over multiple retrieved records | L0→L1→L2(retrieve)→L4(generate) | **billed** |

### 2.1 Realistic split (design target, engaged-user mix)

| Tier | Share of all interactions | Examples |
|---|---|---|
| **T0** (pure code) | **30–35%** | unit conversion, scaling math, per-serving nutrition recompute, timers / time-from-GRIS, shopping-list aggregate/checkoff, meal-plan reads, feedback log, ingredient-fact lookup, the allergy gate itself, recipe-step verbatim, structured swap lookup, pairing co-occurrence |
| **T1** (retrieve + template) | **38–43%** | the SAME deterministic results rendered as natural fa/nl/en: substitution explanations, "why it works" (GRIS `whyItWorks`), technique/step/doneness explain, plan summaries, discovery result lists, ingredient-fact prose, troubleshooting (GRIS `troubleshooting`), storage/reheat (GRIS `keep`). **Largest band; fully zero-LLM because the data is already authored as prose-ready fields.** |
| **T2** (LLM parse → deterministic) | **8–12%** | messy free text where intent/entity extraction needs a model but the ANSWER is a deterministic tool call ("the green herb stew thing for my vegetarian sister, no walnuts" → resolve dish+diet+allergen → grounded retrieval). ~half resolve to a templated answer (no generation); ~half hand off to T3. |
| **T3** (LLM-generated prose) | **12–18%** | genuinely needs synthesis over multiple records: during-cook diagnosis ("my sauce broke"), multi-constraint reasoning, low-confidence fallback, novel free-form food questions combining several ingredient/GRIS facts. **This is where Gemini output tokens are actually spent.** |

**The honest numbers:**
- **Zero-LLM (T0+T1) ≈ 70–78%** of interactions.
- **True zero-GENERATION-token share ≈ 80–85%** (counting T2's deterministic-answer half).
- **LLM-touch (T2-parse + T3) ≈ 22–30%.**
- **LLM-GENERATION (T3 — the only path that bills output tokens at scale) ≈ 12–18%**, drivable toward **<10%** after the three reducers in §2.2.

This is consistent with `AI_DESIGN_SPEC.md §5.3`'s modeled mix (35% NONE / 50% CHEAP / 15% STRONG): **T0 ≈ their NONE; T1 + T2-deterministic absorb most of their CHEAP; T3 ≈ their STRONG.**

### 2.2 Why <10% is achievable but needs honest framing

[احتمالاً] on the exact percentages — *there are zero production query logs today.* The P2 golden eval set is what will *measure* the real distribution; treat these as a **design target, not a measurement.** [قطعی] on the tier *assignments* (which class is T0 vs T3) — those are grounded in the actual fields and tools that exist.

Two different numbers must never be conflated:
- **"<10% touch any model"** is NOT achievable for a real free-text assistant — T2 parsing of genuinely messy questions is irreducible. But T2-parse is a CHEAP single classify/extract call (Flash-Lite, ~no output tokens), not the expensive part.
- **"<10–15% bill generation output tokens" (T3)** IS achievable. **This is the cost target** — output tokens dominate Gemini cost.

Pure-generation (T3) drops from ~15% toward <10% via three reducers:
1. **Hybrid + alias retrieval** kills the keyword-`contains` dead-ends that currently *force* escalation (a synonym miss is today a silent dead-end that pushes the turn to a model).
2. **Mining GRIS** `troubleshooting`/`recovery`/`whyItWorks` as **templated** answers instead of regenerating them.
3. **A semantic cache** (≥0.97, allergy- and quantity-barred per §4.5) collapses repeat T3 questions into T0 cache hits.

> **Investor-grade framing:** never state "<10% LLM" as a fact. State: *"the engine is designed to keep paid generation under ~15% of interactions for factual/transactional traffic, with the LLM reserved for high-value reasoning; the real distribution is measured by the P2 golden eval and the per-tier event stream."*

### 2.3 Four surface-specific query maps (concrete, grounded)

| Surface | Query | Tier | Resolved by |
|---|---|---|---|
| **Recipe page** | "what can I swap X for" | T1 | E1 Substitution Graph + E3 template |
| | "why sauté first" | T1 | E2 ← GRIS `whyItWorks` + E3 |
| | "scale to 6" | T0 | E4 (weightG-anchored) |
| | "calories" | T0/T1 | E4 nutrition recompute + E3 |
| | "what goes with this" | T1 | `suggest_pairings` + E3 |
| **Meal plan** | "what's on Tuesday" | T0 | MealPlan → MealSlot read |
| | "balance my week / swap a meal" | T2→T3 | constraint reasoning over plan + E6 |
| **Shopping list** | "aggregate across the week / how much rice total" | T0 | pure aggregation + unit-merge (reuse `shopping-aggregator`) |
| **Cook mode / during-cook** | "how long this step" | T0 | GRIS `durationMin` |
| | "how do I know it's done" | T1 | GRIS `doneness`/`sees` + E3 |
| | "my sauce broke / it's too salty" | T3 | diagnosis over GRIS `troubleshooting`+`recovery` + `cookingBehavior` — **highest-value, genuinely needs generation** |
| **AI/chat + free-form** | greeting | T0 | E3 canned |
| | ingredient facts | T1 | E2/`get_ingredient_facts` + E3 |
| | discovery | T1/T2 | hybrid retrieval + E6 diet filter |
| | novel multi-fact food question | T3 | L4 over E2 + ingredient facts |
| | stated allergy mid-chat | special | confirm→write flow (§4.4) |
| | medical / out-of-domain | T0 | refuse via `ai-safety.guard` |

---

## 3. The Deterministic Router (IntentClassifierService) — the cost governor

This is **BUILD-1**. It is the lever that realizes the whole split. Without it every turn defaults to a model call and the 70%+ zero-LLM share never materializes.

### 3.1 It is NOT a second LLM call (by default)
A **pure deterministic function** over `(normalizedTurn + AssistantContext)`: normalized-token matching against per-intent lexicons (fa/nl/en) + structural signals (route, has-recipe-context, contains-a-number, contains-a-quantity-unit). Zero network, sub-ms, fully unit-testable. Returns:

```ts
{ intent, modelTier: 'NONE'|'CHEAP'|'STRONG', dataScope, cacheable, safetyRelevant, confidence }
```

`ai.service.ts:analyzeUserIntent` is a filter-EXTRACTOR, not a router — **do NOT extend it; build a separate `apps/server/src/ai/intent/intent-classifier.service.ts`.** (BUILT 2026-06-23, guardian-converged; registered in ai-core.module but not yet wired into the orchestrator.) An optional embedding/on-device tie-breaker for the ambiguous middle stays behind a flag; the default path makes ZERO network calls (that is what makes analyze-then-answer cheaper than naive chat). Wire it FIRST in `chat-orchestration.service.ts`, before grounding/cost.

### 3.2 16-intent taxonomy (from `AI_DESIGN_SPEC §2.2`, mapped to tiers)

`greeting`(T0) · `unit_conversion`(T0) · `timer_or_time`(T0) · `scaling`(T0 math, CHEAP narrate) · `substitution`(T1→T3) · `technique_whyitworks`(T1) · `ingredient_facts`(T1) · `recipe_discovery`(T1/T2) · `personal_plan_or_history`(T0/T1, authed) · `nutrition_query`(T0 value, T1 narrate) · `during_cook_problem`(**T3/STRONG**) · `stated_constraint`(**special flow §4.4**) · `medical_or_health_advice`(**refuse**) · `out_of_domain`(refuse) · `feedback`(T0) · `low_confidence_fallback`(**STRONG**).

### 3.3 Routing rules + the safety invariant
- **NONE** only for deterministic, non-safety intents at high confidence.
- **CHEAP** = single-constraint, not time-critical, narrating a deterministically-computed result.
- **STRONG** = multi-constraint, `during_cook_problem`, or `safetyRelevant && confidence < high`.
- **dataScope is least-privilege:** it decides which tools are even *offered* to the model this turn (a `unit_conversion` turn never sees the user-diet tool — OWASP LLM01 at the routing layer).
- **THE INVARIANT (tested):** a misclassification must always fail toward **MORE** cost/safety, never less. `safetyRelevant && confidence < high` → escalate to STRONG + gate, never downgrade to NONE/cached. This is the one place the cost objective and the safety objective directly conflict — **safety wins by construction.**

### 3.4 fa/nl/en normalization
Per-intent lexicons in all three languages + normalization (Persian: strip diacritics, normalize ي/ك↔ی/ک, ZWNJ, Eastern-Arabic digits→ASCII; Dutch: lowercase, diacritic-fold; shared: number+unit detection). Single-pass match across all three lexicons — **no language-detect-then-route** (code-switching is common in the Dutch-learner and diaspora-adjacent audience). Lexicons are governed params (no redeploy).

### 3.5 Release gate
- Overall intent accuracy **≥ 92%** on a labeled fa/nl/en set (≥600 turns, ≥150/language).
- **Recall on `stated_constraint` + `medical_or_health_advice` ≥ 99%** — a missed allergy/medical query is the only truly costly error (precision can be lower; over-triggering the safe flow is acceptable). CI release gate.

---

## 4. The Deterministic Intelligence Core (L2) — the six engines

One shared library of PURE, parameterized, `userId`-scoped, fully-unit-testable functions with ZERO model calls and ZERO network beyond Prisma. Grounded in the real `Ingredient` dictionary + GRIS. **At ~1,008 recipes / ~1,000 ingredients these are in-memory indexes rebuilt on ingredient/recipe change — NOT Neo4j, NOT pgvector** (the spec already rejected vector RAG at this scale; the same logic rejects a graph DB).

### Engine 1 — Substitution Graph (rule + data driven, allergy/diet aware)
A directed weighted graph `G`: nodes = `Ingredient.id`, edges = substitution candidacy. Edge sources, priority-ordered, each carrying provenance:
- **(a)** `Ingredient.substitutionOptions` rich objects — **read ALL fields** (`replaceWithIngredientId`, `reason`, `bestUseCases[]`, `impact{taste,texture,nutrition,allergenRisk}`, `confidence`, `notesFa`), edge weight from `confidence` + `impact.allergenRisk`. **This is the fix for the `toStringArray()` waste (Reality Check).**
- **(b)** GRIS per-recipe `ingredients[].swaps` (context-specific, ratio-bearing — keep recipe-scoped).
- **(c)** same `category`/`subCategory` peers — **fallback ONLY** when an ingredient has NO curated edges AND is not source-locked (the current tool gets this rule right; preserve it).
- **(d)** GRIS `variations[].swapsIngredientIds`.

Query flow: candidate edges → **DROP any candidate whose target's `allergens` intersect the reconciled allergen set (via the SAME gate, BY `ingredientId` not name** — current name-based `looseMatch` is weaker and risks a name-collision surfacing an allergen) → DROP diet-incompatible (target `dietFlags` must satisfy user diet) → DROP disliked → RANK by `(confidence, low allergenRisk, low taste/texture impact, ratio availability, EU market availability)`. Output per candidate: `{targetId, displayName, ratio, why (reason+notesFa), tasteDelta, textureDelta, allergenSafe:true, provenancePointer}`. Honest-when-missing: keep `ingredient_not_found` / `no_substitution_data` — never pad with irrelevant peers.

### Engine 2 — Technique / Food-Science KB (deterministic why + during-cook help)
A per-recipe index keyed by `stepIndex` AND by technique/ingredient, derived from GRIS:
- **(a)** `whyItWorks[]` → "why do I X?" (point+explanation, `testedBecause` as the citation — **investor-grade, sourced answers with ZERO LLM**).
- **(b)** `troubleshooting[]` keyed by `stepRef` AND fuzzy-matched on `problem` → "my sauce broke / X went wrong" (problem→fix).
- **(c)** `steps[].sees`/`doneness`/`recovery` → "how do I know it's done / what should it look like / I think I messed up step N".
- **(d)** `Ingredient.cookingBehavior` (`heatSensitivity`, `commonCookingMethods`, `prepDifficulty`, `typicalPrepForms`) → generic technique facts off a recipe page.
- Plus a **cross-recipe canonical technique glossary** (~20–40 principles: starch gelatinization, saffron bloom, sauce emulsion, caramelization) mapped from `testedBecause` citations, so "why bloom saffron" answers even with no recipe context. This is the engine that moves `during_cook_problem` and `technique_whyitworks` from T3 to T1 for the common cases.

### Engine 3 — Deterministic Answer Composition (TemplateRegistry, multilingual)
NOT string concatenation scattered in tools (today every tool hard-codes Persian — `composeDeterministicReply`, the substitution `reason` fields — un-i18n-able, untestable). A `TemplateRegistry`: each answer type (`substitution_list`, `why_it_works`, `troubleshoot`, `scaling_result`, `nutrition_fact`, `ingredient_fact`, `explain_fit`, `no_safe_match`, `missing_data`) has a **typed slot schema + per-locale template (fa/nl/en) + a renderer**. Templates are **governed params** (DB/config, no redeploy — mirrors "every number is a governed param"), so phrasing/locale ships without code. Quality bar: natural full sentences, carries the AI-disclosure + non-medical hedge + provenance pointer, degrades to a graceful honest message when a slot is missing. **This is the layer that lets <10% LLM still feel world-class** — most answers are template-rendered structured truth, indistinguishable from a good model reply because the DATA is rich. Author **3–5 phrasing variants per template** to avoid robotic repetition.

### Engine 4 — Deterministic Unit / Scaling Math
Anchor on GRIS `ingredients[].weightG` (NUMERIC grams) as the scaling base — NOT free-text `RecipeIngredient.amount`. `scale(recipe, from→to)`: `factor = to/from`; `newWeightG = weightG × factor`; round to cooking-sane precision (spice <5g→0.1g, bulk→5g/0.25cup). Re-derive volume from `weightG` via a governed `gramsPerCup`-by-category table. Unit conversion (g↔cup↔tbsp↔tsp↔عدد) is a pure table lookup (T0). **Reuse the Persian-digit normalizer + amount parser already in `shopping-aggregator.ts` — do not rewrite.** Honest-when-missing: if `weightG` absent, scale by ratio and flag `approximate` rather than fabricate grams. **CRITICAL: any answer containing a computed quantity is BARRED from the semantic cache and MUST recompute per request** (a cached number for 4 servings is wrong for 6).

### Engine 5 — Deterministic Explain-Why-This-Fits-You
Read `FeatureContributionLog` for `(userId, recipeId)`: take top-K `featureKey` by `contribution`. A `FeatureKey→human-template` map (real keys: `tasteAffinity`→"matches your taste", `quick_meal_lover`→"because you cook fast weeknight meals", `family_cook`→"matches your family-size cooking", `comfort_food_lover`, `budget_sensitive`, `breakfast_person`). Compose via E3 with **NO raw scores/percentages exposed** (invariant). **This REPLACES `explain-recommendation.tool.ts`'s exposure-only stub** — the per-feature contributions are logged but unused today. Honest fallback to `limited_data` on cold start (no contribution rows). The same map powers System B's "why does this cohort prefer X".

### Engine 6 — Per-User Reasoning in Code (the cross-cutting predicate library)
Every engine calls these pure predicates:
- **(a) Allergy (E6a):** the existing gate, by reconciled allergen set, fail-closed, **by `ingredientId`**.
- **(b) Diet satisfaction:** pure predicate over `Ingredient.dietFlags` + `Recipe.diet`/`containsPork` + GRIS `dietary` (vegan/veg/glutenFree/dairyFree/halal).
- **(c) Goal fit:** `Ingredient.healthContext.goodForGoals`/`avoidForGoals` + `nourishment.attributes` (**display/explain only — NEVER medical**, keep `ai-safety.guard` blocks).
- **(d) Preference/dislike + skill:** `cookingBehavior.prepDifficulty` + `glance.difficulty` + user skill feature.

All pure, testable, locale-agnostic; return STRUCTURED verdicts E3 renders. **This is the "thousands of parameters" surface: it is `engines × ingredient-fields × recipe-fields × user-dimensions`, not 1000s of hand-written rules.**

### Retrieval — replace keyword `contains` with HYBRID (NOT vector)
Structured-field match (ingredient/technique/dishType/region/diet) + curated alias/synonym expansion (eggplant↔aubergine↔بادمجان — **load-bearing for the Dutch general audience**) + Postgres `tsvector` + `pg_trgm` fuzzy. On empty → nearest SAFE alternative, never a dead-end. **The single biggest reducer of forced T3 escalation** (today a synonym miss is a silent dead-end that pushes the turn to a model). Target Recall@5 ≥ 0.80 (vs ~0.64 today).

---

## 5. The Minimal-LLM Boundary + the never-wrong / never-useless contract

The LLM is reached only after L2/L3 cannot answer. Three gates wrap the single generation call; all the safety/grounding logic is OUTSIDE the model.

### 5.1 Make calls RARE — four deterministic absorbers in series
1. **Router NONE tier** absorbs ~30–35% at €0 (conversions/timers/greetings/feedback).
2. **Exact-match cache** keyed on `hash(normalizedPrompt + reconciledAllergenSet + diet + personalizationSig + locale + dataScopeVersion)`. (`CACHE_MANAGER` is already wired in `ai.service.ts` but unused for chat — reuse it.)
3. **Dedupe / single-flight:** identical concurrent keys await one generation; a per-conversation "same question re-asked" short-circuits.
4. **Semantic cache** at cosine ≥0.97 behind a flag, with **two HARD bars** (§5.5).

### 5.2 Make calls CHEAP
- **3–5 snippets only** — the model gets the SAFE recipe set + the focused entity's structured attrs (`cookingBehavior`/`substitutionOptions`/`tasteProfile`/`healthContext`/`allergens`/`aiContext` + a GRIS slice), NOT the whole corpus.
- **Cacheable prompt layout:** `[stable system+tool-defs][stable serialized corpus slice][~300-token rolling summary][volatile: 8 verbatim turns + user turn LAST]`. Volatile content MUST be last or the provider prefix-cache is destroyed.
- Bounded output (`max_output_tokens`) + bounded tool loop (≤3 tool calls/turn). Exactly ONE generation call per turn by default.
- **Realistic Gemini caveat:** most turns (~5–15k tokens) do NOT clear Gemini's ~32k explicit-cache floor, so the real win is **implicit prefix caching** (smaller discount, no storage fee). Explicit `cachedContent` is only worth pinning the >32k corpus prefix during an active cooking session. The cost model assumes NO explicit-cache discount (conservative) and treats it as upside.

### 5.3 NEVER WRONG — strict grounding + output validation, all OUTSIDE the LLM
- **PRE:** the HARD allergy gate stays the SOLE source of truth (establish safe set FIRST from `reconciled.dimensions.allergies` → retrieve → HARD-drop `avoid_allergen` via `assessRecipeFit`+`analyzeRecipeIntegrity` → fail closed). Declared allergens NEVER enter a prompt — only the pre-filtered SAFE set.
- **System-prompt rails:** answer ONLY from retrieved records; every factual claim carries a provenance pointer (USDA-locked value / GRIS step N / curated substitution table); explicit permission to say "I don't know" rather than invent a ratio/temperature.
- **POST — generalize `screenLiveOutput` into an OUTPUT VALIDATOR** that REJECTS (→ fall back, not surface) any reply that: names a HARD-dropped recipe or a declared allergen (current behavior); names an entity ID NOT returned by a tool THIS turn (ungrounded-entity rejection); contains a computed quantity the deterministic layer did not produce; trips `detectOutputViolations` (`output-safety-evaluator.ts` already exists — reuse it for safety categories); or is empty. **Make `output-safety-evaluator.ts` the runtime validator, not just the eval harness, so eval and runtime share one rule source.**
- **Confidence threshold:** a STRONG answer below the groundedness threshold is discarded, not surfaced. The model only NARRATES; it is never the source of a number or a safety decision.

### 5.4 NEVER USELESS — graceful abstention with a real alternative
The tool layer already emits the abstention substrate as `resultStatus` enums. The contract: **every abstain path must offer the BEST REAL alternative, never a blank wall.** Formalize a typed result `{status, honestReason, bestAlternative}` surfaced to the client (build on the existing enums; no new tool needed). Ladder:
1. generation rejected/low-confidence/timeout → degrade to `composeDeterministicReply` (the curated safe set still renders — **the screen is never dead**).
2. retrieval empty on a real query → hybrid+alias retrieval → nearest safe alternatives ("no exact match, but these safe options are closest").
3. data genuinely missing → say so honestly + point to what DOES exist ("no substitution recorded for X, but same-role ingredients in its category are…").
4. cost cap binds → DEGRADE to the deterministic grounded reply (NEVER hard-lockout) + `429 + Retry-After`.
5. out-of-domain/medical → polite refuse + redirect.

**Honest-when-missing is a first-class success state, not a failure.** (GRACE/early-abstention research: graceful abstention lowers BOTH cost and error.)

### 5.5 Semantic cache — the highest-risk component
Two HARD bars, flag-OFF until tested: **(a) never serve a hit whose answer/source-set is allergy-relevant; (b) never serve a hit containing a computed quantity.** Cache key includes the reconciled allergen set; cache ONLY AFTER the gate. Invalidate on allergen-set change. Fail OPEN (vector store down → deterministic path/LLM). Mandatory weekly 1–5% FP sampling via LLM-judge. **Ship exact-match + dedupe + provider prefix-cache first; defer semantic to P4.**

### 5.6 Conversational-allergy resolution (the safety hole, closed)
The gate reads allergens ONLY from `reconciled.dimensions.allergies` — a mid-chat statement lives in the untrusted LLM turn. Fix: the router detects `stated_constraint` deterministically **on the RAW turn (never the LLM summary)** → surfaces a one-tap **confirm** → on confirm, WRITE into `UserAllergy`/the reconciled source via the normal profile-write path (consent/audit) BEFORE any answer relies on it → re-run grounding so the gate reads it from its real source. **Auto-write is rejected** (a misheard/sarcastic line fabricates an allergen and breaks the user's real recipes). The LLM summary never becomes a safety input.

---

## 6. The Admin Engine (L2b) on the SAME core — one engine, two faces

System A's rule "LLM narrates the deterministic answer, never IS it" == System B's rule "LLM narrates the deterministic number, never computes it." **~99–100% of every NUMBER is deterministic; Gemini touches an estimated <2–3% of admin interactions and NEVER computes a value.**

### 6.1 One-engine-two-faces (grounded in real code)
Both faces sit on the same determinism+grounding substrate. System A's safety/compute primitives (`assessRecipeFit`/`analyzeRecipeIntegrity`/`getLivingUserProfile`) + the pure analytics math in `analytics/intelligence/{funnel,trends,cohort}.ts` are the SAME primitives L2b reuses. The honesty enum is shared: A's `groundingStatus {ok|empty|unsafe_set_unavailable}` is the analogue of B's `honestyTag {real|awaiting_pilot|inferred}` (already live in `AnalyticsIntelligenceService`). Same `ModelProvider` seam, same cost catalog (`getActiveRate`), same `EventOutbox`/`UserEvent` stream (the user-assistant's learning signal AND L2b's analytics substrate). **Nothing parallel is built; L2b is a read layer ON TOP of `AnalyticsIntelligenceService` — do NOT replace it.** Engine 2 + Engine 5 *aggregated* literally ARE the WHY-moat.

### 6.2 The Metric Registry (the heart)
Each of the ~200 params is a row in a typed catalog defined ONCE:
```ts
{ key, titleFa/En, family, entity, formula(asExpr), sql(deterministicQueryFn),
  dimensions[], validRange:[min,max], unit, honestyTag, minSampleN,
  provenance(eventTypes+tables), owner, parentMetric? }
```
Resolution: `registry.get(key)` → run its ONE bound query → clamp/validate against `validRange` + `minSampleN` (below N → `honestyTag` forced to `awaiting_pilot`, value `null`, **NEVER 0% faked**) → return `{value, tag, sampleN, provenance}`. **Exactly ONE query per key, and it is code, not generated.** The ~200 = a TAXONOMY: `(insight-type ~13) × (metric-family ~5: completion/engagement/retention/AI-health/economics) × (entity ~4: recipe/step/ingredient/cohort)`. Each cell is auto-instantiated from the family template — reaching 200 is configuration, not 200 bespoke builds.

### 6.3 NEVER text-to-SQL
The admin asks in NL; the LLM only maps to the registry via structured-output decoding returning ONLY `{metricKey from enum, dimensions from enum, filters}` — a closed, schema-validated selection. Unknown key/dimension = hard refuse ("I don't have that metric") — the L2b analogue of `unsafe_set_unavailable`. The model never sees a table name, never emits SQL, never sees raw rows. This is the dbt-MetricFlow-class 98–100% correctness vs 84–90% text-to-SQL, with failures becoming an honest error, not a silent-wrong number — the only acceptable property for a panel the founder ACTS on. **Show the resolved `{metricKey,dimensions,filters}` to the admin before rendering** ("you asked X, I'm computing Y") — the one place the model can still mislead (wrong-but-valid key).

### 6.4 Metric trees for deterministic root-cause
A tree param's `formula` is an identity decomposition, e.g. `cook_completion = opens × start_rate × ... × finish_rate` (each factor a registry key). Contribution/attribution is pure arithmetic via the SAME `funnel.ts` drop-off primitive + a Top-Drivers pass (PoP delta × weight). Pattern: detect anomaly deterministically → walk the tree to the leaf with the largest contribution → slice by entity dimension (recipe×step×cohort) → emit a FINISHED finding `{metric, delta, dominantLeaf, entity, contribution%, evidenceEventIds}`. ONLY THEN Gemini narrates: "completion fell 12%, driven by Step 4 of Ghormeh Sabzi for beginners" — **the 12% and "Step 4" are deterministic; only the sentence is generated**, batched nightly (Batch API ~50% off). The WHY-moat: the leaf `(recipeId,stepIndex)` is joined to `Recipe.gris.commonMistakes` + the step's ingredient `cookingBehavior` — depth generic Amplitude/Mixpanel agents cannot reach. **Unit-test per tree: product-of-children == parent within tolerance (CI gate)** — a tree whose factors don't reconcile is `inferred`, not `real`.

### 6.5 Supervised-autonomy guardrails
L2b ships READ-ONLY first (the first live-Gemini beachhead — internal, zero user-safety surface). Writes are PROPOSE-ONLY: every change is a typed reversible audited proposal in a founder review queue (reasoning + before/after diff + blast radius + the L0 evidence `UserEvent` ids + Approve/Edit/Reject). Policy-as-code OUTSIDE the LLM (OPA/Cedar): no DELETE; no write > N rows without escalation; **allergen/safety fields (the `assessRecipeFit` inputs) are READ-ONLY to the agent forever** — a prompt-injected agent is structurally unable to corrupt the safety corpus. Staging → canary on a small cook segment → auto-rollback using L0 signals (`cook_complete`/abandonment/swap). Autonomy ladder starts every change-type at Tier 1; graduate only proven low-blast-radius categories (dishType tagging, chefTip phrasing); substitutions-feeding-the-gate stay human-in-the-loop permanently (EU AI Act Art. 14).

### 6.6 First ~20 params (each = ONE deterministic query; honesty-tagged)
1. `cook_completion_rate` 2. `step_dropoff_rate[recipeId×stepIndex]` 3. `recipe_abandonment_rate` 4. `swap_rate[ingredientId]` (P0-gated) 5. `scale_usage_rate` 6. `avg_rating` (validRange [1,5]) 7. retention D1/D7/D30 8. `planner_adherence_rate` 9. `AI_turn_volume[intent]` 10. `AI_abstention_rate` 11. `AI_degrade_to_deterministic_rate` 12. `allergy_gate_drop_rate` (= `droppedForAllergy/retrievedCount`, straight from `GroundingResult`) 13. discovery→cook conversion 14. `shopping_list_completion_rate` 15. `beginner_vs_experienced_completion_gap[cohort]` 16. `top_problem_dishes` (metric-tree driven) 17. `top_swapped_ingredients` (P0-gated) 18. `AI_cost_per_active_user` (reuses `estimateCostUsdFromCatalog`; `inferred` until catalog populated) 19. `anti_spam_cap_bind_rate` 20. `consent_grant_rate[purpose='ai_personalization']`.

> **k-anonymity:** every per-entity/per-cohort param enforces `minSampleN` suppression (below N → `awaiting_pilot`, value null) as a HARD rule — a `step_dropoff` sliced to a 1-user cohort is PII.

---

## 7. What data must be ENRICHED to make determinism possible

The zero-LLM share is a *function of how much authoring is done.* A query that maps to a missing field DEGRADES to T3 or an honest "I don't have that." Prioritized:

| # | Enrichment | Unlocks | Effort | Priority |
|---|---|---|---|---|
| **E-a** | **Consume rich `substitutionOptions`** (rewrite `suggest-substitutions.tool.ts` off `toStringArray`) | E1 quality with ZERO new authoring — data already exists, being discarded | code-only | **P0, biggest ROI** |
| **E-b** | Backfill `replaceWithIngredientId` where `substitutionOptions` is name-only; ensure GRIS `swaps` ids resolve to `Ingredient` nodes | E1 can screen swaps by id (else fail-closed to "verify labels") | data audit | **P0** (safety) |
| **E-c** | Author the governed unit-conversion + `gramsPerCup`-by-category table | E4 volume display | small | P1 |
| **E-d** | Author the canonical technique glossary (~20–40 principles) mapped from existing `testedBecause` | E2 off-recipe technique answers | small | P1 |
| **E-e** | Author **fa/nl/en templates** (E3) — **Dutch is REQUIRED for the EU general-public launch; currently zero Dutch in any deterministic string** | the entire T1 band's quality; the multilingual eval gate | translation + culinary review calendar work | **P0/P1 (start early, not at the end)** |
| **E-f** | Extend GRIS `troubleshooting`/`whyItWorks`/`weightG` coverage from the vertical slice to the long tail of ~1,008 recipes | breadth of T0/T1 vs degrade-to-T3 | large, ongoing | P1→P3 |
| **E-g** | **Decide `healthContext`:** author `{benefits,cautions,goodForGoals,avoidForGoals}` (expands T1) **vs** permanently refuse-with-macros (keeps it T0). Empty today. Until decided, "is X healthy for me" degrades to USDA macros + non-medical disclaimer, NEVER a health claim (protects the MDR boundary) | E6c goal-fit | decision + authoring | P1 |
| **E-h** | **Wire the cost/event substrate (P0 prerequisite):** populate `PRODUCTION_RATE_CATALOG` with verified Gemini rates; make `ai-cost-controller` Redis-atomic; emit a tier-tagged `UserEvent` for every assistant turn + every swap/scale/remove | measuring the real per-tier %, L1 signal, all L2b params | code | **P0 — true critical path** |

---

## 8. Phased Build Plan (measurable gates)

> Today = 2026-06-22. Binary pass/fail gates. Aligns with `AI_DESIGN_SPEC §10` phases. *Italic* = ships value while live is OFF.

| Phase | Scope | Window | PASS gate (measurable) |
|---|---|---|---|
| **P0 — Observability + cost honesty** *(prereq, blocks all)* | Emit tier-tagged `UserEvent` per turn + swap/scale/remove via `EventOutbox`; Redis-atomic cost controller; populate verified Gemini rate catalog; **E-a + E-b** | now → ~3 Jul | every swap/scale/remove emits a verifiable event; `estimatedCostUsd` non-null; counters correct under 2 instances; `suggest_substitutions` returns rich fields |
| **P1 — Deterministic core + router + templates** *(live OFF)* | `IntentClassifierService`; E1–E6; hybrid+alias retrieval; TemplateRegistry (fa/nl/en); `AssistantContext`; replace `explain-recommendation` stub with E5; **E-c/E-d/E-e/E-g** | ~4 Jul → ~25 Jul | intent accuracy ≥92% / safety-recall ≥99%; **Recall@5 ≥0.80** (vs ~0.64); **deterministic_answer_rate ≥60%** measured; "scale to 6" resolves vs prior turn; conversational-allergy confirm→write works; isolation test leaks no other user's row |
| **P2 — Flip live (HARD gate, ALL required)** | DPIA filed; Art. 9 consent wired; **fa/nl/en golden eval green (≥600 turns, ≥150/lang)**; Redis anti-spam; generalized output validator; Art. 50 disclosure | earliest ~Sep 2026 | **0 allergen leaks; 0 hallucinated entities; groundedness ≥95%; degrade-not-lockout verified; T3 generation share ≤18% measured** |
| **P3 — Act (tool-calling + apply)** | Bounded tool loop ≤3; preview-then-confirm applies; apply emits L1 signal | ~3–4 wks after P2 | applied swap → L1 signal; empty/failed tool → honest "I don't have that"; **no unscoped tool call** |
| **P4 — Real-time during-cook + semantic cache** | Streaming TTFT; AROMA intervention at GRIS failure points; semantic cache (quantity+allergy barred, weekly FP eval) | ~3 wks after P3 | TTFT <~500ms CHEAP; ≤3–5 interventions/day; **semantic-cache FP <0.5%; ZERO computed-quantity or allergen cache hit**; T3 share trending <10% |
| **P5 — L2b read-only insight** *(first live-Gemini beachhead)* | MetricRegistry + 20 launch params + tree engine + nightly Batch scan | parallel from ~P1 | stated number == deterministic query; refuses beyond-data; **product-of-children == parent per tree (CI)** |
| **P6 — L2b supervised autonomy** | Propose-only; review queue w/ diffs; policy-as-code; staging+canary | after P5 stable | nothing mutates prod without an approved reversible audited proposal; allergy fields human-gated |

**Continuous KPIs (instrument from P0, drive the roadmap):** `deterministic_answer_rate` (T0+T1 share), `T3_generation_share`, groundedness, abstention-quality (does an abstain offer a real alternative?), `$/active-user-month` (target ≤15% of €7 ≈ $1.14; modeled real usage $0.19–0.48).

---

## 9. Where the LLM is genuinely unavoidable (honest)

[قطعی] Determinism cannot cover these — they are the legitimate T3 residue:
1. **During-cook novel diagnosis** — "my sauce broke and I already added the yogurt" combines multiple GRIS `troubleshooting`/`recovery` facts + ingredient `cookingBehavior` into a situation no single field anticipates. Highest-value, genuinely needs synthesis.
2. **Multi-constraint reasoning** — "a cheap vegan dinner for 4, no nuts, under 30 min, that my picky kid will eat" requires weighing several predicates against the corpus narratively.
3. **Free-text PARSING (T2)** — messy code-switched questions need a cheap classify/extract before the deterministic answer. Irreducible for a real assistant, but ~no output tokens.
4. **Low-confidence fallback** — when the router can't confidently classify, fail toward STRONG + gate rather than guess.
5. **L2b narration** — turning a finished deterministic finding into one fluent sentence (batched nightly).

Everything else is determinism's job. **Anything cost-minimization would push out of the LLM that hurts safety (a misclassified allergy turn, a cached quantity) is forbidden — safety and correctness win by construction over the cost objective.**

---

## 10. Top risks (honest)

- [قطعی] **Percentages are a design target, not a measurement.** Zero production logs exist; the P0 events + P2 golden eval are the measurement. Do not put a hard % in an investor deck as fact.
- [قطعی] **T0/T1 breadth is gated by data completeness, which is uneven** (`healthContext` empty; `nutritionConfidence` source-locked on ~258; GRIS a vertical slice). Selling <10% before the data is filled is overclaiming.
- [قطعی] **A thin template is worse than a good cheap generation.** The whole quality claim rests on E3 templates being as good as generated prose. "saffron is a spice. state: dried." reads robotic — the exact churn risk the founder named. T1 quality must be authored and eval'd (3–5 variants/template), not assumed.
- [قطعی] **Misclassification can silently downgrade a safety query.** The §3.3 invariant (safetyRelevant + low confidence → escalate, never downgrade) + the §5.6 confirm→write on the RAW turn MUST be tested invariants. The one place cost and safety conflict — safety wins by construction.
- [قطعی] **Retrieval is keyword `contains` TODAY** — quoting the target split against today's code is inaccurate. The split is achievable only AFTER hybrid+alias retrieval lands; the Dutch general-public launch makes alias expansion load-bearing, not optional.
- [قطعی] **Cost is blind today** (`PRODUCTION_RATE_CATALOG=[]`, in-memory controller). The <10%/cost-ceiling claims are unverifiable and Denial-of-Wallet (OWASP LLM10) is unguarded until P0 lands.
- [احتمالاً] **Semantic cache is the #1 silent-wrong-answer source.** For a food/allergy domain that is a SAFETY event. Two hard bars + per-user key + fail-open + weekly FP sampling are mandatory; defer to P4.
- [نامطمئن] **Maintenance load:** templates + lexicons + conversion tables + technique glossary + metric registry are all governed params — without an admin surface to edit them they rot. Couple to the L2b panel; flag as a dependency.

---

**نتیجهٔ عملی:** Build in this order — (1) P0 substrate (events + Redis cost + populated rate catalog + the `substitutionOptions` rewrite E-a/E-b), the true critical path; (2) `IntentClassifierService` (the cost governor) wired FIRST; (3) the six engines + hybrid retrieval + the fa/nl/en TemplateRegistry, instrumenting `deterministic_answer_rate` from day one; (4) only then flip a tightly-gated live Gemini for the genuine T3 residue. Frame the goal honestly as "designed for <~15% paid generation, measured by the P2 eval," never as an achieved fact. Start Dutch template authoring during P0/P1 — it is calendar work that will otherwise slip the P2 multilingual gate.
