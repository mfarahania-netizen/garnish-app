# Founder requirements for the personalization & recommendation system (2026-06-20)

> Captured verbatim from the founder + mapped to recsys mechanisms. These are FIRST-CLASS pillars of
> the standard — the system must demonstrably deliver each. The founder grades hard and named
> TikTok / Instagram / Spotify as the reference bar (not generic "personalization").

## The vision, in the founder's words
- "هر کاربر متفاوت" — one user loves regional/local dishes, another world cuisines, another southern,
  another seafood, another hates all of these. With **1,000,000 users the app must differ for each**.
- "تأثیر جمعی" — of ~700 dishes, if **~200 are repeatedly skipped/rejected by everyone**, those should
  be **shown less** (collective signal deflates them).
- "تأثیر منطقه‌ای" — e.g. **a region prefers fish more** → that should influence what its users see.
- "و خیلی موارد دیگر" — and the many other mechanisms of TikTok / Instagram / Spotify that we must
  research and adopt, not guess.

## Mapping to recsys mechanisms (must appear in the standard + roadmap)
| Founder requirement | Mechanism | Notes / trap to avoid |
|---|---|---|
| 1M users, each different | **Collaborative filtering + user/item embeddings** (two-tower retrieval) + per-user model | We have NO collaborative signal today → every user is cold forever. This is pillar #1. |
| 200 dishes everyone skips → show less | **Population engagement prior + popularity DEFLATION** (Bayesian/Wilson accept-vs-skip), global negative-rate downranking | TRAP: don't kill a niche dish that a minority loves. Deflate globally, but protect items with a strong positive sub-cohort. |
| Region prefers fish | **Cohort / regional / geo prior** via hierarchical shrinkage (user → cohort → region → global) | Borrow the region's taste as a prior when the user is sparse; decay toward the individual as their signal grows. |
| "Reads my mind" feel | **Context engine** (time/season/pantry/last meals/occasion) + **learned taste embedding** + **transparent tunable taste-DNA** + **proactive suggestions** | The felt magic = context + explanation + control, not just better math. |
| Cold-start (new user/dish) | **Bandits (Thompson/LinUCB)** + onboarding taste capture + cohort defaults | Explore intelligently instead of a static cold rank. |
| Don't repeat / fatigue | **Negative feedback + recency/fatigue penalties** ("already cooked", skip, dismiss) | TikTok-style "not interested" + don't re-surface the same dish. |
| Scale | **Two-stage funnel** (cheap retrieval over the whole catalog → expensive ranking on a few hundred) | Required once the catalog + users grow. |

## THE DIRECTIVE (2026-06-20, overrides any rules-based design): a LEARNING engine, not filters
The founder explicitly rejects rules / "100 lines of filter code". The target is a **self-improving
learning engine** — "a Swiss-watch / Porsche engine" — that (a) **learns** rather than being hand-tuned,
(b) **improves itself** continuously, (c) reacts **precisely every second to context** (holiday,
occasion, summer/winter, morning/evening, …), and (d) **exploits our extraordinarily rich content data
to the last atom** ("حیف نیست از ذره‌ذرهٔ این اطلاعات استفاده نکنیم"). Context is described as "a tiny
percent" of the vision.

### The strategic unlock (why a learning engine is possible at LOW scale here)
Deep collaborative engines (TikTok/Spotify) need billions of interactions — which a launch app lacks.
BUT Garnish has what almost no recipe app has: **ingredient-level content data** (per-ingredient taste,
texture, cookingBehavior, nutrition, role, allergens; per-recipe GRIS food-science). **Content-grounded
learned embeddings personalize from interaction #1 — no collaborative data required.** So the rich
ingredient data IS the moat that lets us have a *learning* engine before we have a billion users.

### Reference architecture (must be the centerpiece of the standard)
1. **Learned taste embedding (the Porsche core).** Every recipe → a content embedding built from its
   ingredients' feature vectors (taste/texture/nutrition/role) + cuisine/technique/cost/effort. Every
   user → a taste vector in the SAME space, learned from cook/love/skip. "You like bright-acidic-herby
   lamb-forward dishes" becomes a literal direction. Works from day 1; far finer than category profiles.
2. **Collaborative layer (auto-activates as data grows).** Two-tower / MF learns latent user+item
   factors → "users like you". Layers on content; degrades gracefully to content+cohort when sparse.
