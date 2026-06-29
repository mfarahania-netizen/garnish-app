# Garnish — Master Admin-Dashboard Metric Catalog (2026, world-class)

> **What this is.** The complete, exhaustive reference catalog of every admin metric / event / monitor Garnish *could* track, benchmarked against the world's best 2025–2026 dashboards, and **grounded in what our own backend actually captures today**. This is the "200" — it's actually ~260 distinct items across 18 categories.
>
> **Sources (real products, researched).** Product/growth: Amplitude (North Star Playbook), Mixpanel, PostHog, Heap, June.so, Statsig, GA4, Pendo. Revenue: Stripe Billing/Sigma, RevenueCat, ChartMogul, Baremetrics, ProfitWell, Adapty. AI/LLM observability: Helicone, Langfuse, LangSmith, OpenRouter, Datadog LLM Observability, PostHog LLM Analytics, Portkey/Traceloop/TrueFoundry. Cooking-specific: NYT Cooking eng., Algolia.
>
> **This is a REFERENCE catalog, not a v1 build list.** See §18 for what to actually build first. Building all 260 against a pre-pilot DB would itself be "مصنوعی" — empty tiles must honestly read "awaiting pilot", never show a fabricated number.

## How to read the status tag (grounded in the live Postgres DB, queried 2026-06-29)

| Tag | Meaning |
|---|---|
| 🟢 **REAL** | Data exists & flows today; the metric can be computed for real right now. |
| 🟡 **WIRED / awaiting pilot** | Pipeline + service exist and are correct, but the table is empty/thin until real users arrive. Show as "awaiting pilot," not a fake number. |
| 🔴 **NEEDS CAPTURE** | No producer fires this yet; requires new instrumentation before it means anything. |
| ⚪ **POST-LAUNCH** | Depends on monetization/billing that doesn't exist yet (app launches free). Build when paid tiers go live. |

**Confidence:** metric *definitions* are [قطعی] (cross-confirmed across ≥2 vendors). All benchmark *numbers* (%, thresholds) are [احتمالاً] — single-report, point-in-time, directional. Vendor caveat: Helicone is in maintenance mode (acquired by Mintlify, 2026); Langfuse acquired by ClickHouse (2026, core stays open). For a from-scratch build, instrument to the **OpenTelemetry GenAI semantic conventions** to stay portable.

---

## §0 — NORTH STAR + INPUT-METRIC TREE (build this first; everything hangs off it)

Amplitude's bar for a North Star Metric (NSM): represents real user value, is within product's influence, and *leads* revenue. Must not be a vanity/pageview metric.

| # | Metric | What / why | Status |
|---|---|---|---|
| 0.1 | **North Star: weekly meals actually cooked** | Realized-value event (`cook_complete`/`cookedAt`), not a pageview. The one number the org aligns on. | 🟢 REAL (5 cook events today; real once traffic exists) |
| 0.2 | Input — Breadth: weekly active cooks | distinct users who cooked ≥1 meal this week | 🟢 REAL |
| 0.3 | Input — Depth: recipes cooked per active cook | how much value per user | 🟢 REAL |
| 0.4 | Input — Frequency: cook-days / user / week | how repeatedly the habit fires | 🟢 REAL |
| 0.5 | Input — Efficiency: time from app-open → first useful output | our own "<30s value" bar | 🔴 NEEDS CAPTURE (need timed session start→value event) |
| 0.6 | Guardrail: allergy-gate violations (must = 0) | never game the NSM at the user's safety expense | 🟢 REAL (guard runs over fixtures, pilot-independent) |
| 0.7 | Guardrail: recipe-failure / «نشد» rate | cooking experience health | 🟡 WIRED |
| 0.8 | Guardrail: p95 AI latency | speed guardrail | 🟢 REAL (AICallLog) |
| 0.9 | Driver/metrics tree (NSM → 3–5 inputs → team levers) | encodes causal assumptions you then test | n/a (framework) |

---

## §1 — ACQUISITION

| # | Metric | What / why | Status |
|---|---|---|---|
| 1.1 | Channel / default channel group | Organic / Paid / Direct / Referral / Social / Email split | 🔴 NEEDS CAPTURE (no attribution layer) |
| 1.2 | Source / Medium | atomic acquisition unit (google/organic…) | 🔴 |
| 1.3 | First-user source/medium/campaign | the first touch that acquired a user | 🔴 |
| 1.4 | Session source/medium/campaign | most-recent touch that started a session | 🔴 |
| 1.5 | UTM parameters (source/medium/campaign/term/content) | manual campaign tagging | 🔴 |
| 1.6 | New users over time | raw top-of-funnel | 🟢 REAL (User table) |
| 1.7 | New signups (completed accounts) | denominator for activation | 🟢 REAL |
| 1.8 | Net-new MAU (growth accounting) | New + Resurrected − Churned | 🟡 WIRED |
| 1.9 | Visitor → signup rate | landing/signup efficiency | 🔴 (no anon visitor tracking) |
| 1.10 | Install → signup (registration) rate | catches the silent PWA drop | 🔴 |
| 1.11 | PWA install / add-to-home-screen rate | THE PWA-specific acquisition gate | 🔴 NEEDS CAPTURE (emit a `pwa_install` event) |
| 1.12 | First-touch / last-touch / multi-touch attribution | what creates vs closes demand | 🔴 |
| 1.13 | K-factor (viral coefficient) | invites×conversion; K>1 = self-sustaining | 🔴 (no referral loop) |
| 1.14 | Viral cycle time | speed of the loop | 🔴 |
| 1.15 | Invites sent / accepted | inputs behind K | 🔴 |
| 1.16 | Referral rate | % new users from invites | 🔴 |
| 1.17 | CAC (blended + paid + by channel) | the price of growth | ⚪ POST-LAUNCH (no ad spend) |
| 1.18 | CAC payback period | months to recoup CAC | ⚪ |
| 1.19 | LTV, LTV:CAC | ceiling on acquisition spend; ~3:1 target | ⚪ |
| 1.20 | ROAS + cohort ROAS @ D7/14/30 | revenue ÷ ad spend, by cohort | ⚪ |

