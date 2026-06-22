# AI_LEARNING_ARCH — Learning, Understanding & Watchdogs

> The definitive architecture for how the Garnish AI **learns** (individual + collective), **truly understands** every question (typos, any phrasing, fa/nl/en) **at minimal cost**, and is **guarded** so code changes never silently break wiring or weaken a safety gate.
>
> Companion to: `AI_INTERNALIZATION_ARCH.md` (the deterministic L0→L4 core + cost discipline), `LIVING_USER_CONTEXT.md` (the individual-memory read graph), `L1_PLAN.md` (the collective-prior empirical-Bayes engine), `AI_STANDARD.md`, `AI_DESIGN_SPEC.md`.
>
> Status date: 2026-06-22. Author: lead architect. Every code claim below was verified against the repo at write time; file:line references are load-bearing.

---

## 0. Reality Check (read this first)

**[قطعی] The three-loop thesis is architecturally sound and the substrate genuinely exists — but Garnish is NOT a learning system today.** It is a deterministic answerer + a dormant batch job + an unread memory. Stated honestly so the plan attacks the real gap, not an imagined one:

| Loop | Founder's intent | Honest state today | Verified evidence |
|---|---|---|---|
| **1 — Individual memory** | "knows ME more, the more I use it" | **~0% wired.** Snapshot is a hardcoded stub. | `behavioral-context-snapshot.service.ts:41-44` returns `signals: {}, consents: ['core'], dataMaturity: 'cold-start'`; `get-user-food-context.tool.ts:44` returns `recentSignals: []`. |
| **2 — Collective taste (L1)** | "the crowd makes everyone better" | **BUILT but default-OFF, and biased.** | `recipe-prior.service.ts:22-24` `L1_RECIPE_PRIOR_ENABLED` defaults OFF; `ranking.service.ts:112` `recipePrior: 0.0` weight pinned; `recipe-prior-learner.service.ts:15-17` self-documents *"JOINABLE-but-BIASED, not counterfactually unbiased … Never claim 'unbiased'."* |
| **3 — Improvement loop** | "gets smarter the more it's questioned" | **DOES NOT EXIST as a closed loop.** Feedback is written, never read back to tune anything. | `intent-classifier.service.ts:50` `matched[]` is produced then **discarded**; `AICallLog` (schema `:911-940`) stores cost/`guardHits`/`metadata` but **no intent decision**; `ai_feedback` lands in metadata keyed by messageId and **cannot be joined** to the classifier decision that produced the answer. |

**The invention is mostly done. The missing thing is the WIRING + the GOVERNANCE that turns captured data into an approved param change.** That gap is the entire task of this document.

**[قطعی] One irreversible dependency gates everything: the `requestId` echo.** The columns exist (`schema.prisma:715,723,735,740` on `RecommendationServedItem` + `RecommendationAttributionEvent`). But if the **client does not echo `requestId` on the action/reward event**, the served↔reward join is empty and *all of Loop 2 and the outcome half of Loop 3 are permanently unlearnable for that traffic — it cannot be backfilled.* Verify the client echo end-to-end in Phase 0 or the data is lost forever.

---

## 1. Architecture shape — one core, three loops, two watchdogs

The validated shape: **a deterministic CORE that never self-mutates at request time**, wrapped by **three asynchronous learning loops that only ever change DATA the core READS** — never the core's control flow at runtime — and protected by **two watchdog lanes**.

```
                       ┌───────────────────────────────────────────────────────────┐
                       │                    DETERMINISTIC CORE                       │
   user turn  ─────►   │  normalizeText → IntentClassifier → (typo) → (embed tie)    │  ──► answer (€0)
   (fa/nl/en, typos)   │  + SubstitutionEngine + HARD allergy gate                   │      or escalate
                       │  (pure, sub-ms, $0, replayable; SAFETY OVERRIDES run FIRST)  │
                       └──────────▲───────────────────────────▲────────────▲────────┘
                                  │ READS data                 │ READS      │ last resort
                                  │ (never mutated at runtime) │            ▼
            ┌─────────────────────┴──────┐  ┌─────────────────┴──────┐   ┌──────────────┐
   LOOP 1   │ UserContextGraph (snapshot)│  │ LOOP 2: RecipePrior    │   │  GEMINI       │
   indiv.   │ getUserContextGraph()      │  │ empirical-Bayes priors │   │  (paid, rare) │
   memory   │ refresh-on-event-drain, $0 │  │ nightly learner, gated │   │  provider=    │
            └─────────────────────▲──────┘  └─────────────────▲──────┘   │  Gemini       │
                                  │                            │          └──────┬───────┘
                                  │  nightly batch PROPOSES    │                 │ capture
                                  │  diffs → REVIEW QUEUE      │                 ▼
            ┌─────────────────────┴────────────────────────────┴──────────────────────────┐
   LOOP 3   │  IMPROVEMENT LOOP: AiTurnDecision + ai_feedback + downstream outcome  ──join──►│
            │  nightly mining → new anchors / weight tweaks / threshold recalibration       │
            │  → human-approved diff → governed-param commit (NEVER an online mutation)     │
            └──────────────────────────────────────────────────────────────────────────────┘

   WATCHDOGS:  LANE A (static, $0, every push — blocks CI)  ·  LANE B (LLM swarm, milestone + «پایش» only)
```

