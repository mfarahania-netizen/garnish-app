# Public 639 Recipe UI Audit

Date: 2026-07-05

## Scope

Local/dev DB only. No production access. No recipe data modification.

## Results

| Gate | Result |
| --- | ---: |
| Public recipes scanned | 639 |
| Missing ingredients | 0 |
| Noisy category echoes | 0 |
| Ordinary isolated sections | 0 |
| Non-cook CTA `بپز` | 0 |
| Bad grammar `N مراحل` | 0 |

## Mode Distribution

| Mode | Count |
| --- | ---: |
| COOK | 499 |
| DRINK | 46 |
| ASSEMBLE | 58 |
| PREPARE | 35 |
| NO_COOK_SIMPLE | 1 |

## Sample Checks

| Recipe | Mode | CTA | Sections |
| --- | --- | --- | --- |
| آب دوغ خیار | ASSEMBLE | آماده‌اش کن | مواد اصلی، برای مواد میانی، برای سرو |
| آب پرتقال تازه | DRINK | درستش کن | مواد اصلی |
| آبگوشت بزباش | COOK | شروع پخت | مواد اصلی، چاشنی‌ها و ادویه‌ها |
| آبگوشت قنبید | COOK | شروع پخت | مواد اصلی، چاشنی‌ها و ادویه‌ها |
| آجیل و کشمش و خرما | ASSEMBLE | آماده‌اش کن | مواد اصلی |

## Verdict

PASS.
