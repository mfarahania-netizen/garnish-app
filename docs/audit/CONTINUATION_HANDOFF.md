# 🧭 CONTINUATION HANDOFF — START HERE (every new chat reads this first)

> **Purpose.** This is the single durable entry point so a NEW chat continues the **exact same method, oversight,
> and rigor** with zero loss of context — for the AI work now and for the whole app going forward. It does NOT
> duplicate the specs; it points to them and encodes the *method + standing rules + current state + next step*.
> Code-grounded, no flattery. Keep it current at every milestone. Last refresh: 2026-06-23, working tree after requestId echo propagation (uncommitted unless founder asks).

---

## 0. HOW TO USE THIS (the new-chat boot sequence)
1. Read this file top to bottom.
2. Read `docs/GARNISH_GROUND_TRUTH.md` (authoritative project state) + `docs/audit/AI_MASTER_SPEC.md` (the AI design, **where fragments disagree, it wins**).
3. Read the auto-loaded `MEMORY.md` index (it is already in context every session) — it links the standing facts.
4. Confirm the repo is green before touching anything (see §4 verify command), then pick up §6 (pending) / §7 (next).
5. Work the §1 method **word-for-word**. Do not start a new capability without the **tiered** guardian (Tier 0 deterministic always; the swarm only at milestones — see `docs/audit/GUARDIAN_PROTOCOL.md`, which replaces the expensive per-piece swarm).
6. **Resuming after a Codex/ChatGPT session?** First read `docs/audit/CODEX_WORK_LOG.md`, then run the verification protocol in `docs/audit/CODEX_BRIDGE.md` (§FOR CLAUDE) — must be green + safe before you continue. Baseline for that diff = `6b584134`.

---

## 1. THE METHOD — non-negotiable (this is the "how", and it does not change)
1. **Advisor mode, not order-taker.** Follow the global working agreement (`~/.claude/CLAUDE.md`) word-for-word: anti-sycophancy, confidence tags `[قطعی]/[احتمالاً]/[حدسی]/[نامطمئن]`, disagree-when-wrong, Reality Check on big calls, end important answers with «نتیجهٔ عملی». Investor-grade rigor on every code/product/AI decision. Bring the 90% — name gaps proactively, don't just execute.
2. **Small, complete, guardian-verified increments.** No piece advances while it has a known problem. No half-wiring. The repo is **always green + shippable**. One piece = built + wired + tested + guardian-converged.
3. **The guardian loop is mandatory on every piece.** Multi-agent adversarial cycle: **find → independently verify → I-fix → 2+ reviewers re-verify → loop until it converges** (confirmed-finding counts must *shrink*, e.g. 16→7→1→clean). Diversify reviewer **lenses** (correctness / safety-invariant / spec-conformance / actually-runs), not just count — identical reviewers share blind spots. Run it per piece AND as a whole-system drift sweep at every milestone and on demand («پایش»). Tooling: `guardian-audit.workflow.js` + `guardian-review.workflow.js`.
4. **Deterministic-first, LLM-as-last-resort.** The database answers ~85–90% of turns at €0. The LLM **narrates** a deterministic answer; it is NEVER the source of a fact, a quantity, or a safety decision.
5. **Build-then-activate.** Every risky capability ships **default-OFF / byte-identical** until a MEASURED gate passes. Never bet the product on an untested flip. (The proven L1 discipline.)
6. **The HARD allergy/safety gate lives OUTSIDE the LLM, fail-closed (pre + post).** Learning may only change DATA the core READS — it may NEVER weaken the gate or the request-time control flow. This invariant outranks every feature.
7. **Honest reality-checks.** Name what is hard, what is a TARGET vs a MEASUREMENT, and what needs outside hands (Dutch IP/privacy lawyer; native fa/nl reviewers; optional data-engineer for the 1,008-recipe i18n). Never show the state better than it is.

## 1b. MODEL-ALLOCATION STRATEGY (token-constrained windows — added 2026-06-22)
When Opus budget is scarce (e.g. weekly cap near reset), **match the work to the model — do not stop:**
- **Opus → the irreversible/architectural thinking.** Design/premise-level decisions, P1 architecture specs, safety-invariant design. Design is token-cheap, reasoning-heavy → best ROI. Spend the last Opus drops here, not on mechanical edits.
- **Sonnet → execution of well-specified, test-covered, verifiable work** (the spawned mechanical chips, hardening, tests, docs, the USDA data-quality scale). Sonnet ≈ Opus here, and the guardian loop guards quality. When running Sonnet, raise verify votes (3→5) with **diverse** lenses.
- **Do NOT originate net-new architecture with Sonnet** — re-auditing 2 days of Sonnet-built architecture with Opus costs nearly as much as building it, and risks correlated blind spots. Defer P1 origination to Opus.
- After a reset: Opus audits **premises**, not line-by-line (tests + guardian already cover lines).

