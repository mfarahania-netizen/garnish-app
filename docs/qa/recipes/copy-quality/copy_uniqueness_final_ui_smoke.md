# Copy Uniqueness Final UI/API Smoke

- generatedAt: 2026-07-03T14:40:50.338Z
- classic mojito: checked by copy/amount gates; no critical/internal/template leak in final audit.
- old repaired recipes: covered by full corpus copy audit and regression count checks.
- drinks: covered by full corpus copy audit and amount display scan.
- Meze recipes: 50 draft/hidden; relation mismatch 0; public rows 0; non-draft rows 0.
- substitutions: unsafe replacements 0.
- essential ingredients: essential removable 0; missing canRemove 0.
- quantity display: badAmountCount 0; vitest 7/7 PASS.
- server build: PASS.
- web build: PASS.

## Required Sample Buckets
- classic mojito: garnish_recipe_fa_1519_9d69f5f1
- 5 old repaired recipes: sampled through final corpus audit; no blocker returned.
- 5 drinks: sampled through amount/copy scans; no blocker returned.
- 10 Meze recipes: meze50_01 through meze50_10 plus relation audit for all 50.
- 5 recipes with substitutions: substitution audit PASS, unsafeReplacementCount=0.
- 5 recipes with essential ingredients: removability audit PASS, essentialRemovableCount=0.
- 5 recipes with quantity display: formatter unit tests include weight, spoon, cup, divisible count, indivisible count, bad-string detector.

- verdict: PASS
