# GRIS Repair 001-110 Apply Report

- mode: apply
- generatedAt: 2026-07-01T23:48:24.994Z
- database: postgresql://garnish:***@localhost:5432/garnish_db
- count before: 589
- count after: 589
- planned update count: 110
- updated recipe count: 110
- created recipe count: 0
- deleted recipe count: 0
- validation: PASS
- duplicate recipeIds: 0
- duplicate slugs: 0
- protected/review/lite check: not checked with audit files because broad audit files are intentionally not required; garnish_lite_ recipeId prefix remains blocked by parser validation

## Reproducibility Inputs

- Batch markdown files under `docs/qa/recipes/gris-repair-batches/non-drinks/*.md`.
- Staging JSON at `docs/qa/recipes/gris-repair-batches/non-drinks/staging/gris_repair_001_110.staging.json`.
- Existing Recipe rows in the guarded local/dev DB.
- No external audit/import package is required.

## Modified Field Mapping

- `Recipe.gris.story` from staging JSON parsed from batch markdown.
- `Recipe.gris.glance` and `Recipe.gris.firstLook` from staging JSON.
- `Recipe.gris.ingredients` from staging JSON, enriched with current DB RecipeIngredient identity by order.
- `Recipe.gris.whyItWorks`, `skillsLearned`, `steps`, `finish`, `troubleshooting`, `variations`, `keep`, `serveWith`, `faq`, and `nourishment` from staging JSON.
- `Recipe.gris.dietary.containsPork` and allergens preserved from the current DB Recipe row.

Untouched: RecipeIngredient rows, RecipeStep rows, Nutrition numeric rows, media, slug/admin identity, searchTerms, status/visibility, category/tags/mealTypes.

## Recipe IDs

