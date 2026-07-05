# Remaining 19 GRIS Diagnosis

- generatedAt: 2026-07-03
- source audit: `docs/qa/recipes/gris-repair-batches/final/gris_repair_full_completion_audit_final.md`
- source list: `docs/qa/recipes/gris-repair-batches/final/gris_repair_remaining_incomplete_list.csv`
- mode: diagnosis only
- DB modified: no
- recipes diagnosed: 19

## Summary

Final audit reports 589 total recipes, 96 Lite recipes excluded, 493 non-Lite recipes audited, 474 complete recipes, and 19 remaining incomplete recipes.

Diagnosis split:

| Repair type | Count | Meaning |
|---|---:|---|
| LEAK_CLEANUP | 9 | Internal/source/debug nutrition or safety source names leaked into user-facing GRIS copy. |
| GENERIC_COPY_PATCH | 9 | Boilerplate/generic phrase remains in otherwise complete recipe copy. |
| SECTION_COMPLETION | 1 | Required GRIS sections are missing/empty and need authored completion. |
| FULL_REWRITE | 0 | No remaining item requires full rewrite based on this final audit. |

## Diagnosis Table

| # | recipeId | slug | titleFa | sourceGroup | score | failedSections | exact issue | exact offending text | repair type | recommended fix |
|---:|---|---|---|---|---:|---|---|---|---|---|
| 1 | `garnish_recipe_fa_1342_ce4a8da3` | `saffron-chicken-stew` | خوراک مرغ زعفرانی | `phase-one-v0.6.1` | 80 | none | Internal/source name leak in `gris.whyItWorks[3].testedBecause`; user sees USDA/FSIS provenance instead of plain safety guidance. | `USDA FSIS: مرغ ۷۴°C / ۱۶۵°F` | LEAK_CLEANUP | Replace with Persian user-facing safety wording, e.g. `مرغ باید در مرکز کاملا پخته و بی‌رنگی خام نداشته باشد؛ اگر دماسنج دارید، مرکز آن باید به ۷۴ درجه برسد.` |
| 2 | `garnish_recipe_fa_1333_db68905d` | `fried-chicken` | مرغ سوخاری | `phase-one-v0.6.1` | 80 | none | Internal/source name leak in `gris.whyItWorks[3].testedBecause`. | `USDA: مرغ تا ۷۴°C` | LEAK_CLEANUP | Remove `USDA`; keep only practical safety cue for chicken doneness and crisp coating. |
| 3 | `garnish_recipe_fa_1077_1b3eec19` | `khorak-loobia-chiti` | خوراک لوبیا چیتی | `phase-one-v0.6.1` | 90 | none | Generic phrase in `gris.troubleshooting[4].fix`; phrase is too template-like. | `نمک و آبلیمو را در پایان تنظیم کنید؛ کمی پیازداغ روی آن هم عمق طعم می‌دهد.` | GENERIC_COPY_PATCH | Rewrite with dish-specific correction, e.g. `اگر خوراک تخت شد، چند قطره آبلیمو و کمی پیازداغ داغ اضافه کنید؛ نمک را فقط بعد از جاافتادن لوبیا بچشید.` |
| 4 | `garnish_recipe_fa_1270_70cc3cff` | `yatimcheh` | یتیمچه | `phase-one-v0.6.1` | 90 | none | Generic phrase appears twice: `gris.steps[5].tip` and `gris.ingredients[9].buyTip`. | `نمک را در پایان تنظیم کنید؛ بخشی از نمکِ مرحلهٔ بادمجان آبکشی شده و دقیق نیست.` / `بخشی از نمک صرفِ نمک‌زدنِ بادمجان می‌شود که بیشترش آبکشی و دور ریخته می‌شود؛ نمکِ خورش را جداگانه و در پایان تنظیم کنید.` | GENERIC_COPY_PATCH | Replace both with yَtimcheh-specific salt guidance tied to eggplant sweating and tomato reduction; avoid the exact boilerplate phrase. |
| 5 | `garnish_recipe_fa_2064_b5a2a37a` | `pesto-pasta` | پاستا پستو | `phase-one-v0.6.1` | 80 | none | Internal/source name leak in `gris.whyItWorks[3].testedBecause`; likely chicken safety note leaked into a pasta recipe section. | `USDA FSIS — دمای ایمن مرغ ۷۴°C` | LEAK_CLEANUP | Remove source name and verify whether chicken note belongs here at all. If pesto pasta is meatless, replace with pesto/emulsion-specific why-it-works text. |
| 6 | `garnish_recipe_fa_1237_3dff9aba` | `ash-sholeh-ghalamkar` | آش شله قلمکار | `phase-one-v0.6.1` | 90 | none | Generic phrase in `gris.ingredients[12].buyTip`. | `نمک را در پایان تنظیم کنید چون حبوبات و آب در حین پخت غلظت مزه را تغییر می‌دهند.` | GENERIC_COPY_PATCH | Rewrite with ash-specific guidance: salt after meat, legumes, rice and herbs have fully thickened; mention tasting after final simmer. |
| 7 | `garnish_recipe_intl_019_629698d5` | `tom-kha-gai` | تام کا گای (سوپ مرغ و نارگیل) | `international-core-150-v0.6.0` | 80 | none | Internal/source name leak in `gris.whyItWorks[2].testedBecause`. | `USDA FSIS — مرغ ایمن در ۷۴°C` | LEAK_CLEANUP | Replace with plain Persian safety note: chicken pieces must be fully cooked while coconut milk should not boil aggressively. |
| 8 | `garnish_recipe_intl_046_0c90256b` | `red-lentil-soup` | سوپ عدس قرمز ترکی | `international-core-150-v0.6.0` | 90 | none | Generic phrase in `gris.ingredients[4].buyTip`. | `آبِ سبزیجاتِ آماده یا قرصِ عصارهٔ سبزیجاتِ حل‌شده در آبِ جوش هر دو خوب‌اند؛ به شوریِ آن دقت کنید و نمک را در پایان تنظیم کنید.` | GENERIC_COPY_PATCH | Rewrite around lentil soup behavior: stock cubes vary in salt; taste after lentils collapse and before adding lemon/chili butter. |
| 9 | `garnish_recipe_fa_2054_be491f02` | `gheymeh-sibzamini` | قیمه سیب زمینی | `phase-one-v0.6.1` | 60 | none | Internal nutrition/source leak in `gris.nourishment.disclaimer`; exposes `USDA fdcId` and internal locked-source language. | `این اطلاعات صرفاً توصیفی و عمومی است و توصیهٔ پزشکی یا تغذیه‌ای محسوب نمی‌شود. مقادیر دقیق مواد مغذی تنها از موتور تغذیهٔ قفل‌شده به منبع (USDA fdcId) محاسبه می‌شود و در این متن عددی تولید نشده است.` | LEAK_CLEANUP | Replace disclaimer with user-facing copy only, e.g. `اطلاعات تغذیه‌ای این دستور تقریبی و عمومی است و جایگزین توصیهٔ پزشکی یا برنامهٔ تغذیه‌ای شخصی نیست.` |
| 10 | `garnish_recipe_fa_216_1bfdfe55` | `saffron-joojeh-kabab` | جوجه کباب زعفرانی | `phase-one-v0.6.1` | 80 | none | Internal/source name leak in `gris.whyItWorks[0].testedBecause`. | `USDA FSIS: مرغ تا ۷۴°C` | LEAK_CLEANUP | Remove source name; keep safety cue in Persian: center of chicken should be fully cooked and juicy, ideally ۷۴°C if measured. |
| 11 | `garnish_recipe_fa_1071_6e0696a6` | `kotlet-goosht` | کتلت گوشت | `phase-one-v0.6.1` | 80 | none | Internal/source name leak in `gris.whyItWorks[3].testedBecause`. | `انتقال حرارت در گوشت چرخ‌کرده — ایمنی USDA FSIS` | LEAK_CLEANUP | Replace with user-facing cooking-science copy: thin patties cook through faster; center should lose raw color while crust stays browned. |
| 12 | `garnish_recipe_fa_1224_c65df148` | `baghali-ghatogh` | باقلاقاتُق | `phase-one-v0.6.1` | 80 | none | Internal/source name leak in `gris.whyItWorks[2].testedBecause`; also includes source-style attribution in user copy. | `انعقاد پروتئین تخم‌مرغ (López-Alt) + حداقل ایمنیِ ۷۱ درجه (USDA FSIS)` | LEAK_CLEANUP | Remove source names. Convert to practical copy: egg should set gently in hot stew; avoid boiling hard so yolk/white texture stays soft. |
| 13 | `garnish_recipe_fa_1238_296fbec3` | `halim-gandom` | حلیم گندم | `phase-one-v0.6.1` | 90 | none | Generic phrase in `gris.ingredients[3].buyTip`. | `نمک را در پایان تنظیم کنید چون با تغلیظ‌شدن غذا شوری بالا می‌رود.` | GENERIC_COPY_PATCH | Rewrite with halim-specific cue: salt after wheat and meat fully stretch/thicken, because long stirring concentrates flavor. |
| 14 | `garnish_recipe_fa_1315_c324442d` | `dal-adas` | دال عدس | `phase-one-v0.6.1` | 90 | none | Generic phrase in `gris.ingredients[10].buyTip`. | `نمک را در پایان تنظیم کنید چون با غلیظ‌شدن خوراک شورتر حس می‌شود.` | GENERIC_COPY_PATCH | Rewrite around dal behavior: taste after red lentils break down and tamarind/lemon is added; avoid the exact generic phrase. |
| 15 | `garnish_recipe_fa_1816_dec0afbb` | `cream-of-chicken-soup` | سوپ شیر | `phase-one-v0.6.1` | 90 | none | Generic phrase in `gris.ingredients[12].buyTip`. | `چون آبِ مرغ و کره خودشان نمک می‌رسانند، نمک را در پایان تنظیم کنید.` | GENERIC_COPY_PATCH | Rewrite with cream-soup-specific language: taste after milk/cream and stock combine, because dairy softens salt perception while stock may already be salty. |
| 16 | `garnish_recipe_fa_2071_5391bddf` | `caesar-salad` | سالاد سزار | `phase-one-v0.6.1` | 80 | none | Internal/source name leak in `gris.whyItWorks[2].testedBecause`. | `USDA FSIS + McGee` | LEAK_CLEANUP | Remove source labels. Replace with practical safety/emulsion note depending on section intent: safe chicken handling if chicken Caesar, or egg/emulsion guidance if dressing-focused. |
| 17 | `garnish_recipe_fa_2103_d26d79d5` | `alfredo-pasta` | پاستا آلفردو | `phase-one-v0.6.1` | 90 | none | Generic phrase in `gris.keep.makeAhead`. | `سس آلفردو تازه بهترین است و خوب نگه نمی‌ماند؛ بهتر است مواد را آماده کنید و سس را لحظهٔ سرو بسازید.` | GENERIC_COPY_PATCH | Rewrite with Alfredo-specific make-ahead guidance: grate cheese and measure cream/butter ahead; build sauce fresh over low heat so it does not split. |
| 18 | `garnish_recipe_fa_168_8b2d9b86` | `abgoosht-matanjaneh-kermani` | آبگوشت متنجنه کرمانی | `phase-one-v0.6.1` | 90 | none | Generic phrase in `gris.ingredients[11].buyTip`. | `نمک را در پایان تنظیم کنید؛ آبگوشت با تبخیر شورتر می‌شود.` | GENERIC_COPY_PATCH | Rewrite with dish-specific cue: taste after meat, legumes, dried fruit/nuts and broth have concentrated; salt should follow final broth level. |
| 19 | `garnish_recipe_global_143_001_758db93a` | `classic-bakers-croissant` | کروسان کلاسیک لایه‌ای | `global-143-v0.3` | 72 | `variations|keep|serveWith|faq` | Four required GRIS sections are missing or empty: `gris.variations`, `gris.keep`, `gris.serveWith`, `gris.faq`. | `variations: empty`, `keep: empty`, `serveWith: empty`, `faq: empty` | SECTION_COMPLETION | Add authored croissant-specific content for variations, storage/recrisping, serving pairings, and FAQ. Do not rewrite ingredients/steps unless the section completion exposes a contradiction. |

## Repair Plan

1. Run a targeted sanitizer pass for the 9 `LEAK_CLEANUP` recipes. Remove only internal/source/debug terms from user-facing copy: `USDA`, `FSIS`, `fdcId`, source-locked nutrition wording, and source-name citations.
2. Run a targeted copy patch for the 9 `GENERIC_COPY_PATCH` recipes. Replace the exact generic phrase with dish-specific guidance while preserving section structure.
3. Complete the 4 missing croissant sections only. This is not a full rewrite unless later QA finds broken ingredients/steps.
4. Re-run final audit and verify counts:
   - remaining incomplete: 0
   - internal/debug leaks: 0
   - generic boilerplate phrases: 0
   - missing required GRIS section: 0

## Guardrails For The Next Repair Step

- Do not change recipe IDs, slugs, ingredients, or steps unless a targeted text fix requires a consistency correction.
- Do not expose source names, database identifiers, import/debug language, `fdcId`, or internal nutrition engine wording to users.
- For safety-temperature guidance, keep the practical safety cue but remove the source label.
- For generic salt/prep phrases, replace with dish-specific sensory timing and reason.