**Why this separation is correct (keep it):** learning happens OUT of the hot path (nightly/async); the hot path stays `$0`-deterministic, safe, and replayable. Learning may only make **non-safety** answers cheaper/better. **It may NEVER touch a safety gate.** That single line is what lets Garnish ship learning without shipping risk.

---

## 2. The three learning loops

### 2.1 Loop 1 — INDIVIDUAL memory (UserContextGraph as live memory)

**Mechanism.** Build the cached `AssistantOmniscienceSnapshot` (mirror the existing `UserFeatureVector` pattern — compute on event-drain, cache, read cheaply) and a read-composition `getUserContextGraph(userId, now)` in `apps/server/src/ai/context/`, exactly as `LIVING_USER_CONTEXT.md §2` specifies: compose `getLivingUserProfile` + `getFoodDnaProjection` + `getSummary` + plan/shopping/pantry + recent `ChatMessage` questions **by reference**. **Zero new ML, zero LLM.**

**Wire it into the two chokepoints that are stubs today:**
1. Replace `BehavioralContextSnapshotService.build`'s near-empty body (`behavioral-context-snapshot.service.ts:35-45`).
2. Make `get-user-food-context.tool.ts:44` read the graph instead of returning `recentSignals: []`.

**"More usage → better" here is MECHANICAL, not statistical.** Every `cook_complete` / swap / scaling / removal / question that lands as a `UserEvent`/`SignalObservation` deepens `getLivingUserProfile`'s observed graph and raises the feature-store **maturity band** (`cold_start → forming → developing → mature`), which unlocks more confident, more specific deterministic answers — at `$0`.

**The maturity band IS the honesty throttle.** No "I know you" phrasing below `developing`. This is what stops the assistant overclaiming at cold-start.

- **Online vs batch:** snapshot refresh = async on event-drain (batch-ish). Read = online, `$0`, cached.
- **Approval:** none required — this loop reads only **declared + observed-with-consent** facts and never widens a safe set (see §4).
- **Pass/fail (from `LIVING_USER_CONTEXT.md`):** assistant answers "what do you know about me?" with **≥12 true specific facts in <300ms at `$0` LLM**, maturity-gated so it never overclaims at cold-start.

#### Loop 1's REAL blocker (not the snapshot): the strongest signals emit ZERO events

**[قطعی]** `usePersonalization.js` holds `{swaps, removed, servedFor}` in `sessionStorage` with **no `trackEvent`**. Until `ingredient_swapped` / `portion_scaled` / `ingredient_removed` / `cook_step_paused` are emitted (`LIVING_USER_CONTEXT §5` P0), Loop 1 is **starved** — it can only weakly infer taste from cooked-recipe ingredients. The snapshot is useless if there is nothing to put in it. **This is Phase 0, and it unblocks Loops 1 and 3 both.**

#### Loop 1's launch-correctness gap: the signal matcher is Persian-only

**[قطعی]** `signal-calculator.service.ts:239` does `if (name.includes('مرغ')) signals.add('likes_chicken')` — it matches the Persian word, **not** "chicken" / "kip". For the **Holland/Europe GENERAL-public launch** (memory: target market = everyone, not diaspora), the individual loop **silently under-learns for every Dutch user**. Fix the matcher in the **same sprint** as swap-capture (Phase 0b) or the launch cohort gets a degraded loop on day one.

### 2.2 Loop 2 — COLLECTIVE taste (activate L1 safely)

The safe activation ladder is already encoded in `L1_PLAN.md` and enforced by the code. **The order is non-negotiable:**

| Step | What | Why it is in this position | Verified |
|---|---|---|---|
| (a) | `requestId` join key on served + reward | **Irreversible.** Without it exposure↔reward is permanently unjoinable. | columns exist `schema.prisma:715/735`; **verify client echo** (§0). |
| (b) | Author the **curated `populationMu` seed** (Europe-gate map + occasion calendar) | so a cold Dutch user gets a sane cohort prior at request #1 with n=0 | `cohort-key.ts` + `recipe-prior.source.ts` exist; seed is **content work**. |
| (c) | Run the **offline-replay harness** on logged `(context, action, propensity, reward)` tuples to **PROVE lift** | this is the **founder-gate** — no non-zero weight before proven lift | learner joins on `requestId` (`recipe-prior-learner.service.ts:9,49`). |
| (d) | Flip `L1_RECIPE_PRIOR_ENABLED` + a small `recipePriorSlateTerm` weight | safe because it is **LIFT-ONLY** (`penMult=0`) | `ranking.service.ts:128` `penMult` default `0.0`; line 145 `lift: bounded, ungated`; the minority-protection invariant "positive personal signal ⇒ score never drops" holds **unconditionally** while penMult=0. |
| (e) | L1.5 epsilon-randomization | makes propensity **HONEST** (unbiased IPS) | until then `recipe-prior-learner.service.ts:15-17`: propensity is a **softmax over a deterministic ranker → biased**. Treat priors as a **tie-breaker, not a re-ranker**. |