---

## §2 — ACTIVATION / ONBOARDING

| # | Metric | What / why | Status |
|---|---|---|---|
| 2.1 | Activation rate | % of new users hitting a value milestone in a window | 🟡 WIRED (onboarding funnel exists) |
| 2.2 | Aha-moment definition | subjective value; the activation *event* is its proxy | n/a (definition) |
| 2.3 | Activation event ("magic number") | the early action that *causally* predicts retention. **Candidate: first completed cook within 7 days** | 🟢 REAL (event exists) |
| 2.4 | Time-to-value (TTV) | signup → first value moment | 🔴 NEEDS CAPTURE (timestamp diff) |
| 2.5 | Time-to-activation | signup → full activation event | 🟡 WIRED |
| 2.6 | Onboarding funnel step-completion | % completing each setup step | 🟢 REAL (AnalyticsIntelligence onboarding funnel) |
| 2.7 | Step drop-off / abandonment | the largest single-step drop | 🟢 REAL |
| 2.8 | Setup-moment completion (allergies, household, prefs) | precondition for value | 🟢 REAL (diet_changed/skill_changed events) |
| 2.9 | Day-1 activation rate | fastest-readable activation gauge | 🟡 WIRED |
| 2.10 | First-week milestone completion | best apps win on first-7-day numbers | 🟡 WIRED |
| 2.11 | Habit moment (aha repeated at cadence) | true activation = first habit loop | 🟡 WIRED |
| 2.12 | Activation → retention correlation | activated users retain materially better | 🟡 WIRED (needs cohorts of real users) |

---

## §3 — ENGAGEMENT

| # | Metric | What / why | Status |
|---|---|---|---|
| 3.1 | DAU / WAU / MAU (on a value action) | active-user volume | 🟢 REAL (UserEvent stream) |
| 3.2 | DAU/MAU stickiness (>20% = sticky) | best one-number habit proxy | 🟢 REAL |
| 3.3 | WAU/MAU & DAU/WAU | **a meal-planner is weekly-native → WAU/MAU may be our truer stickiness** | 🟢 REAL |
| 3.4 | Sessions / user | return frequency | 🟡 WIRED (UserSession 0 rows today) |
| 3.5 | Session length / duration | depth-of-attention proxy | 🔴 NEEDS CAPTURE (session start/end not emitted) |
| 3.6 | Session interval | natural rhythm; basis for tiers | 🔴 |
| 3.7 | Feature adoption rate (% of actives using X) | median ~6.4%, top-decile ~15.6% [احتمالاً] | 🟢 REAL (per-feature events) |
| 3.8 | Breadth of engagement (distinct features/cuisines) | reach | 🟢 REAL |
| 3.9 | Depth of engagement | real stickiness vs one-time try | 🟢 REAL |
| 3.10 | Time-to-adopt a feature | fast = hit a real pain | 🟡 WIRED |
| 3.11 | Duration of adoption | keeps delivering after first use? | 🟡 WIRED |
| 3.12 | Core events (80% of usage) | defines "what real usage looks like" | 🟢 REAL |
| 3.13 | Power-user curve (L28 / L7) | histogram of days-active-in-28; reveals the distribution DAU/MAU hides | 🟢 REAL (computable from events) |
| 3.14 | The "smile" shape | hardcore core vs shallow decay | 🟢 REAL |
| 3.15 | Core / Casual / Power segmentation | size & protect your most valuable segment | 🟢 REAL |
| 3.16 | Actions per user / session | intensity beneath sessions | 🟢 REAL |
| 3.17 | Product Engagement Score (PES = Adoption+Stickiness+Growth) | one headline health number | 🟡 WIRED |

---

## §4 — RETENTION / CHURN

