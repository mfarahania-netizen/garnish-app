# Garnish AI — Design Spec v2 (buildable, investor-grade)

> Supersedes `AI_DESIGN_v1.md`. Companion to `AI_STANDARD.md`. Code-grounded against `apps/server/src/ai` and `prisma/schema.prisma` (re-verified 2026-06-22). Provider = **Gemini**, abstracted at the `ModelProvider` seam. Persian-first; EU/Holland **general-public** launch. Product price = **€7/mo**.
>
> **What changed vs v1:** v1 was directionally right but hand-waved the five load-bearing pieces. v2 closes them with numbers: a real unit-economics model that *derives* the anti-spam caps from a cost ceiling, a fully-specified deterministic intent classifier, a safe conversational-allergy flow, a dual-cache (Anthropic + Gemini) provider seam, per-table ownership columns, and an Article-50-aware live-flip date with an honest defer option.

---

## 0. Reality Check

[قطعی] Verified in code today (not asserted):
- **Cost is blind.** `ai-cost-rate-catalog.ts` ships `PRODUCTION_RATE_CATALOG = []`; `estimateCostUsdFromCatalog` returns `cost: null` for every real call. `ai-cost-controller.service.ts` is an in-memory `Map<string, number>` — resets on restart, drifts across instances, no Redis.
- **The user-data tool is near-empty.** `get-user-food-context.tool.ts` strips every `allerg|health|diet|weight|calorie|diagnos|...` key and hard-returns `recentSignals: []`. The "full per-user assistant" can currently see almost nothing.
- **Retrieval is keyword `contains`.** `grounded-reply.service.ts → retrieveCandidateIds → search_recipes` is Prisma substring match; silent-empty dead-end on synonyms.
- **No memory.** Single-turn only.
- **The gate is real and correct.** `grounded-reply.service.ts` establishes the safe allergy set FIRST from `getLivingUserProfile().reconciled.dimensions.allergies.reconciledValue`, retrieves, then HARD-drops `avoid_allergen` via `assessRecipeFit` + `analyzeRecipeIntegrity`, fails closed (`unsafe_set_unavailable`), never injects declared allergens into a prompt, re-screens live output. **This stays the single source of truth.**
- **The conversational-allergy hole is structural.** The gate ONLY reads `reconciled.dimensions.allergies`. A mid-chat "I'm allergic to walnuts" lands in the LLM turn/summary, which the gate never reads → it can be silently ignored. (Closed in §3.)
- **Consent + events infra exist, unused for AI.** `UserConsent(purpose, status, lawfulBasis)` model + `UserEvent` + `EventOutbox` are in the schema; the gap is wiring, not greenfield.

**Non-negotiable invariant (unchanged from v1/standard):** the deterministic HARD allergy/safety gate lives OUTSIDE the LLM, runs pre-injection and post-generation, fails closed, and is the only thing that decides "safe." The LLM explains the deterministic answer; it never *is* the answer. No new feature in v2 relaxes this.

---

## 1. SYSTEM A — Omnipresent User Assistant (L2a)

### 1.1 Scope
"Unlimited within food/health" = unlimited *topic breadth*, NOT unlimited *safety surface* and NOT medical scope (keeps Garnish out of EU MDR).
- **IN:** technique/why-it-works, substitutions, scaling, pantry, **this user's own** diet/plan/step-progress/saved recipes, USDA-source-locked nutrition facts, pairings, EU-occasion fit.
- **OUT (keep `ai-safety.guard.ts` blocks):** diagnosis/treatment/dosing, therapeutic disease diets, allergy "safe-to-eat" *guarantees*, undisclosed-condition inference, vision (POST-v1).

Capability comes from new **authed user-scoped tools**, not from relaxing the guard.

### 1.2 Grounding architecture [قطعی]
Bounded tool-calling loop over a fixed allow-list of deterministic, parameterized, `userId`-scoped Prisma tools. **NOT** document-RAG, **NOT** text-to-SQL, **NOT** vector RAG at ~1,008 records (rejected; revisit only if a held-out eval proves a retrieval gap — then `pgvector` + RRF + reranker).

Two tiers:
- **Public tools (keep the existing 7):** `search_recipes`, `get_recipe_gris`/`explain_recipe_step`, `find_substitutes`/`suggest_substitutions`, `suggest_pairings`, `match_pantry_recipes`, `explain_recommendation`, `log_ai_feedback`.
- **Tier-U authed tools (NEW):** `get_user_diet_and_personalizations`, `get_user_weekly_plan`, `get_recipe_step_mastery`, `get_current_recipe_context`, `get_ingredient_facts`. **Do NOT extend `get-user-food-context.tool.ts`** — its strip-list is correct for the *public* context. Tier-U is a separate, consent-gated surface.

