# GARNISH OS — MASTER EXECUTION CONSTITUTION v1.0.1

> **English working reconstruction.** This file is the in-repo canonical copy referenced by the
> codebase (README, ADRs, gates). It was reconstructed in English from the Founder's authoritative
> source document. If any fine wording differs from the original, the Founder's source prevails —
> raise a discrepancy rather than acting on a divergence. Numbers, epic IDs, gates, owners, and
> phasing below are preserved verbatim from the source.

**Ratified:** 13 June 2026 · **Merged sources:** Repair v2 + Strategic Correction v3 + Strategic
Correction v4 + **Amendment 1 (Execution Hardening Patch)** · **Conflict-resolution rule:** v4 > v3 > v2.
v2 quality/security items not superseded remain in force; v4 delay / do-not-build rules dominate.

**Nature of this document:** this is the *single execution constitution* — it contains no new ideas,
research, or features. Every section references its source (v2/v3/v4 + §). From here on it is the
single source of truth for Founder, Designer, Content Manager, Advisor, and Implementation Assistant;
the prior volumes are "evidence appendices" only.

**Reference notation:** `[v2§x]` `[v3§x]` `[v4§x]`. Epics use a single global ID (1–53).
**Roles:** F=Founder · PS=Product Strategist · UX=Designer · AA=AI Architect · BA=Data/Behavior
Architect · EL=Engineering Lead · CM=Content Manager · ADV=Legal/Compliance Advisor · CA=Coding
Assistant. (Real 3-person mapping: F covers F/PS/EL/AA/BA, Designer=UX, CM=Content, ADV=external
[v3§12.1].)

---

# AMENDMENT 1 — EXECUTION HARDENING PATCH

**Nature:** hardens *execution only*; introduces no new strategy/feature/research and removes nothing
from the roadmap. The 0–180 day plan stays intact, only made more precise and earlier-starting.

## A1.1 — High-Intensity Execution Mode
The Founder confirms the team works at high intensity; "reduce workload" is **not** the control
variable — **the control variable is passing the Acceptance Gate**. No ticket is lightened, no epic
removed, no gate passed without real evidence. If extra capacity appears, scope is *not* added; the
same scope is closed faster and cleaner. **"Almost done" ≠ done** — a deliverable is done only when
its Gate passes. The Implementation Assistant may not propose new tasks unless directly unblocking the
current task.

### Execution Discipline Rules
1. Every task maps to one Epic ID.
2. Every task has an Acceptance Gate.
3. Every irreversible action requires explicit Founder approval.
4. No feature outside Part 5 enters a sprint.
5. No strategy prompt before G2 unless one of the approved triggers fires (see File Closing Rule).
6. If a ticket finishes early, the next task is pulled **from the same Wave**; pulling Delay/Year2+ work is forbidden.
7. Every Friday: Gate Review mini-check (GATE_REVIEW_TEMPLATE).
8. Every Sunday: next week's tickets prepared from the Part 11 template (recorded in WEEKLY_EXECUTION_REVIEW).

## A1.2 — Facilitator Outreach Pulled Forward (resolves Part 6 / Part 12 conflict)
Final rule: **the formal visa package still lands at W13–G2**, but **outreach starts in W1/W2**.
Outreach = discovery / relationship-building / credibility-raising / lead-time reduction — *not*
submission. Detailed changes applied in Part 6 (rows W1, W2, W3, W13 plus W3–W6 follow-ups) and Part 12
(priority three).

## A1.3 — AI Core v1: Precise Scope without Reducing Ambition
The Part 1 / Part 7 ambition is intact, but the **v1 implementation scope** is precisely defined to
prevent agent-fantasy / overbuilding. The full scope (incl. an explicit NOT list) lives as the
**"E47 Annex"** right after the Part 5 table; Part 6 (W6–W8) and Part 7 (Q1) reference it. NOT items
go to the Research Track after G1/G2 or Year 2, unless already defined as build elsewhere.

## A1.4 — Event Envelope → ADR + Code Contract
Part 4 becomes implementable:
- **ADR (deliverable in W3):** `docs/adr/ADR-0001-canonical-event-envelope.md` with: 1) Context
  2) Problem 3) Decision 4) Full packet schema 5) Field definitions 6) Privacy rules 7) Consent rules
  8) Retention rules 9) Migration strategy 10) Six full examples: recipe_viewed, cook_complete,
  ai_answer_feedback, notif_suppressed, cooked_share(visibility=private), workflow_run(actorType=agent)
  11) Rejected options 12) Consequences 13) Owner: BA(A)/EL 14) Versioning policy.
- **Code contract (deliverable in W6, alongside migration):**
  `apps/server/src/analytics/event-envelope.schema.ts` exporting `CanonicalEventEnvelopeSchema`,
  `CanonicalEventEnvelope`, `ConsentPurposeEnum`, `PrivacyClassEnum`, `VisibilityEnum`,
  `RetentionPolicyEnum`, plus helpers `validateEventEnvelope(input)` and `assertNoPIIInMetadata(metadata)`.
- **Acceptance:** after migration, ingest rejects an invalid packet; metadata containing
  email/phone/free PII is rejected or flagged; all new events carry consentPurpose + privacyClass;
  tests cover ≥8 example events.
- **Migration rule (additive-only):** 1) nullable columns 2) backfill defaults 3) ingest validation
  switch 4) make required only after existing flows migrate 5) **no breaking migration before W13.**

## A1.5 — Execution Management Files (added artifacts, created in W1)
```text
docs/execution/RISK_REGISTER.md
docs/execution/DECISION_LOG.md
docs/execution/GATE_REVIEW_TEMPLATE.md
docs/execution/WEEKLY_EXECUTION_REVIEW.md
```
**RISK_REGISTER.md** columns: `| Risk ID | Risk | Area | Probability | Impact | Owner | Mitigation | Trigger | Status |` · 15 seed risks. **DECISION_LOG.md** columns: `| Decision ID | Date | Decision | Options Considered | Final Choice | Reason | Owner | Revisit Trigger |` · 10 seed decisions. **GATE_REVIEW_TEMPLATE.md** headings: Date · Gate(G1/G2/G3) · Required criteria · Actual metrics · Pass/Fail/Conditional · Blockers · Risks opened · Decisions made · Scope changes allowed? · Next gate · Founder approval. **WEEKLY_EXECUTION_REVIEW.md** headings: Week# · Planned deliverables · Completed · Gates passed · Gates failed · Open blockers · Security/compliance concerns · Decisions needed from Founder · Carry-over · Next week tickets.

## A1.6 — Appendix A
Real Week-1 tickets per the Part 11 template appear in **APPENDIX A** at the end (E1-1, E2-1, E4-1, E5-1, E3-0, E35-0).

## A1.7 — File Closing Rule
With this Amendment the document is closed for execution (full rule at end of file).

## A1.8 — Design Implementation Pack + README Update
**Nature:** no new strategy/feature; makes GES v1 (decided in v3§5/v4) and the README implementable.

