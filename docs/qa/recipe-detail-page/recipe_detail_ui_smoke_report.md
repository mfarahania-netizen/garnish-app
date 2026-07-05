# Recipe Detail UI Smoke Report

## Scope

Recipe Detail UI only.

## Smoke Checks

| Check | Result | Evidence |
| --- | --- | --- |
| Ready state renders title | PASS | Existing smoke test still passes. |
| Ingredients section renders | PASS | Existing smoke test checks `مواد لازم`. |
| Flat/Legacy steps visible | PASS | Smoke test now checks `روش پخت` and a step instruction. |
| Cook CTA remains visible | PASS | Existing smoke test checks `بپز`. |
| Lite recipe path still renders compact body | PASS | Existing Lite test still passes. |
| GRIS path still renders premium sections | PASS | Existing GRIS tests still pass through full suite run. |
| Share is functional or disabled | PASS | Code path: `navigator.share` -> native, `navigator.clipboard.writeText` -> copy, otherwise disabled. |

## Command

`apps/web/node_modules/.bin/vitest.CMD run "src/app/recipe/[id]/recipe.smoke.test.jsx" "src/app/recipe/[id]/recipe.actions.test.jsx"`

Result: PASS, 12/12 tests.

## Manual QA Needed

- Open one image-backed recipe and confirm native share sheet on mobile.
- Open one browser without clipboard permission and confirm share button disabled.