**[قطعی] "Aggregate lifts everyone" is real ONLY after step (c) shows positive offline lift. Before that it is theatre and is not investor-defensible.** Gate the founder narrative on the replay result.

**Cold-start seeding is the launch-critical, single most defensible part of this design.** `populationMu` + `deriveCohortKey(country=NL, occasion, diet, skill)` makes the collective loop work at **ZERO user data**: a Dutch person on day 1 gets "this week in NL, cooks reached for X" from a curated/aggregate prior — not a learned model. As real cooks accumulate, the nightly learner's centered IPS-weighted mean (`recipe-prior-learner.service.ts:11`) shifts the cohort/person scopes away from the curated anchor, and read-time **hierarchical shrinkage** (`person → cohort → population`, trust each level only as far as its `n` allows; `n=0 ⇒ exactly the curated prior`) degrades the seed gracefully into learned signal. **Ship the seed even if you never flip the learner** — it is the bridge from cold-start to learned and it delivers value at `$0` with zero risk.

- **Online vs batch:** read-time prior lookup is online + cheap; the learner is **nightly batch**.
- **Approval:** the learner flip (d) is founder-gated behind the replay lift proof (c) + the minority-protection property-test.

### 2.3 Loop 3 — the IMPROVEMENT loop (the part that actually makes it smarter the more it is questioned)

This is what is missing and what closes the system. Two halves: a **substrate** (the join) and a **mining engine** (the proposals).

#### 2.3.1 The substrate — `AiTurnDecision` (this is the `requestId` of Loop 3)

Every turn must persist a **joinable decision row**:

```
AiTurnDecision {
  requestId, conversationId, userId?,
  normalizedText (HASHED / PII-safe — never raw prompt text),
  intent, tier, dataScope, confidence,
  matched: string[],            // the anchors that fired — TODAY THIS IS THROWN AWAY
  answeredBy: 'deterministic' | 'gemini',
  groundingHit, latencyMs, cost,
  createdAt
}
```

**Today the join is impossible** because: `IntentClassification.matched` exists (`intent-classifier.service.ts:50`) but is discarded; `AICallLog` (`schema.prisma:911-940`) stores cost/`guardHits`/`metadata` but **not the intent decision**; `ai_feedback` lands in metadata keyed by `messageId` and **cannot be joined** to which intent decision produced the answer. **Fix:** stamp the intent decision onto the answer record (extend `AICallLog.metadata` or add a new `AiTurnDecision` row) so that **feedback (rating/reasonCode)** + **downstream outcome (did they then cook / swap / abandon)** attaches to the classifier decision. **That join is the training set. Without it, Loop 3 cannot exist.**

> **Pass/fail (Phase 2 keystone):** a thumbs-down on an answer is queryable back to the *exact* intent decision + the anchors that produced it.

#### 2.3.2 The mining engine — nightly, human-approved, never online

**NOTHING auto-mutates a param online.** Nightly batch jobs **mine** the `AiTurnDecision` + `ai_feedback` + outcome join and **PROPOSE diffs** into a review queue:

1. **Cost-driven anchors:** `low_confidence_fallback` / Gemini-handled turns clustered by surface form → candidate new `IntentClassifier` anchors (a recurring misspelling or a Dutch phrasing the lexicon missed) → proposed addition to `RAW_INTENTS` (`intent-classifier.service.ts:91`).
2. **Quality-driven tweaks:** intents with high thumbs-down or low downstream-cook rate → candidate anchor/weight adjustment.
3. **Collective weights:** the `RecipePrior` learner already **IS** the nightly batch for Loop 2.

**The output of every job is a REVIEW-QUEUE DIFF, not a live change.** Founder (or a delegated reviewer) approves. **Approval = a commit to the governed lexicon + the `IntentClassifier` spec test stays green (`intent-classifier.service.spec.ts`) + a shadow-replay shows the change does not regress the existing eval corpus.** This keeps tuning auditable and reversible — investor-grade, not a black box.

#### 2.3.3 Loop 3 IS the cost flywheel (the strongest economic argument)

The **LLM-handles-novel → capture → deterministic-learns-it-back** loop is the only mechanism that defends the **`$1.14`/user-mo ceiling** at scale:

> When `IntentClassifier` returns `low_confidence_fallback` it routes to STRONG (Gemini, paid; `intent-classifier.service.ts:238-240`). **Capture that turn.** Nightly, cluster the paid turns; the recurring ones become new deterministic anchors; **next month the same question is answered for €0.** Every Gemini call is a **one-time tuition fee** that permanently moves that query class into the free tier.

