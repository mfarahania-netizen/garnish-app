# BE-FIX-EVENT-QUALITY-DELIBERATE-SIGNALS — Execution Report
**Surface:** Backend, `apps/server/src/analytics/event-quality.service.ts` ONLY (+ its spec).
**Baseline:** `master` @ `2d29addc`  ·  **Merged HEAD:** `52ad0427` (ff-merged to master + pushed)
**Status:** all gates GREEN · adversarial review = no blockers → merged.
**Date:** 2026-06-18

> The over-aggressive anti-spam gate had it backwards: high-frequency NOISE (views/impressions) was
> exempt while high-value DELIBERATE signals were not, so a real `cook_complete` fired right after a
> view/impression burst was silently rejected as "bot" and never written. This flips that.

---

## PHASE 0 — root cause CONFIRMED against the running code
- `nonDuplicateEvents` (event-quality.service.ts:44-50) = `page_view`, `recommendation_impression`,
  `recipe_view`, `category_view`, `category_click` — does NOT contain `cook_complete` / `favorite_add` /
  `mealplan_add`. ✓
- `calcBotProbability` returns `0.9` when `recent.length > 20 && avgGap < 3000` (line 131), keyed on
  `bot:<userId>` ALONE — **shared across all event types**, so a view/impression burst poisons it. ✓
- A non-allowlisted event with `botProbability > 0.8` → `isValid:false, reason:'bot'` (lines 81-88). ✓
- Consumer: `analytics.service.ts:70-74` — `assess().isValid === false` → `trackEvent` returns `null` →
  **no `userEvent.create`** → gamification (`COOK_COMPLETE_TYPES=['cook_complete']`, `totalCooks =
  events.length`) counts 0. ✓
- Accepted vocabulary (`signal-observation-engine.ts` `POSITIVE_EVENTS` / `EXPLICIT_FEEDBACK_EVENTS`)
  confirmed; the exempt set is a strict subset (no invented types). ✓

**Repro (spec):** after a 25× `recipe_view` burst, a subsequent `recommendation_impression` is rejected
`isValid:false / reason:'bot' / botProbability>0.8` — the exact verdict `cook_complete` used to get
(shared `bot:<userId>` counter). This is the evidence the gate drops real cooks.

## PHASE 1 — fix (event-quality.service.ts only)
- **`DELIBERATE_SIGNALS`** — 9 high-value, user-initiated types, each verified present in
  `POSITIVE_EVENTS`: `cook_complete, favorite_add, mealplan_add, recommendation_save,
  recommendation_cook, shopping_item_add, ai_message_send, onboarding_answered, preference_update`.
- **Discrepancy surfaced (no fabrication):** the brief also named `favorite_remove` and `mealplan_remove`.
  `favorite_remove` is not a tracked type anywhere; `mealplan_remove` is a `NEGATIVE_EVENT` (not in
  `POSITIVE_EVENTS`/`EXPLICIT_FEEDBACK_EVENTS`). Per Phase 0 #2's "subset of POSITIVE/EXPLICIT · do not
  invent types" rule, both are **excluded** (documented in-code).
- In `assess()`, BEFORE the bot/duplicate logic: a deliberate signal returns `isValid:true` with its base
  confidence (`BASE_CONFIDENCE_MAP`, default `1.0`; added `cook_complete:1.0`) and
  `evidence.duplicateCheck=false, botProbability=0`. The heuristic is BYPASSED for these.
- Narrow safety only: a `< 2000ms` exact-`(userId,type,payload)` double-fire guard (`ddup:` key,
  independent of the `bot:`/`dup:` counters) absorbs an accidental double-click — it can never collapse
  two DISTINCT cooks or a same-recipe cook ≥2s later.
- Everything else UNCHANGED (views/impressions/page_view stay bot-checked; else-branch dedup intact).

