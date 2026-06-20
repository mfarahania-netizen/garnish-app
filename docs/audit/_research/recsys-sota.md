# Recommender Systems — State of the Art, Ranked by ROI for a Solo-Founder EU-Launch Recipe App

**Audience:** the Garnish founder. **Frame:** sparse per-user data, severe cold-start (new users AND a launch with near-zero interaction logs), single-market launch (EU), one engineer.
**Date:** 2026-06-20. **Bias of this doc:** brutally honest about what does *not* help at small scale. The fanciest technique in a paper is usually the wrong first move when you have 0–10k users and a few thousand recipes.

---

## TL;DR — the only ranking that matters

At launch you do **not** have the data that makes 90% of "SOTA recsys" work. Collaborative signal (the thing two-tower / GNN / SASRec all feed on) is the one asset you lack. So the ROI ranking inverts the academic prestige ranking:

| Rank | Technique | Helps at launch? | Why |
|---|---|---|---|
| **1** | **Content-based retrieval** (recipe metadata + text/ingredient embeddings, ANN) | **Yes — build first** | Works with **zero interactions**. You already have rich recipe content (USDA-locked nutrition, ingredients, substitutions, steps, tags). This is your moat at cold-start. |
| **2** | **Rules + constraint filters** (allergy HARD gate, diet, time, pantry) — *you already have this* | **Yes — keep/extend** | Highest precision signal you'll ever have. Already live (`assessRecipeFit`, allergy gate). Personalization that respects hard constraints beats clever ML that violates them. |
| **3** | **Contextual bandits (Thompson sampling)** for ranking/exploration | **Yes, lightweight** | Purpose-built for cold-start + learning online from clicks/cooks. Small action space (re-ranking a shortlist), cheap, no offline training pipeline. Your "learn from few signals" answer. |
| **4** | **LLM as feature/embedding generator** (taste profile, recipe summaries, query understanding) — *partly live* | **Yes, selectively** | Turns sparse onboarding answers into a usable preference vector with no training data. You already call an LLM. Use it as an *enhancer*, not the ranker. |
| **5** | **Hybrid (content + light CF) via blending** | **Later (3–6 mo)** | The right end-state, but only once you have CF signal to blend in. Architect for it now; don't build the CF half yet. |
| **6** | **Two-tower embedding retrieval** | **Later** | Production-grade retrieval, but the user tower starves without interaction data. The *item* tower (content) is just technique #1 in disguise. |
| **7** | **Session/sequence models (SASRec, GRU4Rec)** | **Not yet** | Need many multi-item sessions per user. Recipe usage is low-frequency (people cook, then leave). Data-starved at launch. |
| **8** | **Graph models (LightGCN, PinSage)** | **No, not at launch** | Pure-CF GNNs need a dense interaction graph. LightGCN with no edges = nothing. Revisit at 6-figure interaction counts. |
| **9** | **LLM-as-the-ranker (generative recommender)** | **No** | Latency, cost, hallucination, popularity bias, hard to evaluate. Great demo, bad production ranker at launch. |

**Do first:** content embeddings + ANN retrieval → constraint filters → Thompson-sampling re-rank → LLM for taste vector & query understanding. Everything else is a milestone gated on *having interaction data you don't have yet*.

---

## 0. The thing nobody tells solo founders: your real constraint

Almost every "SOTA" recsys paper assumes **abundant implicit feedback** (clicks, watches, plays). That is the asset you are shortest on:

- **User cold-start:** every new signup has ~0 history.
- **System cold-start (the brutal one):** at launch *the whole app* has ~0 logs. There is no warm population to borrow from. This kills collaborative filtering, two-tower user towers, sequence models, and GNNs simultaneously — they all need a pre-existing interaction matrix to learn from.
- **Low interaction frequency:** recipe apps are not TikTok. A user might cook 2–4 times/week and rate far less. Sessions are short and sparse. Sequence models that shine on dense e-commerce/streaming logs (Diginetica, RetailRocket have thousands of sessions × tens of thousands of items) have nothing to chew on.
- **Item side is rich, though.** This is your edge: USDA-locked nutrition, curated substitutions, ingredients, steps, dietary labels, dish type. Content-based methods convert that richness directly into recommendations with **no interaction data required**. Lean into the asset you have.

Strategic consequence: **win cold-start with content + constraints + cheap online learning. Defer everything that needs a warm interaction matrix until you actually have one.** Build the data-collection plumbing (log impressions, clicks, cook-completes, saves, with propensities) from day one so the deferred techniques become possible later.

---

