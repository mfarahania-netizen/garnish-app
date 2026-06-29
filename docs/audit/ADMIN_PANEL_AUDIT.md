# Admin Panel — agentic audit (2026-06-29)

Source: `admin-panel-audit` workflow (24 line-by-line lens agents, FE+BE per tab + a panel critic). Overall score **6/10**. The per-unit collection had an orchestration bug (parallel-thunk) — fixed for the re-review pass — but every lens agent ran and produced findings (top finding of each captured below). This is the fix checklist; the loop runs find→fix→re-review until excellent.

## ✅ PROGRESS — batch 1 (done + verified)
- **Group 1 (BE):** 3 ranked lists (topViewed/topFavorited/topPlanned) now actually ranked (re-sort by count after findMany); «کل کاربران» split into registered(12)/guest(536) — honest. Verified: 0 compile errors + endpoints return correct order/breakdown.
- **Group 3 (FE):** «پخت‌ها»→«رویداد» (it counted ALL events, not cooks); TicketsTab search debounce (was firing a query per keystroke). Verified: admin smoke 3/3.
- **Group 5 decision (expert call):** Workflows/Automation tab RE-ADDED to nav (tight: see/run/ack the 6 real guards). AdminAi stays out (was the redundant/mocked one). Verified: smoke 3/3 + grep clean.

## ✅ PROGRESS — batch 2 (P0-3 start, done + verified)
- Added `ErrorState` primitive to `_ui.jsx` (a 4th state: real / awaiting / **error** / ok). OverviewTab now: (a) renders a real "بارگذاری نشد" when the core ops feeds fail (was: ignored `error`), and (b) NO LONGER shows the green "همه‌چیز سالم" card when the alerts-fetch itself failed (was: fake-green on a dead backend — the launch-night catastrophe). **P0-3 now COMPLETE** — first-class Error state (≠ awaiting ≠ ok) on ALL 5 tabs (Overview + Behavior + AiCost + Users + Tickets): a failed fetch reads «بارگذاری نشد» (red) + retry, never fake-green or fake-awaiting. Verified: **full Vite build clean — 8080 modules.**

## ✅ PROGRESS — batch 3 (P0-2 done + verified)
- **P0-2 Attention Queue COMPLETE.** BE (commit ac3e569c): WorkflowAlert resolve+snooze endpoints + snoozedUntil/resolvedAt columns + snooze auto-re-surfaces. FE: `app/admin/AttentionQueue.jsx` merges open workflow alerts (already covering safety/cost/reliability guards) + unanswered tickets into ONE severity-then-time list with inline Ack / Snooze-1h / Resolve + ticket deep-link; wired into OverviewTab (replaced the fragmented attention feed); calm honest empty state ("۰ پرچم", never padded). Verified: lifecycle smoke (snooze→excluded-from-open→resolve) + Vite build clean (8081 modules).

## 🎯 MISSION-CONTROL TARGET (blueprint workflow `wf_7a53a52e`, internet-grounded) — the "finish" plan
Score vs the mission-control bar: **4/10** (the 6/10 audit was "good admin panel"; this is the higher "watch+operate from one panel" bar). Vision: ONE grayscale big-board where a healthy app shows almost no color and the first anomaly is the only thing that lights up — "all-OK, or here's what's wrong + what to do" in <5s, honest at ~0 users by construction.

**ALREADY GOOD — do NOT rebuild:** the honesty/no-data architecture (`_ui.jsx` real|awaiting self-labelling — the hardest part, met); the WorkflowAlert alarm spine (schema already has open|ack|snoozed|resolved + value/threshold/severity); ~24 operator-action endpoints in admin.controller; inline "what it means" notes; deterministic guard evidence; RTL nav + recharts + auth.