| # | Metric | What / why | Status |
|---|---|---|---|
| 4.1 | Retention rate | strongest single PMF signal | 🟢 REAL (cohort engine) |
| 4.2 | N-day (bounded) D1 / D7 / D30 | onboarding / early habit / durable habit | 🟢 REAL |
| 4.3 | Unbounded ("on or after") retention | literally the inverse of churn | 🟢 REAL |
| 4.4 | Rolling retention | from each user's signup, not calendar | 🟡 WIRED |
| 4.5 | Bracketed retention (days 1–7) | smooths noise for **low-frequency cooking behavior** | 🟡 WIRED |
| 4.6 | Birth event vs return event | makes retention non-vanity | n/a (definition) |
| 4.7 | Cohort retention curve | decay shape = the diagnostic | 🟢 REAL |
| 4.8 | Retention heatmap / triangle | "are newer cohorts retaining better" | 🟢 REAL (AnalyticsIntelligence cohorts) |
| 4.9 | Curve flattening / "smile" = PMF | non-zero plateau by ~month 6 | 🟡 WIRED (needs months of real data) |
| 4.10 | Lifecycle states (New/Current/Resurrected/Dormant/Churned) | turns one number into flows | 🟡 WIRED |
| 4.11 | Resurrected / reactivated users | cheaper than new acquisition | 🟡 WIRED |
| 4.12 | Dormant users | early-warning intervention pool | 🟡 WIRED |
| 4.13 | Resurrection rate | % of dormant returning | 🟡 WIRED |
| 4.14 | Churn rate | inverse of retention | 🟢 REAL |
| 4.15 | churnRiskScore (per user) | predicted churn risk | 🟢 REAL (UserBehaviorProfile.churnRiskScore) |
| 4.16 | consistencyScore (per user) | habit-strength signal | 🟢 REAL (UserBehaviorProfile) |
| 4.17 | Churn-prediction signals (↓session freq + core-feature drop) | flags risk 30–60 days early | 🟡 WIRED |
| 4.18 | Quick Ratio = (new+resurrected) ÷ churned | growing regardless of headline MAU | 🟡 WIRED |
| 4.19 | MAU growth accounting | decomposes MAU change | 🟡 WIRED |
| 4.20 | VoC leading indicators (NPS/CSAT/CES) | qualitative churn predictors | 🔴 NEEDS CAPTURE (no survey layer) |

---

## §5 — FUNNELS

| # | Metric | What / why | Status |
|---|---|---|---|
| 5.1 | Conversion funnel (ordered sequence) | the backbone "where intent leaks" report | 🟢 REAL |
| 5.2 | Step conversion (relative) | isolates one transition's friction | 🟢 REAL |
| 5.3 | Step drop-off (% + count) | primary leak signal | 🟢 REAL |
| 5.4 | Overall funnel conversion | headline funnel number | 🟢 REAL |
| 5.5 | Time-to-convert (P25–P99) | distribution of time between steps | 🟡 WIRED |
| 5.6 | Conversion window | session/time budget to finish | n/a (config) |
| 5.7 | Counting method (Uniques/Totals/Sessions) | changes the denominator | n/a |
| 5.8 | Conversion criteria (specific vs any order) | strictness of the sequence | n/a |
| 5.9 | "Hold property constant" (same recipe_id across steps) | one coherent journey | 🟢 REAL (recipeId denormed on events) |
| 5.10 | Exclusion steps ("did not do") | isolates a pure path | 🟢 REAL |
| 5.11 | Funnel breakdown / comparison by segment | side-by-side | 🟢 REAL |
| 5.12 | Funnel correlation analysis | auto-surfaces what correlates with converting | 🔴 NEEDS CAPTURE (not built) |
| 5.13 | Paths around a drop-off | the actual detour that loses users | 🔴 |
| 5.14 | Save drop-offs as a cohort | one-click retarget/analyze | 🟡 WIRED |
| **The specific funnels** | | | |
| 5.15 | Signup funnel | | 🟢 REAL |
| 5.16 | Onboarding / activation funnel | | 🟢 REAL |
| 5.17 | First-cook funnel (view → cook-mode → complete) | | 🟢 REAL (cook funnel exists) |
| 5.18 | Plan → list → shop → cook end-to-end funnel | the core value loop | 🟢 REAL (events exist for each step) |
| 5.19 | Free → paid funnel | | ⚪ POST-LAUNCH |

---

## §6 — SEGMENTATION & COHORTS

| # | Metric | What / why | Status |
|---|---|---|---|
| 6.1 | Behavioral cohort (did event N times in window) | power-user / churn-risk lens | 🟢 REAL |
| 6.2 | Acquisition cohort (when/how they joined) | basis of retention heatmap | 🟢 REAL |
| 6.3 | Static vs dynamic cohort | experiment control vs auto-refresh | 🟡 WIRED |
| 6.4 | Sequential-event cohort | captures journeys | 🟡 WIRED |
| 6.5 | First-time-behavior cohort (first cook this week) | | 🟢 REAL |
| 6.6 | Lifecycle cohort (new/returning/resurrected/dormant) | | 🟡 WIRED |
| 6.7 | Segment by acquisition date | | 🟢 REAL |
| 6.8 | Segment by plan / tier | | ⚪ POST-LAUNCH |
| 6.9 | **Segment by locale / country / language** | **Dutch-speaker vs diaspora Persian-speaker = different products** | 🟡 WIRED (need locale on user) |
| 6.10 | Segment by device / platform / app version | | 🔴 NEEDS CAPTURE |
| 6.11 | Custom user/event properties (diet, household, cuisine, servings) | biggest lever on analysis granularity | 🟢 REAL (events carry these) |
| 6.12 | Comparative segmentation (side-by-side) | "do power/Dutch/paid users retain better?" | 🟢 REAL |
| 6.13 | RFM segmentation (Recency/Frequency/Monetary) | win-back vs churn-risk targeting | 🟡 WIRED |
| 6.14 | Predictive / ML cohorts (top-N% likely to convert/churn) | proactive targeting | 🟢 REAL (churnRisk/profile exist) |
| 6.15 | Segment → push-to-action (Audiences sync) | the analyze→act loop | 🔴 NEEDS CAPTURE |
| 6.16 | Auto-capture → retroactive cohorts | define a cohort after the fact | 🔴 |
| 6.17 | Group/household analytics | measure the household's funnel | 🟡 WIRED (familySize on profile) |

---

