# The Garnish Personalization & Recommendation Standard

**Status:** the global reference architecture. **Author stance:** this is the document a competitor's head of recsys should read and feel behind. **Date:** 2026-06-20.

**What this is.** The principles, contracts, and reference architecture for the best food-personalization system in the world — a system that makes a user feel it *reads their mind and became one with them*. It is grounded in the Garnish forensic audit (`PERSONALIZATION_AUDIT.md`), five adversarial dimension findings (`_findings/*`), and four world-research briefs (`_research/*`). It is opinionated on purpose: every section gives the **principle**, **why it is non-negotiable**, and **how Garnish implements it concretely** — reusing what already exists where it is sound, replacing what only pretends to.

**The two grading bars.** This document is graded against two different bars and says which one applies in each section:
1. **The category bar** (Yummly, Samsung Food, Mealime, SideChef, NYT Cooking, KptnCook, ChefGPT, Cookpad, Tasty). The research finding is blunt: the whole category ships *a diet/allergy filter wizard plus context rules plus a couple of editorial rows.* Yummly — 25M users, a patented "Food Genome" — shut down at "no personalization beyond dietary filters." **The bar to beat is low.**
2. **The vision bar** (TikTok / Instagram / Spotify "for you," translated to food). This is the founder's bar and the one this Standard is written to. The magic of those systems is **not one model** — it is an *architecture*: cheap retrieval → expensive ranking → diversity re-rank, sitting on a **statistics layer** (Bayesian shrinkage, bandits, hierarchical priors) that makes sparse data behave, plus a **legibility/control layer** that converts accuracy into felt understanding without tipping into creepiness.

**The strategic thesis of this Standard.** Garnish has the one asset that lets it skip the "wait for a billion interactions" trap: **ingredient-level content data** (per-ingredient taste/texture/cookingBehavior/nutrition/role/allergens, GRIS food-science, USDA-locked nutrition). *Content-grounded learned taste embeddings personalize from interaction #1 — no collaborative data required.* So the correct build order is **content-first learning engine now → collaborative + deep models auto-activate as interaction data accrues.** This is not a compromise; it is why Garnish can *learn* while competitors are still waiting for data.

---

## The Ten Pillars (the spine of the Standard)

| # | Pillar | One-line principle |
|---|--------|--------------------|
| 1 | **Signal Model** | Every meaningful action is captured, typed, weighted by commitment, consent-gated at ingest, and durably routed — *the loop must close at the cook.* |
| 2 | **Taste Model & Embeddings** | Each user and each recipe live as vectors in **one shared content-grounded taste space**, learned from real engagement — not keyword token-matching. |
| 3 | **Candidate Generation** | Cheap, recall-oriented two-stage retrieval over the whole catalog, with deflation and priors applied *before* ranking. |
| 4 | **Ranking** | A hybrid value model that **learns its weights from logged outcomes**, with a cold-start heuristic fallback — never permanently hand-tuned. |
| 5 | **Collective Intelligence** | Popularity *deflation*, cohort/region priors via hierarchical shrinkage, and item-item co-engagement CF — the network effect, delivered with arithmetic. |
| 6 | **Exploration (Bandits)** | A Thompson explore slot that solves cold-start, breaks filter bubbles, and *generates the data the rest of the system needs.* The flywheel. |
| 7 | **Context Engine** | The same dish ranks differently at 8am vs 7pm, summer vs winter, full pantry vs empty — context is a first-class re-score, not a greeting string. |
| 8 | **Transparency & Control** | "Because you cooked X." A visible, **tunable** taste-DNA whose edits are training signal. Legibility *is* the magic, and the antidote to creepiness. |
| 9 | **Evaluation** | Temporal held-out offline eval + interleaving for ranker comparison + a hard allergy-violation-rate-must-be-zero gate. No circular self-proofs, ever. |
| 10 | **Privacy & Trust** | Consent enforced *at ingest*, the HARD allergy gate inviolable, retention operational, the user's data viewable/editable/deletable as a feature. |

The rest of this document is one section per pillar, plus a reference architecture diagram, the data contracts, and the acceptance tests that define "done."

---

## Pillar 1 — The Signal Model

**Principle.** Personalization is only as good as the signals that reach it. Every meaningful user action must be (a) **captured**, (b) **typed** into a stable taxonomy, (c) **weighted by commitment** (a *cook* ≫ a *save* ≫ a *view* ≫ a *dwell*), (d) **consent-gated at the moment of collection**, and (e) **durably routed** to the profile and the feature store. A signal that drops on the floor is worse than absent — it makes the system *look* like it learns while it doesn't.

**Why it is non-negotiable.** TikTok's entire "how does it know me?" effect is implicit signal: completion rate, rewatch, fast-skip, dwell. For a recipe app the implicit gold is **opened → saved → cooked → cooked again**. "Cooked again" is the rewatch — the strongest signal in the domain and the one most apps ignore. If the marquee action (cooking) teaches the ranker nothing, there is no personalization to speak of, no matter how sophisticated the downstream math.

