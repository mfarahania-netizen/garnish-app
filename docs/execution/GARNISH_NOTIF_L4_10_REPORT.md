# GARNISH-NOTIF-L4-10 — Notification Intelligence Engine (INE): L0.5 → L4 (DRY-RUN)

**Track:** 2 opener · **Branch:** `exec/garnish-notif-l4-10` · **Baseline:** master `bb0c2a99`
**Mode:** BACKEND maturity, **DRY-RUN only** — the engine decides + records; it never dispatches.

---

## Mission outcome

The notification system was three blind fixed crons (10am-for-everyone, every-30-min, Mon-9am) with zero
intelligence. It is now a mature, staged, **pure + explainable Notification Intelligence Engine (INE)** that
decides **what / to whom / when / why** — relevant, well-timed, fatigue-aware, consent-respecting. The 3 crons
now route their decision logic through the INE in **dry-run**: they evaluate and record an explainable decision
per candidate and **dispatch nothing** unless a default-OFF real-send flag is enabled. No push/email provider,
no device-token model, no live broadcast.

---

## The staged pipeline (A–H)

All stages are pure, deterministic, and individually spec'd.

| Stage | Where | What it does |
|---|---|---|
| **A. Trigger registry** | `ine/notification-triggers.ts` | Typed catalog of 6 triggers (`shopping_unchecked`, `meal_time_nudge`, `weekly_plan_gap`, `saved_not_cooked`, `discovery_similar`, `churn_reengagement`). Each carries priority, the **consent purpose** it requires, a weekly frequency cap, and a **templated, non-medical** content template. A registry guard rejects any content containing medical/diagnostic terms (EN + FA). |
| **B. User-state resolver** | `ine/ine.service.ts` `resolveState()` | Reuses **`getLivingUserProfile`** (notification open-affinity dimension) + **`getConsentState`**; adds live counters from the in-app `Notification` table (sent-last-24h, recent-ignored, sent-this-week-by-trigger). Cold-start defaults; no parallel profile. |
| **C. Relevance scorer** | `ine/ine-pipeline.ts` `scoreRelevance()` | `priority/10` weighted by open-affinity, penalized by fatigue; below `RELEVANCE_FLOOR (0.3)` → suppress. |
| **D. Timing-fit** | `ine/ine-pipeline.ts` `fitTiming()` / `inQuietHours()` | Best send hour = next active, non-quiet hour. **Never sends in quiet hours** (midnight-wrapping aware); a future window → defer. |
| **E. Fatigue & suppression gate** | `ine/ine-pipeline.ts` `decide()` | Hard caps: daily cap, recent-dismissal fatigue, per-trigger weekly cap → suppress. |
| **F. Consent gate** | `ine/ine-pipeline.ts` `decide()` | Hard gate on consent purpose (`core` always granted; `personalization` triggers require granted consent). Consent-blocked decisions compose **no content**. |
| **G. Decision + dry-run ledger** | `ine/ine.service.ts` | Each decision = `{send\|suppress\|defer}` + send-window + which gates fired + WHY (reasons[]) + `dryRun:true`, recorded in a queryable in-memory ledger. **Real-send path gated behind default-OFF `INE_REAL_SEND_ENABLED`.** |
| **H. Dry-run simulator** | `ine/ine-simulator.ts` | Runs the engine over personas → would-send / suppressed / deferred by trigger, with reasons, and the invariant `realSends: 0`. |

**Cron refactor** (`notification-scheduler.service.ts`): each of the 3 crons resolves its candidates (the live
condition it already queried), calls `ine.decideForUser(...)` to record an explainable dry-run decision, and
calls the existing in-app notify path **only if** `ine.realSendEnabled() && decision === 'send'`. With the flag
OFF (default), the crons record decisions and dispatch nothing. The churn cron — previously an unconditional
blast — is now consent-gated by the engine.

**Thin wiring (functional only):** owner-only `GET /notifications/ine/preview` (jwt) returns the dry-run
decisions for the caller; `IneNotificationPreview.jsx` renders them on the notifications page (send/defer/
suppress + first reason). Registered in coverage as `frontend:notifications/NotificationsPage`.

---

## DRY-RUN / no-real-send proof

- **No push/email send.** The engine only decides + records. The single real-send path is creating an in-app
  `Notification`, and it is reached only when `INE_REAL_SEND_ENABLED === 'true'` (default OFF).
- **Default-OFF flag:** `INE_REAL_SEND_FLAG = 'INE_REAL_SEND_ENABLED'`; `realSendEnabled()` returns `true` only
  for the literal string `'true'`. Specs assert default-OFF and that `notification.create` is never called.
- **No push provider / dependency added** — `package.json` diff = none; `pnpm install --frozen-lockfile`
  succeeded (lockfile unchanged).
- **No `PushSubscription` / `DeviceToken` / `PushToken` model** — `schema.prisma` unchanged (no migration).

## Hard gates (enforced + tested)

- **Consent** — personalization trigger without consent → `suppress`, no content. (`ine-pipeline.spec`,
  `ine.service.spec`, `ine-qa-gate.spec`.)
- **Quiet hours** — never sends during inferred quiet hours; defers to the next active window.
- **Fatigue** — daily cap, recent dismissals, and per-trigger weekly cap all suppress.

