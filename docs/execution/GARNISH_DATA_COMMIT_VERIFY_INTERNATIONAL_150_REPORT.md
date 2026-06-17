# DATA-COMMIT-VERIFY-INTERNATIONAL-150 — Execution Report
**Surface:** Data + git only. **All application code / importer / validator FROZEN** (proven below).
**Merged HEAD:** `e9329953` (committed to master + pushed)
**Status:** validator PASS · package git-tracked (14/14) · honest note added → done. **No DB import.**
**Date:** 2026-06-18

> Makes the International Core 150 v0.6.0 draft-candidate SOURCE git-tracked, validator-passing, and
> reproducible from the repo. It does NOT promote the data to imported/final.

---

## PHASE 0 — intake (confirmed, nothing changed)
1. Folder at repo root with exactly **14** `.json` files = the validator's required set: MAIN
   `recipes.international.core-150.draft-candidate.v0.6.0.json`, WRAPPER `…wrapper.json`, READINESS
   `final_import_readiness_report_…json`, MANIFEST `international_core_150_merge_manifest_v0.6.0.json`, plus
   the 10 reports (allergen / diet-flag / duplicate-exclusion / ingredient-resolver / internal-terms /
   batch-source-integrity / final-quota / popularity-source / semantic-copy / template-copy). ✓
2. `git check-ignore -v` → currently IGNORED by `.gitignore:27 /garnish_recipe_*_draft_candidate_*/`. ✓
3. Readiness verdict = `INTERNATIONAL_CORE_150_DRAFT_CANDIDATE_V0_6_0_READY_FOR_EXTERNAL_AUDIT_NOT_FINAL_IMPORT`. ✓
4. 1008-ingredient dictionary present (`…alias_patch_00.json`). ✓
5. Secret scan of the package → **empty** (exit 1). ✓

## PHASE 1 — validator (reproducibility proof)
`node apps/server/scripts/recipes/validate-international-core-150-v0-6-0.js` →
```
recipeCount: 150, wrapperRecipeCount: 150, seqMin: 205, seqMax: 354, missingSeqCount: 0,
ingredientLines: 1389, distinctIngredientIds: 194, dictionaryCount: 1008,
dupRecipeId/dupSlug/dupLegacy/dupTitleFa: 0, invalidId/invalidCode/idCodeMismatch: 0, newIds: 0,
missingLockedField: 0, unresolved: 0, notReady: 0, medicalReady: 0, strictReady: 0,
stepNoInstruction: 0, internalHits: 0, forbiddenSlugPresent: false
RESULT: PASS
```

## PHASE 2–4 — track + note + commit
- `git add -f garnish_recipe_international_core_150_draft_candidate_v0_6_0/` (robust path — ignore rules do
  not affect a force-tracked folder). `.gitignore`: removed the explicit per-folder ignore, kept the
  `/garnish_recipe_*_draft_candidate_*/` wildcard for FUTURE drafts, and documented this package as an
  intentionally-committed exception.
- `data/README.md`: added a short, factual subsection — SOURCE committed + reproducible (validator PASS,
  150 recipes / 0 unresolved / 0 new ingredient IDs / 0 dups); **DRAFT, pending external audit — NOT
  final-imported**; active sources remain 200 (v0.6.1) + 122 (legacy); no live-DB total asserted.
- **Scope proof** (`git diff --cached --name-only`): the 14 package files + `.gitignore` + `data/README.md`
  ONLY — SCOPE_LEAK=NONE. Tracked count post-commit = **14**. Post-commit validator re-run = **PASS**.

---

```
VERDICT BLOCK
=============
SPRINT: DATA-COMMIT-VERIFY-INTERNATIONAL-150
PACKAGE AT REPO ROOT, 14/14 required files: Y
SECRET SCAN: clean
VALIDATOR: RESULT=PASS  (recipeCount=150 unresolved=0 newIds=0 dups=0 medical=0 internal=0)
NOW GIT-TRACKED (git ls-files count): 14
.gitignore handling: force-added (-f) + wildcard kept for future drafts + documented exception
data/README.md honest note added (draft/pending-audit, no inflation): Y
DB IMPORT RUN: NO
SCOPE (diff name-only) = package + .gitignore + data/README.md ONLY: Y
COMMIT+PUSH: DONE @e9329953
```

---

## AFTER — for the founder
Reproducibility is closed: anyone with the repo can run the validator and recompute 150 from the parsed
recipes. Honest claim: **200 v0.6.1 (active) + 150 international draft candidate (validator-passing,
pending external audit) = 350 reproducible-from-repo; the 150 is DRAFT, not final.**
