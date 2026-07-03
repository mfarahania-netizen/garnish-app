# GRIS Repair 001-110 Clean Checkpoint Report

Generated for an isolated checkpoint candidate. No commit was created.

## Verdict

PASS as a fully reproducible clean checkpoint candidate.

- The reproducibility caveat is resolved.
- The GRIS 001-110 parser/apply path now uses only batch markdown, staging JSON, and existing Recipe rows in the guarded local/dev DB.
- `docs/qa/recipes/repair_working_pack_v1/` is no longer required for GRIS 001-110 reapply.
- `garnish_non_lite_recipe_completeness_audit_v1.*` files are no longer required for GRIS 001-110 reapply.
- Global 143 files remain excluded.

## Local/Dev DB Warning

The database changes are local/dev only. New environments will not receive the repaired `Recipe.gris` content from Git alone. They must rerun the checked-in parser/apply workflow against a guarded local/dev DB.

## Worktree Grouping

### A) GRIS Repair 001-110 Required

- `docs/qa/recipes/gris-repair-batches/non-drinks/garnish_gris_repair_batch_01_02_non_drinks_20_COMPLETE.md`
- `docs/qa/recipes/gris-repair-batches/non-drinks/garnish_gris_repair_batch_03_non_drinks_21_30_RTL.md`
- `docs/qa/recipes/gris-repair-batches/non-drinks/garnish_gris_repair_batch_04_non_drinks_31_40_RTL.md`
- `docs/qa/recipes/gris-repair-batches/non-drinks/garnish_gris_repair_batch_05_non_drinks_41_50_RTL.md`
- `docs/qa/recipes/gris-repair-batches/non-drinks/garnish_gris_repair_batch_06_non_drinks_51_60_RTL.md`
- `docs/qa/recipes/gris-repair-batches/non-drinks/garnish_gris_repair_batch_07_non_drinks_61_70_RTL.md`
- `docs/qa/recipes/gris-repair-batches/non-drinks/garnish_gris_repair_batch_08_non_drinks_71_80_RTL.md`
- `docs/qa/recipes/gris-repair-batches/non-drinks/garnish_gris_repair_batch_09_non_drinks_81_90_RTL.md`
- `docs/qa/recipes/gris-repair-batches/non-drinks/garnish_gris_repair_batch_10_non_drinks_91_100_RTL.md`
- `docs/qa/recipes/gris-repair-batches/non-drinks/garnish_gris_repair_batch_11_non_drinks_101_110_RTL.md`
- `apps/server/scripts/recipes/parse-gris-repair-markdown-batches.ts`
- `apps/server/scripts/recipes/gris-repair-common.ts`
- `apps/server/scripts/recipes/apply-gris-repair-001-110.ts`
- `docs/qa/recipes/gris-repair-batches/non-drinks/staging/gris_repair_001_110.staging.json`

### B) Frontend Renderer Required For Displaying Recipe.gris

- `apps/web/src/app/recipe/[id]/GrisRecipe.jsx`
- `apps/web/src/app/recipe/[id]/page.jsx`

Reason: the renderer now exposes GRIS detail content including visible steps on the recipe detail page, and the page wiring passes the recipe object to the GRIS renderer.

### C) Reports/Evidence Required

- `docs/qa/recipes/gris-repair-batches/non-drinks/staging/gris_repair_001_110.parse_report.md`
- `docs/qa/recipes/gris-repair-batches/non-drinks/apply/gris_repair_001_110.apply_report.md`
- `docs/qa/recipes/gris-repair-batches/non-drinks/apply/gris_repair_001_110.post_apply_verification.md`
- `docs/qa/recipes/gris-repair-batches/non-drinks/apply/gris_repair_001_110.ui_smoke_report.md`
- `docs/qa/recipes/gris-repair-batches/non-drinks/apply/gris_repair_001_110.rollback.json`
- `docs/qa/recipes/gris-repair-batches/non-drinks/apply/gris_repair_001_110.clean_checkpoint_report.md`

### D) Unrelated Global 143 / Old Audit / Other Changes To Exclude

