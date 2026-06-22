# 🧭 CONTINUATION HANDOFF — START HERE (every new chat reads this first)

> **Purpose.** This is the single durable entry point so a NEW chat continues the **exact same method, oversight,
> and rigor** with zero loss of context — for the AI work now and for the whole app going forward. It does NOT
> duplicate the specs; it points to them and encodes the *method + standing rules + current state + next step*.
> Code-grounded, no flattery. Keep it current at every milestone. Last refresh: 2026-06-22, at `master` `e37a36cd`.

---

## 0. HOW TO USE THIS (the new-chat boot sequence)
1. Read this file top to bottom.
2. Read `docs/GARNISH_GROUND_TRUTH.md` (authoritative project state) + `docs/audit/AI_MASTER_SPEC.md` (the AI design, **where fragments disagree, it wins**).
3. Read the auto-loaded `MEMORY.md` index (it is already in context every session) — it links the standing facts.
4. Confirm the repo is green before touching anything (see §4 verify command), then pick up §6 (pending) / §7 (next).
5. Work the §1 method **word-for-word**. Do not start a new capability without a guardian loop.

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
- Branch `master`, last commit `e37a36cd`. **246 server suites / 2007 tests green; web 36 suites / 171 tests; `tsc --noEmit` clean.**
- **P0 AI build: complete + guardian-converged.** Shipped & verified: EU-14 allergen engine + canonicalization; IntentClassifier (the €0 cost+safety router) wired on every chat turn (dark/log-only); §3 conversational-allergy (declare → confirm → one-tap write → hard gate); multi-window cost budget (5h/daily/weekly/monthly + 15s cooldown, **inert** until live Gemini); SubstitutionEngine; signal capture; the cross-dimension acceptance capstone (`apps/server/src/ai/eval/cross-dimension.acceptance.spec.ts`).
- **CRITICAL bug the guardian caught & closed:** the hard allergy gate was silently **failing open on the entire live recipe corpus** — recipes author allergens in Persian (آجیل/گلوتن/لبنیات/…), the canonicalizer was English-only → a nut-allergic user was served nut dishes. Fixed (Persian+Dutch canonicalization in `recipe-integrity.ts`) and locked with a regression test that reads the real shipped corpus.
- **Verify command (run first in a new chat):** from `apps/server` → `npm test`; from `apps/web` → `npm test` + `npx tsc --noEmit`. Must be green before any new work.

---

## 4b. EXACT PHASE POSITION — we are at the TAIL of P0 (be precise; this is the "where exactly")
P0 = "Observability + Cost Honesty + Safety-Wiring." Status, item by item (per `AI_MASTER_SPEC.md` §roadmap):
- ✅ **DONE + guardian-converged** (the live safety/correctness/compliance bugs P0 existed to fix): IntentClassifier wired dark per turn; §3 conversational-allergy confirm-then-write; granular Art.9 consent split + withdrawal cascade; rich `substitutionOptions` consumed (off `toStringArray`); EU-14 engine; the **CRITICAL Persian hard-gate fail-open closed**; signal capture (swap/scale/remove → `UserEvent`).
- ⛔ **BLOCKED-on-VPN:** populate `PRODUCTION_RATE_CATALOG` with verified, dated Gemini rates → `estimatedCostUsd` non-null. Cannot be done honestly until the founder enables VPN and live rates are confirmed. The P0 gate "estimatedCostUsd non-null + counters correct under 2 instances" stays **RED** until then.
- 🔧 **REMAINS (not blocked, not started):** make the multi-window cost/quota layer **Redis-atomic** (today it is DB-aggregate, single-instance-correct only); full end-to-end **`requestId` echo** verification (served→reward, the "irreversible" step); confirm `EventOutbox` producers are flipped from `not_started` and turn events emit tier-tagged.
- ❌ **P1 NOT STARTED:** multi-turn memory, fa/nl/en `TemplateRegistry`, hybrid+alias retrieval, conversational repair, cross-surface thread, runtime groundedness validator.

**The immediate next work is a fork:** (a) close the non-blocked P0 tail (Redis cost atomicity + `requestId` echo + outbox producer flip) — mostly mechanical/infra, Sonnet-capable with the guardian; OR (b) start P1 design with Opus (multi-turn memory first). The rate-catalog P0 item is parked until VPN. **Do not let §6/§7 read as "P0 is fully done" — it is not; this §4b is the precise position.**

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
