# Mind-Reading UX: How to Make a User Feel Deeply Understood by a Food-Personalization System

**Purpose.** A reference for building the feeling of *"it reads my mind, it became one with me"* in Garnish — a recipe app. This is a UX/HCI document, not an ML document. The thesis: the *feeling* of being understood is produced far more by **interaction design, copy, timing, and restraint** than by model accuracy. A mediocre model wrapped in great "it gets me" UX beats a great model wrapped in a generic feed.

**Audience constraint baked into every recommendation below:** solo founder, EU launch, small data, no analytics team, no A/B infra at scale. Ideas are ranked by **ROI at small scale**, and there is an explicit "does NOT help us yet" section so we don't cargo-cult Spotify/Netflix.

---

## 0. The core insight (read this first)

The "it gets me" feeling is an **emotional attribution**, not a precision metric. Users feel understood when:

1. The system **reflects something true back at them** that they recognize but didn't have to state ("you cook fast on weeknights, slow on Sundays").
2. The system **acts at the right moment** (a dinner idea at 5pm, not 11am).
3. The system **stays legible** — they can see *why* and *change it* ("Because you saved 3 one-pan dinners").
4. The system **surprises them inside their comfort zone** — novel but plausibly-them (Spotify's Discover Weekly is the canonical example: a playlist that "feels made just for you" enough that people screenshot and share it). ([Spotify Newsroom](https://newsroom.spotify.com/2025-06-30/discover-weekly-turns-10-celebrating-100-billion-tracks-streamed-and-a-decade-of-personalized-discovery/))

Crucially, accuracy alone can *backfire*: TikTok users report being "startled" by how accurately the For You Page captured them with no explicit input — the same accuracy that delights also tips into **creepiness** ([ResearchGate: TikTok engagement](https://www.researchgate.net/publication/382423048); [CustomerThink: the creepy line](https://customerthink.com/the-hyper-personalization-paradox-being-relevant-without-crossing-the-creepy-line/)). The art is **relevance without surveillance vibes**. Transparency + control is the dial that converts "creepy" into "wow, it gets me."

---

## 1. Cold-start: taste capture that feels effortless

The cold-start cliff is the #1 churn risk: a new user with an empty profile gets generic recs, feels nothing, leaves. The goal of onboarding is **the minimum input that produces a first "whoa, that's me" moment** — not a complete taste model.

### Principles
- **Choice beats rating.** Research consistently finds that *choice-based* preference elicitation — show diverse options, let the user pick, iteratively narrow — requires less effort and yields more satisfying recs than asking users to rate items (Graus & Willemsen; [ResearchGate](https://www.researchgate.net/publication/282604380)). People are bad at rating from memory and will enter noise to finish fast.
- **Elicit on *attributes*, not just items.** Asking about attributes ("spicy? quick? vegetarian? batch-cook?") generalizes faster than asking about specific recipes, and pairwise item choices ("this dinner or that one?") are more informative than single-item ratings ([arXiv 2510.27342](https://arxiv.org/pdf/2510.27342)).
- **Active learning = ask only the informative question.** Don't ask 20 questions; ask the 4–6 that most reduce uncertainty about *this* user ([arXiv 2309.00356](https://arxiv.org/pdf/2309.00356)). Each answer should visibly *branch* the next question so it feels like a conversation, not a form.
- **Skip must always be allowed**, and skipping should still leave them better off (fall back to popular-in-their-region). Mandatory long onboarding causes drop-off and noisy data.
- **Show the payoff immediately.** End onboarding by rendering a real, populated "Made for you" screen — *not* a "thanks, we'll learn over time" dead-end. The first screen must already feel personalized or the cold-start promise is broken.

### Concrete patterns for Garnish
- **The 5-tap taste card stack.** A swipe/tap deck of 8–12 dish photos ("would you cook this?"). Visual, fast, dopamine-light. Behind it, each card carries hidden attribute tags (cuisine, effort, spice, protein, diet) so 6 taps seed a usable attribute vector. This is the single highest-ROI onboarding mechanic.
- **One constraint question that *matters*, asked first:** allergies / hard dietary lines. Garnish already runs a HARD allergy gate — surface it in onboarding as *"so we never show you X"*. This is the most trust-building question you can ask because the user immediately sees the system protecting them, not profiling them.
- **Household + skill, one screen.** "Cooking for how many?" and "comfortable in the kitchen? (beginner → confident)". Two taps, huge downstream value for portioning and step-detail (Garnish already has beginner-grade steps).
- **A single free-text wish** (optional): "What did you wish you cooked more of?" Cheap, occasionally gold, and it makes the user feel *heard* even if you barely parse it.

> ROI note: do the taste-card stack + allergy gate + household/skill. Skip elaborate questionnaires. Effort spent on a 3-screen onboarding outperforms effort spent on the model for the first month of a user's life.

---

## 2. Blending implicit + explicit feedback

Explicit signals (ratings, saves, "not for me") are **sparse but trustworthy**. Implicit signals (what they open, cook, re-open, skip, dwell on) are **abundant but ambiguous**. The "it gets me" feeling comes from fusing both so the user never has to repeat themselves.

### Principles
- **Implicit is the engine, explicit is the steering.** TikTok's whole "how does it know?" magic is implicit: completion rate, rewatch, fast-skip, dwell — no stars required ([InfluencerMarketingHub](https://influencermarketinghub.com/tiktok-algorithm/)). For a recipe app the implicit gold is: **opened → saved → actually cooked → cooked again**. "Cooked again" is your rewatch; it's the strongest signal you have and most apps ignore it.
- **Weight by commitment.** A *cook-complete* >> a *save* >> an *open* >> a *dwell*. Garnish already logs `cook_complete` for gamification — reuse it as the top-weight preference signal. Saves are aspirational (what they *wish* they were); cooks are revealed truth. Keep them in separate buckets; recommending only saved-style food can trap a user in "fantasy cooking" they never actually make.
- **Make explicit feedback feel consequential.** When a user taps "not for me," *immediately* visibly change the feed ("Got it — fewer slow braises") and let them undo. A thumbs-down that seems to do nothing teaches users the controls are fake (a top complaint in recsys research: systems that never explain or react — [Jannach, Explanations and User Control](https://web-ainf.aau.at/pub/jannach/files/BOOK_CHAPTER_PERSONALIZED_HCI_2019.pdf)).
- **Negative implicit signals are real signals.** A recipe shown 4 times and never opened = soft no. A long dwell with no save = "interested but not now." Use these to demote, not just to promote.

### Concrete patterns for Garnish
- **A lightweight post-cook check-in** ("How'd it go? 🔥 / 👍 / 😐"). One tap, fires right after `cook_complete` when affection is highest. This single explicit signal, fused with the implicit cook event, is worth more than a star-rating system.
- **"More like this / less like this" on every card**, with an instant visible feed reaction. Cheap to build, enormous trust payoff.
- **Two-track taste model:** an *"aspire" vector* (saves, long dwells) and a *"actually cook" vector* (completed cooks). Surface them differently — "Saved for someday" vs "Your weeknight rotation." Naming the difference back to the user is itself an "it gets me" moment.

---

## 3. Context-awareness (the biggest source of "uncanny" understanding)

Context is the cheapest path to feeling understood because it requires **almost no model** — it's mostly rules over the current situation. A correct context cue ("rainy Tuesday → here's a 20-minute soup") reads as mind-reading even with a dumb recommender underneath. Mood- and context-aware systems are a well-established literature ([Survey of Affective Recommender Systems, arXiv 2508.20289](https://arxiv.org/pdf/2508.20289); [Context-Aware Recommender Systems, ResearchGate](https://www.researchgate.net/publication/220605653)).

### The context dimensions, ranked by ROW (Return-On-Work) for Garnish

| Context | Signal source | Effort | "It gets me" payoff | Verdict |
|---|---|---|---|---|
| **Time of day** | device clock | trivial | high (breakfast vs dinner framing) | **DO NOW** |
| **Day of week** | device clock | trivial | high (weeknight-fast vs weekend-project) | **DO NOW** |
| **Season** | date + EU locale | trivial | high (asparagus in spring, stew in winter) | **DO NOW** |
| **"What you cooked this week"** | your own cook log | low | very high (avoids repeats, builds a "rotation") | **DO NOW** |
| **Pantry / what's on hand** | optional user input | medium | very high (waste-reduction = emotionally loved) | **PHASE 2** |
| **Weather** | free weather API by region | low-medium | medium-high (comfort food on cold days) | **PHASE 2** |
| **Occasion** | explicit toggle ("guests coming?") | low | high but user-initiated | **DO (as a toggle)** |
| **Household** | onboarding | trivial | high (portions, kid-friendly) | **DO NOW** |
| **Mood** | hard to infer; ask, don't guess | medium | high if asked, creepy if inferred | **ASK, don't infer** |

### Principles
- **Time/season/your-own-history are free and powerful.** "What you cooked this week" uses data you already own (the cook log) and prevents the most common dissatisfaction (recommending the thing they made on Monday). It also lets you *say* something true: *"You've leaned veggie this week — want to keep it going or break it up?"*
- **Weather and time work via *framing* more than filtering.** You don't need a different recipe set for rain; you need a different *headline* ("Cozy 30-min dinners for a grey evening"). Framing is a copy task, not an ML task — extremely high ROI for a solo founder.
- **Mood: ask, never infer.** Inferring mood from behavior is the creepiness fast-track. A *user-initiated* mood/occasion picker ("Tonight I want: comfort / light / impressive / fast") feels like control, not surveillance. The literature distinguishes short-lived emotion from prolonged mood; you can model the latter loosely from cooking patterns, but **expose it as an offer, not a verdict**.
- **EU-specific win:** seasonality + local produce maps beautifully to EU markets and sustainability values, and it's culturally legible. This is a differentiator a US-centric app won't nail.

### Concrete pattern for Garnish: the contextual home headline
One dynamic strip at the top of the home screen that composes: `[time] + [day] + [season] + [their recent pattern]` into a single human sentence and a matching shelf. E.g.:
> *"Wednesday, 5:40pm — you've cooked twice this week, both quick. Here are three 25-minute dinners using what's in season."*

That one sentence does more for "it gets me" than a re-ranked feed, and it's mostly templating over data you already have.

---

## 4. Proactive / anticipatory suggestions

Anticipation is the difference between a tool you open and a companion that *thinks of you*. But it's also where annoyance and creepiness live, so the bar is high.

### Principles
- **A notification succeeds when it lands near a moment of *intent*, not at a global engagement peak.** The strongest finding in push research: deliver at the user's personal "deciding what to cook" window, learned from when *they* open the app, not at 6pm-for-everyone ([Pushwoosh](https://www.pushwoosh.com/blog/push-notification-best-practices/); [ContextSDK](https://contextsdk.com/blogposts/the-psychology-behind-successful-push-notifications-timing-personalization-context)).
- **Frequency is a trust budget.** ~46% of users opt out after 2–5 irrelevant messages in a week ([Pushwoosh](https://www.pushwoosh.com/blog/push-notification-best-practices/)). For a recipe app, **1 well-timed nudge/day max, ideally fewer.** Under-notify and earn the right to notify.
- **Anticipation must be *useful*, not just present.** "Dinner idea?" is noise. "It's Thursday — you usually cook fish around now, here's a 20-min one" is anticipation. The proactive suggestion should reference *their* pattern so it reads as care, not marketing.
- **Let the user set the rhythm.** "When should I check in?" (never / weekly meal-plan / daily dinner nudge) turns the most annoying feature into a chosen one.

### Concrete patterns for Garnish (ranked)
1. **One daily "what's for dinner?" nudge** at the user's personal cook-decision window, off by default, opt-in during onboarding. (Highest ROI proactive feature.)
2. **A weekly "your week in food + next week's plan" digest** — Discover-Weekly-style ritual. Rituals create anticipation and are screenshot-shareable. A weekly cadence is forgiving of a weak model (you only need ~5 good ideas/week, not a perfect infinite feed).
3. **"You're about to repeat Monday's dinner"** gentle inline note (not a push) — uses the cook log, feels like a friend who remembers.
4. **Seasonal kickoff** ("Asparagus is in season — 5 ideas") a few times a year. Low frequency, high delight, EU-relevant.

> Honesty: proactive push is **only worth building after retention exists**. A daily nudge to a user who hasn't formed a habit just trains them to disable notifications. Sequence it after the home-screen contextual experience is landing.

---

## 5. Transparency + control (the trust multiplier)

This is the lever that converts accuracy into *felt* understanding and protects against creepiness. The research is nuanced but actionable.

### What the research actually says
- **Transparency reliably increases satisfaction, confidence, and *acceptance* of recommendations** — even where its effect on raw "trust" is mixed ([Jannach et al.](https://web-ainf.aau.at/pub/jannach/files/BOOK_CHAPTER_PERSONALIZED_HCI_2019.pdf)). "Because you…" explanations make users *act* on recs more.
- **Most systems fail users here.** Users widely report systems "never explain" or give generic "Recommended for you" labels ([CHI 2026: Rethinking User Empowerment](https://dl.acm.org/doi/full/10.1145/3772318.3791914)). The bar is low; clearing it is a differentiator.
- **Control increases trust *and* engagement** by lowering the perceived risk of handing over data — it's central to the user's "privacy calculus" ([Human Aspects of Privacy, arXiv 1805.08280](https://arxiv.org/pdf/1805.08280)).
- **But don't over-explain.** Full transparency *hurts* usage — cognitive overload. The skill is "enough to build trust without overload" ([Jannach](https://web-ainf.aau.at/pub/jannach/files/BOOK_CHAPTER_PERSONALIZED_HCI_2019.pdf)). One honest reason per rec beats a model dump.

### Why control specifically makes people feel understood
Control reframes the relationship from *being profiled* to *collaborating*. When a user can tune "more quick / less spicy" and watch it take effect, the system stops being a black box doing things *to* them and becomes an instrument they play. That sense of agency is a large part of "it became one with me" — they co-authored it.

### Concrete patterns for Garnish
- **"Because you…" on every shelf and card.** *"Because you saved 3 one-pan dinners,"* *"Because it's cold and you like soups."* One short, true reason. This is cheap (you know the rule that fired) and is the single highest-trust-per-pixel feature in this whole document.
- **A visible, tunable taste panel.** Sliders/chips for the dimensions you model: spice, effort, adventurousness, cuisines, diets. Changes apply live. Don't hide personalization in settings — make tuning a *feature*, like Spotify's genre customization on Discover Weekly ([Spotify Newsroom](https://newsroom.spotify.com/2019-05-02/five-ways-to-make-your-discover-weekly-playlists-even-more-personalized/)).
- **"Why am I seeing this?" → "Show me less of this."** A one-tap path from explanation to control on any recommendation.
- **An "adventurous ↔ comfort" dial.** Let the user *choose* how far you stretch them. This single control simultaneously fixes filter-bubble worry (they can ask for novelty) and over-personalization (they can ask for safety) — and it's a delightful "it gets me" moment because it acknowledges that mood varies.
- **Data honesty card** (EU/GDPR is a gift here): "Here's what Garnish knows about your taste" — viewable, editable, deletable. In the EU this is partly mandatory; presenting it *well* turns a compliance cost into a trust asset and directly defuses creepiness.

---

## 6. Adaptive speed (how fast to change the model)

How quickly the system updates after a signal shapes whether it feels *responsive* (good) or *flighty / stalkerish* (bad).

### Principles
- **Two clocks.** A *fast clock* for context/session (reacts within the session: tap "quick tonight" → feed changes now) and a *slow clock* for the durable taste profile (moves over weeks). TikTok feels instant because the session clock is fast; your *durable* taste model should move slowly so one weird Tuesday doesn't redefine you.
- **Over-fast adaptation reads as creepy and unstable.** If one viewed recipe instantly floods the feed with that cuisine, users feel watched and the feed feels broken. Dampen single-signal swings.
- **Make adaptation *visible but gentle*.** "We noticed you've been cooking lighter — adjusted your feed. Undo?" Visible adaptation = "it's listening." Undo = "I'm still in charge."
- **Decay old preferences.** Tastes drift; last month's obsession shouldn't dominate forever. Time-aware preference modeling is a real area ([Time-Aware Music RecSys, arXiv 2008.11432](https://arxiv.org/pdf/2008.11432)). A simple recency weighting is enough at our scale.

### Verdict for Garnish
- Fast session-level context switching: **DO** (cheap, high delight).
- Slow, decaying durable taste vector: **DO** (a few lines of weighting).
- Real-time per-tap re-ranking like TikTok: **DON'T** — over-engineered for a recipe app and risks creepiness. Recipe decisions are deliberate and low-frequency; weekly/daily rhythms fit the domain better than millisecond reactivity.

---

## 7. The emotional / affective design of "it gets me"

Same data, two products: one feels like a database, one feels like a friend. The difference is voice, naming, and a few human touches.

### Principles
- **Name things back to the user.** "Your weeknight rotation," "Sunday projects," "Saved for someday," "Your comfort shelf." Naming a pattern the user lives but never articulated is the purest "it gets me" hit. (Spotify: "Made for You," "Daily Mix," "On Repeat" — the *names* do emotional work the algorithm can't.)
- **Reflect, don't just serve.** Periodic gentle mirrors: *"You've gotten more confident — your recipes have leveled up,"* *"This month: lots of greens and quick dinners."* People love a true reflection of themselves (the genre of "your year in review" recaps exists because of this).
- **Voice = a knowledgeable friend, not a butler or a marketer.** Warm, brief, specific, occasionally playful. Avoid hype ("AMAZING picks!!") — it reads as marketing and breaks intimacy.
- **Surprise inside the comfort zone.** The Discover Weekly magic: mostly *you*, with one or two delightful stretches. A feed that's 100% safe is boring; 100% novel is alienating. Aim ~80/20.
- **Ownership cues.** A personal touch — their name, an evolving "taste portrait," a small custom visual — increases the sense of ownership and sharing (the mechanism behind Spotify's screenshot-and-share behavior — [Raw.Studio](https://raw.studio/blog/my-spotify-everything-you-need-to-know-about-spotifys-latest-personalization-feature/)).

### Concrete patterns for Garnish
- **A "Taste Portrait" screen** (Garnish already has a Food DNA / `/profile/dna` surface — lean into it hard). Make it beautiful, shareable, and *editable*. This is the emotional centerpiece: it makes the model *visible as a portrait of the user*, which is the literal embodiment of "it became one with me."
- **Monthly "your kitchen this month" reflection** — low effort (aggregate the cook log), high emotional payoff, shareable, retention-driving.
- **Earned-confidence copy** tied to your existing skill model and gamification: as the user completes more cooks, the voice acknowledges their growth.

---

## 8. Failure modes (and how to avoid each)

| Failure mode | What it feels like | Cause | Mitigation for Garnish |
|---|---|---|---|
| **Cold-start cliff** | "This is generic, why bother" | empty profile → generic recs → churn before the model learns | §1 effortless onboarding + a *populated* first screen + region-popular fallback. **The #1 risk to fix.** |
| **Creepiness** | "How does it know that? Ick." | accuracy without transparency; inferred-mood; data shown that feels surveilled ([CustomerThink](https://customerthink.com/the-hyper-personalization-paradox-being-relevant-without-crossing-the-creepy-line/); [Tandfonline 2026](https://www.tandfonline.com/doi/full/10.1080/10447318.2026.2664686)) | "Because you…" reasons; *ask* mood don't infer; visible/editable data; never reference data the user didn't knowingly give. |
| **Filter bubble / boredom** | "It only ever shows me the same 5 things" | over-exploitation, no exploration ([CIRS, arXiv 2204.01266](https://arxiv.org/pdf/2204.01266)) | the adventurous↔comfort dial; planned ~20% exploration; "break me out of my rut" button; seasonal injects. |
| **Over-personalization** | "It boxed me in / assumes too much" | one strong signal overweighted; no room for mood changes | two-clock adaptivity (§6); decay; let context override profile ("tonight I want different"). |
| **Fake control** | "I tapped 'less of this' and nothing changed" | controls with no visible effect → users learn the UI lies ([Jannach](https://web-ainf.aau.at/pub/jannach/files/BOOK_CHAPTER_PERSONALIZED_HCI_2019.pdf)) | every control produces an *immediate, visible* feed change + undo. |
| **Notification fatigue** | opt-out, then never return | too many / mistimed / irrelevant pushes ([Pushwoosh](https://www.pushwoosh.com/blog/push-notification-best-practices/)) | ≤1 nudge/day, opt-in, personal-window timing, reference their pattern. |
| **Aspiration trap** | recs they save but never cook | training only on saves, not cooks | two-track model (§2): weight *cook-complete* over save. |
| **Privacy-personalization paradox** | users want relevance but resist data collection ([ResearchGate](https://www.researchgate.net/publication/220259839)) | asking for data without showing value or control | ask least; show payoff immediately; GDPR transparency as a feature, not a footer. |

---

## 9. ROI-ranked roadmap for a solo founder (EU launch)

**Tier 1 — do first (highest "it gets me" per unit of work, mostly templating/copy/rules over data you already own):**
1. **"Because you…" reasons** on every recommendation. *(trust multiplier, near-zero ML)*
2. **Contextual home headline** = time + day + season + your-recent-cooks, with matching shelf. *(uses your cook log)*
3. **Effortless onboarding**: taste-card stack + allergy gate + household/skill, ending on a *populated* screen.
4. **Named shelves** ("Weeknight rotation," "Saved for someday," "Comfort shelf").
5. **Cook-completion check-in** (1-tap) feeding a two-track (cook vs aspire) taste model.
6. **"More/less like this"** with immediate visible feed reaction + undo.

**Tier 2 — do once retention exists:**
7. **Adventurous↔comfort dial** + tunable taste panel.
8. **Taste Portrait / Food DNA** screen made beautiful, editable, shareable.
9. **Weekly "your week + next week" digest** (Discover-Weekly ritual).
10. **Seasonal/EU-produce injects.**
11. **Monthly reflection** ("your kitchen this month").

**Tier 3 — later / only with scale:**
12. One personally-timed daily dinner nudge (opt-in).
13. Pantry/what's-on-hand input.
14. Weather API context.

### What does NOT help us at small scale (resist the cargo cult)
- **Per-user artwork/thumbnail personalization (Netflix-style).** Netflix custom-ranks thumbnails per user across millions of viewers via relentless A/B testing at 20M req/s ([Netflix TechBlog](https://netflixtechblog.com/artwork-personalization-c589f074ad76)). With one founder and thin traffic you have **no statistical power** to A/B image variants, and the build cost is enormous. *Skip.*
- **Real-time per-tap re-ranking (TikTok-style).** Wrong domain rhythm (cooking is deliberate, ~daily, not infinite-scroll) and high creepiness risk. *Skip.*
- **Heavy deep-learning collaborative filtering before you have users.** Cold-start dominates early; CF needs interaction density you won't have. Rules + content-based + context will outperform a fancy model on a sparse graph. Offline benchmark wins (MovieLens-style) famously don't translate to felt user value ([arXiv 2307.09985](https://arxiv.org/pdf/2307.09985); [human-centric eval, arXiv 2401.11632](https://arxiv.org/pdf/2401.11632)). *Defer.*
- **Inferred mood/emotion detection.** High creepiness, low accuracy at your data scale. *Ask instead.*
- **High-frequency push.** Burns the trust budget before a habit forms. *Wait.*
- **Elaborate multi-screen questionnaires.** Cause drop-off and noisy data. *Keep onboarding ≤3 light screens.*

---

## 10. One-paragraph design creed for Garnish

> Garnish should feel like a friend who cooks with you — one who remembers what you made this week, knows it's a cold Wednesday and you're tired, names your patterns back to you ("your weeknight rotation"), always tells you *why* it's suggesting something, lets you nudge it in one tap and watch it listen, asks rather than assumes your mood, stretches you just enough, and never makes you feel watched. The feeling of "it reads my mind" is not built from a bigger model — it's built from **truthful reflection, right-moment timing, honest reasons, real control, and restraint.** At our scale, those are mostly copy, rules, and timing over data we already own — which is exactly why a solo founder can win here.

---

## Sources
- Spotify Discover Weekly (10-year retrospective, "made just for you," social sharing): https://newsroom.spotify.com/2025-06-30/discover-weekly-turns-10-celebrating-100-billion-tracks-streamed-and-a-decade-of-personalized-discovery/
- Spotify — making Discover Weekly more personalized / genre customization: https://newsroom.spotify.com/2019-05-02/five-ways-to-make-your-discover-weekly-playlists-even-more-personalized/
- Spotify "My Spotify" ownership & sharing (Raw.Studio): https://raw.studio/blog/my-spotify-everything-you-need-to-know-about-spotifys-latest-personalization-feature/
- Netflix — Artwork Personalization (TechBlog): https://netflixtechblog.com/artwork-personalization-c589f074ad76
- TikTok algorithm / implicit signals (InfluencerMarketingHub): https://influencermarketinghub.com/tiktok-algorithm/
- Understanding TikTok recommendation & engagement (ResearchGate): https://www.researchgate.net/publication/382423048
- Choice-based preference elicitation in cold start (Graus & Willemsen): https://www.researchgate.net/publication/282604380
- Pairwise / attribute-aware preference elicitation (arXiv): https://arxiv.org/pdf/2510.27342
- Explainable active learning for preference elicitation (arXiv): https://arxiv.org/pdf/2309.00356
- Context-Aware Recommender Systems (Adomavicius & Tuzhilin, ResearchGate): https://www.researchgate.net/publication/220605653
- Survey of Affective Recommender Systems — attitudes, emotions, moods (arXiv): https://arxiv.org/pdf/2508.20289
- Time-Aware Music Recommender Systems (arXiv): https://arxiv.org/pdf/2008.11432
- Jannach et al. — Explanations and User Control in Recommender Systems: https://web-ainf.aau.at/pub/jannach/files/BOOK_CHAPTER_PERSONALIZED_HCI_2019.pdf
- CHI 2026 — Rethinking User Empowerment in AI Recommender Systems: https://dl.acm.org/doi/full/10.1145/3772318.3791914
- Human Aspects and Perception of Privacy in Personalization (arXiv): https://arxiv.org/pdf/1805.08280
- The Personalization-Privacy Paradox (ResearchGate): https://www.researchgate.net/publication/220259839
- The Hyper-Personalization Paradox / "creepy line" (CustomerThink): https://customerthink.com/the-hyper-personalization-paradox-being-relevant-without-crossing-the-creepy-line/
- Perceived Surveillance, Creepiness & Chilling Behaviors (Taylor & Francis, 2026): https://www.tandfonline.com/doi/full/10.1080/10447318.2026.2664686
- CIRS — Bursting Filter Bubbles via Counterfactual Interactive RecSys (arXiv): https://arxiv.org/pdf/2204.01266
- Push notification best practices / opt-out thresholds (Pushwoosh): https://www.pushwoosh.com/blog/push-notification-best-practices/
- Psychology of push timing & context (ContextSDK): https://contextsdk.com/blogposts/the-psychology-behind-successful-push-notifications-timing-personalization-context
- Offline benchmarks don't equal user value (arXiv): https://arxiv.org/pdf/2307.09985
- Human-centric evaluation of DL movie recommenders (arXiv): https://arxiv.org/pdf/2401.11632
