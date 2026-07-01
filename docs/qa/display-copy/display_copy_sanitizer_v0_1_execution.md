# Display Copy Sanitizer v0.1 Execution Report

Generated: 2026-07-01

## Scope

- Target: local/dev `garnish_db@localhost` only.
- Production apply: no.
- Destructive operation: no.
- Recipe family: Lite Food 96.
- User-facing fields scanned: recipe description, tips, chef tips, common mistakes, serving suggestions, substitutions, FAQ, steps, and rendered GRIS JSON where present.

## Results

| Check | Result |
| --- | --- |
| Pre-apply validator | failed as expected |
| Lite recipes scanned | 96 |
| Affected recipes before apply | 96 |
| Contaminated display fields before apply | 666 |
| Fields patched in apply run | 540 |
| Contaminated display fields after apply | 0 |
| Affected recipes after apply | 0 |
| Post-apply validator | passed |

## UI Guard

- Lite Food recipes now render through a compact body instead of the full recipe richness accordion stack.
- Lite detection covers `contentType`, `dishType`, `adminNote.contentType`, and `garnish_lite_` IDs.
- The compact body renders title/meta, description, ingredient checklist, two to four steps, and a short safety/storage note.
- The full GRIS/full-flat richness sections, AI personalization entry, byline, and nutrition disclosure are not rendered for Lite Food pages.

## Sample Route Links

The app recipe route uses recipe IDs. Slugs are listed for traceability to the import source.

| Source slug | App route |
| --- | --- |
| `cold-mortadella-and-cheese-sandwich` | `/recipe/garnish_lite_fa_094_fde3c956` |
| `iced-matcha-latte` | `/recipe/garnish_lite_fa_054_40007b8f` |
| `feta-walnut-and-honey-on-bread` | `/recipe/garnish_lite_fa_004_ab5fbe9d` |

Direct DB spot-check for all three sample routes returned `hits=none`.

## Global Batch 01/02

- Batch 01 safe to import: no.
- Batch 02 safe to import: no.
- Reason: no `recipes.global-143.batch-01*.json` or `recipes.global-143.batch-02*.json` files were present under the checked handoff directories. Import remains blocked until the actual files are available and pass the display-copy validator.

## Verification

- `npm.cmd --prefix apps/server run display-copy:validate` passed.
- `npx.cmd vitest run "src/app/recipe/[id]/recipe.smoke.test.jsx"` passed: 9 tests.
- `npm.cmd --prefix apps/server run build` passed.
- `npm.cmd --prefix apps/web run build` passed.

