# International Core 150 DB Import v0.6.0 Report

**Task:** DATA-RCP-I150-DB-IMPORT-INTERNATIONAL-CORE-150-V0-6-0 · **Date:** 2026-06-14 · **Owner:** BA / EL

## Final verdict
**INTERNATIONAL_CORE_150_DB_IMPORT_PASS**

150 international recipes imported into the dev DB → total **350** (200 preserved + 150 new). Idempotency, conflict-safety, and existing-corpus preservation all verified on the live dev DB. No new ingredient IDs, no unresolved ingredients, no medical/strict-diet claims, no DB migration, no destructive operation.

## Branch / commit
- **Start master:** `f4384442` (post-A6)
- **Branch:** `exec/data-rcp-i150-db-import-international-core-150`
- **Commit:** `<filled at commit>`
- **Master changed?** No — review branch only; merge is Founder-gated.

## Source folder verification
`garnish_recipe_international_core_150_draft_candidate_v0_6_0/` present at repo root with all **14** required files. Source folder itself is **not committed** (it is the Founder's unzipped input).

## Package validation
`recipes:validate:international-150` → **PASS**. 150 recipes; `phaseOneSequence` [205,354] contiguous (0 missing/extra/dup); 0 duplicate recipeId/slug/legacyId/titleFa; forbidden `lasagna-bolognese` absent; 1389 ingredient lines across 194 distinct dictionary IDs, all valid id+code in the frozen **1008** dictionary; 0 id/code mismatch; **0 new ingredient IDs**; **0 unresolved**; all steps have instructions; all 150 `readyForImport=true`; 0 medical/strict flags; 0 product-facing internal terms. The validator **recomputes every claim in `final_import_readiness_report`** from the parsed recipes and confirms no contradiction (report not blindly trusted).

## Existing DB state
Before import: **200 recipes**, **1008 ingredients** (exactly the expected baseline; DB = local `garnish_db`). User interactions present and preserved: 10 favorites, 5 recommendation exposures, 21 recipe-bearing meal slots.

## Import behavior
Transaction-wrapped, **create-only** for the 150 new recipeIds (reusing `mapRecipe`; `adminNote` re-stamped with corpus/source/sequence/slug metadata). DB identity guard (local `garnish_db` only). Dry-run wrote 0; first apply created **150** (→ 350). No update/delete/truncate/reset/cascade; no ingredient writes (existing dictionary IDs connected only).

## Idempotency verification
Second apply: **created 0 / skipped 150** (recognized by our `international-core-150-v0.6.0` source tag); DB stayed at 350. Importer's internal idempotency self-check: `secondRunInsertCount = 0`, `importIdempotencyVerified = true`.

## Final DB verification
`recipes:verify:international-150` → **PASS**: total **350**; 150 international recipes present by tag; all 150 intl ids present; **0** duplicate recipeId/slug/title across the whole DB; **200** non-intl recipes preserved; 5/5 imported slugs queryable by id; 5/5 existing slugs queryable; **0** dangling ingredient references on imported recipes.

## Ingredient validation
Every imported ingredient line references an existing dictionary `ingredientId` (connect-only) with a matching `code`; 0 invalid id, 0 invalid code, 0 id/code mismatch, **0 new IDs created**, 0 unresolved. Ingredient dictionary unchanged (1008).

## Duplicate validation
Within-150: 0 duplicate recipeId/slug/legacyId/titleFa. Against existing DB: 0 recipeId collisions, 0 slug collisions with a different recipe (importer conflict gate would block otherwise). Whole-DB post-import: 0 duplicate recipeId/slug/title.

## Safety / copy validation
0 medical-nutrition-claim flags, 0 strict-diet-planning flags, 0 product-facing internal terms, 0 unresolved ingredients, 0 food-inappropriate steps (per package readiness report, cross-checked). Nutrition policy `estimated_not_medical`. No diet-flag or allergen-gap issues.

## API / service verification
DB-level service verification via Prisma (`findUnique` by id, ingredient-relation integrity): imported recipes queryable, existing recipes still queryable, total = 350. (No dedicated HTTP count endpoint test added — the recipes controller/service specs are the known R19 set and were left untouched; verification is done through the data layer.)

## Artifact validation
`docs/qa/recipes/international_core_150_db_import_results_v0_6_0.json`: runMode `import`, inputRecipeCount 150, sequenceRange [205,354], existingDbRecipeCountBefore **200**, actualInsertCount **150**, dbRecipeCountAfter **350**, conflictCount 0, newIngredientIdsCreated 0, unresolvedIngredientCount 0, medicalNutritionClaimHits 0, strictDietPlanningTrueCount 0, transactionUsed **true**, destructiveOperationUsed **false**, dbMigrationRequired **false**, importIdempotencyVerified **true**, secondRunInsertCount **0**, apiVerification.total **350**, redactedFailureDetails **[]**. No secrets / DB URLs / user data / raw payloads.

## Static scans
Medical/strict-diet terms appear only in audit/report fields and validator denylists stating counts are zero / policy is forbidden — never in recipe-facing content. No real secrets, no committed `.env`.

## Tests / build
`international-core-150-import-validator.spec.ts` → **24/24** (validator positive + 15 negative-mutation cases + planImport idempotency/conflict). Full server suite: only the 4 known **R19** legacy specs fail (`recipes.service`, `recipes.controller`, `feature-store.service`, `ranking.service`); everything else green. `pnpm build` green. (ts-jest emits benign `allowJs` warnings when the spec requires the CLI scripts — warnings only, tests pass.)

## Adversarial review (4 lenses + synthesis)
DB-safety, validator-soundness, idempotency/conflict, scope-leak — **`anyBlocking: false`; 3 pass, 1 pass_with_minor; 0 blocking / 0 major.** Confirmed create-only with no destructive op, connect-only ingredients, sound DB identity guard, real (non-blind) readiness-report cross-check, correct idempotency + recipeId/slug conflict blocking, and the source package excluded from git. **Folded the meaningful minor findings:** the import artifact now **populates** `sampleExistingSlugsVerified` (was a hollow `[]` — now proves 5 existing recipes survive); the existence snapshot is re-read **inside** the transaction (closes a theoretical snapshot/txn race); the readiness `sequenceRange` cross-check now compares the report to the **parsed** range (not constants); added a `nonInternationalRecipeCount` field for clarity.

## Docs / risk updates
This report + the import doc (`docs/recipes/INTERNATIONAL_CORE_150_IMPORT_V0_6_0.md`) + the artifact are linked from `docs/README.md`. `RISK_REGISTER.md` and `WEEKLY_EXECUTION_REVIEW.md` have the import entry.

## What was not changed
- existing 200 recipes preserved
- no ingredient dictionary change
- no new ingredient IDs
- no recipe deletion
- no destructive DB operation
- no DB migration
- no AI change
- no recommendation ranking change
- no notification change
- no UI change
- no product rollout
- no R3/R4 closure

## Remaining gaps
- Popularity source status is `requires_live_web_verification` (package-declared; not part of DB import — no popularity data written).
- No dedicated HTTP recipe-count endpoint test (recipes controller/service specs are the R19 set, intentionally untouched); verification done at the data layer.
- The dev DB now holds 350 recipes; production import is a separate, Founder-gated operation (this task targeted the local/dev `garnish_db` only).
- ts-jest `allowJs` warnings when requiring the CLI scripts (benign).

## Stop condition
Stop here. Do not start another import batch, UI work, AI work, recommendation work, notification work, or unrelated fixes.