3. **Real-time context engine ("every second").** A context vector (time-of-day, day, season, weather,
   holiday/occasion e.g. Yalda/Nowruz/Ramadan, last-week's meals, pantry, household) re-scores in real
   time — the same dish ranks differently at 8am vs 7pm, summer vs winter.
4. **Self-improving online loop.** Log every (recommendation → outcome) → continuously retrain embeddings
   + ranker → measure itself (online metrics) → improve daily. Bandits keep it exploring, not just
   exploiting. This is "خودش خودش رو بهبود بده".
5. **Transparent, tunable taste-DNA (human-in-the-loop).** The user sees + edits their taste vector;
   edits are training signal. Builds the "it gets me" trust AND improves the model.

### Honest sequencing (partner truth, not hype)
Content-first learned engine ships first (works at launch because our content is world-class) →
collaborative + deeper models turn on automatically as interaction data accumulates. Not a compromise —
it is the correct order, and the reason we can "learn" while competitors wait for data. This is a
multi-phase CORE rebuild of the heuristic ranker, not a patch.

## PILLAR: Lifecycle & Retention Intelligence — never abandon the user (founder, 2026-06-20)
The founder's deepest requirement: **LTV/retention, not acquisition.** The user must feel — every moment,
including year 2 and year 3 — "what a great feeling that I bought this subscription." We must detect and
pre-empt EVERY cause of churn, resentment, or quiet departure.

### The "WHY" inference engine (behavioral diagnosis)
It is not enough to log what the user did; we must infer WHY. The founder's canonical example: a user
cooked a dish 3× from our recipe, then it was in their weekly plan the 4th time but they did NOT cook it.
The system must diagnose the latent cause and respond:
- **Mastered it** (knows the recipe now → it became routine) → graduate them: offer a variation, a harder
  dish, or stop re-teaching and start assuming competence.
- **Bored / changed their mind / tired of the dish** → diversify; pull back that dish/cuisine.
- **External** (busy week, skipped cooking entirely) → gentle, low-pressure nudge, not a guilt trip.
- **Dissatisfied** (a bad result) → recovery + troubleshooting, ask what went wrong.
Each diagnosis → a DIFFERENT intervention. Wrong diagnosis = annoyance = churn. Start heuristic on the
signal stream (L0), evolve to a learned diagnosis/survival model.

### The recipe-app UTILITY PARADOX (the founder's "learned it and left" problem)
If we only "teach a recipe," then teaching it well = the user no longer needs us = churn. The world-class
answer is **value EVOLUTION**: the app's job must shift over time from "teach you this dish" → "your
evolving culinary partner that knows you better every year." The value must COMPOUND, not deplete:
mastery ladder (harder dishes, technique progression) · variations of mastered dishes · adjacent
discovery tuned to the taste-DNA · planning/shopping/pantry convenience · seasonal novelty · the taste
model that is sharper in year 2 than year 1 (the data moat). The subscription is worth keeping because
the app is the only one that has learned THIS user.

### Lifecycle states + countermeasures (must exist for every section, not just recsys)
A lifecycle engine over L0: state machine (onboarding → activated → habitual → mastering → at-risk →
dormant → churned/win-back), churn LEAD-indicators (declining cook rate, plan-but-skip, session
shortening, dwell drop), and a per-state intervention playbook delivered via the proactive layer (L3).
Ethical guardrail (founder intent: the user must feel GOOD, never nagged): no dark patterns, no
notification fatigue — interventions earn their place by being genuinely useful, frequency-capped, and
killable. "Never abandon the user in any section" = every surface has a re-engagement/recovery path.

Acceptance: we can answer "why didn't user X cook the planned dish?" and "which users will churn next
month, and what's the right intervention for each?" — and the intervention demonstrably feels like care,
not nagging.

## Acceptance test (how we'll know it works)
- Cook 10 Persian stews → tomorrow's feed is verifiably more stew-like (individual loop closes).
- A dish skipped by ~everyone drifts down the catalog for everyone (collective loop closes) — but a
  minority-loved dish survives for that minority.
- A fish-leaning region's new users see more seafood by default, then personalize away from it.
- The user can SEE why ("because you cooked X / you're in region Y / it's a cold autumn night") and tune it.
