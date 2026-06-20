# Retention, Churn & the Never-Abandon-the-User System — The Garnish Reference

**Audience:** Garnish founder. **Date:** 2026-06-20. **Status:** the authoritative retention/lifecycle reference; companion to `platform-foryou.md`, `cooking-apps.md`, `recsys-sota.md`, `mind-reading-ux.md`, and the `PERSONALIZATION_*` audit trilogy.

**The founder's mandate (verbatim intent, from `FOUNDER_REQUIREMENTS.md` §"PILLAR: Lifecycle & Retention Intelligence"):** the user must feel — *every moment, including year 2 and year 3* — "what a great feeling that I bought this subscription." Detect and pre-empt EVERY cause of churn, resentment, or quiet departure. Infer the **WHY** behind behavior and respond with a *different* intervention per cause. Never abandon the user in any section. And the guardrail the founder insists on above all: the user must feel **CARED FOR, never nagged** — no dark patterns, no notification fatigue, interventions earn their place by being genuinely useful, frequency-capped, and killable.

**How to read this.** Six parts, mirroring the brief. Each part gives **(a) the principle/evidence** (cited), **(b) the concrete Garnish translation** (our reality: ~700 dishes growing, cook/favorite/plan/skip signals, the L0 signal foundation we are about to build, GRIS recipes, the taste model), **(c) honest feasibility at launch vs scale**, and **(d) the data/signals it needs from L0**. It closes with a **ROI-ranked build list** and the **Minimum Lovable Retention System**, then a 7-line summary.

**The one-paragraph thesis.** Retention, not acquisition, decides whether Garnish is a business — and the dominant lever is *not* a churn-prediction model, it is **making the subscription compound in felt value faster than the user masters any one recipe.** The recipe-app utility paradox ("teach it well → they leave") is escaped only by **value evolution**: the app's job must migrate from *teach you this dish* → *your evolving culinary companion that knows you better every year*. Garnish's structural advantage is that its **ingredient-level content data + accumulating personal taste model** is the rare asset that makes year-2 genuinely better than year-1 — and the moat is the personal state the user *built themselves*, which no competitor and no foundation model starts with. Everything below serves that thesis.

---

## PART 1 — Subscription Retention Science (the foundation)

### 1.1 Retention & cohort curves — the flattening / smile goal