Net effect: **paid-turn share DECAYS toward the genuinely-novel residue** as the corpus of seen questions grows → **marginal cost/user trends DOWN while accuracy trends UP.** This is the literal opposite of competitors who pay an LLM on every turn forever. **Make the paid-turn-decay-rate a tracked KPI — it is the loop's report card.**

#### 2.3.4 The three loops divide labor — do NOT conflate them

| | Store it grows from | What it makes better | Cost | Gate |
|---|---|---|---|---|
| **Loop 1 individual** | the user's OWN signals (`UserContextGraph`) | answers more **PERSONAL** | €0 | maturity band |
| **Loop 2 collective** | the crowd's joined exposure→reward (`RecipePrior`) | **RANKING/suggestions** | €0 read / batch learn | offline-replay lift |
| **Loop 3 improvement** | every captured Q/A/feedback (`AiTurnDecision`) | **UNDERSTANDING + cost** (widens lexicon, recalibrates router threshold) | €0 after fold-back | human-approved diff |

Three different loops on three different stores. The thesis holds: **a non-self-learning deterministic core (cheap, safe, auditable) wrapped by these three loops is the SOTA pattern, and it is more defensible than a pure-LLM assistant because the cost curve bends DOWN with usage instead of up.**

---

## 3. True understanding at low cost — the 4-stage cascade

**[احتمالاً] The thesis matches what real cost-optimized assistants do** (fast deterministic router → confidence-gated escalation; RouteLLM-class systems cut LLM cost ~85% keeping ~95% quality by exactly this "route to weak unless prob>threshold" move). Three honest corrections before building: (1) the embedding belongs **BETWEEN** deterministic and LLM as a **tie-breaker**, not as a replacement for either; (2) the **fold-back loop is the actual moat** and the hardest part — everyone bolts on a cache, almost nobody closes the loop back into the cheap path; (3) **do NOT run the embedding model in the hot path on day one** — gate it behind a flag exactly like L1, ship the cheap typo layer first.

Each stage **terminates the turn** before reaching the next, more expensive one — same philosophy as the existing L0→L4 doc.

### Stage 0 — NORMALIZE (built, €0)
`normalizeText()` (`intent-classifier.service.ts:67-77`) already folds fa `ي/ك/ة`, ZWNJ, Eastern-Arabic + Persian digits, Latin diacritics, apostrophes. **Keep and extend.**

### Stage 1 — DETERMINISTIC CLASSIFY (built, ~0ms, €0)
The current token/anchor scorer + safety-override regexes (`:181-235`). **This is the RouteLLM "weak model" and it MUST stay the default.** Safety overrides run FIRST (`:188-193`), and the classifier fails toward cost/safety on low confidence (`:232`, `:238-240`).

### Stage 2 — TYPO / FUZZY layer (cheap, €0, BUILD FIRST of the new work — highest ROI, lowest risk)
The current classifier does **exact** token-set membership (`tokens.has(a)`, `:198`) so `subsitute` / `glutten` / a misspelled `allergisch` silently miss. Layer three cheap techniques, in order:
- **(a) Edit distance** (Damerau-Levenshtein, capped ≤2, **length-scaled** — distance 1 for short words to avoid false hits) between each non-firing single-word anchor and each input token. A bounded automaton / trie keeps it sub-ms at ~200 anchors.
- **(b) Phonetic for Latin scripts** (Double Metaphone) so `kalorie/calorie/calorieën` and `allergic/alergic` collide by sound — cheap precompute of anchor phonetic codes.
- **(c) Keep fa separate** — edit distance on the **already-normalized** Persian string handles most fa typos; phonetic libs are Latin-centric, do not force them on fa.

**CRITICAL SAFETY RULE:** a fuzzy match on a `safetyRelevant` anchor (allergy/medical) fires the **SAFE** flow with reduced confidence → which the existing rule (`:232`) already escalates to STRONG. **Fuzzy NEVER downgrades a safety turn; it only ever ADDS recall on the safe side.** This alone meaningfully lifts the ≥99% safety-recall gate against real misspellings.

> Pass/fail: ≥99% safety-recall holds on a **misspelled-safety** set; non-safety intent accuracy rises measurably vs the exact-match baseline. No new deps beyond a tiny fuzzy lib (or ~40 hand-rolled lines).

