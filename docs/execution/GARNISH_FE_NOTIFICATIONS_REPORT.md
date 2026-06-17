# GARNISH-FE-NOTIFICATIONS — Execution Report
**Sprint:** Track 5 Reset · Sprint M (screen 8 of 10) — Notifications
**Branch:** `exec/garnish-fe-notifications`  ·  **Baseline:** `master` @ `1e993349`
**Status:** verification GREEN → ff-merged to master + pushed · **STOP for founder screenshot review**
**Date:** 2026-06-17

---

## 1. Summary
Built the **Notifications** center at **`/notifications`** (TopBar bell — already linked — + drawer «اعلان‌ها»)
to `Garnish Notifications.dc.html`. Files: `app/notifications/{page.jsx, useNotifications.js}`. Frontend-only;
backend untouched; bundle not imported. A 3-lens adversarial review ran before merge (no-FOMO lens clean;
two fixes applied).

## 2. The screen
- **List** from `GET /notifications` (real, take 50): each `NotificationRow` = a type-icon tile + title +
  unread dot + body + relative Persian time + chevron; unread rows tinted (ai-surface). Tap → mark read
  (`PATCH /notifications/:id/read`, optimistic) and deep-link to the recipe when the payload carries a recipeId.
- **«همه را خواندم»** marks all unread (loops PATCH — no bulk endpoint); **«تنظیماتِ اعلان»** → `/settings`.
- **States:** loading skeleton rows, empty («فعلاً خبری نیست / وقتی چیزِ مفیدی باشه، آروم خبرت می‌کنیم.»),
  error («اعلان‌ها بارگذاری نشد» + retry).

## 3. Honesty / safety
**Calm + opt-out, NO FOMO/guilt** — the FE authors zero notification text (titles/bodies come straight from
the API, so it's structurally unable to inject FOMO). The notification `type` drives only the icon and is
**never shown raw** (no enum leak). Real data only; relative time computed honestly from `createdAt`.

## 4. Adversarial review — findings fixed before merge
3 lenses; no-FOMO/honesty lens = **clean**. Fixed:
- **a11y (major):** read/unread state was silent to screen readers (the row `aria-label={title}` overrode the
  content and the dot's label sat on a roleless div). Now the unread state is folded into the row's
  accessible name («خوانده‌نشده، <title>») and the dot is `aria-hidden`.
- **Honesty (minor):** `markRead` now rolls back the optimistic read on a PATCH failure (never claims read
  when the server didn't persist).
Sanctioned delta: the empty state keeps a notification-settings entry for reachability (the mockup's empty
state omits it). Tokens/RTL clean; ≥44px targets.

## 5. Clean-room verification (isolated worktree, detached @ `f8878968`)
```
git worktree add --detach ../gv-m2 f8878968
pnpm install --frozen-lockfile          # frozen
pnpm --dir apps/server exec prisma generate   # ok
pnpm build                              # Tasks: 2 successful, 2 total → exit 0
pnpm coverage:check                     # COVERAGE GATE PASSED → exit 0
( cd apps/server && pnpm exec jest --maxWorkers=2 --workerIdleMemoryLimit=600MB )
                                        # Test Suites: 191/191 ; Tests: 1412/1412 ; skips 0
git diff --name-only master f8878968 -- apps/server   # EMPTY (backend untouched)
```

### Scope-proof
- Changed set vs master = `App.jsx` (`/notifications`), `app/notifications/{page.jsx,useNotifications.js}` (new),
  `docs/coverage/coverage.generated.json`. **No other page. No `apps/server` change (incl. its `.gitignore`).**
  `/notifications` + `PATCH /notifications/:id/read` already mapped.

## 6. Render — in words
A calm, time-stamped list of the engine's real notifications (streak care, suggestions, achievements,
briefings) with unread tinting; tap to read (and open the linked recipe), mark all read, or jump to
notification settings; warm empty + error states. No FOMO. RTL + Vazirmatn; clean console expected.

---

## VERDICT
```
FE_NOTIFICATIONS RESULT: PASS
Clean install (worktree): build exit 0, coverage green, server tests suites 191/191, tests 1412/1412, skips 0
Notifications to mockup (list / mark-all-read / settings entry / empty / error) = ok
Calm + opt-out + NO FOMO/guilt = yes · real data, no fabricated, no raw enum = yes
API: /notifications (+ PATCH /notifications/:id/read) = yes
bundle runtime NOT imported/bundled = yes · zero non-brand hex = yes,grep · RTL+Vazirmatn+reduced-motion+AA+44px = yes
Frontend-only, backend untouched (incl server .gitignore) = yes · coverage re-mapped; gate green
Merge/push: exec/garnish-fe-notifications → master (ff, pushed)
Verdict: FE_NOTIFICATIONS_PASS
```

---

**Next: Achievements + Admin + the final audit — screenshot-gated.**
