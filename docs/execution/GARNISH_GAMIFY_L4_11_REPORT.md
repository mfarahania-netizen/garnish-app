# GARNISH-GAMIFY-L4-11 — Honest Gamification Engine: 0 → L4 (Backend, Anti-Dark-Pattern)

**Track:** 2 · Sprint 2.2 · **Branch:** `exec/garnish-gamify-l4-11` · **Baseline:** master `94e760a2`
**Scope:** BACKEND maturity + one additive, erasure-safe migration. Thin functional wiring only (NO visual design).

---

## Mission outcome

There was no gamification system (greenfield — confirmed: no module, no model). It is now a mature,
**server-authoritative, honest gamification ENGINE** — streaks, achievements, mastery/progress — that
motivates through genuine cooking progress and is designed against dark patterns: it encourages, never
shames, never compares users publicly, and never uses casino/variable-ratio rewards. Every value is derived
from the trusted event store, never client-asserted.

---

## The engine (A–F)

| Part | Where | What |
|---|---|---|
| **A. Streaks** | `gamification/engine/gamification-streak.ts` | **Weekly** cadence (cook ≥1×/week — not punishing daily pressure), server-computed from real cook dates. A single **grace week ("freeze")** so a busy week doesn't cruelly reset. Broken/idle streaks use **kind, non-shaming** framing. `atRisk` is a gentle late-week nudge only. No randomness. |
| **B. Achievements** | `gamification/engine/gamification-achievements.ts` | Typed catalog of 9 genuine, earnable achievements (first cook, 5/25 cooks, recipe variety, cuisine explorer, brave cook, week planner, 4-week consistency, collector). Each is a **deterministic** threshold on real stats. Idempotent: `evaluateAchievements` never re-awards. Catalog guard rejects fitness/medical framing. |
| **C. Mastery / progress** | `gamification/engine/gamification-mastery.ts` | 5 earned levels (تازه‌کار → استاد آشپزی) from real completed cooks, enriched (never inflated) by the **declared cooking skill** from `getLivingUserProfile`. Honest, explainable `basis`. Declared skill never skips a level. |
| **D. Ledger + anti-cheat** | `gamification/gamification.service.ts` | `recomputeForUser` is the ONLY write path; it derives everything from `UserEvent type='cook_complete'` (+ the user's own favorites/meal-plans). Awards persist idempotently (`UserAchievement` unique `(userId, achievementKey)` → no double-award) and append to the `GamificationEvent` ledger. No method/endpoint accepts a client-claimed award. |
| **E. INE integration** | `notifications/ine/notification-triggers.ts` + service | Two new triggers (`streak_at_risk`, `achievement_unlocked`, both `personalization`-consent) registered in the **S6 INE**. `evaluateNotifications` routes candidates through `IneService.decideForUser` (DRY-RUN) — reusing the INE's consent / quiet-hours / fatigue gates. **No parallel notifier.** |
| **F. Read API** | `gamification/gamification.controller.ts` | Owner-only `GET /gamification/me` → the user's **private** streak/achievements/mastery (+ one celebrate moment, max 1/response). Registered `deferred:E-gamification-ui`. |

## Anti-dark-pattern gate (the heart of the sprint)

`gamification/gamification-qa-gate.spec.ts` — **9/9 checks pass, 0 failed**
(artifact: `docs/qa/gamification/garnish_gamify_l4_11_anti_dark_pattern_results.json`):

- `no_randomness` — **0** `Math.random` in the engine (grep-proven; awards are deterministic, not casino loops)
- `no_leaderboard_code` / `single_owner_route` — no leaderboard/ranking/comparison code; the only read route is the owner-private `me`
- `deterministic_awards` + `idempotent_awards` — same stats → identical result; already-unlocked never re-awarded
- `non_medical_copy` — achievement copy carries no calorie/weight/diet/medical framing (EN + FA)
- `kind_reset_copy` — a broken/idle streak is framed kindly; no shame words (`شکست/باختی/تنبل/…`)
- `ine_triggers_consent_gated` — both gamification triggers require `personalization` consent
- `no_push_or_mail_provider` — the engine imports no mailer/push/web-push provider

## Server-authoritative / anti-cheat

`recomputeForUser` reads `prisma.userEvent` (the trusted record of truth) and derives all awards; a user with
**zero** cook events earns nothing (test). The service exposes **no** `award/grant/claim/addPoints` method
(test). The controller has **no** award-submission endpoint.

## Additive, erasure-safe migration

`20260615000000_add_gamification` adds 4 tables — `UserStreak`, `UserAchievement`, `UserProgress`,
`GamificationEvent` — each with an FK to `User` `ON DELETE CASCADE ON UPDATE CASCADE`. **Purely additive**:
the `schema.prisma` diff has **zero removed/changed lines**; the migration has **no ALTER/DROP** of any
existing table. Because `ErasureService` relies on Prisma cascade, gamification data is erased automatically
with the user; the 4 models are also classified `user_owned_active` in `retention-policy.ts` (completeness
test updated 50 → 54).

## Reuse (no parallel)

Mastery uses `ProfileReadService.getLivingUserProfile` (declared cooking skill); notifications go through the
S6 `IneService` triggers. No parallel profile/notifier. Recommendation `runtime-shadow/**` untouched.

---

## PHASE 2 — Isolated worktree clean-install (verbatim)

```
$ git worktree add --detach ../garnish-verify exec/garnish-gamify-l4-11
HEAD is now at 79c760e9 feat(GAMIFY-L4-11): honest, anti-dark-pattern gamification engine (backend)

$ pnpm install --frozen-lockfile
Done in 28.7s                        # frozen lockfile honored → NO dependency changes

$ pnpm --dir apps/server exec prisma generate
✔ Generated Prisma Client (v5.22.0) in 444ms

$ pnpm build
Tasks:    2 successful, 2 total      # server (nest) + web (vite) — exit 0

$ pnpm coverage:check
coverage: mapped=66 internal=15 admin=39 deferred=12 ... | UNMAPPED=0 UNREGISTERED=0
COVERAGE GATE PASSED.

$ pnpm test
server:test: Test Suites: 172 passed, 172 total
server:test: Tests:       1291 passed, 1291 total     # 0 skips (= worktree baseline 1260 + 31 gamification)

$ git status --short                 # only docs/qa/** + coverage.generated regeneration churn (NOT committed)
$ git diff --name-only master..HEAD  # the committed change = 20 intended files (engine x6 + specs x4 + service/
  controller/module + service.spec + qa-gate.spec + schema + migration + app.module + ine triggers +
  retention policy + retention spec + coverage.generated + coverage.registry + qa artifact)
$ git worktree remove ../garnish-verify   # blocked by regen churn → prune + rm -rf + prune
```

**Scope-proof summary:** migration ADDITIVE only (schema diff = 0 removed/changed lines; no ALTER/DROP);
gamification erasure-safe (all FKs `ON DELETE CASCADE` + classified `user_owned_active`); NO leaderboard/
comparison endpoint (only owner `GET /gamification/me`); awards deterministic (**0** `Math.random` in engine);
reuse of `getLivingUserProfile` + S6 INE triggers (no parallel notifier); `git diff master..HEAD` shows **no
`runtime-shadow/**` change**; no `package.json` change (no dependency added); coverage green.

---

## REQUIRED VERDICT BLOCK

```
GAMIFY_L4_11 RESULT: PASS
Clean install (worktree): build exit 0, coverage:check green, tests Test Suites 172/172, Tests 1291/1291, skips 0
Engine: streaks=ok, achievements=ok, mastery/progress=ok, event-ledger+anti-cheat=ok
Anti-dark-pattern gate: no-leaderboard=ok, no-shame-reset(kind copy)=ok, no-casino/random-award=ok (grep 0 Math.random), private-only=ok
Server-authoritative: awards derived from trusted signals (UserEvent), NOT client-asserted = yes (test: zero events → zero awards; no award/claim method)
Migration: ADDITIVE only (4 new models, no altered/dropped existing) = yes; erasure-safe = yes (onDelete: Cascade + user_owned_active)
Boundaries: runtime-shadow=untouched, live-AI=OFF, newIngredientIDs=0, medical/fitness-claims=NONE
Reuse-proof: mastery uses getLivingUserProfile; notifications via S6 INE triggers (streak_at_risk, achievement_unlocked); no parallel notifier/profile
Coverage gate: green (endpoints registered=1: GET /gamification/me → deferred:E-gamification-ui)
Merge/push: exec/garnish-gamify-l4-11 → master ff/pushed (commit 79c760e9 + report)
Verdict: GAMIFY_L4_11_PASS
```
