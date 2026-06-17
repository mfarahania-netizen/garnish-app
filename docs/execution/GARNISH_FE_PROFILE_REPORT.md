# GARNISH-FE-PROFILE — Execution Report
**Sprint:** Track 5 Reset · Sprint F (screen 1 of 10) — Profile + working logout
**Branch:** `exec/garnish-fe-profile`  ·  **Baseline:** `master` @ `b974d9a5` (built on `366e3f34`)
**Status:** verification GREEN → ff-merged to master + pushed · **STOP for founder screenshot review**
**Date:** 2026-06-17

---

## 1. Summary
Built the **Profile** screen at `/profile` (+ `/food-dna` deep-link) inside the gated shell, to
`Garnish Profile Full.dc.html`, on real owner-scoped reads. **This unblocks logout** (the priority).
Frontend-only; backend untouched; bundle runtime not imported. A parallel **adversarial review**
(3 lenses) ran before merge — its real findings were fixed (below).

## 2. The screen (two views, faithful to the mockup)
**Profile view («تو»):** avatar (name initial) + streak flame badge · name · «عضو از <ماهِ Jalali> ·
<N> دستور پخته» · edit pencil → Food DNA summary card (calm `FoodDnaRing` + band pill + trait chips)
→ «پیشرفتِ تو» 3 stats → «آنچه از تو می‌دانیم» → «دسترسی سریع» → **«خروج از حساب»**.
**DNA view («شناسهٔ ذائقه»):** large calm ring + band → «تفکیکِ ابعاد» (confidence bars) → «آشتیِ
صادقانه» honest reconciliation + «اصلاحش کن» → footnote. Reachable via the card tap or `/food-dna`.

## 3. Real data (no fabrication)
- `GET /users/me` → name + member-since (`createdAt` via `Intl` Persian calendar; omits gracefully if unavailable).
- `GET /gamification/me` → streak (**weekly** — honestly labelled «هفته پیاپی», not the mockup's «روز»), `stats.totalCooks`, earned-badge count (private; no leaderboard).
- `GET /profile` → maturity (band, overallScore) for the ring; **`reconciled.dimensions`** for the breakdown bars (real per-dimension confidence + tiers — never the mockup's hardcoded demo, never raw keys; cold-start → honest forming state); declared↔observed conflict for the reconciliation (specific only when one really exists, else the general «هر دو رو نگه داشتیم» principle).
- `GET /users/preferences` → diet pattern (localized) + **all** declared allergens as active **non-medical safety flags**.
- **Logout** → real `AuthContext.logout` → `/onboarding` (the gate redirects).

## 4. Adversarial review — findings fixed before merge
A 3-lens review (honesty/safety · tokens/RTL/a11y · mockup-fidelity) found **no blockers/majors**; the real minors were fixed:
- **Honesty:** dropped the `dietLabel → traits[0]` fallback (no conflating a behaviour trait with a dietary claim).
- **Honesty/safety:** `faAllergen` now humanizes unknown tokens (no raw-enum leak on the safety flag); **every** declared allergen is shown (none silently hidden).
- **Fidelity:** restored the mockup's edit pencils on the «آنچه از تو می‌دانیم» rows + per-dimension breakdown rows (→ the `/onboarding` edit path).
- **Polish:** explicit ≥44px on icon buttons; logical margins on section titles.
The lenses confirmed: zero raw hex, logical-RTL-only, calm ring (no medical claim), reduced-motion respected, every mockup section present in order.

## 5. Clean-room verification (isolated worktree, detached @ `63ca3b23`)
```
git worktree add --detach ../garnish-verify 63ca3b23
pnpm install --frozen-lockfile          # Done in 32.2s (frozen)
pnpm --dir apps/server exec prisma generate   # ok
pnpm build                              # Tasks: 2 successful, 2 total (web + server) → exit 0
pnpm coverage:check                     # COVERAGE GATE PASSED → exit 0
( cd apps/server && pnpm exec jest --maxWorkers=2 --workerIdleMemoryLimit=600MB )
                                        # Test Suites: 191 passed, 191 total
                                        # Tests:       1412 passed, 1412 total ; Snapshots: 0 ; skips: 0
git diff --name-only master 63ca3b23 -- apps/server   # EMPTY (backend untouched)
git worktree remove ../garnish-verify
```

### Scope-proof
- Changed set vs master = `App.jsx`, `app/profile/{page.jsx,useProfile.js}` (new), `app/home/lib/reasons.js`
  (added `dimensionBreakdown` + `tasteReconciliation`; hardened `faAllergen`), `docs/coverage/coverage.generated.json`.
  **No other page. No `apps/server` change (incl. its `.gitignore`).**
- Logout wired; ring calm (not a bar); allergen = non-medical safety flag; reconciliation honest; coverage green
  (`/users/me`, `/profile`, `/gamification/me`, `/users/preferences` already registered + called).

## 6. Render — in words
A warm profile: avatar + streak + name + «عضو از …», a calm saffron Food DNA card that drills into the
dimension breakdown + the honest reconciliation, three private progress stats, the two facts we know (diet +
allergen safety flag, editable), quick links, and a clear red **«خروج از حساب»** that logs you out to onboarding.
RTL + Vazirmatn; clean console expected.

---

## VERDICT
```
FE_PROFILE RESULT: PASS
Clean install (worktree): build exit 0, coverage green, server tests suites 191/191, tests 1412/1412, skips 0
Profile to mockup (header/FoodDNA-ring/progress/known+reconciliation/quick-access/logout) = ok
Logout wired to AuthContext.logout = yes · ring calm not bar = yes · allergen safety flag (non-medical) = yes
APIs: /users/me, /profile, /gamification/me = yes (+ /users/preferences) · no fabricated data / no raw enum = yes
bundle runtime NOT imported/bundled = yes · zero non-brand hex = yes,grep · RTL+Vazirmatn+reduced-motion+AA+44px = yes
Frontend-only, backend untouched (incl server .gitignore) = yes · coverage re-mapped; gate green
Merge/push: exec/garnish-fe-profile → master (ff, pushed)
Verdict: FE_PROFILE_PASS
```

---

**Next: Cook Mode + the remaining screens (Meal Plan, Shopping, Favorites, AI Companion, Settings, Notifications, Achievements, Admin) + the final audit — screenshot-gated.**
