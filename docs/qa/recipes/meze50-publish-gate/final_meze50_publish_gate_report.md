# Final Meze 50 Publish Gate Report

- generatedAt: 2026-07-05
- database scope: local/dev only
- production touched: no
- verdict: PASS

## Counts

| Metric | Before | After |
|---|---:|---:|
| total recipes | 639 | 639 |
| active/public | 589 | 639 |
| draft/private/review | 50 | 0 |
| ingredient count | 1084 | 1084 |
| Meze total | 50 | 50 |
| Meze public | 0 | 50 |

## Publish Summary

- Meze published count: 50
- Meze still reviewOnly count: 0
- patched Meze count: 0
- deleted recipe count: 0
- new recipe count: 0
- new ingredient count: 0
- unresolved public blockers: 0

## Risk Gates

| Gate | Status |
|---|---|
| local/dev guard | PASS |
| rollback before publish | PASS |
| identity/authenticity audit | PASS |
| ingredient relation integrity | PASS |
| GRIS completeness | PASS |
| exact duplicate risk against public archive | PASS |
| forbidden/internal copy residue | PASS |
| allergen/medical strict-claim risk | PASS |
| API/search smoke | PASS |
| CTA regression | PASS |
| Gamaj Kabab regression | PASS |
| Qeymeh Rizeh Esfahani regression | PASS |
| AI residue CRITICAL/HIGH | PASS, 0/0 |
| forbidden Recipe/Ingredient create/upsert/delete scan | PASS |
| server build | PASS |
| web build | PASS |

## Exact Blockers

- none

## Generated Evidence

- `preflight.md`
- `meze50_rollback_before_publish.json`
- `meze50_audit_before.md`
- `meze50_audit_before.json`
- `meze50_patch_required.csv`
- `meze50_keep_reviewonly.csv`
- `meze50_patch_report.md`
- `meze50_patch_rollback.json`
- `meze50_publish_report.md`
- `meze50_post_audit.md`
- `meze50_api_search_smoke.md`
- `meze50_cta_regression.md`

## Final Recommendation

Recipe archive public count reached 639; Meze 50 gate passed. Future +100 catalog expansion remains separate.

