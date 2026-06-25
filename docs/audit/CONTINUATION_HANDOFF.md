# 🧭 CONTINUATION HANDOFF — START HERE (every new chat reads this first)

> **Purpose.** This is the single durable entry point so a NEW chat continues the **exact same method, oversight,
> and rigor** with zero loss of context — for the AI work now and for the whole app going forward. It does NOT
> duplicate the specs; it points to them and encodes the *method + standing rules + current state + next step*.
> Code-grounded, no flattery. Keep it current at every milestone. Last refresh: 2026-06-24, after onboarding/auth dev-loop CORS fix.

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
3. **Guardian = tiered, swarm OFF by default (founder policy 2026-06-24).** Per piece: **Tier 0** deterministic tests/build + **Tier 1** (Claude reads the diff itself, **no agents**). The multi-agent swarm runs **ONLY at the END of a full dimension** (all its phases done): a complete **≤5-agent + Claude** audit, find-cheap/verify-strong, **one pass** — never per-piece, never loop-to-zero. Full policy: `docs/audit/GUARDIAN_PROTOCOL.md`. (Reviewer lenses still diversify: correctness / safety-invariant / spec-conformance / actually-runs.)
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
- **`PRODUCTION_RATE_CATALOG` contains only verified production truth.** As of 2026-06-24 it has one active source-attributed row for `gemini-3.1-flash-lite`; never add unverified or guessed prices. `REFERENCE_RATES_2026` remains staged/inactive.
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
- Branch `master`; P0 is committed in the current Codex line through `227db7e7` plus docs commit to follow. **Verified 2026-06-24: live Gemini smoke executed with `gemini-3.1-flash-lite` and wrote 3 non-null `estimatedCostUsd` rows; server 248 suites / 2018 tests green; server `npx tsc --noEmit` green; web 36 files / 169 tests green; web build green.** Honest caveat: `apps/web` has no `tsconfig*.json` / local `typescript`, so the documented `npx tsc --noEmit` web gate is currently not runnable and must not be claimed green.
- **CLAUDE VERIFICATION 2026-06-25 (Codex handoff from baseline `6b584134`):** Tier 0 re-run green on this machine — server `249 suites / 2026 tests`, server `tsc --noEmit` clean, web `36 files / 169 tests`, web build clean. Tier 1 diff read clean: CORS fix has NO wildcard (same-port loopback peer only); the four named safety-critical files (`allergen-extractor`, `recipe-integrity`, `recipe-visibility`, `users.service`) are UNCHANGED from baseline; the short-term-memory wiring keeps the safety boundary (intent classify + `isAllergyDeclaration` + `extractStatedAllergens` all read only `input.prompt`, never `memoryPrompt`); `recommendation.controller.ts` only adds `requestId` to the analytics payload — `RecipeSafetyFilterService` order is untouched; `.env` is gitignored + untracked. CORS fix committed + pushed as `1685480a`. **OPEN CAVEAT (not a blocker, flagged to founder):** the promoted production rate for `gemini-3.1-flash-lite` ($0.25/1M in, $1.50/1M out) is byte-identical to the earlier *unverified* 2.5-flash-lite guess; the live smoke proves a call happened + cost rows are non-null, but it computes cost FROM the catalog, so it does NOT independently validate the price. Re-confirm the number against the live Google pricing page (VPN) before any external cost figure is trusted.

---

## 4b. EXACT PHASE POSITION - P0 is CLOSED; P1 is NEXT
P0 = "Observability + Cost Honesty + Safety-Wiring." Status, item by item (per `AI_MASTER_SPEC.md` roadmap):
- ? **DONE + guardian/test-covered:** IntentClassifier dark/logged per turn; �3 conversational-allergy confirm-then-write; granular Art.9 consent split + withdrawal cascade; rich `substitutionOptions` consumed; EU-14 engine; Persian hard-gate fail-open closed; signal capture; requestId served-to-reward echo; assistant-turn EventOutbox/tier tagging; AICallLog `intent/tier/cacheHit/cacheTokens`; P0 producer inventory truth for assistant-turn + swap/scale/remove; Redis-atomic multi-window quota.
- **DONE after VPN/live verification:** `PRODUCTION_RATE_CATALOG` has active, source-attributed `gemini-3.1-flash-lite` rates verified 2026-06-24 from the official Google AI pricing page (`https://ai.google.dev/gemini-api/docs/pricing`). Default live model now matches that exact row. Live smoke proved 3 live provider calls, 0 blocked-provider calls, 6 AICallLog writes, and 3 non-null `estimatedCostUsd` rows.
- **P1 STARTED:** multi-turn memory slice is DONE + test-covered. Remaining P1/D1 gaps: fa/nl/en `TemplateRegistry` (Dutch required), hybrid+alias retrieval, conversational repair, cross-surface thread, runtime groundedness validator.