## 1. Content-based filtering — **ROI #1, build first**

**What:** Recommend recipes similar to what a user (or their onboarding answers / current recipe) implies, using *item content* — ingredients, nutrition, tags, dish type, free text (title + steps). Represent each recipe as a vector; rank by similarity to a user-preference vector.

**Why it's #1 here:** It is the *only* family that needs **zero interaction history**. It directly monetizes the content richness you've already invested in (USDA source-lock, curated substitutions, structured chefTips/swaps). Transparent ("because it's high-protein, low-effort, no dairy") which builds trust and is GDPR-friendly (explainable, less behavioral profiling).

**Concrete build:**
- **Cheap v0:** TF-IDF / BM25 over ingredients+tags+title, plus structured filters (nutrition ranges, dish type). Ship in days. This alone is a credible launch recommender.
- **Better v1:** Sentence-embedding the recipe (a small open model, e.g. `sentence-transformers` / `bge-small`/`e5`, or an LLM embedding endpoint) → one dense vector per recipe → ANN index (FAISS / hnswlib / pgvector). User vector = aggregate of embeddings of recipes they liked/answered positively, or an LLM-built taste vector (see §4). Cosine top-K, then apply constraint filters.
- Recent food-specific work confirms the pattern: distilling recipe content (ingredients, steps, dietary labels) into LLM-generated summaries, then embedding them, is a strong cold-start recipe recommender (Cold-start recipe recommendation via template-based language inference, *Expert Systems with Applications* 2026; "Language-Model Prior Overcomes Cold-Start Items," arXiv:2411.09065).