## §7 — COOKING / RECIPE-SPECIFIC (our true differentiator)

| # | Metric | What / why | Status |
|---|---|---|---|
| **7a. Recipe / content engagement** | | | |
| 7.1 | Recipe detail views | per-recipe demand + denominator | 🟢 REAL (recipe_view) |
| 7.2 | Unique recipes viewed per user | catalog breadth touched | 🟢 REAL |
| 7.3 | Saves / favorites | explicit intent-to-cook | 🟢 REAL (favorite_add; FavoriteRecipe 7 rows) |
| 7.4 | Save rate (saves ÷ views) | "is this compelling" ratio | 🟢 REAL |
| 7.5 | Cook-mode started / "start cooking" rate | strongest active-intent signal | 🟢 REAL (start_cooking_click) |
| 7.6 | Recipes cooked / "I made this" rate | the single most valuable outcome event | 🟢 REAL (cook_complete) |
| 7.7 | Cook-completion rate (finished ÷ started) | core health of the cooking experience | 🟢 REAL |
| 7.8 | View → cook conversion | the headline cooking-app metric | 🟢 REAL |
| 7.9 | Save → cook conversion | do saved recipes get made? | 🟢 REAL |
| 7.10 | Add-to-shopping-list rate (from recipe) | content→action bridge; cook-intent predictor | 🟢 REAL |
| 7.11 | Ratings submitted / submission rate | feedback supply | 🟡 WIRED |
| 7.12 | Average rating per recipe | per-recipe quality | 🟡 WIRED |
| 7.13 | Reviews + "I-made-it" photos (UGC rate) | social-proof engine | 🔴 NEEDS CAPTURE |
| 7.14 | Recipe shares / share rate | virality + delight proxy | 🔴 |
| 7.15 | Scroll depth on recipe page | does progressive-disclosure work? | 🟢 REAL (section expand/read events) |
| 7.16 | Time on recipe / dwell | inspiration vs utility | 🟡 WIRED |
| 7.17 | Print / export rate | trust signal for older EU cooks | 🔴 NEEDS CAPTURE |
| **7b. Search & discovery quality** | | | |
| 7.18 | Search usage rate | how much discovery rides on search | 🟡 WIRED |
| 7.19 | Browse-vs-search ratio | invest in taxonomy vs relevance | 🟡 WIRED |
| 7.20 | Search success rate / CTR | % searches with ≥1 result click | 🟡 WIRED |
| 7.21 | **🔑 Zero-results / null-search rate** | Algolia target <2%; **first content-gap alarm** | 🟢 REAL (search_unmet event exists) |
| 7.22 | No-click rate | results showed, nothing clicked = relevance problem | 🟡 WIRED |
| 7.23 | **🔑 Top searches with no good result** | **names the recipes to author next**; feeds IDEAS_AND_GAPS | 🟢 REAL (search_unmet payload) |
| 7.24 | Search → recipe-view rate | did search deliver? | 🟡 WIRED |
| 7.25 | Search refinement / reformulation rate | synonym gaps (critical for Persian-dish names in NL) | 🔴 NEEDS CAPTURE |
| 7.26 | Search exit rate | "search failed them" | 🟡 WIRED |
| 7.27 | Query volume + top + trending queries | demand-side content planning | 🟡 WIRED |
| 7.28 | Recommendation CTR | recsys click-through | 🟢 REAL (recommendation_click; RecommendationMetrics) |
| 7.29 | Recommendation acceptance (saved/cooked, not just clicked) | the real "are recs good" metric | 🟢 REAL (RecommendationAttributionEvent) |
| **7c. Meal planning & shopping (core actions)** | | | |
| 7.30 | Meal plans created / % of users creating one | adoption gate for highest-value workflow | 🟢 REAL (mealplan_generate; MealPlan 113) |
| 7.31 | Plan slots filled / fill rate | depth of planning intent | 🟢 REAL (MealSlot 1,308) |
| 7.32 | Weekly plan completion / adherence (slot → cookedAt) | calendar produced real meals | 🟢 REAL (UserOutcome adherence) |
| 7.33 | **🔑 Plan reuse / copy-week rate** | **strongest repeat-use/habit signal** | 🔴 NEEDS CAPTURE (emit a `mealplan_copy_week` event) |
| 7.34 | Recurring planning rate (N consecutive weeks) | did planning become a ritual? | 🟡 WIRED |
| 7.35 | Servings-adjustment / scaling usage | "this app is smart enough to trust" | 🔴 NEEDS CAPTURE (portion_scaled = 0 fired) |
| 7.36 | Plan edits per week | tailoring vs bad guesses | 🟢 REAL (mealplan_add/remove) |
| 7.37 | Shopping lists created / % of plans → list | list adoption | 🟢 REAL |
| 7.38 | Plan → shopping-list conversion | the critical handoff | 🟢 REAL |
| 7.39 | Items added / avg list size | volume + denominator | 🟢 REAL (ShoppingItem 296) |
| 7.40 | List completion / check-off rate | proof the list entered a supermarket | 🟢 REAL (shopping_toggle) |
| 7.41 | Shopping-list → cook conversion | closes the full loop | 🟢 REAL |
| 7.42 | Pantry-awareness usage ("already have it") | smart-list + food-waste story for EU | 🟢 REAL (PantryItem 11) |
| **7d. Content-ops (admin editorial view)** | | | |
| 7.43 | Per-recipe scorecard (views·saves·cooks·rating·shares) | unit of editorial decisions | 🟢 REAL |
| 7.44 | Recipe popularity / trending score | **powers the familiarity-ranking we need** | 🟢 REAL (observability counters) |
| 7.45 | Recipe velocity / rising recipes | merchandise before the peak | 🟡 WIRED |
| 7.46 | **🔑 Cook-mode drop-off point / per-step abandonment** | pinpoints the failing instruction | 🔴 NEEDS CAPTURE (per-step events) |
| 7.47 | Underperforming recipes (high views, low completion) | the prioritized rewrite list | 🟢 REAL (observability "problem" list) |
| 7.48 | Content coverage by cuisine/category/occasion/dietary | exposes catalog holes (Nowruz, Sinterklaas, vegan…) | 🟢 REAL (recipe metadata) |
| 7.49 | **🔑 Catalog coverage vs demand** | demand-weighted authoring backlog | 🟡 WIRED (overlay search_unmet on catalog) |
| 7.50 | Seasonal / occasion demand curve | editorial calendar (EU holidays + Nowruz) | 🟡 WIRED |
| 7.51 | Completion by difficulty / time bucket | is the "beginner steps" rewrite moving completion? | 🟢 REAL |
| 7.52 | UGC coverage per recipe | thin-UGC popular recipes = seed reviews | 🔴 NEEDS CAPTURE |

