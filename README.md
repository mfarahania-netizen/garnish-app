# Garnish OS

> **Status note:** developer-facing and deliberately precise — not marketing. This README is aligned to
> the **Master Execution Constitution v1.0.1**
> (`docs/execution/GARNISH_OS_MASTER_EXECUTION_CONSTITUTION_v1.0.1.md`). Final wording pending Founder
> review (E0-1). Status legend: **✅ Implemented** · **🔧 In execution (Epic)** · **⏸ Delayed (gate)**.
>
> **Doc roles:** this root README = developer overview + current status snapshot · [`docs/README.md`](docs/README.md) = documentation index · [`data/README.md`](data/README.md) = data-layer source of truth · the Constitution = execution source of truth.

## Current status snapshot (updated 2026-06-18)
- **Quality bar: L4** (Amendment 2 §A2.1 — proposed, pending founder ratification; logged in [DECISION_LOG](docs/execution/DECISION_LOG.md)). A clean technical scan is **not** acceptance; the visual/product bar governs UI work.
- **Recommendation stack: FROZEN at A14** (Amendment 2 §A2.2). The internal shadow/lab/experiment line (A5–A14) is complete and **default-OFF**; no new recommendation `runtime-shadow` A-layer is built. **No live ranking change, no user-visible recommendation response change** — A14 is founder-review/activation-PLANNING only (production readiness red; live activation needs explicit founder go-ahead). See [recommendation reports](docs/README.md).
- **Frontend: Track-5 RESET — rebuild in progress, screenshot-gated.** The earlier UI (rejected at the Phase-4A visual bar) was **wiped and is being rebuilt screen-by-screen to the approved mockup** on the GES primitive kit (RTL-first, variable Vazirmatn). All 14 screens have been rebuilt; a first **web smoke-test net** (Vitest 4 + Testing Library + jsdom) guards them. Real actions are wired to **real, existing** endpoints (favorites, meal-plan slots, recommendation impressions) with **honest** success/error states (confirmation only after a real successful call; revert + honest error on failure) — no lying toasts, token-pure (GES CSS-vars only). See [UI_MIGRATION_STATUS](docs/execution/UI_MIGRATION_STATUS.md).
- **AI Core (E47 A1–A12) + grounded assistant:** single Orchestrator + mandatory BehavioralContextSnapshot · DB persistence (AICallLog / ChatMessage / UserFact) · legacy chat routed **through** the orchestrator · real read-only tools · Gemini provider **behind** the provider interface · cost ledger/daily budget + spend alerts · deterministic + output-safety eval gates · controlled live-Gemini smoke **PASS** (A7) · controlled **live chat adapter** behind explicit flags (A8) · runtime-boundary & product-safety gate (A9). **The chat reply is now GROUNDED in the real recipe corpus behind a HARD, server-side allergy gate** that runs before any reply is composed and before anything reaches a model (reuses the audited `assessRecipeFit`/`analyzeRecipeIntegrity` + the reconciled declared-allergy set; declared allergens are **never** put in a prompt). Empty safe set → honest "no safe match"; never an invented recipe.
- **Live Gemini is NOT product-enabled** — gated/dev-only behind explicit env flags: live is enabled only by `AI_PROVIDER=gemini` + `AI_LIVE_ENABLED=true` + a real key. `AI_CHAT_LIVE_ENABLED` is a chat **kill-switch**, not a separate enabler: `false` forces chat deterministic even when live; **unset follows the general live flag** (see `model-provider.factory.ts`). **Default behavior is deterministic/grounded** (live flags unset). No streaming · no model-driven tools · no agents · no vision · no medical/diet advice. **AI Core is not complete.**
- **Analytics / gamification honesty:** deliberate, user-initiated signals (`cook_complete` / `favorite_add` / `mealplan_add` …) now **bypass the anti-bot/duplicate gate** so a real cook fired right after a heavy scroll/impression burst is never silently dropped; high-frequency noise (views/impressions/page_view) stays gated. Gamification is server-authoritative and counts only real `cook_complete` events.
- **Data:** ingredient dictionary **1008** (alias patch accepted; no new IDs / no nutrition changes) · recipes **350 dev/preview** = **200** (fa_, v0.6.1) **+ 150** (intl_, v0.6.0 international-core, **DRAFT**) in local `garnish_db` (verified 2026-06-21) — the fa_ set is a superset upsert of the prior 122 (0 deletions, interactions preserved); **not final production data** (the 150 intl_ are draft, pending audit), production import remains a separate gated decision. **Nutrition is not source-locked / not a final verified dataset.** See [data/README](data/README.md).
- **Open security / compliance:** E1 secret **history purge — plan ready, history rewrite pending founder execution** (R-E1-HISTORY-DEAD-SECRETS — keys already rotated, repo private; HUMAN-GATED force-push, see [E1_HISTORY_PURGE_PLAN](docs/security/E1_HISTORY_PURGE_PLAN.md); working-tree secret scan = 0). **R16 / E39 GDPR privacy = BASELINE-CLOSED for dev/beta** (2026-06-14 final gate: erasure + export + retention-dry-run verified; legacy destructive cron neutralized) — **controlled destructive prune deferred** as a future operational task. See [E39 Final Privacy Gate](docs/security/E39_FINAL_PRIVACY_GATE_REPORT.md).