## 1c. DIMENSION CLOSURE RULE — mandatory at the end of every AI/spec dimension
At the end of each dimension/piece, report and record:
1. What the dimension must do for the product.
2. Exact pass/fail gates from `AI_MASTER_SPEC.md`.
3. Files/runtime path changed.
4. Unit + integration/acceptance tests run.
5. Whether it is 100% closed.
6. If not 100%, exact remaining gaps and next smallest step.

Never mark a dimension 100% because general tests passed. Mark 100% only when the dimension-specific unit + integration/capstone gates pass and no external gate (VPN/legal/native-review/etc.) remains.
---

## 2. STANDING CONSTRAINTS — verbatim, do not violate
- **VPN for live Gemini.** Live Gemini requires the founder's VPN. **STOP and ask the founder to enable VPN before ANY live-Gemini test step.** Never silently attempt a live call.
- **`PRODUCTION_RATE_CATALOG` stays EMPTY** until VPN-verified real rates are promoted. `REFERENCE_RATES_2026` is staged + `isActive:false`. No invented prices → runtime cost stays `null` (honest).
- **§3 confirm-then-write: NEVER auto-write an allergy.** Only a user-tapped `POST /users/allergies` writes to the safe set. Chat may *offer*; only the tap commits. Writes pass the `CANONICAL_ALLERGEN_TOKENS` allowlist on BOTH `addAllergies` and `updatePreferences`.
- **`apps/server/.env` is gitignored** (Gemini key is local-only, never in the repo).
- **Commit AND push as SEPARATE Bash/PowerShell calls; work directly on `master`.** End commit messages with the Co-Authored-By trailer. Commit/push only when the founder asks.
- **No food images** — the founder handles all imagery.
- **Every public recipe read filters `PUBLISHED_RECIPE_WHERE`** (status active + isPublic); UGC is created pending and must never reach a public/anonymous surface (`recipe-visibility.ts` is the source of truth).
- **Target market = Europe/Holland GENERAL public** (a Dutch person with zero Persian background must succeed) — weigh this on every decision; diaspora is a subset, not the target.

---

## 3. WHAT THE PRODUCT IS (one paragraph)
Garnish = a premium ($7-that-feels-like-$20) Persian-cuisine-**FOR-EVERYONE** cooking PWA for EU/Holland general-public launch (Iran sandbox first). The defensible moat is the **taste graph** (ingredient-level food intelligence × per-user learned taste × GRIS food-science) + the **cost flywheel** (every paid LLM call is one-time tuition folded back into the free deterministic tier). The single most defensible architectural choice: the LLM narrates the deterministic answer; it is never the source of a fact, quantity, or safety decision — simultaneously the cost moat, the no-hallucination moat, and the EU-compliant-by-construction moat.

---

## 4. CURRENT STATE (verify before trusting — re-stamp at each milestone)
- Branch `master`; current working tree includes requestId echo propagation. **Verified 2026-06-23: server 246 suites / 2009 tests green; web 36 files / 169 tests green; web build green.** Honest caveat: `apps/web` has no `tsconfig*.json` / local `typescript`, so the documented `npx tsc --noEmit` web gate is currently not runnable and must not be claimed green.
- **P0 AI build: complete + guardian-converged.** Shipped & verified: EU-14 allergen engine + canonicalization; IntentClassifier (the €0 cost+safety router) wired on every chat turn (dark/log-only); §3 conversational-allergy (declare → confirm → one-tap write → hard gate); multi-window cost budget (5h/daily/weekly/monthly + 15s cooldown, **inert** until live Gemini); SubstitutionEngine; signal capture; the cross-dimension acceptance capstone (`apps/server/src/ai/eval/cross-dimension.acceptance.spec.ts`).
- **CRITICAL bug the guardian caught & closed:** the hard allergy gate was silently **failing open on the entire live recipe corpus** — recipes author allergens in Persian (آجیل/گلوتن/لبنیات/…), the canonicalizer was English-only → a nut-allergic user was served nut dishes. Fixed (Persian+Dutch canonicalization in `recipe-integrity.ts`) and locked with a regression test that reads the real shipped corpus.
- **Verify command (run first in a new chat):** from `apps/server` → `npm test`; from `apps/web` → `npm test` + `npm run build`. Do **not** claim web `tsc --noEmit` until `apps/web` has a real `tsconfig*.json` + local `typescript` dependency.

---