**Per-user isolation enforced in CODE**, not prompt. A `UserScopedTool` base injects the ownership `where` and fails closed if `ctx.userId` is absent (OWASP LLM01 — prompt "don't leak" is not a control).

**Per-table ownership column for each Tier-U join** (verified against schema):

| Tool | Table(s) | Ownership predicate | Notes |
|---|---|---|---|
| `get_user_diet_and_personalizations` | `UserConsent`, `UserAllergy`, `UserHealthGoal`, `UserPreference`, `SignalObservation` | `where:{ userId }` (each table has a direct `userId`) | Allergies READ for *display/explanation only* — never as the gate's source. |
| `get_user_weekly_plan` | `MealPlan` → `MealSlot` | `MealPlan.where:{ userId }`, then `slots` by `mealPlanId`. **`MealSlot` has NO `userId`** — must join via parent `MealPlan`; never query `MealSlot` directly by a client-supplied id. | `@@unique([userId, weekStart])`. |
| `get_recipe_step_mastery` | **No table exists today.** Derive from `SignalObservation` (`@@index([userId, recipeId])`) + `UserOutcome` + `GamificationEvent`; if a first-class `RecipeStepMastery` table is added, key it `@@id([userId, recipeId, stepIndex])`. | `where:{ userId }` | Spec'd as derived in P1; promote to a table only if reads get hot. |
| `get_current_recipe_context` | request-scoped `AssistantContext` (no DB ownership row — it's the screen payload) | n/a | `recipeId`, `currentStepIndex`, focused entity passed explicitly by the client. |
| `get_ingredient_facts` | `Ingredient` (global, not user-scoped) | n/a | USDA-source-locked facts; provenance pointer required. |

**Retrieval — replace keyword `contains` with hybrid (NOT vector):** structured-field match (ingredient/technique/dishType/region/diet) + curated alias/synonym expansion (eggplant ↔ aubergine ↔ بادمجان — load-bearing for the Dutch general audience) + Postgres `tsvector` + `pg_trgm` fuzzy; on empty → nearest safe alternatives, never a dead-end.

**Output provenance:** generalize `screenLiveOutput` so the model may reference ONLY entity IDs returned by tools *this turn*; every factual claim carries a pointer ("per USDA-locked value", "GRIS step 4", "curated substitution table"). **Semantic cache (§1.6) must bar ANY answer containing a computed quantity** — not just allergy answers — because cached arithmetic for one serving/scale is wrong for another (scaling math, temperatures, timings, nutrition per-portion all re-compute deterministically per request).

### 1.3 Multi-turn memory
Window + rolling summary (never raw transcript — O(n²) tokens + cost). Last **8 turns verbatim** + a **~300-token LLM summary** of older turns. Summary sits EARLY in the cacheable prefix; the **live user turn is LAST** (lost-in-the-middle + cache safety). Persist via the existing `ChatMessage` model (`@@index([userId, createdAt])`). The summary is **untrusted** for safety (see §3).

### 1.4 Analyze-then-answer flow
1. **Deterministic classify/plan (NO LLM call by default)** → `{intent, modelTier: NONE|CHEAP|STRONG, dataScope, cacheable, safetyRelevant}` (full spec in §2).
2. **NONE** → answer from tools/templates (0 generation tokens).
3. Retrieve via deterministic tools; **HARD allergy gate runs here.**
4. **Exactly ONE generation call** (CHEAP = Flash-Lite for the long tail; STRONG = Flash/Pro for multi-constraint / during-cook), streamed.
5. Output gate (`screenLiveOutput`, generalized) before surfacing.

### 1.5 Learning hookup
Every apply (swap/scale/remove/cook-this) emits a structured `UserEvent` via the existing `EventOutbox` (closes the ZERO-events gap) → L1's missing training signal. `find_substitutes`/`suggest_pairings` call the L1 ranker. Implicit signals by default; explicit `log_ai_feedback` sparingly.

### 1.6 Caching (safety-ordered)
1. **Exact-match** keyed on `hash(normalizedPrompt + reconciledAllergenSet + diet + personalizationSig + locale)`.
2. **Provider prefix cache** via the `[stable system+tools][stable corpus][summary][volatile turn]` layout.
3. **Semantic cache at ≥0.97** behind a flag, **with two hard bars: (a) never serve a hit whose answer text or source set is allergy-relevant; (b) never serve a hit containing a computed quantity.** Re-validate any safety-relevant hit against live records.

Hard rule: reconciled allergen set is in every cache key; cache only AFTER the gate.

### 1.7 Omnipresence
Ambient affordances, NOT an "AI tab" — long-press an ingredient, "I'm stuck" on the current step. Typed `AssistantContext` per screen via `get_current_recipe_context`; cook-mode passes `currentStepIndex` + focused step explicitly. AROMA-style selective silence (intervene only at step boundaries / GRIS `commonMistakes` / allergy stops; ≤3–5/day). Graceful degradation to the deterministic floor — the screen is never dead. **Voice + generative-UI = POST-v1** (voice needs empirical Farsi STT/TTS validation; gen-UI is polish, not a safety/economics gate).

---

## 2. THE DETERMINISTIC INTENT CLASSIFIER (load-bearing, fully specified)

This is the component that decides whether a turn costs €0 or hits a model, and whether a safety-relevant query can ever be answered cheaply. v1 left it as "keyword-map + embedding-optional." Here it is in full.

### 2.1 It is NOT a second LLM call (by default)
The classifier is a **pure deterministic function** over the turn + `AssistantContext`: normalized-token matching against per-intent lexicons (fa/nl/en) + a few structural signals (route, has-recipe-context, contains-a-number, contains-a-quantity-unit). Zero network, sub-millisecond, fully unit-testable. An optional on-device/embedding tie-breaker may be added later behind a flag, but **the default path makes no model call** — that is what makes "analyze-then-answer" cheaper than naive chat, not more expensive.

### 2.2 Intent taxonomy (the full set)

| # | Intent | Example (fa / nl / en) | safetyRelevant | Default tier | dataScope |
|---|---|---|---|---|---|
| 1 | `greeting_smalltalk` | "سلام" / "hoi" / "hi" | no | NONE | none |
| 2 | `unit_conversion` | "۲۰۰ گرم چند فنجونه؟" / "200 g in cups" | no | NONE | none (deterministic table) |
| 3 | `timer_or_time` | "چقدر بپزه؟" / "hoe lang koken" | no | NONE | recipe (GRIS time) |
| 4 | `scaling` | "برای ۶ نفر" / "voor 6 personen" | **yes** (quantities) | CHEAP (narrate; **math deterministic**) | recipe |
| 5 | `substitution` | "جایگزینِ گردو؟" / "vervanging walnoot" | **yes** (allergen-adjacent) | CHEAP→STRONG | recipe + user diet |
| 6 | `technique_whyitworks` | "چرا باید تفت بدم؟" / "waarom aanbraden" | no | CHEAP | recipe/GRIS |
| 7 | `ingredient_facts` | "زعفران چیه؟" / "wat is saffraan" | no | CHEAP | ingredient (USDA) |
| 8 | `recipe_discovery` | "یه غذای گیاهیِ سریع" / "snel vegetarisch" | **yes** (diet/allergen filter) | CHEAP | corpus + user diet |
| 9 | `personal_plan_or_history` | "تو برنامهٔ این هفته‌ام چی دارم؟" | no (but authed) | CHEAP | user (Tier-U) |
| 10 | `nutrition_query` | "کالریش چنده؟" / "hoeveel calorieën" | **yes** (computed quantity) | CHEAP (narrate; **value deterministic**) | ingredient/recipe |
| 11 | `during_cook_problem` | "سُسم بریده شد" / "mijn saus is geschift" | **yes** (real-time, can mislead) | **STRONG** | recipe + current step |
| 12 | `stated_constraint` | "راستی من به گردو حساسیت دارم" / "ik ben allergisch voor walnoten" | **YES — critical** | special flow (§3) | user (write path) |
| 13 | `medical_or_health_advice` | "برای دیابتم چی بخورم؟" | **YES — blocked** | refuse via `ai-safety.guard` | none |
| 14 | `out_of_domain` | "آب‌وهوا چطوره؟" | no | refuse politely | none |
| 15 | `feedback` | "این جواب خوب بود" | no | NONE (`log_ai_feedback`) | user |
| 16 | `low_confidence_fallback` | anything below threshold | treated as **yes** | **STRONG** | full grounding |

### 2.3 Routing rules
- **NONE** only for intents with a deterministic, non-safety answer (1, 2, 3, 15) and high confidence.
- **CHEAP** = single-constraint, not time-critical, narrating a deterministically-computed result.
- **STRONG** = multi-constraint reasoning, `during_cook_problem`, or any `safetyRelevant && confidence < high`.
- **dataScope** decides which tools are even *offered* to the model this turn (least-privilege: a `unit_conversion` turn never gets the user-diet tool).

### 2.4 LOW-CONFIDENCE fallback (the safety rule)
**Never silently answer a safety-relevant query at a cheap/NONE tier on low confidence.** If `confidence < threshold` OR `safetyRelevant && confidence < high`: escalate to **STRONG with full grounding + the gate**, OR ask one clarifying question. The classifier may *downgrade* cost only when it is confident AND the intent is non-safety. A misclassification must fail toward *more* safety/cost, never less.

### 2.5 Persian + Dutch + English handling
Per-intent lexicons in all three languages + a normalization layer (Persian: strip diacritics, normalize ي/ك ↔ ی/ک, ZWNJ, Eastern-Arabic digits → ASCII; Dutch: lowercase, diacritic-fold; shared: number + unit detection). Code-switching is common in diaspora-adjacent and Dutch-learner usage → match across all lexicons in one pass, don't language-detect-then-route. Allergen/quantity keyword sets are maintained in all three languages as a governed param (no redeploy).

### 2.6 Measured accuracy target
- Overall intent accuracy **≥ 92%** on a labeled fa/nl/en set (≥ 600 turns, ≥ 150 per language).
- **Recall on `stated_constraint` + `medical_or_health_advice` ≥ 99%** (a missed allergy statement or medical query is the only truly costly error; precision can be lower — over-triggering the safe flow is acceptable).
- This is a **release gate**, measured in CI on the golden set (§ Phased Plan / P2).

---

## 3. CONVERSATIONAL-ALLERGY RESOLUTION (the safety hole, closed)

**The hole (verified):** the gate reads allergens ONLY from `getLivingUserProfile().reconciled.dimensions.allergies.reconciledValue`. A mid-chat statement lives in the untrusted LLM turn/summary, which the gate never reads. So "actually I'm allergic to walnuts" could be silently ignored while the gate keeps surfacing walnut recipes.

**The fix — the deterministic gate stays the single source of truth; nothing the LLM "remembers" is ever trusted for safety.** Safe flow:

1. **Detect** `stated_constraint` deterministically (§2, intent 12) — runs on the raw user turn, NOT on the LLM summary.
2. **Refuse to rely on it implicitly.** From this turn on, until resolved, the assistant must NOT give any allergy-dependent answer based on the unconfirmed statement. It surfaces a **confirm UI**: "متوجه شدم گفتی به گردو حساسیت داری. این رو به پروفایلت اضافه کنم تا همیشه رعایت بشه؟ (بله / نه)".
3. **On explicit confirm → WRITE into the declared-allergy set** (`UserAllergy` / the reconciled profile source) via the normal profile-write path, with consent/audit, BEFORE any further answer relies on it. Then re-run grounding so the gate now reads the new allergen from its real source.
4. **If the user declines or can't confirm right now → refuse to personalize on it** and prompt to set it in profile; fall back to the deterministic floor with the standard "always verify labels" disclaimer. Do NOT carry an unconfirmed allergen as a soft prompt instruction — that re-creates the hole.
5. **The LLM summary never becomes a safety input.** Confirmed constraints live in the structured profile (gate-readable); the summary is conversational context only.

**Why confirm-then-write, not auto-write:** a misheard/ASR-mangled/sarcastic statement auto-written to the safety profile is its own harm (false allergen → user's real safe recipes vanish, erodes trust). Confirm is one tap, removes ambiguity, and creates an auditable consent trail (matters for Art. 9). The cost of the extra tap is far below the cost of either silently ignoring OR silently fabricating an allergy.

---

## 4. MODEL-CHOICE: Gemini override + dual-cache provider seam

**Acknowledged contradiction:** `AI_STANDARD.md` specs Claude/Anthropic (Haiku→Opus, `cache_control` breakpoints). The founder's live provider is **Gemini**. v2 resolves this explicitly: **Gemini is the live provider; the design stays provider-agnostic at the `ModelProvider` seam so a switch to/from Anthropic is config, not rework.** The two providers' cache APIs are *different shapes*, and the seam must abstract both:

| Concern | Anthropic | Gemini | Seam abstraction |
|---|---|---|---|
| Cache mechanism | `cache_control: {type:"ephemeral"}` breakpoints inline in content blocks | `cachedContent` resource created out-of-band, referenced by handle | `provider.prepareCache(prefixBlocks)` → returns an opaque `CacheHandle`; `provider.generate({cacheHandle, volatile})` |
| Min cacheable size | ~1024 tokens (Haiku) / model-dependent | **~32k-token explicit-cache floor** (do NOT assume small prefixes cache) | seam reports `minCacheableTokens`; orchestrator skips explicit cache below it |
| Pricing model | cache *write* premium + cheap cache *read* | cache read discount **+ per-hour storage cost** | seam exposes `cacheWriteMultiplier`, `cacheReadMultiplier`, `cacheStorageUsdPerHourPer1M` |
| Tier names | Haiku / Sonnet / Opus | Flash-Lite / Flash / Pro | `ModelTier.CHEAP / STRONG` enum maps per provider |
| Tool schema | Anthropic tool JSON | Gemini `functionDeclarations` | `provider.translateTools()` |

**Gemini cache economics — realistically (do NOT overstate the discount):** the headline "75–90% off cached tokens" is the *read* discount and applies only ABOVE the ~32k-token explicit-cache floor, AND carries a **per-hour storage cost** while the cache lives. For Garnish's prompt (system+tools+summary+focused recipe ≈ 5–15k tokens typically) **most turns will NOT clear the 32k explicit-cache floor**, so the realistic win is from **implicit prefix caching** (smaller discount, no storage fee, no floor) — not the explicit cache. **Explicit `cachedContent` is only worth it when the serialized ingredient-corpus prefix (>32k) is pinned for an active cooking session** and the per-hour storage cost is amortized over enough turns in that hour. The cost model below assumes the **conservative case (no explicit-cache discount)** and treats any explicit-cache savings as upside.

---

## 5. COST / UNIT-ECONOMICS MODEL (the missing piece)

All numbers are an explicit model with stated assumptions; **verify the live Gemini rate card at wire-up** (rates move — `ai-cost-rate-catalog.ts` must be populated with source-attributed rates, per its own contract).

### 5.1 Rate assumptions (per 1M tokens, to be verified)
- **CHEAP (Flash-Lite class):** ~$0.10 input / ~$0.40 output.
- **STRONG (Flash class):** ~$0.30 input / ~$2.50 output.
- (Pro reserved for L2b batch synthesis, not interactive turns.)

### 5.2 Tokens per turn (conservative, no explicit-cache discount)
Prompt layout per interactive turn: system+tools (~2.5k) + serialized focused recipe/GRIS slice (~2k) + 300-token summary + 8 verbatim turns (~1.2k) + user turn (~0.1k) ≈ **~6k input tokens**; output ≈ **~0.5k tokens**.

| Turn type | Tier | In | Out | Cost/turn (no cache) | With implicit prefix cache (~conservative 40% off the cacheable ~4.5k input) |
|---|---|---|---|---|---|
| NONE (deterministic) | — | 0 | 0 | **$0.000** | $0.000 |
| CHEAP | Flash-Lite | 6k | 0.5k | (6k·0.10 + 0.5k·0.40)/1M = **$0.00080** | ≈ **$0.00062** |
| STRONG | Flash | 6k | 0.7k | (6k·0.30 + 0.7k·2.50)/1M = **$0.00355** | ≈ **$0.00301** |

### 5.3 Turns per cook + per active-user-month
Assume a realistic engaged user mix per turn: **35% NONE, 50% CHEAP, 15% STRONG** (deterministic absorbs the cheap long tail by design).
- **Blended cost/turn (no cache)** = 0.35·0 + 0.50·$0.00080 + 0.15·$0.00355 ≈ **$0.00093**.
- **Cook session** ≈ 10–15 assistant turns → **~$0.011–$0.014 per cook**.
- Engaged user: ~12 cooks/mo + ~80 ad-hoc turns → ~**260 turns/mo** → **~$0.24/active-user-month** (no cache). With implicit caching ≈ **~$0.19/user-mo**. Heavy user (2× turns) ≈ **~$0.40–0.48/user-mo**.

### 5.4 Map the cost ceiling → the daily token cap → the anti-spam caps
This is the v1 gap: caps were *asserted* (150/day). v2 *derives* them.

**Step 1 — set the ceiling.** Recommended AI COGS ceiling = **≤15% of the €7 (~$7.6) revenue = ~$1.14/user-mo** (leaves room for infra + the standard ~30% app-store cut on the gross). This is the founder decision in §9.

**Step 2 — convert to a daily token budget.** At the blended CHEAP/STRONG output mix, $1.14/mo ÷ 30 ≈ **$0.038/user/day**. At the conservative blended cost, that funds **~40 STRONG-equivalent turns/day** or **~290 turns/day of pure CHEAP** — i.e., a *genuine heavy cook never hits it*. Translate to tokens for the existing `PersistedDailyBudgetService`: at ~6.5k tokens/billable turn, $0.038/day ≈ **~120k–150k input-equiv tokens/day** as the per-user daily token cap (the Denial-of-Wallet ceiling, OWASP LLM10). This **derives** the ~150/day number v1 asserted — it's the abuse ceiling, not the product limit.

**Step 3 — the anti-spam caps are the *abuse* guardrail under the cost ceiling, not the product limit.** Because the deterministic tier (NONE) is free and absorbs 35% of turns, the binding constraint is *billable* turns. Caps below are set so that (a) no real cook is ever blocked, (b) a single abuser cannot exceed the daily $ ceiling.

| Layer | Algorithm | Default (established user) | Derivation |
|---|---|---|---|
| Per-message cooldown | token bucket cap **2**, refill **1/15s** | ~15s spacing, 1 quick follow-up | UX (typing cadence), not cost |
| Hourly | sliding-window ZSET | **40 billable** | a dense cook hour fits; caps burst-abuse |
| Daily billable | sliding-window | **150 billable** | = the $0.038/day token ceiling at the blended mix |
| Weekly | sliding-window | **600** | ~4 heavy days |
| Monthly | sliding-window | **2000** | = ~$1.14 at blended cost → the COGS ceiling |
| Token/cost ceiling | extend `PersistedDailyBudgetService` to hourly + Redis | daily ~140k tokens + hourly sub-cap | the actual $ guard; caps above are proxies |
| Input guard | per-call | ~2000 chars / ~1500 tokens in; `max_output_tokens` 8000 | prompt-bomb guard |

Trust tiers (governed table): per-IP only as a DDoS backstop (CGNAT/household false-positives), new accounts ~50% of caps, established full, paid higher. **When a cap binds → DEGRADE to the deterministic grounded reply (never hard-lockout)** + `429 + Retry-After + {retryAfterSeconds, tier, remaining}`, distinguishing cooldown from tier-exhaustion. Redis atomic Lua per check (token-bucket `HGET`+refill+consume; sliding-window `ZREMRANGEBYSCORE`+`ZCARD`+`ZADD`+`EXPIRE`; clock from `redis.call('TIME')`). Every number is a governed param (L2b-tunable, no redeploy) — never a TS constant.

### 5.5 L2b (admin) cost
Nightly digests via **Gemini Batch API (~50% off)** + STRONG/Pro, run on aggregates not per-user — bounded, single-digit-$/day at launch scale, not in the per-user model. **Never Batch for System A** (interactive latency).

---

## 6. SYSTEM B — Admin/Analytics AI (L2b)

NEVER free-form text-to-SQL (silent ~10–17% wrong on realistic schemas). **Semantic/metrics layer** defining each param once (`key, formula, dimensions, validRange, honestyTag ∈ {real|awaiting_pilot|inferred}`). The ~200 target = a `(insight-type × metric-family × entity)` taxonomy; each param → ONE deterministic query; the LLM only narrates.

### 6.1 The 15–20 launch params (named)
Built on the existing `AnalyticsIntelligenceService` honesty convention (each tagged):
1. cook_completion_rate, 2. step_dropoff_rate (per recipe×step), 3. recipe_abandonment_rate, 4. swap_rate (per ingredient), 5. scale_usage_rate, 6. avg_rating (per recipe), 7. D1/D7/D30 retention, 8. planner_adherence_rate, 9. AI_turn_volume, 10. AI_abstention_rate, 11. AI_degrade_to_deterministic_rate, 12. allergy_gate_drop_rate, 13. recipe_discovery→cook conversion, 14. shopping_list_completion_rate, 15. beginner_vs_experienced_completion_gap, 16. top_problem_dishes (metric-tree driven), 17. top_swapped_ingredients, 18. AI_cost_per_active_user (from the now-populated catalog), 19. anti_spam_cap_bind_rate, 20. consent_grant_rate (Art. 9 personalization opt-in).

### 6.2 WHY-layer + autonomy
Metric trees for arithmetic root-cause (`cook_completion = opens × start_rate × finish_rate`); deterministic-detect / LLM-narrate split ("completion fell 12%, driven by Step 4 of Ghormeh Sabzi for beginners"). WHY-moat = join events to GRIS food-science + ingredient `cookingBehavior`. Supervised autonomy ladder (Tier 0 read-only / Tier 1 reversible audited / Tier 2 irreversible synchronous-approver); every write = a structured approval artifact in a review queue; policy-as-code (OPA/Cedar) OUTSIDE the LLM (no DELETE; allergen/safety fields read-only to the agent); staging → canary on L0 signals → auto-rollback. **Build System B's read-only insight layer as the first live-Gemini beachhead** (internal, low-risk) before any user-facing live answer.

---

## 7. Exact deltas on existing files
- `ai-orchestrator.service.ts`: add deterministic classify/plan (§2) + `GarnishRateLimitService` (before cost) + bounded tool loop (≤3 tool calls/turn) replacing the single `model.generate`.
- `chat-orchestration.service.ts`: feed window+summary, cache-ordered prompt, emit `UserEvent`s.
- `grounded-reply.service.ts`: hybrid+alias retrieval; generalize `screenLiveOutput` to all entities + ban computed quantities in cached answers (gate logic untouched); wire the `stated_constraint` confirm→write flow (§3).
- `model-provider.factory.ts`: `ModelTier{CHEAP,STRONG}` + capability flags (`supportsTools/StructuredOutput/ContextCache`, `minCacheableTokens`, `cache*Multiplier`, `cacheStorageUsdPerHourPer1M`) + `translateTools()`.
- `ai-cost-controller.service.ts`: Redis-atomic, durable, multi-instance; stays spend-only.
- `ai-cost-rate-catalog.ts`: **populate verified Gemini rates** (source-attributed, per the file's own contract) so `estimatedCostUsd` is non-null.
- `tool-registry.service.ts`: register Tier-U scoped tools + expose JSON schemas to the provider.
- `ai.controller.ts`: Redis `ThrottlerStorage` adapter.
- `gemini-model.provider.ts`: `functionDeclarations`, JSON-schema structured output, `cachedContent`, streaming.
- New: `UserScopedTool` base; `RecipeStepMastery` derivation (or table); `IntentClassifierService` (pure, tested).
- Flip live = `AI_PROVIDER=gemini` + `AI_LIVE_ENABLED=true` + `AI_CHAT_LIVE_ENABLED=true`, only after the P2 gate.

---

## 8. Safety / EU posture
- **Article 50 (transparency):** persistent "AI assistant" label + first-turn disclosure (in-product, not buried in T&C). **Deadline 2 Aug 2026.**
- **GDPR Art. 9:** diet/allergy/health = special-category → **explicit opt-in via `UserConsent(purpose='ai_personalization')`**; no consent = cooking-only assistant (public tools only), consent = Tier-U personalization. **DPIA mandatory** before live. Engage Dutch AP AI Loket/sandbox.
- **MDR:** "unlimited health" + diagnose/treat reclassifies as a medical device — **marketing copy alone can trigger it**; keep the `ai-safety.guard` medical blocks and watch the copy.
- **Allergy:** unknown allergen data fails **CLOSED** (treated unsafe); "always verify labels" disclaimer on every allergy-relevant reply.
- **Prompt injection:** regex is layer-1 only; the moat is structural (allow-listed tools, code-level `where` scoping, output entity-screen, retrieved UGC spotlit as untrusted DATA).
- **Eval as CI gate:** fa+nl+en golden set with EU red-team cases; allergen leaks = hard fail.

---

## 9. FOUNDER DECISIONS

**DECIDED 2026-06-22 (founder confirmed all three recommended defaults):**
- **D1 = ≤15% of revenue (~$1.14/user-mo)** anti-abuse cost ceiling (real heavy use ~$0.19–0.48 stays well under → "unlimited in domain" preserved).
- **D2 = confirm-then-write** for conversational allergies (deterministic gate remains the sole source of truth).
- **D3 = build now + live-test in the IRAN SANDBOX (no EU legal gate); EU live ~Sep 2026** after DPIA + multilingual eval + legal (deferred past the 2 Aug Article-50 deadline).

Three genuine business/product calls. Each has my recommended default + reasoning; **the founder owns the final call.**

### D1 — AI cost ceiling per active-user-month
**Recommended default: ≤15% of revenue ≈ $1.14/user-mo** (the monthly anti-spam cap is set to this).
- Reasoning: at the modeled ~$0.19–0.48/user-mo for real usage, a $1.14 ceiling is ~2.5–6× headroom over genuine heavy use, so no real cook is ever throttled, while it still hard-caps Denial-of-Wallet abuse. Going higher (e.g., 25%) buys little real-user benefit and erodes margin after the app-store cut; going lower (<10%) risks throttling power users (your premium persona) to save cents. [احتمالاً — depends on the verified live rate card; re-confirm after populating the catalog.]
- **Decision needed:** confirm 15%, or set your own % of €7.

### D2 — Conversational-allergy policy
**Recommended default: confirm-then-write (§3, option 3).**
- Reasoning: auto-write risks fabricating an allergy from a misheard/sarcastic line (breaks the user's real recipes, erodes trust, pollutes the safety profile); ignore-and-hope is the current silent hole. Confirm-then-write is one tap, removes ambiguity, creates the Art. 9 consent trail, and keeps the deterministic gate the sole source of truth. [قطعی — this is the only option that closes the hole without creating a new one.]
- **Decision needed:** accept confirm-then-write, or accept the (worse) auto-write convenience tradeoff.

### D3 — Live launch before 2 Aug 2026, or defer?
**Recommended default: DEFER user-facing live launch past 2 Aug; ship the deterministic assistant + System-B internal beachhead first.**
- Reasoning: the live-flip gate honestly requires DPIA + Art. 9 consent wiring + multilingual golden eval (≥600 turns, authored + labeled) + Redis anti-spam + memory + populated cost catalog. That is **not** 6 weeks of work to do *safely*; rushing it to beat the Art. 50 date inverts the risk (Art. 50 governs *disclosure of a live AI* — if you don't ship live AI to EU users before 2 Aug, the deadline doesn't bite yet, and the deterministic assistant needs no AI-Act transparency flip). The deterministic grounded assistant already delivers real value with zero model risk. [احتمالاً — the binding constraint is DPIA + eval authoring calendar time + legal sign-off, not engineering alone; confirm DPIA lead time with counsel.]
- **Decision needed:** (a) defer live to a date after eval+DPIA are green (recommended), or (b) commit resources now to attempt a pre-2-Aug live flip — which means parallelizing DPIA + eval authoring starting this week and accepting a hard go/no-go on the gate.

---

## 10. PHASED BUILD PLAN (gates + realistic dates)

> Today = 2026-06-22. Dates assume the existing 1-builder cadence; each gate is binary pass/fail. Italic = ships value even while live is OFF.

| Phase | Scope | Earliest realistic window | PASS gate | FAIL signal |
|---|---|---|---|---|
| **P0 — Observability + cost honesty** *(prerequisite)* | Emit swap/scale/remove + every assistant turn via `EventOutbox`; Redis-atomic cost controller; **populate verified Gemini rate catalog** | **now → ~3 Jul** | every swap/scale/remove emits a verifiable event; `estimatedCostUsd` non-null; counters correct under 2 instances | dropped event / null cost / per-instance drift |
| **P1 — Grounding + ambient + intent classifier** *(live still OFF)* | Hybrid+alias retrieval; serialize corpus to cacheable prefix; Tier-U scoped tools (`UserScopedTool` base); `IntentClassifierService`; memory (window+summary); ambient affordances | **~4 Jul → ~25 Jul** | Recall@5 ≥ 0.80 (vs ~0.64); intent accuracy ≥ 92% / safety-recall ≥ 99%; "for 6 people" resolves vs prior turn; isolation test leaks no other user's row; conversational-allergy confirm→write works | silent dead-end where an answer exists; safety-intent miss; cross-user leak |
| **P2 — Flip live (HARD gate, ALL required)** | DPIA filed; Art. 9 consent wired; **fa/nl/en golden eval green**; Redis anti-spam live; cost catalog populated; generalized output gate; Art. 50 disclosure | **earliest ~Sep 2026** (DPIA + eval authoring + legal are the long poles — *past 2 Aug; see D3*) | 0 allergen leaks; ≥95% groundedness; degrade-not-lockout verified; classifier safety-recall ≥99% on golden set | any leak / hallucinated entity / lockout / DPIA not signed |
| **P3 — Act (tool-calling + apply)** | Bounded tool loop; preview-then-confirm applies; apply emits L1 signal | ~3–4 wks after P2 | applied swap → L1 signal; empty/failed tool → honest "I don't have that" | unscoped tool call / apply without preview-confirm |
| **P4 — Real-time during-cook** | Streaming TTFT; AROMA intervention at GRIS failure points; semantic cache (quantity+allergy barred) | ~3 wks after P3 | TTFT <~500ms CHEAP; ≤3–5 interventions/day; semantic-cache FP <0.5%; no computed-quantity cache hit | mistimed pop-ups / cross-allergen or quantity cache hit |
| **P5 — L2b read-only insight** *(first live-Gemini beachhead, internal)* | Semantic layer + 15–20 launch params + metric trees + nightly Batch scans | can run **in parallel from ~P1** (internal, low risk) | stated number == deterministic query; refuses beyond-data | invented metric / any free SQL |
| **P6 — L2b supervised autonomy** | Propose-only `plan` mode; review queue w/ diffs; policy-as-code; staging+canary | after P5 stable | nothing mutates prod without approved reversible audited proposal; allergy fields human-gated | autonomous write to a safety field |

**Critical path & sequencing note:** P0 is the single dependency under L1 learning, L2b's substrate, AND anti-spam cost correctness — start it first. P1 ships a genuinely better assistant with ZERO live-model risk and zero AI-Act exposure (no live AI = no Art. 50 flip needed yet). P5 (internal admin insight) is the *honest* place to exercise live Gemini first — low blast radius, no user safety surface — before P2 ever points a live model at a user. The **earliest honest user-facing live-flip date is ~Sep 2026**, gated on DPIA + multilingual eval authoring + legal, which is *after* 2 Aug — hence D3's defer recommendation.

**نتیجهٔ عملی:** Start P0 this week (events + Redis cost/quota + populated rate catalog) — everything else is blocked on it. Author the fa/nl/en golden eval (≥600 turns, ≥150/language; assign: PM/founder labels the safety + scaling-math + allergen-edge cases, a Persian+Dutch native reviewer validates phrasing) in parallel during P0–P1 so it's not the thing that slips P2. Treat 2 Aug 2026 as a *disclosure* deadline that only bites once you ship live AI to EU users — so deferring the live flip past it (D3) is the low-risk default, not a failure.
