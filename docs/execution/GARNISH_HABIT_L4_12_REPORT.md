# GARNISH-HABIT-L4-12 — Daily Briefing + Honest Habit-Loop / Re-engagement (Backend)

**Track:** 2 · Sprint 2.3 (**TRACK 2 CLOSER**) · **Branch:** `exec/garnish-habit-l4-12` · **Baseline:** master `edf70a7d`
**Scope:** BACKEND maturity, reuse-composed, thin functional wiring only (NO visual design). No migration.

---

## Mission outcome

S6 built the notification decision engine (INE); S7 built streaks/achievements. The missing piece was the
**content of the return-visit loop**. This sprint builds the **Daily Briefing** — the once-per-day ritual —
and an **honest habit-loop / re-engagement**, composed ENTIRELY from systems already built. It introduces no
parallel notifier, scheduler, profile, or recommender.

## The briefing (A–E)

| Part | Where | What it reuses / does |
|---|---|---|
| **A. Daily generator** | `briefing/briefing-composer.ts` (pure) + `briefing.service.ts` | One briefing **per day per meal context** (deterministic `dayKey = userId:date:context`). Composes a **for-you pick** (`getLivingUserProfile` + S07 `assessRecipeFit`/`analyzeRecipeIntegrity`; allergen-unsafe picks are never surfaced), one **nudge** (S5 plan gap → shopping unchecked → saved-but-not-cooked), and a **progress** acknowledgement (S7 `getSummary`). Each item carries reason text. It **PROPOSES** — `proposesOnly: true`. |
| **B. Briefing events** | `briefing.constants.ts` + service | `briefing_view / accept / reject / swap` logged via the **existing** `AnalyticsService.trackEvent` → `UserEvent` → signal/profile loop. **Additive with no migration and no `EventType`-enum/contract change** (`UserEvent.type` is a free string; the ingest has no membership gate). |
| **C. Habit-loop / re-engagement** | `briefing.service.ts` `evaluateDelivery` | Inactivity-aware (days since last real event). After a quiet stretch (≥7d) it offers a **kind, no-pressure** re-engagement via the INE trigger — never guilt/shame/FOMO. Frequency-capped by the INE fatigue gate (`reengagement_gentle` maxPerWeek=1). A brand-new user is never treated as "lapsed". |
| **D. INE trigger** | `notifications/ine/notification-triggers.ts` | `daily_briefing` (maxPerWeek 7 = one/day) and `reengagement_gentle` (maxPerWeek 1) registered in the **S6 INE**, both `personalization`-consent. Delivery decisions flow through INE relevance/timing/fatigue/consent gates, **DRY-RUN** — no separate sender. |
| **E. Read API** | `briefing.controller.ts` | Owner-only `GET /briefing/today` + `POST /briefing/feedback` (accept/reject/swap → ingest). Registered `deferred:E-briefing-ui`. |

## Re-engagement honesty gate

`briefing/briefing-qa-gate.spec.ts` — **11/11 checks pass, 0 failed**
(artifact: `docs/qa/briefing/garnish_habit_l4_12_briefing_honesty_results.json`):

- `no_randomness` — 0 `Math.random` (deterministic briefing)
- `no_guilt_shame_fomo` — no guilt/shame/fake-urgency/FOMO strings in code or the re-engagement copy (EN + FA: abandon / miss you / hurry / last chance / از دست نده / عجله کن / فرصت آخر / تنهامون گذاشتی …)
- `kind_reengagement_copy` — copy is kind & opt-out-respecting ("هر وقت آماده بودی، اینجاییم … بدون هیچ عجله‌ای")
- `no_parallel_sender` — no `@Cron`/scheduler, no mailer/push provider in the briefing module
- `reuses_profile` / `reuses_s07_fit` / `reuses_s5` / `reuses_s7` / `delivery_via_ine` — reuse-composed
- `triggers_consent_gated` + `reengagement_fatigue_capped` — both triggers personalization-gated; re-engagement capped at 1/week

## Reuse proof (no parallel)

`briefing.service.ts` imports/calls `getLivingUserProfile`, `assessRecipeFit`, `MealPlansService`,
`ShoppingListService`, `GamificationService`, `IneService`, and `trackEvent` (grep-verified). Two existing
modules gained a one-line `exports` (`MealPlansService`, `ShoppingListService`) — additive, no logic change.
Recommendation `runtime-shadow/**` untouched.

---

## PHASE 2 — Isolated worktree clean-install (verbatim)