---

## §8 — AI ASSISTANT (product metrics — measure the companion as a product)

| # | Metric | What / why | Status |
|---|---|---|---|
| 8.1 | Assistant messages + sessions-with-assistant | adoption + load (cost driver) | 🟢 REAL (ai_message_send 19; ai_suggestion_generated 1,903) |
| 8.2 | Containment / resolution rate | % resolved with no escape to manual browse | 🔴 NEEDS CAPTURE |
| 8.3 | Fallback / "no answer" rate | <10% benchmark; earliest degradation alarm | 🟡 WIRED (intent on AICallLog) |
| 8.4 | Intent coverage rate (% of top intents handled) | content-gap analog for the assistant | 🔴 NEEDS CAPTURE |
| 8.5 | Helpfulness thumbs / CSAT | cheapest quality loop | 🔴 NEEDS CAPTURE (no thumbs UI) |
| 8.6 | Answer-acceptance rate | acted on / not rephrased | 🔴 |
| 8.7 | Follow-up / clarification rate | some healthy (our "ask ONE Q"); rising = missed intent | 🟡 WIRED |
| 8.8 | **🔑 Suggestion-accepted rate (suggest → save/cook)** | **the money metric for an AI cooking companion** | 🔴 NEEDS CAPTURE (link suggestion→outcome) |
| 8.9 | Assistant-driven conversion (→ plan/list/cook) | does the AI earn its token cost | 🔴 NEEDS CAPTURE |
| 8.10 | Latency / first-response time (TTFT) | governs perceived quality mid-cook | 🟢 REAL (AICallLog latency) |
| 8.11 | Hallucination / factual-error rate | for a food app this is also a safety metric | 🟡 WIRED (guardHits) |
| 8.12 | Escalation / abandonment rate | give-up + mid-conversation drops | 🔴 NEEDS CAPTURE |
| 8.13 | Cost per resolved conversation / tokens per turn | ROI lens | 🟢 REAL (AICallLog) |

---

## §9 — AI / LLM COST & OBSERVABILITY (our STRONGEST real panel — AICallLog is genuinely live)

> AICallLog today: **563 rows, ~1.085M tokens, 537 provider-reported usage, real cost on 154 rows (~$0.098), avg latency ~9.1s, multi-model fallback recorded.** This panel is real *right now*.

| # | Metric | What / why | Status |
|---|---|---|---|
| 9.1 | Prompt / completion / total tokens | primary cost driver | 🟢 REAL |
| 9.2 | Reasoning tokens (o-series/thinking) | silent cost | 🟢 REAL (field exists) |
| 9.3 | Cache-read / cache-write tokens | cheaper reads = savings | 🟢 REAL (cacheHit/cacheTokens) |
| 9.4 | Embedding tokens | retrieval/RAG cost | 🟡 WIRED |
| 9.5 | $ cost total | tokens × model price | 🟢 REAL (154 rows; rest estimated) |
| 9.6 | $ by model | catches an over-priced model | 🟢 REAL |
| 9.7 | **$ by feature** | profitability per capability — **REQUIRES tagging every call with a `feature` dimension** | 🔴 NEEDS CAPTURE (surface='chat' for 100% today) |
| 9.8 | $ by user (top spenders / Pareto) | heavy-user / abuse detection | 🟢 REAL (userId on log) |
| 9.9 | $ per day | daily burn vs budget | 🟢 REAL |
| 9.10 | Input vs output cost split | output ~3–5× input price | 🟢 REAL |
| 9.11 | Cost saved via cache | $ avoided by cache hits | 🟢 REAL |
| 9.12 | Cost per active user (CPAU) | compare against ARPPU | 🟢 REAL |
| 9.13 | Cost per conversation / session | unit cost | 🟢 REAL (conversationId) |
| 9.14 | Cost per message / request | granular unit cost | 🟢 REAL |
| 9.15 | Cost per converted user | is AI a CAC line or a margin drain? | ⚪ POST-LAUNCH |
| 9.16 | Tokens per conversation | verbosity / context-bloat signal | 🟢 REAL |
| 9.17 | Latency p50 / p95 / p99 | tail latency | 🟢 REAL |
| 9.18 | TTFT (time to first token) | the number users *feel* mid-cook | 🟡 WIRED (need streaming timestamp) |
| 9.19 | Tokens / sec throughput | generation speed per model | 🟢 REAL (compute from latency+tokens) |
| 9.20 | End-to-end request duration | full round-trip | 🟢 REAL |
| 9.21 | Latency by model / provider | compare fallback-chain members | 🟢 REAL |
| 9.22 | Error rate | % failed requests | 🟢 REAL (status field) |
| 9.23 | Timeout rate | % exceeding ceiling | 🟢 REAL |
| 9.24 | **Rate-limit / 429 events** | your trigger to cool+skip a model | 🟢 REAL (errorCode) |
| 9.25 | **Fallback-chain depth / fallback rate** | **if most turns land on last-resort Gemini, your "primary" is down** | 🟢 REAL (provider field records chain) |
| 9.26 | Model-mix / model-usage share | % traffic per model | 🟢 REAL |
| 9.27 | Cooldown / model-availability state | which models are cooled-out now | 🟡 WIRED |
| 9.28 | Retry rate | retries per request | 🟡 WIRED |
| 9.29 | Cache hit rate | % served from cache | 🟢 REAL |
| 9.30 | Requests / min (RPM) | load + rate-limit headroom | 🟢 REAL |
| 9.31 | Active AI users (DAU/MAU of assistant) | adoption of the AI feature | 🟢 REAL |
| 9.32 | Generations count | total LLM calls | 🟢 REAL |
| 9.33 | toolCalls analytics | which agentic tools fire | 🔴 NEEDS CAPTURE (toolCalls = 0 everywhere; gated on agentic rebuild) |