## 1. What Garnish OS is
An AI-native food-intelligence product (PWA): recipe discovery, meal planning, a grocery list, and an
AI assistant, on a behavioral-intelligence backbone. Mobile-first and GDPR-by-design, **architected**
universal-first for a Europe/Holland general-public launch — but currently in an **Iran sandbox first**
(auth is Iran phone-only today; locale/EU onboarding is a pre-launch step, not yet shipped).

## 2. What Garnish OS is *not*
- Not a social network. No public feed, no public chat/DM, no public comments (see §17).
- Not an autonomous-agent platform. The AI does nothing irreversible without explicit user confirmation.
- Not a marketplace for personal data — selling/sharing personal data is never built.
- "Iran" is a **technical sandbox** for validation only — not a market.

## 3. Current execution source of truth
`docs/execution/GARNISH_OS_MASTER_EXECUTION_CONSTITUTION_v1.0.1.md`. All work derives from it. The
0–180-day plan (W1–W26) drives gates **G1 (W13)** and **G2 (W26)**.

## 4. Architecture overview (aligned to Constitution Part 3)
- **apps/web** — React + Vite + Mantine PWA (RTL Persian today; EN-first ready).
- **apps/server** — NestJS 11 + Prisma 5 + PostgreSQL (Redis for cache).
- **packages/shared** — shared code.
- 17 target layers: client/PWA → NestJS core → Prisma → data import → ingredient resolver → recipe
  intelligence → BIP → AI Orchestrator → recommendation → INE → engagement → community → B2B boundary →
  WAT ops → compliance → observability → admin.

## 5. Data layer ✅
- **350 recipes (dev/preview) / 1008 ingredients**, 0 unresolved (verified in DB: 200 `fa_` v0.6.1 + 150
  `intl_` international-core v0.6.0). **127 enriched to GRIS v2.1** so far. **Not final production data** — the
  150 international-core is a draft candidate **pending external audit**; the production import remains a
  separate gated decision, and **nutrition is not source-locked corpus-wide**. (Single source of truth; matches
  `data/README.md`.)
- **Ingredient Resolver** (E11 ✅): free text → `ingredientId` via a normalized alias index
  (10,630 alias registry entries across all 1008 ingredients), names, and codes. `apps/server/src/ingredients/`.
- Import/validate: `pnpm --dir apps/server data:validate:aliases` / `data:import:aliases` (and the
  `phase-one` / `ingredients` equivalents). See §14.