### A1.8.1 — Design System Source of Truth (added artifacts)
```text
docs/design/GARNISH_EXPERIENCE_SYSTEM_v1.md
docs/design/DESIGN_IMPLEMENTATION_GUIDE.md
docs/design/DESIGN_QA_CHECKLIST.md
docs/design/COMPONENT_MIGRATION_MAP.md
apps/web/src/styles/tokens.css
apps/web/src/styles/base.css
apps/web/src/theme/garnish-theme.js
apps/web/src/lib/motion.js
```
Created as deliverables in W3–W5 (Part 6 updated). The repo copy of this Constitution lives at
`docs/execution/GARNISH_OS_MASTER_EXECUTION_CONSTITUTION_v1.0.1.md`.

### A1.8.2 — GARNISH_EXPERIENCE_SYSTEM_v1.md (deliverable W3 [D], Owner: UX)
Executive, **definitive** GES summary extracted directly from v3§5 — no new design. Twenty sections:
1) Design Philosophy 2) Visual Language 3) Interaction Language 4) AI Surface Language 5) Motion System
6) Food Photography System 7) Emotional Design 8) Mobile Ergonomics 9) Progressive Disclosure
10) Cook Mode Experience 11) Grocery Interaction 12) Meal Planning Interaction 13) Home Command Center
14) Empty/Loading/Error Storytelling 15) Investor Demo Visual Standard 16) Design QA System
17) Behavioral UX System 18) Habit Formation UX 19) Gamification UX 20) Premium Consumer Experience.
**Per-section format:** `| Section | Principle | Implementation Rule | Components Affected | Acceptance Criteria |`

### A1.8.3 — DESIGN_IMPLEMENTATION_GUIDE.md (deliverable W4 [D], Owner: UX+EL)
Implementable for the Coding Assistant. Minimum content:
**Required Web Files:** the four apps/web files from A1.8.1.
**Token Categories (10):** color · typography · spacing · radius · shadow/elevation · motion · z-index · semantic state · AI-surface · nutrition/safety-state.
**Non-Negotiable Rules:**
1. No hardcoded hex in JSX/CSS unless inside tokens.css.
2. No ad-hoc animation outside `lib/motion.js`.
3. No UI component ships without all three states empty/loading/error.
4. Primary mobile actions within thumb reach (bottom one-third where possible).
5. Each AI surface is exactly one of: AI Whisper / AI Sheet / AI Companion.
6. Every recommendation has a Why/Explainability surface.
7. Every nutrition UI shows source/confidence state.
8. Every new component passes RTL and mobile review.
9. Design decisions belong to the UX/UI Designer, not the Coding Assistant.
10. The Coding Assistant only implements; it never re-defines the design language.

### A1.8.4 — DESIGN_QA_CHECKLIST.md (deliverable W5 [D], required before merging any UI work)
| Check | Pass/Fail | Notes |
|-------|-----------|-------|
| Uses tokens only | | |
| No hardcoded hex | | |
| RTL works | | |
| Mobile reachability works | | |
| Loading state exists | | |
| Empty state exists | | |
| Error state exists | | |
| AI disclosure exists if AI is used | | |
| Explainability exists if recommendation is used | | |
| Nutrition confidence/source badge exists if nutrition appears | | |
| Motion uses lib/motion.js | | |
| Reduced motion supported | | |
| Accessibility checked | | |
| Screenshot before/after attached | | |

### A1.8.5 — COMPONENT_MIGRATION_MAP.md (deliverable W5 [D], Owner: UX+EL)
Format: `| Current Area/Component | Current Issue | Target GES Pattern | Files to Inspect | Migration Priority | Acceptance Criteria |` — covering ≥12 areas: Home/Command Center · RecipeCard · RecipeDetail · AI Chat · Food DNA Onboarding · Meal Planner · Shopping List · Profile/Preferences · Bottom Navigation · Notifications · Empty/Loading/Error states · Admin/Intelligence dashboard. (Issues come from v1/v2 evidence: scattered hex, missing states, inline theme, etc. — no new claims.)

### A1.8.6 — Part 6 Update (applied in rows W2–W5)
Added Acceptance Gates: existence of GES doc, Implementation Guide, QA Checklist, Migration Map,
tokens.css, base.css, garnish-theme.js, motion.js — and the rule: **no new UI task starts without
referencing the design docs** (locked at the W5 gate row).

### A1.8.7 — README.md Update (additions)
The root README must be **developer-facing and precise**, not investor-hype, fully aligned with the
Constitution. Eighteen sections: 1) What Garnish OS is 2) What it is not 3) Current execution source of
truth 4) Architecture overview (aligned to Part 3) 5) Data layer (122/1008, resolver) 6) AI Core status
& boundaries (reality: currently rule-based; E47 building; boundaries = E47 Annex) 7) BIP
8) Recommendation Engine 9) GES/Design System 10) Execution gates G1/G2/G3 11) Local development
12) Environment variables 13) **Security warning: never commit `.env`** 14) Data import instructions
15) Design implementation rules (A1.8.3 summary) 16) Event Envelope standard (ADR-0001) 17) What not to
build yet (Part 2.3 summary) 18) Contribution / coding-assistant rules.
**Fixed warning text:**
```text
The implementation assistant must not redefine product strategy, design language, AI policy, market
positioning, or roadmap scope. It may only implement tasks derived from the Constitution and approved
task templates.
```

### A1.8.8 — README Timing
Task `E0-1 — README Alignment with Constitution` is added to **W2** (after the Constitution enters the
repo in W1; GES/ADR links point to canonical paths and are link-checked at the W3 gate).

---

# PART 1 — FINAL STRATEGIC DECISIONS (frozen)