---

## §10 — AI QUALITY & SAFETY (the allergy gate — non-negotiable, target = 0 violations)

| # | Metric | What / why | Status |
|---|---|---|---|
| 10.1 | Thumbs up/down rate | the ground truth other metrics predict | 🔴 NEEDS CAPTURE (no thumbs UI) |
| 10.2 | Regeneration / retry rate | implicit dissatisfaction | 🟡 WIRED |
| 10.3 | Groundedness / faithfulness score | answer based only on retrieved corpus | 🔴 NEEDS CAPTURE (LLM-judge eval) |
| 10.4 | Hallucination-flag rate | claims absent from source | 🟡 WIRED |
| 10.5 | Answer relevance / completeness | LLM-as-judge | 🔴 NEEDS CAPTURE |
| 10.6 | Refusal / "I-don't-know" rate | too high = useless, too low = overconfident | 🟡 WIRED |
| 10.7 | Eval-suite score over time | golden-eval pass-rate trend | 🟢 REAL (fa golden evals run) |
| 10.8 | Quality drift detection | "quality dropped X% on day Y" | 🟡 WIRED |
| 10.9 | **Safety-block rate** | % outputs blocked by the allergy/diet gate | 🟢 REAL (status=blocked_safety; ops/safety-compliance) |
| 10.10 | **Allergy-gate trigger count** | times the deterministic gate caught an unsafe rec | 🟢 REAL (guard runs over fixtures, pilot-independent) |
| 10.11 | Gate false-positive / over-block rate | safe answers wrongly blocked (UX cost) | 🟡 WIRED |
| 10.12 | **🔑 Unsafe-passthrough incidents (must = 0; page on any)** | allergen reached a user despite the gate | 🟢 REAL (allergy hard-filter PASS/FAIL) |
| 10.13 | PII / privacy-filter hits | GDPR-relevant (EU) | 🟡 WIRED |
| 10.14 | Jailbreak / prompt-injection attempts | adversarial inputs | 🟢 REAL (status=blocked_injection) |

---

## §11 — REVENUE / SUBSCRIPTION (⚪ all POST-LAUNCH — app launches free; build when paid tiers go live)

| # | Metric | Status |
|---|---|---|
| 11.1 | MRR / ARR / Committed MRR | ⚪ |
| 11.2 | Active subscriptions / subscribers (logos) | ⚪ |
| 11.3 | New customers / new paid subscriptions | ⚪ |
| 11.4 | **MRR movement waterfall** (New / Expansion / Reactivation / Contraction / Churned / Net New) | ⚪ |
| 11.5 | ARPU / ARPPU | ⚪ |
| 11.6 | LTV (realized + predicted) | ⚪ |
| 11.7 | CAC / LTV:CAC / CAC payback | ⚪ |
| 11.8 | Logo churn / gross revenue churn / net MRR churn | ⚪ |
| 11.9 | GRR / NRR | ⚪ |
| 11.10 | Quick Ratio | ⚪ |
| 11.11 | Subscription retention curve (watch M1 cliff) | ⚪ |
| 11.12 | Avg customer lifetime | ⚪ |
| 11.13 | Free → Paid conversion (freemium ~2.18% vs hard-paywall ~12% [احتمالاً]) | ⚪ |
| 11.14 | Trial → Paid conversion | ⚪ |
| 11.15 | Active-trials movement | ⚪ |
| 11.16 | Paywall view → purchase rate | ⚪ |
| 11.17 | Plan / tier mix; monthly vs annual split | ⚪ |
| 11.18 | Upgrade / downgrade rate | ⚪ |
| 11.19 | Subscription status breakdown (active/trial/grace/retry/paused/expired) | ⚪ |
| 11.20 | **Involuntary churn** (failed payments; 20–40% of churn) | ⚪ |
| 11.21 | Failed-payment / decline rate | ⚪ |
| 11.22 | Dunning recovery rate; grace-period save rate (Android ~2× iOS involuntary) | ⚪ |
| 11.23 | Billing-retry success by store | ⚪ |
| 11.24 | Refunds & refund rate | ⚪ |
| 11.25 | Chargeback / dispute rate | ⚪ |
| 11.26 | MRR by cohort / plan / **country (NL/DE/FR)** / platform (web avoids store tax) | ⚪ |
| 11.27 | Cohort LTV curves | ⚪ |

