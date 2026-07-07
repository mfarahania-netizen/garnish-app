# Recipe Detail/Card UX Rebuild Against Master v1

Date: 2026-07-07

## Verdict

PASS_WITH_VISUAL_SMOKE_LIMITATION

The Recipe Detail/Card UX polish was rebuilt directly on fresh `origin/master` instead of applying the stale dirty-worktree patch.

## Base Master Hash

- Worktree: `C:\dev\garnish-recipe-ux-rebuild-v1`
- Branch: `release/recipe-detail-card-ux-rebuild-v1`
- Base hash: `40547459`

## Why Previous Patch Failed

The previous isolation sprint generated a patch from the dirty original worktree, but `git apply --check` failed on fresh `origin/master@40547459` for all four target files:

- `apps/web/src/app/recipe/[id]/page.jsx`
- `apps/web/src/app/recipes/page.jsx`
- `apps/web/src/components/ges/RecipeCard.jsx`
- `apps/web/src/components/ges/RecipeRail.jsx`

The old patch depended on context that no longer matched master, so this sprint rebuilt the UX changes manually and minimally against master.

## Files Changed

- `apps/web/src/app/recipe/[id]/page.jsx`
- `apps/web/src/app/recipes/page.jsx`
- `apps/web/src/components/ges/RecipeCard.jsx`
- `apps/web/src/components/ges/RecipeRail.jsx`
- `docs/qa/release/recipe_detail_card_ux_rebuild_v1_report.md`

## UX Changes Summary

- Recipe detail hero height increased from `248px` to `320px` so real food photos have more vertical room and crop less aggressively.
- Recipe detail save/share controls changed to a vertical stack so the top controls do not crowd the hero image.
- Recipe detail meta card was made slimmer and moved lower impact over the image by reducing text/icon sizing and overlap.
- Recipe cards now accept `imageUrl` and render the real recipe image when available.
- Recipe cards keep the branded plate placeholder as a safe fallback when no image exists or image loading fails.
- Compact recipe cards use a stable taller media slot for better two-column crop consistency.
- Full recipe cards use a more balanced media slot and tighter body padding to reduce the empty lower card feel.
- Recipe listing passes `imageUrl` into cards.
- Recipe rail passes `imageUrl` into cards.
- No API behavior, auth behavior, admin behavior, recipe data, ingredient data, media path generation, or asset files were changed.

## Explicit Excluded Files Confirmation

Confirmed not touched:

- `food pic-gbt/**`
- `apps/web/public/data/**`
- `apps/web/public/data/media/recipes/**`
- `apps/server/scripts/recipes/apply-food-pic-gbt-images.js`
- `docs/qa/media/**`
- `docs/qa/launch/**`
- `docs/qa/recipes/global_143_pre_apply_backup_v0_1.json`
- auth files
- admin/users files
- home/discover/favorites files
- settings/apiClient files
- recipe/ingredient data
- migrations
- generated files

## Build Results

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm --dir apps/web build` | PASS |
| `pnpm --dir apps/server build` | PASS |

## Test Results

| Test | Result |
| --- | --- |
| `pnpm --dir apps/web exec vitest run src/components/auth/AuthForm.test.jsx` | PASS, 10 tests |
| `pnpm --dir apps/web exec vitest run src/components/ges/RecipeCard.test.jsx` | NOT FOUND |
| `pnpm --dir apps/web exec vitest run src/components/ges/RecipeRail.test.jsx` | NOT FOUND |
| `pnpm --dir apps/web exec vitest run src/app/recipes/RecipesPage.test.jsx` | NOT FOUND |
| `pnpm --dir apps/web exec vitest run src/app/recipe/[id]/RecipeDetail.test.jsx` | NOT FOUND |

No new tests were invented in this sprint.

## Visual Smoke Results

Local app:

- Dev server: `http://127.0.0.1:5178`
- Viewport: `390x844`

Observed:

- `/recipes` redirected to `/login`, so recipe listing layout could not be visually verified without an authenticated app session.
- `/recipe/garnish_recipe_fa_2054_be491f02` loaded the route URL but did not expose visible recipe content in the smoke session.
- `/recipe/garnish_recipe_fa_1519_9d69f5f1` loaded the route URL but did not expose visible recipe content in the smoke session.
- No browser console errors were captured during the attempted smoke.
- No horizontal overflow was observed on the checked pages.

Result:

`PASS_WITH_VISUAL_SMOKE_LIMITATION`

The buildable code path is validated, but authenticated/full recipe UI must still be visually checked in a signed-in local session before merging to master.

## Known Limitations

- Recipe/card-specific test files are absent.
- Visual smoke could not confirm actual recipe cards/details because the local app session was unauthenticated or did not render recipe data in the smoke route.
- No screenshots were saved because this sprint forbids generated files beyond the report.

## Production Untouched Confirmation

Confirmed:

- No production deploy
- No DB mutation
- No migration
- No media/raw/image asset commit
- No recipe/ingredient data change
- No master push
- No force push

## Push Status

PUSHED

- Branch: `release/recipe-detail-card-ux-rebuild-v1`
- Implementation commit: `fce7f09c`
- Remote: `origin/release/recipe-detail-card-ux-rebuild-v1`
- Master push: not performed.

Note: local push output reported that `gitleaks` is not installed, so the hook-level staged secret scan was skipped. No secrets or production config files were changed in this sprint.
