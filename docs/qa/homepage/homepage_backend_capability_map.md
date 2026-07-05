# Homepage Backend Capability Map

## Reality Check
[قطعی] backend فعلی بیشتر از چیزی که home استفاده می‌کند قابلیت دارد، اما همهٔ آن‌ها برای homepage آمادهٔ نمایش نیستند. تفاوت اصلی بین “endpoint وجود دارد” و “feature قابل اعتماد برای کاربر عادی” باید جدی گرفته شود.

| Feature | Current support | Evidence / file / API | UX opportunity | Risk | Recommendation |
|---|---|---|---|---|---|
| Public recipes | Ready now | `GET /recipes`, `apps/server/src/recipes/recipes.controller.ts`, `recipes.service.ts` | list, rails, category facets, recipe links | returns placeholder images; heavy include and in-memory sort | Use now; cap home fetch and separate rail semantics |
| Recipe search | Ready now | `GET /recipes/search`, `useDiscovery.js` | home can include real search input or direct query handoff | query not typed on home; Persian variants still need monitoring | Promote search as primary action |
| Recipe detail | Ready now | `GET /recipes/:id`, `/full`, `useRecipeDetail.js` | cards open reliable detail | unsafe profile conflicts can 403 | Keep safe gating; show friendly blocked state |
| Engagement-based recipe ordering | Partially ready | `getRecipeEngagement()` in `recipes.service.ts` | “popular” can use views/cooks/meal-plan | score is simple sum; no recency window | Label as “پربازدید/محبوب” only if analytics volume is meaningful |
| Favorites | Ready now | `useFavoritesQuery.js`, `favorites.controller.ts` | saved state and saved shortcut | bottom nav uses Favorites as primary tab; may be low-value for cold users | Keep, but consider moving to drawer later |
| Recommendations | Ready now but limited | `GET /recommendations`, `RecommendationController` | “برای تو” and “امشب” hero | matched signals may be thin/cold-start; no public overclaim | Use with honest copy: “پیشنهادها”، not “AI knows you perfectly” |
| Recommendation feedback | Ready now | `POST /recommendations/impression`, `useImpressionObserver`, dismiss hook via analytics | learn from impressions/dismiss/save/click | not immediately visible to user | Keep in background; do not overpromise |
| Food DNA / profile maturity | Ready now | `GET /profile`, `/profile/dna`, `FoodDnaPage` | progress/profile card | can feel fake-personal if profile sparse | Show as secondary, not first value prop for new users |
| Gamification | Ready now | `GET /gamification/me`, `GamificationStrip` | streak and mastery | can clutter before user sees value | Show only when meaningful; current `gam.show` is good |
| Meal plan | Ready now | `meal-plans.controller.ts`, `PlanPage` | homepage preview: today’s next meal; quick “add dinner” | current home does not fetch plan; needs light wiring | P1: add compact real preview |
| Smart plan proposal | Partially ready | `POST /meal-plans/propose`, `PlanPage` | “برای هفته پیشنهاد بده” card | AI-ish wording can overpromise; proposal only, no write until accept | Use in plan page; home quick action only |
| Shopping list | Ready now | `shopping-list.controller.ts`, `useShopping.js` | preview number of remaining items | home does not fetch it; extra query cost | P1 light wiring if useful |
| Shopping list from plan | Ready now | `POST /shopping-list/from-plan` | home prompt after plan exists | needs plan state | Use only after plan preview |
| Pantry | Ready now | `GET/POST /shopping-list/pantry` | “based on kitchen” can be real if pantry exists | home currently uses recommendations for pantry rail, not pantry list | Rename rail unless true pantry signal exists |
| Notifications | Ready now | `TopBar.jsx`, `notifications.controller.ts` | bell entry | no unread badge in topbar | Add badge if endpoint returns unread count |
| AI assistant chat | Ready with limits | `ai.controller.ts`, `AssistantPage` | safe “ask what to cook” entry | rate limits, possible wrong answers, cost | Put AI as explicit assistant entry, not dominant tab until measured |
| AI opener | Ready | `GET /ai/opener`, `useAssistant` | personalized starter in assistant | not used in home | Use assistant page; optional home card later |
| AI pantry match/substitution/pairing | Ready but tool-limited | `POST /ai/pantry-match`, `/substitutions`, `/pairings` | quick safe actions | requires snapshot; can return unavailable | Use as assistant actions with fallback |
| Advanced health personalization | Not launch-ready | no medical engine; safety copy says no medical advice | none for launch | medical/legal risk | Do not surface |
| Social/community feed | Not available | no frontend/backend evidence | none | fake feature risk | Do not build now |
| Recommendation shadow/lab | Backend exists but not user-facing | `runtime-shadow/lab/*`, admin/internal controllers | internal QA only | leaking lab feature would overclaim | Hide from users |
| Continue cooking | UI component only | `ResumeCard.jsx`; `useHomeData` returns `resume: null` | high-value if persisted | currently fake if shown | Do not show until cook-mode state persistence exists |
| “Popular now” | Partial | engagement totals exist, not recency trend | can become high-click rail | if labeled “now” without time window it is false | Use “محبوب‌ها”; later add recency window |
| “Fresh/new” | Ready but low-value | home sorts `createdAt` | latest content rail | user asked elsewhere not to prioritize recency in recipes | Demote/remove on home unless content freshness matters |

## Capability Classification

### A) Ready Now, Frontend Can Use
- Public recipes, recipe detail links, recipe search.
- Favorites.
- Recommendations with honest labels.
- Food DNA summary.
- Gamification when non-empty.
- Meal plan and shopping list pages.
- Notifications entry.
- Assistant page with safety/rate limits.

### B) Exists Partially / Needs Light Wiring
- Today’s meal plan preview on home.
- Shopping list preview/count.
- Continue cooking if cook-mode progress is persisted.
- Better “based on your kitchen” only if pantry data is actually joined.
- Homepage unread notification badge.
- Home search as real inline input instead of route-only button.

### C) Backend Exists But Should Not Be User-Facing Yet
- Recommendation shadow/lab/activation review.
- Admin debug recommendation compare/embedding/debug endpoints.
- AI autonomous planning/execution.
- Any “full health coach” or medical nutrition claim.

### D) Not Available / Should Not Be Faked
- Social feed.
- Medical diet personalization.
- Autonomous shopping execution.
- Household memory beyond explicit saved profile/pantry/list.
- Real food photography/media pipeline.

