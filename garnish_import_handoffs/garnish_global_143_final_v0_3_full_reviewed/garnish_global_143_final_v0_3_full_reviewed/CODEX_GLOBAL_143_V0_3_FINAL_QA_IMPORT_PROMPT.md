# Codex — Global 143 Final v0.3 QA + Local/Dev Import

Use only this handoff folder:
`_garnish_import_handoffs/garnish_global_143_final_v0_3_full_reviewed/`

Read these files:
- `recipes.global-143.all.fa.v0.3.FULL_REVIEWED.json`
- `ingredient-expansion.global-143.dedup.v0.3.json`
- `global-143.final-quality-audit.v0.3.json`

Rules:
1. Do NOT touch production.
2. Do NOT import before QA and dry-run pass.
3. Apply only to local/dev DB after explicit confirmation.
4. If any blocker remains, stop and report.

Required QA gates:
- recipe count = 143
- sequence range = 355–497 contiguous
- duplicate recipeId = 0
- duplicate slug = 0
- malformed JSON = 0
- unresolved ingredients = 0
- ingredientId/code mismatch = 0
- containsPork must be boolean for every recipe
- ingredient expansion must be idempotent/deduped
- forbidden user-facing text hits = 0
- placeholder/generic cooking-step phrases = 0
- no internal/debug/import/database text in display copy

Critical UI blocker to verify and fix:
The user observed imported Global 143 recipe pages missing the `مواد لازم` section. Before any final dev apply, investigate and fix the root cause:
- If RecipeIngredient rows are missing: fix importer to create them.
- If API omits ingredients: fix include/serializer.
- If frontend renderer expects old ingredient shape: fix mapper so Global 143 ingredients render in the existing `مواد لازم` section.
Do not hide the issue. Full recipes must show visible grouped ingredients before accordion sections.

Sample UI/API slugs to verify after dry-run/import into local/dev:
- classic-bakers-croissant
- smashed-avocado-toast
- korean-napa-cabbage-kimchi
- french-vanilla-macarons
- thai-massaman-chicken-curry
- uzbek-plov-osh
- roman-spaghetti-carbonara
- classic-beef-wellington
- peruvian-fish-ceviche
- oysters-on-the-half-shell
- georgian-khinkali
- indonesian-beef-rendang
- new-york-style-cheesecake
- danish-smorrebrod-herring

For every sample report:
- RecipeIngredient count > 0
- API payload contains ingredients
- UI visibly shows `مواد لازم`
- cooking mode steps are recipe-specific, not placeholders
- no internal/debug text visible

Output required:
- QA report
- ingredient expansion upsert/dedupe report
- ingredient rendering root cause and fix
- dry-run report
- changed files list
- final PASS/FAIL