```
$ git worktree add --detach ../garnish-verify exec/garnish-habit-l4-12
HEAD is now at 1a18eed1 feat(HABIT-L4-12): daily briefing + honest habit-loop (reuse-composed, backend)

$ pnpm install --frozen-lockfile
Done in 27.1s                        # frozen lockfile → NO dependency changes

$ pnpm --dir apps/server exec prisma generate
✔ Generated Prisma Client (v5.22.0) in 476ms

$ pnpm build
Tasks:    2 successful, 2 total      # server (nest) + web (vite) — exit 0

$ pnpm coverage:check
coverage: ... deferred=14 | UNMAPPED=0 UNREGISTERED=0
COVERAGE GATE PASSED.

$ pnpm test
server:test: Test Suites: 175 passed, 175 total
server:test: Tests:       1313 passed, 1313 total     # 0 skips (= worktree baseline 1291 + 22 briefing)

$ git status --short                 # only docs/qa/** + coverage.generated regeneration churn (NOT committed)
$ git diff --name-only master..HEAD  # 15 intended files (briefing module x9 + ine triggers + 2 module exports
  + app.module + coverage.generated + coverage.registry + qa artifact)
$ git worktree remove ../garnish-verify   # blocked by regen churn → prune + rm -rf + prune
```

**Scope-proof summary:** reuse proven (briefing imports `getLivingUserProfile` + S07 `assessRecipeFit` + S5
`MealPlansService`/`ShoppingListService` + S6 `IneService` + S7 `GamificationService`; **no** parallel
notifier/scheduler/profile/recommender — grep shows no `@Cron`/mailer/push in the module); delivery is DRY-RUN
via the INE (real-send still default-OFF); re-engagement-honesty gate green (no guilt/shame/FOMO strings);
**no migration** this sprint (briefing events ride `trackEvent`); `git diff master..HEAD` shows **no
`runtime-shadow/**` change**; no `package.json` change; coverage green.

---

## TRACK 2 SUMMARY (S6–S8) — for the founder's end-of-track audit

Track 2 turned blind notification crons into an honest, intelligent return-visit system — all DRY-RUN, all
reuse-composed, all gated by consent/quiet-hours/fatigue.

| Sprint | Capability | Master commit (merge) |
|---|---|---|
| **S6 · NOTIF-L4-10** | Notification Intelligence Engine (INE): relevance → timing → fatigue → consent → decision + dry-run ledger; 3 blind crons routed through it; real-send default-OFF | `94e760a2` |
| **S7 · GAMIFY-L4-11** | Honest gamification: server-authoritative streaks/achievements/mastery; additive erasure-safe migration; anti-dark-pattern gate (no leaderboard/shame/casino); streak-at-risk + achievement triggers feed the INE | `edf70a7d` |
| **S8 · HABIT-L4-12** | Daily Briefing + honest habit-loop: reuse-composed (profile + S4/S07 + S5 + S6 + S7); one-per-day-per-context; re-engagement-honesty gate; delivery via INE dry-run | this sprint (HEAD after merge) |

**Track-wide invariants held:** DRY-RUN delivery only (no real push/email, no provider, no device-token
model, real-send default-OFF); consent + quiet hours + fatigue are hard gates; honest by design (no
leaderboard/shame/casino/guilt/FOMO); one unified profile (`getLivingUserProfile`) and one notifier (INE) —
no parallels; `runtime-shadow/**` frozen throughout; migrations additive + erasure-safe. Clean-room at HEAD:
build 0, coverage green, **175 suites / 1313 tests, 0 skips**.

---

## REQUIRED VERDICT BLOCK

```
HABIT_L4_12 RESULT: PASS
Clean install (worktree): build exit 0, coverage:check green, tests Test Suites 175/175, Tests 1313/1313, skips 0
Briefing: daily generator (one per day per meal context)=ok, reasons/explainable=ok, proposes-not-auto=yes
Briefing events feeding signal loop: briefing_view/accept/reject/swap=ok, additive (via trackEvent, no migration)
Re-engagement honesty gate: no-guilt/shame/FOMO=ok, kind framing=ok, opt-out + INE fatigue-cap respected=ok
Delivery: via S6 INE triggers (daily_briefing registered), DRY-RUN, real-send default-OFF = yes
Reuse-proof: uses getLivingUserProfile + S4/S07 + S5 + S6 INE + S7; NO parallel notifier/scheduler/profile/recommender
Boundaries: runtime-shadow=untouched, live-AI=OFF, newIngredientIDs=0, medical-claims=NONE, migration=none
Coverage gate: green (endpoints registered=2: GET /briefing/today, POST /briefing/feedback → deferred:E-briefing-ui)
TRACK 2 summary: included=yes; master commit=1a18eed1 (HEAD after report merge)
Merge/push: exec/garnish-habit-l4-12 → master ff/pushed (commit 1a18eed1 + report)
Verdict: HABIT_L4_12_PASS
```
