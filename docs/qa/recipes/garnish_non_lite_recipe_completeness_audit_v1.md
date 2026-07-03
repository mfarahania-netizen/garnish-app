# Garnish Non-Lite Recipe Completeness Audit — v1

> AUDIT ONLY. No recipes rewritten, no imports, no DB writes. Read-only scoring of the live dev DB.
> Generated from `PostgreSQL garnish_db (local/dev)` — the single authoritative active source.

## 1. Summary

| Metric | Value |
|---|---|
| Total sources found | 6 |
| Total raw recipes found (DB) | 589 |
| Deduped recipes | 493 |
| Lite 96 excluded (intentional) | 96 |
| **Included non-lite recipes** | **493** |
| ✅ COMPLETE_DO_NOT_TOUCH | 121 |
| 🔧 NEEDS_FULL_GRIS_REPAIR | 365 |
| ❓ REVIEW_REQUIRED | 7 |
| Iranian origin | 187 |
| Foreign origin | 306 |
| Unknown origin | 0 |

### By source group

| Group | Found | Needs repair |
|---|---|---|
| Phase One | 200 | 89 |
| International Core | 150 | 134 |
| Global 143 | 143 | 142 |

## 2. Reliability of this audit

- **Reliable.** Source = live dev DB (589 recipes), the only source the app reads. All draft/active/handoff JSON files mirror DB subsets and were de-duplicated, so nothing is double-counted.
- Calibration validated against the user's named references:
  - COMPLETE (matched user intent): جوجه کباب زعفرانی (97), اکبر جوجه (94), چلو کباب کوبیده (97).
  - NEEDS_REPAIR (matched user intent): مرغ شکم‌پر (42).
  - قیمه سیب‌زمینی scores 97 but carries a localized `fdcId` / "قفل‌شده به منبع" copy leak → routed to REVIEW (targeted copy fix, NOT a full rebuild).
- Global 143 re-audited against actual content (per spec, prior PASS reports were ignored). All 143 are missing FAQ + variations and have <4 whyItWorks and <4 troubleshooting — confirming the weakness is real, not a scoring artifact.

## 3. Sources discovered

| Source | Path | Count | Kind | In audit? | Reason |
|---|---|---|---|---|---|
| PostgreSQL live DB (garnish_db, local/dev) | `apps/server/.env DATABASE_URL=...localhost:5432/garnish_db` | 589 | active | yes | Authoritative source the app reads. |
| data/recipes/active/recipes.fa.phase-one.200.json | `data/recipes/active/recipes.fa.phase-one.200.json` | 200 | active-data-file | no | Mirrors DB Phase One 200; DB is authoritative (dedup). |
| data/recipes/active/recipes.fa.phase-one.json | `data/recipes/active/recipes.fa.phase-one.json` | 122 | legacy | no | Strict subset of the 200; dedup against DB. |
| data/recipes/drafts/global-143/recipes.global-143.all.fa.final.json | `data/recipes/drafts/global-143/recipes.global-143.all.fa.final.json` | 143 | draft | no | Mirrors DB Global 143; DB is authoritative (dedup). |
| garnish_recipe_international_core_150_draft_candidate_v0_6_0 (recipes file) | `garnish_recipe_international_core_150_draft_candidate_v0_6_0/recipes.international.core-150.draft-candidate.v0.6.0.json` | 150 | draft | no | Mirrors DB Intl Core 150; DB is authoritative (dedup). |
| data/lite-food/v0.3/lite-food-96 | `data/lite-food/v0.3/lite-food-96.recipe-shaped.with-ingredient-expansion.v0.3.json` | 96 | lite | no | Intentional Lite Food 96 — excluded per spec. |
| garnish_import_handoffs/garnish_global_143_final_v0_3_full_reviewed | `garnish_import_handoffs/.../recipes.global-143.all.fa.v0.3.FULL_REVIEWED.json` | 143 | handoff | no | Import handoff for Global 143; dedup against DB. |
| packages/shared/data/recipes_clean.json (seed) | `packages/shared/data/recipes_clean.json` | 124 | seed | no | Old seed set (124 legacy excerpt/content recipes); superseded by GRIS DB recipes. |
| apps/server/prisma/dev.db (SQLite) | `apps/server/prisma/dev.db` | stale | legacy | no | Stale June-2 SQLite dev artifact; not the active datasource. |
| data/recipes/archive (122 v0.5.4) | `data/recipes/archive/recipes.fa.phase-one.122.v0.5.4.json` | 122 | archive | no | Archived older subset; dedup. |

## 4. NEEDS_FULL_GRIS_REPAIR — top 30 by priority