**Principle.** Every retention curve decays first; the *tail* decides the company's fate. Three fates (Sequoia, "Retention"): the curve "drops to zero" (product dies), "flatten[s] out at a number greater than zero" (sustainable), or forms a **"smile graph"** that bends back *up* as resurrection exceeds churn (exceptional — "Facebook had a smile. WhatsApp had a smile. Instagram had a smile," a16z). A **flattening to a non-zero asymptote is the data signature of product–market fit** (Casey Winters/Reforge: PMF = "consistent flattening of a month's retention curve over time plus growth in new users every month"). A curve that decays gently *to zero* is still a **leaky bucket** — growth bought entirely with acquisition.
- Sequoia: https://articles.sequoiacap.com/retention · a16z: https://future.com/podcasts/growth-engagement-retention/ · Winters: https://www.caseyaccidental.com/p/caseys-guide-to-finding-product-market-fit · Balfour: https://brianbalfour.com/essays/product-market-fit
- Reading cohorts (read *down* a column = one cohort's curve; *across* a row = later cohorts beating earlier ones): https://www.lennysnewsletter.com/p/measuring-cohort-retention · Growth Accounting + Quick Ratio (>1 = growing): https://articles.sequoiacap.com/measuring-product-health
- **Benchmark** (Lenny Rachitsky × Casey Winters): month-6 *Consumer Subscription* retention ≈ **40% good / 70% great**; the plateau height needed depends on acquisition-loop strength (some scale at 10%, some need 40%). https://www.lennysnewsletter.com/p/what-is-good-retention-issue-29
- **Definition caveat:** N-day retention (strict, for daily-habit products) vs unbounded/rolling retention (= 1 − churn) can differ ~2× on the same data (Amplitude: 21% vs 50% Day-1). Pick the one that matches the product's natural cadence. https://medium.com/@amplitudeHQ/3-ways-to-measure-user-retention-2af5e4e82a45

**(b) Garnish translation.** Garnish is **not** a daily-habit product like Duolingo — it is a **weekly-rhythm cooking product** (people cook a handful of times per week, plan weekly). So: (1) the active-user metric must be **weekly**, anchored to a *value* action (a completed cook), not "app open" (a vanity event). (2) The target is a **flattening weekly-cook-cohort curve** — cook 10 stews in week 1, and the question is whether that cohort is still cooking in month 3. (3) A **smile** is achievable here because the personal taste model + seasonal novelty (Yalda/Nowruz) can *resurrect* lapsed users — the data moat literally manufactures resurrection.

**(c) Feasibility.** Plotting weekly cohort retention is a spreadsheet, feasible **at launch** the moment `cook_complete` is logged with a user id and date (roadmap **N0/N1**). Reading the curve's *shape* (where it drops) is the single most valuable analysis at small scale (Part 4.5).

**(d) L0 data needed.** `cook_complete` with `{userId, recipeId, timestamp}` (roadmap N0 adds `UserEvent.recipeId`; N1 closes the cook loop). That is it — the entire cohort apparatus rides on one well-logged value event.

### 1.2 Activation — the "aha moment" and time-to-value

**Principle.** Activation = the earliest action that *causally* predicts long-term retention; you should reach not just the *setup* moment but the *habit* moment (the aha repeated at the product's natural frequency — Reforge). Canonical magic numbers: Facebook **"7 friends in 10 days,"** Slack **"2,000 messages"** (team-level), Twitter **"~30 follows,"** Netflix **"≥3 titles added to the queue in the first session"** (Gibson Biddle drove this 70%→90%, lifting month-1 retention 88%→90%). The numbers are semi-arbitrary "useful illusions" (Mixpanel) — **derive your own** and validate causally (Lenny's "2× rule": activated users should retain ≥2× non-activated). Amplitude found ~69% correlation between strong 7-day activation and strong 3-month retention.
- Reforge aha: https://www.reforge.com/guides/define-your-aha-moment · FB: https://mode.com/blog/facebook-aha-moment-simpler-than-you-think/ · Slack: https://review.firstround.com/from-0-to-1b-slacks-founder-shares-their-epic-launch-strategy/ · Biddle/Netflix: https://gibsonbiddle.medium.com/4-proxy-metrics-a82dd30ca810 · 2× rule: https://www.lennysnewsletter.com/p/how-to-determine-your-activation · TTV: https://amplitude.com/blog/time-to-value-drives-user-retention · "illusion": https://mixpanel.com/blog/magic-numbers-are-an-illusion/

**(b) Garnish translation.** The Garnish aha is **the first successful cook** — the moment the user makes something from a Garnish recipe and it *works*. The candidate activation metric: **"first cook_complete within 7 days of signup"** (hypothesis: these users retain ≥2×). The cold-start onboarding (taste-card stack + allergy gate + household/skill, per `mind-reading-ux.md` §1) exists to compress **time-to-first-successful-cook**: end onboarding on a *populated* "Made for you" screen with one ridiculously-achievable, on-taste, in-budget dish, not a "we'll learn over time" dead-end. The second aha is **the first "it gets me" moment** — the feed visibly leaning toward what they cooked (roadmap N1+N5: "Because you cooked Fesenjan twice").

**(c) Feasibility.** Defining and measuring the activation metric is **launch-feasible** (needs only signup date + first cook). *Validating causation* (the 2× test, nudging more users past it) needs a few hundred users and is a **scale** activity. Compressing TTV via onboarding is launch-feasible and high-ROI.

**(d) L0 data needed.** Signup timestamp; `cook_complete` timestamp; onboarding-completion events (`onboarding_answered`, the `taste_seed`/`effort_seed`/`skill_seed` signals already in the registry). The first-cook funnel = signup → recipe_view → plan/save → cook_complete.

### 1.3 Habit formation — the Hook model and B=MAP, applied ethically

**Principle.** Two engines. **Nir Eyal's Hook Model:** Trigger → Action → **Variable Reward** → **Investment** (the user puts in data/content that loads the next trigger and *raises switching cost* — this is the retention-compounding loop). **BJ Fogg's B=MAP:** Behavior happens when Motivation, Ability, and a Prompt converge; **Ability (simplicity) is usually the bottleneck, not motivation** — so the design lever is "make it tiny." Variable reward draws on Skinner's variable-ratio schedule (the most extinction-resistant reinforcement). **The ethical line is Eyal's own Manipulation Matrix:** a mechanic is ethical when *it improves the user's life* AND *you'd use it yourself* (the "Facilitator" quadrant); the "Regret Test" — would an informed user regret the behavior? — is the gate.
- Hook: https://www.nirandfar.com/how-to-manufacture-desire/ · B=MAP: https://www.behaviormodel.org/ · Manipulation Matrix: https://www.nirandfar.com/the-art-of-manipulation/ · Regret Test: https://www.nirandfar.com/regret-test/ · critique (Center for Humane Technology / Tristan Harris): https://www.humanetech.com/the-cht-perspective

**(b) Garnish translation.**
- **Trigger:** external at first (one opt-in dinner-decision nudge timed to *this* user's cook window — `mind-reading-ux.md` idea #3); internalized over time (the 5pm "what's for dinner" anxiety cues opening Garnish).
- **Action (keep it tiny):** the core action is "cook tonight's dish." Lower *Ability* relentlessly — pantry-aware "cook what you have," pre-portioned to the household, beginner-grade steps (Garnish already has these). The B=MAP lesson: most "I didn't cook" failures are *ability/friction* failures, not motivation failures — fix friction first.
- **Variable Reward — of the *Self* type** (mastery, not social slot-machine): the satisfying-cook payoff, the post-cook check-in, the feed getting smarter, a new variation unlocked. Garnish's reward is **competence and discovery**, the healthiest reward class.
- **Investment:** every cook, favorite, plan, taste-DNA edit, and saved collection *is* the investment — it improves tomorrow's feed and raises the cost of leaving. This is the single most important retention loop and it maps **exactly** onto roadmap N1 (close the cook loop) + idea #1 (tunable Taste-DNA where edits are training signal).

**(c) Feasibility.** The Investment loop is the **core launch build** (N1). Triggers ride on the **already-built INE** (`apps/server/src/notifications/ine/` — dry-run today, default-OFF real-send). Variable-reward-of-self mechanics (post-cook check-in, smarter feed) are launch-feasible.

**(d) L0 data needed.** The full investment signal set: `cook_complete`, `favorite_add/remove`, `mealplan_add/remove`, `taste_seed`/preference edits, dwell. These are precisely the 44 signals in `E43_A3_SIGNAL_REGISTRY_V1` — the registry is the habit loop's instrumentation.

### 1.4 LTV/CAC — why retention dominates LTV

**Principle.** **LTV = ARPU × gross-margin / churn.** Because LTV is *inversely proportional to churn*, it is a hyperbola: **halving churn doubles LTV** — a far bigger lever than ARPU or acquisition volume.

| Monthly churn | Lifetime | LTV @ $7/mo (≈ Garnish price) |
|---|---|---|
| 10% | 10 mo | ~$70 |
| 5% | 20 mo | ~$140 (**doubles**) |
| 2.5% | 40 mo | ~$280 (**doubles again**) |

The profit analogue — **Bain/Reichheld: a 5% increase in retention raises profits 25–95%** (HBR). Healthy economics: **LTV:CAC ≥ 3:1** (David Skok), **CAC payback < 12 months**, and at subscription scale **Net Revenue Retention** should approach/exceed 100%. Acquiring a new customer costs **5–25× more** than retaining one (HBR).
- LTV math: https://www.paddle.com/resources/customer-lifetime-value · https://baremetrics.com/academy/saas-calculating-ltv · 5%→25-95%: https://hbr.org/2014/10/the-value-of-keeping-the-right-customers · 3:1 + payback: https://www.forentrepreneurs.com/ltv-cac/ · NRR: https://www.bvp.com/atlas/state-of-the-cloud-2023

**(b) Garnish translation.** At ~$7/mo with a solo founder and (today) no paid acquisition, **retention is the entire business model** — there is no acquisition budget to paper over a leaky bucket. The founder's "LTV/retention, not acquisition" instinct is mathematically correct. A Garnish-specific danger: the utility paradox (Part 2) is a *churn* problem, and churn sits in the *denominator* of LTV — so "teaching too well" is not a soft concern, it directly halves or quarters LTV. Conversely, every month the taste model keeps a user is pure LTV multiplication.

**(c) Feasibility.** The *math* is launch-relevant for decision-making now (it dictates "build retention before acquisition"). Measuring real LTV/CAC needs payments (Stripe/Mollie — currently OFF, post-G2) and real cohorts; so it is a **scale** measurement but a **launch** mindset.

**(d) L0 data needed.** Subscription start/cancel events (when payments land) joined to the cook-activity stream — so churn can be tied to behavioral decline (Part 4).

### 1.5 RFM & engagement segmentation; the power-user curve

**Principle.** **RFM** (Recency, Frequency, Monetary) is the workhorse behavioral segmentation (Arthur Hughes, 1994): quintile-score each axis → segments like Champions, Loyal, **At Risk** (was frequent, recency collapsed — the highest-ROI win-back target), Hibernating, Lost. **Engagement-state segmentation** (Reforge): Power / Core / Casual / At-risk / Dormant — and **Casual→Core is far more achievable than resurrecting the dormant**. The **Power User Curve / Lx metric** (Facebook growth team; a16z) plots a *histogram* of users by number-of-active-periods; a right-leaning **"smile"** = a dense power-user core that DAU/MAU averages away.
- RFM: https://www.putler.com/rfm-analysis/ · engagement states: https://www.reforge.com/blog/brief-understand-your-most-engaged-users-with-the-power-user-curve · Power User Curve: https://a16z.com/the-power-user-curve-the-best-way-to-understand-your-most-engaged-users/

**(b) Garnish translation.** Garnish's RFM is **cook-based**, not purchase-based: **R** = days since last cook, **F** = cooks per week, **M** (no money signal early) = depth/commitment (cooks completed, collections built, taste-DNA richness). The actionable segment: **"was cooking 3×/week, now 0 for 14 days"** = At Risk → the single most important intervention trigger (Part 5, at-risk state). The CleverTap insight applies: **a drop in the recency score is the early warning.** The "Lx smile" for Garnish = the histogram of weekly-cooking users; growing the right tail (people who cook most weeks) is the retention goal.

**(c) Feasibility.** RFM is **pure arithmetic over the orders/cook table — launch-feasible, no ML** (Part 4.5 confirms this is the right small-scale tool). It maps onto the lifecycle state machine the founder already wants.

**(d) L0 data needed.** Per-user rolling cook counts and last-cook timestamp — already materialized by roadmap N0's per-recipe/cohort counters (extend to per-user). The `routine.weekly_cooking_pattern` / `reco.cook_conversion` signals in the registry feed F and R directly.

### 1.6 North-star metric + leading vs lagging

**Principle.** The **North Star Metric** (Sean Ellis) is "the single metric that best captures the core value you deliver" — a *scoreboard* and a **leading indicator of revenue** (John Cutler/Amplitude: "if your North Star is flat, expect revenue flat"), driven by actionable **inputs**. Real NSMs: Spotify = time listening, Airbnb = nights booked, WhatsApp = messages sent. **Leading indicators** (activation, engagement, onboarding completion) are predictive and steerable; **lagging** (revenue, churn, long-term retention) confirm after the fact. **Steer by leading, confirm by lagging.** Reforge's nuance: the NSM is too big to act on directly — "win the game on the individual plays" (the input metrics).
- NSM: https://amplitude.com/resources/north-star-playbook · examples: https://future.com/north-star-metrics/ · leading vs lagging: https://amplitude.com/blog/leading-lagging-indicators · Reforge: https://www.reforge.com/blog/north-star-metric-growth

**(b) Garnish translation.** **Garnish's North Star = Weekly Cooks per Active User** (or "Weekly Cooking Users" — users who complete ≥1 cook in a week). It captures core value (the user actually *cooked and it worked*), it is a leading indicator of retention/LTV, and it is honest (you cannot fake it with app-opens). **Input metrics** (the leading plays): onboarding→first-cook conversion, plan→cook conversion (the plan-skip gap — Part 3), feed "because you…" CTR, return-visit cadence. **Lagging confirmers:** weekly-cook-cohort retention, subscription churn. Avoid the trap of optimizing *app opens* or *recipe views* — both are vanity here.

**(c) Feasibility.** Choosing and tracking the NSM is **launch-feasible** and should be done *before* writing more features — it disciplines every other decision.

**(d) L0 data needed.** `cook_complete` per user per week (the NSM); the input funnel events (onboarding, view, plan, cook). All already in the canonical event envelope (`E43-A1`) once N0/N1 land.

### 1.7 How Netflix / Spotify / Duolingo think about retention (the bar)

- **Netflix:** *engagement (watch time) is the leading indicator of retention* — "when people watch more, they stick around longer"; the recommender "save[s] >$1B/year" via churn reduction and drives 75–80% of viewing (Gomez-Uribe & Hunt, ACM TMIS 2015, https://dl.acm.org/doi/10.1145/2843948). **Garnish analog:** *weekly cooks* is our watch time.
- **Spotify:** Time Spent Listening as the engagement North Star; **Discover Weekly** manufactures a recurring weekly habit (Monday cadence + an accumulating personalized playlist = appointment + investment lock-in), 100B+ tracks streamed over 10 years. https://newsroom.spotify.com/2025-06-30/discover-weekly-turns-10-... **Garnish analog:** a weekly "Made for you this week" cook plan, delivered on a fixed cadence, that *accumulates* — your rotation, named back to you.
- **Duolingo:** retention is the #1 DAU lever — Current User Retention Rate had **5× the impact** of the next metric and drove **4.5× DAU growth in 4 years** (Mazal, https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth); the **streak** past ~10 days sharply cuts dropout; their **ML reactivation** (KDD 2020 "Recovering-Difference Softmax" bandit, +2% new-user retention / +0.5% DAU, https://www.kdd.org/kdd2020/accepted-papers/view/a-sleeping-recovering-bandit-algorithm...) optimizes *which* reminder copy to send while *protecting the channel* from over-messaging. **Garnish analog:** a *weekly* streak (not daily — match cadence), ethical streak-freeze, and the INE eventually choosing the best nudge per user.

---

## PART 2 — The Recipe-App UTILITY PARADOX (the founder's exact problem)

> *"If we teach the recipe well, the user masters it and leaves."* This is the central retention risk for Garnish, and it has a rigorous answer.

### 2.1 The paradox, stated precisely

**Principle.** A subscription only survives if it **re-delivers value on a recurring cadence**. A skill taught "too well" has strong *one-time* core value but **weak mounting losses** — once the dish is mastered, nothing accrues and leaving is costless. This is the "depleting value / solved-problem" churn pattern, and it is fatal because retention is the dominant lever and baseline app churn is already brutal (Andrew Chen/Quettra: average app loses ~77% of DAUs in 3 days, ~90% in 30; the best apps win by *bending the curve flat*). https://andrewchen.com/new-data-shows-why-losing-80-of-your-mobile-users-is-normal-and-that-the-best-apps-do-much-better/

**The structural fix — Sarah Tavel's "Hierarchy of Engagement"** (the single best framework for this problem). Level 2 of the hierarchy is the antidote: build **accruing benefits** ("the more someone uses the product, the better it gets") AND **mounting losses** ("the more they use it, the more they'd lose if they left"). Every escape strategy below is mechanically a way to manufacture accruing benefits + mounting losses *on top of* the taught skill.
- https://sarahtavel.medium.com/the-hierarchy-of-engagement-5803bf4e6cfa · expanded: https://sarahtavel.medium.com/the-hierarchy-of-engagement-expanded-648329d60804

### 2.2 How durable apps escape it (the evidence)

- **Duolingo — "you're never done" by design.** An endless skill ladder (mastered ≠ ceiling; a harder *Legendary* tier sits above gold), **spaced repetition** (Half-Life Regression, ACL 2016 — schedules review right before predicted forgetting, so *the better you learn, the more you must return to maintain*; +12% daily engagement live), **leagues** (learning time +17%), and **adjacent-skill expansion** (Music & Math, Duolingo Max conversation). The technical rebuttal to the paradox is spaced repetition: mastery is never permanent, so review is *structurally infinite*. https://research.duolingo.com/ · https://aclanthology.org/P16-1174.pdf · https://blog.duolingo.com/how-duolingo-streak-builds-habit
- **NYT Cooking — the recipe box as owned, accumulating library.** You pay for *tested, trusted* curation (a free commodity made trustworthy), then it locks into a bundle: end-2024, **3.5M subscribe to a single non-news product** (Cooking among them), **5.4M on bundles (+29% YoY)** — bundling is the explicit churn-reduction engine. The Recipe Box is the *mounting loss*: leaving abandons years of curation. https://pressgazette.co.uk/media_business/new-york-times-non-news-subscriptions-one-third/ · https://www.niemanlab.org/reading/new-york-times-cooking-app-finds-right-ingredients-to-vanquish-rivals/
- **Yummly — the cautionary tale.** A *patented* "Food Genome" content model, 20M+ users — yet users experienced personalization as *static filters* ("set vegetarian, still saw meat"), and Whirlpool **laid off the entire team April 2024 and took it offline December 2024 with no recipe export**, so users lost years of saved recipes overnight. **The lesson:** a brilliant *content* model is necessary but **not sufficient** — without a tight behavioral learning loop and *felt* "it gets me" experience, it decays into a filter wizard with a fancy backend, disposable to users and parent alike. **Garnish already has the Genome-equivalent (GRIS + ingredient feature vectors); the differentiator is wiring it into a learning loop and showing the reasoning** (the exact gap `cooking-apps.md` and `PERSONALIZATION_AUDIT` identify). https://en.wikipedia.org/wiki/Yummly · https://www.menumagic.ai/blog/yummly-shutdown-what-happened-and-whats-next
- **Strava / Peloton — sell the history, not the skill.** Once fitness is "solved," the app sells your *accumulated history, social graph, and identity*: Strava's training history "becomes increasingly valuable over time, raising the cost of switching"; Peloton's monthly churn is **~60% lower for members using 2+ disciplines/month** (freshness + breadth as a churn lever). The academic spine: **habit is by far the strongest retention predictor** (Yang & Koenigstorfer, JMIR 2021, habit β=.42, far stronger than gamification's direct effect — and extrinsic gamification can *backfire* via the overjustification effect). https://pmc.ncbi.nlm.nih.gov/articles/PMC8317040/ · https://press.strava.com/articles/strava-releases-12th-annual-year-in-sport-trend-report-2025
- **Babbel / Memrise — review = recurring value.** Mastery is never permanent (Ebbinghaus forgetting curve, SM-2 algorithm): "learned" items resurface on expanding schedules out to 6-month+ intervals, *forever*. The curriculum ends; the review never does. https://www.structural-learning.com/post/ebbinghaus-forgetting-curve

> **The Yummly↔NYT contrast IS the whole thesis:** NYT makes you *build and own* something inside trusted curation → durable. Yummly *claimed* algorithmic personalization users only felt as filters → disposable. Garnish must be NYT-plus-a-real-learning-loop, never Yummly.

### 2.3 The VALUE-EVOLUTION LADDER (the founder's answer)

Each rung is a **new "job" the same subscription gets re-hired for** (Jobs-to-Be-Done, Christensen: "consumers *hire* products to do jobs"; the job is the moving target). Climbing the ladder = raising accruing benefits + mounting losses without ever "finishing."

| Rung | The job | Garnish mechanism | Accrues / mounts |
|---|---|---|---|
| 1. **Teach** | "Help me cook this dish" | beginner-grade steps, GRIS substitutions, integrity coverage, tools | *(one-time value — the paradox lives here)* |
| 2. **Mastery progression** | "Make me a better cook" | technique/skill ladder (`skillFit` already in the ranker); graduate a mastered dish → a harder one | accruing: skill ↑ |
| 3. **Variations** | "Keep this dish interesting" | variations of mastered dishes (GRIS swaps, regional variants, seasonal twists) | accruing: variety ↑; mounting: "only this app knows my versions" |
| 4. **Adjacent discovery** | "Find me new things I'll love" | taste-DNA-tuned discovery across cuisines ("bright-acidic-herby lamb-forward") + the explore slot | accruing: the feed gets smarter |
| 5. **Planning / pantry convenience** | "Run my kitchen for me" | weekly plan, pantry-aware "cook what you have," smart shopping list | mounting: the app holds my plan, pantry, list — high switching cost |
| 6. **The personal taste model that compounds** | "Be the partner that *knows me*" | the taste vector sharper in year-2 than year-1; "your kitchen this year" recaps | mounting (the real moat): self-built, identity-defining, irreplaceable |

**The theory under the top rung (handle with rigor — the naive version is a trap).** "We'll have the most recipes/data" is **not** a moat: a16z's "Empty Promise of Data Moats" shows data *scale* effects asymptote — after ~40% coverage there is often "no advantage to collecting more data at all," and data goes stale. https://a16z.com/the-empty-promise-of-data-moats/ Data compounds **only** when (NFX) the signal keeps *evolving* (non-asymptotic) AND it *embeds* into the user's accumulated state as a switching cost. A *living* taste model — because tastes change, pantry changes, seasons change, the household changes — is the **evolving** kind; static filters (Yummly) are the asymptoting kind. The durable form is a **switching-cost / data-embedding moat** (Shapiro & Varian, *Information Rules*: the strongest switching costs are the ones *customers build themselves*, and they rise as the database grows), **not** a network-effect moat. https://www.nfx.com/post/truth-about-data-network-effects

### 2.4 What specifically makes year-2 better than year-1

Four things accumulate that did not exist at signup — and they compound on **two independent axes**:
- **Functional axis (real but *diminishing*):** cold-start is escaped (the recsys literature: empty profiles → weak content/questionnaire fallback in year-1; by year-2 collaborative + a rich taste vector predict accurately), and the self-improving loop has more signal. Honest limit: per-datapoint value falls (a16z), and an ever-better *foundation model* keeps raising the cold-start baseline a new competitor starts from (KakaoVentures). So functional compounding is real but bounded.
- **Emotional / switching-cost axis (does *not* diminish — strengthens):** **Endowment** (it's mine) + **IKEA effect** (I built it — Norton/Mochon/Ariely 2012: self-assembled items valued ~63% higher, *only when completed*) + **Identity** (James Clear: "every action is a vote for the type of person you wish to become" — *a confident home cook*) + **sunk cost** (years of "my data, my history"). https://myscp.onlinelibrary.wiley.com/doi/abs/10.1016/j.jcps.2011.08.002 · https://jamesclear.com/identity-votes

**Conclusion for Garnish:** the durable moat is **less "the data is algorithmically irreplaceable" and more "the accumulated personal state is *yours* — self-built, identity-defining, emotionally owned."** Build for the emotional/switching-cost axis (it doesn't decay), use the functional axis as the engine, and make the accumulated state *visible* (Part 6) so the user *feels* the compounding.

**(c) Feasibility.** Rungs 1–2 exist today (steps, GRIS, `skillFit`). Rungs 3–5 are the **personalization roadmap** (variations from GRIS swaps; discovery from N5/X4; planning/pantry from X6). Rung 6 (compounding taste model + recaps) is the **scale payoff** but its *foundation* (logging the personal state) must start at launch or there is nothing to compound.

**(d) L0 data needed.** The *entire* accumulating personal state: cook history, favorites, plans, taste-DNA edits, collections, skill progression. The mounting-loss only exists if this state is **persisted, rich, and user-visible** from day one — which is exactly what `SignalObservation` + `getFoodDnaProjection` + the recipe box must capture.

---

## PART 3 — The "WHY" Inference Engine (behavioral diagnosis)

> The founder's canonical example: a user cooked a dish 3× from our recipe, then it was in their weekly plan the 4th time but they did **not** cook it. Diagnose the latent cause; each diagnosis → a **different** intervention. Wrong diagnosis = annoyance = churn.

### 3.1 The foundational ambiguity (why this is hard)

**Principle.** Implicit feedback carries **no genuine negative** — a non-action is irreducibly ambiguous (disliked, OR never exposed, OR couldn't act). The load-bearing paper, **Hu, Koren & Volinsky (2008), "Collaborative Filtering for Implicit Feedback"** (IEEE ICDM), splits each observation into a binary *preference* and a *confidence* that scales with interaction frequency. Applied here: **3 cooks = a high-confidence positive; the 4th non-cook is a near-*zero-confidence* signal that must NOT be read as a confident negative.** https://yifanhu.net/PUB/cf.pdf The "not shown vs not liked" problem is Missing-Not-At-Random; the safe default for any bare absence is **"unlabeled," rule out non-exposure first** (Saito et al., WSDM 2020, https://arxiv.org/abs/1909.03601).

### 3.2 The five latent causes and the signals that distinguish them

The discriminating evidence is rarely the single drop — it is the **graded signal mix** and the **temporal shape of re-engagement**. The crux: **satiation/boredom is temporary and *recovers* with a time gap; dislike is *persistent*** (Anderson et al., WWW 2014, "The Dynamics of Repeat Consumption" — the canonical boredom curve, https://www.researchgate.net/publication/261959991).

| Latent cause | Distinguishing signals (the heuristic fingerprint) | Right intervention |
|---|---|---|
| **MASTERED** | 3 high-confidence completions; **no negative** signal; cook-time/dwell on steps *dropping* (they don't read the recipe anymore); possibly shifting to harder/new variants | **Graduate them** — offer a variation, a harder dish, or stop re-teaching ("you've got this — here's a twist") |
| **BORED / SATIATED** | short-term satiation curve; expect a *temporary* drop with later *recovery*; **category-level** fatigue (tired of the cuisine, not the dish) | **Diversify** — vary the cuisine/type, not drop the dish; pull it back, surface adjacent discovery |
| **BUSY / EXTERNAL** | a *single* lapse with **no preceding decay**; whole-week cooking dropped, not just this dish; cadence break across everything | **Gentle, low-pressure** nudge; "busy week? here's a 15-min version" — never a guilt trip |
| **DISLIKED** | a genuine **negative** (explicit skip/dislike, mid-step abandonment, low post-cook rating) AND **no recovery** | **Recovery + pull-back** — ask what went wrong, suppress the dish *and generalize* the negative to its cuisine/ingredient |
| **NON-EXPOSED / can't-act** | the dish was simply never surfaced at decision time, or a hard blocker (missing ingredient) | **Re-surface at the right moment / pantry-fix** — not an inference about taste at all |

Supporting techniques (the learned-evolution path, for later): **dwell time** as a satisfaction proxy (Yi et al., RecSys 2014); **skip as explicit dissatisfaction** (Spotify, WSDM Cup 2019); **completion + return = strongest positive**; **short-term satiation vs life-time re-want** as a mixture (SLRC, WWW 2019, https://dl.acm.org/doi/10.1145/3308558.3313594); **category-level fatigue** (FRec, SIGIR 2024 — the fix is varying the category, https://arxiv.org/abs/2405.11764); and the closest formalism for *MASTERED-vs-BORED-vs-BUSY* — **Hidden (Semi-)Markov Models** of latent user states, where an **HSMM** explicitly models *how long* a user stays in a state, separating a temporary "busy" lapse from a permanent "bored" exit (Netzer et al., *Marketing Science*; HSMM: https://tuck.dartmouth.edu/uploads/content/...HSMM...).

### 3.3 Heuristic first → learned later

**Principle (and the honest small-scale truth, Part 4.5).** At hundreds of users you **do not** train sequence/HMM models — you write **transparent heuristic rules** over the signal stream and graduate to learned diagnosis only when you have hundreds of *events per state*. The recipe the literature converges on: (1) never treat absence as confident dislike; (2) gather *graded* signals (completion, dwell, return, explicit skip); (3) for the lapse, check the **time-gap recovery shape** (recovers → boredom; doesn't → dislike) and **whole-week vs single-dish** scope (whole-week → external/busy); (4) only later infer a latent *state* with HMM/HSMM.

**(b) Garnish translation.** This is the founder's WHY engine, and Garnish is **unusually well-positioned** because the substrate already exists. The `E18_E43_A5_RECOMMENDATION_DECISION_INTELLIGENCE` "Why Engine" attribution layer, the 44-signal registry with **per-signal direction/confidence/decay**, and `assessRecipeFit` give the raw material. The heuristic v1 diagnosis is a **rules table over `SignalObservation`**:
- MASTERED ⇐ `cook_conversion` high on this dish + `recipe_step_dropoff`↓ (skipping steps) + no negative.
- BORED ⇐ `cuisine_exploration`↑ away from this cuisine + temporary gap + recovery elsewhere.
- BUSY ⇐ `weekly_cooking_pattern` dropped *across the board* + single clean break.
- DISLIKED ⇐ an actual `ingredient_avoidance`/`dismiss_avoidance`/low feedback signal + no recovery.
- NON-EXPOSED ⇐ the dish wasn't in the served candidate set at decision time (we log exposure via N0's impression log) — rule this out *first*.

**(c) Feasibility.** Heuristic diagnosis is **launch-feasible** the moment the cook loop + impression log exist (N0/N1) — it is arithmetic and rules over signals we already model. Learned diagnosis (HSMM, survival, sequence) is a **scale** build, deferred and meant.

**(d) L0 data needed.** The full graded signal set per (user, dish): exposure/impression (N0), `cook_complete`, `recipe_step_dropoff` (planned signal — needs step-view events), `mealplan_add`/`mealplan_remove`, `recommendation_dismiss`/`not_interested`, dwell, post-cook rating (X8 check-in), and timestamps for recovery-shape analysis. **The `mealplan_remove` signal is wired; the planned `recipe_step_dropoff` and a post-cook rating are the two highest-value additions** for the WHY engine.

---

## PART 4 — Churn Prediction

### 4.1 Lead indicators of churn for habit apps

**Principle.** Churn itself is *lagging* — by the time it moves the user is gone. The job is the upstream *leading* signals, and at-risk users are detectable **~30–90 days before** churn (Amplitude). The canonical early-warnings, **all measured as deviation from the user's *own* baseline, not absolutes** (Braze):
1. **Declining core-action frequency** (the #1 signal): cooking 3×/week → 1× → 0. Anchor to the *value* action (cook), not "app open" (vanity).
2. **Plan-but-skip gap widening** (Garnish-specific gold): planned cooks rising while completed cooks fall — the `planner.plan_abandonment` signal.
3. **Session shortening / shallower sessions** (extracting less value).
4. **Dwell drop** on recipe cards (browsing without intent).
5. **No-open / inactivity streak** crossing a cadence-calibrated threshold.

Dormancy ≠ churn, and **resurrection decays fast** (recently dormant users resurrect at ~3–5× the rate of 6-month-dormant ones) — which is *why early* intervention on short lapses beats waiting.
- https://amplitude.com/blog/predicting-customer-churn · https://www.braze.com/resources/articles/churn-prediction · https://clevertap.com/blog/churn-prediction/ · resurrection decay: https://www.getmonetizely.com/articles/how-to-calculate-resurrection-rate-for-dormant-users-a-critical-saas-metric

**(b) Garnish translation — the lead-indicator panel.** Per user, track the *slope* of: weekly cooks, plan→cook conversion, days-since-last-cook, median session dwell, recipe-detail depth. A user is **At Risk** when their cook frequency drops >X% below their personal trailing baseline OR plan-skip gap widens OR no-cook streak exceeds ~2× their normal inter-cook interval. The **plan-but-skip gap is Garnish's most distinctive early signal** — the founder's own example (planned the 4th, didn't cook) is *literally* the leading indicator, and the WHY engine (Part 3) tells you which intervention to fire.

**(c) Feasibility.** The lead-indicator panel is **launch-feasible** (slopes and thresholds over the cook table). Calibrating thresholds to natural cadence needs a few weeks of data.

**(d) L0 data needed.** Per-user time series of `cook_complete`, `mealplan_add` vs `cook_complete` (the gap), session start/end + dwell, last-cook timestamp. The registry signals `cook_conversion`, `plan_abandonment`, `exposure_fatigue`, `weekly_planning_pattern` are exactly these.

### 4.2 Survival / hazard models (the principled later version)

**Principle.** Churn is a *time-to-event* problem; the obstacle is **right-censoring** (at the window's end, most users are still active — true churn time unknown). The toolkit: **Kaplan–Meier** survival curve `S(t)=Pr(T>t)` (which *is* the retention curve); **Cox proportional hazards** for covariate effects on instantaneous churn risk (check the PH assumption — often violated in churn); **discrete-time hazard** (person-period logistic regression) is the natural fit for *billing-cycle* churn. **Crucial trap:** a *declining* aggregate hazard over tenure can be pure **heterogeneity/survivor-sorting** (high-churn types leave early, leaving loyal types) rather than true stickiness — model the heterogeneity first (shifted-beta-geometric / BG-NBD; Fader & Hardie). For *non-contractual* usage churn (silent stoppers), **"buy-till-you-die"** models (BG/NBD, Pareto/NBD) infer a latent dropout process from RFM.
- lifelines (KM/Cox/AFT): https://lifelines.readthedocs.io/en/latest/Survival%20Regression.html · BG/NBD: http://brucehardie.com/papers/018/fader_et_al_mksc_05.pdf · scikit-survival: https://www.jmlr.org/papers/v21/20-729.html

**(b) Garnish translation.** Two churn flavors: **contractual** (subscription cancel — once payments exist) → discrete-time hazard per billing cycle; **behavioral** (stopped cooking but still paying — the *earlier, more actionable* churn) → BG/NBD-style "is this user still alive (cooking)?" from cook-RFM. The behavioral one matters most because it precedes the cancel by weeks.

**(c) Feasibility.** **Defer.** Survival models need hundreds of churn *events* (Part 4.5). At launch, the Kaplan-Meier *curve* (a descriptive plot) is fine and useful; the *regression* models are scale builds.

**(d) L0 data needed.** Tenure + censoring indicator per user; cook-RFM (recency/frequency); subscription start/cancel (post-payments).

### 4.3 ML churn prediction + the predict→intervene loop

**Principle.** Three regimes: **heuristics** (transparent baseline) → **logistic regression** (interpretable, wins on small/well-engineered data) → **gradient-boosted trees** (XGBoost/LightGBM, win on many heterogeneous features, need SHAP to stay defensible). Watch **class imbalance** (accuracy is a trap — use PR-AUC; **SMOTE breaks probability calibration**, so prefer class weights + threshold tuning or recalibrate after). **But the naive predict→intervene loop optimizes the wrong quantity:** a churn score proxies "who will leave," not "whose decision my offer changes." Empirically, the most confidently-flagged users often have **near-zero uplift** — contacting them wastes budget or even *triggers* churn. The fix is **uplift modeling** (heterogeneous treatment effects): target only **Persuadables** (respond *because* contacted), never **Sure Things**, **Lost Causes**, or **Sleeping Dogs** (contact *harms*). Evaluate with the **Qini curve**, not accuracy.
- uplift quadrants: https://www.uplift-modeling.com/en/latest/user_guide/introduction/clients.html · causalml (Uber, native Qini): https://causalml.readthedocs.io/ · "high churn-score ≈ 0 uplift": https://arxiv.org/pdf/2406.09567

**(b) Garnish translation.** *The predictive model tells you the patient is sick; only the uplift model tells you the medicine helps.* For Garnish this means: even once a churn model exists, **don't blast the highest-risk users with offers** — a guilt nudge to a "Sleeping Dog" (a happy occasional cook who'd have stayed) can *cause* the churn. This is the technical underpinning of the founder's "never nag" guardrail. Until uplift modeling is feasible (deep scale), **use the WHY engine (Part 3) as the poor-man's uplift router**: the *diagnosis* selects whether to intervene at all and how — which avoids treating Sure Things and Sleeping Dogs by construction.

**(c) Feasibility.** ML churn prediction = **scale only** (needs ~2,000+ users and hundreds of churn events). Uplift modeling = **deep scale** (needs a randomized holdout). At launch and early scale, **heuristic risk score + WHY-engine routing** is the correct and sufficient tool.

**(d) L0 data needed.** For the eventual model: the full behavioral feature set + labeled churn events + a randomized holdout (a fraction of at-risk users get *no* intervention) to ever measure incrementality honestly. **Logging the holdout from the start is the one scale-prep worth doing early.**

### 4.4 Act before cancellation; and at cancellation (save-flows)

**Principle.** Intervene in the 30–90-day pre-churn window (cheap, high-yield); at the cancellation moment use **fair save-flows**: **pause-instead-of-cancel** (Netflix pauses up to 3 months; Chargebee "power of pause" — 79% of users *want* a pause option before signing up), **downgrade/downsell**, a **win-back offer as a last resort**, and a short **exit survey that routes the offer to the reason** (price→discount; life-change→pause; too-big→downgrade; bug→support, *not* an offer). **The ethics line:** one genuine, skippable offer with cancel one click away = fair; hiding/stacking/shaming/channel-switching = a dark pattern. **Regulatory reality (verified June 2026):** the FTC "click-to-cancel" rule was **VACATED by the 8th Circuit on July 8, 2025** (procedural grounds — *not* current federal law), but **ROSCA, FTC Act §5, California ARL (AB 2863, effective July 1 2025), and the EU "withdrawal button" Directive 2023/2673 (applies EU-wide from 19 June 2026) are live** — directly relevant to Garnish's EU launch. Amazon settled its Prime dark-pattern case for **$2.5B** (Sept 2025).
- Netflix pause: https://siit.co/blog/how-to-manage-your-netflix-subscription... · pause data: https://www.chargebee.com/blog/power-of-pause-subscription-retention-strategy/ · "hard to cancel" pattern: https://www.deceptive.design/types/hard-to-cancel · FTC vacatur: https://www.cooley.com/news/insight/2025/2025-07-11-click-to-cancel-just-got-cancelled... · EU withdrawal button: https://www.arnoldporter.com/en/perspectives/advisories/2026/05/eu-withdrawal-button...

**(b) Garnish translation.** Garnish's save-flow must be **EU-compliant by construction** (cancel as easy as signup; a labeled withdrawal path) — this is both law and brand. The most on-brand save mechanic is **pause, not discount**: cooking is seasonal and life-dependent; "take a 2-month break, your recipes and taste profile will be exactly here when you're back" is *care*, and it preserves the accumulated state (the moat) instead of severing it. Exit survey: one question, route to pause/help/feedback — and feed the reason into the WHY engine and the catalog (a cuisine everyone cancels over should be examined).

**(c) Feasibility.** Save-flows need payments (post-G2). The **EU-compliant cancel path** must be designed from the start. Pause is launch-design-feasible.

**(d) L0 data needed.** Subscription state events; cancellation reason (exit survey); the accumulated state must be *preservable across a pause* (don't delete on pause).

### 4.5 What's realistic at low data scale (the honest constraint)

**Principle.** The consensus is unambiguous: at hundreds of users, churn work is **descriptive/diagnostic, not predictive**. The binding constraint is **churn *events*, not user headcount** — the "one-in-ten rule" (≥10 churn events per predictor) means with ~15 churners you can responsibly fit *one* predictor, not ten; in-sample validation on few positives "essentially guarantees overfitting"; and **data leakage** (a feature timestamped after the prediction point) fabricates fake-good results at small N. The graduation path: **rule-based health score (<500 users) → regularized logistic (500+ users, 12+ mo) → gradient boosting (2,000+ users, hundreds of churn events).** At hundreds of users, **10 good interviews beat any classifier**, and reading the **cohort-curve shape** (where it drops: early → fix onboarding/activation; late → fix stickiness/the utility paradox) out-resolves any model.
- graduation thresholds: https://www.customerscore.io/blog/churn-prediction-in-saas/ · EPV rule: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5122171/ · cohort-shape reading: https://andrewchen.com/the-easiest-spreadsheet-for-churn-mrr-and-cohort-analysis-guest-post/

**(b) Garnish translation — the right tool for *now*.** A **rule-based cook-health score** (weighted: recency of last cook, weekly cook frequency vs baseline, plan→cook conversion, taste-DNA richness, recovery-after-a-bad-cook) crossing a threshold → the at-risk state → the WHY engine → the right intervention. No ML. A spreadsheet/cron is enough. Pair it with **founder cancellation interviews** (at this stage, irreplaceable). This is fully consistent with how even the vendors describe small-scale work ("three to five manually designed signals," not transformers).

**(c) Feasibility.** **Launch-feasible and correct.** Resist the temptation to build a churn ML model early — it would overfit and mislead.

**(d) L0 data needed.** The health-score inputs (all already modeled as registry signals) + a labeled cancellation log for later, **with a randomized no-intervention holdout from day one** so incrementality is ever measurable.

---

## PART 5 — Intervention Design (countermeasures per lifecycle state)

> The lifecycle state machine the founder wants: **onboarding → activated → habitual → mastering → at-risk → dormant → win-back.** Each state has a *different* message, channel, and timing — and every intervention must pass the "care, not nagging" gate.

### 5.1 The lifecycle playbook (state → trigger → message → channel → timing)

**Principle.** Trigger on **behavior, not the calendar** (Intercom/Braze: "do not wait until someone has stopped using your product"). Channel roles (Braze): **in-app** for lower-urgency value moments; **push** for quick re-engagement of recently-active users; **email** for richer messages to less-active users. Win-back is the *lowest-engagement* flow — bound it to **3–5 touches then sunset** (Iterable), and model sub-1% conversion (Omnisend reactivation: 0.54% conversion, highest unsubscribe rate of any flow). Resurrected users are fragile (~20% less likely to be retained than a new user — Duolingo), so over-messaging them backfires.
- https://www.intercom.com/blog/c-a-r-e-simple-framework-user-onboarding/ · https://www.braze.com/resources/articles/cross-channel-re-engagement · https://iterable.com/blog/reengagement-email-marketers-best-practices/ · https://blog.duolingo.com/back-from-the-brink-what-duolingo-learned-about-its-resurrected-users

| State | Entry signal | The right message (Garnish) | Channel | Timing |
|---|---|---|---|---|
| **Onboarding** | signup, pre-first-cook | "so we never show you X" (allergy gate as care) → a populated "Made for you" with one easy on-taste dish | in-app | immediate; end on payoff, not "we'll learn" |
| **Activated** | first `cook_complete` | celebrate the first cook; reflect the feed leaning ("because you cooked X") | in-app + 1 email | right after the cook (peak affection) |
| **Habitual** | regular weekly cooks | the weekly "Made for you this week" plan; one opt-in dinner-decision nudge at *this user's* cook window | in-app + 1 push/wk | the individual's intent window (e.g. Thu 5pm) |
| **Mastering** | WHY=MASTERED | "you've got this — here's a harder version / a twist"; stop re-teaching | in-app | when they re-encounter the mastered dish |
| **At-risk** | cook-health score drop / plan-skip gap | WHY-routed: BORED→diversify; BUSY→"15-min version, no pressure"; DISLIKED→"what went wrong?" + recovery | push if recently active, else email | within the early window, *once* |
| **Dormant** | no cook ~2× normal interval | a *useful* re-entry: a seasonal hero ("a cold Yalda night — here's a warming ash"), their saved-but-not-cooked dish | email → (if open) in-app | 30/60/90-day windows, frequency-capped, **unenroll on return** |
| **Win-back** | lapsed / pre-cancel | pause-not-cancel; "your taste profile & recipes are exactly here"; the *one* genuine offer | the channel they respond to | staged: reminder → recommendation → (last) incentive; ≤3–5 touches then sunset |
| **Recovery** (cross-cutting) | a *failed* cook (low rating / mid-step abandon) | service-recovery: own it, ask what went wrong, offer a fix/easier alternative | in-app, immediate | right after the failure |

### 5.2 Recovery after a failed cook (the service-recovery paradox, used honestly)

**Principle.** A well-handled failure can leave a user *as or more* satisfied than no failure (the Service Recovery Paradox) — **but the meta-analysis (de Matos 2007) finds it lifts *satisfaction*, not reliably repurchase/loyalty, so you cannot engineer failures.** Rules: **match the remedy to the failure** (a failed dish → fix *that*, not a generic discount); **take ownership, don't blame the user** ("that recipe can be tricky — here's where it usually goes wrong" not "you overcooked it"); apology + a tangible make-good beats apology alone.
- https://en.wikipedia.org/wiki/Service_recovery_paradox · meta-analysis: https://journals.sagepub.com/doi/10.1177/1094670507303012

**(b) Garnish translation.** The post-cook check-in (X8: 🔥/👍/😐) is also the **failure detector**. A 😐/bad result triggers a recovery flow: "what happened?" (too salty / fell apart / too hard) → a *grounded* troubleshooting tip from GRIS/the assistant + an easier or adjacent suggestion. This turns the worst churn moment (a bad cook) into a "they had my back" moment — and it directly feeds the WHY engine's DISLIKED-vs-EXTERNAL disambiguation.

### 5.3 The CARE guardrail — notification fatigue, frequency caps, dark patterns to AVOID

**Principle — fatigue is measurable and opt-outs are permanent.** **22% of app users will abandon an app over 2–5 pushes in a week; ~⅓ at 6–10** (Localytics) → keep a single brand to **~1–2 pushes/week**. Over-messaging permanently shrinks the reachable audience (Duolingo learned to **"protect the channel"** after watching Groupon's aggressive testing destroy email). Reduce volume to *raise* satisfaction (Facebook); give **intensity controls** (calm / regular), not all-or-nothing. **Send-time optimization** sends at the user's most-engaged hour with a population fallback and quiet-hours respect (Braze/Airship). The **EAST** "Timely" lever: a seatbelt prompt worked at the car but not 5 minutes earlier — timing *is* relevance.
**Dark patterns to AVOID (the named catalog — Brignull/deceptive.design):** Roach Motel / hard-to-cancel, **Confirmshaming** ("No thanks, I like eating boring food"), **Nagging**, Obstruction, Fake Urgency/Scarcity, and **manipulative streak pressure** (guilt/sad-mascot at the break point). The ethical gate: Eyal's **Regret Test** (would an informed user regret this?) + the **Facilitator** quadrant. EU **DSA Article 25** *bans* interfaces that "deceive or manipulate" — live law for Garnish's market.
- fatigue: https://www.emarketer.com/content/app-users-are-more-open-to-push-notifications... · protect the channel: https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth · STO: https://www.airship.com/blog/our-machine-learning-model-for-predictive-send-time-optimization/ · EAST: https://www.bi.team/publications/east-four-simple-ways-to-apply-behavioural-insights/ · dark patterns: https://www.deceptive.design/types · DSA Art.25: https://eur-lex.europa.eu/eli/reg/2022/2065/oj · Regret Test: https://www.nirandfar.com/regret-test/

**(b) Garnish translation — and the good news: the substrate already exists.** The **Intelligent Notification Engine** (`apps/server/src/notifications/ine/`) is *built for exactly this* and is the single biggest head-start Garnish has on ethical interventions:
- **HARD consent gate** per trigger (`consentPurpose: core|analytics|personalization`).
- **Per-trigger frequency caps** (`maxPerWeek`) + a service-level **daily cap of 2** + **quiet hours** + **fatigue** as hard gates in the pipeline.
- **Default-OFF real-send** (`INE_REAL_SEND_ENABLED`) — it is dry-run until *deliberately* turned on.
- A **guarded, templated** trigger registry (no medical claims; Persian copy).
The intervention playbook above becomes **new entries in `NOTIFICATION_TRIGGERS`**, each carrying its priority, consent purpose, and cap — and the existing pipeline enforces the global ~1–2/week ceiling, quiet hours, and fatigue automatically. **Every intervention is killable** (the user controls notification consent; the engine respects it). This is the founder's "frequency-capped, killable, genuinely useful" guardrail, *already in code*. The discipline to keep: prefer **in-app** value moments over push; reserve push for the dinner-decision window; never use confirmshaming copy; make the *weekly* streak forgiving (Part 6).

**(c) Feasibility.** **Launch-feasible** — the INE exists; the work is (1) authoring care-passing trigger content, (2) wiring real lead-indicator signals into eligibility, (3) per-user send-time (population default at launch, learned later), (4) flipping real-send on *only* after the caps/consent are verified. No new infrastructure.

**(d) L0 data needed.** Notification consent state (exists: `ConsentState`); `notif_open`/`notif_dismiss` (the `open_affinity`/`dismiss_fatigue` signals — feed send-time + suppression); the lead-indicator panel (Part 4.1) for eligibility; the WHY diagnosis (Part 3) for content selection.

---

## PART 6 — Long-Term Value Compounding (the moat made *felt*)

### 6.1 Why the personal taste/data state makes Garnish indispensable over years

**Principle (the honest version).** Raw data *scale* is not a moat (a16z) — but **accumulated personal state that the user built themselves IS**, because it stacks four mechanisms that *don't* decay: **endowment** (it's mine) + **IKEA effect** (I built it → ~63% higher valuation, *only when completed* — Norton/Mochon/Ariely) + **identity** (Clear: it's who I am) + **sunk cost** (years of history). The durable form is a **switching-cost / data-embedding moat** (Shapiro & Varian; NFX: "data embedding ensures stickiness through high switching costs") — and it's strongest when **stacked** with habit, trust, and brand (NFX: "the best companies layer network effects on top of switching costs and data advantages").
- a16z: https://a16z.com/the-empty-promise-of-data-moats/ · IKEA effect: https://myscp.onlinelibrary.wiley.com/doi/abs/10.1016/j.jcps.2011.08.002 · NFX embedding: https://www.nfx.com/post/ai-defensibility

**(b) Garnish translation.** The moat is **the user's own kitchen, modeled**: their taste vector, cook history, collections, plans, the recipes they've made *their* way (GRIS swaps they prefer). A competitor — even one with a better base model — starts at *their* zero with *this* user. The **emotional axis does not diminish**: every additional year of "my data, my history" deepens ownership and the cost of starting over. **Design implication:** make the accumulated state **rich, persisted, user-owned, and visible** from day one (the recipe box, the editable Taste-DNA). Never delete it on pause. This is the literal answer to the utility paradox — they don't leave because *no other app is them*.

### 6.2 The "it's MY companion" design + anniversary/journey mechanics

**Principle.** Identity-based habit is the deepest retention layer (Clear: "every action is a vote for the type of person you wish to become"). **Year-in-review/Wrapped mechanics** convert silent data accumulation into a recurring *felt* reminder of the relationship — they work via autobiographical-memory/narrative identity, nostalgia, identity-signaling, and quantitative fixation (Irrational Labs on Wrapped). **But the 2024 Wrapped AI backlash is the warning:** a recap feels like **substance** when it is *accurate to the individual*, built from *real accumulated behavior they recognize as theirs*, narratively coherent, and specific-but-true; it feels **hollow** when generic, AI-padded, or inaccurate. The **endowed-progress effect** (Nunes & Drèze 2006: pre-credited loyalty card 34% vs 19% completion) underwrites "journey" mechanics — show "you're X% toward the next milestone," give a head start.
- Wrapped psychology: https://irrationallabs.com/blog/spotify-wrapped-behavioral-science/ · AI backlash: https://www.adweek.com/brand-marketing/spotify-is-the-latest-brand-facing-ai-backlash-over-wrapped-campaign/ · endowed progress: https://academic.oup.com/jcr/article-abstract/32/4/504/1787425 · identity: https://jamesclear.com/identity-votes

**(b) Garnish translation — done with substance.**
- **"Your Kitchen This Month/Year"** (the Wrapped analog, `mind-reading-ux.md` idea #8): aggregate the *real* cook log into a warm, specific, shareable recap — "47 dinners, you leaned into greens and quick weeknights, you leveled up to confident, your most-cooked was Ghormeh Sabzi (×6), you explored 4 new cuisines." **Substance = fidelity to the user's actual accumulated data** — Garnish has exactly this and can avoid Yummly's emptiness *and* Wrapped-2024's AI-padding by staying truthful and specific.
- **Cadence ladder:** weekly (the "Made for you this week" + a forgiving *weekly* cook streak) → monthly (a recap, momentum) → annual ("Your Year in Cooking") → **anniversary** ("one year cooking with Garnish — here's your journey"). Each is a different timescale of the same accumulated-state story.
- **The companion frame, deployed with care:** reflect identity back ("you're the kind of cook who…") — but the AI-companion literature warns of dependency risk in vulnerable users; keep it a *culinary* companion (competence/identity), never an emotional-substitute. Pair with the editable Taste-DNA (idea #1) so the user *steers* the portrait — endowment + IKEA effect + control all at once.

**(c) Feasibility.** "Your Kitchen This Month" is **launch-feasible and high-ROI** (pure emotional payoff over the cook log Garnish already owns — `mind-reading-ux.md` rates it ★★★★★). The compounding taste model is the **scale payoff** but logging starts now. The weekly streak rides on the INE.

**(d) L0 data needed.** The cook log (counts, cuisines, recency, skill progression) — already captured by `cook_complete` + `SignalObservation`. The recaps are *reads* over existing accumulated state; they add no new logging, only the discipline to **persist the state richly and never discard it**.

---

## RANKED-BY-ROI BUILD LIST (retention mechanisms)

Ranked by **felt impact × feasibility for a solo founder at launch scale**, with the gating dependency. ROI tiers: 🟢 do-now (launch), 🟡 early-scale, 🔴 defer-and-mean-it.

| # | Mechanism | Why it's high-ROI | Tier | Depends on |
|---|---|---|---|---|
| **1** | **Close the cook loop + persist rich personal state** (N0+N1) | *Nothing retention-related works without it.* It is the Investment loop (habit), the moat (accumulated state), the cohort metric, the WHY-engine substrate, and the activation event — all at once. | 🟢 | — (do first) |
| **2** | **Pick & instrument the North Star = Weekly Cooks/Active User** + the lead-indicator panel | Disciplines every decision; makes at-risk detectable 30–90 days early; anchors to value not vanity. Pure arithmetic. | 🟢 | #1 |
| **3** | **"Because you cooked X" recsplanations** (N5) | Legibility *is* the "it gets me" magic; the whole category fails here; cheapest differentiation; makes the feed feel like care. | 🟢 | #1 |
| **4** | **The CARE intervention layer on the existing INE** (lifecycle playbook 5.1) | The "never abandon" engine — and the substrate (consent/fatigue/caps/quiet-hours/default-OFF) is *already built*. Just author care-passing triggers + wire signals. | 🟢 | #1, #2, INE |
| **5** | **Heuristic WHY engine + cook-health score** (Parts 3, 4.5) | The founder's core requirement; correct tool at small scale (rules, not ML); routes #4 so interventions feel diagnosed, not blasted (poor-man's uplift → avoids nagging). | 🟢 | #1, #2 |
| **6** | **Post-cook check-in + failed-cook recovery flow** (X8 + 5.2) | Cleanest explicit signal at peak affection; turns the worst churn moment (a bad cook) into "they had my back"; powers DISLIKED-vs-EXTERNAL. | 🟢 | #1 |
| **7** | **"Your Kitchen This Month/Year" recap** (idea #8) | Pure emotional payoff over data already owned; the Wrapped analog with *substance*; anniversary/journey retention ritual; shareable. | 🟢 | #1 |
| **8** | **Editable Taste-DNA as training signal** (idea #1) | Endowment + IKEA effect + control; the moat made tunable; converts accuracy into felt understanding. (Partly built — `/profile/taste`.) | 🟡 | #1, taste vector |
| **9** | **Weekly "Made for you this week" plan, fixed cadence** (Discover-Weekly analog) | Manufactures a recurring weekly habit + accumulating investment; matches Garnish's true cadence. | 🟡 | #1, ranker |
| **10** | **Forgiving weekly streak + ethical milestones** (endowed progress) | Loss-aversion retention done as *care* (free freeze, "earn back"), not anxiety; matches weekly cadence. | 🟡 | #4 |
| **11** | **Pause-not-cancel save-flow + EU-compliant cancel path** | Preserves the moat instead of severing it; on-brand; legally required for EU. | 🟡 | payments (post-G2) |
| **12** | **Learned diagnosis (HSMM/survival) + uplift-routed interventions + churn ML** | The rigorous version of Parts 3–4 — but starves without hundreds of churn events; slots into the same shapes later. **Log the randomized holdout now** so it's measurable. | 🔴 | scale data |

---

## THE MINIMUM LOVABLE RETENTION SYSTEM

*The smallest set that makes a user feel **never-abandoned** and that **the subscription compounds** — every item is launch-feasible and rides on data/infra Garnish already has or is about to build.*

1. **A closed cook loop + richly persisted, user-owned personal state** (#1). The user's cooking *changes the app* and *accumulates as theirs*. Without this there is no habit, no moat, no diagnosis — it is the floor.
2. **"Because you cooked X" everywhere** (#3). One true, concrete reason on every card/shelf/nudge — the legibility that converts accuracy into *felt* understanding and makes interventions read as care.
3. **A heuristic WHY engine + cook-health score routing a CARE intervention layer on the INE** (#5→#4). The system *diagnoses* (mastered/bored/busy/disliked/external), fires the *right* response in the *right* state, and — because the INE enforces consent + ~1–2/week caps + quiet hours + default-OFF + killability — it *cannot* nag. This is the literal "never abandon, never nag."
4. **Post-cook check-in + failed-cook recovery** (#6). The peak-affection signal *and* the safety net that turns a bad cook into "they had my back."
5. **"Your Kitchen This Month" recap** (#7). The compounding made *visible* — the monthly reminder that "this app is becoming *mine*," the emotional payoff that no static-filter competitor can fake.

That is five builds, all over data Garnish is already modeling, all riding the existing INE and signal registry. Together they deliver the founder's mandate: the user is met in every state with something *useful and diagnosed*, never nagged; and each month the subscription is *visibly* worth more than the last.

---

## 7-LINE SUMMARY

1. **Top churn causes for a recipe app:** the *utility paradox* (mastered the dish → "solved," nothing accrues → leaves); cook-frequency decline + the plan-but-skip gap; a bad/failed cook with no recovery; cold-start emptiness (generic feed, no "it gets me"); boredom/satiation mistaken for dislike; and notification fatigue / nagging that *causes* the exit.
2. **The value-evolution answer to the utility paradox:** climb the ladder — teach → mastery progression → variations → adjacent discovery → planning/pantry → the *compounding personal taste model* — so the subscription's job keeps evolving and accruing; the moat is the **self-built, identity-defining accumulated state** (endowment + IKEA effect + identity + switching cost), which makes year-2 genuinely better than year-1 and which no competitor or base model starts with.
3. **Year-2 > year-1 because** the functional axis escapes cold-start (real but diminishing) while the emotional/switching-cost axis (your own data, history, identity) *strengthens* — so build for the axis that doesn't decay and make it *felt* via recaps.
4. **The WHY-inference approach:** never read absence as confident dislike (3 cooks = strong positive, the 4th non-cook ≈ zero-confidence); diagnose via the *graded signal mix* + *recovery shape* (recovers→bored, persists→dislike) + *scope* (whole-week→busy); **heuristic rules over `SignalObservation` first**, learned HSMM/survival/uplift only at scale.
5. **Churn realism at our scale:** descriptive/diagnostic, not predictive — a rule-based cook-health score + cohort-curve reading + founder interviews beat any classifier under a few hundred churn events; **log a randomized no-intervention holdout from day one** so incrementality is ever measurable.
6. **The CARE guardrail is already half-built:** the INE enforces consent + frequency caps (~1–2/week) + quiet hours + fatigue + default-OFF + killability; author care-passing, WHY-routed triggers, prefer in-app, never confirmshame, keep the (weekly) streak forgiving — and stay EU-compliant (DSA Art.25; the FTC click-to-cancel rule is *vacated*, but EU/CA rules are live).
7. **Top-5 interventions to build first:** (1) close the cook loop + persist rich personal state; (2) "Because you cooked X" recsplanations; (3) heuristic WHY engine + cook-health score routing the CARE layer on the INE; (4) post-cook check-in + failed-cook recovery; (5) "Your Kitchen This Month" recap — the Minimum Lovable Retention System.

---

**FILE:** `C:\dev\garnish-app\docs\audit\_research\retention-churn.md`