| Path | Reason to exclude |
|---|---|
| `apps/server/package.json` | Adds a Global 143 script entry; not required for GRIS Repair 001-110. |
| `apps/server/scripts/recipes/global-143-qa-import-v0-1.js` | Global 143 QA/import workflow; unrelated. |
| `data/recipes/drafts/global-143/` | Global 143 source recipe drafts; unrelated. |
| `docs/qa/recipes/_audit_engine.cjs` | Broad non-lite audit tooling; not part of the requested clean include list. |
| `docs/qa/recipes/_audit_render.cjs` | Broad audit renderer; not part of the requested clean include list. |
| `docs/qa/recipes/garnish_non_lite_recipe_completeness_audit_v1.csv` | Broad audit output; no longer required by GRIS 001-110 parser/apply. |
| `docs/qa/recipes/garnish_non_lite_recipe_completeness_audit_v1.json` | Broad audit source; no longer required by GRIS 001-110 parser/apply. |
| `docs/qa/recipes/garnish_non_lite_recipe_completeness_audit_v1.md` | Broad audit output; not direct GRIS 001-110 evidence. |
| `docs/qa/recipes/global_143_db_apply_report_v0_1.json` | Global 143 evidence; unrelated. |
| `docs/qa/recipes/global_143_db_repair_apply_report_v0_3.json` | Global 143 repair evidence; unrelated. |
| `docs/qa/recipes/global_143_dry_run_import_report_v0_1.json` | Global 143 evidence; unrelated. |
| `docs/qa/recipes/global_143_dry_run_import_report_v0_3.json` | Global 143 evidence; unrelated. |
| `docs/qa/recipes/global_143_post_apply_qa_report_v0_1.json` | Global 143 evidence; unrelated. |
| `docs/qa/recipes/global_143_pre_apply_backup_v0_1.json` | Global 143 backup; unrelated. |
| `docs/qa/recipes/global_143_sample_fetch_report_v0_1.json` | Global 143 evidence; unrelated. |
| `docs/qa/recipes/global_143_sample_render_report_v0_1.json` | Global 143 evidence; unrelated. |
| `docs/qa/recipes/repair_working_pack_v1/` | Prior repair working pack; no longer required by GRIS 001-110 parser/apply. |
| `garnish_import_handoffs/` | Import handoff package; unrelated to the GRIS 001-110 checkpoint. |
| `docs/qa/recipes/gris-repair-batches/non-drinks/apply/gris_repair_001_110.apply_report.json` | Detailed JSON evidence; excluded because the requested include list keeps the MD report plus rollback JSON. |
| `docs/qa/recipes/gris-repair-batches/non-drinks/apply/gris_repair_001_110.post_apply_verification.json` | Detailed JSON evidence; excluded because the requested include list keeps the MD report. |
| `docs/qa/recipes/gris-repair-batches/non-drinks/apply/gris_repair_001_110.ui_smoke_report.json` | Detailed JSON evidence; excluded because the requested include list keeps the MD report. |
| `docs/qa/recipes/gris-repair-batches/non-drinks/apply/gris_repair_001_110.original_pre_repair_rollback.json` | Duplicate rollback copy; `gris_repair_001_110.rollback.json` is the canonical rollback file for checkpoint. |

## Git Diff Stat For Included Files Only

Tracked included files:

```text
apps/web/src/app/recipe/[id]/GrisRecipe.jsx | 34 ++++++++++++++++++++++++++---
apps/web/src/app/recipe/[id]/page.jsx       |  2 +-
2 files changed, 32 insertions(+), 4 deletions(-)
```

Untracked included files are not represented by `git diff --stat` until staged. They are listed explicitly in sections A and C.

## Verification Evidence

Commands verified during checkpoint preparation:

```text
git status --short
git diff --stat
git diff --name-only
node --env-file=.env -r ts-node/register/transpile-only scripts/recipes/parse-gris-repair-markdown-batches.ts
node --env-file=.env -r ts-node/register/transpile-only scripts/recipes/apply-gris-repair-001-110.ts
node --env-file=.env -r ts-node/register/transpile-only scripts/recipes/apply-gris-repair-001-110.ts --apply
npm.cmd --prefix apps/server run build
npm.cmd --prefix apps/web run build
rg -n 'recipe\.(create|createMany|upsert|delete|deleteMany)|INSERT\s+INTO\s+Recipe|prisma\.recipe\.create|createMany\(' apps/server/scripts/recipes/gris-repair-common.ts apps/server/scripts/recipes/parse-gris-repair-markdown-batches.ts apps/server/scripts/recipes/apply-gris-repair-001-110.ts
rg -n 'repair_working_pack|garnish_non_lite_recipe_completeness|global-143|Global 143|AUDIT_PATH|REPAIR_PACK_PATH|REVIEW_PATH|PROTECTED_PATH' apps/server/scripts/recipes/gris-repair-common.ts apps/server/scripts/recipes/parse-gris-repair-markdown-batches.ts apps/server/scripts/recipes/apply-gris-repair-001-110.ts
```

