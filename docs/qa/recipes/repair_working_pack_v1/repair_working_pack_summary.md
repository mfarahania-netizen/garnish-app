# Repair Working Pack v1

EXPORT ONLY. No recipes rewritten, no DB writes, no imports, no deletes, no production access.

## Counts

- repair target count: 365
- reviewRequired count: 7
- protected complete count: 121
- lite96 excluded: 96
- missing payload count: 0
- missing ingredients count: 0
- missing steps count: 0
- duplicate repair recipeId count: 0
- duplicate repair slug count: 0

## Top 20 Repair Targets

| # | Title | Recipe ID | Source | Score | Priority | Failed sections |
|---|---|---|---|---:|---|---|
| 1 | موهیتو کلاسیک | `garnish_recipe_fa_1519_9d69f5f1` | Phase One | 32 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq |
| 2 | اسموتی هندوانه | `garnish_recipe_fa_1564_e9a872de` | Phase One | 34 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq |
| 3 | شربت گلاب | `garnish_recipe_fa_1514_82bb4541` | Phase One | 34 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq |
| 4 | رد موهیتو | `garnish_recipe_fa_2039_b49f818c` | Phase One | 35 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq |
| 5 | لیموناد | `garnish_recipe_fa_1520_8cec648d` | Phase One | 35 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq |
| 6 | اسموتی توت‌فرنگی | `garnish_recipe_fa_1563_68a06056` | Phase One | 36 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq |
| 7 | خمیر پیتزا ایتالیایی | `garnish_recipe_fa_2014_249aa268` | Phase One | 36 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq |
| 8 | سمنو | `garnish_recipe_fa_185_c892351b` | Phase One | 36 | HIGH | glance, ingredients, whyItWorks, skills, finish, troubleshooting, keep/storage, faq |
| 9 | شربت خیار سکنجبین | `garnish_recipe_fa_1510_2d1f8557` | Phase One | 36 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq |
| 10 | شیر پسته | `garnish_recipe_fa_1555_00844d92` | Phase One | 36 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq |
| 11 | پیتزا مارگاریتا | `garnish_recipe_fa_2099_2ce15e17` | Phase One | 37 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq |
| 12 | شربت بهار نارنج | `garnish_recipe_fa_1513_1e7a7b4f` | Phase One | 37 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq |
| 13 | املت رب | `garnish_recipe_fa_121_b6f01192` | Phase One | 38 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq |
| 14 | رنگینک | `garnish_recipe_fa_1496_5705c3de` | Phase One | 38 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq |
| 15 | سیب زمینی سرخ کرده | `garnish_recipe_fa_1332_682d694b` | Phase One | 38 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq |
| 16 | کاچی | `garnish_recipe_fa_1547_eade852f` | Phase One | 38 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq |
| 17 | کته شمالی | `garnish_recipe_fa_111_4cb37a1a` | Phase One | 38 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq |
| 18 | آب دوغ خیار | `garnish_recipe_fa_1289_dccb626e` | Phase One | 39 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq |
| 19 | اسموتی طالبی | `garnish_recipe_fa_1554_6e31eecc` | Phase One | 39 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq |
| 20 | تورتیای اسپانیایی | `garnish_recipe_intl_022_ac4d3143` | International Core | 39 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq |

## Output Files

- `repair_targets_365.full-current-payload.json`
- `review_required_7.targeted-patch-payload.json`
- `complete_do_not_touch_121.protected-list.json`
- `repair_targets_365.index.csv`
- `repair_targets_365.by_priority.md`
- `repair_working_pack_summary.md`

## Validation

```json
{
  "generatedAt": "2026-07-01T18:26:34.553Z",
  "sourceOfTruth": "local/dev PostgreSQL DB via Prisma read-only export",
  "expectedCounts": {
    "needsFullGrisRepair": 365,
    "reviewRequired": 7,
    "completeDoNotTouch": 121,
    "lite96Excluded": 96
  },
  "auditCounts": {
    "needsFullGrisRepair": 365,
    "reviewRequired": 7,
    "completeDoNotTouch": 121,
    "lite96Excluded": 96
  },
  "repairTargetCount": 365,
  "reviewRequiredCount": 7,
  "protectedCompleteCount": 121,
  "missingPayloadCount": 0,
  "missingIngredientsCount": 0,
  "missingStepsCount": 0,
  "liteIncludedInRepairTargets": 0,
  "protectedIncludedInRepairTargets": 0,
  "duplicateRepairRecipeIds": [],
  "duplicateRepairSlugs": [],
  "duplicateReviewRecipeIds": [],
  "duplicateReviewSlugs": [],
  "everyRepairHasRecipeIdSlugTitleFa": true,
  "everyReviewHasRecipeIdSlugTitleFa": true,
  "ok": true
}
```
