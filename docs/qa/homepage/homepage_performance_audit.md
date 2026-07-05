# Homepage Performance / Technical Quality Audit

| Technical issue | UX impact | Evidence | Recommended fix | Complexity |
|---|---|---|---|---|
| Home makes 5+ parallel queries | slower first ready state | `useHomeData`: `/users/me`, `/recommendations`, `/profile`, `/gamification/me`, `/recipes`; plus `useFoodDnaProjection` calls `/profile/dna` | create `/home/summary` or defer lower-priority cards | backend + frontend |
| `/recipes?limit=60` includes ingredients/steps/nutrition | unnecessary payload for cards | `recipes.service.findAll` includes ingredients, steps, nutrition | add lightweight card endpoint/select | backend |
| recipe list sorted in memory after fetching up to 1000 for authed safety | can scale poorly | `RecipesController.findAll` authed path loads all then safety filters | move filtering/sorting closer to DB or cache safe IDs | backend |
| Home enriches recs via first 60 recipes only | missing metadata for recs not in first 60 | `catalogById` in `useHomeData` | recommendation API should return card metadata | backend |
| Popular/fresh rails share same `/recipes` payload | duplicate work | `useHomeData` derives rails from same catalog | acceptable short-term; long-term dedicated rails | backend |
| Placeholder media cheap but visually repetitive | perceived quality issue more than perf | `PlatePlaceholder` gradients | image pipeline or lower media weight | product/frontend |
| Framer motion on many cards | may cost on low-end devices | `HomePage` maps motion cards | keep reducedMotion; limit animation count | frontend |
| Impression observer is efficient | good | `useImpressionObserver` batches by requestId | keep | none |
| Query cache reuse exists | good | React Query keys shared for profile/recs | keep | none |
| Error/loading states exist | good | `HomeLoading`, `ErrorState` | keep | none |

## Technical Verdict
[احتمالاً] performance is acceptable for pilot but not ideal for scale. The biggest technical improvement is a backend `GET /home/summary` or lighter card metadata endpoint, not more frontend memoization.

