The spec is written to `C:\dev\garnish-app\docs\audit\AI_DESIGN_SPEC.md`. Returning the spec content as my output.

---

# Garnish AI — Concrete Design Spec (both systems)

Written to `C:\dev\garnish-app\docs\audit\AI_DESIGN_SPEC.md` (companion to the existing `AI_STANDARD.md`). Full content below.

> Buildable engineering spec for the two Garnish AI systems, grounded in the **actual** `apps/server/src/ai` rails (read 2026-06-22). Provider = **Gemini**, kept **provider-agnostic** at the `ModelProvider` seam. Persian-first; EU/Holland **general-public** launch.

## 0. Reality Check
The rails are a governance skeleton, not a product. Verified gaps in code:
- **Gap 1 — no memory:** `chat-orchestration.service.ts` passes only the current turn. Follow-ups impossible.
- **Gap 2 — keyword retrieval:** `grounded-reply.service.ts → retrieveCandidateIds()` → `search_recipes.tool.ts` is Prisma `contains`. Misses synonyms; silent-empty dead-end.
- **Gap 3 — the user-data tool strips everything:** `get-user-food-context.tool.ts` deletes `allerg|health|diet|weight|calorie` keys + returns `recentSignals: []`. The "full per-user access" assistant has access to almost nothing.
- **Gap 4 — tools human-routed:** the 8 tools are one-per-endpoint (`ai.controller.ts`), not LLM-callable.
- **Gap 5 — cost blind & non-durable:** `ai-cost-controller.service.ts` is an in-memory `Map`; `ai-cost-rate-catalog.ts` ships empty → `estimatedCostUsd` always null.
- **Gap 6 — anti-spam absent:** `@nestjs/throttler` is in-memory (Redis is wired for `CacheModule` but NOT the throttler). No cooldown/tiers/token-bucket.
- **Gap 7 — live OFF by design:** `model-provider.factory.ts` (correct default).

**Non-negotiable invariant:** the HARD allergy gate in `grounded-reply.service.ts` (`assessRecipeFit` + `analyzeRecipeIntegrity`, declared allergens never enter a prompt, fail-closed) stays the source of truth. The LLM explains the deterministic answer; it never is the answer.

## 1. SYSTEM A — Omnipresent User Assistant (L2a)

**1.1 Scope ("unlimited within food/health" defined):** unlimited *topic breadth* in food/health, NOT unlimited safety surface, NOT medical scope (keeps Garnish out of EU MDR). IN: technique/why-it-works, subs, scaling, pantry, **this user's own** diet/plan/mastery/saved recipes, source-locked nutrition facts, pairings/EU-occasion fit. OUT (keep `ai-safety.guard.ts` blocks): diagnosis/treatment/dosing, therapeutic disease diets, allergy "safe-to-eat" guarantees, undisclosed-condition inference, vision. The capability comes from new **authed tools**, not from relaxing the guard.

**1.2 Tool/grounding architecture [قطعی]:** bounded tool-calling loop over a fixed allow-list of deterministic, parameterized, `userId`-scoped Prisma tools — NOT document-RAG, NOT text-to-SQL. Two tiers: keep the 7 public tools; add **Tier U authed** tools (`get_user_diet_and_personalizations`, `get_user_weekly_plan`, `get_recipe_step_mastery`, `get_current_recipe_context`, `get_ingredient_facts`). **Do NOT extend `get-user-food-context.tool.ts`** — its strip-list is right for the public context. Per-user isolation enforced in CODE via a `UserScopedTool` base injecting `where:{userId}`, fail-closed if absent (prompt-level "don't leak" is not a control — OWASP LLM01).

**Retrieval — replace keyword `contains` with hybrid (NOT vector RAG):** structured-field match (ingredient/technique/dishType/region/diet) + curated alias/synonym expansion (eggplant↔aubergine↔بادمجان for the Dutch audience) + Postgres tsvector + `pg_trgm` fuzzy; on empty → closest safe alternatives, never a dead-end. Vector RAG rejected at ~1,008 records (adds retrieval-miss hallucination for zero gain; add `pgvector`+RRF+reranker only if a held-out eval later proves a gap). Generalize `screenLiveOutput` so the model may reference ONLY entity IDs returned by tools this turn; every claim carries a provenance pointer ("per USDA-locked value", "GRIS step 4").

**1.3 Multi-turn:** window + rolling summary (never raw transcript = O(n²)). Last 8 turns verbatim + ~200–400-token LLM summary of older turns. Summary EARLY in the cacheable prefix; **live user turn LAST** (lost-in-the-middle + cache safety). Persist via existing `ChatMessageService`.