| Decision | Final Status | Source | Owner |
|----------|--------------|--------|-------|
| **Iran sandbox** | Technical/Behavioral Beta only: 6 months, ≤1000 users, zero revenue, zero market claim; output = a 19-KPI quality Evidence Package | v3§14.1 | F(A), EL/BA(R) |
| **Europe universal-first** | English-first, universal ICPs, Persian/MENA dataset = hidden strength not identity; soft launch months 9–15 post-G2 | v3§4,§14.2 | F |
| **AI Core** | Single Orchestrator + Tool Registry + mandatory BehavioralContextSnapshot on every call; agents = roles on the same core, not separate services | v3§7 (+v4§6) | AA(A), EL |
| **BIP** | Behavioral Intelligence Platform v1: extend existing base (taxonomy/feature-store/exposure), not a rewrite; 20 subsystems, 30 new events, 6 profiles, 5 model-backed predictions | v3§6 | BA(A) |
| **Food DNA Onboarding** | Full replacement of v2 5-step onboarding; 15 steps, ≤5 min; activation = complete + first_action ≥45% | v3§9 | PS/UX(A), BA |
| **GES** | Garnish Experience System v1 (20 modules) on the v2 tokens/theme/motion base; Apple/One-UI level without copying | v3§5 | UX(A) |
| **INE** | Intelligent Notification Engine v1: 21 modules, 12 notif types with fatigue protection; "suppressed decisions" are logged; push depends on EPIC 45 | v3§8 | PS(A), BA |
| **Engagement system** | 20 mechanics in three reward types Mastery/Insight/Delight; anti-dark-pattern; no public individual leaderboards | v3§11 (+v4§10) | PS(A), UX |
| **Community** | Stage-gated C0–C6: C0 docs now, C1 private in EU window, C2–C3 after D30 ≥12%, C4 (recipe UGC) earliest Year 2 with 15-gate Safety System, C6 Year 2–3 | v4§2–4 | F(A), CM/PS |
| **B2B** | Data path only: B0 governance now, B1 aggregate reports Year 2 with 2 LOI, B2 Year 2–3 K-anonymity ≥100; never individual data / employer access to employees | v4§5 | F(A), ADV |
| **WAT** | W0 hooks now (on EPIC 47, ~zero cost), W1 human-approved tk-workflows months 6–12 only with time-log evidence, supervisor Year 2+, executive conditional, permanent deny-list | v4§6–7 | EL(A), AA |
| **Platform Extension Layer** | Only 5 cheap boundaries now: visibility/shareToken, purpose in ConsentLog, PII-free events policy, `ops:*` namespace + Workflow Spec, i18n-keys discipline; **no combined multi-tenancy** | v4§8 | EL(A) |
| **Health Mode** | Delay → Year 3; entry: legal opinion + Art.9 controls + field-encryption + ≥50% nutrition source-locked; scope=wellness; never diagnosis/treatment | v2§4-Phase9 | F+ADV(A) |
| **Family layer** | Delay; entry: waitlist ≥8% EU users + stable revenue (Year 2–3); until then schema-ready only (household_hint/contextTag) | v3§14.6 | F(A), PS |
| **Native mobile timeline** | PWA-OS days 0–90 (E45), installable months 3–6, Expo/RN decision months 6–12 with a spike, native Year 1–2 if retention supports | v3§14.3 | EL(A) |
| **Public feed** | **No** — not built by default; earliest reconsideration Year 3 with full C2–C4 evidence + DSA readiness + written F+ADV decision; even then curated gallery, not algorithmic feed | v4§2-C5,§10 | F |
| **Public chat / DM** | **No** — never in core; communication only inside Circles ≤25 people (C2) with Report/Block/Freeze | v4§10,§11-3 | F |
| **Enterprise direct sales** | **No for now** — B3 partnership-only Year 2–3; no default; no sales commitment in pitch before B1 entry | v4§5-B3 | F |

**Single-line frozen decisions:** real monetization only EU post-G2 [v3§15.4] · no "full AI-native/multi-agent"
claim until the Orchestrator is live [v2§6+v3§16] · pitch market figure = sourced 2030, drop 2034 [v2§2.7] ·
selling personal data = never [v4§5] · gates G1 (day ~90) and G2 (~month 6) per v3§14.0 are mandatory.

---

# PART 2 — FINAL DO / DO-NOT / DELAY

> Day0 = official execution start by the Founder. All deadlines are relative.

## 2.1 Build Now (days 0–90 + sandbox)

| Build Now | Why | Owner | Deadline |
|-----------|-----|-------|----------|
| Wave A security: E1,2,4,5 (+start 3) | secrets in git / auth leak / PostHog without consent | EL/CA | day 7 |
| Foundations: E3,6,7,9,10,11 + E29,30 | CI / errors / import 122+1008 / tokens | EL/CA, CM(data) | day 21 |
| i18n skeleton (E41) + SW/manifest (E45) | EU/PWA critical path | EL/CA | day 21 |
| GES base: 5.1/5.2/5.13 + complete E29–32 | experience language before surfaces | UX | day 35 |
| Three-tier nutrition policy (E12) | 991/1008 unsourced | CM/EL | day 35 (ongoing sprint) |
| AI Core v1 (E47 incl. 13–17) + Snapshot contract | product brain | AA/EL/CA | day 56 |
| BIP base: 30 new events + core signals (E43) | rich signal substrate | BA/CA | day 56 |
| Food DNA full (E22′) | activation | UX/CM/BA/CA | day 56 |
| Home/Briefing (E23) + Rail/Feedback (E18,19) + Memory/Stream (E16,17) + CookMode-MVP | matte surfaces | UX/EL/CA | day 70 |
| Hardening: E8,33,39 + INE in-app (E44) + Demo (E34) + AI-Act memo (E40) + sandbox legal review (E49) | G1 | EL/UX/ADV | day 90 = **G1** |
| [Policy] C0 Community docs (E51-C0) + B2B B0 (E52) + WAT W0 spec (E53) | anti-duplication hooks | CM/ADV/EL | day 21 |
| [Spec] remaining GES modules as added spec | gradual execution | UX | day 90 |
| Sandbox run: ramp 50→1000 + KPI dash (E36′) + E20,21,26,27,37,48-base,25,28 + full i18n + E46 start + E50 EN alpha + E44 push | months 4–6 | Shared | month 6 = **G2** |

## 2.2 Delay (gated)

| Delay | Until | Entry Criteria |
|-------|-------|----------------|
| EU Universal Launch | months 9–15 | **G2**: sandbox KPIs + visa/facilitator package + i18n + 150–250 EN recipes (E46) + EN alpha |
| Real monetization (E38 activation) | EU post-G2 | paywall test-mode ready; real only EU |
| Community C1 | EU window | G2 + E39 green + ≥10% share intent in alpha |
| Community C2–C3 | months 12–18 | D30 ≥12% stable 2 months in EU + Report/Block built |
| Community C4 (recipe UGC) | Year 2 | 15-gate Safety System tested + review SLA ≤72h + DSA review |
| Community C6 (Creator/Expert) | Year 2–3 | ≥10 inbound creator requests + verification/contract ready |
| B2B B1 (aggregate reports) | Year 2 | G3-EU retention + 2 real LOI + K≥100 aggregation line |
| B2B B2 (API) | Year 2–3 | B1 validated |
| WAT W1 | months 6–12 | documented time-log with 3 stable opportunities + approval-UI |
| WAT W2 (single-domain supervisor) | Year 2 | W1 metrics on two domains (≥8h/week saved, error <5%) |
| Family layer | Year 2–3 | waitlist ≥8% EU users + stable revenue |
| Health Mode | Year 3 | legal opinion + Art.9 controls + encryption + ≥50% source-locked |
| Native app | Year 1–2 | spike decision months 6–12 + PWA retention |
| Story/Insights full (10.7/10.15) | EU phase | high guard + enough data |

## 2.3 Do Not Build (permanent default unless specified evidence)