---

## §12 — AI MONETIZATION / CREDITS (⚪ POST-LAUNCH — the usage layer on top of subscription)

| # | Metric | Status |
|---|---|---|
| 12.1 | AI-credit top-up revenue | ⚪ |
| 12.2 | AI-credit consumption (units; ~$0.01/credit) | 🟡 WIRED (token cost is real; pricing layer not built) |
| 12.3 | Credit burn-down per user / per tier | 🟡 WIRED |
| 12.4 | % users hitting credit cap (upsell pipeline) | ⚪ |
| 12.5 | Attach rate of AI-credit packs | ⚪ |
| 12.6 | Revenue per credit vs cost per credit | ⚪ |
| 12.7 | **AI gross margin per user** (ARPPU − AI cost ÷ ARPPU; negative = you pay users) | ⚪ (cost half is REAL; revenue half post-launch) |
| 12.8 | AI cost as % of revenue | ⚪ |
| 12.9 | Margin by tier (free-tier AI burn = pure cost) | 🟡 WIRED (cost side real) |
| 12.10 | Break-even credits/user | ⚪ |

---

## §13 — REAL-TIME / LIVE ACTIVITY

| # | Metric | Status |
|---|---|---|
| 13.1 | Active users last 30 min (per-minute bars) | 🟢 REAL (events have timestamps) |
| 13.2 | Realtime by source / page / event / segment | 🟢 REAL |
| 13.3 | Live event feed / activity tab | 🟢 REAL (event browser exists, paged) |
| 13.4 | Users-online + events-per-minute heartbeat | 🟢 REAL |
| 13.5 | User snapshot (watch one live user's stream) | 🟢 REAL (observability per-user cabin) |
| 13.6 | Session replay (spike → recordings) | 🔴 NEEDS CAPTURE (no replay SDK) |

---

## §14 — ANOMALY DETECTION & ALERTS

| # | Metric | Status |
|---|---|---|
| 14.1 | Automated anomaly detection (metric leaves historical band) | 🔴 NEEDS CAPTURE |
| 14.2 | Auto-alerts per event (zero-setup) | 🔴 |
| 14.3 | Forecast / expected-range bands | 🔴 |
| 14.4 | Threshold alerts (above/below) | 🟡 WIRED (SpendAlertService exists; AiSpendAlert 0 rows) |
| 14.5 | % / absolute change alerts (WoW drop >20%) | 🔴 |
| 14.6 | Alert routing (Slack / Email / Webhook → PagerDuty) | 🔴 |
| 14.7 | Root-cause / contribution analysis | 🔴 |
| 14.8 | Proactive AI agents (push WoW shifts + auto-RCA to Slack) | 🔴 (the 2026 frontier; this is the future "admin AI") |

---

## §15 — EXPERIMENTATION / A-B

| # | Metric | Status |
|---|---|---|
| 15.1 | Variant exposures | 🟡 WIRED (ExperimentEngine exists; ExperimentAssignment 0 rows) |
| 15.2 | Conversion per variant + lift / effect size | 🟡 WIRED |
| 15.3 | Statistical significance (p-value or Bayesian win-prob) | 🟡 WIRED |
| 15.4 | Confidence / credible interval | 🟡 WIRED |
| 15.5 | **Sample Ratio Mismatch (SRM) check** | 🔴 NEEDS CAPTURE |
| 15.6 | Minimum Detectable Effect (MDE) | 🔴 |
| 15.7 | Sample size + power + running-time calculator | 🔴 |
| 15.8 | Sequential testing (always-valid p-values) | 🔴 |
| 15.9 | Guardrail / secondary metrics | 🟡 WIRED |
| 15.10 | Holdout groups | 🔴 |
| 15.11 | Feature-flag rollout monitoring | 🟡 WIRED |
| 15.12 | CUPED / variance reduction | 🔴 |
| 15.13 | Winsorization + multiple-comparison correction | 🔴 |

---

## §16 — OPS / RELIABILITY / COMPLIANCE (GDPR/EU — investor-grade, pilot-independent)

| # | Metric | What / why | Status |
|---|---|---|---|
| 16.1 | System health (API error rate, well-formed event rate) | platform reliability | 🟢 REAL (ops/health) |
| 16.2 | AI guard-block rate (injection/safety/nutrition/cost) | guardrail activity | 🟢 REAL |
| 16.3 | Event-quality / bot-noise drop rate | anti-bot gate honesty | 🟢 REAL |
| 16.4 | Consent posture by purpose (opt-in/opt-out per purpose) | GDPR Art.7 evidence | 🔴 NEEDS CAPTURE (ConsentLog.purpose NULL on all 41 rows — column added, legacy path doesn't write it) |
| 16.5 | Consent withdrawal → processing-stop verification | Art.7(3) | 🟢 REAL (current-consent read-gate) |
| 16.6 | Erasure requests + completion (Art.17) | right-to-be-forgotten evidence | 🟡 WIRED (ErasureEvent 0 rows) |
| 16.7 | Data-access log (who read what) | audit trail | 🟢 REAL (DataAccessLog) |
| 16.8 | Preference-change history | audit | 🟢 REAL (PreferenceHistory 43) |
| 16.9 | Support ticket volume / backlog / resolution time | support-desk health | 🟡 WIRED (SupportTicket 0 rows) |
| 16.10 | Notification send / open / suppress-decision rate | Layer-10 gap | 🔴 NEEDS CAPTURE (no send/suppress producer) |
| 16.11 | Gamification: streaks / achievements / progress distribution | engagement loop health | 🟢 REAL (thin: UserStreak 6, etc.) |
| 16.12 | Recsys offline eval (NDCG / reward) | ranker quality, pilot-independent | 🟢 REAL |
| 16.13 | RecipePrior learning coverage | L1 ranker "is it learning yet" | 🟡 WIRED (RecipePrior 0 → ~0% learning) |

---

## §17 — GROUNDED REALITY: what's REAL today vs gaps

**The 4 strongest REAL panels we can build right now (real data, real value):**
1. **AI cost & observability (§9)** — AICallLog is genuinely live: tokens, $-cost, per-model/provider mix, multi-model-fallback visibility, latency p50/p95, error & 429 & cost-block rates. **This is our single strongest, most investor-credible panel.**
2. **Engagement & funnels (§3/§5)** — end-to-end on the existing event stream: top viewed/saved/cooked recipes, onboarding + first-cook funnels, plan→list→cook loop, trends, cohort retention.
3. **Cooking content-ops (§7d)** — per-recipe scorecards, trending/"problem"-dish lists, **the two content-gap signals (zero-result searches → authoring backlog).**
4. **Safety & compliance (§10/§16)** — allergy zero-leak indicator + guard-fire counts; runs over real engines+fixtures, so it's **real regardless of pilot data** — investor-grade.

**The architecture's discipline is the asset:** every metric service already self-labels `real` vs `awaiting_pilot` and strips PII. A dashboard can trust those tags verbatim — an empty tile honestly reads "awaiting pilot," never a fabricated number.

**The highest-value MISSING captures (build these — they're cheap and they unlock "this app is smart"):**
- 🔴 **P0 taste signals** `ingredient_swapped` / `portion_scaled` / `ingredient_removed` — declared + wired but **0 events fired**. The single highest-value missing capture for personalization. (Items 7.35, plus the whole learning loop.)
- 🔴 **`feature` dimension on every AI call** — surface is `'chat'` for 100% today, so §9.7 "$ by feature" is impossible. Tag calls (assistant_chat / substitution / meal_plan / nutrition_qa / during_cook). (This is the permanent fix to the cost-logging problem from before.)
- 🔴 **Content-gap → backlog wiring** — overlay `search_unmet` on the catalog (§7.49) + assistant intent-coverage (§8.4). Auto-generates the authoring + AI-capability backlog from real demand.
- 🔴 **`mealplan_copy_week` event** (§7.33) — the strongest repeat-habit signal, currently unmeasured.
- 🔴 **`pwa_install` + session start/end** (§1.11, §3.5) — unlock PWA acquisition + session metrics.
- 🔴 **AI thumbs up/down** (§10.1) — cheapest quality loop, no UI for it today.
- 🔴 **ConsentLog.purpose write** (§16.4) — column exists, legacy path doesn't populate it → GDPR-by-purpose breakdown is blind.

**Wait for real pilot users (don't fake):** all of §11/§12 revenue, online-learning reward (RecipePrior), support-desk, A/B, erasure, session-duration.

---

## §18 — RECOMMENDED BUILD (don't build all 260 — build the real subset, honestly tagged)

**Reality Check:** A 260-metric dashboard over a pre-pilot DB is itself "مصنوعی." The bar isn't coverage — it's *every tile is either real or honestly says "awaiting pilot."*

**Phase 1 — the ~15-tile "command screen" (all REAL today):**
North Star tree (§0) · DAU/WAU/MAU + stickiness (§3) · first-cook funnel + plan→list→cook loop (§5) · cohort-retention heatmap (§4) · **AI cost/latency/model-mix/fallback (§9)** · safety: allergy zero-leak + guard fires (§10) · top/trending + "problem" recipes + zero-result searches (§7d) · live activity (§13) · system health + GDPR posture (§16). Each tile reads its existing `real`/`awaiting_pilot` tag.

**Phase 2 — the cheap high-value captures (§17 list):** P0 taste signals, `feature` tag on AI calls, content-gap→backlog wiring, copy-week event, thumbs up/down, consent purpose. These turn ~20 🔴/🟡 tiles green and make the app *measurably* smart.

**Phase 3 — the admin AI analyst (§14.8):** push WoW/MoM shifts + auto-root-cause to the founder ("admin AI" — the L2b system). After Phase 1+2 have real data to reason over.

**Phase 4 (post-launch):** revenue/subscription (§11), AI margin (§12), A/B infrastructure (§15).

**نتیجهٔ عملی:** Phase 1 first — it's all real, it's the strongest investor story (especially the AI-cost + safety panels), and it ships a dashboard where nothing is faked. Phase 2's captures are small code changes with outsized payoff. The admin AI (the real "مو از زیر دستت در نره") is Phase 3 — it needs Phase 1+2 data underneath it to be real, not a demo.