| # | Title | Group | Cuisine | Score | Priority | Failed sections | Key blockers |
|---|---|---|---|---|---|---|---|
| 1 | موهیتو کلاسیک | Phase One | Iranian | 32 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq | — |
| 2 | شربت گلاب | Phase One | Iranian | 34 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq | — |
| 3 | اسموتی هندوانه | Phase One | Iranian | 34 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq | — |
| 4 | لیموناد | Phase One | Iranian | 35 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq | — |
| 5 | رد موهیتو | Phase One | Iranian | 35 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq | — |
| 6 | شربت خیار سکنجبین | Phase One | Iranian | 36 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq | — |
| 7 | شیر پسته | Phase One | Iranian | 36 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq | — |
| 8 | اسموتی توت‌فرنگی | Phase One | Iranian | 36 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq | — |
| 9 | سمنو | Phase One | Iranian | 36 | HIGH | glance, ingredients, whyItWorks, skills, finish, troubleshooting, keep/storage, faq | — |
| 10 | خمیر پیتزا ایتالیایی | Phase One | Foreign | 36 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq | — |
| 11 | شربت بهار نارنج | Phase One | Iranian | 37 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq | — |
| 12 | پیتزا مارگاریتا | Phase One | Foreign | 37 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq | — |
| 13 | کته شمالی | Phase One | Iranian | 38 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq | — |
| 14 | املت رب | Phase One | Iranian | 38 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq | — |
| 15 | سیب زمینی سرخ کرده | Phase One | Iranian | 38 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq | — |
| 16 | رنگینک | Phase One | Iranian | 38 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq | — |
| 17 | کاچی | Phase One | Iranian | 38 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq | — |
| 18 | کباب تابه‌ای گوشت | Phase One | Iranian | 39 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq | — |
| 19 | کباب ترش | Phase One | Iranian | 39 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq | — |
| 20 | شیرین‌پلو (مرصع‌پلو) | Phase One | Iranian | 39 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq | — |
| 21 | زیره‌پلو کرمانی | Phase One | Iranian | 39 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq | — |
| 22 | آب دوغ خیار | Phase One | Iranian | 39 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq | — |
| 23 | مرغ ترش گیلانی | Phase One | Iranian | 39 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq | — |
| 24 | دیتاکس واتر | Phase One | Iranian | 39 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq | — |
| 25 | اسموتی طالبی | Phase One | Iranian | 39 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq | — |
| 26 | سالاد مرغ | Phase One | Iranian | 39 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq | — |
| 27 | سالاد سیب زمینی | Phase One | Iranian | 39 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq | — |
| 28 | سس بشامل | Phase One | Foreign | 39 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq | — |
| 29 | سس همبرگر | Phase One | Iranian | 39 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq | — |
| 30 | تورتیای اسپانیایی | International Core | Foreign | 39 | HIGH | glance, whyItWorks, skills, finish, troubleshooting, keep/storage, faq | — |

## 5. REVIEW_REQUIRED (7)

| Title | Group | Score | Why uncertain |
|---|---|---|---|
| خوراک لوبیا چیتی | Phase One | 97 | Score 97 (rich content) but has a localized copy defect needing a targeted fix only: generic phrase: در پایان تنظیم کنید. Not a full-GRIS-rebuild candidate. |
| یتیمچه | Phase One | 94 | Score 94 (rich content) but has a localized copy defect needing a targeted fix only: generic phrase: در پایان تنظیم کنید. Not a full-GRIS-rebuild candidate. |
| دال عدس | Phase One | 97 | Score 97 (rich content) but has a localized copy defect needing a targeted fix only: generic phrase: کنترل حرارت. Not a full-GRIS-rebuild candidate. |
| قیمه سیب زمینی | Phase One | 97 | Score 97 (rich content) but has a localized copy defect needing a targeted fix only: internal term leak: fdcId; internal term leak: قفل‌شده به منبع. Not a full-GRIS-rebuild candidate. |
| پیتزا مرغ و پستو | Phase One | 97 | Score 97 (rich content) but has a localized copy defect needing a targeted fix only: internal term leak: fdcId; internal term leak: موتور قفل‌شده. Not a full-GRIS-rebuild candidate. |
| پاستا آلفردو | Phase One | 97 | Score 97 (rich content) but has a localized copy defect needing a targeted fix only: generic phrase: مواد را آماده کنید. Not a full-GRIS-rebuild candidate. |
| کروسان کلاسیک لایه‌ای | Global 143 | 77 | Score in 75-84 review band (77); borderline section coverage: whyItWorks, troubleshooting, keep/storage, faq |

## 6. COMPLETE_DO_NOT_TOUCH (121)

Full list in `garnish_non_lite_recipe_completeness_audit_v1.json` → `completeDoNotTouch[]`. Sample:

| Title | Group | Score | Confidence |
|---|---|---|---|
| خورشت کرفس | Phase One | 97 | HIGH |
| خورشت آلو اسفناج | Phase One | 97 | HIGH |
| کتلت گوشت | Phase One | 97 | HIGH |
| اشکنه | Phase One | 97 | HIGH |
| ته چین مرغ | Phase One | 97 | HIGH |
| خورشت سیب | Phase One | 97 | HIGH |
| کدو پلو مازندرانی | Phase One | 97 | HIGH |
| کباب تابه‌ای مرغ | Phase One | 97 | HIGH |
| شیشلیک (کباب دنده) | Phase One | 97 | HIGH |
| کباب بختیاری | Phase One | 97 | HIGH |
| کباب چنجه | Phase One | 97 | HIGH |
| آش دوغ | Phase One | 97 | HIGH |
| آش شله قلمکار | Phase One | 97 | HIGH |
| ترش‌شامی گیلانی | Phase One | 97 | HIGH |
| کاله‌جوش (کله‌جوش) | Phase One | 97 | HIGH |

## 7. Repeated sentence clusters (>=3 recipes)

| Sentence (truncated) | Recipes |
|---|---|
| این توضیح فقط برای شناخت کلی غذاست و عدد تغذیه‌ای قطعی ارائه نمی‌کند | 63 |
| اطلاعات غذایی این دستور کیفی و آموزشی است؛ عددهای تغذیه‌ای نباید حدسی روی صفحه نمایش داده شوند | 40 |
| اطلاعات غذایی این دستور کیفی و آموزشی است و عددها نباید حدسی نمایش داده شوند | 40 |
| پُرپروتئین این اطلاعات عمومی و آشپزی است، نه توصیهٔ پزشکی | 35 |
| کنترل حرارت، بافت را حفظ می‌کند وقتی حرارت با نوع ماده هماهنگ باشد، غذا خشک یا آبکی نمی‌شود | 23 |
| استراحت کوتاه بعد از پخت، مزه را متعادل می‌کند چند دقیقه مکث کمک می‌کند آب و چربی دوباره در بافت غذا پخش شود | 23 |
| قبل از سرو، غذا را بچشید و فقط در صورت نیاز نمک یا اسید را کم‌کم تنظیم کنید | 23 |
| این نسخه برای آشپز خانگی نوشته شده و روی نشانه‌های حسی، حرارت درست و زمان استراحت تکیه دارد | 10 |
| استراحت، بافت را پایدار می‌کند وقتی دسر از حرارت دور می‌شود، نشاسته، چربی و رطوبت فرصت پیدا می‌کنند دوباره متعادل شوند | 10 |
| حرارت ملایم خطای پخت را کم می‌کند بیشتر دسرها با شوک حرارتی ترک می‌خورند یا سفت می‌شوند | 10 |
| در ظرف تمیز، با تزئین ساده و مقدار کنترل‌شده سرو شود | 10 |
| دسر خوب معمولاً با کمی صبر بهتر می‌شود؛ برش زودهنگام بزرگ‌ترین دشمن ظاهر تمیز است | 10 |
| در ظرفِ دربسته در یخچال ۳ تا ۴ روز | 9 |
| در ظرفِ دربسته در یخچال (≤۴ درجه) تا ۳ تا ۴ روز | 8 |
| در ظرفِ دربسته در یخچال (≤۴ درجه) ۳ تا ۴ روز | 6 |
| در ظرف دربسته در یخچال ۳ تا ۴ روز | 5 |
| گیاهی منبع پروتئین گیاهی منبع فیبر این اطلاعات عمومی و آشپزی است، نه توصیهٔ پزشکی | 3 |
| پُرپروتئین بدونِ گلوتن این اطلاعات عمومی و آشپزی است، نه توصیهٔ پزشکی | 3 |

## 8. Top blocker-phrase hits (aggregate)

| Blocker | Recipes hit |
|---|---|
| generic phrase: کنترل حرارت | 36 |
| generic phrase: کنترل حرارت، بافت را حفظ می‌کند | 23 |
| generic phrase: وقتی حرارت با نوع ماده هماهنگ باشد، غذا خشک یا آبکی نمی‌شود | 23 |
| generic phrase: استراحت کوتاه بعد از پخت، مزه را متعادل می‌کند | 23 |
| generic phrase: چند دقیقه مکث کمک می‌کند آب و چربی دوباره در بافت غذا پخش شود | 23 |
| generic phrase: تشخیص نشانه پایان پخت | 23 |
| generic phrase: تنظیم مزه نهایی | 23 |
| generic phrase: در پایان تنظیم کنید | 3 |
| internal term leak: fdcId | 2 |
| generic phrase: مواد را آماده کنید | 2 |
| internal term leak: قفل‌شده به منبع | 1 |
| internal term leak: موتور قفل‌شده | 1 |

## 9. Output files

- `docs/qa/recipes/garnish_non_lite_recipe_completeness_audit_v1.json` — full structured audit
- `docs/qa/recipes/garnish_non_lite_recipe_completeness_audit_v1.md` — this report
- `docs/qa/recipes/garnish_non_lite_recipe_completeness_audit_v1.csv` — flat per-recipe table
- `docs/qa/recipes/_audit_engine.cjs` / `_audit_render.cjs` — reproducible read-only scripts

---
_Hard stop per spec: no rewrites, no imports, no DB writes. Audit only._