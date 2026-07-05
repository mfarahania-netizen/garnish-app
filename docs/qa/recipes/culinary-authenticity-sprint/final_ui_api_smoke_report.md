# Final UI/API Smoke Report

- generatedAt: 2026-07-04T16:45:00Z
- environment: local/dev only
- production touched: no

## API Smoke

| Recipe | Endpoint | Status | Ingredients | Steps | Result |
|---|---|---:|---:|---:|---|
| گمج کباب | `/recipes/garnish_recipe_fa_104_7b4ced78` | 200 | 13 | 7 | PASS |
| قیمه‌ریزه اصفهانی | `/recipes/garnish_recipe_fa_170_44f0d2ad` | 200 | 13 | 7 | PASS |
| اسپاگتی کاربونارای رومی | `/recipes/garnish_recipe_global_143_135_2919e78e` | 200 | 6 | 6 | PASS |
| کیمچی کلم آماده | `/recipes/garnish_lite_fa_079_999c19be` | 200 | 1 | 3 | PASS |
| کیمچی کلم چینی | `/recipes/garnish_recipe_global_143_041_33abbd3b` | 200 | 12 | 5 | PASS |

## UI Smoke

| Recipe | URL | Materials visible | Steps visible | AI residue visible | Extra blocker | Result |
|---|---|---:|---:|---:|---|---|
| اسپاگتی کاربونارای رومی | `/recipe/garnish_recipe_global_143_135_2919e78e` | yes | yes | no | no cream-cheese leak; bad yolk/pecorino amounts not visible | PASS |
| گمج کباب | `/recipe/garnish_recipe_fa_104_7b4ced78` | yes | yes | no | egg regression not visible | PASS |

## Build

| Target | Command | Result |
|---|---|---|
| Server | `apps/server/node_modules/.bin/nest.CMD build` | PASS |
| Web | `apps/web/node_modules/.bin/vite.CMD build` | PASS |

Note: `pnpm build` was not used for the final verdict because this local workspace currently trips pnpm dependency approval/install checks before reaching the actual compiler. Direct package binaries were used to test the existing installed dependency graph.