## Reuse proof (no parallel profile/engine)

`IneService.resolveState` calls `ProfileReadService.getLivingUserProfile(userId)` and `getConsentState(userId)`
— asserted by `ine.service.spec` (`toHaveBeenCalledWith('u1')`). No new profile/identity store was created.
Recommendation `runtime-shadow/**` is untouched.

## Simulator results (dry-run, zero real sends)

7 personas → 9 decisions: **would-send = 2, suppressed = 5, deferred = 2, realSends = 0.**

| Trigger | send | suppress | defer |
|---|---|---|---|
| `meal_time_nudge` | 1 | 0 | 2 |
| `shopping_unchecked` | 1 | 1 | 0 |
| `discovery_similar` | 0 | 2 | 0 |
| `churn_reengagement` | 0 | 1 | 0 |
| `weekly_plan_gap` | 0 | 1 | 0 |

Reason tally: `relevant`×2, `no consent for "personalization"`×2, `quiet hours now`×1, `daily cap reached`×1,
`recent dismissals`×1, `best window ~12:00`×1, `low relevance`×1. QA gate: **10/10 checks pass, 0 failed**
(artifact: `docs/qa/notifications/garnish_notif_l4_10_ine_dry_run_results.json`).

---

## PHASE 2 — Isolated worktree clean-install (verbatim)

```
$ git worktree add --detach ../garnish-verify exec/garnish-notif-l4-10
Preparing worktree (detached HEAD a04bbe84)
HEAD is now at a04bbe84 feat(NOTIF-L4-10): Notification Intelligence Engine (INE) — DRY-RUN, no real send

$ pnpm install --frozen-lockfile
Done in 28.3s                      # frozen lockfile honored → no dependency changes

$ pnpm --dir apps/server exec prisma generate
✔ Generated Prisma Client (v5.22.0) in 504ms

$ pnpm build
Tasks:    2 successful, 2 total    # server (nest build) + web (vite build) — exit 0

$ pnpm coverage:check
coverage: mapped=66 internal=15 admin=39 deferred=11 must-render=0 | UNMAPPED=0 UNREGISTERED=0 ...
COVERAGE GATE PASSED. (warnings/debt above are non-blocking)

$ pnpm test
server:test: Test Suites: 167 passed, 167 total
server:test: Tests:       1260 passed, 1260 total      # 0 skips (= worktree baseline 1236 + 24 new INE tests)

$ git status --short                 # only docs/qa/** test-run regeneration churn (NOT committed)
$ git diff --name-only master..HEAD  # the committed change = exactly 15 intended files:
apps/server/src/notifications/ine/{notification-triggers,ine-pipeline,ine-pipeline.spec,ine.service,
  ine.service.spec,ine-simulator,ine-qa-gate.spec}.ts
apps/server/src/notifications/{notification-scheduler.service,notifications.controller,notifications.module}.ts
apps/web/src/features/notifications/components/IneNotificationPreview.jsx
apps/web/src/features/notifications/pages/NotificationsPage.jsx
docs/coverage/coverage.generated.json
docs/qa/notifications/garnish_notif_l4_10_ine_dry_run_results.json
tools/coverage/coverage.registry.json

$ git worktree remove ../garnish-verify   # plain remove blocked by test-regen churn → prune + rm -rf + prune
```

**Scope-proof summary:** no push/web-push/FCM/APNs dependency (frozen-lockfile install, `package.json` diff =
none); no `PushSubscription`/`DeviceToken` model (`schema.prisma` unchanged); real-send default-OFF
(`INE_REAL_SEND_ENABLED`); `git diff master..HEAD` shows **no `runtime-shadow/**` change**; reuse of
`getLivingUserProfile` (no parallel profile); coverage green.

---

## REQUIRED VERDICT BLOCK

```
NOTIF_L4_10 RESULT: PASS
Clean install (worktree): build exit 0, coverage:check green, tests Test Suites 167/167, Tests 1260/1260, skips 0
INE pipeline: trigger-registry=ok, state-resolver=ok, relevance=ok, timing-fit=ok, fatigue/suppression=ok, consent=ok, decision+dry-run-ledger=ok, simulator=ok
DRY-RUN proof: NO real push/email send; real-send path default-OFF flag=INE_REAL_SEND_ENABLED; no push provider/dep added; no PushSubscription/DeviceToken model
Hard gates (tests): consent=ok, quiet-hours=ok, fatigue-cap=ok
Boundaries: runtime-shadow=untouched, live-AI=OFF, new-heavy-dep=NONE, newIngredientIDs=0, medical-claims=NONE, migration=none
Reuse-proof: uses getLivingUserProfile (notification/routine dims) + getConsentState; no parallel profile/engine
Simulator results: would-send=2, suppressed=5, deferred=2 (reasons: relevant×2, no-personalization-consent×2, quiet-hours×1, daily-cap×1, recent-dismissals×1, future-window×1, low-relevance×1)
Coverage gate: green (endpoints registered=1: GET /notifications/ine/preview)
Merge/push: exec/garnish-notif-l4-10 → master ff/pushed (commit a04bbe84 + report)
Verdict: NOTIF_L4_10_PASS
```
