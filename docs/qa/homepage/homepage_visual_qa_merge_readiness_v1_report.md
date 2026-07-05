# Homepage Visual QA & Merge Readiness Gate v1

Date: 2026-07-06  
Branch: `sprint/homepage-launch-redesign-v1-final`  
QA base commit: `3c9f978e`  
Local app: `http://localhost:5173/`  
Local API: `http://localhost:3000/`  
Verdict: `PASS_WITH_P2_LOAD_RISK`

## Scope

This QA covered the homepage launch redesign only:

- Mobile visual QA at `360`, `390`, `430`, `480`.
- First viewport content, search entry, hero recommendation, quick actions, meal/category rails, bottom nav.
- Drawer open state.
- Non-mutating navigation interactions.
- Forbidden user-facing copy scan.
- Console warning/error smoke.
- Local/dev only. No production access. No DB imports, migrations, recipe writes, or backend changes.

## Environment Notes

- The fresh sprint worktree had no local `.env`; server env was loaded from the existing local/dev env at `C:\dev\garnish-app\apps\server\.env`.
- The active `DATABASE_URL` was checked as local/dev before auth setup.
- Initial QA was blocked by an unrelated process occupying port `3000`; that process was stopped and the sprint worktree server was started successfully.
- Final running processes were from `C:\dev\garnish-homepage-launch-v1-final`.
- Auth used an existing local smoke account through the real `/login` UI. No user was created and no password reset was performed.

## Validation Commands

Previously run and passing in this gate:

```text
pnpm --dir apps/web build
pnpm --dir apps/server build
pnpm --dir apps/web exec vitest run src/app/home/home.smoke.test.jsx src/components/ges/RecipeCard.dismiss.test.jsx src/shell/navConfig.launch.test.js
```

Local health checks during final QA:

```text
GET http://localhost:3000/recipes?limit=1 -> 200
GET http://localhost:5173/ -> 200
```

## Screenshot Evidence

All final screenshots are viewport captures after the homepage reached ready state:

- `docs/qa/homepage/screenshots/visual-qa-v1/home-360-final.png`
- `docs/qa/homepage/screenshots/visual-qa-v1/home-390-final.png`
- `docs/qa/homepage/screenshots/visual-qa-v1/home-430-final.png`
- `docs/qa/homepage/screenshots/visual-qa-v1/home-480-final.png`
- `docs/qa/homepage/screenshots/visual-qa-v1/drawer-390-final.png`

## Viewport Results

| Width | Ready time | Main content | Search | Hero | Quick actions | Meal/category rails | Horizontal overflow | Forbidden copy |
|---:|---:|---|---|---|---|---|---|---|
| 360 | ~5.55s | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 390 | ~4.90s | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 430 | ~4.92s | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 480 | ~5.00s | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

## Interaction Results

| Interaction | Result | Notes |
|---|---|---|
| Search entry | PASS | `چی می‌خوای بپزی؟ — جستجو در دستورها` navigated to `/discover`. |
| Quick action: کشف غذاها | PASS | Navigated to `/discover`. |
| Quick action: برنامه | PASS | Navigated to `/plan`. |
| Quick action: لیست خرید | PASS | Navigated to `/shopping-list`. |
| Quick action: از دستیار بپرس | PASS | Navigated to `/assistant`. |
| Hero CTA | PASS | `دیدن دستور ...` navigated to `/recipe/...`. |
| Drawer open | PASS | Drawer showed profile summary, recipes, weekly plan, shopping list, favorites, assistant, taste review, settings, notifications, support, logout. |
| Save / dismiss buttons | NOT CLICKED | Intentionally skipped because they are stateful and can write local/dev user state. |
| Meal/category chips | SOURCE VERIFIED | Home maps meal chips to `/recipes?meal=...` and category chips to `/recipes?category=...`; Recipes page consumes those params. Browser click attempt timed out in the tool, so this is code-verified rather than interaction-verified. |

## Console / Network

- Browser console error/warning scan after successful interactions: PASS.
- No blocking console errors were observed during final homepage/search/hero/drawer checks.
- API health stayed `200`.

## UX Findings

### P2 - Initial Loading Is Noticeable

The homepage shows skeleton/loading for roughly `4.9s` to `6.6s` before the real homepage appears in local/dev. It resolves correctly and does not block merge by itself, but for launch polish this is still too visible for a command-center home screen.

Recommended follow-up:

- Profile `useHomeData` request fan-out.
- Cache or parallelize non-critical panels.
- Render above-the-fold greeting/search/quick actions from already-known user state before slower recommendation rails complete.

## Forbidden Copy Scan

No visible homepage copy contained:

- `debug`
- `internal`
- `database`
- `import`
- `source`
- `schema`
- `ai prompt`
- Persian equivalents scanned: `دیتابیس`, `ایمپورت`, `دیباگ`, `اسکیما`

## Merge Readiness

Status: `READY_FOR_PR_REVIEW_AND_MERGE_WITH_P2_LOAD_RISK`

This branch is visually merge-ready for the homepage launch redesign based on final viewport evidence and non-mutating interaction QA. The only recorded risk is load latency in local/dev, not layout breakage.

Do not push or merge `master` from this gate. If screenshots/report are committed, commit only this QA report and screenshot artifacts on `sprint/homepage-launch-redesign-v1-final`.
