# Garnish Food Data v2 — Phase-One Recipe Resolver Alias Patch 00

Append-only patch over the **1008 nutrition-quarantined** dictionary. Closes real recipe
alias gaps and adds ambiguous-term handling. **No new ingredient IDs. Nutrition unchanged.**

## What changed (allowed fields only)
- recipeInputAliases: 53 surface additions across 29 ingredients
  (plurals/bare-nouns + Persian recipe forms, e.g. scallions, ginger, coconut milk, besan,
   panko, kalamata olives, masoor dal, لوبیا سبز, ادویه پلویی, ساق گوسفند, خرما, نعناع داغ).
- ambiguity policy: 11 entries (butter/کره → butter_unsalted default+salted alt;
  paprika → paprika_ground default+bell_pepper alt; generic cooking oil روغن مایع/cooking oil →
  low-confidence default + requiresContext). Ambiguous terms are flagged, never high-confidence bound.

## Re-run on patched dictionary (same 342 lines)
- resolved 334/342 • **nonDishResolvedRatePct 98.2%** • wrongMatchCount 0 • dishNameResolvedAsIngredientWrongly 0
- ambiguousHandled 56 • **aliasGapCount 0** • unresolvedHighFrequencyTerms 0 • genuinelyMissing 6 lines
- **passesRecipeResolverAliasPatch00Validation: true**

## Genuinely-missing (NOT created — see unresolved_recipe_import_terms_report.json)
white/granulated sugar (phase-one-necessary → critical hotfix recommended), croutons, generic
chili-powder blend, gochugaru, cooking white wine, sushi/short-grain rice, shirataki.

## Pre-existing note
7 cross-language alias homographs (paprika, raisins, کشک, بامیه, حمص, موسلی, mais) ALREADY existed
in the base (0 introduced here; native per-language duplicate metric = 0). Flagged for a future
ambiguity-policy/cleanup pass; not modified to stay in scope.

## Required statement
This patch improves recipe resolver coverage by adding aliases and ambiguous-term handling only.
It does not create new ingredient IDs and does not change nutrition. This is not a Final Verified
Nutrition Dataset. Medical and strict-diet use remain out of scope.