**The Garnish reality to fix (from the audit).** This is the system's deepest wound. `cook_complete` is emitted by the web app (`useCook.js:101`) but has **no processor**, is **dropped by the event router** (`event-router.service.ts:10-13`), and is **absent from every feature-store window** (`feature-store.service.ts:184,230-239`). The positive taste extractor (`extractSignalsFromRecipe` → `likes_stew`/`likes_chicken`) only fires on `recommendation_cook`/`recommendation_save` — events the web app *never emits* (`signal-calculator.service.ts:60-67`; constants-only `eventTaxonomy.js:128-130`). The result is verifiable: **cook 10 Persian stews → tomorrow is unchanged.** Only the negative (dismiss) loop closes (`useDismissRecommendation.js:21` → `recommendation.signal-processor.ts:45-46`).

**How Garnish implements it concretely.**

1. **A commitment-weighted event taxonomy** with explicit signal strengths, captured at ingest:

   | Event | Commitment | Signal | Notes |
   |-------|-----------|--------|-------|
   | `cook_complete` | **Highest** | positive taste (+~0.4) + per-ingredient signals + strong instance cooldown | The rewatch. Currently dropped — this is fix #1. |
   | `cook_again` / post-cook 👍 | **Highest+** | strongest positive; "would cook again" | Add a one-tap post-cook check-in (KptnCook's cleanest-in-category signal). |
   | `favorite_add` | High | aspirational positive → *aspire* vector | Saves are what they *wish* they cooked; keep separate from cooks. |
   | `recipe_view` (+ dwell) | Low | weak content-recall positive | Long dwell, no save = "interested, not now." |
   | `quick_exit` | Low-neg | the fast scroll-away | Implicit negative. |
   | `recipe_dismiss` / `not_interested` | Explicit-neg | negative taste + **generalizes** to cuisine/ingredient | Already wired for the card; must generalize. |
   | `favorite_remove` | Med-neg | remove/decrement prior | Currently writes a *positive* — a real bug (`processor.registry.ts:25`). |

2. **Two-track taste model.** Maintain an **"aspire" vector** (saves, long dwells) and an **"actually cook" vector** (completed cooks) as distinct buckets. Surface them differently — *"Saved for someday"* vs *"Your weeknight rotation."* Naming the difference back to the user is itself an "it gets me" moment, and it prevents the **aspiration trap** (recommending fantasy food they never make).

3. **The full observation contract, persisted.** Today `SignalObservation` is a thin `{signalName, eventId, weight}` row (`schema.prisma:575-585`) that cannot carry `confidence`, `strength`, `consentPurpose`, `privacyClass`, or `value` — so the observed graph is *reconstructed from coarse means with fabricated confidence* (`recommendation-shadow-a8-adapters.ts:62-77`). **Persist the full contract** (columns or a JSON `value` blob) written by `extractSignalObservations`, and retire the ad-hoc processor writes.

4. **Durable write→read handoff.** The one live loop (dismiss) is fire-and-forget with `.catch(console.error)` (`analytics.service.ts:94`) and can race the feature-vector rebuild. High-value events (cook, dismiss) go through a **durable outbox/queue with await+retry**; `rank()` must own or assert feature-vector freshness so a cook reliably influences the *very next* fetch.

5. **Derive taste from structure, not localized strings.** Taste extraction today is hardcoded Persian name-matching (`['مرغ','گوشت',…] → likes_high_protein`, `recipe.signal-processor.ts:28-30`) — silently always-false for the NL/EU corpus. Derive nutrition/diet/protein tags from **structured `nutritionPer100g` / `dietFlags` / `allergens`**, never name lists.

**Acceptance test for this pillar:** an integration test that cooks N stews and asserts stew-similar recipes rank measurably higher on the next `GET /recommendations`. *No such test exists today.*

---

## Pillar 2 — The User Taste Model & Taste Embeddings

**Principle.** Every recipe is a **content embedding** built from its ingredients' feature vectors (taste / texture / nutrition / role) plus cuisine / technique / cost / effort. Every user is a **taste vector in the same space**, learned from cook / love / skip. *"You like bright-acidic-herby lamb-forward dishes"* becomes a literal direction in vector space. This is the Porsche core: it works from day one, is far finer than category profiles, and is the moat that lets Garnish learn before it has a billion users.

**Why it is non-negotiable.** Keyword token-matching (the current live approach) is shallow string overlap — it *cannot* learn that a user who cooks Ghormeh Sabzi also likes Fesenjan unless the words overlap. There is no latent taste, no generalization — the opposite of personalization at scale. A shared user↔item embedding space is what makes "items like this" and "users like you" the *same* geometry, and it degrades gracefully: when a user's vector is unreliable, you fall back up the hierarchy to cohort/region/global priors (Pillar 5) without changing architecture.

**The Garnish reality to fix.** "Embeddings" today are deterministic content-token bags (`recipe-embedding.service.ts:5-13`, "NO LLM, NO vector DB"); **there is no user embedding at all.** The genuinely good machinery — `taste-affinity.ts:computeTasteAffinities`, cuisine affinity — exists only in the frozen shadow tree (`productUseEnabled:false`) and is imported by zero live files. The live profile is **hardwired to empty observations** (`profile-read.service.ts:112`: `buildUserFoodIdentityGraph([], { mode:'shadow' })`), so the "0.80 observed weight" in the maturity formula is *unreachable at runtime* — every user is cold-start forever.

**How Garnish implements it concretely.**

1. **Recipe content embedding (ship first — works at zero interactions).** Compose each recipe vector from the ingredient-level feature data already owned: per-ingredient taste/texture/nutrition/role aggregated, plus cuisine, technique, cost, effort, dietFlags. This is the asset no competitor has at this depth. Cheap v0: structured feature vector + cosine. Better v1: sentence-embed the recipe (a small open model — `bge-small`/`e5` — or an LLM embedding endpoint, computed offline and cached) → `pgvector` or brute-force cosine (sub-millisecond over ~1k recipes; *you do not need FAISS at this scale*).

2. **User taste vector (the core unlock).** v0 = the **centroid of engaged-recipe embeddings**, commitment-weighted (cook ≫ save ≫ view) and recency-decayed. This gives a real palate direction from interaction #1. As data accrues, graduate to a learned user representation, then a **two-tower** model (item tower = the recipe embedding you already built; user tower switches on when interaction history is dense enough — until then it *is* content retrieval with extra steps, so don't build it early).

3. **Hydrate the live profile from real observations.** `getLivingUserProfile` must hydrate observed taste/effort/skill from persisted `SignalObservation` *the same way* `getFoodDnaProjection` already does (`profile-read.service.ts:141-147`) — behind a consent + safety gate. **Allergies stay declared-only** (Pillar 10); taste/effort/skill use observed. This single change is what makes warm-up real.

4. **A real cuisine/region affinity signal.** Today no `likes_persian` signal is ever written or matched; the token maps list *international* cuisines while the corpus is Persian (`taste-affinity.builder.ts:20-38` vs `phase-one-recipes.js:49`). Add `cuisine_affinity` (already *designed* in `signal-registry.ts:111`), keyed on `cuisine.primary` / `region`, wired into both the extractor and the ranker. Without this, "Persian stews → more Persian" is unsatisfiable even with the cook loop fixed.

5. **The taste vector is the same object the user sees and tunes** (Pillar 8). The internal model and the user-facing "Taste Portrait" are one thing viewed two ways. Edits are training signal.

**Two clocks.** A *fast clock* for context/session (tap "quick tonight" → feed changes now) and a *slow, decaying clock* for the durable taste vector (moves over weeks). One weird Tuesday must not redefine a user; over-fast adaptation reads as creepy and unstable.

---

## Pillar 3 — Candidate Generation (Retrieval)

**Principle.** A two-stage funnel: **cheap, recall-oriented retrieval** over the whole catalog → **expensive, precision-oriented ranking** on a few hundred → **diversity/integrity re-rank** on the few shown. Apply hard constraints, deflation, and priors *in retrieval*, before the expensive ranker runs.

**Why it is non-negotiable.** This is the shape every "for you" giant shares (YouTube, TikTok, Meta). At 700 dishes the *compute* argument is moot — but you adopt the shape anyway, because it is the right place to hang every mechanism and it is how you scale to ANN/two-tower later **without a rewrite**. You swap the retrieval source and the value model when data justifies it; the skeleton is unchanged.

**The Garnish reality (the shape is right).** An 8-bucket generator already exists (`similar`, `embedding`, `trending`, `health`, `seasonal`, `inventory`, `cold_start`, `collaborative` — `candidate-generator.ts`). This *is* a two-stage funnel in embryo. The gaps: the "collaborative" bucket is a declared-health-goal join (not CF), trending groups by raw `payload` JSON string (fragile), cooks don't seed candidates, and there is no deflation or cohort prior at the retrieval stage.

**How Garnish implements it concretely.**

1. **Formalize and name the three stages** — Retrieval (union the buckets, dedup) → Ranking (the value model) → Re-ranking (exposure penalty + diversity cap + explore-slot injection). This is a refactor, mostly free, and it makes the architecture legible to a solo maintainer.
2. **Seed candidates from the strongest intent.** Include `cook_complete` and `favorite_add` recipeIds in `getSimilarRecipes` / `getEmbeddingSimilarRecipes` seed sets. Today a cooked dish doesn't even pull its neighbors into tomorrow's pool (`candidate-generator.ts:84,116`).
3. **Apply deflation and cohort prior in retrieval** (Pillar 5) so the ~200 always-skipped dishes rarely enter the candidate set, and a fish-region user's pool tilts seafood on day one.
4. **Fix trending** — add a `recipeId` column to `UserEvent` and group on it (not on serialized payload).
5. **Constraint filter is a post-scoring gate, never a soft feature** — the allergy/diet HARD gate runs *after* scoring, *before* display, and the model can never override it (Pillar 10).

---

## Pillar 4 — Ranking (Hybrid + Learning)

**Principle.** Ranking is a **value model** that combines several calibrated engagement predictions — p(cook | shown), p(favorite | shown), p(skip | shown) — into one score, **weighted by commitment** (cook > favorite > view, exactly as Meta weights save > like). Its weights are **learned from logged outcomes**, not hand-typed. A hand-tuned heuristic blend is a legitimate *cold-start fallback* — never the permanent ceiling.

**Why it is non-negotiable.** The founder's directive is explicit: *a self-improving learning engine, not 100 lines of filter code.* A fixed-weight blend caps quality at the authors' intuition and cannot improve from data. Calling it "ML" when the weights were "carved by hand to sum to 1.00" is false.

**The Garnish reality to fix.** The live ranker is exactly that: 10 components summed with constants the comments admit were hand-carved (`ranking.service.ts:96-107`, `:91-95`). There is no learned model, no calibration, no training loop in production. The "proof of learning" (nDCG 0.29→0.73) is **circular synthetic self-evaluation** — the same module writes the behavior, the ground truth, *and* the relevance metric (`recommendation-learning-proof.ts:76-124`), and admits 2 of 4 dimensions contribute ~0.

**How Garnish implements it concretely.**

1. **Keep the 10-component blend as the cold-start fallback only.** It is interpretable and safe when a user/dish is cold. Its `tasteAffinity 0.25 | outcomeFit 0.16 | behaviorFit 0.13 | effortFit 0.11 | recipeUnderstanding 0.10 | novelty 0.08 | skillFit 0.06 | ingredientIntelligence 0.05 | popularity 0.04 | recency 0.02` shape is fine *as a prior.*
2. **Calibrate components into empirical probabilities.** Derive per-recipe p(cook|shown), p(favorite|shown), p(skip|shown) from aggregated counts (Pillar 5's substrate) and feed shrunk versions into `outcomeFit` / `popularity`. This is the move that makes the components behave like real predictions instead of guesses.
3. **Train a real ranker on real logs.** Once impressions→cook labels accrue, fit a **LambdaMART / logistic ranker** on a **temporal split** (train weeks 1–N → predict cooks in N+1). The `featureContributionLog` table (`ranking.service.ts:957`) is the training-data seed. The learned ranker replaces the hand weights; the blend stays as the cold fallback.
4. **Deterministic experiment bucketing.** Replace `Math.random() < 0.5` (`experiment-engine.service.ts:25`) with `hash(userId+expId) % 100`, and make experiments optimize a *real online metric* (cook-rate), not toggle hand-chosen weight vectors.
5. **Split the 1,200-LOC god-service.** `ranking.service.ts` mixes scoring, diversity, exposure, experiment weighting, popularity SQL, and explainability. Split into focused units with tests — this is the one file that *serves users*, so its risk is concentrated.

---

## Pillar 5 — Collective Intelligence (the Network Effect, by Arithmetic)

**Principle.** Three mechanisms, all delivered with statistics rather than deep learning, turn "a population of one" into a system that gets smarter with every user: **(a) popularity deflation**, **(b) hierarchical cohort/region priors**, **(c) item-item co-engagement CF.** This is the single biggest cluster of missing value, and it directly answers all three of the founder's concrete examples.

**Why it is non-negotiable.** Without collective signal there is **no network effect** — adding the millionth user does not improve recommendations for the first. Every user is a population of one, cold forever. The research is unanimous that at 700 dishes the *statistics layer is the product*: shrinkage priors and accept-rate deflation deliver 90% of the "collectively smart" feeling with arithmetic, not GPUs.

**The Garnish reality to fix.** No CF in the live path (the "collaborative" bucket is a health-goal join). Popularity is engagement-*only* with no negative term — `(views + favorites*2)/250` (`ranking.service.ts:509-518`) — so there is *no mechanism* for "200 dishes everyone skips → show less." No cohort/region prior exists. The real co-occurrence model (`collective-signal.ts`) is shadow-only and unreferenced by any live ranker.

**How Garnish implements it concretely.**

**(0) Phase 0 — the substrate (everything depends on it).** Materialize **per-recipe rolling counters** `{impressions, views, quick_exits, cook_complete, favorite, skip, not_interested}` and the **same grouped by cohort**. Every event is already logged; it is simply not aggregated. With this, items below are mostly arithmetic.

**(a) Popularity deflation — the highest-ROI single change, ~one file (founder example #1).**
Replace the engagement-only formula with a **Beta-shrunk, two-sided accept-rate**:
```
positives = {cook_complete, favorite}
negatives = {skip, not_interested, quick_exit}
acceptRate = (positives + α) / (positives + negatives + α + β)   // (α, β) = global mean prior
rank by acceptRate (or its Wilson lower bound)
```
A dish skipped by everyone collapses below the prior → it **deflates out of retrieval automatically. No blocklist.**
*The trap (don't kill minority-loved dishes):* deflation is only a low-weight prior (0.04) dominated by `tasteAffinity` (0.25); compute accept-rate **conditioned on cohort**, so a globally-skipped-but-cohort-loved dish keeps a high cohort accept-rate and surfaces for that cohort; and keep the **explore budget flowing to deflated dishes** so a wrongly-buried dish can recover. Deflation must be *reversible, never a ban* (TikTok's "keep re-testing" discipline).

**(b) Hierarchical cohort/region prior via empirical-Bayes shrinkage (founder example #2).**
Maintain affinity at four levels — **global → region/market → cohort → user** — and estimate any (user, attribute) as a shrinkage blend whose weight on each higher level ∝ 1/(evidence below it):
```
affinity(user, fish) = shrink(user_signal, cohort_avg, region_avg, global_avg)
```
A new user in a fish-leaning region inherits high `region_avg(fish)` → seafood ranks up **on day one**, before they reveal anything. As they cook/skip, `user_signal` accumulates and its weight rises, so the estimate **slides from the regional prior toward revealed taste automatically** — a fish-region user who keeps skipping fish overrides the prior within a handful of signals. At single-EU-market launch the useful levels are **global → cohort → user** (cohorts from onboarding: diet, spice tolerance, skill, quick-vs-elaborate, health goal); the geo level switches on with no architecture change as markets expand. This is also the **cheap stand-in for "users like you"** until user embeddings are viable.

**(c) Item-item co-engagement CF (the strongest CF at our scale).**
Upgrade the dormant `getCollaborativeRecipes` from a health-goal join to **"users who cooked/loved A also cooked B"** — co-occurrence counts blended with content cosine. *One* cook lights up a whole neighborhood; no critical mass needed. This is the recipe analog of Meta's account-nearest-neighbors. Defer *user* embeddings / full two-tower (they starve without dense user history); the cohort prior (b) covers "users like you" until then.

---

## Pillar 6 — Exploration (Bandits) — the Flywheel

**Principle.** Reserve ~10–20% of feed positions for **higher-uncertainty dishes** (few impressions, or score near the cutoff), chosen by **Thompson sampling**: each dish has a `Beta(α + positives, β + negatives)` posterior; to fill an explore slot, *sample* an accept-rate from each candidate's posterior and show the max. New dishes (wide posterior) sometimes win the sample and get shown — controlled exploration that **self-anneals** as evidence accumulates.

**Why it is non-negotiable.** One mechanism, three payoffs: it **solves new-dish cold-start** (staged audience expansion, TikTok-style), **breaks filter bubbles** (serendipity inside the comfort zone), and — critically — **generates the engagement data that makes Pillars 4–5 sharper over time.** A pure-exploit feed (top-scored every time) feels static, starves new/niche dishes of the data they need to ever rank, and the flywheel never spins. The research ranks a Thompson explore slot as a **top-3 ROI move, ~1 day of work.**

**The Garnish reality to fix.** No exploration policy anywhere. Diversity is a tiny post-hoc penalty (`ranking.service.ts:1150-1178`); novelty fires only for self-declared `food_explorer` (`:484-507`). New and long-tail recipes are systematically under-shown and never earn the engagement to rank.

**How Garnish implements it concretely.**
1. **Thompson explore slot** over the Beta posteriors from Pillar 5's counters — the clean, self-annealing implementation. Epsilon-greedy is the cruder fallback.
2. **Higher explore fraction for new users' first ~N sessions, annealed down.** Extend `coldStartWeightBlend()` to *also* raise the explore budget early.
3. **Two surfaces, two explore settings (Spotify's Discover Weekly vs Daily Mix):** *"For You today"* = exploit (safe, high-affinity, weeknight-appropriate); a weekly *"Try something new"* rail = explore (cuisines/techniques adjacent to taste but unfamiliar), refreshed weekly. Same engine, second query.
4. **Surface an "adventurous ↔ comfort" dial** (Pillar 8) so the user *chooses* the explore setting — this simultaneously fixes filter-bubble worry and over-personalization, and is a delightful "it gets me" acknowledgment that mood varies.
5. **The explore budget keeps flowing to deflated dishes** (Pillar 5a) so deflation stays reversible.

---

## Pillar 7 — The Context Engine ("every second")

**Principle.** A **context vector** — time-of-day, day-of-week, season, weather, holiday/occasion (Yalda / Nowruz / Ramadan), last-week's meals, pantry, household — re-scores recommendations in real time. The same dish ranks differently at 8am vs 7pm, summer vs winter, full pantry vs empty. Context is the **cheapest path to "it reads my mind"** because it requires almost no model: a correct context cue ("rainy Tuesday → 20-minute soup") reads as mind-reading even with a dumb recommender underneath.

**Why it is non-negotiable.** A context-blind list cannot read the mind of a user whose needs change by hour, day, and season. Much of the felt magic is **framing, not filtering** — you don't need a different recipe set for rain, you need a different *headline*. That is a copy task, the highest ROI work a solo founder can do.

**The Garnish reality to fix.** The live path takes only `userId` + `limit` (`recommendation.controller.ts:36-39`); recs are byte-identical at 8am and 11pm. The only contextual signal in production is one `isIranWeekday()` boolean nudging one of ten components. Every context surface the user *sees* is theater: the Home "pantry rail" is `recList.slice(3,11)` (`useHomeData.js:95-101`), the "AI Whisper" is `recList[0]` wrapped in a hardcoded "برای امشب / for tonight" — even for a cold-start user with no recent choices. The genuinely time-aware **Daily Briefing** (`mealContextFor(now)`, `briefing.controller.ts`) is built but **no web screen calls it.** There is no persistent pantry model in the schema at all.

**How Garnish implements it concretely.**

1. **Plumb a `RecommendationContext` into the live ranker** — `{ now, mealSlot, recentCooks, pantry, season, occasion, household }` — threaded from the request, used as ranker features and candidate filters. **Start with time-of-day → mealType candidate gating** (breakfast in the morning) — the smallest change that converts a static list into a contextual assistant, and it unlocks every later context signal.
2. **The contextual home headline** — one dynamic strip composing `[time] + [day] + [season] + [recent cooks]` into a single human sentence with a matching shelf: *"Wednesday, 5:40pm — you've cooked twice this week, both quick. Here are three 25-minute dinners using what's in season."* This one sentence does more for "it gets me" than a re-ranked feed, and it is mostly templating over data already owned.
3. **A persistent pantry** — add a `PantryItem` model (`userId, ingredient, qty, addedAt, staleAt`), default `match_pantry_recipes` to read it (today the user must re-type their pantry every message — `match-pantry-recipes.tool.ts:30`), replace the fake "pantry rail" with real matches, and fire a proactive low-effort nudge ("you have chicken + lemon — cook this tonight"). Pantry awareness is the single most mind-reading-feeling capability in the category and is currently absent end-to-end.
4. **Wire the Daily Briefing to a real Home hero** and source its pick from `candidateGenerator.generate(userId)` + ranker filtered by `mealContext` (not the arbitrary first-12 `findAll(0,12)` it uses today).
5. **"What you cooked this week"** — uses the cook log you already own; prevents the most common dissatisfaction (re-recommending Monday's dinner) and lets you *say* something true ("you've leaned veggie this week — keep going or break it up?").
6. **Persian-calendar occasions** (Yalda / Nowruz / Ramadan) are a unique, underexploited context lever for this market — a differentiator a US-centric app cannot nail.
7. **Mood: ask, never infer.** A user-initiated picker ("Tonight I want: comfort / light / impressive / fast") feels like control; inferring mood from behavior is the creepiness fast-track.

---

## Pillar 8 — Transparency & Control (the Trust Multiplier)

**Principle.** Tell the user *why* ("because you cooked Fesenjan twice / it's a cold autumn night"), and give them a **visible, tunable taste-DNA** they can edit — where **edits are training signal.** Legibility converts accuracy into *felt* understanding and is the antidote to creepiness. One honest reason per rec beats a model dump.

**Why it is non-negotiable.** Accuracy alone backfires: TikTok users report being *startled* by how well the feed captured them with no input — the same accuracy that delights tips into creepiness. Transparency + control is the dial that converts "creepy" into "wow, it gets me." Control reframes the relationship from *being profiled* to *collaborating* — the user co-authors the model, which is a large part of "it became one with me." And the research is blunt: **the whole category fails here** ("recommended for you," or nothing), so clearing this bar is instant differentiation. Spotify found explanations *themselves* lift engagement.

**The Garnish reality to fix.** Transparency is an internal score-breakdown — *"25% matches proven taste signals, 13% fits the user cooking pattern"* (`explainability.service.ts:11-26`) — abstract weight fractions reading like a debug panel, with no recognizable cause. The substrate for real reasons already exists (`assessRecipeFit`, `ContributionCalculatorService`); it is simply not surfaced as human reasons.

**How Garnish implements it concretely.**
1. **"Because you…" on every shelf and card** — one short, true reason generated from concrete history (cooked / saved / disliked a specific recipe / ingredient / cuisine), or from the context rule that fired ("because it's cold and you like soups"). Render these, not score fractions.
2. **A visible, tunable taste panel** — chips/sliders for the dimensions you model (spice, effort, adventurousness, cuisines, diets). Changes apply **live and visibly**; a control with no visible effect teaches the user the UI lies (a top recsys complaint). Every "less of this" tap must immediately, visibly change the feed, with undo.
3. **The "Taste Portrait" / Food DNA screen as the emotional centerpiece.** Garnish already has a `/profile/dna` surface (`getFoodDnaProjection`, `FoodDnaRing`) — make it beautiful, **shareable, and editable.** It makes the model *visible as a portrait of the user* — the literal embodiment of "it became one with me." Edits feed back as training signal.
4. **The "adventurous ↔ comfort" dial** (shared with Pillar 6) — lets the user choose how far to stretch.
5. **Data honesty card (GDPR as a gift):** *"Here's what Garnish knows about your taste"* — viewable, editable, deletable. In the EU this is partly mandatory; presenting it *well* turns a compliance cost into a trust asset and directly defuses creepiness.
6. **Named shelves** — *"Your weeknight rotation," "Saved for someday," "Comfort shelf," "Sunday projects."* Naming a pattern the user lives but never articulated is the purest "it gets me" hit. The *names* do emotional work the algorithm can't.

---

## Pillar 9 — Evaluation (No Self-Proofs, Ever)

**Principle.** Get the *protocol* right before trusting any number. **Temporal (global-timeline) splits always** (train on past, predict future — random splits leak the future and inflate metrics). **Interleaving** for ranker comparisons (10–100× more sensitive than A/B — the single most important eval technique at small traffic). **A/B** for business metrics (retention, cooks/week). And a **hard gate**: allergy/diet-violation rate must be **0**.

**Why it is non-negotiable.** Offline benchmark wins famously don't translate to felt user value. A high metric on a self-authored relevance function proves only that the code can copy a label back. No claim about recommendation quality is defensible without an honest held-out or online eval.

**The Garnish reality to fix.** The "proof of learning" is **circular synthetic self-evaluation** — same module generates behavior, ground truth, and metric (`recommendation-learning-proof.ts:76-124`); the metric is cuisine-dominant by construction; the report admits effort `−0.016` and skill `−0.0002` (2 of 4 dimensions do nothing). A high nDCG here is mechanically guaranteed.

**How Garnish implements it concretely.**
1. **Replace the circular proof with a temporal held-out eval on real logged behavior** — train weeks 1–N, predict cooks in week N+1; report Recall@k / MAP / NDCG@k against *actual future user actions.*
2. **Interleaving for ranker comparison** — merge control & treatment lists for the same user, attribute cooks → which ranker won. This is what lets a launch-scale app detect ranker improvements where A/B is hopelessly underpowered.
3. **Log impression + position + propensity + reward per card** from day one — this is the most valuable thing to build; it unlocks the bandit (Pillar 6), self-normalized IPS (SNIPS) counterfactual offline policy comparison, and the learned ranker (Pillar 4). Without it, every later technique is blind.
4. **Beyond-accuracy metrics** — coverage, diversity, novelty (watch for filter-bubble collapse), and the **allergy/diet-violation rate = 0** as a release-blocking invariant.
5. **Beware leakage and Simpson's paradox** in offline comparisons; a single global cutoff, never per-user random splits.

---

## Pillar 10 — Privacy & Trust (the Inviolable Floor)

**Principle.** The HARD allergy gate is **inviolable** — declared allergens are *never* overwritten by behavior, applied as a gate *after* scoring and *before* display, and the model can never override it. Consent is enforced **at the moment of collection**, not just logged. Retention is *operational*, not declared. The user's data is viewable, editable, and deletable as a *feature.*

**Why it is non-negotiable.** A recommender that surfaces a peanut recipe to a peanut-allergic user is a catastrophic failure no accuracy redeems — constraint correctness beats clever ML that violates it. This is the strongest trust moat in the category and the one place Garnish already leads. For an EU-targeted app, consent-at-ingest is a direct GDPR Art. 6/7 obligation, and "here's what we know about you" is partly mandatory — present it well and compliance becomes a trust asset.

**The Garnish reality (the bright spot, with two leaks).** The three-layer allergy guarantee is real and inviolable (reconciliation `precedence=declared_safety`, the signal-calculator correction guard `signal-calculator.service.ts:181-209`, the AI grounded-reply check). Erasure is transactional with PII-free proof; a per-model retention map exists. **The two leaks:** behavioral ingest has **no consent check** (`analytics.service.ts:57-99` writes after only `eventQuality.assess`; consent is gated only in the *offline* signal layer) — every authenticated user's behavior is recorded regardless of consent. And retention is **dry-run only** (`retention.service.ts:27-37`) — behavioral time-series grows unbounded.

**How Garnish implements it concretely.**
1. **Keep the HARD allergy gate exactly as designed** — three layers, declared-only, inviolable. This is the model.
2. **Enforce consent at ingest** — read `ConsentState` in `trackEvent`; tag/drop events by purpose (`core` always; `analytics`/`personalization` only if granted); stamp `consentPurpose` on every `UserEvent` so the downstream gate is meaningful.
3. **Make retention operational** — implement and schedule the destructive prune behind the existing flag (start with events/observations > 365d), with the audit-long/user-owned exclusions already encoded.
4. **Two taste vectors, one safety rule** — taste/effort/skill hydrate from observed behavior; the allergy set stays declared-only forever.
5. **The data honesty card** (Pillar 8) is the user-facing face of this pillar — viewable, editable, deletable.

---

## Reference Architecture (how the pillars compose)

```
                          ┌─────────────────────────────────────────────┐
   USER ACTION            │  SIGNAL MODEL (Pillar 1)                     │
   cook / save / skip ───▶│  consent gate @ingest ─▶ typed, commitment- │
   view / dismiss         │  weighted ─▶ durable outbox ─▶ persist full │
                          │  observation contract                        │
                          └───────────────┬─────────────────────────────┘
                                          │
                   ┌──────────────────────▼───────────────────────┐
                   │  TASTE MODEL (Pillar 2)                       │
                   │  recipe embeddings (content, ingredient-deep) │
                   │  user taste vector (engaged-recipe centroid)  │
                   │  cuisine/region affinity · two-track (cook/   │
                   │  aspire) · slow decaying clock                │
                   └──────────────────────┬───────────────────────┘
                                          │
   CONTEXT (Pillar 7) ───────────────────┤   COLLECTIVE (Pillar 5)
   now·mealSlot·season·pantry·            │   deflation · cohort/region
   recentCooks·occasion·household         │   shrinkage prior · item-item CF
                                          │   (Phase-0 counters underpin all)
                                          ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │  RETRIEVAL (Pillar 3): union buckets + deflation + cohort prior        │
   │     ↓ ~80–150 candidates                                               │
   │  RANKING (Pillar 4): learned value model (cold-start heuristic         │
   │     fallback) over calibrated p(cook|shown)…                           │
   │     ↓                                                                   │
   │  RE-RANK: exposure penalty · diversity cap · EXPLORE SLOT (Pillar 6)    │
   │     ↓                                                                   │
   │  HARD ALLERGY/DIET GATE (Pillar 10) — post-score, pre-display          │
   └───────────────────────────────┬──────────────────────────────────────┘
                                   │
                ┌──────────────────▼───────────────────┐
                │  WHAT THE USER SEES                   │
                │  "Because you…" reasons (Pillar 8) ·  │
                │  named shelves · contextual headline ·│
                │  tunable Taste Portrait               │
                └──────────────────┬───────────────────┘
                                   │ outcome logged (impression·position·
                                   │ propensity·reward)
                                   ▼
                   EVALUATION (Pillar 9): temporal held-out · interleaving ·
                   allergy-violation-rate = 0  ──▶ retrain ranker + embeddings
                   ──▶ (loop back, self-improving)
```

**Explicitly deferred (do NOT build at launch):** two-tower retrieval, ANN/FAISS, learned user embeddings, multi-task DNN ranker, Monolith-style online embedding tables, session/sequence models (SASRec/GRU4Rec), graph models (LightGCN/PinSage), LLM-as-the-ranker in the hot path. Every one of these starves without dense interaction data or massive scale. The two-stage *shape* above is exactly what you slot them into later — **no rewrite, just swap the retrieval source and the value model when the data justifies it.**

---

## The Data Contracts (what must exist for the Standard to hold)

| Contract | Why | Status |
|----------|-----|--------|
| `UserEvent.recipeId` column | group trending/popularity without fragile payload string-scan | **add** |
| `UserEvent.consentPurpose` stamp | meaningful downstream consent gate | **add** |
| Full `SignalObservation` contract (`confidence, strength, value, privacyClass, consentPurpose`) | observed graph rebuilt from truth, not fabricated means | **add** |
| Per-recipe rolling counters `{impressions, views, quick_exits, cook, favorite, skip, not_interested}` + cohort-grouped | the substrate for deflation, priors, bandit posteriors, calibration | **add (Phase 0)** |
| `PantryItem` model | persistent pantry → real context + proactive nudge | **add** |
| Impression log with `position` + `propensity` + `reward` | bandit, SNIPS offline eval, learned ranker | **add** |
| Recipe content embedding (cached) | taste space, cold-start retrieval | **add** |
| `cuisine_affinity` signal end-to-end | "Persian stews → more Persian" satisfiable | **add (designed, unwired)** |

---

## The Acceptance Tests (the definition of "done")

The Standard is met when all four pass on *real* users (from `FOUNDER_REQUIREMENTS.md`):

1. **Individual loop closes:** cook 10 Persian stews → tomorrow's feed is verifiably more stew-like.
2. **Collective loop closes (with the trap avoided):** a dish skipped by ~everyone drifts down the catalog for everyone — *but a minority-loved dish survives for that minority.*
3. **Regional prior works then decays:** a fish-leaning region's new users see more seafood by default, then personalize away from it as they reveal taste.
4. **Legible and tunable:** the user can SEE why ("because you cooked X / you're in region Y / it's a cold autumn night") and tune it, with the tune visibly taking effect.

---

## What This Standard Refuses to Build (anti-cargo-cult)

- **A "Food Genome" as a marketing artifact.** Yummly and Whisk both branded one; Yummly *still* ended at "no personalization beyond filters." Garnish already has the equivalent (GRIS + ingredient vectors) — build the *learning loop and legibility* around it, not a brag.
- **A 160k-recipe corpus.** Catalog size *dilutes* a focused market. ~700–1008 *deep* Persian-first dishes is an advantage.
- **LLM recipe *generation* as the core.** Hallucinated quantities, unverified nutrition, weak allergy safety. Use the LLM as an *enhancer* (taste-vector from onboarding text, query understanding, grounded explanation) — never as the ranker or the recipe author.
- **Per-user artwork A/B (Netflix-style) and real-time per-tap re-ranking (TikTok-style).** No statistical power at solo-founder traffic; wrong domain rhythm (cooking is deliberate and ~daily, not infinite-scroll); high creepiness risk.
- **Inferred mood, high-frequency push, elaborate multi-screen questionnaires.** Creepy, trust-burning, and drop-off-inducing respectively.
- **A 13k-LOC shadow tree whose activation verdict is hardcoded to "no."** Sophistication must be *earned on the live path*, not staged forever in a lane no user reaches.

---

**The creed.** Garnish should feel like a friend who cooks with you — one who remembers what you made this week, knows it's a cold Wednesday and you're tired, names your patterns back to you, always tells you *why*, lets you nudge it in one tap and watch it listen, asks rather than assumes your mood, stretches you just enough, and never makes you feel watched. At our scale, the "it reads my mind" feeling is built not from a bigger model but from **truthful reflection, right-moment timing, honest reasons, real control, and restraint** — mostly statistics, copy, and timing over data we already own and content no competitor has. That is exactly why a solo founder can build the best food-personalization system in the world here.

**FILE:** `C:\dev\garnish-app\docs\audit\PERSONALIZATION_STANDARD.md`