### Stage 3 — SEMANTIC EMBEDDING tie-breaker (local, ~10ms, €0, flag-gated default-OFF)
The "understands ANY phrasing like a real AI" piece, kept €0 and local. Embed the user turn with a **small local multilingual model**, cosine-compare to a **precomputed matrix of intent-prototype vectors** (the anchors + a handful of paraphrase examples per intent), take the nearest intent.
- **Model:** a quantized multilingual MiniLM / `multilingual-e5-small` (or LaBSE-class) via **transformers.js + onnxruntime-node** (this stack is NestJS/TS, **not** Python) — ~23MB q8, ~8-12ms/embed on CPU, **loaded once at boot**. The shared cross-lingual embedding space covers fa+nl+en and is robust to **code-switching** — exactly the "Dutch person with zero Persian, mixed query" case.
- **Where it sits:** invoked **ONLY** when Stage 1+2 return `confidence !== 'high'` **AND** the intent is non-safety (safety is already escalated). It is a **tie-breaker** between "deterministic says maybe" and "pay for Gemini" — **never the primary classifier**.
- **Cost:** `$0` marginal (local CPU); the only cost is ~10ms latency + RAM for the model + prototype matrix — acceptable for the ambiguous minority, **NOT the hot path**.
- **Discipline:** flag-gate default-OFF; prove **byte-identical** routing on the existing `intent-classifier.service.spec.ts` cases before flipping. New service `apps/server/src/ai/intent/semantic-tiebreaker.service.ts`.

> Pass/fail: with the flag OFF, routing is byte-identical to today; with it ON, ambiguous-middle accuracy rises and the Gemini-escalation rate drops on a labeled set. Budget ~10ms + ~23MB RAM.

### Stage 4 — GEMINI last resort (paid, rare)
Only genuinely novel / multi-constraint turns, behind the existing `AiOrchestratorService` cost gates. **Capture its output and FOLD IT BACK** (Loop 3, §2.3.3) so the same query is cheap next time.

