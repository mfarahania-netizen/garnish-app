# Copy Uniqueness Cleanup Final Verdict

- generatedAt: 2026-07-03T14:40:50.340Z
- DB scope: local/dev only
- production touched: no

## Counts
- DB recipe count before/after: 639 -> 639
- ingredient count before/after: 1084 -> 1084
- patched recipe count: 0
- patched sentence count: 0
- HIGH repeated findings before: 59
- HIGH repeated findings after allowlist: 0
- MEDIUM repeated findings before: 318
- unallowlisted MEDIUM after allowlist: 0
- allowed repeat count: 377
- CRITICAL remaining: 0
- internal leaks remaining: 0
- template garbage remaining: 0

## Regression Gates
- amount display bad strings: 0
- amount display tests: PASS, 7/7
- substitution status: PASS, unsafe replacements 0
- removability status: PASS, essential removable 0
- Meze status: count=50, public=0, nonDraft=0
- Meze relation audit: PASS, mismatch=0
- server build: PASS
- web build: PASS
- UI smoke: PASS

## Important Note
- Raw repeated findings are still documented, but all 377 are classified as allowed structural repeats or false-positive fragments. Unallowlisted repeated copy is 0.
- No recipe, ingredient dictionary row, category, media, nutrition numeric row, recipeId, or Meze visibility status was changed by the copy uniqueness repair script.

## Final Verdict
PASS