**The immediate next work is now:** Claude verifies Codex from baseline `6b584134` using `CODEX_BRIDGE.md`; if green/safe, continue P1 after the now-closed multi-turn memory slice. Do not let §6/§7 read as P0 still blocked - it is closed as of this handoff.

---

## 4c. PARALLEL TRACKS (non-AI) — recommendation engine + onboarding (a new chat must see these too)
These run alongside the AI work; the AI phase position (§4b) is NOT the whole app.

**Recommendation engine (L1 ranker) — BUILT, default-OFF, ~0% learning; the flip is P4, founder-gated.**
- Live scorer = `RankingService` (10-component weighted sum). L1 learning steps 1–5 are wired into the LIVE ranker but all **byte-identical**: the `WeightSource`/`PriorResolver` seam (only `StaticWeightSource` registered); `RecipePriorService` (empirical-Bayes shrinkage) + `RecipePrior` table + `RecipePriorLearnerService` (IPS + weighted-Welford) at **component weight 0**; collective-degradation + minority-protection `recipePriorSlateTerm` **LIFT-ONLY** (penMult=0, activated only by `L1_PRIOR_STEP5_WEIGHT>0`). Property-test invariant: a positive personal signal can never LOWER a score. So today it serves byte-identical to before.
- **Turning it on (APPROVED-but-PAUSED) needs:** the now-closed `requestId` served-to-reward join (the SAME P0 section 4b item), then an offline-replay harness + curated `populationMu` authoring + an L1.5 bandit for honest propensity. The flip is gated on a **MEASURED reward lift, not a date**; it lives in **P4 (Learning activation)**, not now.
- ✅ **SAFETY closed:** the guardian found + fixed a hard-allergy-gate **bypass on the live recommendation feed** (a returning user could be served allergen recipes) — now `RecipeSafetyFilterService` on ALL serving paths, fail-closed. The feed is SAFE; only the learning is off. Home: `L1_PLAN.md` + `L1_STEP4/5_*_SPEC.md`.

