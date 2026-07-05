# Non-Cooking CTA Audit

- generatedAt: 2026-07-04
- source: local/dev PostgreSQL public recipes
- total public recipes checked: 562
- recipes moved away from `بپز`: 121
- verdict: PASS

## Mode Counts

| Mode | Count | CTA behavior |
|---|---:|---|
| COOK | 441 | `بپز` |
| DRINK | 46 | `درست کن` |
| NO_COOK_SIMPLE | 74 | sticky cook CTA hidden; low-emphasis preparation details shown |
| ASSEMBLE | 1 | `چیدمان کن` |

## Sample Non-Cook/Drink Rows

| Slug | Title | Mode | CTA |
|---|---|---|---|
| mango-yogurt-smoothie | اسموتی انبه و ماست | DRINK | درست کن |
| mint-limeade | شربت آبلیمو و نعنا | DRINK | درست کن |
| fresh-orange-juice | آب پرتقال تازه | DRINK | درست کن |
| classic-mojito | موهیتو کلاسیک | DRINK | درست کن |
| bread-with-dates-and-sesame | نان و خرما و کنجد | NO_COOK_SIMPLE | جزئیات آماده‌سازی |
| feta-walnut-and-honey-on-bread | پنیر و گردو و عسل روی نان | NO_COOK_SIMPLE | جزئیات آماده‌سازی |
| persian-breakfast-plate | بشقاب صبحانه پنیر و سبزی و گوجه | NO_COOK_SIMPLE | جزئیات آماده‌سازی |
| morning-nut-raisin-and-date-mix | آجیل و کشمش و خرما | NO_COOK_SIMPLE | جزئیات آماده‌سازی |
| mexican-street-corn-cup | ذرت مکزیکی فنجانی | ASSEMBLE | چیدمان کن |

## False Positive Fixes Caught During Audit

- `قاشق چای‌خوری` no longer makes ordinary recipes look like tea/drinks.
- Ingredient metadata such as `bottled lemon juice` no longer makes salads or stews look like drinks.
- `lite_group_snack_drink_side` no longer makes every snack a drink.
- Dessert tags containing `شربت/شربتی` no longer make syrup desserts drinks.