## 4b. EXACT PHASE POSITION — we are at the TAIL of P0 (be precise; this is the "where exactly")
P0 = "Observability + Cost Honesty + Safety-Wiring." Status, item by item (per `AI_MASTER_SPEC.md` §roadmap):
- ✅ **DONE + guardian-converged** (the live safety/correctness/compliance bugs P0 existed to fix): IntentClassifier wired dark per turn; §3 conversational-allergy confirm-then-write; granular Art.9 consent split + withdrawal cascade; rich `substitutionOptions` consumed (off `toStringArray`); EU-14 engine; the **CRITICAL Persian hard-gate fail-open closed**; signal capture (swap/scale/remove → `UserEvent`).
- ⛔ **BLOCKED-on-VPN:** populate `PRODUCTION_RATE_CATALOG` with verified, dated Gemini rates → `estimatedCostUsd` non-null. Cannot be done honestly until the founder enables VPN and live rates are confirmed. The P0 gate "estimatedCostUsd non-null + counters correct under 2 instances" stays **RED** until then.
- 🔧 **REMAINS / UPDATED:** multi-window cost/quota still needs **Redis-atomic**; `requestId` echo propagation is now built + unit/full-suite verified, but **NOT 100% dimension-closed** until an end-to-end capstone proves `trackImpression -> UserEvent payload -> EventOutbox/process -> RecommendationAttributionEvent.requestId` and learner join behavior; confirm `EventOutbox` producers are flipped from `not_started` and turn events emit tier-tagged.
- ❌ **P1 NOT STARTED:** multi-turn memory, fa/nl/en `TemplateRegistry`, hybrid+alias retrieval, conversational repair, cross-surface thread, runtime groundedness validator.

**The immediate next work is now:** finish the `requestId` dimension closure with an end-to-end/capstone integration test. After that, continue the non-blocked P0 tail: EventOutbox producer flip/tier-tagged assistant turns, then Redis cost atomicity. The rate-catalog P0 item is parked until VPN. **Do not let §6/§7 read as "P0 is fully done" — it is not; this §4b is the precise position.**

---

## 4c. PARALLEL TRACKS (non-AI) — recommendation engine + onboarding (a new chat must see these too)
These run alongside the AI work; the AI phase position (§4b) is NOT the whole app.

**Recommendation engine (L1 ranker) — BUILT, default-OFF, ~0% learning; the flip is P4, founder-gated.**
- Live scorer = `RankingService` (10-component weighted sum). L1 learning steps 1–5 are wired into the LIVE ranker but all **byte-identical**: the `WeightSource`/`PriorResolver` seam (only `StaticWeightSource` registered); `RecipePriorService` (empirical-Bayes shrinkage) + `RecipePrior` table + `RecipePriorLearnerService` (IPS + weighted-Welford) at **component weight 0**; collective-degradation + minority-protection `recipePriorSlateTerm` **LIFT-ONLY** (penMult=0, activated only by `L1_PRIOR_STEP5_WEIGHT>0`). Property-test invariant: a positive personal signal can never LOWER a score. So today it serves byte-identical to before.
- **Turning it on (APPROVED-but-PAUSED) needs:** the `requestId` served↔reward join (the SAME P0 §4b item — without it 116 served / 706 attribution rows are unjoinable forever), then an offline-replay harness + curated `populationMu` authoring + an L1.5 bandit for honest propensity. The flip is gated on a **MEASURED reward lift, not a date** → it lives in **P4 (Learning activation)**, not now.
- ✅ **SAFETY closed:** the guardian found + fixed a hard-allergy-gate **bypass on the live recommendation feed** (a returning user could be served allergen recipes) — now `RecipeSafetyFilterService` on ALL serving paths, fail-closed. The feed is SAFE; only the learning is off. Home: `L1_PLAN.md` + `L1_STEP4/5_*_SPEC.md`.