## PHASE 2 — raw evidence (clean-room worktree @ `52ad0427`)
```
pnpm install                                   # Done in 56.4s
pnpm --dir apps/server exec prisma generate    # ok
pnpm --dir apps/server build                   # nest build → exit 0
( cd apps/server && pnpm exec jest --maxWorkers=2 --workerIdleMemoryLimit=600MB )
                                               # Test Suites 195/195; Tests 1448/1448; skipped 0
pnpm --dir apps/server run recsys:eval         # 19/19 PASS
pnpm --dir apps/server run ai:eval:regression  # 46/46 PASS (output-safety)
git diff --name-only master...HEAD             # event-quality.service.ts (+spec) ONLY
```
Server suite grew 194→**195** suites / 1434→**1448** tests (my +1 suite, +14 tests); **0 skipped**.

**New spec coverage:** repro (non-deliberate still bot-rejected under burst) · all 9 deliberate signals
accepted after the same burst (per-type `botProbability=0`/`duplicateCheck=false`) · noise gate +
else-branch dedup regression (faithful to actual code — `page_view` is bot-checked, NOT deduped) · the
`<2s` double-fire guard (double-tap deduped, distinct cooks both accepted, same cook +2.5s re-accepted) ·
**E2E through the REAL (frozen) `GamificationService`**: a `cook_complete` arriving after a burst →
`totalCooks=1` + weekly streak `0→1` + `first_cook` unlocked.

**Adversarial review (5 independent lenses, 0 blockers):** vocabulary, scope/frozen, and
hidden-dependency all PASS; the E2E confirmed honest (`totalCooks` flows from `events.length`, not a mock
constant). One bounded, INTENDED trade-off noted (below). Two flagged test-coverage holes were closed
(per-type evidence flags + `recommendation_cook`/`preference_update` confidence) and a cosmetic `≤2s`→
`<2000ms` wording nit fixed.

**Scope proof — `git diff --name-only master...HEAD`:**
```
apps/server/src/analytics/event-quality.service.spec.ts
apps/server/src/analytics/event-quality.service.ts
```
**event-quality ONLY** — no frozen path (`gamification/**`, `behavior-engine/**`, other `analytics/*`,
`ai/**`, `recommendation/**`, frontend) appears.

---

```
VERDICT BLOCK
=============
SPRINT: BE-FIX-EVENT-QUALITY-DELIBERATE-SIGNALS
ROOT CAUSE CONFIRMED (cook_complete was bot-rejected under burst): Y
BUILD (apps/server): PASS
SERVER SUITE: 195/1448, skipped=0
DELIBERATE SIGNALS NOW ALWAYS ACCEPTED (cook_complete/favorite_add/mealplan_add, even after burst): Y
NOISE STILL GATED (page_view bot-checked / impression bot-checked / else-branch deduped): Y
E2E: single cook_complete → gamification totalCooks increments + streak moves: PASS
recsys:eval: PASS   ai:eval:regression: PASS
FABRICATED TYPES: none (favorite_remove + mealplan_remove excluded — not in POSITIVE/EXPLICIT vocab)
SCOPE (diff name-only) = event-quality.service.ts (+spec) ONLY: Y
MERGE+PUSH: DONE @52ad0427
```

## Known, bounded follow-up (out of this sprint's scope)
Bypassing the bot gate widens a *self*-inflation surface: an authenticated user could pad **their own**
private `totalCooks`/mastery/behavior signals via varying-payload (or ≥2s same-payload) floods up to the
1000 req/min throttle. This is materially bounded — JWT-guarded, server-derived `userId`, private (no
leaderboard), achievements idempotent per `(userId, achievementKey)`, streak week-bucketed — and is the
intended product trade-off (a real cook must never be dropped). A future sprint could add per-
`(userId, recipeId, day)` idempotency or a coarser server-side `cook_complete` rate guard. Deliberately
NOT done here per the brief's scope discipline.

---

## AFTER MERGE — STOP for founder verification
1. Cook one recipe to «پایان» → Home → the «سطح / آشپزی این هفته» line should MOVE (no longer "first cook
   this week"). Cook a 3rd distinct recipe → level «سطح ۲ · آشپز خانگی» (threshold = 3).
2. Confirm it holds even after scrolling/clicking a lot first (the burst scenario).
**Do not start the next sprint until the founder confirms.**
