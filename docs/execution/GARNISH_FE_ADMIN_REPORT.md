# GARNISH-FE-ADMIN — Execution Report
**Sprint:** Track 5 Reset · Sprint O (screen 10 of 10) — Admin Panel
**Branch:** `exec/garnish-fe-admin`  ·  **Baseline:** `master` @ `13490a07`
**Merged HEAD:** `217367ba`
**Status:** verification GREEN → ff-merged to master + pushed · **STOP for founder screenshot review**
**Date:** 2026-06-17

---

## 1. Summary
Built the **Admin Panel** at a standalone, admin-gated, desktop **`/admin`** route to `Garnish Admin.dc.html`,
on the real `/admin/*` endpoints. Files: `app/admin/{page.jsx, useAdmin.js}` + the `/admin` route in `App.jsx`.
Frontend-only; backend untouched; bundle not imported. A 3-lens adversarial review ran before merge — its
majors/minors were all fixed (below) and re-verified clean.

## 2. The screen
- **Admin gate** — `/admin` is standalone (outside the member shell) and gated on the real `useAuth().user.isAdmin`
  signal; non-admins see a calm denied state (the backend endpoints are themselves RolesGuard-protected — the FE
  gate is UX, not security). Auth-loading shows a Loader.
- **Header** — consolidated to a desktop top-header: title, day-range chips (۲۴ ساعت / ۷ روز / ۳۰ روز), a refresh
  control, and a JSON export.
- **رشد و فعالیت (growth)** — users / cooks / searches / AI-messages KPIs, each `real` ONLY when its block's
  `status==='real'` — otherwise the honest **AwaitingPilot** state, never a fabricated vanity number.
- **آمادگی (readiness)** — scheduled-jobs list + the retention destructive-mode flag.
- **ایمنی و انطباق (safety/compliance)** — guard-corpus fire counts (deterministic + real pre-pilot), the allergen
  hard-filter result, notification posture (dry-run vs real-send).
- **شناسهٔ ذائقه (Food-DNA bands)** — maturity-band distribution from product-intelligence (real-gated).
- **کیفیت توصیه‌گر (recsys offline)** — the deterministic offline-eval ratios (S11 harness), rendered honestly.
- **States** — loading, partial-tolerant error + retry (only hard-errors when the core ops endpoints both fail).

## 3. Honesty / safety
Every metric block from `/admin/*` carries `status: 'real' | 'awaiting_pilot'`. We render the real number ONLY
when `status==='real'` and otherwise the AwaitingPilot honest state — **never a fabricated growth/vanity number**.
The safety/compliance + recsys-offline evidence (guard-fire counts over the fixture corpus, allergen hard-filter,
offline eval) is deterministic + real even pre-pilot, and is labelled as such. No raw English/enum keys.

## 4. Adversarial review — findings fixed before merge
3 lenses (honesty/safety · tokens-RTL-a11y · mockup-fidelity). Findings, all fixed + re-verified:
- **(major, honesty)** `recsys.offline` is `Record<string, MetricResult{value,threshold,pass,note}>` — objects, not
  numbers. The render filtered on `typeof v === 'number'` (always false) so the **real deterministic data was
  silently dropped**, and a naive "fix" risked multiplying non-ratios. Fixed: a `recsysRows()` helper gates each
  metric on `typeof m.value === 'number'`, renders only the numeric 0..1 ratios as `Math.round(m.value*100)٪`,
  labelled via a `RECSYS_FA` map, capped at 5; the honest «در حال آماده‌سازی» note shows when there are none.
- **(major, a11y)** day-range chips were `minBlockSize: 36` (the sole range control) → **44px** (inline-flex centered).
- **(minor, honesty)** allergen KPI was hardcoded `real` even when the block was null → `real={!!d.allergen}` with an
  honest «در حال ارزیابی» await-note.
- **(minor, honesty)** latency p95 null was badged real → real only when a successful sample exists (`real && p95!=null`);
  honest «بدون نمونهٔ موفق» value otherwise.
- **(minor)** export button `40 → 44px`; dead `recsys.real || !!offline` reduced to strictly `=== 'real'`; unused
  `consent` derivation removed.
Tokens/RTL clean; ≥44px targets; reduced-motion safe; zero non-brand hex (grep = 0).

## 5. Clean-room verification (isolated worktree, detached @ `217367ba`)
```
git worktree add --detach ../gv-o 217367ba
pnpm install --frozen-lockfile          # frozen
pnpm --dir apps/server exec prisma generate   # ok
pnpm build                              # Tasks: 2 successful, 2 total → exit 0
pnpm coverage:check                     # COVERAGE GATE PASSED → exit 0
( cd apps/server && pnpm exec jest --maxWorkers=2 --workerIdleMemoryLimit=600MB )
                                        # Test Suites: 191/191 ; Tests: 1412/1412 ; skips 0
git diff --name-only master 217367ba -- apps/server   # EMPTY (backend untouched)
```

### Scope-proof
- Changed set vs master = `App.jsx` (`/admin` route), `app/admin/{page.jsx,useAdmin.js}` (new),
  `docs/coverage/coverage.generated.json` (regenerated). **No other page. No `apps/server` change (incl. its
  `.gitignore`).** All `/admin/*` endpoints already mapped (admin status in the coverage registry).

## 6. Render — in words
A desktop operator's overview: growth KPIs that show real numbers only when the data is real (and an honest
"awaiting pilot" otherwise), a readiness panel of scheduled jobs, a safety/compliance block of deterministic
guard-corpus + allergen-filter evidence, the taste-maturity band distribution, and the recsys offline-eval
ratios — all admin-gated, RTL + Vazirmatn, clean console expected.

---

## VERDICT
```
FE_ADMIN RESULT: PASS
Clean install (worktree): build exit 0, coverage green, server tests suites 191/191, tests 1412/1412, skips 0
Admin to mockup (gate / header+range / growth KPIs / readiness / safety-compliance / DNA bands / recsys / states) = ok
Honesty: status-gated real-vs-awaiting-pilot, NO fabricated vanity numbers = yes · deterministic safety/recsys evidence labelled = yes
Admin-gated on real isAdmin = yes · no raw enum = yes
API: /admin/ops/health · /ops/safety-compliance · /analytics/user-stats · /analytics/trends · /analytics/product-intelligence = yes
bundle runtime NOT imported/bundled = yes · zero non-brand hex = yes,grep · RTL+Vazirmatn+reduced-motion+AA+44px = yes
Frontend-only, backend untouched (incl server .gitignore) = yes · coverage gate green
Merge/push: exec/garnish-fe-admin → master (ff, pushed) @ 217367ba
Verdict: FE_ADMIN_PASS
```

---

**This completes the 10-screen rebuild (C-FIX → O). Next: Sprint P — the full-app audit + the first web smoke-test net — screenshot-gated.**