**P0 (must-have to make "sit, watch & operate from ONE panel" real):**
- P0-1 [L] ONE **Mission Control / Pulse landing** above the tabs: ≤9-tile pulse strip (system state · AI-chat health incl. implicit errors · allergy/safety leaks=0 · AI cost vs cap · traffic · error rate · weekly-active-cookers · open criticals · event-pipeline health) + AI-Brief slot + the Attention Queue, as default route.
- P0-2 [M] **ONE Attention Queue** = merge the 4 fragmented feeds (workflow alerts + guard trips + AI-cost breach + critical tickets), severity-then-time, with **ack/resolve/snooze** (add the missing resolve+snooze endpoints; DB lifecycle already exists).
- P0-3 [S] **Kill "error masquerades as healthy"** — first-class Error state ≠ Awaiting ≠ OK across Overview/Behavior/AiCost/Users (= audit GROUP-2). Launch-night a dead backend must NOT read "all healthy".
- P0-4 [M] **SSE transport + freshness pill/heartbeat** replacing the 5s/15s pollers (one multiplexed @Sse for pulse+queue+now-feed).
- P0-5 [M] **Grayscale-calm baseline** — healthy=neutral gray, amber/red ONLY on deviation, + explicit 4th "No-data" state.

**P1:** collapse 12 tabs → 6 sections (PULSE / BEHAVIOR&CONTENT / AI / PEOPLE[users+tickets] / AUTOMATION&SAFETY / ENGINES&REVENUE); AI Brief (deterministic-Findings-first); pair tech metric + business metric per row + bands/sparklines; **n-count honesty gate** (suppress p95/rates below ~30 records = folds in audit GROUP-1 fake-metric fixes incl. the never-emitted events); AI trace-first.
**P2:** Cmd-K command palette (executes levers); phone-push escalation + ISA-18.2 flood control; recordAudit before→after deltas + audit-trail viewer (Art.30); deeper steer levers (recipe boost/suppress, model force/cool, AI-suggested ticket reply); cohort-stamp-from-launch + UGC moderation UI.

**MERGE:** audit GROUP-2 (errors) = P0-3; audit GROUP-1 (fake metrics) = P1 n-count gate. **Build order (expert call): P0-3 → P0-2 → P0-1 → P0-5 → P0-4 → P1.** Re-run the audit workflow after each pass to verify.

---

## GROUP 1 — FAKE / DEAD / MISLEADING METRICS (founder rule #1: never fake) — HIGHEST PRIORITY
- [ ] **Cook funnel «شروع پخت»** — `start_cooking_click` is NEVER emitted → always 0, shown as a real drop-off. (analytics-intelligence.service getFunnels ~L46,54-58) → add emitter OR remove the stage + relabel.
- [ ] **«برنامه‌های ساخته‌شده» KPI** — `mealplan_generate` never emitted → permanently-dead. (admin.service getMealPlanningStats ~L277 → ContentTab L31) → emit it OR gate honestly as awaiting.
- [ ] **«پخت‌ها» in user dossier** — counts ALL events, not cooks (`_count.events` mislabeled). (admin-users.service L52,91 → UsersTab L199) → relabel «رویداد» or count only cook_complete. [MY CODE]
- [ ] **Ranked lists «پربازدید/پرعلاقه/پربرنامه»** — Prisma findMany discards the count order → NOT actually ranked. (admin.service getRecipeStats L359-383, getMealPlanningStats) → re-sort by count after fetch.
- [ ] **Live $ cost** — structurally always null → the «هزینه» half can never show a real number. (ops-intelligence getEconomics L146-168, getAiObservability L214-244; root: ai-cost-rate-catalog) → wire deepseek/gemini rates OR label the half clearly as "rates pending".
- [ ] **Pulse «کل کاربران»** — counts admins+guests as registered (no isAdmin/isGuest filter). (admin.service getUserStats, getDashboardStats L120-126) → filter or relabel.
- [ ] **content-gaps topQueries/distinctQueries** — permanently empty (search_unmet stores no query text, GDPR shape-only). (admin.service getContentGaps L58-81) → remove the dead field OR store a hashed/category signal.
- [ ] **Onboarding funnel stages** — wired to never-emitted events; docstring falsely says "EMITTED". (analytics-intelligence L43-46,104,113,160) → fix docstring + gate honestly.

