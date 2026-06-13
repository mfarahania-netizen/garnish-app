# Garnish OS

> **Status note:** developer-facing and deliberately precise — not marketing. This README is aligned to
> the **Master Execution Constitution v1.0.1**
> (`docs/execution/GARNISH_OS_MASTER_EXECUTION_CONSTITUTION_v1.0.1.md`). Final wording pending Founder
> review (E0-1). Status legend: **✅ Implemented** · **🔧 In execution (Epic)** · **⏸ Delayed (gate)**.

## 1. What Garnish OS is
An AI-native food-intelligence product (PWA): recipe discovery, meal planning, a grocery list, and an
AI assistant, on a behavioral-intelligence backbone. Mobile-first, GDPR-by-design, universal-first for a
European audience.

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
- **122 recipes / 1223 ingredient lines / 1008 ingredients**, 0 unresolved (verified in DB).
- **Ingredient Resolver** (E11 ✅): free text → `ingredientId` via a normalized alias index
  (10,304 aliases across all 1008 ingredients), names, and codes. `apps/server/src/ingredients/`.
- Import/validate: `pnpm --dir apps/server data:validate:aliases` / `data:import:aliases` (and the
  `phase-one` / `ingredients` equivalents). See §14.

## 6. AI Core status & boundaries
- **Reality today:** rule-based assistant (`apps/server/src/ai`, Gemini-backed). The single
  **Orchestrator + Tool Registry + mandatory BehavioralContextSnapshot** is **🔧 In execution (E47, W6–W8)** — not yet built.
- **Boundaries (E47 Annex):** no autonomous agents, no multi-agent/LangGraph, no medical claims, no
  irreversible actions without explicit user confirmation; streaming for chat only.

## 7. BIP (Behavioral Intelligence Platform)
Base exists (`apps/server/src/behavior-engine`). Envelope design is set (ADR-0001 ✅); full v1
(30 events, profiles, predictions) is 🔧 In execution (E43, W3→SBX).

## 8. Recommendation Engine ✅ (base)
candidate → rank → exposure → outcome pipeline (`apps/server/src/recommendation`).

## 9. GES / Design System ⏸
The Garnish Experience System (tokens, theme, motion, component migration) is **being designed**; the
canonical file will land under `docs/design/`. Until then, no design-system code is built. Today the
Mantine theme is inline in `apps/web/src/App.jsx` (token migration is pending GES).

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
Code contract `event-envelope.schema.ts` is a W6 deliverable.

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
docs/design/  (GES — pending the design-system file)
```
