# Personalization at 1M+ Users — TikTok / Instagram / Spotify, Mapped to Garnish

**Audience:** Garnish founder. **Date:** 2026-06-20. **Status:** research reference + build plan.

**What this is.** A code-grounded reference on how the big "For You" platforms personalize at 1M+ users, and a concrete translation of every mechanism to Garnish (Persian-first recipe app, EU launch, ~700–1008 dishes, sparse per-user cook/favorite/skip data, single market, ingredient-by-id backbone, source-locked nutrition, an existing 10-component heuristic ranker + behavior-signal engine). Each mechanism is rated for ROI at *launch* (solo founder, low data) vs *at scale*.

**The honest headline.** None of these companies' magic is one model. It's an **architecture**: a cheap retrieval stage over the whole catalog, a smarter ranking stage over a few hundred items, a re-ranking pass for diversity/quality, and a *statistics layer* (Bayesian shrinkage, bandits, hierarchical priors) that makes sparse data behave. Garnish at 700 dishes does **not** need the deep-learning towers. It needs the statistics layer and a clean two-stage shape — that is where 90% of the "it reads my mind + it's collectively smart" feeling comes from at our scale. The towers are a scale story you grow into, not a launch story.

**Garnish reality (grounded in code).** Live ranker is `RankingService.rank()` in `apps/server/src/recommendation/pipeline/ranking.service.ts` — a deterministic, interpretable 10-component weighted sum:

```
tasteAffinity 0.25 | outcomeFit 0.16 | behaviorFit 0.13 | effortFit 0.11
recipeUnderstanding 0.10 | novelty 0.08 | skillFit 0.06 | ingredientIntelligence 0.05
popularity 0.04 | recency 0.02
finalScore = max(0, Σ(score_i·weight_i) − exposurePenalty(userId, recipeId))
```
- **Candidate generation** already exists: `candidate-generator.ts` with 8 buckets (`similar`, `embedding` [deterministic content vector], `collaborative` [health-goal neighbors → their favorites], `trending`, `health`, `seasonal`, `inventory`, `cold_start`). This *is* a two-stage architecture in embryo.
- **Signals**: `SignalObservation` table (`userId, signalName, eventId, weight, observedAt`) fed by `signal-observation-engine.ts`; positive (`cook_complete`, `favorite_add`, `recipe_saved`…) and negative (`recipe_dismissed`, `recipe_skip`, `not_interested`, `quick_exit`…) events with a confidence policy (evidence count, recency half-life, explicit-feedback weight).
- **Profile**: `getLivingUserProfile()` (observed + declared + reconciled + maturity bands), `getFoodDnaProjection()` (GET `/profile/dna`), HARD allergy gate via `recipeSafetyCheck()` / `assessRecipeFit()`.
- **Popularity today** = `(views + favorites·2)/250` clamped — *engagement-only, no negative term*. This is the single biggest gap vs every platform below, and it's a one-file fix.
- **Cold-start**: `coldStartWeightBlend()` shifts weight to `recipeUnderstanding` + `popularity` + `ingredientIntelligence` when behavioral reliability < 0.65; declared answers capped at maturity 0.20.

The good news: the *shape* is right. The gaps are (1) popularity never deflates on rejection, (2) no regional/cohort prior, (3) no exploration policy (bandit), (4) no user↔user or item↔item collaborative signal beyond a coarse health-goal join. Those four are the whole game.

---

## 1. TikTok "For You" — the funnel everyone copies