## GROUP 2 — ERROR masquerades as "awaiting/healthy" (honesty contract)
- [ ] **Overview** — backend failure renders a green "all healthy" dashboard; `error` computed but tab destructures only `{d,loading}`. (OverviewTab L29; useAdmin L46-47)
- [ ] **Behavior / AiCost / Users** — no `isError` branch → a failed fetch shows as empty/awaiting/infinite-spinner, indistinguishable from honestly-empty. (BehaviorTab L27-30; AiCostTab L18-26; UsersTab L87-89) [Users = MY CODE]
- [ ] Make error a first-class state across ALL tabs (distinct from awaiting). QueryClient has no retry/error defaults (App.jsx L39).

## GROUP 3 — regressions in my new code
- [ ] **TicketsTab search** — no debounce; every keystroke fires a query (regression vs UsersTab's 400ms). (TicketsTab L60-67)
- [ ] **Users/Tickets** — no error states (see Group 2).
- [ ] **Admin ticket reply/note endpoints** — bypass DTO validation, no length cap on stored staff content. (admin.controller L54,66; admin-tickets.service L62,103) → add a DTO with MaxLength.

## GROUP 4 — design / completeness
- [ ] **Safety** — block-reason codes render as raw English snake_case on the RTL Persian tab. (SafetyTab L43-44) → map to Persian labels.
- [ ] **Realtime** — too sparse (2 KPI rows + flat list) for a "live" command surface; no trend/breakdown/act-on-it. Also dead `admin_view→'بازدیدِ ادمین'` mapping (backend now excludes admin_*).
- [ ] **Retention** — per-user behavior profiles are fetched then dropped (most actionable data never renders). (RetentionTab L23,42)
- [ ] **Safety/ops reads** — NOT audit-logged (Art.30 gap; every other admin read calls recordAudit). (admin.controller L230-241)

## GROUP 5 — strategic (critic) — DECISIONS + missing surfaces
- [ ] **DECISION — orphaned tabs:** `AutomationTab.jsx` (workflow guards UI, wired to /admin/workflows) + `AdminAiTab.jsx` (/admin/ai/insights) are built+wired but NOT in the nav (I removed them in the "tight panel" reframe). REC: re-add a tight **Workflows** tab (see/run/ack the 6 real guards); leave AdminAi out (was the redundant/mocked one).
- [ ] **UGC moderation** — backend has GET /admin/recipes + approve/reject, but no UI + publish-gate says pending UGC must be reviewed. (Low urgency: no real UGC flow live yet — but a launch blocker once UGC exists.)
- [ ] **Command inbox** — 4 overlapping action-feeds (Overview alerts, Behavior improve, AdminAi findings, Automation flags) → consolidate into ONE canonical "what's wrong + what to do" landing.
- [ ] **GDPR/compliance ops** — DataAccessLog/ErasureEvent/consent captured server-side but only 4 read-only KPIs in Safety → add an audit-trail viewer + erasure queue.
- [ ] **Cross-cutting** — shallow export (raw react-query cache dump, no CSV); inconsistent date-range (only overview/engagement ranged; AiCost fixed 30d); polling-only realtime (no SSE); tables overflow-x only (no mobile card view); no command-palette; single isAdmin role (no tiers).
- [ ] **Reality** — ~60-70% of tiles are honest `awaiting_pilot` (no real users yet); present-day operable value = AI cost/latency + safety guards + catalog audit. The honesty architecture is the right call; the operable parts (automation, moderation, compliance) are the ones not yet wired into nav.

## FIX ORDER (founder's values)
1. Group 1 (kill fake metrics) → 2. Group 2 (honest errors) → 3. Group 3 (my regressions) → 4. Group 4 (design) → 5. Group 5 (decisions + surfaces). Re-run the fixed audit workflow after each pass to verify + catch the rest, until score → excellent. Founder verifies at the end.