**1.4 Analyze-then-answer flow (token-efficient):** a **deterministic** classify/plan step (no LLM call) emits `{intent, modelTier: NONE|CHEAP|STRONG, dataScope, cacheable}` → NONE answers from tools/templates (0 tokens) → retrieve via deterministic tools (HARD allergy gate here) → exactly ONE generation call (CHEAP=Flash-Lite for the long tail; STRONG=Flash/Pro for multi-constraint/during-cook), streamed. Do NOT make classify a second LLM call by default. Caching, in safety order: (1) exact-match keyed on `hash(prompt+allergenSet+diet+personalizationSig)`; (2) Gemini implicit prefix cache via the `[stable system+tools][stable corpus][summary][volatile turn]` layout (~75–90% discount); (3) semantic cache at 0.97 behind a flag. **Hard rule:** allergen set in the key, cache AFTER the gate, re-validate safety hits against live records.

**1.5 Learning hookup:** every apply (swap/scale/remove/cook-this) emits a structured `UserEvent` (closes the ZERO-events gap) → L1's missing training signal; implicit signals default, explicit `log_ai_feedback` sparingly; `find_substitutes`/`suggest_pairings` call the L1 ranker.

**1.6 Omnipresence:** ambient affordances, NOT an "AI tab" — long-press ingredient, "I'm stuck" on the current step. Typed `AssistantContext` per screen via `get_current_recipe_context`; cook-mode passes `currentStepIndex` + focused step **explicitly**. AROMA selective-silence (intervene only at step boundaries / GRIS `commonMistakes` / allergy stops; ≤3–5/day). Graceful degradation to the deterministic floor — screen never dead. Voice is table-stakes but **verify Farsi STT/TTS empirically first**.

**1.7 Anti-spam (separate from the cost budget) — Redis atomic Lua:**

| Layer | Algorithm | Default (established user) |
|---|---|---|
| Per-message cooldown | token bucket cap **2**, refill **1/15s** | ~15s spacing, 1 quick follow-up |
| Hourly | sliding-window ZSET | **40** |
| Daily | sliding-window | **150** (a heavy real cook just fits) |
| Weekly | sliding-window | **600** |
| Monthly | sliding-window | **2000** |
| Token/cost ceiling | extend `PersistedDailyBudgetService` to hourly | daily 200k + hourly cap (Denial-of-Wallet, OWASP LLM10) |
| Input guard | per-call | ~2000 chars / ~1500 tokens, `max_output_tokens` 8000 |

Trust tiers (config table): per-IP only as DDoS backstop (CGNAT/household false-positives), new accounts ~50%, established full, paid higher. Lua per check: token-bucket `HGET`+refill+consume; sliding-window `ZREMRANGEBYSCORE`+`ZCARD`+`ZADD`+`EXPIRE`; clock = `redis.call('TIME')`. **When a cap binds, DEGRADE to the deterministic grounded reply** (never hard-lockout) + `429 + Retry-After + {retryAfterSeconds,tier,remaining}`, distinguishing cooldown from tier-exhaustion. Put every number in the governed-param surface (L2b-tunable, no redeploy), never TS constants. "Unlimited" = caps no genuine cook hits, not literal-uncapped.

## 2. SYSTEM B — Admin/Analytics AI (L2b)
NEVER free-form text-to-SQL (silent ~10–17% wrong). **Semantic/metrics layer** defining each param once (`key, formula, dimensions, validRange, honestyTag`); start with 15–20 launch params. The ~200 = a `(insight-type × metric-family × entity)` taxonomy, each → one deterministic query. **Metric trees** for arithmetic root-cause (`cook_completion = opens × start_rate × finish_rate`). **Deterministic-detect / LLM-narrate split** — stats compute the number + attribution, the LLM only narrates ("completion fell 12%, driven by Step 4 of Ghormeh Sabzi for beginners"). WHY-moat = join events to GRIS food-science + ingredient `cookingBehavior`. Nightly digests via **Gemini Batch API (50% off)** + STRONG model (never Batch for System A).

**Supervised autonomy:** permission ladder (Tier 0 read-only autonomous / Tier 1 reversible async-audited / Tier 2 irreversible synchronous-approver). Every write = a structured approval artifact (`current→proposed, evidence, expectedEffect, blastRadius, reversibility, confidence, approver`) in a review queue. Policy-as-code (OPA/Cedar) OUTSIDE the LLM: no DELETE, allergen/safety fields read-only to the agent. Never write to prod directly — staging → canary on L0 signals → auto-rollback. Autonomy EARNED via low override rate per action class (extend `AICallLog` into an action ledger). **Build System B's read-only insight layer as the first live-Gemini beachhead** (internal, low-risk) before any user-facing live answer.

