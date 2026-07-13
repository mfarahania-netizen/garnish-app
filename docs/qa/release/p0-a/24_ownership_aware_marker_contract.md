# P0-A v3.3 ownership-aware marker contract

Date: 2026-07-13 (Asia/Tehran)
Database used for runtime evidence: `garnish_p0a_v3_browser_20260713_145934`
Decision: **PUBLIC_SHARED_CONTENT + INVALID_TEST_MARKER**
Original Scenario 1: **historical FAIL, preserved and superseded**
Confirmed private leak: **NO**
Product source fix required: **NO**

## Direct conclusion

[قطعی] The value previously called an Account B marker was the disposable public recipe title `QA-FIXTURE-B Minimal Omnivore`. Its presence on Account A Home proved only that the same active public Recipe was eligible for both accounts. It did not prove that Account B's private favorite relationship, profile, diet, allergy, plan, shopping item, consent state, private note, private API row or QueryClient scope crossed into Account A.

[قطعی] Account B ownership had been inferred from fixture design: Account B alone had a private favorite relationship to the public Recipe. The rendered title did not carry that relationship. The old title-absence oracle was invalid and the original Scenario 1 FAIL was a false positive.

## Provenance

| Field | Value |
|---|---|
| Marker class | Disposable QA public recipe title |
| Route | `/` |
| DOM location | Home recommendation/public catalogue recipe card title |
| Web components | Home data hook → Recipe rail/card |
| Network suppliers | Current-user recommendations and public recipes catalogue |
| Database source | `Recipe.title` with active/public visibility |
| Separate private source | `FavoriteRecipe(userId, recipeId)` through authenticated `/favorites` |
| Public catalogue query hash | `f5753aa27420c60b` (masked) |
| Classification | `PUBLIC_SHARED_CONTENT` |
| Previous assertion | `INVALID_TEST_MARKER` |

## Ownership classes

### PUBLIC_SHARED_CONTENT

Recipe title, image, category, public card and public catalogue metadata may appear for both users.

### ACCOUNT_PRIVATE_STATE

Display name, selected diet/allergy, favorite membership, meal-plan membership/slot, shopping item, consent decision, private setting/note, authenticated API relationship and account-scoped QueryClient entry must never cross users.

### DERIVED_PERSONALIZED_OUTPUT

Two accounts may receive the same public recipe, but the response must not contain the other account's private explanation, preference, relationship or query scope.

### INVALID_TEST_MARKER

A public value cannot be used as proof of private ownership merely because one fixture also has a private relationship to it.

## Route-specific assertions

- Home: require current greeting/scope; reject other display name, shopping item, plan slot, favorite-membership state and private preference/allergy explanation; allow public recipe overlap.
- Profile: require current name/diet/allergy and reject the other account's selected state.
- Settings: compare selected/pressed state, not shared option labels.
- Favorites: compare authenticated favorite relations and saved state; ignore public visibility elsewhere.
- Meal Plan: compare account-owned slot membership.
- Shopping List: compare account-owned item markers.
- QueryClient: require zero other-account private scope; after logout require zero private entries, while public account-unscoped catalogue entries may remain.

## Corrected Scenario 1

[قطعی] The rerun checked Home, Profile, Settings, Favorites, Meal Plan and Shopping List. Account A private state was present; Account B private relationships/state were absent; no unexpected login/onboarding redirect, indefinite loading, visible runtime error or horizontal overflow occurred. The public B-recipe title was recorded separately as allowed shared content.

Corrected Scenario 1 result: **PASS**.

This contract does not approve the complete runtime release. The v3.3 run later became `BLOCKED_BY_BROWSER_ENV` during Scenario 8.
