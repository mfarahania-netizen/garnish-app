# Batch03 Iranian Recipe Trust Final Report

- generatedAt: 2026-07-04
- database scope: local/dev only
- production touched: no
- verdict: PASS

## Apply Result

- total recipe count: 639 -> 639
- active/public count: 542 -> 562
- draft/private/review count: 97 -> 77
- ingredient count: 1084 -> 1084
- restored public recipes: 20
- patched Scope A recipes: 2
- still reviewOnly: 0
- deleted recipes: 0
- new Recipe rows: 0
- new Ingredient rows: 0
- Meze public count: 0

## Scope A Patches

| Slug | Patch |
|---|---|
| ghanbar-polo-shirazi | added existing dictionary markers for walnuts and pomegranate molasses |
| vavishka | added existing dictionary marker for whole egg |

## Scope B

- 18 Batch03 recipes restored as public because their current DB payload matched the provided baseline markers.
- No rename/reframe was required in this pass.

## Post-Audit Evidence

- `batch03_post_audit.md`: PASS
- `batch03_api_search_smoke.md`: 20/20 source payload/search smoke PASS
- unresolved blockers: 0
- API/source payload failures: 0
- search smoke failures: 0
- marker failures: no
- Gamaj/Qeymeh regression: PASS/PASS
- AI residue: 0/0
- forbidden Recipe/Ingredient create/upsert/delete scan: PASS
- server build: PASS