| Do Not Build | Earliest Reconsideration | Required Evidence |
|--------------|--------------------------|-------------------|
| Algorithmic public feed | Year 3 | C2–C4 without incident + measured retention lift + F+ADV decision; even then curated only |
| Public chat / 1:1 DM | never in core | — |
| Public comments | with C5 only | C5 |
| Public individual leaderboards | never (individual form) | only aggregated team progress at C3 |
| Selling / sharing personal data | never | — |
| Employer access to individual behavior | never | — |
| Enterprise direct sales | Year 3+ partnership | inbound traction + B1/B2 validated |
| WAT autonomous (forbidden list: health/legal/money/data-deletion/messaging/deploy/guardrails) | list = permanent; other domains conditional W4 | one zero-error W2/W3 quarter on same workflow |
| Multi-tenancy / Org infra | if B3 becomes real | added partner contract |
| Separate LangGraph / microservice-agent | — | proven need the Orchestrator can't meet |
| Fake AI vision in UI | after real API only | real E10 |
| Scrape copyrighted content | never | — |
| Endless feed on Home | never | — |

---

# PART 3 — FINAL ARCHITECTURE MAP (17 layers)

| # | Layer | Build Now? | Core Models | Core Services | Owner |
|---|-------|-----------|-------------|---------------|-------|
| 1 | Client / PWA / Mobile Shell | ✅ E45 | — | SW, app-shell, EventSource | EL/UX |
| 2 | Backend NestJS Core | ✅ (exists + E2,3,7) | — | guards/filters/pino | EL |
| 3 | Prisma / PostgreSQL | ✅ | 46 models + ChatMessage/UserFact/AICallLog/Subscription | PrismaService | EL |
| 4 | Data Import Layer | ✅ E9,10 | Recipe(+sourceCode), Ingredient | importers + report | EL/CM |
| 5 | Ingredient Resolver | ✅ E11 | RecipeIngredient.ingredientId | IngredientResolverService | EL |
| 6 | Recipe Intelligence | ✅ E12,24 | nutritionSource/Confidence | nutrition policy guard | CM/EL |
| 7 | **BIP** | ✅ E43 base | UserBehaviorProfile + §6.4 profiles | engine/feature-store/quality/enrichment | BA |
| 8 | **AI Core / Orchestrator** | ✅ E47 | UserFact, AICallLog | Orchestrator/Registry/Guards/Eval/Cost | AA |
| 9 | Recommendation Engine | ✅ (exists + E18,19) | RecommendationExposure/Outcomes | pipeline/* | BA/EL |
| 10 | **INE** | ✅ E44 base (in-app) | Notification(+decision-log) | Trigger/Timing/Fatigue/Generator | PS/BA |
| 11 | Engagement & Habit | ✅ E48 base | Achievement, Streak(+freeze) | server-side badge engine | PS/UX |
| 12 | **Community Extension** | C0 docs + visibility hook | CookedPost(C1) | ShareLink, Moderation(C2+) | F/CM |
| 13 | **B2B Data Boundary** | B0: purpose + policy | ConsentLog.purpose, DataExportLog(B1) | aggregate jobs(B1) | ADV/EL |
| 14 | **WAT / Ops Layer** | W0: namespace + spec | WorkflowRun, approvals | Orchestrator with `ops:*` | EL/AA |
| 15 | Compliance/Consent/Audit | ✅ E4,39,40+52 | ConsentLog(+purpose), UserAuditLog, ModerationAction(C2) | erasure tx, export, retention | ADV/EL |
| 16 | Observability/CI-CD | ✅ E6,7,8 | — | Actions, Sentry, pino, gitleaks | EL |
| 17 | Admin / Intelligence Dash | ✅ (exists + E36′,20) | — | beta-kpi, loop-health, ai-cost | F/BA |

---

# PART 4 — CANONICAL EVENT ENVELOPE (schemaVersion: 2)

Single packet for all events from here on. Additive vs. the existing taxonomy (`event-taxonomy.ts`,
100+ eventTypes): eventTypes stay; packet fields are added (additive migration + PII-free policy from
v4§8). No breaking migration required.

| Field | Rule |
|-------|------|
| eventId | UUIDv7 — idempotency key in ingest |
| eventType | from the single taxonomy enum (existing + 30 from v3§6.2), snake_case; adding a type = PR on the enum with BA approval |
| actorType | `user` \| `system` \| `agent` \| `admin` |
| actorId | actor id; for agent = `ops:<workflowId>`, for system = service name |
| subjectType/subjectId | "about whom" — usually user; in community can be a circle; basis of erasure |
| objectType/objectId | target object: recipe/plan/list/notif/post/submission/... |
| context | small JSON: `{meal?, slot?, circleId?, experimentArm?}`; allowed keys documented in docs/events |
| source | `web-pwa` \| `server` \| `cron` \| `ops-workflow` |
| surface | product surface (home/briefing/planner/cook_mode/grocery/chat/onboarding/admin/...) |
| visibility | `private`(default) \| `circle` \| `public` — circle only C1+; public analytics on private-aggregated only |
| consentPurpose | `core` \| `analytics` \| `personalization` \| `b2b_aggregate` \| `community` — must be a subset of the user's active consents or ingest rejects |
| schemaVersion | integer (=2); readers backward-tolerant |
| occurredAt / receivedAt | client time / server time (both additive; detect skew / PWA offline) |
| metadata | free JSON **without PII** (v4§8); for WAT: `{runId, stepId}` |
| privacyClass | `P0-public` \| `P1-pseudonymous`(default) \| `P2-sensitive`(allergy/health-goal) |
| retentionPolicy | `standard-365d`(default) \| `audit-long`(moderation/consent/erasure) \| `ephemeral-30d`(debug) |

**Packet attachments:** BIP reads only the packet; AI Core links each AICallLog to source eventId
(snapshot-hash in metadata, ai_guard_block is its own system event); Recommendation impression/click/save/
dismiss/cooked all packet-based with objectType=recipe; Notification send/open/dismiss + **notif_suppressed**
all packet-based; Community cooked_share/report/moderation carry explicit visibility, ModerationAction is
audit-long (DSA statement-of-reasons); B2B aggregate only consentPurpose→b2b_aggregate & privacyClass≤P1
into the K≥100 line; WAT every step = event actorType=agent + runId, human approval = separate event.
GDPR erasure key = subjectId (full row deletion except audit-long → subjectId tombstoned). Audit-class
events are append-only and outside the 365-day cron.

---

# PART 5 — FINAL EPIC REGISTRY (1–53)

**Status:** Keep / Merge(→target) / Superseded(→replacement) / Delay / Research Track ·
**Type:** B=Build · D=Design-spec · P=Policy/Doc · R=Research ·
**Phase:** W-A/B/C/D (days 0–90) · SBX (months 4–6) · EU (months 9–15) · Y2/Y3+

| ID | Title | Status | Phase | Pri | Owner | Deps | Type | Acceptance (short) |
|----|-------|--------|-------|-----|-------|------|------|--------------------|
| 1 | Secret purge | Keep | W-A | P0 | EL/CA | — | B | gitleaks/trufflehog=0, history clean |
| 2 | Auth sanitize | Keep | W-A | P0 | EL/CA | — | B | no password in responses (e2e) |
| 3 | JWT/RBAC | Keep | W-B | P0 | EL/CA | 1 | B | admin route matrix, deny-by-default |
| 4 | Consent gate + EU analytics | Keep | W-A | P0 | EL/CA | — | B | zero request pre-consent |
| 5 | Repo hygiene | Keep | W-A | P1 | EL/CA | 1 | B | single lockfile, artifacts ignored |
| 6 | CI/CD | Keep | W-B | P0 | EL/CA | 5 | B | green pipeline once |
| 7 | Error/Logging | Keep | W-B | P1 | EL/CA | — | B | error contract + pino redact |
| 8 | Sentry | Keep | W-D | P1 | EL/CA | 6,7 | B | test event both sides |
| 9 | Recipe import 122 | Keep | W-B | P0 | EL/CM | 10 | B | 122/1223 + wrapper:true |
| 10 | Ingredient 1008 | Keep | W-B | P0 | EL/CM | — | B | 1008 + 20/20 alias |
| 11 | Resolver | Keep | W-B | P0 | EL/CA | 9,10 | B | coverage ≥98% |
| 12 | Nutrition gov | Keep | W-C | P0 | CM/EL | 10 | B+P | no number without badge, 200 locked |
| 13–17 | AI grounding/RAG/safety/memory/streaming | **Merge→47** | W-C | P0/P1 | AA | — | B | inside 47 |
| 18 | Rec surfacing | Keep | W-D | P0 | UX/EL | 9 | B | three tiers + reason |
| 19 | Feedback UI | Keep | W-D | P0 | UX/EL | 18 | B | save/dismiss/cooked persisted & effective |
| 20 | Behavior runtime-verify | Keep | SBX | P1 | BA | 6 | B | p95/enrichment report with numbers |
| 21 | Feature-vector usage | **Merge→43** | SBX | P2 | BA | 43 | B | insights card inside BIP |
| 22′ | Food DNA (replaces 5-step) | Keep | W-C/D | P0 | UX/CM/BA | 4,18,29,47 | B+D | completion ≥70%, activation ≥45% |
| 23 | Home=Command Center | Keep (spec=GES5.12) | W-D | P0 | UX/EL | 18,29,44 | B+D | Briefing accept ≥6%, fold-finite |
| 24 | Recipe detail | Keep | W-D | P1 | UX/EL | 9,12 | B | nutrition sections + badge |
| 25 | Chat redesign | Keep (spec=GES5.3) | SBX | P1 | UX | 47 | B+D | second-message engagement |
| 26 | Planner hardening | Keep (spec=GES5.11) | SBX | P1 | EL/UX | 18 | B | plan <60s with autofill |
| 27 | Grocery hardening | Keep (spec=GES5.10) | SBX | P1 | EL | 10,11 | B | smart merge, zero duplicates |
| 28 | Profile/prefs | Keep | SBX | P2 | EL/UX | 39 | B | change effect + privacy tab |
| 29 | Tokens | Keep | W-B | P0 | UX | — | B+D | hex lint green, GES base |
| 30 | Theme | Keep | W-B | P0 | UX | 29 | B | global token theme |
| 31 | Motion | Keep (spec=GES5.4) | W-C | P1 | UX | 29 | B+D | three-tier, reduce-motion |
| 32 | Dark/RTL | Keep | W-C | P1 | UX | 29,30 | B | 8×2 matrix |
| 33 | A11y | Keep | W-D | P1 | UX | 29 | B | axe serious = 0 |
| 34 | Demo | Keep (+GES5.14) | W-D | P0 | Shared | 9,18,22′,23 | B+D | run ×2 error-free |
| 35 | Visa package | Keep (outreach pulled forward A1.2) | Outreach W1–W2 · Package W13–G2 | P0 | F/ADV/CM | 34,36′,40 | P | full RVO checklist + facilitator |
| 36′ | Sandbox instrumentation | Keep (re-scoped to Iran-sandbox) | SBX | P0 | BA/EL | 4,22′ | B | 19-KPI dashboard live |
| 37 | Experiments | Keep | SBX | P1 | PS/EL | 36′ | B | 3 live experiments |
| 38 | Monetization readiness | Keep + **Delay activation** | EU | P1 | EL/F | G2 | B | test-mode full, real EU only |
| 39 | Erasure/Export/Retention | Keep | W-D | P0 | EL/ADV | 4 | B+P | e2e zero-residual + export |
| 40 | AI-Act memo | Keep | W-D | P0 | ADV | 25 | P | memo + live disclosure |
| 41 | i18n EN-first | Keep | W-B→SBX | P0(EU) | EL/CA | 29 | B | full bilingual UI by G2 |
| 42 | GES v1 | Keep (umbrella D) | W→EU | P0 | UX | 29–32 | D(+B in 23–27) | 20 modules spec'd, QA-gate live |
| 43 | BIP v1 | Keep (absorbs 21) | W-C→SBX | P0 | BA | envelope | B | 30 events live, AUC ≥0.70 in SBX |
| 44 | INE v1 | Keep | W-D→SBX | P0 | PS/BA/EL | 43,45 | B | opt-out <2%, open ≥12%, suppressed-log |
| 45 | PWA-OS + Push | Keep | W-B→SBX | P0 | EL | — | B | SW/offline/push, Lighthouse ≥90 |
| 46 | Content universalization EN | Keep | SBX→EU | P0(EU) | CM/F | 12 | B | 150–250 EN recipes with gate |
| 47 | AI Core v1 | Keep (umbrella 13–17) | W-C | P0 | AA/EL | 9,12,43 | B | per **E47 Annex** below |
| 48 | Engagement v1 | Keep | SBX | P1 | PS/UX/EL | 43 | B | streak/12 achievements/mission, anti-dark |
| 49 | Iran sandbox ops | Keep | W-D→SBX | P0 | F/ADV/EL | 4 | P+B | legal opinion + self-host path ready |
| 50 | EU waitlist alpha | Keep | SBX(months 4–6) | P1 | PS/F | 41,46 | B+G | 50 EN users, activation ≥60% |
| 51 | Community C0+C1 | Keep | C0:W-B · C1:EU | P1 | CM/ADV→EL | 39,G2 | P→B | C0 docs; C1 private share + revoke |
| 52 | B2B Governance B0 | Keep | W-B | P1 | ADV/EL | — | P+B | policy + purpose column |
| 53 | WAT W0(+W1 gated) | Keep | W0:W-C · W1:months 6–12 | P2 | EL/AA | 47, time-log | P→B | spec template; W1 ≥8h/week saved |

**Superseded:** Persian-centric ICP/creator (v2§5.1–5.3)→v3§15 · NL beta 100–300 (v2-Phase4)→36′+50 ·
Mobile Year 3–4 (v2-Phase11)→45/14.3. **Research Track:** C2–C6 detail, B1–B3, W2–W4, Family/Health.
No epic is "hard-deleted"; superseded items keep a pointer for historical traceability.

### E47 Annex — AI Core v1: Exact Build Scope & Acceptance (Amendment 1)

**Included (and only these):** 1) one AI Orchestrator service 2) mandatory BehavioralContextSnapshot on
every AI call 3) Tool Registry v1 4) AICallLog 5) Cost Controller v1 6) Safety Guard v1 7) Nutrition
Claim Guard 8) Prompt-Injection Guard v1 9) FactStore v1 10) message persistence (ChatMessage)
11) Streaming for chat only 12) RAG/retrieval only over recipes, ingredients, nutrition-source file
13) tool `search_recipes` 14) tool `explain_recommendation` 15) tool `get_user_food_context`
16) tool `log_ai_feedback` 17) Eval-suite v1 (grounding, allergy, unsafe nutrition, prompt-injection,
Persian recipe, latency, AI feedback).

**Explicitly NOT included (→ Research Track post-G1/G2 or Year 2 unless defined as build elsewhere):**
autonomous meal-planning agent · autonomous grocery agent · autonomous cooking-coach · multi-agent
orchestration · LangGraph · agent supervisor · full voice-assistant · image recognition · medical
diagnosis/treatment · wearable-based health inference · full Qdrant migration if pgvector suffices for
base · any agent performing irreversible actions. (Note: the E26 plan autofill is a **tool with explicit
user confirmation**, not an autonomous agent — allowed.)

**E47 Acceptance:** all AI calls pass through the Orchestrator; every AI call has a
BehavioralContextSnapshot or **fails fast**; ≥4 tools work; AICallLog records model/latency/token+cost/
guard-hits/tool-calls/status; pre-G1 safety eval ≥95% pass with sandbox unsafe-rate <0.1%; streaming for
chat only; AI cannot create/modify a meal plan **without explicit user confirmation**; AI writes **no
health claim** on non-source-locked nutrition data.

---

# PART 6 — 0–180 DAY EXECUTION PLAN

Labels: **[B]** Build · **[D]** Design spec · **[P]** Policy/Doc · **[R]** Research. Acceptance Gate = the "done" condition.

| Week | Focus | Epics | Acceptance Gate |
|------|-------|-------|-----------------|
| W1 | P0 security + start outreach | 1,2,4,5,35-0 | scans=0, e2e no-password, zero pre-consent request, facilitator target-list+top-5, 4 execution files exist; **[P] create docs/execution/* with A1.5 seeds**; Constitution enters repo |
| W2 | eng+data foundations + send outreach | 3,6,7,9,10,35-0,**0-1** | CI green, 122/1008 import, 5 outreach emails sent + tracker live, **E0-1 README aligned to v1.0.1** |
| W3 | data wiring + hooks | 11,41(skeleton),45(base),52,51-C0,53-W0,43(ADR) | coverage ≥98%, install-prompt, migration green, **ADR-0001 merged**, **GES doc exists** |
| W4 | visual language | 29,30,51-C0 | hex lint green, tokens/base/theme exist, **DESIGN_IMPLEMENTATION_GUIDE exists**, C0 docs in repo |
| W5 | GES base | 42(5.1/5.2/5.13),31,12(start) | storybook 3-state, no number without badge, **motion.js + QA checklist + migration map exist**, **no new UI task without design-doc reference** |
| W6 | core contracts | 47(core),43(envelope) | Snapshot <50ms, ingest rejects invalid packet, PII in metadata rejected/flagged, **event-envelope.schema.ts** + ≥8 event tests |
| W7 | core safety + retrieval | 47(15,14 start),12 | 15/15 allergy, recall eval baseline |
| W8 | live chat | 47(13,16,17) | 20 scenarios pass, TTFT <1.5s, behind AI_V2 flag |
| W9 | Food DNA build | 22′ | full e2e, median ≤3:30 in internal test |
| W10 | matte surfaces 1 | 23,18,19 | fold-finite, dismiss→no repeat |
| W11 | matte surfaces 2 | GES5.9,44(base) | full cook-mode no error, notif policy tested |
| W12 | G1 hardening | 8,33,39 | test event, axe serious=0, e2e erasure green |
| W13 | close G1 | 34,40,49,35 | **G1 PASS** per v3§14.0; **Formalize visa package using outreach feedback** |
| W14 | sandbox start | 49,36′ | live dashboard, 50 active |
| W15 | first feedback loop | 36′,20 | numeric report in repo |
| W16 | ramp + i18n | 41 | 200 active, EN pages render |
| W17 | engagement base | 48 | events in BIP, anti-dark checklist |
| W18 | planner/grocery polish | 26,27 | plan <60s, zero duplicate items |
| W19 | push + story-base | 44(push),45 | web push both platforms, open-rate tool live |
| W20 | experiments | 37 | ~50/50 split, weekly report |
| W21 | chat/profile polish | 25,28 | structured chat + disclosure, privacy tab |
| W22 | EN content start | 46 | 50 EN recipes pass gate |
| W23 | EN alpha | 50 | 50 waitlist invited, activation ≥60% |
| W24 | final ramp | 36′ | 500–1000, churn-model v1 AUC report (≥0.70) |
| W25 | WAT-W1 (conditional) | 53 | documented savings or explicit deferral |
| W26 | close G2 | 35,36′ | **G2 PASS/FAIL** + visa package + EU decision |

**Standing outputs:** weekly 50 nutrition-source/recipe (12) [CM] · remaining GES specs per §5 v3 [UX] ·
weekly KPI meeting [F] · **W3–W6 facilitator follow-up/discovery calls → notes/requirements/objections/
requested-docs in docs/visa/ [F/ADV]** · **Friday Gate Review mini-check (A1.1 r7)** · **Sunday next-week
tickets + WEEKLY_EXECUTION_REVIEW (A1.1 r8)**.

---

# PART 7 — YEAR 1 ROADMAP (summary)

Year-1 focus: security → import → Food DNA → GES-base → AI Core v1 → BIP v1 → INE v1 → PWA-grade →
Iran technical beta → EU waitlist alpha · **no public community** · **B2B = governance only** ·
**WAT = W0 only (W1 conditional)**.

| Quarter | Highlights | Success Gate |
|---------|-----------|--------------|
| Q1 (W1–13) | Food DNA, Home/Briefing, CookMode-MVP, Detail; Waves A–D, CI/Sentry, PWA base, full import; AI Core v1 (E47 Annex scope), BIP envelope+30 events; GES 5.1/5.2/5.13 | **G1**: scans=0, 122/1008 live, DNA e2e, Briefing live, erasure-test green, safety eval pass |
| Q2 (W14–26) | Engagement v1, Planner/Grocery polish, Chat/Profile v3; push, experiments, self-host fallback; churn AUC, 50 EN recipes; sandbox 50–1000, EN alpha 50 | **G2**: 19 KPIs per v3§14.1 (D7 ≥20%, unsafe <0.1%, crash-free ≥99.5%, AUC ≥0.70 …) + visa package |
| Q3 (months 7–9) | EU-prep: full i18n, story base, EN onboarding tuning; AI cost optimization; eval bilingual | waitlist ≥N (F target), EN alpha D7 ≥15% |
| Q4 (months 10–12) | **EU Universal Launch**, C1 private share; light oncall; two-market personalization; v3§15.3 launch plan | G3: D7-EU ≥18%, activation ≥60%, C1-share ≥15% MAU |

---

# PART 8 — YEAR 2 ROADMAP (gated)

| Track | Entry Gate | Year-2 Scope | Kill/Revert |
|-------|-----------|--------------|-------------|
| EU retention→PMF | G3 pass | three-tier features, real monetization (€5.99/€7.99 test) | conversion <1.5% → redesign value |
| Community C1→C2 | D30 ≥12% stable 2mo + share-demand ≥10% | Circles ≤25 + Report/Block/Mute + ModerationAction | harassment >1%/mo → freeze |
| Community C3 | C2 healthy + team-challenge KPI | opt-in team challenges, aggregate progress | NPS drop → redesign |
| Community C4 (recipe UGC) | 15-gate Safety tested + SLA ≤72h + DSA review | submission→AI pre-screen→human review→publish, 100-recipe target | backlog >2mo or incident → pause |
| Creator/Expert (C6) Research→Pilot | ≥10 inbound + contract/verification ready | 2–5 creator pilot | claim violation → suspend |
| B2B B1 | G3 + 2 real LOI + K≥100 + DPIA template | 2 design-partner aggregate reports (€5–15K/yr assumption) | no validation → Research |
| WAT W1→W2 | W1 time-log; W2 two domains ≥8h/week, error <5% | W2 single-domain (EN content) with eval-gate | metric loss → revert W1 |
| Native app decision | spike done; push/native quality/PWA retention | written F decision; if go: native CookMode/Briefing | PWA sufficient → defer |
| Family (start design) | EU waitlist ≥8% + stable revenue | design + schema activation; build end-Year-2 if gate | <8% → shelve |
| Compliance | — | annual DSA transparency (with C2+), 6-monthly AI-Act memo review | — |

---

# PART 9 — YEAR 3–5 ROADMAP

| Year | Highlights | Entry | Exit Metrics | Kill |
|------|-----------|-------|--------------|------|
| Y3 | Health-Safe Wellness (gated), full Family if gate, native growth; full Coach, taste-evolution; C4 mature, C6 formal, **C5 only by F+ADV decision (default no)**; B2 Insights-API if B1 validated; W2 stable, W3 scheduler human-gated | DPIA Health, Art.9 controls | Health no-incident, MRR target, flat retention curves | serious Health legal signal → wellness-only; B2 churn >50% → stop |
| Y4 | Food Intelligence Graph internal→B2B; bounded creator tools; graph query-able; multi-quarter cost optimization; C5 only if Y3 gate; B3 partnership if inbound; W4 narrow-autonomy (reversible domains); periodic AI red-team | Y3 exits | 2 B2B pilots validated, non-core revenue share <30% | no B2B buyer → internal graph only |
| Y5 | Category leadership: reference AI-Food-OS brand in EU, language expansion (Arabic/Turkish) on same playbook; multi-dimensional personalization on the moat; mature creator ecosystem; multi-year contracts; mature human-on-the-loop ops | Y4 exits | measured growth | unrelated-market sprawl → forbidden |

---

# PART 10 — RESPONSIBILITY MATRIX

## 10.1 Roles

| Role | Can Decide | Can Implement | Must Not Decide | Approval Required For |
|------|-----------|----------------|-----------------|------------------------|
| Founder (F) | vision/positioning/market, go-no-go gates, final brand, ask/final vision, accepting legal risk | — (hands-on only with EL) | day-to-day spec detail | every irreversible: history-purge(1), erasure(39), visa send(35), C5, B3, W4 |
| Product Strategist (PS) | in-phase priority, per-feature metric, MVP/v2 surface scope, notif policy, experiment design | — | changing Part 2 gates | gate change → F |
| UX/UI Designer (UX) | all GES, Design-QA gate, surface spec, visual/interaction language | prototype | data/AI policy | new brand release → F |
| AI Architect (AA) | §7 architecture, AI safety policy, model/cost choice, eval thresholds | prompt/Guard | surfaces, market | deny-list/Guard change → F+ADV |
| Data/Behavior Architect (BA) | all §6: event/signal/profile/prediction, data quality, analytic retention, K-anonymity | query/model | individual comparison display | envelope schemaVersion change → EL+F |
| Engineering Lead (EL) | code/DB architecture, security standard, CI/CD, performance budget, build-vs-buy | all | product scope | new security dependency → F informed |
| Content Manager (CM) | voice & tone, content/source quality, publish gate, C0/C4 content policy | content production | health/legal claims | any safety-borderline text → ADV |
| Legal/Compliance Advisor (ADV) | GDPR/AI-Act/DSA/nutrition-medical boundary, sandbox/visa requirements | documents | product/tech | — (is itself the gate) |
| Coding Assistant (CA) | **nothing** | implementation/refactor/tests/docs/migrations/codegen per added spec | vision/strategy/UX-vision/positioning/AI-policy/scope | start any epic → added A-role spec; any irreversible → explicit human approval |

## 10.2 RACI (epics 1–53)
Columns F·PS·UX·AA·BA·EL·CM·ADV·CA — R=responsible A=accountable C=consulted I=informed · "·"=I default.
(Base: v3§12.2 + v4 deltas; this table is the canonical replacement.) `R*` = CA executes only after
explicit human approval (irreversible). Key accountabilities: 13–17→47 = AA(A); 22′ = F/PS(A); 23 = UX(A/R);
36′ = F(A); 42 = UX(A/R); 43 = BA(A/R); 44 = PS(A); 47 = AA(A/R); 48 = PS(A); 49 = F(A); 51 = F(A), CM R(C0);
52 = F(A), ADV R; 53 = EL(A). Epics 1 and 39 carry `R*` on CA.

---

# PART 11 — IMPLEMENTATION ASSISTANT HANDOFF FORMAT

The Founder fills this template per epic/sub-task (most fields copied from Part 5/6 + source volumes).
The CA does not start without an added template; any deviation from spec = blocker, not a decision.

```markdown
# Implementation Task — [Task ID: E<id>-<slug>-<n>]
## Context            (2–3 lines: where in the product / why now; link to Constitution section)
## Source Decision    (reference to the frozen decision: Part1 row / Part2 table)
## Goal               (one testable sentence)
## Non-goals          (explicit: what is NOT built — from Part 2.3 / §10 "do-not")
## Files to inspect
## Files to modify
## Data / schema changes   (precise migration; nullable/additive; rollback migration)
## API changes            (endpoint/DTO/error contract per E7)
## UI changes             (components; GES-module reference; 3-state library)
## Events to emit         (eventType + non-default envelope fields)
## Privacy / compliance controls   (consent guard; PII-free metadata; disclosure?; E4/39/40/52)
## Tests required         (unit/integration/e2e + safety eval if AI)
## Acceptance criteria    (copy from Part 5 + task-specific, measurable)
## Rollback plan          (flag / migration-down / purge-script)
## Human approval required?   (yes/no + who; for E1/E39/W4-class: always yes)
## Do-not-cross boundaries    (relevant deny-list)
```

---

# PART 12 — FINAL BRUTAL VERDICT

1. **Is this the single execution source of truth?** Yes. Conflicts resolved by v4>v3>v2; every epic
   assigned; v1–v4 volumes are now evidence appendices. This document is authoritative on any conflict.
2. **Do we still need a new strategy prompt?** No — not until the gates. Only three triggers reopen
   strategy: G2 fail/result (EU decision), Year-2 gate results (C2/B1/W1), or an external shock
   (legal/market). Anything else = procrastination disguised as work.
3. **What is only knowable by executing?** Real 19-KPI sandbox numbers (esp. D7/D30, unsafe-rate, AUC),
   Briefing accept & DNA-completion outside internal test, C1 share demand, two real LOIs for B1, real
   W1 savings, RN/native decision, real per-user AI cost, and transferability of Persian evidence to EN.
4. **Biggest failure risk?** Spreading thin: a 3-person team against a foundational platform with 5
   surfaces + 3 future pillars. The antidote is inside this document (gates, Part 2.3, RACI, "no next
   Wave before the previous is green"). Second risk: visa dependency on a facilitator (mitigation:
   start outreach early per A1.2).
5. **Three priorities tomorrow morning:** (a) E1: revoke Gemini key + new JWT + start filter-repo.
   (b) E2+E4: remove leaked password + add consent/EU for PostHog. (c) E35-early: facilitator target
   list (10 + top-5) + draft outreach email (send W2) — longest external lead-time.
6. **What kills the project if built?** Live public feed/chat (one ED or DSA incident is enough), selling
   personal data or employer access (trust death), autonomous WAT in forbidden domains, monetization in
   the Iran sandbox (no legal/revenue framework). All in Part 2.3.
7. **What weakens it if NOT built?** AI Core with mandatory Snapshot (without it "AI Food OS" is a claim),
   Food DNA (without it activation is a story), full data import (without it the demo is empty), i18n+EN
   content (without it "universal" is a word), and the 19-KPI dashboard (without it no gate is meaningful).
8. **Can Garnish become a serious Food Intelligence Platform in 5 years?** Conditionally yes: the
   technical path and assets (recsys/BIP-base/data-playbook) are real and the ordering is right — but
   "serious" depends on passing G2 with real numbers, EU retention (G3), and securing funding/relocation
   in time. With those, yes; without them, no roadmap helps.
9. **The real condition of success?** Gate discipline + one full "build-measure-fix" loop per quarter:
   each quarter closes ≥1 gate on real numbers and no feature outside Part 5 enters a sprint.

---

# APPENDIX A — WEEK 1 IMPLEMENTATION TICKETS (per Part 11)

> The full per-ticket detail is captured in the Founder's source and the in-repo tickets. Summary:

- **E1-1 — Secret Rotation & Git History Purge Preparation.** Goal: no valid secret in repo/history;
  service runs on new keys. Steps: revoke Gemini + new JWT (`openssl rand -base64 64`),
  `git rm --cached apps/server/.env`, prepare (not run) `git filter-repo --invert-paths --path
  apps/server/.env`, full `git bundle` backup, gitleaks pre-commit. **Human approval required** for
  force-push/history-rewrite (Founder). Do-not-cross: printing secrets, filter-repo without backup/approval.
  *(Implementation runbook: `docs/security/E1_secret_purge_runbook.md`.)*
- **E2-1 — Auth Response Sanitization.** No sensitive field (password/hash) in any auth/users response;
  add `sanitizeUser`. Reversible, no approval.
- **E4-1 — PostHog Consent Gate & EU Host.** Zero analytics before explicit consent; EU host; key from
  env; default unticked. Reversible, no approval.
- **E5-1 — Repo Hygiene / PNPM Only.** Single lockfile, no tracked artifacts, dev scripts to `scripts/dev/`,
  CONTRIBUTING "pnpm only". Reversible.
- **E3-0 — RBAC Audit Preparation (audit only).** Produce `docs/security/RBAC_ROUTE_MATRIX.md`; **no code
  change** except obvious low-risk fixes flagged in PR. Precedes E3 (W2).
- **E35-0 — Facilitator Outreach Preparation.** `docs/visa/facilitator_target_list.md` (10 + top-5) and
  `docs/visa/facilitator_outreach_email_v1.md` (≤200-word EN). Iran = sandbox only; no traction claims.
  **Send (W2) only after Founder approval.**
- **E0-1 — README Alignment with Constitution (W2).** Precise, developer-facing README per A1.8.7; tri-state
  status (Implemented / In execution + Epic ID / Delayed + gate); `.env` warning; CA boundaries. Founder
  approves final text.

---

# FILE CLOSING RULE

**This Constitution v1.0.1 is closed for execution.**

No further strategic Amendment is permitted until one of these five events:
1. Pass/Fail review of gate **G1**.
2. Pass/Fail review of gate **G2**.
3. Legal/compliance shock (law change / official notice).
4. A major blocker invalidating a core assumption of the document.
5. An investor/facilitator requirement (Founder-approved) that conflicts with the document.

Anything else = an **Implementation Ticket** (Part 11 template), not a strategy rewrite. Requests outside
these five triggers must be rejected and logged in DECISION_LOG.

---

# CHANGELOG — v1.0 → v1.0.1 (Amendment 1)

| Change | Section | Why |
|--------|---------|-----|
| Added AMENDMENT 1 (High-Intensity Mode + 8 Execution Discipline rules) | before Part 1 (A1.1) | execution soul: control = Acceptance Gate, not reduced workload |
| Pulled facilitator outreach to W1/W2 + W3–W6 follow-ups + reworded W13 to "Formalize visa package using outreach feedback" | Part 6, A1.2 | resolve Part 6/Part 12 conflict; cut external lead-time without moving the formal package |
| Updated "three priorities" (priority 3 = E35-early) | Part 12 §5 | align with A1.2 |
| Added "E47 Annex — Exact Build Scope" (17 included + NOT list) and hardened E47 Acceptance | Part 5, Part 6 W6–W8, Part 7 Q1, A1.3 | prevent agent-fantasy/overbuild without reducing ambition |
| Added ADR-0001 (W3) + event-envelope.schema.ts (W6) + additive migration rule (no break before W13) | A1.4, Part 6 W3/W6 | turn Part 4 from design into testable, implementable contract |
| Added 4 execution files (RISK_REGISTER 15 seeds, DECISION_LOG 10 seeds, GATE_REVIEW_TEMPLATE, WEEKLY_EXECUTION_REVIEW) | A1.5, Part 6 W1 | execution memory + Friday/Sunday rituals |
| Added APPENDIX A: six real Week-1 tickets | APPENDIX A | remove the gap between document and first commit |
| Added File Closing Rule (five triggers) + closed the document | end of file, A1.7 | end the strategy-prompt cycle until G1/G2 |
| Added A1.8 — Design Implementation Pack + README alignment (E0-1) | A1.8, Part 6 W2–W5, APPENDIX A | turn GES from spec into implementable material; fix README drift — no new strategy/feature |

---
**END OF CONSTITUTION — v1.0.1 (closed for execution)** · Future changes only via Gate Review or one of
the five triggers above, with Founder sign-off recorded in this Changelog.