**Onboarding v1 — design SETTLED + live-verified; backend spine DONE; FE rides the redesign track.**
- Spec `ONBOARDING_V1_SPEC.md`: v1 = **ONE up-front question** (allergy safety, full EU-14 chips + a visually-primary one-tap "None"); diet/effort optional/post-slate; account = a **silent device-keyed GUEST spine**; **NO swipe deck** in v1 (the in-session re-ranker doesn't exist yet). The 4 founder-delegated decisions are **MADE** (full EU-14, opt-in/un-bundled consent, IP-geo familiarity cohort, additive allergy-preserving guest→registered merge).
- **BUILD:** piece 1 (guest spine) **DONE + guardian-converged — backend-only**; the onboarding allergen chips were expanded 8→13 this session. The rest of the onboarding FE (the S0→S4 screens) lands with the **FE reset / redesign** track (`garnish-fe-reset`: old UI wiped, rebuilt screen-by-screen, all 14 screens + a web smoke-test net merged).
- **REMAINS:** the effort lever wire (cooking_time persistence + the ranking effort term + graded effortFit), un-bundled personalization consent asked at a high-engagement moment, diet/no-pork behind a pork-coverage audit, and FE wiring of the safe-slate S0→S4 flow. A Dutch IP/privacy lawyer signs off wording/scope before public EU launch (NOT a build blocker — the safe default ships).

## 4d. LATEST DIMENSION CLOSURE SNAPSHOT - requestId echo (2026-06-24)
**Dimension(s):** Learning & Adaptation + Observability/Cost/Ops substrate.

**What this dimension must do:** every served recommendation slate must be joinable to later reward/action events by `requestId`, so L1/P4 learning can connect exposure -> reward at recipe/position/propensity grain. This is irreversible: missed requestIds cannot be recovered later.

**What is built now:** `RecommendationPipelineService` generates a slate `requestId`; Home preserves it; `useImpressionObserver` echoes it to `POST /recommendations/impression`; `RecommendationController.trackImpression` passes it into analytics payload; `RecommendationSignalProcessor` reads `payload.requestId` and writes `RecommendationAttributionEvent.requestId`; capstone proves learner join behavior.

**Verification run:** requestId capstone `apps/server/src/recommendation/recommendation-requestid-capstone.spec.ts` green; targeted server controller test green; targeted web hook test green; full server `247 suites / 2010 tests`; full web `36 files / 169 tests`; web production build green; `git diff --check` clean when last checked.

**Is it 100% closed?** Yes for requestId echo. The capstone proves `POST /recommendations/impression -> UserEvent payload -> EventOutbox/processNow -> RecommendationAttributionEvent.requestId`, then proves `RecipePriorLearnerService` reads attribution by served `requestId` and writes joined prior rows.

**Next smallest step:** see §4g for whole-P0 closure; after Claude verification, proceed to P1 multi-turn memory.
---


## 4e. LATEST DIMENSION CLOSURE SNAPSHOT - assistant-turn EventOutbox/tier tagging (2026-06-24)
**Dimension(s):** Observability/Cost/Ops substrate + Safety-Wiring chat paths.

**What this dimension must do:** every assistant reply must create a queryable, tier-tagged `UserEvent` through the existing analytics/EventOutbox path so cost, safety refusals, cache/tier mix, and product quality can be measured without copying raw chat text.

**What is built now:** `ChatOrchestrationService.handleChat` records `ai_suggestion_generated` for normal replies, blocked-injection replies, blocked-safety replies, orchestration-error replies, and §3 conversational-allergy confirm-then-write offers. Payload includes references and metadata only: `conversationId`, `messageId`, `aiCallLogId`, `status`, `providerMode`, `model`, `blocked`, `intent`, `tier`, `dataScope`, `safetyRelevant`, `confidence`, `suggestedActionType`. `ai_suggestion_generated` is deliberate in `EventQualityService`, so burst/noise heuristics do not drop it. `EVENT_PRODUCER_INVENTORY` now includes `prod-ai-assistant-turn-event` as `canonical_emitting`.

**Verification run:** targeted assistant/event-quality/inventory tests green (60 tests after inventory update); full server `247 suites / 2011 tests`; server `npx tsc --noEmit`; web `36 files / 169 tests`; web production build green; code `git diff --check` clean.

**Is it 100% closed?** Yes for assistant-turn EventOutbox/tier tagging. Whole P0 was closed later by the verified rate-catalog/live-smoke slice in §4g.

**Next smallest step:** see §4g for whole-P0 closure; after Claude verification, proceed to P1 multi-turn memory.
---

## 4f. LATEST DIMENSION CLOSURE SNAPSHOT - non-VPN P0 observability/quota (2026-06-24)
**Dimension(s):** Observability/Cost/Ops substrate + Cost Honesty + Safety-Wiring.

**What this dimension must do:** P0 must make AI/product signals queryable end-to-end, make model-call ledger rows attributable by intent/tier/cache state, and prevent live paid-call abuse under multiple app instances. The LLM still cannot be the source of a fact, quantity, safety decision, or price.

**What is built now:**
- `AICallLog` has `intent`, `tier`, `cacheHit`, `cacheTokens` plus indexes and safe export coverage. `ChatOrchestrationService` forwards intent/tier/cache metadata into `AiOrchestratorService`, which writes it through `AiCallLogService`.
- `EVENT_PRODUCER_INVENTORY` marks `prod-ai-assistant-turn-event` and `prod-web-personalization-events` as `canonical_emitting`; swap/scale/remove are represented as `ingredient_swapped | portion_scaled | ingredient_removed` through web analytics -> `AnalyticsService.trackEvent` -> EventOutbox.
- `GarnishRateLimitService` uses Redis Lua with Redis server time for atomic cooldown + multi-window token reservation. `AiOrchestratorService` prefers Redis when wired and fails closed if Redis quota is unavailable; DB aggregate fallback remains only for non-Redis wiring/tests.
- The pilot-readiness spend-alert failure-injection mock is clock-stable: start-of-UTC-day aggregate no longer aliases the rolling 5h window during early UTC hours.

**Verification run:** focused AICallLog/orchestrator/chat ledger tests green; focused inventory/event-quality tests green; focused Redis quota tests green; pilot-readiness gate green; final full server `248 suites / 2017 tests`; server `npx tsc --noEmit`; web `36 files / 169 tests`; web production build green; `git diff --check` clean except CRLF warnings.

**Is it 100% closed?** Yes for the non-VPN P0 observability/quota dimension. Whole P0 was closed later by the verified rate-catalog/live-smoke slice in §4g.

**Next smallest step:** see §4g for the rate-catalog/live-smoke closure; after Claude verification, proceed to P1 multi-turn memory.
---
## 4i. LATEST APP-BLOCKING BUGFIX SNAPSHOT - onboarding/auth dev-loop CORS (2026-06-24)
**Area:** Web onboarding/auth + server CORS.

**What this fix must do:** the app must allow login/register from the dev URL Vite actually shows (`http://127.0.0.1:5173`) as well as `http://localhost:5173`, without broadening CORS to a wildcard.

**What was broken:** server `.env` had `FRONTEND_URL=http://localhost:5173`; when the web app was opened at `http://127.0.0.1:5173`, auth responses lacked `Access-Control-Allow-Origin`, so the browser blocked register/login and the user stayed in onboarding.

**What is built now:** `resolveCorsOrigins` keeps the configured comma-separated origins and adds only same-port loopback peers between `localhost` and `127.0.0.1`. `main.ts` uses this helper for Nest CORS.

**Verification run:** focused `cors-origins.spec.ts` green; live local HTTP proof from `Origin: http://127.0.0.1:5173` shows register=201, login=201, `/users/me`=200, and all return `Access-Control-Allow-Origin: http://127.0.0.1:5173`; final full server `249 suites / 2026 tests`; server `npx tsc --noEmit`; web `36 files / 169 tests`; web production build green.

**Is it 100% closed?** Yes for the dev-origin onboarding/auth loop. If a user still loops after this, the next diagnosis should inspect the visible browser console/network error and token clearing path, not CORS.

**Next smallest step:** continue P1 Dimension 1 (`TemplateRegistry` Dutch or conversational repair) after Claude verification; do not reopen P0.
---
## 4h. LATEST DIMENSION CLOSURE SNAPSHOT - P1 multi-turn memory slice (2026-06-24)
**Dimension(s):** Dimension 1 - Capability & Conversational UX.

**What this slice must do:** chat must read short-term episodic context so a follow-up like "for 6 people" carries the prior turn into grounding, while the current user turn remains last and memory remains untrusted for safety.

**What is built now:** `ChatMessageService.listRecentForMemory(userId, conversationId, limit=8)` reads only user/assistant turns for the same user and conversation, newest-limited then oldest-first. `ChatOrchestrationService` builds a deterministic memory context with an untrusted short summary, recent verbatim turns, and `CURRENT USER TURN` last. Grounding and live prompt construction receive that memory context; no raw prompt text is copied into analytics payloads.

**Safety boundary:** memory is context only. `IntentClassifierService.classify`, §3 allergy declaration detection, `extractStatedAllergens`, and confirm-then-write still read only `input.prompt`. A prior memory line such as "I am allergic to walnuts" cannot trigger `suggestedAction` or write an allergy. If memory read fails, chat falls back to the raw current prompt.

**Verification run:** focused `chat-message.service.spec.ts` + `chat-orchestration.service.spec.ts` green (32 tests); focused grounding/capstone set green (`chat-message`, `chat-orchestration`, `grounded-reply`, `cross-dimension.acceptance`: 57 tests); final full server `248 suites / 2022 tests`; server `npx tsc --noEmit`; web `36 files / 169 tests`; web production build green; `git diff --check` clean except CRLF warnings.

**Is it 100% closed?** Yes for the multi-turn memory slice. No for Dimension 1 overall: TemplateRegistry fa/nl/en, conversational repair, cross-surface context, retrieval upgrade, and runtime groundedness validator remain.

**Next smallest step:** P1 fa/nl/en `TemplateRegistry` with Dutch required, or conversational repair if product flow needs the ask-one-question middle path first.
---
## 4g. LATEST DIMENSION CLOSURE SNAPSHOT - verified rate catalog / whole-P0 closure (2026-06-24)
**Dimension(s):** Cost Honesty + Observability/Cost/Ops substrate.

**What this dimension must do:** live model calls must have a source-verified exact-model rate so `estimatedCostUsd` becomes non-null on ledger rows; cost dashboards must distinguish "rates missing" from "rates exist but no usage yet"; daily estimated-cost alert input must be a real ledger aggregate, not a per-call fake.

**What is built now:**
- Default live model is `gemini-3.1-flash-lite`.
- `PRODUCTION_RATE_CATALOG` contains one active source-attributed row for `provider='gemini'`, `model='gemini-3.1-flash-lite'`, USD `$0.25/1M input` and `$1.50/1M output`, verified 2026-06-24 from `https://ai.google.dev/gemini-api/docs/pricing`.
- Unknown models still return honest null; inactive `REFERENCE_RATES_2026` rows are not consulted.
- `PersistedDailyBudgetService.consumedEstimatedCostUsdToday` sums `AICallLog.estimatedCost` for the UTC day, excluding stub/null-cost rows; `AiOrchestratorService` passes that aggregate into `SpendAlertService`.
- `live-smoke` now fails if live calls do not produce non-null estimated-cost ledger rows.

**Verification run:** focused rate/cost/ops tests green; controlled live Gemini smoke green with 3 live calls and `aiCallLogEstimatedCostRows: 3`; final full server `248 suites / 2018 tests`; server `npx tsc --noEmit`; web `36 files / 169 tests`; web production build green; `git diff --check` clean except CRLF warnings.

**Is it 100% closed?** Yes for P0 as tracked in this handoff. Remaining work is P1+, not a P0 blocker.

**Next smallest step:** P1 multi-turn memory: wire 8 verbatim turns plus a short untrusted rolling summary into chat orchestration, user turn last, and keep all safety decisions on structured gates/profile only.
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

## 7. NEXT — in priority order (verify → fix the dead assistant → P1)

**0. VERIFY Codex's handoff FIRST** (baseline `6b584134`, per `CODEX_BRIDGE.md` §FOR CLAUDE). Tier 0 (server `npm test` + `tsc --noEmit`; web `npm test` + `npm run build`) + Tier 1 diff review. Scrutinize the high-claim items:
- **Live-Gemini smoke + `PRODUCTION_RATE_CATALOG`:** a REAL live call happened (`gemini-3.1-flash-lite`). Confirm the rate row is source-attributed + dated (Google pricing page), the default model id matches the verified row, and NO unverified/guessed price slipped in. [نامطمئن for Claude — the model id/price came from a live source Codex read; verify the attribution, don't trust training data.]
- **Multi-turn memory safety boundary:** memory must NOT influence §3 / intent / allergen-write — confirm intent + `extractStatedAllergens` + confirm-then-write still read only `input.prompt`, and a memory line like "I'm allergic to walnuts" cannot auto-write.
- **CORS fix:** same-port loopback peers only, no wildcard.
- **requestId echo:** did NOT reorder or bypass `RecipeSafetyFilterService` in `recommendation.controller.ts`.

**1. DIAGNOSE the dead AI assistant in the app UI (TOP product priority — outranks new P1 features).** The code wiring EXISTS (`apps/web/src/app/assistant/useAssistant.js` → `POST /ai/chat` → `apps/server/src/ai/ai.controller.ts`), so this is a RUNTIME / reachability / stub issue, not missing code. Run the app (preview tools), open the assistant, watch console + network on the `/ai/chat` call: is the screen reachable in the rebuilt nav? does the call 200 or fail (auth / base-URL / CORS)? is it returning a stub answer so it only *feels* dead? Fix end-to-end so a real user gets a real answer. **A non-functioning assistant means the entire AI backend delivers ZERO user value today.**

**2. Then P1 (Opus-gated; from AI_MASTER_SPEC §D "Must-build").** Do NOT originate these with Sonnet. Lock the design with Opus first, then execute.
- **Multi-turn memory:** DONE as slice 4h: 8 user-scoped verbatim turns + deterministic untrusted short summary are wired into `chat-orchestration`, user turn last, safety still reads only current prompt/profile. Remaining cache-provider optimization belongs to the P1 provider/cache upgrade.
- **fa/nl/en TemplateRegistry** — Dutch is REQUIRED (today there is zero Dutch in any deterministic answer string; only the lexicon has Dutch).
- **Conversational repair** — ask ONE clarifying question instead of guess-or-refuse (the missing productive middle of the abstention ladder).
- Then per the P1→P6 roadmap in AI_MASTER_SPEC (retrieval upgrade above the BM25 floor; `AiTurnDecision` substrate for Loop-3; etc.).

---

## 8. THE BAR (founder's standard — never soften)
True premium ($7 that feels like $20). Swiss-watch / Porsche engineering — **learning, not rules**. Investor-magnet on our terms. Ruthless, no flattery. Partner empowered to rebuild. Autonomous execution through the locked plan; stop only for important milestones/decisions, never routine per-step approval.
