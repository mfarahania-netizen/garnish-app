# What the Best Cooking/Recipe Apps Actually Do — Taste Profiling, the "For You" Feed & Recommendation

**Audience:** Garnish founder. **Date:** 2026-06-20. **Status:** competitive reference + steal-list.

**Scope.** This is the *recipe-app-specific* companion to `platform-foryou.md` (which covers TikTok/Instagram/Spotify — the general "For You" giants). This doc dissects the apps in our actual category: **Yummly, Samsung Food / Whisk, Mealime, SideChef, NYT Cooking, KptnCook, ChefGPT, Cookpad, Tasty**. For each: how they capture taste at onboarding, what implicit/explicit signals they use, how they recommend, how they explain, how context-aware they are, and where they fall short. Then: the patterns worth stealing, ranked by ROI for a **solo-founder, EU-launch, ~700–1008-dish, Persian-first** app, and an honest list of what does **not** help at small scale.

**The single most important finding up front.** The recipe-app category talks a big personalization game and *under-delivers*. Yummly — the category's flagship, the one with the patented "Food Genome" and 25M users — was described at its 2024 shutdown as having **"no personalization beyond dietary filters"** ([MealThinker](https://mealthinker.com/blog/yummly-alternative)). Almost every competitor's real onboarding is a **diet/allergy/dislike filter wizard**, not a taste model. The "for you" feed in most of these apps is **rules + filters + editorial rows**, occasionally with light collaborative filtering bolted on. **The bar to beat is low.** The moat isn't matching their marketing — it's actually shipping the *learning taste engine* their marketing only promised. Garnish's ingredient-level content data (per `platform-foryou.md`) is exactly the asset that makes that possible from interaction #1.

---

## 1. Yummly — the patented "Food Genome," and the cautionary tale