### (a) How TikTok does it
**Multi-stage funnel.** Hundreds of millions of videos → retrieval narrows to ~thousands → ranking to ~hundreds → re-ranking picks the few you see. Retrieval must be cheap (it touches the whole corpus); ranking is expensive but only runs on the shortlist. ([TechAhead](https://www.techaheadcorp.com/blog/decoding-tiktok-system-design-architecture/), [Aman's AI Journal](https://aman.ai/primers/ai/sys-design/))

**Collaborative filtering on engagement.** The core signal is *implicit*: watch time, completion rate, replays, re-watches, shares, comments, follows from a video — and negatives: fast skips/swipe-aways, "not interested," "not this sound/author." Completion rate is the dominant positive; a fast scroll-away is the dominant negative. ([Buffer 2026](https://buffer.com/resources/tiktok-algorithm/), [UnderTheHood](https://underthehoodit.com/recommendation-systems/how-tiktok-for-you-recommendations-work/))

**Cold-start by audience expansion (the famous part).** A brand-new video is shown to a *small test audience* of users who liked similar content. If completion/shares/comments clear a bar, it's promoted to a larger audience; that next batch re-evaluates; sustained engagement keeps it scaling, weak engagement stops it. Follower count is explicitly *not* a direct ranking factor — each video is judged on its own engagement, which is why new creators can go viral. This is a **multi-armed bandit / staged rollout**: spend a small exploration budget to estimate quality, then exploit. ([Buffer 2026](https://buffer.com/resources/tiktok-algorithm/), [Miraflow](https://miraflow.ai/blog/tiktok-algorithm-2026-what-creators-need-to-know))

**Suppressing globally-disliked content (quality floor).** Content that performs poorly *across* its test audiences simply stops being distributed — negative feedback aggregates into a low predicted-engagement score and the item falls out of retrieval/ranking. Plus hard integrity filters (policy violations) and de-duplication / "don't repeat what you just showed."

**Monolith (the engine).** ByteDance's *Monolith* is a real-time recommender built for exactly this: a **collisionless embedding table** (Cuckoo hashmap, so two IDs never share a vector), **online training** that learns from feedback within minutes, and expirable embeddings + frequency filtering to bound memory. The thesis: trade some system reliability for *real-time* learning, because freshness beats a marginally-better stale model. ([Monolith, arXiv 2209.07663](https://arxiv.org/abs/2209.07663))

### (b) Recipe-app translation
- **Funnel → keep and formalize the 8-bucket generator.** 700 dishes don't need ANN; an in-memory pass is fine. But adopt TikTok's discipline: retrieval = *cheap recall* (union the buckets, dedup), ranking = the 10-component score on ~80–150 candidates, re-ranking = diversity + exposure penalty. We already have all three; just name and separate them.
- **Implicit signals → we already capture the right ones.** `cook_complete` is our "completion" (the strongest positive — cooking is the hardest action a user can take). `recipe_view` with `quick_exit` is our "fast scroll-away." `favorite_add`/`recipe_saved` ≈ share/save. `not_interested`/`recipe_dismissed`/`recipe_skip` ≈ "not interested." The mapping is one-to-one and already in `signal-observation-engine.ts`.
- **Cold-start a NEW dish by audience expansion.** When we add a dish (or a chef-submitted recipe later), don't trust its zero-data popularity. Give it an **exploration budget**: inject it into a small fraction of feeds (e.g. show to N users who like its cuisine/effort profile), measure cook/favorite vs skip, and let a Bayesian estimate (§4) promote or bury it. This is the bandit, scaled to 700 items — trivial.
- **Quality floor for the 200 always-skipped dishes** → §4 popularity deflation. This is the founder's example #1 and TikTok's exact mechanism: aggregate negative feedback suppresses the item *in retrieval*, before ranking even runs.

### (c) ROI / feasibility
- **At launch (solo, low data):** Formalizing the funnel = **free** (refactor). Exploration budget for new dishes = **high ROI, low effort** (it's a per-dish counter + a coin flip). Monolith-style online embeddings = **do not build** — irrelevant at 700 items and months of engineering.
- **At scale:** Online/near-real-time score updates become worth it once cook events flow continuously; embeddings worth it past ~10k recipes or rich content.

### (d) Data it needs
Per-recipe rolling counts of {impressions, views, quick_exits, cooks, favorites, skips, not_interested}. We already log all the events; we need the **per-recipe aggregate** (a materialized counter), which we mostly don't keep yet.

---

## 2. Instagram / Reels Explore — the two-tower blueprint

### (a) How Meta does it
**Funnel with real numbers.** Explore retrieves from billions, narrows hard, then ranks: retrieval pulls a large candidate set, a **lightweight first-stage ranker** (cheap model) trims it, a **heavy second-stage ranker** scores the survivors, and a final pass re-ranks for diversity/integrity. ([Engineering at Meta, 2023](https://engineering.fb.com/2023/08/09/ml-applications/scaling-instagram-explore-recommendations-system/); secondary: [Quastor](https://blog.quastor.org/p/engineering-behind-instagrams-recommendation-algorithm-dc9c), [Priyanka Gupta](https://medium.com/@priyankagupta2647/scaling-instagram-explore-a-masterclass-in-real-world-recommendation-systems-6069190abf5f))

**Two-tower retrieval.** One tower embeds the **user** (history, interests, demographics), one embeds the **item** (content + metadata). They're trained so a user's vector is close to items they'll engage with. At serving time the user vector is computed fresh and an **ANN index** (FAISS / HNSW) returns thousands of nearest items in single-digit milliseconds. Matrix factorization is the linear special case of this same idea. ([Meta](https://engineering.fb.com/2023/08/09/ml-applications/scaling-instagram-explore-recommendations-system/), [Shaped two-tower deep-dive](https://www.shaped.ai/blog/the-two-tower-model-for-recommendation-systems-a-deep-dive))

**Account-nearest-neighbors retrieval.** A cheap, powerful source: "accounts similar to ones you engaged with" → surface *their* recent media. This is item-to-item / account-to-account CF and needs no deep model.

**Multi-task ranking.** The second-stage model is a **multi-task multi-label (MTML)** network predicting *several* engagement probabilities at once — p(like), p(save), p(share), p(comment), p(see-more), p(watch-through) — then a **value model** combines them into one score with business/quality weights. Predicting many heads from shared features is more sample-efficient and lets you weight "save" (strong intent) above "like" (cheap). ([Meta](https://engineering.fb.com/2023/08/09/ml-applications/scaling-instagram-explore-recommendations-system/))

**Negative feedback, freshness, integrity.** "See fewer posts like this" / "not interested" directly down-weights similar content. Freshness boosts recent media; integrity/quality classifiers filter unsafe or low-quality items *before* ranking.

### (b) Recipe-app translation
- **Two-tower → at our scale, use item-item not user-item.** A full two-tower is overkill for 700 dishes. But the *content-embedding* idea is already live (`embedding` bucket = deterministic content vector). Upgrade it to a real **item↔item similarity** ("recipes like ones you cooked/loved") — this is the recipe analog of account-nearest-neighbors and it's the single highest-leverage CF move at low scale because it works from *one* positive signal.
- **Multi-task value model → we already have the value model.** Our 10-component weighted sum *is* a value model. The missing piece is making components behave like *calibrated engagement predictions*. Concretely: derive each recipe's empirical p(cook | shown), p(favorite | shown), p(skip | shown) from aggregated counts (§4) and feed shrunk versions into `outcomeFit`/`popularity`. Weight cook > favorite > view, exactly as Meta weights save > like.
- **"See fewer" → already wired.** `not_interested`/`recipe_dismissed` flow into negative signals. Add an *ingredient/cuisine-level* generalization: a dismiss on a fish dish should nudge down the user's fish affinity (`signal_<ingredientId>` nudges already exist in `ingredientPreferenceNudge()`), so the negative *generalizes* like Meta's does, not just hides one card.
- **Integrity → our allergy gate is the strongest version of this.** `recipeSafetyCheck()` is a HARD pre-ranking filter. That's exactly Meta's integrity-before-ranking discipline; keep it inviolable.

### (c) ROI / feasibility
- **At launch:** Item-item similarity = **highest-ROI CF mechanism for us**; works from a single cook/favorite, no critical mass needed. Multi-head calibrated probabilities = **medium ROI**, needs aggregated counts first. Full two-tower + ANN = **don't** (700 items, no training data).
- **At scale:** Two-tower retrieval + ANN earns its keep past tens of thousands of items/users, or when content (images, steps, GRIS text) is rich enough to learn embeddings. Multi-task DNN ranker comes after that.

### (d) Data it needs
Item-item: a precomputed recipe-similarity matrix (cheap: content vector cosine, or co-cook/co-favorite counts). Calibrated heads: per-recipe {shown, cooked, favorited, skipped} counters. Negative generalization: ingredient/cuisine tags on recipes (we have `region`, `categories`, `RecipeIngredient` → `Ingredient`).

---

## 3. Spotify — bandits, hybrid CF+content, and explainable shelves

### (a) How Spotify does it
**BaRT — Bandits for Recommendations as Treatments.** The Home screen ranks both the cards within a shelf *and* the shelves themselves with **multi-armed bandits**, using **epsilon-greedy** explore/exploit: mostly show what the model predicts you'll stream (exploit), but a fraction of the time show something uncertain (explore) to learn. Exploitation runs on collaborative filtering; when there's no data to exploit, exploration takes over. The foundational paper is **"Explore, Exploit, Explain" (RecSys 2018)** — bandits + explanations ("recsplanations": *because you listened to X*), which lifted stream rate over non-bandit baselines. ([Spotify Research](https://research.atspotify.com/publications/explore-exploit-explain-personalizing-explainable-recommendations-with-bandits), [Dynamoi BaRT overview](https://dynamoi.com/learn/faqs/what-is-spotify-bart-algorithm), [James McInerney](https://jamesmc.com/blog/2018/10/1/explore-exploit-explain))

**Hybrid: collaborative + content (audio).** CF finds "people with taste like yours also played this." But CF can't recommend a brand-new or obscure track (no plays = no signal = **cold start**). So Spotify *also* trains a **CNN on audio spectrograms** to predict a track's CF latent vector directly from sound — a new release with zero plays can be recommended because its *audio* sits near things you like. This is the canonical content-based fix for item cold-start. ([Sander Dieleman](https://sander.ai/2014/08/05/spotify-cnns.html), [van den Oord & Dieleman, "Deep content-based music recommendation," NeurIPS 2013](https://www.semanticscholar.org/paper/Deep-content-based-music-recommendation-Oord-Dieleman/eeff60867041d2ea92d1b38a20c2031d240d8872))

**Discover Weekly vs Daily Mix.** Discover Weekly = *discovery*: tracks you haven't heard, pulled from the playlists of users with taste like yours (CF), refreshed weekly. Daily Mixes = *exploitation comfort*: clusters of your established taste with a few familiars, near-infinite, lower-risk. Two products, two explore/exploit settings. ([djinit.ai](https://djinit-ai.github.io/2020/04/16/Spotify's-algorithm.html))

**Contextual & taste profile.** Time of day, day of week, device/activity (workout vs focus) shape Home. A per-user **taste profile / affinity** (artists, genres, micro-genres) is the persistent prior personalized over time.

### (b) Recipe-app translation
- **BaRT epsilon-greedy → the single most "alive"-feeling, cheapest upgrade we can ship.** Today the feed is pure-exploit (top-scored every time), which feels static and starves new/niche dishes of data. Add a small explore slot: reserve ~10–20% of feed positions for higher-uncertainty dishes (few impressions, or score near the cutoff), chosen by **Thompson sampling** (sample from each dish's Beta posterior of cook-rate; §4) or simple epsilon-greedy. This *simultaneously* solves new-dish cold-start, breaks filter bubbles, and gathers the data the rest of the system needs. ([Spotify 2018](https://research.atspotify.com/publications/explore-exploit-explain-personalizing-explainable-recommendations-with-bandits); bandit cold-start: [Cold-start via contextual bandits](https://www.researchgate.net/publication/262732636_Cold-start_Problems_in_Recommendation_Systems_via_Contextual-bandit_Algorithms))
- **"Recsplanations" → we already have the substrate.** `assessRecipeFit()` returns explainable reasons; `ContributionCalculatorService` returns per-component contribution. Surface "because you cooked X" / "quick, like you prefer" on each card — Spotify found explanations *themselves* lift engagement, and they make the personalization *legible* (the "reads my mind" feeling is partly just *telling the user* it read their mind).
- **Hybrid CF+content for cold dishes → our `recipeUnderstanding` IS the audio-CNN analog.** A brand-new dish with no engagement still gets scored on content (ingredient vector, taste/texture profile, token diversity). That's precisely Spotify's audio fallback. Keep it as the cold-start anchor; let CF (item-item, popularity) take over as engagement accrues.
- **Discover Weekly vs Daily Mix → two recipe surfaces.** "For You today" = exploit (safe, high-affinity, weeknight-appropriate). A weekly **"Discover" / "Try something new"** rail = explore (cuisines/techniques adjacent to your taste but unfamiliar), refreshed weekly. Same engine, two explore settings — cheap to add as a second query.
- **Context → we have weekday awareness already** (`isIranWeekday()`, weekday-aware `effortFit`). Extend to time-of-day → meal type (breakfast in the morning), which is high-signal and trivial.

### (c) ROI / feasibility
- **At launch:** Epsilon-greedy/Thompson explore slot = **top-3 ROI overall** (solves cold-start + diversity + data-gathering in one ~1-day mechanism). Recsplanations = **high ROI, low effort** (data already computed). Discover rail = **medium**, nice once base feed is solid.
- **At scale:** Contextual bandit (LinUCB / contextual Thompson) replacing epsilon-greedy once you have features worth conditioning on. Audio-CNN-style learned content embeddings only if recipe content gets much richer.

### (d) Data it needs
Per-dish impression + outcome counts (for the posterior). User taste profile (have it: `getLivingUserProfile`). Context: timestamp → meal-time bucket (free). Explanations: already produced by `assessRecipeFit`/contribution calculator.

---

## 4. The cross-cutting "1M-user" patterns (the core the founder asked for)

This section is the heart of the brief. Each mechanism: how platforms do it → recipe translation → ROI → data. **The founder's three examples are answered inline where they belong.**

### 4.1 Collaborative filtering & user/item embeddings — "users like you" + "items like this"
**Platforms.** CF learns user & item vectors by factorizing the interaction matrix (matrix factorization), or via two-tower nets (the nonlinear generalization), or graph methods. YouTube's candidate generator learns user/video embeddings from watch history ([Covington et al., RecSys 2016](https://www.semanticscholar.org/paper/Deep-Neural-Networks-for-YouTube-Recommendations-Covington-Adams/5e383584ccbc8b920eaf3cfce3869da646ff5550)); Google's [sampling-bias-corrected two-tower](https://research.google/pubs/sampling-bias-corrected-neural-modeling-for-large-corpus-item-recommendations/) does it for YouTube retrieval at corpus scale, correcting in-batch-negative bias under power-law popularity.

**Recipe translation.** At 700 dishes, **item-item CF beats user-item** and beats embeddings:
- *Items-like-this:* recipe similarity = cosine of content vectors (live now) blended with **co-engagement** ("users who cooked A also cooked B"). One cook unlocks a whole neighborhood of recommendations — no critical mass needed. This is the practical realization of the dormant `getCollaborativeRecipes()` (currently a coarse health-goal join → upgrade to co-cook/co-favorite counts).
- *Users-like-you:* defer. Real user embeddings need thousands of users with dense histories; at launch the **cohort/region prior (§4.3) is the cheap stand-in for "users like you."**

**The founder's example #3 — "1M users each different."** *The embedding + two-stage answer:* user & item vectors place every user and dish in one space; retrieval = ANN nearest dishes to the user vector; ranking refines. *Graceful degradation at low scale:* with few users the user-vector is unreliable, so you **fall back up the hierarchy** — personalize from the user's own sparse signals where they exist, and borrow the cohort/region/global prior where they don't (§4.3). You don't switch architectures as you grow; you switch *how much you trust the individual vs the prior*, which is exactly what shrinkage (§4.2–4.3) does automatically. So Garnish ships the *same* two-stage shape now and grows the embedding into it later.

**ROI.** Item-item co-engagement CF: **high at launch.** User embeddings / two-tower: **scale-only.** **Data:** co-occurrence counts of (cook, favorite) across users per recipe pair; content vectors (have).

### 4.2 Popularity priors and — crucially — popularity DEFLATION
**Platforms.** Raw popularity is an engagement *prior*, but the decisive trick is **not sorting by average**. [Evan Miller, "How Not To Sort By Average Rating" (2009)](https://www.evanmiller.org/how-not-to-sort-by-average-rating.html) (used by Reddit/Yelp) ranks by the **Wilson score lower bound** of the positive-rate: treat each positive as a success, each negative as a failure, and rank by the *lower* confidence bound — items with few votes get pulled down (wide interval), items with lots of evidence keep a score near their true rate. The Bayesian sibling is **shrinkage**: an item's estimated quality is pulled toward the global prior in proportion to how little data it has.

**Recipe translation — and the founder's example #1 (200 dishes everyone skips).**
- Replace today's `(views+favorites·2)/250` (engagement-only, **no negative term**) with a **two-sided quality estimate per dish**: define positives = {cook_complete, favorite}, negatives = {skip, not_interested, quick_exit}, then
  `acceptRate = (positives + α) / (positives + negatives + α + β)` — a **Beta-Bayesian shrunk accept-rate** with prior (α, β) set to the global mean (e.g. global cook/favorite rate). Rank by this (or its Wilson lower bound). A dish skipped by everyone has positives≈0, negatives high → accept-rate collapses below the global prior → it **deflates out of retrieval**, automatically. No manual blocklist.
- **The trap — don't kill minority-good dishes.** A pure global accept-rate would wrongly bury a dish that 5% of users *love* but 95% skip (a polarizing offal stew, a very spicy dish). The fix is the mechanism platforms use: **the global deflation is only a prior; it's overridden by personal and cohort fit.** Concretely:
  1. The deflated popularity is just *one* low-weight component (0.04) — `tasteAffinity` (0.25) and `ingredientIntelligence` dominate. A minority-good dish still surfaces *for the minority* because their taste signals lift it far above the popularity penalty.
  2. Better: compute accept-rate **conditioned on cohort** (§4.3), not just globally. A dish that's globally-skipped but loved by the "loves-spicy" cohort keeps a high *cohort* accept-rate and surfaces for that cohort. Global deflation only fully bites a dish that *nobody, in no cohort,* accepts — which is the correct target (a genuinely bad/mislabeled dish), exactly what we *want* to bury among those 200.
  3. **Keep the exploration budget (§4.4) flowing to deflated dishes** so a wrongly-buried dish can recover if its small future audience actually likes it. Deflation must be *reversible*, never a permanent ban — this is TikTok's "keep re-testing" discipline.

**ROI.** **Highest ROI single change in this document, and a near-one-file fix** (`calculatePopularityScore`). Directly answers founder example #1, fixes the only structural flaw in the live ranker. **Data:** per-recipe {positives, negatives} counters (need to add) + a global prior (compute from the same counters).

### 4.3 Cohort / regional / geo priors with hierarchical (empirical-Bayes) shrinkage
**Platforms.** When individual data is sparse, borrow strength from the group: estimate a user's preference as a **shrinkage blend** of (their own signal) and (their cohort/region/global average), weighting the prior more when individual data is thin and personalizing away from it as evidence grows. This is **hierarchical / empirical-Bayes** estimation (user → cohort → region → global). ([Hierarchical Bayesian Personalized Recommendation, arXiv 1908.07371](https://arxiv.org/pdf/1908.07371); empirical-Bayes shrinkage background via the search corpus.)

**Recipe translation — and the founder's example #2 ("a region prefers fish").**
- Maintain affinity estimates at four levels: **global → region/market → cohort → user**. For any (user, attribute) — e.g. fish, spicy, vegetarian, quick-meals — the estimate is:
  `affinity(user, fish) = shrink(user_signal, cohort_avg, region_avg, global_avg)`
  where the shrinkage weight on each higher level ∝ 1/(evidence at the lower level). A brand-new EU user in a fish-leaning region inherits `region_avg(fish)` high → fish dishes rank up *on day one* (the region prior does the work before the user has revealed anything).
- **Decay as individual signal grows:** as the user cooks/skips, `user_signal` accumulates evidence and its weight rises, so the estimate **slides from the regional prior toward the user's revealed taste**. A fish-region user who keeps skipping fish will, within a handful of signals, override the prior and stop seeing fish — *automatically*, because shrinkage re-weights toward the now-evidenced individual. This is the precise, principled version of "use the regional prior, then personalize away from it."
- **For Garnish specifically:** "region" at single-EU-market launch is coarse, so the most useful levels are **global → cohort → user**, where cohorts come from onboarding (diet, spice tolerance, skill, quick-vs-elaborate, health goal — all already captured) and the `region` field is the *recipe's* Persian origin, usable as a content feature. As you expand to multiple EU markets, the geo level switches on with no architecture change.

**ROI.** **High at launch** — this is what makes the cold-start feed feel *non-generic* and "collectively smart" before any individual data exists, and it's just grouped averages + a shrinkage formula (no ML). It's also the cheap stand-in for "users like you" (§4.1) until user embeddings are viable. **Data:** cohort tags per user (have, from onboarding); per-(cohort, attribute) accept-rate aggregates (compute from the §4.2 counters, grouped); recipe attribute tags (have: region, ingredients, diet, mealType, cost, effort).

### 4.4 Cold-start — bandits, exploration budgets, cohort defaults, onboarding capture
**Platforms.** New *item* cold-start: content embeddings (Spotify audio CNN) + staged audience expansion (TikTok) + bandit exploration (Spotify BaRT). New *user* cold-start: onboarding taste capture + cohort defaults + heavy exploration early. Bandits (Thompson sampling, LinUCB) are the principled tool — recommend likely-good items while *deliberately* sampling uncertain ones to learn. ([Spotify 2018](https://research.atspotify.com/publications/explore-exploit-explain-personalizing-explainable-recommendations-with-bandits), [contextual-bandit cold-start](https://www.researchgate.net/publication/262732636_Cold-start_Problems_in_Recommendation_Systems_via_Contextual-bandit_Algorithms))

**Recipe translation.**
- *New user:* onboarding already captures declared taste (capped at maturity 0.20 — correct, don't over-trust stated preferences); cohort defaults (§4.3) fill the rest; run a higher explore fraction for the first ~N sessions, then anneal it down. `coldStartWeightBlend()` already shifts weight to content+popularity — extend it to *also* raise the explore budget.
- *New dish:* score on content (`recipeUnderstanding`, live) + give it an **exploration budget** via the bandit so it earns real engagement data, then let the §4.2 Beta posterior promote/bury it. **Thompson sampling** is the clean implementation: each dish has a Beta(α+positives, β+negatives) posterior; to fill explore slots, *sample* an accept-rate from each candidate's posterior and pick the max — new dishes (wide posterior) sometimes win the sample and get shown, which is exactly the controlled exploration you want, self-annealing as evidence accumulates.

**ROI.** **High at launch** (cold-start is *the* dominant regime when you have few users). Onboarding capture: have it. Cohort defaults: §4.3. Thompson explore slot: ~1 day, top-3 ROI. **Data:** Beta counters per dish (= §4.2 counters), onboarding answers (have), session counter per user.

### 4.5 Negative feedback & fatigue — skips, dismisses, "already cooked," recency penalties
**Platforms.** Explicit ("not interested," "see fewer") generalizes to similar items; implicit skips down-weight; and a **recency/fatigue penalty** stops re-showing what you just saw or already consumed. TikTok dedups and avoids repeats; Instagram down-weights "seen."

**Recipe translation — mostly already built, two gaps.**
- *Have:* `exposurePenalty` (`exposure-tracking.service.ts`) subtracts from score per impression — this is the fatigue/recency penalty, live and correct.
- *Have:* negative signals (`recipe_skip`, `not_interested`…) lower taste affinity; `ingredientPreferenceNudge()` generalizes per-ingredient.
- *Gap 1 — "already cooked."* There's no explicit `alreadyCooked` suppression; a `cook_complete` should apply a *strong, long* recency penalty (you don't want last night's dinner re-recommended tonight) but a *positive* taste signal (you liked it enough to cook). These pull in opposite directions and both are correct: boost the *type*, suppress the *instance* for a cooldown window. Add an explicit cooked-recently penalty keyed to `cook_complete`.
- *Gap 2 — generalize "not interested" to cuisine/cohort,* not just the one card (per §2 translation).

**ROI.** **Medium, mostly polish** — the spine exists. The "already cooked" cooldown is the one genuinely missing, high-value piece (prevents the most jarring "didn't it just suggest this?" moment). **Data:** have it (`cook_complete` timestamps, exposure log).

### 4.6 Diversity, serendipity, filter-bubble avoidance; position-bias; freshness
**Platforms.** Re-ranking enforces diversity (don't show 10 near-identical items), injects serendipity (the explore budget doubles as anti-bubble), and **corrects position bias** (top slots get clicked regardless of quality, so training must discount that). Freshness boosts new items.

**Recipe translation.**
- *Diversity:* a re-rank pass capping near-duplicates — e.g. no more than 2 of the same cuisine/protein/mealType in the top N. Cheap MMR-style greedy de-dup on top of the ranked list. We dedup candidates but don't *diversity-cap* the final list yet — add it.
- *Serendipity / bubble:* the §4.4 explore slot already provides this; one mechanism, three payoffs (cold-start + data + diversity).
- *Position bias:* relevant **only once we train on logged feedback** — at that point, weight a cook from position 8 more than from position 1. Not needed for the heuristic ranker; flag it for the day we fit weights from data.
- *Freshness:* `recency` component exists (weight 0.02). Fine; new-dish freshness is better handled by the explore budget than a static recency weight.

**ROI.** Diversity cap: **medium, easy.** Serendipity: **free** (reuses explore). Position-bias correction: **scale-only** (needs a learned ranker). **Data:** recipe cuisine/protein/mealType tags (have).

### 4.7 Two-stage architecture (cheap retrieval → expensive ranking) and why scale needs it
**Platforms.** You cannot run a heavy model over hundreds of millions of items per request. So: **retrieval** (cheap, whole-catalog, recall-oriented) → **ranking** (expensive, ~hundreds, precision-oriented) → **re-ranking** (diversity/integrity). YouTube (Covington 2016), Instagram, TikTok all share this shape.

**Recipe translation.** At 700 dishes the *compute* argument is moot (you could score all 700). But adopt the *shape* anyway, because it's the right place to hang each mechanism and it's how you scale without a rewrite:
- **Retrieval** = union of buckets (have) + cohort/region prior bias (§4.3) → ~80–150 candidates. Add deflation here so the 200 bad dishes rarely enter.
- **Ranking** = 10-component value model (have) with calibrated/shrunk popularity (§4.2).
- **Re-ranking** = exposure penalty (have) + diversity cap (§4.6) + explore-slot injection (§4.4).
This is the existing pipeline, cleanly labeled — minimal new code, future-proof.

**ROI.** Refactor-only at launch (**free, high strategic value**). Becomes *load-bearing* once the catalog or user base grows. **Data:** none new.

---

## Cross-mechanism ROI ranking (all of §1–4, ranked)

| # | Mechanism | Platform origin | Launch ROI | Effort | Garnish status |
|---|-----------|-----------------|------------|--------|----------------|
| 1 | **Popularity deflation** (Beta/Wilson two-sided accept-rate, cohort-conditioned) | TikTok quality floor, Evan Miller/Reddit | ★★★★★ | Low (≈1 file) | gap — fixes founder ex.#1 |
| 2 | **Cohort/region prior + hierarchical shrinkage** | Spotify/Meta priors, empirical Bayes | ★★★★★ | Low–Med | gap — fixes founder ex.#2 |
| 3 | **Exploration budget / Thompson explore slot** | Spotify BaRT, TikTok expansion | ★★★★★ | Low (~1 day) | gap — solves cold-start+diversity+data |
| 4 | **Item-item co-engagement CF** ("recipes like ones you cooked") | Meta account-NN, MF | ★★★★☆ | Med | partial (`getCollaborativeRecipes` coarse) |
| 5 | **"Already cooked" cooldown + negative generalization** | Meta "see fewer," dedup | ★★★★☆ | Low | partial (exposure exists; cooldown gap) |
| 6 | **Recsplanations** ("because you cooked X") | Spotify Explore-Exploit-Explain | ★★★★☆ | Low (data exists) | gap — surface existing contributions |
| 7 | **Two-stage funnel, formalized** (retrieval/rank/rerank) | YouTube/TikTok/Meta | ★★★☆☆ | Low (refactor) | partial — shape exists |
| 8 | **Diversity cap re-rank** (cuisine/protein/mealType) | Meta/TikTok rerank | ★★★☆☆ | Low | gap |
| 9 | **Discover/"try new" weekly rail** (explore surface) | Spotify Discover Weekly | ★★★☆☆ | Low–Med | gap |
| 10 | **Context: time-of-day → meal type** | Spotify contextual | ★★★☆☆ | Low | partial (weekday only) |
| 11 | **Two-tower retrieval + ANN, user embeddings** | Meta/YouTube/Google | ★☆☆☆☆ now | High | scale-only |
| 12 | **Online/real-time learned embeddings** (Monolith) | TikTok Monolith | ☆ now | Very high | scale-only |

---

## Minimum viable world-class recsys for Garnish

The smallest set that delivers the biggest **"it reads my mind + it's collectively smart"** feeling, in implementation order. Each step is independently shippable and compounds with the last. Everything here is statistics + the *existing* pipeline — **no deep learning, no new infra**.

**Phase 0 — Aggregate counters (the substrate; everything depends on it).**
Materialize per-recipe rolling counts {impressions, views, quick_exits, cook_complete, favorite, skip, not_interested}, and the same grouped by cohort. We already log every event; we just don't aggregate them. *Without this, nothing below works; with it, items 1–6 are mostly arithmetic.*

**Phase 1 — Popularity deflation (founder ex.#1).** Replace `calculatePopularityScore`'s engagement-only formula with a **Beta-shrunk, cohort-conditioned accept-rate** (positives vs negatives, prior = global/cohort mean). The 200 always-skipped dishes sink out of retrieval; minority-good dishes survive via cohort accept-rate + the dominant `tasteAffinity` weight. *Biggest single win, one-file change. → "collectively smart."*

**Phase 2 — Cohort/region prior with shrinkage (founder ex.#2).** Compute per-(cohort, attribute) affinities; blend user→cohort→global by evidence-weighted shrinkage; feed into `tasteAffinity`/`ingredientIntelligence`. New users get a non-generic, region/cohort-aware feed on day one that *slides toward their revealed taste* as they cook. *→ "reads my mind from the first session," and the cheap "users like you."*

**Phase 3 — Thompson explore slot.** Reserve ~10–20% of feed positions for dishes sampled from their Beta posterior (new/uncertain win the sample sometimes). Self-annealing. *Solves new-dish cold-start, breaks filter bubbles, and—critically—generates the engagement data that makes Phases 1–2 sharper over time. The flywheel.*

**Phase 4 — Item-item co-engagement CF.** Upgrade the dormant `collaborative` bucket from a health-goal join to "users who cooked/loved A also cooked B" (co-occurrence + content cosine). One positive signal now lights up a neighborhood. *→ the strongest "items like this" at our scale.*

**Phase 5 — Recsplanations + "already-cooked" cooldown + diversity cap.** Surface the per-component contribution we *already compute* ("quick, like you prefer · because you cooked Ghormeh Sabzi"); add a strong recency cooldown keyed to `cook_complete`; cap near-duplicate cuisines/proteins in the top N. *→ the personalization becomes legible and the feed stops repeating itself — the polish that makes it* feel *world-class.*

**Explicitly deferred (do NOT build at launch):** two-tower retrieval, ANN/FAISS, user embeddings, multi-task DNN ranker, Monolith-style online embedding tables. These are scale stories (tens of thousands of items/users, or much richer content). The two-stage *shape* from Phase 0–5 is exactly what you slot them into later — **no rewrite**, just swap the retrieval source and the value model when the data justifies it.

**Why this order is "world-class at our scale":** Phases 1–2 make the system *collectively smart and individually warm* using nothing but Bayesian averages over data we already log. Phase 3 turns it into a *learning* system (the flywheel). Phase 4 adds genuine CF. Phase 5 makes it *feel* alive and explained. That is the entire perceived magic of TikTok/Spotify/Instagram — staged audience expansion, explore/exploit bandits, shrinkage priors, and explanations — delivered with arithmetic, not GPUs, because at 700 dishes the statistics layer *is* the product.

---

## Sources
- TikTok funnel / system design: [TechAhead](https://www.techaheadcorp.com/blog/decoding-tiktok-system-design-architecture/), [Aman's AI Journal — Recsys System Design](https://aman.ai/primers/ai/sys-design/), [UnderTheHood](https://underthehoodit.com/recommendation-systems/how-tiktok-for-you-recommendations-work/)
- TikTok cold-start / audience expansion: [Buffer — TikTok Algorithm 2026](https://buffer.com/resources/tiktok-algorithm/), [Miraflow](https://miraflow.ai/blog/tiktok-algorithm-2026-what-creators-need-to-know)
- TikTok Monolith: [Liu et al., "Monolith: Real Time Recommendation System With Collisionless Embedding Table," arXiv 2209.07663 (ORSUM@RecSys 2022)](https://arxiv.org/abs/2209.07663)
- Instagram/Reels Explore: [Engineering at Meta (2023)](https://engineering.fb.com/2023/08/09/ml-applications/scaling-instagram-explore-recommendations-system/), [Quastor breakdown](https://blog.quastor.org/p/engineering-behind-instagrams-recommendation-algorithm-dc9c), [Priyanka Gupta — Scaling Instagram Explore](https://medium.com/@priyankagupta2647/scaling-instagram-explore-a-masterclass-in-real-world-recommendation-systems-6069190abf5f)
- Two-tower / retrieval: [Shaped — Two-Tower deep dive](https://www.shaped.ai/blog/the-two-tower-model-for-recommendation-systems-a-deep-dive), [Yi et al., "Sampling-Bias-Corrected Neural Modeling for Large Corpus Item Recommendations," Google (RecSys 2019)](https://research.google/pubs/sampling-bias-corrected-neural-modeling-for-large-corpus-item-recommendations/)
- YouTube two-stage: [Covington, Adams, Sargin, "Deep Neural Networks for YouTube Recommendations," RecSys 2016](https://www.semanticscholar.org/paper/Deep-Neural-Networks-for-YouTube-Recommendations-Covington-Adams/5e383584ccbc8b920eaf3cfce3869da646ff5550)
- Spotify BaRT / bandits: [McInerney et al., "Explore, Exploit, Explain," Spotify Research (RecSys 2018)](https://research.atspotify.com/publications/explore-exploit-explain-personalizing-explainable-recommendations-with-bandits), [James McInerney blog](https://jamesmc.com/blog/2018/10/1/explore-exploit-explain), [Dynamoi BaRT overview](https://dynamoi.com/learn/faqs/what-is-spotify-bart-algorithm)
- Spotify audio content-based cold-start: [Dieleman, "Recommending music on Spotify with deep learning" (2014)](https://sander.ai/2014/08/05/spotify-cnns.html), [van den Oord & Dieleman, "Deep content-based music recommendation," NeurIPS 2013](https://www.semanticscholar.org/paper/Deep-content-based-music-recommendation-Oord-Dieleman/eeff60867041d2ea92d1b38a20c2031d240d8872), [Spotify algorithm overview](https://djinit-ai.github.io/2020/04/16/Spotify's-algorithm.html)
- Popularity deflation / ranking statistics: [Evan Miller, "How Not To Sort By Average Rating" (2009)](https://www.evanmiller.org/how-not-to-sort-by-average-rating.html)
- Hierarchical / empirical-Bayes shrinkage: [Zhang et al., "Hierarchical Bayesian Personalized Recommendation: A Case Study and Beyond," arXiv 1908.07371](https://arxiv.org/pdf/1908.07371)
- Bandits for cold-start: [Cold-start Problems in Recommendation Systems via Contextual-bandit Algorithms](https://www.researchgate.net/publication/262732636_Cold-start_Problems_in_Recommendation_Systems_via_Contextual-bandit_Algorithms), [LinUCB — Li et al., "A Contextual-Bandit Approach to Personalized News Article Recommendation" (WWW 2010)]
