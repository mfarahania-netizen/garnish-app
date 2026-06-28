# Meal-Plan v2 — world-class redesign (research-driven)

Synthesis of 3 parallel research agents (best-app features, 2026 design/interaction, structure+retention). Founder mandate:
"one of the core features — complete, precise, delightful, beautiful, straightforward, 2026 feel, several levels above current."

## Locked decisions

1. **Layout — KILL the 7×3 horizontal grid.** Go **single-day focus + compressed RTL week-strip (Sat rightmost) + today-default**
   (the Structured model — where meal-planner and day-planner worlds independently converge). Week-strip = the glance layer
   (density dots per day show which slots are filled → "where are my holes?" in <1s). Below = the selected day's meal rows
   full-width. Tap a day-chip or swipe to change day. Open into TODAY.
2. **Meal types = 4 default:** صبحانه / ناهار / شام / **میان‌وعده** (snack — universal floor across all 7 top apps; founder
   was right). Dessert folds into snack (only 1/7 apps default it). Snack is a NORMAL row (recipe OR free item). Same types
   every day for v1. (Backend `canonMeal` already maps میان‌وعده→snack.)
3. **"Mark cooked" = the signature interaction** (our Things-3 check-off moment): spring-pop check + accent tint + success
   haptic (Android only — iOS Safari has no `navigator.vibrate`) + reduced-motion crossfade fallback. NOT confetti. Wire to
   existing `cook_complete`. Closes plan→cook→learn loop.
4. **Inviting empty slots** — never a dead "+". `+ افزودن` + one-tap grounded dish chips (real corpus, allergy-gated via
   dishOptions). First-run: «هفته‌ام را بچین» on the deterministic week-fill.
5. **"Tonight" hero** — today's NEXT meal as the biggest card (changes by time of day). The #1 retention driver per evidence
   ("kill the what's-for-dinner decision"). Discovery-browsing is a CHURN signal — keep it one decisive answer, not a feed.
6. **Imagery** — real dish photos are the premium ceiling (P1 pipeline, separate). Until then: photo-absent **premium
   placeholder** = deterministic soft-gradient (hash dish→2 close hues) + category glyph + name. Never a bare glyph hero.
7. **2026 visual system** — M3 motion tokens (100/250/350ms; standard/decelerate/accelerate easing), 4-layer soft shadows,
   16px card radius, 8pt spacing, Persian line-height ~1.75 + ZERO letter-spacing, glass on chrome only (strip+sheet) w/
   solid fallback, dark = elevated grays not black. Calm + surgical depth, not effects.
8. **NO drag-to-reschedule in v1** — Samsung Food REMOVED it (touch-unreliable; PWA can't do native physics). Use long-press
   / explicit actions ("move to day", swap, remove). Drag is a P3 delight ceiling, touch-tested, later.
9. **Retention order:** tonight-glance (P1) → one-tap week + reuse-last-week (P2) → shopping list (done) → ONE locale-timed
   nudge (P3, notification infra) → leftovers (P3). **Streaks DEFERRED** (anxiety/"digital chore" backfire clashes with
   premium-calm; 64% delete an app after ≥5 notifs/week).

## Build order (this pass)
- [x] research
- Snack row (frontend MEALS + grid; backend canon already maps)
- Layout redesign: week-strip + density dots + single-day focus + today-default + swipe/tap day nav
- Premium visual tokens (shadows/radii/motion/line-height) + photo-absent gradient placeholder
- Inviting empty slots (grounded one-tap chips, reuse dishOptions)
- "Tonight" hero (today's next meal)
- Mark-cooked (raw-SQL `cookedAt` — GRIS pattern, no migration/restart — + signature interaction)
- Comprehensive battery (incl. snack + cooked) + vitest + report

## Deferred (documented next phase — backend-heavy / infra, with reasons)
- **weekStartDate keying** (refactor from "current week") → unlocks multi-week + templates + copy. Do FIRST next phase.
- Servings/slot → auto-scale shopping list (P1 feature; touches the aggregator + needs recipe baseServings).
- Save-a-week / templates ("My Weeks"); copy day/week — strongest repeat-use lever; needs weekStartDate + PlanTemplate.
- Multi-week nav (prev/next).
- Planned leftovers ("cook once eat twice"); per-day/week nutrition summary.
- Locale-aware meal semantics (NL lunch=cold, DE main=lunch, per-locale dinner clock) — a real EU-launch i18n requirement.
- Notifications/web-push (iOS-PWA-fragile); real photo pipeline (the premium ceiling).