**Data needed:** recipe content only (have it). **Cost:** low. One embedding pass over ~few-thousand recipes is minutes and cents; ANN over thousands of items is trivial (you don't even need FAISS — brute-force cosine over a few thousand vectors is sub-millisecond; `pgvector` is plenty).
**Honest limits:** can't capture *implicit* taste it wasn't told about; tends to over-recommend similar items (low serendipity) — fix with the bandit's exploration (§3). This is a feature at launch (predictable, safe) not a bug.

---

## 2. Constraint filtering & rules — **ROI #2, you already have it, extend it**

**What:** Hard/soft business rules layered on retrieval: allergy HARD gate, diet (vegan/halal/keto), max cook time, pantry/ingredient availability, calorie/macro targets.

**Why high ROI:** These encode the **highest-precision signal you will ever have** — explicit, stated, safety-critical. A recommender that surfaces a peanut recipe to a peanut-allergic user is a catastrophic failure no amount of CF accuracy redeems. You already run this (`assessRecipeFit`, `analyzeRecipeIntegrity`, the allergy gate behind chat) — keep it as a **non-negotiable filter applied AFTER scoring, before display**, never as a soft feature the model can override.

**Data needed:** user-stated constraints (onboarding) + structured recipe labels (have both). **Cost:** ~zero.
**Honest note:** rules aren't "personalization SOTA," but at small scale a tight constraint layer + decent content ranking *outperforms* a fancy model that ignores constraints. This is the unglamorous backbone. Treat allergy/diet as gates, treat time/pantry/macros as soft re-rank features.

---

## 3. Contextual bandits & exploration (Thompson sampling, LinUCB) — **ROI #3, your "learn online from few signals" engine**

**What:** Frame ranking as: given context (user features + recipe features), pick which items to show; observe reward (click / save / cook-complete); update. Bandits explicitly balance **exploration** (learn about uncertain items/users) vs **exploitation** (show the best-known) — exactly the cold-start trade-off.

**Why it fits a launch app:**
- **Designed for cold-start.** Contextual bandits are a canonical cold-start remedy (Li et al., "A Contextual-Bandit Approach to Personalized News Article Recommendation," WWW 2010 — the LinUCB paper, deployed on Yahoo! Front Page).
- **Learns from tiny data, online, no batch training pipeline.** No nightly retrain, no offline dataset needed to start. It bootstraps from your content features and improves with every cook.
- **Cheap variant exists.** **Thompson sampling** over a small action space (re-ranking a content-retrieved shortlist of ~20–50) is simple, robust, and a known production default for small action spaces. LinUCB is a strong low-dimensional baseline but needs a per-step matrix inverse — heavier than you need.

**Concrete build:** content retrieval (§1) returns a shortlist; a contextual Thompson-sampling layer re-orders it using a linear/logistic reward model over `[user features ⊕ recipe features]`, with posterior sampling driving exploration. Log impression + propensity + reward for every card (this also unlocks offline eval, §10, and future CF).

**Data needed:** features (have) + a live reward stream (clicks/saves/cooks — instrument at launch). **Cost:** low-moderate (eng to wire logging + update loop; the math is light).
**Honest limits:** bandits typically treat each recommendation independently (no deep sequence modeling) and need a *reward signal* — so your #1 launch job is to instrument clean reward logging. Without reward logs, the bandit degenerates to §1. (See also Deep Bayesian Bandits, arXiv:2008.00727; "Long-Term Value of Exploration," arXiv:2305.07764 — exploration has measurable long-term payoff.)

---

## 4. LLM as feature/embedding generator (taste profiles, query understanding, recipe summaries) — **ROI #4, partly live, use as enhancer**

**What (the useful 2024–2026 modes):**
1. **LLM taste embeddings / profile construction:** turn sparse natural-language onboarding ("I like spicy Mediterranean, hate cilantro, cooking for two, 30 min max") into a structured preference vector or a text profile you embed. Bridges the cold-start gap with **no training data**. (Survey: "LLM-Enhanced Recommender Systems: A Survey," arXiv:2412.13432 — the "LLM Embedding for RS" and "LLM as enhancer" categories.)
2. **Recipe content summarization → embedding:** LLM-written concise recipe summaries embed better than raw text for retrieval (food-specific result, *Expert Systems with Applications* 2026).
3. **Query / intent understanding:** parse "something light after the gym, I have chicken and spinach" into filters + a retrieval query. (cf. ChefMind chain-of-exploration for ambiguous recipe intent, arXiv:2509.18226.)

**Why it fits:** you *already call an LLM* (grounded assistant, substitutions). Reusing it to produce a taste vector and to parse queries is high leverage with near-zero new infra. It's the best cold-start "preference elicitation" tool that exists right now.

**Data needed:** onboarding answers + recipe content (have). **Cost:** moderate per-call; **do it offline/at-onboarding, cached** — never per-impression in the ranking hot path.
**Honest warnings (well-documented):**
- **Bias:** LLM-generated taste profiles carry popularity/cultural bias and can homogenize toward Western/well-known items ("Biases in LLM-Generated Musical Taste Profiles," RecSys '25, arXiv:2507.16708). For an EU single-market launch with regional cuisines, audit that the LLM isn't flattening local taste.
- **Feedback loops:** LLM-in-the-loop recommenders can amplify their own outputs ("Echoes in the Loop," arXiv:2602.07442). Keep the LLM as an *enhancer feeding features into §1/§3*, not the closed-loop ranker.

---

## 5. Hybrid (content + collaborative) — **the correct end-state, ROI later**

**What:** Blend content-based scores with collaborative signal (e.g., weighted sum, or feature-level fusion à la LightFM / factorization machines). The textbook answer to cold-start: content carries new users/items, CF refines once warm.

**Why not now:** the CF half **requires an interaction matrix you don't have at launch.** Building the CF tower against ~0 logs yields noise. **Architect for hybrid (keep scores modular and blendable), but ship content-only and add the CF channel at the first data milestone** (rule of thumb: order of magnitude ~10k+ users with repeat interactions, or ~100k+ logged events). LightFM is the pragmatic solo-founder hybrid library when that day comes — it accepts content features *and* interactions, degrading gracefully to content-only at cold-start.

**Data needed:** content (have) + interactions (accumulate). **Cost:** moderate.
**Honest note:** this is where you *want* to be by ~6 months post-launch. The work now is **logging discipline**, not modeling.

---

## 6. Two-tower / embedding retrieval — **ROI later, item tower ≈ §1 today**

**What:** Two encoders — a **user tower** (user/context features → vector) and an **item tower** (recipe features → vector) — trained so dot-product ≈ relevance; serve via ANN. The standard industrial *retrieval* stage (YouTube, Google; see Google Cloud "Implement two-tower retrieval"; Yi et al., "Sampling-Bias-Corrected Neural Modeling for Large Corpus Item Recommendations," RecSys 2019).

**Cold-start angle:** the **item tower handles item cold-start well** — feed a new recipe's content features, get an embedding without any interactions. That's genuinely useful... but it's exactly technique **#1** (content → vector → ANN). The part you *can't* power at launch is the **user tower**, which is trained on user interaction history.

**Verdict:** don't build a trained two-tower at launch — there's no interaction data to train the user tower, so it collapses to content retrieval you can do more simply with §1. Adopt the *architecture* later when warm, reusing the content item-tower you already built. (A "two-tower for item cold-start" is content-based retrieval with extra steps until you have user interactions.)

**Data needed:** large interaction set to train the user tower. **Cost:** moderate-high (training infra, negative sampling, ANN ops) — overkill at thousands of items where brute-force cosine suffices.

---

## 7. Session / sequence models — SASRec, GRU4Rec, BERT4Rec — **ROI not-yet**

**What:** Model a user's *ordered* interaction sequence to predict the next item. **GRU4Rec** (Hidasi et al., 2016) — RNN over session events. **SASRec** (Kang & McAuley, ICDM 2018) — self-attention, the strong/fast default; outperforms GRU4Rec/Caser and is markedly faster. **BERT4Rec** — bidirectional masked variant.

**Why not at launch:**
- They need **many multi-event sessions per user**. Recipe usage is **low-frequency and short-session** — people cook then leave; you won't have the dense behavioral sequences these models were built for (their benchmarks are dense e-commerce/streaming logs).
- With sparse sequences they overfit and underperform content+bandit baselines.
- Popularity bias in session models is real ("Exploring Popularity Bias in Session-based Recommendation," arXiv:2312.07855) — risky when your catalog tail is your differentiation.

**Revisit when:** you have users with consistent multi-recipe sessions/streaks (e.g., weekly meal-planning sequences) — SASRec is then the first one to try (cheap, strong). **Data needed:** per-user ordered sequences of meaningful length. **Cost:** moderate (training + serving sequence state).

---

## 8. Graph models — LightGCN, PinSage, NGCF — **ROI no, not at launch**

**What:** Treat user–item interactions as a bipartite graph; propagate embeddings over edges. **LightGCN** (He et al., SIGIR 2020) — strips MLPs/non-linearities from NGCF, the efficient CF-GNN baseline. **PinSage** (Ying et al., KDD 2018) — Pinterest's GraphSAGE-based system on a huge content+interaction graph.

**Why not at launch:**
- **LightGCN is pure collaborative filtering** — its entire signal is the interaction graph's *edges*. With ~0 interactions there are no edges, so there's nothing to propagate. It is the *most* data-hungry family relative to content here.
- PinSage's strength is *content+graph at massive scale* (billions of edges) — wrong order of magnitude for a launch.
- GNNs only beat simple baselines when there's a "complex user–item interaction pattern" to exploit; at sparse scale they add complexity, training/serving cost, and ops burden for no gain. (LightGCN paper; LightGNN, arXiv:2501.03228, even argues for *simpler* GNNs.)

**Revisit when:** dense interaction graph exists (six-figure+ interactions) and content+CF hybrid has plateaued. **Data needed:** dense interaction graph. **Cost:** high (graph infra, training, serving). For a solo founder this is a "year 2, maybe" item.

---

## 9. LLM-as-the-recommender (generative ranker) — **ROI no at launch**

**What:** Prompt an LLM to directly produce the ranked recommendation list ("LLM as RS" category of the surveys).
**Why not as the production ranker:** per-impression latency and cost, hallucination of non-existent recipes, strong popularity/position bias, hard to evaluate offline, feedback-loop amplification ("Echoes in the Loop," arXiv:2602.07442). Excellent for *demos, conversational/explanation surfaces, and intent parsing* (§4) — **not** for serving the main ranked feed at scale. Use the LLM as an enhancer (§4), not the ranker.

---

## 10. Offline evaluation done right — non-negotiable, cheap, do from day one

You'll be tempted to skip eval at launch scale. Don't — get the *protocol* right early or you'll ship leakage-driven illusions.

- **Temporal (global-timeline) splits, always.** Train on past, test on future, respecting a single global cutoff. Random splits leak the future and inflate metrics. ("A Critical Study on Data Leakage in Recommender System Offline Evaluation," arXiv:2010.11060 — leakage is rampant and inflates results.)
- **Beware Simpson's paradox / aggregation bias** in offline comparisons ("The Simpson's Paradox in the Offline Evaluation of Recommendation Systems," arXiv:2104.08912).
- **Counterfactual / IPS estimation** once you log a stochastic policy: weight logged rewards by inverse propensity to get an unbiased estimate of a new policy *without shipping it*. Use **self-normalized IPS (SNIPS)** to tame variance; raw IPS is high-variance/unstable. (Yang et al., "Unbiased Offline Recommender Evaluation for Missing-Not-At-Random Implicit Feedback," RecSys 2018; counterfactual/IPS survey work, arXiv:2509.00333.) **This is exactly why §3's bandit must log propensities** — it's what makes cheap, safe offline policy comparison possible later.
- **Metrics:** ranking metrics (Recall@K, NDCG@K, MAP) + **beyond-accuracy** (coverage, diversity, novelty) — content+bandit systems should be watched for filter-bubble collapse. Track an explicit allergy/diet-violation rate = must be 0.
- **Cost:** ~zero beyond discipline. The single highest-leverage "model" decision is **instrumenting clean, propensity-logged impression/reward data from launch.**

---

## 11. Online evaluation — interleaving, then A/B

- **Interleaving for ranker comparisons.** Merge control & treatment lists into one shown to the same user; attribute clicks → which ranker won. **10–100× more sensitive than A/B**, needing **>100× fewer users** for 95% power (Netflix, "Interleaving in Online Experiments"; Airbnb, KDD 2025 / arXiv:2508.00751). **This is the single most important eval technique for a small-traffic app** — it lets you actually detect ranker improvements with launch-scale user counts where A/B would be hopelessly underpowered.
- **A/B for end-to-end/business metrics** (retention, cooks/week, subscription) — interleaving compares *rankers*, not whole-product changes, and can't directly order 3+ systems. Use A/B for the things that move the business; accept it's slow at low traffic.
- **Long-term exploration value:** measure it; exploration (§3) pays back over time ("Long-Term Value of Exploration," arXiv:2305.07764).
- **Cost:** interleaving is moderate eng (serve merged lists, attribute credit) but the **sensitivity payoff at low traffic is enormous** — prioritize it over A/B infra.

---

## The 90-day build order (concrete)

1. **Week 0–2:** Instrument logging — impressions, position, propensity, click, save, cook-complete, per card. *This is the most valuable thing you'll do.* Without it, every later technique is blind.
2. **Week 1–4:** Content retrieval (§1): recipe embeddings (sentence-transformer or LLM embeddings) → `pgvector`/brute-force cosine → top-K. Keep TF-IDF/BM25 as a transparent fallback.
3. **Week 2–4:** Constraint layer (§2): reuse `assessRecipeFit` + allergy HARD gate as a post-scoring filter. Allergy/diet violation rate metric = 0.
4. **Week 3–6:** LLM taste vector + query understanding (§4), computed at onboarding/offline and cached. Audit for regional-cuisine bias (EU market).
5. **Week 5–10:** Thompson-sampling contextual re-rank (§3) over the content shortlist, with propensity logging. Now you're learning online from cooks.
6. **From day 1, in parallel:** temporal-split offline eval harness (§10) + interleaving for ranker comparisons (§11).
7. **Milestone-gated (≈3–6 mo, on data):** add CF channel → hybrid (§5, LightFM). **Later (warm):** two-tower (§6), then SASRec (§7) if sessions densify. **Year 2 / maybe:** GNNs (§8).

**What explicitly does NOT help you at launch:** LightGCN/PinSage (no graph), SASRec/GRU4Rec (no dense sequences), trained two-tower user tower (no interaction history), LLM-as-ranker in the hot path (cost/latency/bias). Build the data first; these become *possible* later — none are first moves.

---

## Key sources

- Li et al., **LinUCB / contextual-bandit news rec**, WWW 2010.
- Hidasi et al., **GRU4Rec**, ICLR 2016 workshop / "Session-based Recommendations with RNNs."
- Kang & McAuley, **SASRec**, ICDM 2018.
- He et al., **LightGCN**, SIGIR 2020 (arXiv:2002.02126); **LightGNN** arXiv:2501.03228.
- Ying et al., **PinSage**, KDD 2018.
- Yi et al., **Sampling-Bias-Corrected two-tower**, RecSys 2019; Google Cloud "Implement two-tower retrieval."
- Yang et al., **Unbiased offline eval (IPS/SNIPS)**, RecSys 2018; counterfactual/IPS arXiv:2509.00333.
- **Data leakage in offline eval** arXiv:2010.11060; **Simpson's paradox** arXiv:2104.08912.
- Netflix **Interleaving**; Airbnb **Interleaving + counterfactual** KDD 2025 (arXiv:2508.00751).
- **LLM-Enhanced RecSys survey** arXiv:2412.13432; **LLM4RS challenges review** arXiv:2507.21117.
- **LLM taste-profile bias** RecSys '25 (arXiv:2507.16708); **Echoes in the Loop** arXiv:2602.07442.
- Food-specific: **Cold-start recipe rec via LLM summaries**, *Expert Systems with Applications* 2026; **Language-Model Prior for cold-start items** arXiv:2411.09065; **ChefMind** arXiv:2509.18226.
- Deep Bayesian Bandits arXiv:2008.00727; **Long-Term Value of Exploration** arXiv:2305.07764.
