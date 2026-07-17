# مستندات فعال Garnish

این پوشه فقط قراردادهای زنده، تصمیم‌های معماری و داده‌های ورودیِ واقعاً مصرف‌شده را نگه می‌دارد. مرجع وضعیت پیاده‌سازی، خود کد و تست‌های `master` است؛ گزارش‌های اجرای تاریخی، اسکرین‌شات‌ها و evidenceهای تولیدی در Git نگه‌داری نمی‌شوند.

## Household Core

- نیاز محصول و محدوده: [`product/household-v1/`](product/household-v1/)
- مدل دامنه، دسترسی، migration و threat model: [`architecture/household-v1/`](architecture/household-v1/)
- مرور امنیت و محدودیت‌های فعلی: [`security/household-v1/security_review.md`](security/household-v1/security_review.md)
- ماتریس حریم خصوصی: [`security/household-v1/privacy_scope_matrix.csv`](security/household-v1/privacy_scope_matrix.csv)

وضعیت ۱۴۰۵/۰۴/۲۶: هستهٔ مشترک، عضویت، دعوتِ متصل به شمارهٔ تأییدشده، خرید مشترک و کنترل مالکیت در `master` پیاده‌سازی شده‌اند و پشت feature flag پایلوت هستند. اتصال شماره به حساب Google و تحویل واقعی دعوت هنوز جزو محدودیت‌های عرضهٔ عمومی‌اند.

## قراردادها و راه‌اندازی

- راه‌اندازی محلی: [`dev/LOCAL_DEV_SETUP.md`](dev/LOCAL_DEV_SETUP.md)
- ریسک‌های باز: [`execution/RISK_REGISTER.md`](execution/RISK_REGISTER.md)
- قرارداد Event Envelope: [`adr/ADR-0001-canonical-event-envelope.md`](adr/ADR-0001-canonical-event-envelope.md)
- مرزهای پردازش اختیاری و provenance: [`architecture/p0-a/`](architecture/p0-a/)
- نگاشت analytics: [`analytics/E43_A2_EVENT_PRODUCER_MIGRATION_MAP.md`](analytics/E43_A2_EVENT_PRODUCER_MIGRATION_MAP.md)

## داده و artifactهای ماشین

- ورودی‌های authored و قرارداد GRIS: [`data-pilot/`](data-pilot/)
- سه JSON زیر فقط چون تست یا readiness داخلی آن‌ها را می‌خواند نگه‌داری می‌شوند:
  - `qa/ai/e47_a11b_output_safety_regression_results.json`
  - `qa/recommendation/e18_e43_a9_dev_traffic_shadow_experiment_results.json`
  - `qa/recommendation/e18_e43_a13_limited_dev_shadow_experiment_execution_results.json`

خروجی‌های تازهٔ QA باید محلی و موقت بمانند؛ برای هر بررسی، سند جدید دائمی نسازید.
