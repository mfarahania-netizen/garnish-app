# PHASE 3 — App Shell / Navigation Migration Report

**Date:** 2026-06-13 · **Scope:** GES Redesign Phase 3 (App Shell + Navigation only) · **Branch:** `master`
· **Commit:** `43f5c64` (`feat(GES-P3): migrate app shell + nav (MainLayout) to GES tokens + lib/motion presets`)

> Strict scope per Founder: App Shell, global layout, navigation (drawer/sidebar), header/top bar,
> bottom nav / mobile action area, route-shell consistency, using existing GES primitives where
> appropriate. **No** Home / AI-Chat / Admin / Recipe-Detail / Meal-Planner redesign; **no** new
> features; **no** business/strategy change; **no** health/vision/agentic claims.

---

## 1. Files changed
| File | Change | Type |
|------|--------|------|
| `apps/web/src/layouts/MainLayout.jsx` | Full token + motion migration of the app shell, side drawer, header, and bottom nav | Visual-only (no structural/behavioral change) |

Exactly **one** file changed. No backend files, no routing logic, no new files (besides this report).

## 2. Surfaces touched (all inside the shell)
- **Top bar / header** (`AppShell.Header`): menu toggle, centered logo, notification bell — color tokens only.
- **Side drawer / navigation menu** (`motion.div` overlay + panel): scrim, panel surface, shadow, radius,
  slide motion, the 3 menu groups (9 `NavLink`s), theme toggle, logout / login link.
- **Bottom nav (mobile action area)**: 5 tabs, glass surface, active/inactive color, press feedback, safe-area.
- **Route shell** (`AppShell.Main` → `<Outlet/>`): unchanged structurally; inherits tokenized chrome.

## 3. GES primitives / system assets used
The shell is built on Mantine structural components (`AppShell`, `NavLink`, `ActionIcon`, `Avatar`,
`Divider`) — swapping those to `components/ges/*` React primitives would be a structural redesign beyond
strict Phase-3 scope, so they were **kept** and instead **styled through the GES system**:

- **Design tokens** (`styles/tokens.css`): `--g-color-bg-surface`, `--g-color-border-subtle`,
  `--g-scrim-photo`, `--g-color-brand-600`, `--g-color-text-muted`, `--g-shadow-3`, `--g-radius-sheet`,
  `--g-radius-input`, `--g-space-1/2`, `--g-font-size-14`, and z-index tokens `--g-z-overlay`,
  `--g-z-sheet`, `--g-z-shelf`.
- **Motion presets** (`lib/motion.js`): `gentleFade` (overlay fade), `pressResponse` (tab tap),
  `duration.slow` + `ease.enter` (drawer slide). **No ad-hoc animation** authored outside `lib/motion`.
- **Base utilities** (`base.css`): `glass-nav`, `g-safe-bottom` (mobile safe-area inset for the bottom nav).
- **Theme palette**: Mantine accent `orange` → GES `saffron` (avatar, active nav, login link).

## 4. Before / after scan counts (`apps/web/src/layouts/MainLayout.jsx`)
| Metric | Before | After | Note |
|--------|:------:|:-----:|------|
| Hardcoded hex (`#rrggbb`) | 4 | **0** | all → tokens / Mantine palette names |
| Raw `rgba(...)` | 7 | **0** | scrim/borders/hovers → tokens |
| `animate` / `transition` / `keyframes` lines | 5 | **3** | the 3 remaining are framer-motion `animate` state props + one `transition` whose values come **from `lib/motion`** (`duration.slow`, `ease.enter`) — compliant, not ad-hoc. The removed 2 were inline CSS `transition: 'color 0.2s'` and a hardcoded drawer duration. |

- Remaining raw hex/rgba in file: **NONE**.
- Inline ad-hoc CSS `transition:` declarations: **NONE**.

## 5. Build result
- `pnpm --filter ./apps/web run build` → **green** (Vite build + PWA `generateSW`, 37 precache entries, `dist/sw.js` generated).
- `eslint MainLayout.jsx` → **0 errors**, 30 warnings — all pre-existing JSX-import false positives from the
  repo's eslint config lacking `eslint-plugin-react` (`jsx-uses-vars`); **none introduced by this change**.

## 6. RTL / a11y / mobile preservation
- Drawer keeps `direction: rtl`, physical `top/bottom/right` geometry, and `borderLeft` — opens from the
  right as before (RTL Persian unaffected).
- Bottom nav now carries `g-safe-bottom` (respects iOS/Android safe-area inset) — a mobile-reachability
  improvement, no layout regression.
- Dark mode still driven by Mantine `colorScheme` + `[data-theme="dark"]` tokens (no new JS color conditionals added).

## 7. Regression confirmation (required attestations)
- **No fake vision reintroduced:** repo-wide scan for `visionService|analyzeImage|simulated_vision|عکس یخچال` → **0** references. ✅
- **No unsafe AI / nutrition copy:** Phase 3 touched only `MainLayout.jsx` (shell chrome) — no AI/prompt/nutrition copy in scope or changed. ✅
- **No diagnostic-route regression:** backend untouched in Phase 3; `diagnostics.controller.ts` still carries `@Roles('admin')` (verified = 1) and the 6 internal recommendation routes remain admin-guarded. ✅
- **No new feature / no business or AI-policy change:** purely visual token + motion swap. ✅

## 8. Remaining risks / follow-ups (out of this scope)
- `App.jsx` `RouteFallback` still uses `<Loader color="orange" />` (route-loading spinner) — a 1-line
  token follow-up, intentionally **not** changed to avoid touching the theme adapter in `App.jsx`.
- A flat scrim token (vs. reusing `--g-scrim-photo`) would suit full-screen overlays better — noted as a
  token proposal in-code; **UX decision**, not CA's to make.
- Other surfaces (Home, AI Chat, Admin, Recipe Detail, Meal Planner) remain **un-migrated by design** —
  pending Founder approval for Phase 4.
- E1 git-history purge remains deferred (see `R-E1-HISTORY-DEAD-SECRETS` / `E1_SECRET_INCIDENT_STATUS.md`).

## 9. Status
**Phase 3 (Shell / Nav): COMPLETE & VERIFIED.** Stopping here per directive — **no Phase 4 without Founder approval.**
