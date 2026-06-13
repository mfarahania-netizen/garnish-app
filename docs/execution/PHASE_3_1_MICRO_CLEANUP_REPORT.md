# PHASE 3.1 — Route Fallback Token Cleanup (Micro)

**Date:** 2026-06-13 · **Task:** `PHASE_3_1_ROUTE_FALLBACK_TOKEN_CLEANUP` · **Branch:** `master`

> Micro-cleanup before Phase 4. Scope: fix the one remaining `color="orange"` in `RouteFallback`
> (App.jsx). No App.jsx redesign, no surface migration, no backend, no new features.

---

## 1. Files changed
| File | Change |
|------|--------|
| `apps/web/src/App.jsx` | `RouteFallback` loader color `orange` → `saffron` (GES brand palette) |

One file, one line.

## 2. Exact change
```diff
  function RouteFallback() {
    return (
      <Center h="60vh">
-       <Loader color="orange" />
+       <Loader color="saffron" />
      </Center>
    );
  }
```
`saffron` is the GES brand color registered in `theme/garnish-theme.js` (token-bound to `--g-color-brand-*`),
the same palette name adopted across the Phase-3 shell (Avatar, NavLink, login link). This replaces the
ad-hoc Mantine `orange` with the project's design-token-backed brand color — no raw hex/rgba introduced.

## 3. Build result
- `pnpm --filter ./apps/web run build` → **green** (Vite + PWA `generateSW`, 37 precache entries).
- `eslint App.jsx` → **0 errors**, 39 warnings (all pre-existing JSX-import false positives from the missing
  `eslint-plugin-react`; none introduced here).
- `"orange"` references in App.jsx after change: **0**.

## 4. Remaining hardcoded color / motion issues in the touched file (App.jsx)
All remaining items are **pre-existing and intentionally preserved** — outside this micro-cleanup's scope
(changing them would be an App.jsx redesign, explicitly forbidden):

| Lines | Item | Status |
|-------|------|--------|
| 72–73, 77, 78 | Legacy `virtualColor` palettes `navy` / `accent` / `tip` (hardcoded hex) | **Preserved** — legacy theme adapter; current un-migrated surfaces still reference these. Documented in the in-file comment (App.jsx:46–51). Retired per-surface during later GES phases. |
| 75–76 | Legacy `virtualColor` `glass` / `glassNav` (`rgba`) | **Preserved** — same legacy adapter rationale. |
| 150–153 | `PageWrapper` route-transition (`animate` / `transition: { duration: 0.2 }`) | **Preserved** — global page-transition wrapper, not the route-fallback; out of micro-cleanup scope. Candidate for a future `lib/motion` preset. |

No **new** hardcoded color or motion was introduced. The only element in scope (`RouteFallback`) is now token-compatible.

## 5. Confirmation
- **Phase 4 was NOT started.** This change is limited to the `RouteFallback` loader color only.
- App.jsx not redesigned; Home / AI Chat / Admin / Recipe Detail not migrated; backend untouched; no features added.

## 6. Status
**Phase 3.1 micro-cleanup: COMPLETE & VERIFIED.**
