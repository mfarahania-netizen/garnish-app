# P0-A Scope Reduction Report

## Verdict

[قطعی] `PASS_TO_PHASE_2`: تمام مسیرهای frozen snapshot طبقه‌بندی شده‌اند، تصمیم باز یا فایل توضیح‌نداده وجود ندارد و تنها تغییر generated از diff حذف شد. دامنهٔ product همچنان بزرگ است، اما هر فایل retained به یکی از GAR-LAUNCH-004 تا 009 یا boundary/test الزامی آن متصل است.

## Matrix validation

- Matrix: `docs/qa/release/p0-a/05_diff_scope_matrix.csv`
- Rows: `198`
- Blank required cells: `0`
- Duplicate paths: `0`
- Invalid classifications: `0`
- `NEEDS_COORDINATOR_DECISION`: `0`

| classification | rows |
|---|---:|
| `BOUNDARY_REQUIRED` | 44 |
| `CORE_REQUIRED` | 34 |
| `TEST_REQUIRED` | 67 |
| `REPORT_REQUIRED` | 17 |
| `GENERATED_REVERT` | 1 |
| `LEGACY_UNTRACKED_EXCLUDE` | 35 |

## Reduction performed

- [قطعی] `docs/qa/behavior/profile_l4_05_declared_qa_results.json` با `git restore --source=HEAD -- <path>` به base بازگردانده شد. این فایل فقط timestamp/result تولیدی تست داشت و نباید commit شود.
- [قطعی] tracked diff از ۱۱۷ فایل به ۱۱۶ فایل کاهش یافت؛ tracked line stat از `4753 insertions / 1053 deletions` به `4752 insertions / 1052 deletions` رسید.
- [قطعی] ۳۵ فایل قدیمی `docs/qa/launch/**` دست‌نخورده و خارج از staging باقی ماندند.
- [قطعی] هیچ build output، generated Prisma/client، `.env`، media/raw، recipe data یا ingredient data وارد scope نشد.
- [قطعی] post-reduction `git diff --check` با exit code صفر پایان یافت.

## Narrow recipe-domain exception

- [قطعی] `apps/server/src/recipes/recipes.service.ts` فقط analytics-runtime/provenance boundary را اعمال و aggregate بدون provenance را حذف می‌کند؛ هیچ recipe/ingredient record یا content را تغییر نمی‌دهد.
- [قطعی] `apps/server/src/recipes/recipes.service.spec.ts` فقط همان boundary را تست می‌کند.
- [قطعی] `apps/web/src/app/recipe/[id]/page.jsx` فقط ادعای مطلق و غیرقابل‌دفاع allergy safety را حذف می‌کند و به GAR-LAUNCH-005 متصل است.
- [قطعی] این سه مسیر تنها exception مجاز recipe-domain هستند؛ recipe/ingredient data، fixtures، media، nutrition و catalog content همچنان ممنوع‌اند.

## Reviewability risk

[قطعی] ۱۱۶ فایل tracked retained هنوز یک diff بزرگ و پرریسک برای review است. توجیه فنیِ فایل‌ها کافی است، اما reviewability نهایی فقط با commitهای atomic مرحلهٔ ۹، تست مستقل و گزارش‌های boundary/browser/adversarial حاصل می‌شود؛ این Phase به‌تنهایی merge approval نیست.

## Stop check

[قطعی] هیچ product domain نامرتبطِ بدون coupling evidence در matrix باقی نمانده است. Phase 2 می‌تواند فقط در ownership ثبت‌شدهٔ admin/analytics و coordinator ادامه یابد؛ هر فایل تازه باید قبل از edit به matrix/report اضافه شود.
