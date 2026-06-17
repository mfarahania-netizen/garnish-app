# GARNISH-FE-SETTINGS — Execution Report
**Sprint:** Track 5 Reset · Sprint L (screen 7 of 10) — Settings
**Branch:** `exec/garnish-fe-settings`  ·  **Baseline:** `master` @ `d67cc307`
**Status:** verification GREEN → ff-merged to master + pushed · **STOP for founder screenshot review**
**Date:** 2026-06-17

---

## 1. Summary
Built **Settings** at **`/settings`** (drawer «تنظیمات» + Profile quick-access) to `Garnish Settings.dc.html`.
Files: `app/settings/{page.jsx, useSettings.js}`. Frontend-only; backend untouched; bundle not imported.
A 3-lens adversarial review ran before merge; its real findings were fixed (below).

## 2. The screen (5 sections)
1. **پروفایل غذایی** — dietary pattern + allergens (non-medical safety framing) persist via
   **PUT /users/preferences** (diet + allergies JSON), hydrated from **GET /users/preferences**.
2. **اعلان‌ها** — 4 calm toggles (briefing / streak / reengage / quiet) persisted in **localStorage**
   (no backend prefs endpoint) — honest client-side «ذخیره شد».
3. **حریم خصوصی و رضایت** — **revocable** consent (personalization, analytics) → real
   **POST /users/consent {type, granted}** (analytics also drives the real `garnish.analyticsConsent` +
   start/stop PostHog) + the «هر رضایت قابل‌لغوه» note.
4. **حساب** — phone (GET /users/me, read-only), **خروجیِ داده‌هایم** (GET /users/me/export → downloads
   `garnish-data.json`), **حذف حساب** (2-step confirm → DELETE /users/me → logout → /onboarding).
5. **برنامه** — theme (light; dark «به‌زودی») + language (fa; English «به‌زودی»).
- «ذخیرهٔ مهربان» toast on change; error toast on failure. Loading + error states.

## 3. Honesty / safety (and sanctioned deltas)
Allergens = non-medical safety; consent revocable + truly POSTs; export/delete real; no fabricated data.
**Sanctioned deltas from the mockup** (no dead controls): **dislikes + allergen-severity omitted** (the
preferences DTO has no such field); the **«observed» consent row dropped** (no distinct backend purpose —
only core/analytics/personalization); account shows **phone** (auth is phone-based) and omits change-password
(no endpoint). Notification prefs persist to localStorage (honest, client-side) since there's no backend
prefs endpoint. There is no FE endpoint to **read** server consent, so toggle state is mirrored locally —
documented, conservative default.

## 4. Adversarial review — findings fixed before merge
3 lenses; **no blockers**. Consent/honesty lens confirmed the plumbing is real (revoke truly POSTs;
analytics dual-action). Fixed:
- **Consent honesty (major):** the personalization mirror defaulted ON for anyone who hadn't toggled it →
  now defaults **false** (never assert an unverified grant) and **onboarding seeds** the mirror on the
  real grant.
- **Consent honesty (major):** `toggleConsent` now **reverts on POST failure** (a failed revoke no longer
  looks successful).
- **a11y (major):** food-profile chips (38→**44px**) and theme/language segments (36→**44px**) — they're
  the sole controls, so the inline size was floored to meet the 44px target.

## 5. Clean-room verification (isolated worktree, detached @ `f771ae10`)
```
git worktree add --detach ../gv-l2 f771ae10
pnpm install --frozen-lockfile          # frozen
pnpm --dir apps/server exec prisma generate   # ok
pnpm build                              # Tasks: 2 successful, 2 total → exit 0
pnpm coverage:check                     # COVERAGE GATE PASSED → exit 0
( cd apps/server && pnpm exec jest --maxWorkers=2 --workerIdleMemoryLimit=600MB )
                                        # Test Suites: 191/191 ; Tests: 1412/1412 ; skips 0
git diff --name-only master f771ae10 -- apps/server   # EMPTY (backend untouched)
```

### Scope-proof
- Changed set vs master = `App.jsx` (`/settings`), `app/settings/{page.jsx,useSettings.js}` (new),
  `app/onboarding/useOnboarding.js` (seed personalization consent mirror),
  `tools/coverage/coverage.registry.json` (export + delete → frontend:settings/SettingsPage),
  `docs/coverage/coverage.generated.json`. **No other page. No `apps/server` change (incl. its `.gitignore`).**

## 6. Render — in words
Editable food profile (pattern + allergen safety flags) that saves to your preferences; calm notification
toggles; a privacy section with revocable consent that truly takes effect; an account section that exports
your data and (with a 2-step confirm) deletes it; app theme/language with «به‌زودی» where not yet built.
RTL + Vazirmatn; clean console expected.

---

## VERDICT
```
FE_SETTINGS RESULT: PASS
Clean install (worktree): build exit 0, coverage green, server tests suites 191/191, tests 1412/1412, skips 0
Settings to mockup (food-profile / notifications / privacy+consent / account / app) = ok (dislikes/severity + observed-row omitted — no backend field; documented)
Allergens = non-medical safety framing = yes · consent revocable + honest (truly revokes, reverts on failure, conservative default) = yes
Account export/delete real = yes · API: /users/preferences, /users/consent (+ export, delete) = yes · no fabricated data / no raw enum = yes
bundle runtime NOT imported/bundled = yes · zero non-brand hex = yes,grep · RTL+Vazirmatn+reduced-motion+AA+44px = yes
Frontend-only, backend untouched (incl server .gitignore) = yes · coverage re-mapped; gate green
Merge/push: exec/garnish-fe-settings → master (ff, pushed)
Verdict: FE_SETTINGS_PASS
```

---

**Next: Notifications + Achievements + Admin + the final audit — screenshot-gated.**