### The honest framing for the founder
"Real-AI understanding of any phrasing" = **LLM fallback + a deterministic lexicon that the improvement loop continuously widens.** It **ASYMPTOTES** to broad understanding — it is **not magic on day 1**, and bounded edit-distance covers **typos, not paraphrase/semantics** (that is the embedding's job, and only for the ambiguous middle). Set the investor expectation as a **learning curve (paid-turn share decaying over weeks)**, not a finished capability.

### Semantic cache — the cheapest fold-back, but the #1 silent-wrong-answer risk in a food/allergy domain
Reuse the Stage-3 embedding to key a cache; hit at cosine ≥0.97. **TWO HARD BARS (non-negotiable):** (a) **NEVER serve a hit whose answer/source-set is allergy-relevant**; (b) **NEVER serve a hit containing a computed QUANTITY** (a cached "4-serving" number is wrong for 6 — scaling math must recompute per request). Cache key MUST include `reconciledAllergenSet + diet + locale + dataScopeVersion`; invalidate on allergen-set change; **fail OPEN**; weekly 1–5% false-positive sampling via LLM-judge. **Ship exact-match + dedupe + provider prefix-cache FIRST; defer semantic cache to a later phase — it is upside, not foundation.**

---

## 4. Safety invariants that must survive ALL three loops

These are the founder's non-negotiables, so they must be **machine-enforced**, not left to a reviewer's mood. **Learning may only make non-safety answers cheaper/better; it may NEVER touch a safety gate.**

- **(i) [قطعی]** `IntentClassifier` runs safety overrides (medical→REFUSE, stated_constraint→SPECIAL) **BEFORE** scoring (`:188-193`) and fails toward cost/safety on low confidence (`:232`, `:238-240`). **No learned anchor may reorder this.**
- **(ii) [قطعی]** `getUserContextGraph` composes `getLivingUserProfile` so the **allergy dimension** (precedence `declared_safety`) stays the single source. Learned/observed fields are **enrichment-only** and can **never widen the safe set**.
- **(iii) [قطعی] GDPR landmine:** observed Food-DNA only hydrates when `consent.granted` includes `'personalization'` — **never granted today**. **Do NOT auto-grant to feed the loop** — that is the exact move that breaks the Holland/Europe launch legally. The individual loop runs on **declared + cohort + legitimate-interest analytics** until an explicit consent-grant flow (phase B) ships. Consent is a **hard prerequisite, not a toggle.**
- **(iv)** Fold-back **safety carve-out:** anchors feeding `stated_constraint` / `medical` are **ADD-only and human-approved forever**. An auto-learned or prompt-injected safety anchor is an EU AI Act Art. 14 violation.

These four are encoded as **learning-safety property-tests** in the review gate (§5, Lane A CHECK-8): it must be **impossible** for a learned anchor/weight/prior to (a) downgrade a `safetyRelevant` intent's tier, (b) widen an allergy/medical safe-set, or (c) move a medical query off REFUSE.

---

## 5. The standing integrity-watchdog cadence

**[قطعی] Reality check on what exists:** there are TWO unrelated "guardians" today and they do **not** cover the directive's core ask. (1) `guardian-audit.workflow.js` / `guardian-review.workflow.js` are **LLM-agent swarms** (6 finders → verifier → synth; 2 post-fix reviewers) aimed at drift/requirements/carelessness/safety-vision — expensive, slow, non-deterministic, **not in CI**. (2) `tools/coverage/coverage-check.mjs` **is** a real deterministic wiring gate in CI (`.github/workflows/ci.yml:46`), but **narrow** — it catches Recipe-field render drift, unregistered/unmapped endpoints, orphan endpoints, and orphan events. It does **not** catch broken imports, DI wiring, weakened safety gates, contract drift, or learning-flag invariants.

**The right move is NOT a new cron-LLM watchdog. It is to extend the deterministic coverage layer into a static integrity gate and reserve the LLM swarm for the semantic residue** — deterministic-first, mirroring the locked AI thesis applied to the codebase itself.

### The two-lane model

**A check belongs in Lane A if and only if it can be expressed as "same code in → same verdict out" (no judgement).** Everything a compiler/AST/grep can decide is Lane A and must **NEVER** be paid LLM tokens. The LLM is reached ONLY for judgement.

#### LANE A — STATIC INTEGRITY GATE (deterministic, $0, every push/PR, **blocks CI**)
A single `node tools/integrity/integrity-check.mjs`, sibling to `coverage-check`, reusing its TS-compiler loader + `walk()`:

| Check | What it catches | Severity |
|---|---|---|
| **1 — broken imports / dead refs** | add an explicit `tsc --noEmit` as its OWN named CI step (BEFORE build) so a broken import/symbol fails with an "integrity" label, not buried in build | MUST-FIX |
| **2 — DI wiring (NestJS, highest-value new check)** | AST-scan every `@Injectable`/`@Controller`: a provider injected but not registered (the classic "Nest can't resolve dependencies" that only blows up at boot) + a provider registered but injected nowhere (dead) | MUST-FIX / WATCH |
| **3 — orphaned endpoints** | promote non-internal orphans to a tracked allowlist so a NEW orphan blocks | WATCH→block |
| **4 — event/signal contract** | assert every emitted event exists in the taxonomy AND that P0 must-emit events (swap/scale/remove/assistant-turn) have ≥1 emit site — **directly attacks the "swaps emit ZERO events" gap** | MUST-FIX |
| **5 — safety-gate integrity** | assert `assessRecipeFit`/`analyzeRecipeIntegrity`/`getLivingUserProfile` have exactly ONE definition each (no shadow reimplementation) + every public recipe-serving route is covered by a gate-naming test | MUST-FIX |
| **6 — flag-OFF / byte-identical invariant** | a registry of "protected invariant tests" (file + testName) that integrity-check asserts still exist and are not `.skip`-ed — guards `ranking.recipe-prior.spec.ts`, `ranking.recipe-prior-step5.spec.ts`, cold-start specs from silent deletion | MUST-FIX |
| **7 — protected-param defaults** | assert `L1_RECIPE_PRIOR_ENABLED`=OFF, `L1_PRIOR_STEP5_WEIGHT`=0, `recipePrior` component weight=0 (`ranking.service.ts:112,125,128`), `penMult`=0 — so "learning live before the replay gate" is **structurally impossible** | MUST-FIX |
| **8 — learning-safety property gate** | block any proposed param change that could downgrade a `safetyRelevant` tier, widen an allergy/medical safe-set, or move a medical query off REFUSE (§4) | MUST-FIX |

#### LANE B — SEMANTIC GUARDIAN SWARM (the existing LLM workflows; milestone + on-demand «پایش» only)
Keep `guardian-audit`/`guardian-review` but **re-lens** them so they stop re-finding what Lane A now owns. Sharpen the judgement-only lenses: **semantic contract-drift** (types still compile but a param that was grams is now ml), **now-wrong reference** (a doc/comment/copy asserting behavior the code no longer does), **theater** (built-but-unwired, compiles fine), **forgotten-requirement**. **Delete the deterministic lenses** (orphan endpoints, dead code, broken imports) from the prompts — this cuts Lane B token cost and false-positive rate.

### Cadence (concrete, not "periodically")
- **PER-PUSH / PER-PR (Lane A only, $0, blocking):** `tsc --noEmit` + `coverage:check` + `integrity-check` + `pnpm test`. Catches a cut wire on the **same commit**.
- **PRE-MERGE:** turn the CI job into a **required status check** on master — free branch protection.
- **PER-MILESTONE (Lane B, paid):** run `guardian-audit → guardian-review` after each layer lands (each L1 step, each AI phase).
- **ON-DEMAND «پایش»:** the founder keyword triggers the full Lane B swarm. Keep it.
- **[قطعی] NO wall-clock cron for Lane B.** Justification grounded in the locked `$1.14`/user-mo discipline and the token-budget memory (a workflow misfire already burned **47% of a weekly budget**): a nightly swarm on an unchanged repo pays full price to re-discover nothing, and the args channel is documented-unreliable. **The locked rule: the LLM watchdog runs ONLY on an explicit milestone/«پایش» trigger over a KNOWN-changed diff — never blind, never scheduled.**
- **Optional $0 heartbeat:** a weekly **Lane-A-only** cron (tsc + integrity-check + coverage, **zero LLM**) that opens an issue only on regression — catches drift from dependency / generated-client / Prisma-client changes between feature pushes.

### Reporting contract
Both lanes speak one shape so the founder triages in seconds:
`{ lane: A|B, check, severity: must-fix|watch, file:line, what, evidence, suggestedFix }`. Lane A → `INTEGRITY_REPORT` (CI output). Lane B → `GUARDIAN_LOG.md` (dated, newest-on-top, already exists), now also tagging must-fix vs watch so both lanes merge into one ranked list.

---

## 6. How it all rides on the existing pillars

| Pillar | Today's state | Role in this architecture |
|---|---|---|
| **IntentClassifier** (`ai/intent/intent-classifier.service.ts`) | built, deterministic, `matched[]` discarded | the Stage-1 cost governor + the cheap "weak model"; its lexicon is the **governed param** Loop 3 widens; safety overrides are the invariant Lane A CHECK-8 protects |
| **SubstitutionEngine** | built | part of the deterministic core; substitution turns must stay €0 + allergy-gated |
| **getUserContextGraph** (`LIVING_USER_CONTEXT.md`) | **stubbed** (`behavioral-context-snapshot.service.ts:41`) | Loop 1's live memory; the cached `AssistantOmniscienceSnapshot` is its read surface |
| **signal-capture / event taxonomy** | **swaps emit zero events**; taxonomy gaps (`cook_complete`, `ai_feedback`, `search_unmet` missing from enum — task_2b4b0715) | the fuel for Loops 1 & 3; Lane A CHECK-4 proves the wire exists |
| **feature-store / signal-calculator / UserBehaviorProfile** | built; matcher is **Persian-only** (`signal-calculator.service.ts:239`) | the maturity-band engine; Phase 0b localizes the matcher for the EU launch |
| **L1 RecipePrior + learner** (`recommendation/pipeline/`) | built, **default-OFF**, biased propensity (self-documented `:15-17`) | Loop 2's collective engine; activation is the founder-gated ladder §2.2 |
| **ai_feedback + AICallLog** (`schema.prisma:911`) | written, **not joinable to the intent decision** | Loop 3's raw material; `AiTurnDecision` is the missing join (§2.3.1) |
| **guardian workflows + coverage gate** | LLM swarm not in CI; coverage gate narrow | the two watchdog lanes §5 |

---

## 7. Phased plan with measurable gates

> Principle: **capture first, learn second, activate third.** Every flag default-OFF; every activation behind a measurable gate; **zero safety-gate regressions, ever.**

| Phase | Scope | Pass/fail gate |
|---|---|---|
| **0 — signal capture (unblocks everything; no ML, days)** | emit `ingredient_swapped`/`portion_scaled`/`ingredient_removed` from `usePersonalization.js` via `trackEvent` (keep sessionStorage UX byte-identical); instrument `useCook.js` for `cook_step_paused`/`help_opened`/`abandon`; reconcile EventType taxonomy (task_2b4b0715); **verify the client echoes `requestId` end-to-end** | a swap produces a queryable `UserEvent` within one event-drain; `requestId` round-trips served→reward (irreversible — fix here or lose forever) |
| **0b — launch correctness (same sprint)** | localize `signal-calculator.extractSignalsFromRecipe` so coarse taste signals fire on en/nl ingredient names, not only Persian | cooking a chicken recipe sets `likes_chicken` for an en/nl user |
| **1 — individual loop online ($0)** | build cached `AssistantOmniscienceSnapshot` + `getUserContextGraph`; wire into `BehavioralContextSnapshotService.build` + `get_user_food_context.tool.ts` | "what do you know about me?" → **≥12 true specific facts in <300ms at $0 LLM**, maturity-gated (never overclaims at cold-start) |
| **2 — improvement-loop substrate (KEYSTONE)** | persist `AiTurnDecision` per turn (PII-safe); join `ai_feedback` + downstream outcome | a thumbs-down is queryable back to the exact intent decision + anchors |
| **3 — collective loop (founder-gated, L1 order)** | author curated `populationMu` seed → run offline-replay harness → only then flip `L1_RECIPE_PRIOR_ENABLED` LIFT-ONLY. **Ship the seed regardless.** | offline replay shows **non-negative reward lift** AND the minority-protection property-test passes **before** any flip |
| **4 — improvement loop closes** | nightly jobs MINE the Phase-2 join → emit review-queue diffs (new anchors from clustered paid/low-confidence turns, weight tweaks from low-cook/thumbs-down); track **paid-turn-decay-rate** | a query that cost a Gemini call this week is answered €0 next week after promotion; eval-corpus shadow-replay stays green; nothing mutates online |
| **4b — typo robustness (cheap)** | bounded Damerau-Levenshtein ≤2 + Double-Metaphone fallback in `IntentClassifier` BEFORE Gemini (no embedding here) | ≥99% safety-recall on a misspelled-safety set; paid-turn residue shrinks |
| **5 (flag-OFF) — semantic tie-breaker** | `semantic-tiebreaker.service.ts` (transformers.js + onnxruntime-node, e5-small), invoked only on ambiguous + non-safety | byte-identical when OFF; when ON, ambiguous-middle accuracy ↑ + Gemini-escalation ↓; ≤10ms, ≤23MB |
| **6 (defer, upside) — semantic cache** | reuse Stage-3 embedding, cosine ≥0.97, the two HARD bars, allergen-set in key, fail-open, weekly FP sampling | **0** allergen/quantity cache hits ever; FP <0.5% |
| **CROSS-CUTTING** | extend the guardian into Lane A (CHECK-2/6/7/8 first) + re-lens Lane B; make CI the required check | Lane A blocks on must-fix; safety property-tests block any unsafe param diff |

### The KPIs that make this investor-grade (and honest)
- **% deterministic share** — rising over time (the flywheel working).
- **Intent accuracy** — rising on a labeled golden set.
- **Paid-turn-decay-rate** — the Loop-3 report card; the curve must bend down.
- **`$/user/mo`** — falling, under the `$1.14` ceiling.
- **Safety-gate regressions = ZERO** — a hard gate, not a trend.

**[نامطمئن] Measurement honesty:** there are **ZERO production query logs today**. Every hit-rate/accuracy/cost number above is a **design target, not a measurement** — verifiable only after Phase-0 capture + a golden eval. Investor framing: *"designed so unit cost bends down with usage via a deterministic-first cascade + a capture→fold-back loop; measured by the golden eval and the per-tier event stream"* — never state a hit-rate as achieved fact.

---

## 8. Top risks (carry these into every phase)

1. **[قطعی] `requestId` echo is irreversible.** If the client doesn't echo it, Loop 2 + the outcome half of Loop 3 are permanently unlearnable for that traffic. Verify end-to-end in Phase 0.
2. **[قطعی] Propensity is biased today** (softmax over a deterministic ranker, self-documented). Any "collective lifts everyone" claim before the offline-replay lift proof + L1.5 randomization is **theatre**. Gate the narrative on the replay result.
3. **[قطعی] GDPR:** the observed Food-DNA graph hydrates only on `consent.granted='personalization'`, never granted today. **Do NOT auto-grant.** Consent is a hard prerequisite (phase B), not a toggle.
4. **[احتمالاً] Loop 3 without a strict human-approved review gate is the highest product risk** — an auto-tuned lexicon could silently route a safety query to a cheaper tier. The learning-safety property-tests (§4, Lane A CHECK-8) are the **precondition** for letting learning touch the core at all.
5. **[احتمالاً] Latency/side-effect trap at scale:** `getSummary` WRITES on every read; `getLivingUserProfile` rebuilds per call. Wiring `getUserContextGraph` naively per-turn turns a $0-LLM read into a DB-load problem. **The cached snapshot (refresh-on-drain) is mandatory BEFORE this is fast — not a later optimization.**
6. **[قطعی] Token-budget trap (bit you once at 47%/week):** any LLM watchdog on a timer or the unreliable args channel will misfire on an unchanged repo. LLM watchdog = explicit milestone/«پایش» trigger over a known-changed diff only.
7. **[قطعی] DI static analysis false positives** (dynamic modules, factory/`useClass`, `forwardRef`, global modules). Start CHECK-2 in WARN, build an allowlist, promote to BLOCK only at ~0 FP — a gate people ignore is worse than no gate.
8. **[قطعی] `lint: continue-on-error` (R20)** in CI today. The new `tsc --noEmit` step MUST be **blocking from day one** or the import/DI watchdog is theater.
9. **[حدسی] "Truly understands like a real AI" is the most over-promisable claim.** It asymptotes; it is not day-1 magic. Bounded edit-distance covers typos, not paraphrase. Set expectations as a **learning curve**, not a finished capability.
10. **[نامطمئن] Pre-launch the collective loop trains on ~0 users** — quality is dominated by the curated `populationMu` seed, unverifiable until real traffic. Keep the learner OFF and lean on the seed + shrinkage (`n=0 ⇒ exactly the curated prior`) until traffic makes the offline replay statistically meaningful.

---

## 9. The one-paragraph thesis (for the pitch)

Garnish's AI is a **deterministic, safe, auditable core** that answers most questions for **€0** — wrapped by **three learning loops that change only the DATA the core reads, never its control flow**: individual memory (the growing `UserContextGraph`), collective taste (L1 empirical-Bayes priors with curated cold-start seeding), and an improvement loop where **every paid LLM call is a one-time tuition fee** that folds the novel question back into the free deterministic tier. The result is the opposite of a pure-LLM assistant: **cost per user bends DOWN as usage rises while accuracy bends UP**, every tuning change is human-approved and replay-gated, and a machine-enforced safety invariant guarantees **learning can never weaken a safety gate.** It is not magic on day one — it is a measurable learning curve, and the watchdogs prove the wiring stays intact at every commit.