Results:

- Parser: PASS, parsed recipes `110`.
- Dry-run: PASS, planned updates `110`.
- Recipe count before/after dry-run: `589 -> 589`.
- Created recipes: `0`.
- Deleted recipes: `0`.
- Apply: PASS, updated existing recipes `110`.
- Recipe count before/after apply: `589 -> 589`.
- Post-apply API verification: PASS, `110/110`.
- Protected/review/lite touched: not checked with audit files because broad audit files are intentionally removed; no `garnish_lite_` recipeId is present in staging.
- UI smoke: PASS, `10/10`.
- Rollback file exists and contains `110` records from the current pre-apply local/dev DB state.
- Local/dev guard exists in `gris-repair-common.ts`.
- Apply path is transaction guarded with `prisma.$transaction`.
- Apply path updates only `Recipe.gris` using `tx.recipe.update({ where: { id }, data: { gris } })`.
- Forbidden operation scan: PASS, no create/upsert/createMany/delete/Recipe insert match in the GRIS repair scripts.
- Dependency scan: PASS, no `repair_working_pack`, broad audit, or Global 143 dependency remains in the GRIS repair scripts.
- Server build: PASS.
- Web build: PASS.

## Clean Include List

Use this exact include list for a clean checkpoint:

```text
docs/qa/recipes/gris-repair-batches/non-drinks/garnish_gris_repair_batch_01_02_non_drinks_20_COMPLETE.md
docs/qa/recipes/gris-repair-batches/non-drinks/garnish_gris_repair_batch_03_non_drinks_21_30_RTL.md
docs/qa/recipes/gris-repair-batches/non-drinks/garnish_gris_repair_batch_04_non_drinks_31_40_RTL.md
docs/qa/recipes/gris-repair-batches/non-drinks/garnish_gris_repair_batch_05_non_drinks_41_50_RTL.md
docs/qa/recipes/gris-repair-batches/non-drinks/garnish_gris_repair_batch_06_non_drinks_51_60_RTL.md
docs/qa/recipes/gris-repair-batches/non-drinks/garnish_gris_repair_batch_07_non_drinks_61_70_RTL.md
docs/qa/recipes/gris-repair-batches/non-drinks/garnish_gris_repair_batch_08_non_drinks_71_80_RTL.md
docs/qa/recipes/gris-repair-batches/non-drinks/garnish_gris_repair_batch_09_non_drinks_81_90_RTL.md
docs/qa/recipes/gris-repair-batches/non-drinks/garnish_gris_repair_batch_10_non_drinks_91_100_RTL.md
docs/qa/recipes/gris-repair-batches/non-drinks/garnish_gris_repair_batch_11_non_drinks_101_110_RTL.md
apps/server/scripts/recipes/parse-gris-repair-markdown-batches.ts
apps/server/scripts/recipes/gris-repair-common.ts
apps/server/scripts/recipes/apply-gris-repair-001-110.ts
docs/qa/recipes/gris-repair-batches/non-drinks/staging/gris_repair_001_110.staging.json
docs/qa/recipes/gris-repair-batches/non-drinks/staging/gris_repair_001_110.parse_report.md
docs/qa/recipes/gris-repair-batches/non-drinks/apply/gris_repair_001_110.apply_report.md
docs/qa/recipes/gris-repair-batches/non-drinks/apply/gris_repair_001_110.post_apply_verification.md
docs/qa/recipes/gris-repair-batches/non-drinks/apply/gris_repair_001_110.ui_smoke_report.md
docs/qa/recipes/gris-repair-batches/non-drinks/apply/gris_repair_001_110.rollback.json
docs/qa/recipes/gris-repair-batches/non-drinks/apply/gris_repair_001_110.clean_checkpoint_report.md
apps/web/src/app/recipe/[id]/GrisRecipe.jsx
apps/web/src/app/recipe/[id]/page.jsx
```

## Final Checkpoint Notes

- Do not include Global 143 files.
- Do not include broad audit experiments; GRIS 001-110 no longer needs them for reapply.
- Do not include local DB files, build output, screenshots, or temporary JSON evidence beyond the canonical rollback/staging JSON.
- Do not commit automatically from this report; stage only the clean include list after human review.