## 6. AI Core status & boundaries
- **Reality today:** the single **Orchestrator + Tool Registry + mandatory BehavioralContextSnapshot** is
  **built** (`apps/server/src/ai`, E47 A1–A12): every AI call routes through one orchestrator
  (snapshot-validate → prompt-injection → cost → safety → model → nutrition-claim → audit log). Chat is
  **grounded** in the real recipe corpus behind a **HARD, server-side allergy gate** (reuses the audited
  `assessRecipeFit`/`analyzeRecipeIntegrity`); the default reply is deterministic. A real live LLM (Gemini)
  sits **behind** the provider interface and stays **OFF** unless explicit env flags are set (see snapshot).
- **Boundaries (E47 Annex):** no autonomous agents, no multi-agent/LangGraph, no medical or
  nutrition-specialist claims, no irreversible actions without explicit user confirmation; streaming for chat only.
- **No image/photo recognition:** there is no real vision capability. The earlier *simulated* "fridge-photo"
  ingredient detection was removed (no fake placeholder); the assistant is text-only. **AI Core is not complete.**

## 7. BIP (Behavioral Intelligence Platform)
Base exists (`apps/server/src/behavior-engine`). Envelope design is set (ADR-0001 ✅); full v1
(30 events, profiles, predictions) is 🔧 In execution (E43, W3→SBX).

## 8. Recommendation Engine ✅ (base)
candidate → rank → exposure → outcome pipeline (`apps/server/src/recommendation`).

## 9. GES / Design System — Track-5 rebuild on the GES kit 🔧
- **Docs (exist):** `docs/design/GARNISH_EXPERIENCE_SYSTEM_v1.md`, `DESIGN_IMPLEMENTATION_GUIDE.md`,
  `DESIGN_QA_CHECKLIST.md`, `COMPONENT_MIGRATION_MAP.md`, `COMPONENT_PATTERN_LIBRARY_v1.md`.
- **Foundation (installed):** `apps/web/src/styles/tokens.css` + `base.css`, `theme/garnish-theme.js`,
  `lib/motion.js` — imported once at the app entry; the Mantine theme is wired to the tokens.
- **Primitives:** token-pure GES components under `apps/web/src/components/ges/`.
- **Rebuild status (Track-5 reset):** the prior surfaces (rejected at the Phase-4A visual bar) were wiped;
  all 14 screens have been **rebuilt screen-by-screen to the approved mockup** on the GES kit and are
  **screenshot-gated** by the founder each sprint. Token-purity is enforced (non-brand hex
  `#FF6B35`/`#1A237E`/`#4CAF50` must grep to 0); RTL + variable Vazirmatn + `prefers-reduced-motion`;
  ≥44px tap targets; every fetching screen ships loading/empty/error/data states. A web smoke-test net
  (Vitest) guards the routes. **Production-ready UX is still founder-gated, not auto-claimed.**

## 10. Execution gates
- **G1 (W13):** security scans 0, import live, Food DNA e2e, Briefing live, erasure test green, AI safety eval pass.
- **G2 (W26):** 19-KPI sandbox (D7 ≥20%, unsafe <0.1%, crash-free ≥99.5%, AUC ≥0.70…) + visa package → EU decision.
- **G3 (EU):** D7-EU ≥18%, activation ≥60%, C1-share ≥15% MAU.

## 11. Local development
```bash
pnpm install --frozen-lockfile          # pnpm ONLY (see CONTRIBUTING.md)
pnpm --dir apps/server exec prisma generate
pnpm --dir apps/server exec prisma migrate deploy   # apply DB migrations
pnpm dev                                # turbo dev (web + server)
pnpm build                              # build all
pnpm test                               # turbo test (server jest)
```
Requires Node ≥18 (CI uses 20), PostgreSQL, and (optionally) Redis.