## 3. Exact deltas on existing files
`ai-orchestrator.service.ts`: add classify/plan + `GarnishRateLimitService` (before cost) + bounded tool loop (≤3/turn) replacing single `model.generate`. `chat-orchestration.service.ts`: feed window+summary, cache-ordered prompt, emit events. `grounded-reply.service.ts`: hybrid+alias retrieval, generalize `screenLiveOutput` to all entities (gate untouched). `model-provider.factory.ts`: TIER enum CHEAP/STRONG + capability flags (`supportsTools/StructuredOutput/ContextCache`) + `translateTools()`. `ai-cost-controller.service.ts`: Redis atomic, stays spend-only. `ai-cost-rate-catalog.ts`: **populate verified Gemini rates** (Flash-Lite ~$0.10/$0.40, Flash ~$0.30/$2.50 per 1M in/out — verify at wire-up). `tool-registry.service.ts`: register Tier U + expose schemas. `ai.controller.ts`: Redis ThrottlerStorage adapter. `gemini-model.provider.ts`: `functionDeclarations`, JSON-schema structured output (avoid `anyOf` on 2.0-flash, prefer 2.5+), context caching, streaming. Flip live = `AI_PROVIDER=gemini + AI_LIVE_ENABLED=true + AI_CHAT_LIVE_ENABLED=true` only after the Phase-2 gate.

## 4. Phases + pass/fail
- **P0 Observability+cost honesty (prerequisite):** PASS = every swap/scale/remove emits a verifiable event; `estimatedCostUsd` non-null; counters correct under 2 instances. FAIL = dropped event / null cost / per-instance drift.
- **P1 Grounding+ambient (still stubbed):** PASS = Recall@5 ≥ 0.80 (vs ~0.64 keyword); "for 6 people" resolves against prior turn; isolation test leaks no other user's row. FAIL = silent dead-end where an answer exists.
- **P2 Flip live (gate, ALL required):** cost catalog populated; anti-spam Redis-atomic; Persian+English golden eval green (allergen edges, swap correctness, scaling math, during-cook, Dutch zero-Persian phrasing); generalized output gate; Article 50 disclosure; consent gate. PASS = 0 allergen leaks, ≥95% groundedness, degrade-not-lockout verified. FAIL = any leak/hallucinated entity/lockout.
- **P3 Act (tool-calling+gen-UI):** PASS = applied swap → L1 signal; empty/failed tool → honest "I don't have that". FAIL = unscoped tool call / apply without preview-confirm.
- **P4 Real-time:** PASS = TTFT <~500ms CHEAP, ≤3–5 interventions/day, semantic-cache FP <0.5%. FAIL = mistimed pop-ups / cross-allergen cache hit.
- **P5 L2b read-only:** PASS = stated number == deterministic query, refuses beyond-data. FAIL = invented metric / any free SQL.
- **P6 L2b autonomy:** PASS = nothing mutates prod without approved reversible audited proposal; allergy changes human-gated. FAIL = autonomous write to a safety field.

## 5. Safety/EU posture
Article 50: persistent "AI assistant" label + first-turn disclosure (not in T&C), deadline 2 Aug 2026. GDPR: diet/allergy/health = Art. 9 → explicit opt-in consent; no consent = cooking-only assistant, consent = personalized; **DPIA mandatory**; Dutch AP AI Loket/sandbox. MDR: "unlimited health" + diagnose/treat reclassifies as a medical device — **marketing copy alone can trigger it**; keep the medical blocks. Health-claim law: `nutrition-claim.guard.ts` is a real asset, keep it. Allergy: **unknown allergen data fails CLOSED (unsafe)**, "always verify labels" disclaimer. Prompt injection: regex is layer 1 only; the moat is structural (allow-listed tools, code-level `where` scoping, outbound screen, spotlight retrieved UGC as untrusted DATA). Eval as CI gate with EU red-team cases (fa+nl+en). Liability [نامطمئن]: unsettled in EU — audit log + hard gate + conservative defaults are the real protection; confirm with counsel.

## 6. Anti-patterns to reject
vector RAG over 1,008 records; user-facing text-to-SQL; LLM enforcing allergens/scaling/recipes/numbers; loud AI tab; hard-lockout anti-spam; per-IP as primary limiter; conflating anti-spam with cost budget; full-transcript replay; flipping live without catalog/anti-spam/eval/memory; reusing the strip-everything tool; admin AI writing prod without staging+diff+approval; "unlimited" as literal-uncapped or as relaxing safety gates.

**نتیجهٔ عملی:** Build order, not theory. Start Phase 0 (events + Redis cost/quota + populated rate catalog) — the single dependency under L1 learning, L2b, and anti-spam correctness. Then Phase 1 grounding (ships value while stubbed). Flip live only behind the Phase-2 gate. Use System B's read-only insight layer as the first live-LLM beachhead before any user-facing live answer.