# The Garnish Personalization & Recommendation Roadmap

**From the current system (~12% of the vision, per `PERSONALIZATION_AUDIT.md`) to `PERSONALIZATION_STANDARD.md`.**
**Author stance:** brutally prioritized for a *solo, non-technical-leaning founder.* No phase is busywork; every item names the **user-felt impact** ("it gets me"), the **effort**, and the **dependency.** **Date:** 2026-06-20.

---

## The honest starting point

The audit verdict, distilled: Garnish built *a genuinely good content/safety substrate and an honestly-engineered staging lane — and wired almost none of the intelligence to a real user.* The live system is a fixed-weight blend of keyword heuristics over a profile **hardwired to empty observations**, receiving **zero context**, where **cooking a recipe is a silent no-op.** Meanwhile ~13k LOC of sophisticated "learning" engine sits in a shadow tree **designed never to ship** (`promotionAllowed: false`).

Three facts shape the entire roadmap:
1. **The substrate is real and above category norm** — HARD allergy gate, candidate diversity, exposure de-dup, USDA-locked nutrition, ingredient-level content data (the moat).
2. **The gaps are mostly arithmetic over data already logged** — not GPUs. This is why ~12% is closable fast.
3. **The biggest single liability is inverted effort** — the smartest code reaches no user and is a maintenance tax. Freeing that budget is itself a roadmap move.