| # | recipeId |
|---|---|
| 1 | `garnish_recipe_fa_2014_249aa268` |
| 2 | `garnish_recipe_fa_185_c892351b` |
| 3 | `garnish_recipe_fa_2099_2ce15e17` |
| 4 | `garnish_recipe_fa_121_b6f01192` |
| 5 | `garnish_recipe_fa_1496_5705c3de` |
| 6 | `garnish_recipe_fa_1332_682d694b` |
| 7 | `garnish_recipe_fa_1547_eade852f` |
| 8 | `garnish_recipe_fa_111_4cb37a1a` |
| 9 | `garnish_recipe_intl_022_ac4d3143` |
| 10 | `garnish_recipe_intl_039_29544b7d` |
| 11 | `garnish_recipe_fa_1272_b3180a59` |
| 12 | `garnish_recipe_intl_144_5774ae78` |
| 13 | `garnish_recipe_fa_1762_ecb03b4e` |
| 14 | `garnish_recipe_fa_1751_cd7bc7b8` |
| 15 | `garnish_recipe_fa_2018_2572b935` |
| 16 | `garnish_recipe_fa_2032_c2aacc2c` |
| 17 | `garnish_recipe_fa_1250_cb9a971c` |
| 18 | `garnish_recipe_intl_064_1aa2311f` |
| 19 | `garnish_recipe_fa_1196_6cbbd3af` |
| 20 | `garnish_recipe_fa_1214_189349a1` |
| 21 | `garnish_recipe_intl_120_ae775732` |
| 22 | `garnish_recipe_intl_101_b76754a7` |
| 23 | `garnish_recipe_fa_1296_5d4fca2c` |
| 24 | `garnish_recipe_intl_112_cb59927d` |
| 25 | `garnish_recipe_intl_062_ce31c267` |
| 26 | `garnish_recipe_fa_1521_13feed66` |
| 27 | `garnish_recipe_fa_126_76675c2f` |
| 28 | `garnish_recipe_fa_127_38980a7f` |
| 29 | `garnish_recipe_intl_063_30b082f3` |
| 30 | `garnish_recipe_intl_089_91d816cb` |
| 31 | `garnish_recipe_fa_2107_5f30a146` |
| 32 | `garnish_recipe_intl_140_e00e3df2` |
| 33 | `garnish_recipe_fa_92_397baf20` |
| 34 | `garnish_recipe_fa_86_ffcd0713` |
| 35 | `garnish_recipe_intl_053_54c002d0` |
| 36 | `garnish_recipe_intl_125_19f26215` |
| 37 | `garnish_recipe_fa_175_51f87cb3` |
| 38 | `garnish_recipe_intl_129_382f9727` |
| 39 | `garnish_recipe_intl_148_2f745b64` |
| 40 | `garnish_recipe_fa_181_40d368f2` |
| 41 | `garnish_recipe_fa_120_502ae408` |
| 42 | `garnish_recipe_intl_124_ee006e03` |
| 43 | `garnish_recipe_intl_071_48a67e24` |
| 44 | `garnish_recipe_intl_037_7cf2e346` |
| 45 | `garnish_recipe_intl_111_248a08a4` |
| 46 | `garnish_recipe_intl_031_7e902faf` |
| 47 | `garnish_recipe_intl_088_7da35d2c` |
| 48 | `garnish_recipe_fa_123_a52aadf1` |
| 49 | `garnish_recipe_fa_2022_ed370352` |
| 50 | `garnish_recipe_fa_176_60f55560` |
| 51 | `garnish_recipe_intl_128_22442750` |
| 52 | `garnish_recipe_intl_139_fb85376e` |
| 53 | `garnish_recipe_intl_113_e0e7753e` |
| 54 | `garnish_recipe_intl_099_594a1fb5` |
| 55 | `garnish_recipe_fa_1484_ccebf63e` |
| 56 | `garnish_recipe_fa_192_fe533328` |
| 57 | `garnish_recipe_fa_180_c301e88a` |
| 58 | `garnish_recipe_intl_034_3035ba70` |
| 59 | `garnish_recipe_fa_148_554e136f` |
| 60 | `garnish_recipe_fa_147_3b1b07c5` |
| 61 | `garnish_recipe_fa_79_792d1196` |
| 62 | `garnish_recipe_intl_095_c9024579` |
| 63 | `garnish_recipe_intl_123_e8fa3267` |
| 64 | `garnish_recipe_intl_036_e0780696` |
| 65 | `garnish_recipe_intl_115_bd72c652` |
| 66 | `garnish_recipe_intl_117_d8d3d0ac` |
| 67 | `garnish_recipe_intl_028_ecdcc65f` |
| 68 | `garnish_recipe_intl_070_ef1a1272` |
| 69 | `garnish_recipe_intl_084_fb10b1a9` |
| 70 | `garnish_recipe_intl_069_b980b37b` |
| 71 | `garnish_recipe_intl_012_46d4828e` |
| 72 | `garnish_recipe_fa_113_2a1debd0` |
| 73 | `garnish_recipe_intl_108_d102f5f2` |
| 74 | `garnish_recipe_intl_116_c3a0982f` |
| 75 | `garnish_recipe_intl_048_5b5471e4` |
| 76 | `garnish_recipe_intl_010_0e45be4c` |
| 77 | `garnish_recipe_intl_033_8acac046` |
| 78 | `garnish_recipe_intl_078_c3975f3a` |
| 79 | `garnish_recipe_intl_007_34f16382` |
| 80 | `garnish_recipe_intl_004_e65ccfe3` |
| 81 | `garnish_recipe_fa_96_730b7817` |
| 82 | `garnish_recipe_fa_173_ab17534c` |
| 83 | `garnish_recipe_intl_066_d22397d4` |
| 84 | `garnish_recipe_intl_056_1509959b` |
| 85 | `garnish_recipe_intl_065_d91803a7` |
| 86 | `garnish_recipe_intl_091_7dcadc00` |
| 87 | `garnish_recipe_intl_092_3046ff5e` |
| 88 | `garnish_recipe_intl_094_a48d62c1` |
| 89 | `garnish_recipe_intl_068_c9d33098` |
| 90 | `garnish_recipe_intl_087_afad4d60` |
| 91 | `garnish_recipe_intl_018_2d829900` |
| 92 | `garnish_recipe_intl_132_71d57108` |
| 93 | `garnish_recipe_intl_081_d8416e42` |
| 94 | `garnish_recipe_intl_086_a2184266` |
| 95 | `garnish_recipe_intl_061_0bfbb206` |
| 96 | `garnish_recipe_fa_1780_c3b8ce04` |
| 97 | `garnish_recipe_intl_136_76743d5b` |
| 98 | `garnish_recipe_intl_052_a57a621f` |
| 99 | `garnish_recipe_intl_118_9ecd21c7` |
| 100 | `garnish_recipe_fa_2082_eaf326bf` |
| 101 | `garnish_recipe_intl_040_7d7b90a1` |
| 102 | `garnish_recipe_intl_009_ab044ed1` |
| 103 | `garnish_recipe_fa_106_d9e3968a` |
| 104 | `garnish_recipe_intl_080_5dbc4315` |
| 105 | `garnish_recipe_intl_138_4f5d8e11` |
| 106 | `garnish_recipe_fa_115_ba80ef7c` |
| 107 | `garnish_recipe_intl_074_79385dd1` |
| 108 | `garnish_recipe_fa_1483_557ee839` |
| 109 | `garnish_recipe_intl_043_fbe26aba` |
| 110 | `garnish_recipe_intl_109_997edbdb` |

## Errors

- none