### How it captured taste
- **Explicit onboarding:** Taste Preferences page — favorite cuisines, **disliked ingredients**, allergies, diet flags (vegan, gluten-free, etc.), and appliances owned ([Yummly Help Center](https://help.yummly.com/hc/en-us/articles/203454410-Taste-Preferences)). This is preference *declaration*, not taste *measurement*.
- **Implicit:** saves, ratings, and usage behavior fed a model over time; "the more you save/rate, the better it gets."

### The Food Genome (the genuinely good idea)
Yummly's patented **Food Genome** is a content model of *recipes and ingredients*: NLP + deep learning chart each recipe's **taste, spiciness, cuisine, course, healthiness, prep time, technique, difficulty**, plus per-ingredient categories, nutrition, perishability and flavor relationships ([thespoon.tech](https://thespoon.tech/recipe-database-yummly-will-personalize-the-entire-digital-kitchen-to-help-you-cook-the-perfect-steak/), [Food+Tech Connect](https://foodtechconnect.com/2014/07/02/yummly-on-hacking-taste-with-food-data/)). They synthesized this with **context signals — day of week, season, location** — into a per-user dynamic feed across ~25M taste profiles.

### How it recommended & explained
Content scores (from the Genome) × declared preferences × light behavioral history × context. Explanations were thin — mostly implicit ("recommended for you") rather than "because you cooked X."

### Where it fell short (learn from this)
- **The Genome stayed mostly an analysis/search asset, not a felt personalization loop.** By the end, users reported **"no personalization beyond dietary filters"** ([MealThinker](https://mealthinker.com/blog/yummly-alternative)).
- **Cluttered with ads / Whirlpool product placement** after the $100M acquisition; **basic meal planning; no TikTok/Instagram import; no bulk export** ([MealThinker](https://mealthinker.com/blog/yummly-alternative)). Shut down with no warning **Dec 20, 2024**.
- **Lesson:** a brilliant *content* model (the Genome) is necessary but **not sufficient**. Without a tight behavioral learning loop and a *legible* "it gets me" experience, it decays into a filter wizard with a fancy backend. **Garnish already has the Genome-equivalent (GRIS + ingredient feature vectors); the differentiator is wiring it into a learning loop and showing the user the reasoning.**

---

## 2. Samsung Food / Whisk — the same "Food Genome" name, pantry + context

### How it captures taste
- **Explicit onboarding:** save a few favorite recipes into the "recipe box," declare likes/dietary restrictions, usual retailers, and **location** ([Samsung Newsroom UK](https://news.samsung.com/uk/samsung-announces-global-launch-of-samsung-food-an-ai-powered-personalised-food-and-recipe-service)).
- **Implicit:** saved recipes, the recipe box, list/shopping behavior; Vision AI ("Food AI looks inside your fridge") for ingredient recognition.

### How it recommends
Whisk's own **Food Genome™** (note: a *different* company also branded "Food Genome") structures recipes/ingredients with automated tagging + nutrition, powering recommendations, **smart consolidated shopping lists**, and **ingredient substitutions** ([VentureBeat](https://venturebeat.com/ai/how-whisk-is-using-its-food-genome-to-turn-recipes-into-smart-shopping-lists/)). Recommendations combine **preferences + saved recipes + context (local weather, seasonal goods)** ([Samsung Newsroom](https://news.samsung.com/us/new-food-ai-looks-inside-fridge-help-find-perfect-things-cook-already/)).

### Context-awareness (its real strength)
Pantry/fridge → "cook with what you have," local weather, seasonality, retailer integration. This is the most **context-rich** mainstream recipe app. Tightly tied to Samsung appliances (smart-oven hand-off).

### Where it falls short
- Taste capture is still **declare-and-save**, not measured taste; cross-160k-recipe corpus dilutes a small market.
- Personalization is real but **shallow per-user** — strong on *context* (pantry/weather), weak on *learned individual palate*.

**Steal:** pantry-aware ("cook what you have") + weather/seasonal context as first-class re-rank signals. **Surpass:** add a *learned* palate vector on top of context, so the same pantry yields different suggestions for different palates.

---

## 3. Mealime — the cleanest filter-wizard (and why simplicity wins for some)

### How it captures taste
- **Pure explicit filtering, no learning.** Onboarding = diet type (classic, flexitarian, pescetarian, low-carb, paleo, keto, vegetarian, vegan), **allergy toggles** (10+), and **119 individual dislikable ingredients** — **200+ personalization options total** ([Mealime](https://www.mealime.com/), [App Store](https://apps.apple.com/us/app/mealime-meal-plans-recipes/id1079999103)). No ratings model, no collaborative filtering. "The cleanest of the non-AI meal planners."

### How it recommends
Constraint-satisfaction: filter the catalog by your hard constraints → present a curated weekly plan → generate a grocery list. Zero behavioral learning; recommendations don't improve from cooking.

### Where it falls short
- **Static.** It never learns you cooked 10 stews. Same constraints → same pool forever.
- **No discovery / no surprise.** It's a competent filter, not a recommender.

**Lesson for Garnish:** Mealime proves a **clean, exhaustive dislike/allergy filter is table-stakes and genuinely valued** — and it's *exactly* what Garnish already has (HARD allergy gate + ingredient dislikes). Don't under-invest in the boring filter; it's the trust floor. But Mealime is the *floor*, not the bar. The opportunity is everything above it.

---

## 4. SideChef — editorial "rows" + light ML + three user archetypes

### How it captures taste
- Explicit **dietary profile** (Vegan/Veg/Pescatarian/Low-Carb/Paleo/Keto + 8 allergens, **20+ requirements total**) ([SideChef press](https://www.sidechef.com/business/press-releases/sidechef-launches-app-redesign-to-help-users-find-recipes-they-love-more-quickly)).
- Filter by **pantry ("ingredients you already have") → recipe in <1 minute**.

### How it recommends & the design idea worth stealing
- **Themed personalized rows:** "eat healthy," "save money," "save time" — *intent-labeled shelves*, each a different ranking objective. This is Spotify's "shelves" pattern applied to cooking.
- Designed around **three user archetypes**: (a) knows exactly what they want (search), (b) wants inspiration (browse feed), (c) wants to be told what to cook this week (planner). The whole UX routes by intent.
- ML for personalized recommendations, but the headline AI is **RecipeGen (photo → recipe)**, i.e. content generation, not deep personalization.

### Where it falls short
- Rows are partly editorial/rule-based; per-user learning is light.

**Steal (high value, low cost):** **intent-labeled rows** ("Quick weeknight," "Use up your pantry," "Try something new") — each row is the *same engine with a different objective/explore setting*. And the **three-archetype routing** is a clean information architecture for the home screen.

---

## 5. NYT Cooking — editorial-first, ML-assisted (the "trusted curation" model)

### How it captures taste
- Minimal explicit onboarding. Personalization is driven by **what you save/cook** + editorial collections.

### How it recommends & explains
- **Hybrid: editorial curation + ML**, explicitly designed so recommendations "feel personal and relevant **while not being intrusive**… without sacrificing editorial judgment" — a blend of ML, experimentation, and human editors ([Knight Lab](https://knightlab.northwestern.edu/2016/03/28/a-quick-look-at-recommendation-engines-and-how-the-new-york-times-makes-recommendations/)). NYT's broader recsys research explicitly **incorporates editorial values** (diversity, quality) into ranking rather than pure click-optimization ([Beyond Optimizing for Clicks, arXiv 2004.09980](https://ar5iv.labs.arxiv.org/html/2004.09980)).
- Strong **seasonal/occasion editorial** ("Thanksgiving," "weeknight," "what to cook this week").

### Where it falls short
- Light *individual* personalization; leans on the strength of the brand/editors. Works because NYT *has* world-class editors — a moat a solo founder can't replicate at scale.

**Lesson:** editorial curation is a *quality floor and a diversity/trust mechanism*, and a **cold-start fallback** (everyone gets the editor's pick before the model knows them). A solo founder's lightweight version = a small set of **hand-curated "staff pick" / seasonal collections** that seed the feed for new users and guarantee a quality floor. Cheap, high-trust, no ML needed.

---

## 6. KptnCook — radical curation + thumbs + premium ML (constraint as a feature)

### How it captures taste
- **3 hand-picked recipes per day** by food bloggers; they vanish after a day. Scarcity *is* the product.
- Explicit: exclude disliked ingredients; "cook with what I have."
- **Implicit:** after "cooked," a **thumbs-up / thumbs-down "would cook again"** — a clean binary preference signal, captured at the highest-intent moment (post-cook).

### How it recommends
- Free tier = curated-for-everyone. **Premium = ML "surprise me" recommendations** tailored to individual taste + a personalized Discovery page on tastes/dietary needs ([148Apps](https://www.148apps.com/kptncook-meal-plans-recipes/kptncook-review/)).

### Where it falls short
- The curation ceiling: 3/day caps discovery; the ML is a premium upsell, not the core loop.

**Steal:** (1) the **post-cook thumbs / "cook again?"** prompt — the single cleanest explicit signal in the category, captured exactly when intent is highest (we have `cook_complete`; add the thumbs). (2) **Scarcity/curation as an antidote to choice paralysis** — a small "today's picks" set can convert better than an endless feed. Garnish's "for you" can lead with a *small, confident* set, not a wall.

---

## 7. ChefGPT — LLM-native, explicit-context-per-request (the new pattern)

### How it captures taste
- **Per-request explicit context** instead of a persistent profile: you state ingredients on hand, **kitchen tools, available time, skill level**, and pick a "Chef Mode" (PantryChef, MacrosChef, MealPlanChef, MasterChef) ([toolify](https://www.toolify.ai/tool/chefgpt), [Google Play](https://play.google.com/store/apps/details?id=com.miudigital.chefgpt)).
- **Implicit/memory:** "remembers every recipe you've **cooked, modified, skipped, and rated**" to refine future recommendations ([emizentech](https://emizentech.com/blog/chefgpt.html)).

### How it recommends
LLM generation grounded in the stated constraints; the profile is increasingly a *memory* fed back into the prompt. Pantry-first ("PantryChef") reduces waste; macros mode hits nutrition targets.

### Where it falls short
- **Generation ≠ curation/safety.** LLM recipes can hallucinate quantities/steps; no guaranteed nutrition accuracy; allergy safety is only as good as the prompt. (Garnish's source-locked nutrition + HARD allergy gate is a *real* advantage here.)
- Cold, mode-by-mode UX; weak passive "for you" feed (you must ask).

**Steal:** the **modal intent framing** (pantry / macros / plan / explore) and the **memory-of-actions** loop (cooked/modified/skipped/rated → next time). **Surpass:** ground generation in *verified* content (our GRIS + USDA-locked nutrition + allergy gate) so suggestions are safe and accurate, not plausible.

---

## 8. Cookpad — UGC + social/regional signal at massive scale

### How it captures taste & recommends
- Huge **user-generated** recipe corpus; personalization leans on **social + collaborative signals** (what users like you saved/cooked) and **search behavior**. Academic work in this space (and around Cookpad's data) uses **hybrid content-based (TF-IDF/cosine on recipe text) + collaborative filtering**, increasingly with attention/ensemble models ([IJRASET](https://www.ijraset.com/research-paper/recipes-recommendation-system-using-machine-learning), [ScienceDirect ensemble+attention](https://www.sciencedirect.com/science/article/pii/S2588914125000127)).
- Strong **regional/cultural** signal — Cookpad is hyper-local per country, so the *catalog itself* is regionalized.

### Where it falls short / what's not transferable
- Cookpad's engine **needs UGC scale and dense interaction data** Garnish doesn't have at launch. Its collaborative filtering is a *scale* story (see `platform-foryou.md` §4.1).

**Lesson:** the **regional prior** is real and matters (founder's "region prefers fish" example). Cookpad gets it for free via per-country catalogs; Garnish should get it via an **explicit cohort/region prior** (hierarchical shrinkage user→region→global), which works *before* collaborative data exists.

---

## 9. Tasty (BuzzFeed) — context-rich rules + social bubble + LLM assistant

### How it captures taste & recommends
- **Context-first rules:** recommendations by **time of day, day of week, major holidays, season**; filter by social plans, ingredients, dietary needs, difficulty, speed, cuisine ([Google Play](https://play.google.com/store/apps/details?id=com.buzzfeed.tasty)).
- **Social bubble:** what you and your friends share shapes your feed (lightweight social CF).
- **"Botatouille"** — ChatGPT-API culinary assistant for conversational recipe finding ([BusinessWire](https://markets.financialcontent.com/clarkebroadcasting.mymotherlode/article/bizwire-2023-5-23-buzzfeeds-tasty-introduces-botatouille-the-first-of-its-kind-ai-powered-culinary-companion)).

### Where it falls short
- Heavily **rules/editorial + video-virality** driven; individual taste-learning is thin. Optimized for entertainment/engagement over "cook it tonight" utility.

**Steal:** **time-of-day / day-of-week / holiday context rules are cheap and high-signal** (breakfast in the morning, quick on weeknights, festive on holidays). For Garnish: Persian calendar occasions (Yalda, Nowruz, Ramadan) are an unusually strong, underexploited context lever.

---

## 10. The academic cold-start technique worth copying: **Yum-Me**

The most directly stealable *research* result for taste onboarding is **Yum-Me** (a personalized nutrient-based meal recommender, [PMC6242282](https://pmc.ncbi.nlm.nih.gov/articles/PMC6242282/)). It solves cold-start taste capture **visually**, not via a survey:

- **Phase I (first 2 rounds):** show **10 food images**, "tap the ones that look delicious." Images chosen by **k-means++** to span the feature space (diverse exploration).
- **Phase II (round 3+):** **pairwise "which looks better / Yuck"** — one image from a high-preference region, one from an unexplored region (explore/exploit balance).
- **Method:** preferences **propagate through visual similarity** (a food-image embedding, FoodDist) via label propagation; the preference vector updates with an **EXP3-style exponentiated-gradient bandit**.
- **Results:** ~50% of users hit >80% prediction accuracy in **15 iterations** (~53s); **+42.6% meal-recommendation acceptance vs. a traditional survey onboarding.**

**Why this matters for Garnish:** it's a citable, proven design for a **2-minute visual onboarding** that produces a *real taste vector* (not just diet flags), and it maps cleanly onto our **ingredient/GRIS feature space** — we already have the per-recipe content vectors that play the role of FoodDist. **This is the concrete onboarding to copy.**

---

## 11. The patterns worth stealing — ranked by ROI for a solo-founder EU launch

ROI = (impact on "it gets me" feeling + data it gathers) ÷ build cost at ~700 dishes, sparse data, one engineer. Cross-referenced with `platform-foryou.md`.

| # | Pattern | Stolen from | Why it wins at our scale | ROI |
|---|---|---|---|---|
| **1** | **Post-cook thumbs / "cook again?"** explicit signal | KptnCook | Cleanest, highest-intent signal in the category; one prompt; trains the model fast. We already log `cook_complete` — just add the binary. | **Highest** |
| **2** | **Visual taste-quiz onboarding → real taste vector** (Yum-Me 2-phase) | Yum-Me / academic | Produces a measured palate from interaction #0, not diet flags. Maps onto our GRIS/ingredient vectors. Beats every competitor's "filter wizard" onboarding directly. | **Highest** |
| **3** | **"Recommended because you cooked X / it's a cold autumn night"** explanations | Spotify recsplanations (none of the recipe apps do this well) | Legibility *is* the magic; explanations themselves lift engagement. Substrate already exists (`assessRecipeFit`, contribution calculator). The whole category is weak here → instant differentiation. | **Highest** |
| **4** | **Intent-labeled rows** ("Quick weeknight," "Use up your pantry," "Try something new") | SideChef / Spotify shelves | Same engine, different objective + explore setting per row. Solves the home-screen IA and surfaces both exploit and explore. | **High** |
| **5** | **Pantry-aware "cook what you have" re-rank** | Whisk / SideChef / ChefGPT | Top-3 *utility* feature in the whole category; converts intent to a cooked meal. We have ingredient-by-id. | **High** |
| **6** | **Context rules: time-of-day → meal type, weekday → effort, holiday/season** | Tasty / Whisk / Yummly | Cheap (timestamp + calendar), high felt-relevance. **Persian-calendar occasions (Yalda/Nowruz/Ramadan) are a unique, underexploited lever** for our market. | **High** |
| **7** | **Small confident "today's picks" set** instead of an infinite wall | KptnCook | Beats choice paralysis; higher conversion; lets curation/editorial seed cold-start. | **Medium-High** |
| **8** | **Hand-curated staff-pick / seasonal collections** as cold-start + quality floor | NYT Cooking | New users get a great experience before the model knows them; guarantees diversity/quality without ML. ~A day of editorial work. | **Medium-High** |
| **9** | **Regional/cohort prior** ("a fish-leaning region sees more seafood by default") | Cookpad (implicitly) | Founder's explicit ask; works *before* collaborative data via hierarchical shrinkage (user→region→global). | **Medium** (see `platform-foryou.md` §4.3) |
| **10** | **Memory-of-actions loop** (cooked/modified/skipped/rated feeds next session) | ChefGPT | We already have the signal engine; this is wiring + surfacing, not new ML. | **Medium** |

---

## 12. What does NOT help at small scale (resist these)

- **A patented "Food Genome" as a marketing artifact.** Yummly and Whisk both branded one; Yummly *still* ended at "no personalization beyond filters." The content model is necessary but worthless without the *learning loop* and *legibility*. **Don't build the Genome to brag — Garnish already has the equivalent; build the loop around it.**
- **Deep two-tower / collaborative filtering at launch.** Cookpad-scale CF needs UGC and dense interaction data we won't have. Premature. (See `platform-foryou.md` §4.1 — item-item beats user-item at our scale; full towers are a scale story.)
- **A 160k-recipe corpus.** Whisk/Samsung Food's giant catalog *dilutes* a focused market. Our ~700–1008 *deep* Persian-first dishes is an advantage, not a deficit. Don't chase catalog size.
- **LLM recipe *generation* as the core (ChefGPT/Botatouille model).** Hallucinated quantities, unverified nutrition, weak allergy safety. Our edge is *verified* content (source-locked nutrition + HARD allergy gate). Use the LLM for *explanation/assistance grounded in our corpus*, not for inventing recipes (matches the "AI grounded assistant" memory).
- **An endless TikTok-style infinite feed.** At 700 dishes you exhaust novelty fast; a confident curated set (KptnCook) converts better than an infinite wall that quickly repeats.
- **Pure editorial curation (NYT model) as the strategy.** A solo founder can't out-edit the NYT food desk. Use light curation as a *cold-start seed and quality floor*, not as the engine.
- **200+ static filter toggles as the "personalization story" (Mealime).** They're table-stakes/trust-floor (and we have them via the allergy gate + dislikes), but they are the *floor*, not the differentiator. Don't mistake exhaustive filtering for personalization.

---

## 13. The bar to beat, stated plainly

The category's *real* state (vs. its marketing):
1. **Onboarding = a diet/allergy/dislike filter wizard.** Nobody (except the Yum-Me research line) measures a *taste vector* at onboarding. **→ Garnish wins by shipping a visual taste-quiz that yields a real palate vector.**
2. **The "for you" feed = filters + editorial rows + context rules,** with light CF at most. Few learn your individual palate from cooking. **→ Garnish wins with a content-grounded *learning* loop that demonstrably shifts after you cook 10 stews.**
3. **Explanations are absent or generic** ("recommended for you"). **→ Garnish wins by telling the user *why* ("because you cooked X / it's a cold night") — Spotify-grade legibility no recipe app delivers.**
4. **Context is mostly pantry + season** (Whisk is best). **→ Garnish matches on pantry/season and wins on Persian-calendar occasions + time-of-day meal typing.**
5. **Safety/accuracy is shaky** in the LLM-native apps. **→ Garnish wins on source-locked nutrition + an inviolable allergy gate as a trust moat.**

**Net:** the bar to beat is **"a clean filter wizard plus context rules plus a couple of editorial rows."** Garnish's content data lets it clear that bar on day one and reach for the thing the whole category only advertised — a *legible, learning, palate-level* recommender. The four highest-ROI moves (post-cook thumbs, visual taste onboarding, "recommended because…" explanations, intent-labeled rows) are all low-cost, gather the data the rest of the system needs, and are each individually better than what most competitors ship.

---

### Sources
- Yummly: [Help Center – Taste Preferences](https://help.yummly.com/hc/en-us/articles/203454410-Taste-Preferences) · [thespoon.tech](https://thespoon.tech/recipe-database-yummly-will-personalize-the-entire-digital-kitchen-to-help-you-cook-the-perfect-steak/) · [Food+Tech Connect](https://foodtechconnect.com/2014/07/02/yummly-on-hacking-taste-with-food-data/) · [MealThinker (shutdown/criticism)](https://mealthinker.com/blog/yummly-alternative)
- Samsung Food / Whisk: [Samsung Newsroom UK](https://news.samsung.com/uk/samsung-announces-global-launch-of-samsung-food-an-ai-powered-personalised-food-and-recipe-service) · [Samsung Newsroom US (fridge AI)](https://news.samsung.com/us/new-food-ai-looks-inside-fridge-help-find-perfect-things-cook-already/) · [VentureBeat (Food Genome)](https://venturebeat.com/ai/how-whisk-is-using-its-food-genome-to-turn-recipes-into-smart-shopping-lists/)
- Mealime: [mealime.com](https://www.mealime.com/) · [App Store](https://apps.apple.com/us/app/mealime-meal-plans-recipes/id1079999103)
- SideChef: [Redesign press release](https://www.sidechef.com/business/press-releases/sidechef-launches-app-redesign-to-help-users-find-recipes-they-love-more-quickly) · [Recommendation API](https://www.sidechef.com/business/insights/how-to-use-sidechefs-recipe-recommendation-api-in-your-product-pages)
- NYT Cooking / NYT recsys: [Knight Lab](https://knightlab.northwestern.edu/2016/03/28/a-quick-look-at-recommendation-engines-and-how-the-new-york-times-makes-recommendations/) · [Beyond Optimizing for Clicks (arXiv 2004.09980)](https://ar5iv.labs.arxiv.org/html/2004.09980)
- KptnCook: [148Apps review](https://www.148apps.com/kptncook-meal-plans-recipes/kptncook-review/) · [FAQs](https://www.kptncook.com/faqs)
- ChefGPT: [toolify](https://www.toolify.ai/tool/chefgpt) · [emizentech](https://emizentech.com/blog/chefgpt.html) · [Google Play](https://play.google.com/store/apps/details?id=com.miudigital.chefgpt)
- Cookpad / recipe recsys research: [IJRASET](https://www.ijraset.com/research-paper/recipes-recommendation-system-using-machine-learning) · [ScienceDirect (attention+ensemble)](https://www.sciencedirect.com/science/article/pii/S2588914125000127)
- Tasty (BuzzFeed): [Google Play](https://play.google.com/store/apps/details?id=com.buzzfeed.tasty) · [Botatouille announcement](https://markets.financialcontent.com/clarkebroadcasting.mymotherlode/article/bizwire-2023-5-23-buzzfeeds-tasty-introduces-botatouille-the-first-of-its-kind-ai-powered-culinary-companion)
- Academic cold-start: [Yum-Me (PMC6242282)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6242282/)