**The guiding sequence (ROI order, from the audit's §6 and the research):** materialize counters → close the cook loop + hydrate profile → popularity deflation → cohort prior → explore slot → item-item CF → context + recsplanations. Defer all scale stories (two-tower, ANN, user embeddings) — they slot into the same shape later with no rewrite.

---

## Phase NOW — Close the loop and make it honest (weeks 0–8)

*Goal: the founder's own acceptance test ("cook 10 stews → more stews tomorrow") becomes TRUE, and the system stops lying to the user. Everything here is small code over data we already own.*

| # | Move | User-felt impact ("it gets me") | Effort | Dependency |
|---|------|--------------------------------|--------|------------|
| N0 | **Phase-0 counters + impression/reward log.** Materialize per-recipe (and cohort-grouped) rolling counts `{impressions, views, quick_exits, cook, favorite, skip, not_interested}`; log `position`+`propensity`+`reward` per card. Add `UserEvent.recipeId`. | *(invisible, but unlocks everything below)* | **M** | none — do first |
| N1 | **Close the cook loop.** Register `cook_complete` → `applyPositiveFeedback(~0.4)` + `extractSignalsFromRecipe` + write full `SignalObservation`; add to feature-store windows + candidate seeds. Route `favorite_add` through the same extractor. Fix `favorite_remove` to apply a negative. | **The big one.** Cook 3 stews → the feed visibly leans stew. The app finally *responds to the hardest action a user takes.* | **M** | N0 |
| N2 | **Hydrate the live profile from real observations.** `getLivingUserProfile` reads persisted `SignalObservation` (like `getFoodDnaProjection` already does) behind consent+safety. Allergies stay declared-only; taste/effort/skill go observed. | Warm-up becomes real — the more you cook, the more it's *yours*, instead of cold forever. | **S–M** | N1, full observation contract |
| N3 | **`cuisine_affinity` signal end-to-end.** Wire the already-*designed* signal (keyed on `cuisine.primary`/`region`) into extractor + ranker token map. | "Persian stews → more Persian" becomes *possible* (it is literally impossible today). | **S** | N1 |
| N4 | **Popularity deflation (Beta-shrunk, cohort-conditioned accept-rate).** Replace `(views+favorites*2)/250` with two-sided `acceptRate` (positives vs negatives, global/cohort prior). | The 200 dishes everyone skips quietly sink; the feed stops pushing duds. *Collectively smart, ~one file.* | **S** | N0 |
| N5 | **"Because you cooked X" recsplanations.** Replace score-fraction explanations with concrete, evidence-grounded reasons from real history (substrate already exists: `assessRecipeFit`, contribution calculator). | **Legibility = the magic.** "Because you cooked Fesenjan twice" reads as mind-reading; the whole category fails here. | **S** | N1 |
| N6 | **Time-of-day → mealType context (first context plumb).** Add a minimal `RecommendationContext`; gate candidates by meal slot so 8am ≠ 8pm. | Breakfast in the morning, dinner at night — the list stops being identical all day. | **S** | none |
| N7 | **Enforce consent at ingest + kill the two privacy leaks.** Read `ConsentState` in `trackEvent`, stamp `consentPurpose`; implement the destructive retention prune. | *(trust floor; GDPR exposure closed)* | **S** | N0 |
| N8 | **Extract/delete the shadow tree.** Move `runtime-shadow/`+labs (~13k LOC) out of the production module; promote the *one* signal worth keeping (cuisine affinity, done in N3) into the live path. | *(no user impact — frees the maintenance budget for everything else; halves the slice's footprint)* | **M** | N3 |

**Exit criterion for NOW:** an integration test proves *cook N stews → stew-similar recipes rank higher on the next `GET /recommendations`*, and recs differ by time of day. Acceptance tests #1 and #4 (partially) pass.

---

## Phase NEXT — Make it collectively smart and feel alive (months 2–5)

*Goal: the network effect turns on, cold-start stops feeling generic, and the personalization becomes legible and explorable. Still arithmetic, no deep learning.*

| # | Move | User-felt impact | Effort | Dependency |
|---|------|-----------------|--------|------------|
| X1 | **Cohort/region prior via hierarchical shrinkage** (global→cohort→user; region switches on with markets). | New users get a *non-generic, cohort-aware* feed on day one that slides toward their real taste as they cook. "It got me from the first session." | **M** | N0, N2 |
| X2 | **Thompson explore slot (the flywheel).** Reserve ~10–20% of slots for dishes sampled from their Beta posterior; raise explore for new users, anneal down. | The feed feels *alive* — fresh, surprising-inside-comfort, never stale; new dishes get a fair shot. Also generates the data that sharpens X1/N4. | **S** (~1 day core) | N0 |
| X3 | **Item-item co-engagement CF.** Upgrade the dormant `collaborative` bucket to "users who cooked/loved A also cooked B" + content cosine. | One cook lights up a whole neighborhood — "recipes like the ones you love." | **M** | N0, N1 |
| X4 | **Recipe content embeddings + user taste vector v0.** Cache a content embedding per recipe (ingredient-deep); user vector = commitment-weighted centroid of engaged recipes. | Taste generalizes beyond keywords — it learns you like "bright-acidic-herby lamb-forward" dishes even across cuisines. | **M–L** | N1, N2 |
| X5 | **"Already cooked" cooldown + negative generalization + diversity cap.** Strong recency suppression keyed to `cook_complete` (boost the *type*, suppress the *instance*); dismiss generalizes to cuisine/ingredient; cap near-duplicates in top N. | Stops the jarring "didn't it just suggest this?"; "not interested" actually sticks across similar dishes. | **S** | N1 |
| X6 | **Persistent pantry + "cook with what you have."** `PantryItem` model; default `match_pantry_recipes` to it; replace the fake "pantry rail" with real matches; proactive low-pantry nudge. | The single most mind-reading-feeling utility: "you have chicken + lemon — here's tonight's dinner." | **M** | N6 |
| X7 | **Contextual home headline + named shelves + Daily Briefing wired to a real hero.** Compose time+day+season+recent-cooks into one human sentence; name shelves ("Weeknight rotation," "Saved for someday"); surface `GET /briefing/today` sourced from the real ranker. | "It knows it's a tired Wednesday and I cooked quick twice this week." Named shelves reflect patterns the user lives but never stated. | **M** | N6, X4 |
| X8 | **Post-cook check-in ("🔥/👍/😐") + two-track taste model.** One-tap signal at peak affection; split *aspire* (saves) vs *cook* (completed) vectors. | The cleanest explicit signal in the category, captured when it matters; "Saved for someday" vs "Your rotation" named back to you. | **S** | N1 |
| X9 | **Honest evaluation: temporal held-out + interleaving.** Replace the circular synthetic nDCG proof; add interleaving for ranker comparison; allergy-violation-rate=0 as a release gate. | *(no direct user impact — but the first point any quality claim becomes true, and what lets you ship improvements safely at low traffic)* | **M** | N0 |

**Exit criterion for NEXT:** all four acceptance tests pass on real pilot users — individual loop, collective deflation (with minority-loved dishes surviving), regional prior decay, and a legible/tunable feed.

---

## Phase LATER — Earn the scale story (months 6+, gated on real data)

*Build only when the data justifies it. Each slots into the existing two-stage shape with no rewrite.*

| # | Move | Gate | Effort |
|---|------|------|--------|
| L1 | **Learned ranker (LambdaMART/logistic) on logged impressions→cooks** (temporal split); blend becomes cold-start fallback. | enough labeled impressions for a stable temporal split | **L** |
| L2 | **Hybrid content+CF (LightFM-style)** as CF signal densifies. | ~10k+ users w/ repeat interactions or ~100k+ events | **L** |
| L3 | **Two-tower retrieval + ANN + learned user embeddings.** | tens of thousands of items/users; user tower has history to train on | **XL** |
| L4 | **Session/sequence models (SASRec)** *only if* meal-planning sessions densify; **Monolith-style online embeddings** only at sustained continuous cook volume. | dense multi-item sessions / continuous event stream | **XL** |
| L5 | **Visual taste-quiz onboarding (Yum-Me 2-phase) → real taste vector.** Tap diverse dish photos → pairwise refine → palate vector via label propagation over content embeddings. | retention exists; worth the build over the simpler taste-card stack | **M–L** |

**Defer-and-mean-it:** none of L1–L4 are first moves; they starve without data Garnish won't have early. The Standard's reference architecture is *designed* so they drop in by swapping the retrieval source and value model.

---

## 12 BEYOND-STANDARD ideas (a tier above everyone)

These go past matching TikTok/Spotify-for-food into territory no competitor occupies. Ranked by **impact × feasibility for a solo founder** (★ = feasibility, ◆ = differentiation).

| Rank | Idea | Why it's a tier above | Feasibility | Build-on |
|------|------|----------------------|-------------|----------|
| **1** | **Transparent, tunable Taste-DNA where edits are training signal.** The Food DNA screen becomes a *living, editable portrait* — drag your "spice / adventurousness / effort" sliders, watch the feed change, and the edits *retrain the model.* | Turns the model into an instrument the user *plays* — the literal "it became one with me." No recipe app lets you see *and* steer your palate. Reuses the existing `/profile/dna` surface. | ★★★★★ ◆◆◆◆◆ | X4, Pillar 8 |
| **2** | **"Because you…" everywhere, generated from real cook history.** Every card, shelf, and nudge carries one true, concrete reason. | Legibility *is* the magic; the whole category ships "recommended for you." Spotify proved explanations themselves lift engagement. Cheapest "it gets me" win. | ★★★★★ ◆◆◆◆ | N5 |
| **3** | **Anticipatory meal suggestions at the personal cook-decision window.** One opt-in daily nudge timed to when *this user* usually decides dinner, referencing *their* pattern ("Thursday — you usually do fish around now, here's a 20-min one"). | Companion, not tool. Most apps push at 6pm-for-everyone; timing to the *individual's* intent window + referencing their pattern reads as care, not marketing. | ★★★★☆ ◆◆◆◆ | X6, X7, retention |
| **4** | **Real-time context engine with Persian-calendar occasions.** Yalda / Nowruz / Ramadan + season + weather + time re-score live — *"a cold Yalda night, here's a warming ash."* | A unique, underexploited cultural lever a US-centric app cannot nail; festive context is high-delight and deeply legible. | ★★★★☆ ◆◆◆◆◆ | N6, X7 |
| **5** | **Taste embeddings from cook history (content-grounded, day-1).** The user vector as a direction in ingredient-feature space — "bright-acidic-herby lamb-forward." | The Porsche core. Garnish's ingredient-level data makes this work from interaction #1 while competitors wait for collaborative data. The actual moat. | ★★★☆☆ ◆◆◆◆◆ | X4 |
| **6** | **Two-track "aspire vs actually-cook" surfaces.** "Saved for someday" (dreams) vs "Your weeknight rotation" (revealed truth), named and modeled separately. | Solves the aspiration trap *and* names a pattern the user lives but never articulated. Nobody separates fantasy-cooking from real cooking. | ★★★★☆ ◆◆◆◆ | X8 |
| **7** | **Conversational preference capture grounded in the corpus.** The existing grounded assistant doubles as preference elicitation: "something light after the gym, I have chicken and spinach" → parsed to filters + a taste update — *the conversation teaches the model.* | LLM as *enhancer* (query understanding + taste-vector update), safe because grounded in verified content + the HARD allergy gate — not a hallucinating recipe author. | ★★★☆☆ ◆◆◆◆ | X4, existing assistant |
| **8** | **Monthly "your kitchen this month" reflection.** Aggregate the cook log into a beautiful, shareable recap ("lots of greens and quick dinners; you leveled up to confident"). | A "year-in-review"-style ritual creates anticipation, retention, and screenshot-sharing. Pure emotional payoff over data already owned. | ★★★★★ ◆◆◆ | N1 |
| **9** | **"Adventurous ↔ comfort" dial.** The user chooses how far to stretch tonight; the dial sets the explore fraction live. | Fixes filter-bubble *and* over-personalization in one control, and acknowledges that mood varies — a delightful "it gets me." | ★★★★☆ ◆◆◆ | X2 |
| **10** | **Cohort/region prior that visibly decays toward you.** New fish-region user sees seafood by default, then watches it *personalize away* as they skip — and the app *tells* them ("you're seeing fewer fish dishes — you've been skipping them"). | The principled, *visible* version of "use the prior, then learn the person." Making the decay legible is the tier-above move. | ★★★★☆ ◆◆◆◆ | X1 |
| **11** | **Reversible deflation with a "rescue" explore lane.** The 200 always-skipped dishes sink — but a small explore budget keeps re-testing them, so a wrongly-buried gem recovers if its small audience loves it. | TikTok's "keep re-testing" discipline, made explicit. Avoids the classic deflation trap (killing minority-loved niche dishes) by design. | ★★★★☆ ◆◆◆ | N4, X2 |
| **12** | **Intent-labeled rows as one-engine-many-objectives.** "Quick weeknight," "Use up your pantry," "Try something new" — each row is the *same* ranker with a different objective + explore setting. | Clean home-screen IA (SideChef's three-archetype routing) that surfaces exploit *and* explore without a wall-of-feed; cheap once the engine exists. | ★★★★★ ◆◆◆ | X2, X6 |

**The solo-founder picks (do these first among the 12):** #2, #8, #12 (highest feasibility, real differentiation, near-zero ML) → then #1, #4, #9 (the legibility+control+context trio that *is* the felt magic) → #5, #6, #10 once the taste vector and priors exist.

---

## The top 3 roadmap moves (if you do nothing else)

1. **Close the cook loop + hydrate the live profile (N1+N2).** Until cooking teaches the ranker and the profile reads real behavior, there is *no personalization* — only declared filtering with a heuristic re-sort. This makes the founder's own acceptance test true and is the precondition for everything else.
2. **Popularity deflation + cohort prior + Thompson explore slot (N4+X1+X2).** The collective-intelligence trio: it kills the 200 always-skipped dishes, makes cold-start feel cohort-aware on day one, and spins the flywheel that gathers the data to sharpen itself — the entire "collectively smart" feeling, delivered with arithmetic.
3. **"Because you…" recsplanations + context headline + tunable Taste-DNA (N5+N6+X7+idea #1).** The legibility-and-control layer that *converts accuracy into felt understanding* — the difference between a feed and a friend, and the antidote to creepiness. The category fails here, so it is instant differentiation.

---

**FILE:** `C:\dev\garnish-app\docs\audit\PERSONALIZATION_ROADMAP.md`
