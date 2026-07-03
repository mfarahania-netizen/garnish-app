# Global 143 Final v0.3 Full Reviewed

Use this instead of all previous Global 143 packages.

## Files
- recipes.global-143.all.fa.v0.3.FULL_REVIEWED.json
- ingredient-expansion.global-143.dedup.v0.3.json
- global-143.final-quality-audit.v0.3.json
- global-143.changed-steps.v0.3.json
- CODEX_GLOBAL_143_V0_3_FINAL_QA_IMPORT_PROMPT.md

## Audit summary
- Recipes: 143
- Steps: 711
- Changed/normalized steps from v0.2: 412
- Placeholder step hits: 0
- Ingredient issues: 0
- Forbidden display terms: 0
- Duplicate recipeId: 0
- Duplicate slug: 0
- Ready for Codex dry-run: True
- Ready for production: false

## Placement
Extract to:
`garnish-app/_garnish_import_handoffs/garnish_global_143_final_v0_3_full_reviewed/`

Give Codex:
`_garnish_import_handoffs/garnish_global_143_final_v0_3_full_reviewed/CODEX_GLOBAL_143_V0_3_FINAL_QA_IMPORT_PROMPT.md`

Important: Codex must still verify/fix UI ingredient rendering because that issue is outside the JSON content.
