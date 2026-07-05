# Final UI/API Smoke Report

- generatedAt: 2026-07-03T14:03:04.910Z
- web build: PASS (vite build)
- server build: PASS (nest build)
- unit test: PASS (ingredientAmountDisplay.test.js, 3/3)
- public API probe: localhost:3000 responded, Meze recipe is intentionally not public because imported as draft/hidden.
- DB smoke:
  - recipe count: 639
  - ingredient count: 1084
  - recipeIngredient count: 5147
  - recipeStep count: 3086
  - Meze rows: 50
  - Meze public rows: 0
  - Meze non-draft rows: 0
  - Meze with ingredients: 50/50
  - Meze with steps: 50/50
- Meze ingredient relation audit: PASS; mismatch count 0
- substitution audit: PASS; unsafe replacements 0
- removability audit: PASS; essential removable 0; missing canRemove 0
- copy hard gate: PASS; critical 0; high repeated findings 59

## Smoke Samples
- meze50_01_olive-feta-garlic-dip: status=draft; public=false; ingredients=feta_cheese | green_olives_pitted | garlic_raw
- meze50_02_whipped-feta-with-chili-honey-and-pistachio: status=draft; public=false; ingredients=feta_cheese | olive_oil | honey
- meze50_11_crispy-feta-phyllo-bites: status=draft; public=false; ingredients=phyllo_dough | feta_cheese | honey | roasted_sesame_seeds
- meze50_44_charred-broccoli-with-lemon-tahini: status=draft; public=false; ingredient count repaired to staging count
- relation audit file contains full UTF-8 details: docs/qa/recipes/new-meze-50/import/meze_50_ingredient_relation_audit_after_repair.json
