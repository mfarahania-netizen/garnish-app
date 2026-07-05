# Homepage Information Architecture Options

## Option A — Minimal Launch-Safe Homepage
[قطعی] Best for immediate launch if stability matters.

| Order | Section | Purpose | Data Source | User Action | Risk | Include Now |
|---|---|---|---|---|---|---|
| 1 | Real search entry | fastest path to value | `/discover` or inline `/recipes/search` | search food/ingredient | low | yes |
| 2 | One hero recommendation | answer “what should I cook?” | `/recommendations` + recipe metadata | open/save/dismiss | medium if cold-start | yes |
| 3 | Quick actions | common intents | route links | quick dinner, breakfast, saved, plan, shopping | low | yes |
| 4 | Meal/category chips | browse starter | `/recipes?meal/category` | filtered archive | medium if facets mismatch | yes after label fix |
| 5 | One compact rail | backup choice | `/recipes` engagement order | open recipe | low | yes |
| 6 | Food DNA small strip | profile progress | `/profile/dna` | open profile/Food DNA | low | yes, demoted |

Remove from A:
- Occasion teaser.
- Fresh rail.
- Dead resume.
- Overprominent Food DNA card.

## Option B — Better Personalized Homepage
[احتمالاً] Best after light wiring.

| Order | Section | Purpose | Data Source | User Action | Risk | Include Now |
|---|---|---|---|---|---|---|
| 1 | Search + ask chip | decide quickly | `/recipes/search`, assistant route | search / ask | low | yes |
| 2 | Continue / Today | resume real task | meal plan + cook progress | continue cooking / open today meal | needs persistence | partial |
| 3 | Tonight suggestion | high-confidence recommendation | `/recommendations` | open/save/dismiss | medium | yes |
| 4 | Plan preview | food OS loop | `/meal-plans` | add/cook/build shopping | light backend/frontend query | yes after wiring |
| 5 | Shopping preview | actionable list | `/shopping-list` | open/check | extra query | yes after wiring |
| 6 | For you rail | more recs | `/recommendations` | open/save | medium | yes |
| 7 | Popular/quick rail | fallback | `/recipes` with filters/order | open | low | yes |

## Option C — Food OS Direction
[احتمالاً] Best strategic direction, not all for launch.

| Order | Section | Purpose | Data Source | User Action | Dependency |
|---|---|---|---|---|---|
| 1 | Daily command strip | “today’s food state” | plan + shopping + profile | continue, shop, plan | home aggregation endpoint |
| 2 | Ask Garnish | AI decision helper | `/ai/opener`, `/ai/chat`, safe tools | ask with starter prompts | cost/rate guard + UX |
| 3 | Pantry-aware suggestions | cook from what you have | pantry + recipes + AI pantry-match | choose recipe | reliable pantry model |
| 4 | Adaptive recommendations | behavior ranking | recsys activation | open/save/dismiss | recsys activation review |
| 5 | Weekly loop | plan → shop → cook | meal plan/shopping/cook events | plan week, build list | existing + home summary |
| 6 | Taste learning | correction cards | Food DNA/taste correction | correct likes/dislikes | current profile tooling |

## Recommended Next Structure
1. Search / “چی می‌خوای بپزی؟”
2. Hero recommendation: “برای امشب”
3. Quick actions: شام سریع، برنامه، لیست خرید، دستیار
4. Today/plan preview if real, otherwise hidden
5. Two rails max: “مناسب تو” and “محبوب‌ها”
6. Food DNA as small progress card near bottom