**Onboarding v1 — design SETTLED + live-verified; backend spine DONE; FE rides the redesign track.**
- Spec `ONBOARDING_V1_SPEC.md`: v1 = **ONE up-front question** (allergy safety, full EU-14 chips + a visually-primary one-tap "None"); diet/effort optional/post-slate; account = a **silent device-keyed GUEST spine**; **NO swipe deck** in v1 (the in-session re-ranker doesn't exist yet). The 4 founder-delegated decisions are **MADE** (full EU-14, opt-in/un-bundled consent, IP-geo familiarity cohort, additive allergy-preserving guest→registered merge).
- **BUILD:** piece 1 (guest spine) **DONE + guardian-converged — backend-only**; the onboarding allergen chips were expanded 8→13 this session. The rest of the onboarding FE (the S0→S4 screens) lands with the **FE reset / redesign** track (`garnish-fe-reset`: old UI wiped, rebuilt screen-by-screen, all 14 screens + a web smoke-test net merged).
- **REMAINS:** the effort lever wire (cooking_time persistence + the ranking effort term + graded effortFit), un-bundled personalization consent asked at a high-engagement moment, diet/no-pork behind a pork-coverage audit, and FE wiring of the safe-slate S0→S4 flow. A Dutch IP/privacy lawyer signs off wording/scope before public EU launch (NOT a build blocker — the safe default ships).

## 4d. LATEST DIMENSION CLOSURE SNAPSHOT — requestId echo (2026-06-23)
**Dimension(s):** Learning & Adaptation + Observability/Cost/Ops substrate.

**What this dimension must do:** every served recommendation slate must be joinable to later reward/action events by `requestId`, so L1/P4 learning can connect exposure -> reward at recipe/position/propensity grain. This is irreversible: missed requestIds cannot be recovered later.

**What is built now:** `RecommendationPipelineService` already generated a slate `requestId`; Home now preserves it; `useImpressionObserver` echoes it to `POST /recommendations/impression`; `RecommendationController.trackImpression` passes it into analytics payload; existing `RecommendationSignalProcessor` reads `payload.requestId` and writes `RecommendationAttributionEvent.requestId`.

**Verification run:** targeted server test green; targeted web hook test green; full server `246 suites / 2009 tests`; full web `36 files / 169 tests`; web production build green; `git diff --check` clean.

**Is it 100% closed?** No. Current confidence: ~75-80%. The propagation path is covered, but the dimension is not complete until a capstone/integration test proves `POST /recommendations/impression -> UserEvent payload -> EventOutbox/processNow/drain -> RecommendationAttributionEvent.requestId`, plus learner join behavior.

**Next smallest step:** add the end-to-end requestId attribution capstone before moving to EventOutbox producer flip.
---

## 5. SOURCE-OF-TRUTH DOCS (reading order)
1. `docs/GARNISH_GROUND_TRUTH.md` — authoritative whole-project state.
2. `docs/audit/AI_MASTER_SPEC.md` — the unified AI design (P0→P6 roadmap with pass/fail gates; **wins on disagreement**).
3. `docs/audit/BUILD_EVIDENCE.md` — the receipts (what was built + which real bugs the guardian caught).
4. `docs/audit/GUARDIAN_LOG.md` — oversight history (newest on top). `docs/audit/EXECUTION_LEDGER.md` — what shipped.
5. `docs/audit/IDEAS_AND_GAPS.md` — the living gap/maturity ledger (every research workflow feeds it).
6. Area specs: `L1_PLAN.md` (+ `L1_STEP4/5_*`), `ONBOARDING_V1_SPEC.md`, `PERSONALIZATION_{AUDIT,STANDARD,ROADMAP}.md`.
7. `MEMORY.md` (auto-loaded) — the standing-facts index.

---

## 6. PENDING (spawned chips — Sonnet-safe, mechanical, guardian-protected)
- `task_3197270f` — Dutch `-en` plural miss in allergen extractor (walnoten fixed; other `-en` plurals may remain).
- `task_57df11b6` — negation-scope the allergen extractor (it still extracts from negated clauses, e.g. «ولی پسته نداره»; low severity — behind confirm-then-write).
- `task_f2b597b4` — remove the dead second AI cost engine (`estimateCostUsd`/`modelRatesUsdPer1k` in policy).
- `task_d52d000f` — live-output allergy gate for Persian (`screenLiveOutput` matches English chip tokens against Persian model output → rarely fires; **inert** until live Gemini).
- Capstone needs one final post-clean guardian confirmation (the last re-verify returned `clean:true` but verify agents were rate-limited mid-run).

---

## 7. NEXT — P1 (Opus-gated; from AI_MASTER_SPEC §D "Must-build")
Do NOT originate these with Sonnet. Lock the design with Opus first, then execute.
- **Multi-turn memory:** wire 8 verbatim turns via `ChatMessageService.findMany` + a ~300-token rolling summary into `chat-orchestration` (summary EARLY in the cacheable prefix, user turn LAST, **summary UNTRUSTED for safety**). Pass: "for 6 people" resolves against the prior turn AND the cache prefix stays intact.
- **fa/nl/en TemplateRegistry** — Dutch is REQUIRED (today there is zero Dutch in any deterministic answer string; only the lexicon has Dutch).
- **Conversational repair** — ask ONE clarifying question instead of guess-or-refuse (the missing productive middle of the abstention ladder).
- Then per the P1→P6 roadmap in AI_MASTER_SPEC (retrieval upgrade above the BM25 floor; `AiTurnDecision` substrate for Loop-3; etc.).

---

## 8. THE BAR (founder's standard — never soften)
True premium ($7 that feels like $20). Swiss-watch / Porsche engineering — **learning, not rules**. Investor-magnet on our terms. Ruthless, no flattery. Partner empowered to rebuild. Autonomous execution through the locked plan; stop only for important milestones/decisions, never routine per-step approval.
