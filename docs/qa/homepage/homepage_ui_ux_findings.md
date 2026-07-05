# Homepage UI / UX Findings

## Severity Scale
- P0: launch blocker
- P1: major UX issue
- P2: improvement
- P3: polish

| Severity | Issue | Where | Why It Hurts UX | Suggested Fix Direction | Complexity |
|---|---|---|---|---|---|
| P1 | Primary action is diluted | `home/page.jsx` full order | Search, Food DNA, AI, chips, recommendations and rails compete | Make top 2 actions: search + one hero recommendation | frontend-only |
| P1 | Search looks like an input but is only a navigation button | `SearchField.jsx`, `HomePage.goDiscover` | user taps expecting typing, then page transition happens | Either make it a true inline search or clearly use “جستجو و کشف” affordance | frontend-only or light wiring |
| P1 | “بر اساس آشپزخونه‌ات” may overclaim | `useHomeData.js` pantry rail uses `recList.slice(3,11)` | no evidence it reads pantry list | Rename to “پیشنهادهای بیشتر” unless pantry signal is guaranteed | frontend-only |
| P1 | Occasion card is not real | `OccasionCard` in home shows toast “به‌زودی” | launch homepage should not contain dead-end teaser | Remove until real collection exists | frontend-only |
| P1 | Continue cooking component is dead | `resume: null` in `useHomeData.js` | high-value feature absent; if shown later without persistence would be fake | Do not promote until cook progress persistence exists | backend + frontend |
| P1 | Category chips and discovery chips use different routing semantics | Home → `/recipes?category=...`; Discovery → search terms | same-looking controls behave differently | Standardize facet model or visual distinction | frontend + small backend |
| P1 | Placeholder media dominates visual identity | `RecipeCard`, `PlatePlaceholder` | many repeated gradients make app look less food-native | Add real image pipeline or reduce media weight in compact cards | product/backend/media |
| P2 | Orange/saffron appears in too many surfaces | Food DNA, AI, nav, save, icons, chips, buttons | weakens hierarchy; everything feels equally important | Reserve brand fill for primary actions; use neutral for secondary | frontend-only |
| P2 | Too many horizontal rails | meal chips, cuisine tiles, rails | mobile scanning becomes tiring; hidden overflow reduces discoverability | Keep max 2 horizontal rails on home | frontend-only |
| P2 | “Fresh” rail is probably low-intent | `fresh` sorted by `createdAt` | users usually want relevance/time/meal, not newest imported row | Replace with time/meal-based rail | frontend-only + current `/recipes` filters |
| P2 | AI whisper action copy is not specific enough | `AIWhisper` acceptLabel “بله، بچین” | action opens recipe, not plan | Change to “دیدن دستور” or route to assistant for AI action | frontend-only |
| P2 | Food DNA card is visually heavy for new/cold users | `FoodDnaCard` | asks user to care about profile before cooking value | Show after first useful recommendation or collapse to strip | frontend-only |
| P2 | Empty state asks for taste onboarding via discover | `EmptyState onAction={goDiscover}` | copy says taste recognition but action goes discover, not Food DNA/onboarding | Route to Food DNA/onboarding next-question | frontend-only |
| P2 | Popular rail has no explanation | `RecipeRail title="محبوب‌ها"` | user cannot tell if popular by views, saves, cooks | Add lightweight reason or avoid over-specific claim | frontend-only |
| P2 | Cards’ click target is image overlay only | `RecipeCard` | title area may not open recipe; users often tap text | Make entire card body tappable except save/dismiss | frontend-only |
| P2 | Dismiss X on recommendation card may be ambiguous | `RecipeCard` | X on media can look like close/delete | Add tooltip/label visually maybe “علاقه ندارم” on long press? | frontend-only |
| P2 | Notification bell has no unread state | `TopBar.jsx` | weak reason to tap; user cannot know if attention needed | add unread badge from notifications query | small backend/frontend |
| P3 | Hamburger duplicates bottom nav | `navConfig.js` | acceptable but drawer feels like sitemap | Keep drawer for secondary/settings, reduce duplicated primary entries later | frontend-only |
| P3 | Some long Persian labels risk wrapping badly | bottom nav “علاقه‌مندی‌ها”, chips | can crowd 480px width | test on 360px; consider shorter labels | frontend-only |

## User Journey Diagnosis
1. What is homepage trying to make the user do?  
   [احتمالاً] choose a recipe from personalized cards, but it also pushes profile, AI, categories and rails.
2. Is primary action obvious?  
   [احتمالاً] no. Search is first but looks passive; “برای تو، امشب” is lower.
3. Is search prominent enough?  
   [قطعی] visually yes, behaviorally weak because it is not a real input.
4. Are recommendations useful or random?  
   [احتمالاً] partly useful; they come from `/recommendations`, but metadata is enriched from only first 60 recipes.
5. Are cards clickable enough?  
   [احتمالاً] image is clickable; full-card affordance should be stronger.
6. Is there repetition?  
   [قطعی] yes: recommendation cards + 3 rails + category chips + discovery duplicates.
7. Is whitespace too much?  
   [احتمالاً] individual components are fine, but cumulative vertical length is high.
8. Does it feel personal or fake-personal?  
   [احتمالاً] mixed. Food DNA and recs are real; pantry rail title is risky.
9. Does it feel like food OS or recipe list?  
   [احتمالاً] more feature-board than OS. Plan/shopping are in nav but not meaningfully summarized on home.
10. What should be removed?  
   Occasion teaser, fresh rail, duplicate/low-value rails, fake pantry wording if unsupported.
11. What should be promoted?  
   Search, one high-confidence recommendation, today’s plan/shopping preview when real.