## 12. Environment variables
Copy `apps/server/.env.example` → `apps/server/.env` and `apps/web/.env.example` → `apps/web/.env`.
- Server: `DATABASE_URL`, `JWT_SECRET` (≥32 chars), `GEMINI_API_KEY`, `REDIS_HOST`, `REDIS_PORT`, `FRONTEND_URL`, `PORT`.
- Web: `VITE_API_URL`, `VITE_POSTHOG_KEY` (empty = analytics off), `VITE_POSTHOG_HOST` (EU host).
The server fails fast at boot if a required secret is missing/placeholder (`src/config/env.validation.ts`).

## 13. Security — never commit `.env`
`.env` is git-ignored; **never commit real secrets**. A gitleaks pre-commit hook + CI scan guard the repo
(`git config core.hooksPath .githooks`). If a secret leaks, rotate it and log the rotation in
`docs/execution/DECISION_LOG.md`. See `docs/security/E1_secret_purge_runbook.md`.

## 14. Data import
```bash
pnpm --dir apps/server data:validate:phase-one && pnpm --dir apps/server data:import:phase-one   # 122 recipes
pnpm --dir apps/server data:validate:ingredients && pnpm --dir apps/server data:import:ingredients # 1008 ingredients
pnpm --dir apps/server data:validate:aliases && pnpm --dir apps/server data:import:aliases         # alias registry
```
Importers are idempotent (upsert). Source data: `data/ingredients/phase-one-final/`.

## 15. Design implementation rules (summary — full in GES docs)
No hardcoded hex outside design tokens · no ad-hoc animation outside `lib/motion.js` · every UI ships
empty/loading/error states · each AI surface is one of Whisper/Sheet/Companion · every recommendation has
a Why · nutrition UI shows source/confidence · design decisions belong to UX, not the coding assistant.

## 16. Event Envelope standard
Canonical event envelope (`schemaVersion: 2`) — `docs/adr/ADR-0001-canonical-event-envelope.md`.
Additive to the existing taxonomy; PII-free metadata; consentPurpose / privacyClass / retentionPolicy.
Code contract `apps/server/src/analytics/event-envelope.schema.ts` is **shipped** (E43-W6, 32 tests green); live ingest adoption stays Founder-gated (the runtime guard is observational — staged migration, not yet contract-enforced).

## 17. What not to build yet (Constitution Part 2.3)
Algorithmic public feed · public chat/DM · public comments · individual public leaderboards · selling/
sharing personal data · employer access to individual behavior · autonomous WAT in forbidden domains ·
separate multi-agent/LangGraph infra. See the Constitution for the full list and reconsideration gates.

## 18. Contribution / coding-assistant rules
See `CONTRIBUTING.md`. The implementation assistant **must not** redefine product strategy, design
language, AI policy, market positioning, or roadmap scope. It may only implement tasks derived from the
Constitution and approved task templates; every irreversible action requires explicit human approval.

---
### Canonical docs
```text
docs/execution/GARNISH_OS_MASTER_EXECUTION_CONSTITUTION_v1.0.1.md
docs/execution/RISK_REGISTER.md · DECISION_LOG.md · GATE_REVIEW_TEMPLATE.md · WEEKLY_EXECUTION_REVIEW.md
docs/adr/ADR-0001-canonical-event-envelope.md
docs/security/RBAC_ROUTE_MATRIX.md · E1_secret_purge_runbook.md
docs/audit/STRUCTURE_AND_DESIGN_AUDIT.md
docs/b2b/B2B_GOVERNANCE_B0.md · docs/community/COMMUNITY_C0_POLICY.md · docs/ops/WAT_W0_WORKFLOW_SPEC.md
docs/design/GARNISH_EXPERIENCE_SYSTEM_v1.md · DESIGN_IMPLEMENTATION_GUIDE.md · DESIGN_QA_CHECKLIST.md · COMPONENT_MIGRATION_MAP.md · COMPONENT_PATTERN_LIBRARY_v1.md
```
