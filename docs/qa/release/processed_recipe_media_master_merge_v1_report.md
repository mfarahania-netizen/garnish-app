# Partial Processed Recipe Media Pack Merge Gate v1

## Verdict

PASS_WITH_KNOWN_INCOMPLETE_MEDIA_CONTRACT

The partial processed media pack is safe to merge to master. It adds only processed `cover.webp` recipe media plus the prior pack report. Build, tests, media safety checks, and limited authenticated visual smoke passed.

This does not complete the full recipe media contract. The known remaining gap is still 435 API `imageUrl` paths without committed/static media files.

## Base And Branch

- Base `origin/master`: `4f2c470f`
- Merged branch: `origin/release/processed-recipe-media-v1`
- Merged branch commit: `6b27815e`
- Integration branch: `release/processed-recipe-media-master-merge-v1`
- Merge commit: `merge: add partial processed recipe cover media pack`

## Changed Files

Allowed files only:

- `apps/web/public/data/media/recipes/**/cover.webp`
- `docs/qa/release/processed_recipe_media_commit_gate_v1_report.md`
- `docs/qa/release/processed_recipe_media_master_merge_v1_report.md`

Forbidden files observed: none.

## Media Safety Recheck

- `cover.webp` files: 134
- total size: 28.81 MB
- non-WebP files: 0
- files over 1 MB: 0
- files under 5 KB: 0
- raw/source folders: none
- code/data/env/script changes: none

Largest files:

| File | Bytes |
| --- | ---: |
| `chicken-pesto-pizza/cover.webp` | 489688 |
| `bacon-pizza/cover.webp` | 483774 |
| `pizza-margherita/cover.webp` | 482446 |
| `steak-pizza/cover.webp` | 446904 |
| `mahi-shekam-por/cover.webp` | 407464 |
| `indonesian-salad/cover.webp` | 395248 |
| `saffron-chicken-stew/cover.webp` | 385114 |
| `vegetable-noodles/cover.webp` | 349122 |
| `kashk-bademjan/cover.webp` | 344306 |
| `torsh-shami-gilani/cover.webp` | 343798 |
| `tahchin-goosht-bademjan/cover.webp` | 341634 |
| `morgh-torsh-gilani/cover.webp` | 324466 |
| `khoresh-kadoo/cover.webp` | 318704 |
| `kalam-polo-shirazi/cover.webp` | 317606 |
| `dandeh-kabab-kermanshahi/cover.webp` | 314746 |
| `sosis-bandari/cover.webp` | 312540 |
| `gamaj-kabab/cover.webp` | 311466 |
| `sabzi-polo-ba-mahi/cover.webp` | 303838 |
| `tahandaz-morgh/cover.webp` | 289742 |
| `gheimeh-nesar/cover.webp` | 287678 |

## Build Results

- `pnpm install --frozen-lockfile`: PASS
- `pnpm --dir apps/web build`: PASS
- `pnpm --dir apps/server build`: PASS

## Test Results

- `pnpm --dir apps/web exec vitest run src/components/auth/AuthForm.test.jsx`: PASS, 10 tests
- `pnpm --dir apps/web exec vitest run src/app/recipes/recipes.smoke.test.jsx src/components/ges/RecipeCard.dismiss.test.jsx`: PASS, 9 tests

## Minimal Authenticated Visual Smoke

Local/dev only:

- Backend: `http://localhost:3004`
- Web: `http://127.0.0.1:5185`
- Login: OTP dev flow with `SMS_PROVIDER=disabled` and `SMS_DEV_LOG_OTP=true`
- Mobile viewport: 390px

Results:

- `/recipes` reachable: PASS
- `/recipes` pagination visible: PASS
- `gheymeh-sibzamini` card real image renders: PASS
  - rendered source: `/data/media/recipes/gheymeh-sibzamini/cover.webp`
  - natural size: `1448x1086`
  - fallback: no
- `gamaj-kabab` card real image renders: PASS
  - rendered source: `/data/media/recipes/gamaj-kabab/cover.webp`
  - natural size: `1448x1086`
  - fallback: no
- `/recipe/garnish_recipe_fa_2054_be491f02` detail hero real image renders: PASS
  - rendered source: `/data/media/recipes/gheymeh-sibzamini/cover.webp`
  - natural size: `1448x1086`
- `مواد لازم` visible in detail: PASS
- `شروع پخت` CTA visible in detail: PASS
- horizontal overflow: no
- console runtime crash: no observed errors/warnings

## Explicit Warning

Full media contract is still incomplete.

Known remaining missing count: 435 API `imageUrl` paths do not yet have committed/static media files. This merge only makes the existing 134 processed cover files available on fresh master.

Do not claim all recipe images are fixed after this merge.

## Production Untouched Confirmation

- No production deploy
- No production DB mutation
- No migration
- No recipe/ingredient data change
- No code change
- No raw media commit
- No `food pic-gbt` commit
- No media script commit
- No `docs/qa/media` or `docs/qa/launch` commit
- No force push

## Master Push Status

Pending at report creation. Push is allowed only after this report commit and final safety check pass.

## Next Required Gate

Media Contract Completion / Missing 435 Resolution.

That next gate must either add/process the remaining media assets or remove/normalize `imageUrl` values that cannot resolve before launch.
