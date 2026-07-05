# Final 27 Recipe Trust Report

- generatedAt: 2026-07-05
- database scope: local/dev only
- production touched: no
- verdict: PASS

## Final Result

Original 85 reviewOnly queue is closed; public count returned to 589. Meze 50 remains separate.

## Counts

| Metric | Before | After |
|---|---:|---:|
| total recipes | 639 | 639 |
| active/public | 562 | 589 |
| draft/private/review | 77 | 50 |
| ingredient count | 1084 | 1084 |
| Meze public | 0 | 0 |

## Apply Summary

- restored count: 27
- patched count: 0
- renamed/reframed count: 0
- still reviewOnly count: 0
- deleted recipe count: 0
- new ingredient count: 0
- ingredientIds used for added markers: none

## Final State For All 27

| # | Final State | Slug | Title |
|---:|---|---|---|
| 1 | RESTORE_PUBLIC_AS_IS | avgolemono | آوگولمونو |
| 2 | RESTORE_PUBLIC_AS_IS | stamppot | استامپوت |
| 3 | RESTORE_PUBLIC_AS_IS | estamboli-polo | استانبولی پلو بدون گوشت |
| 4 | RESTORE_PUBLIC_AS_IS | spaghetti-al-limone | اسپاگتی آل لیمونه |
| 5 | RESTORE_PUBLIC_AS_IS | spaghetti-aglio-e-olio | اسپاگتی سیر و روغن |
| 6 | RESTORE_PUBLIC_AS_IS | meat-strudel | اشترودل گوشت |
| 7 | RESTORE_PUBLIC_AS_IS | imam-bayildi | امام بایلدی |
| 8 | RESTORE_PUBLIC_AS_IS | borscht | بورش |
| 9 | RESTORE_PUBLIC_AS_IS | irish-stew | خورش ایرلندی |
| 10 | RESTORE_PUBLIC_AS_IS | red-lentil-soup | سوپ عدس قرمز ترکی |
| 11 | RESTORE_PUBLIC_AS_IS | miso-soup | سوپ میسو |
| 12 | RESTORE_PUBLIC_AS_IS | minestrone-soup | سوپ مینسترونه |
| 13 | RESTORE_PUBLIC_AS_IS | fatteh | فته |
| 14 | RESTORE_PUBLIC_AS_IS | lasagna | لازانیا |
| 15 | RESTORE_PUBLIC_AS_IS | fish-and-chips | ماهی و چیپس |
| 16 | RESTORE_PUBLIC_AS_IS | piri-piri-chicken | مرغ پیری‌پیری |
| 17 | RESTORE_PUBLIC_AS_IS | maqluba | مقلوبه |
| 18 | RESTORE_PUBLIC_AS_IS | alfredo-pasta | پاستا آلفردو |
| 19 | RESTORE_PUBLIC_AS_IS | pasta-e-fagioli | پاستا ای فاجولی |
| 20 | RESTORE_PUBLIC_AS_IS | pesto-pasta | پاستا پستو |
| 21 | RESTORE_PUBLIC_AS_IS | polenta-con-funghi | پلنتا با قارچ |
| 22 | RESTORE_PUBLIC_AS_IS | pot-au-feu | پوت‌او‌فو |
| 23 | RESTORE_PUBLIC_AS_IS | pollo-al-ajillo | پویو آل آخیو |
| 24 | RESTORE_PUBLIC_AS_IS | pierogi | پیروگی لهستانی |
| 25 | RESTORE_PUBLIC_AS_IS | swedish-meatballs | کوفته سوئدی |
| 26 | RESTORE_PUBLIC_AS_IS | kofte | کوفتهٔ ترکی |
| 27 | RESTORE_PUBLIC_AS_IS | koenigsberger-klopse | کونیگسبرگر کلوپسه |

## QA Evidence

| Check | Result |
|---|---|
| local/dev DB guard | PASS |
| rollback generated before write | PASS |
| final27 audit before apply | PASS, 27/27 baseline-matched |
| final27 apply | PASS |
| final27 post-audit | PASS |
| final27 API/search smoke | PASS |
| unresolved public blocker | 0 |
| Gamaj Kabab regression | PASS |
| Qeymeh Rizeh Esfahani regression | PASS |
| AI residue CRITICAL/HIGH | PASS, 0/0 |
| forbidden Recipe/Ingredient create/upsert/delete scan | PASS |
| CTA regression tests | PASS, 16/16 |
| server build | PASS |
| web build | PASS |

## Generated Files

- `docs/qa/recipes/recipe-trust-final-27/preflight.md`
- `docs/qa/recipes/recipe-trust-final-27/final27_audit_before.md`
- `docs/qa/recipes/recipe-trust-final-27/final27_apply_report.md`
- `docs/qa/recipes/recipe-trust-final-27/final27_post_audit.md`
- `docs/qa/recipes/recipe-trust-final-27/final27_api_search_smoke.md`
- `docs/qa/recipes/recipe-trust-final-27/final27_rollback.json`
- `docs/qa/recipes/recipe-trust-final-27/final27_final_report.md`

## Guardrails Preserved

- production untouched
- recipe count unchanged
- ingredient count unchanged
- no recipe creation
- no ingredient creation
- no recipe deletion
- no Meze 50 publication
- no claim that the full 639-recipe archive is launch-ready

