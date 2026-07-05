# Public Recipe UI Text Audit

Date: 2026-07-05

## Data Source

Local/dev PostgreSQL DB via Prisma. Production was not touched.

## Gates

| Gate | Result |
| --- | ---: |
| Public recipes scanned | 639 |
| Missing ingredients | 0 |
| Old non-cook CTA `بپز` | 0 |
| Bad grammar `N مراحل ...` | 0 |
| Category echo sections | 0 |
| Isolated pantry sections | 0 |

## Representative Samples

| Recipe | Mode | CTA | Step Label | Ingredient Sections |
| --- | --- | --- | --- | --- |
| آب دوغ خیار | ASSEMBLE | شروع آماده‌سازی | ۵ مرحله آماده‌سازی | لبنیات و پایه کرمی، برای مواد میانی، برای سرو |
| آب پرتقال تازه | DRINK | شروع درست‌کردن | ۳ مرحله درست‌کردن | مواد اصلی |
| آبگوشت بزباش | COOK | شروع پخت | ۸ مرحله پخت | مواد پایه، گوشت و پروتئین، حبوبات و غلات |
| آبگوشت کشک | COOK | شروع پخت | ۸ مرحله پخت | مواد اصلی، مواد پایه، لبنیات و پایه کرمی |
| آجیل و کشمش و خرما | ASSEMBLE | شروع آماده‌سازی | ۳ مرحله آماده‌سازی | مواد اصلی |

## Verdict

PASS.
