# 💡 Ideas & Gaps — Garnish (the partner's 90%)

> **Mandate (founder, 2026-06-20):** I (and my agents) must NOT just execute the founder's seed (~10%). We
> must bring the other 90% — proactively propose world-class ideas, identify what's **missing or incomplete**
> vs the global state of the art / what investors want / what users want, bring **maturity**, and say
> plainly "X is important and you don't have it (or have it half-built)." This is a LIVING document; every
> research workflow must add to it. Each idea is staged + tagged by lens (👤 user · 💰 investor · 🏰 moat)
> and mapped to the rebuild layers (L0 done · L1 ranker · L2 AI · L2.5 lifecycle · L3 consumers).

---

## ⭐ The reframe that changes the pitch (read this first)
**Garnish's defensible asset is NOT the recipes — it's the TASTE GRAPH.** A proprietary, ingredient-level
food-intelligence layer (taste/texture/cookingBehavior/nutrition/allergen for 1008 ingredients + GRIS
food-science + per-user learned taste vectors) that compounds with every cook. Recipes are the content;
the graph is the moat. **Investors fund moats and flywheels, not cookbooks.** Everything below should make
that flywheel visible and defensible. The app is the data engine for "the taste intelligence of Persian
(then global) cuisine."

---

## Stage 1 — Differentiators that make $7 feel like $20 (build alongside L1/L2)

### 1. 🏰👤 Adaptive recipe rendering — "the recipe knows you" (GAP: we have the parts, not the product)
Most apps serve one static recipe to everyone. Garnish ALREADY has personalization (L0) + GRIS + the swap
engine — but the recipe page is still one-size-fits-all. **World-class = the recipe instance re-renders per
user:** servings auto-scaled, ingredients swapped for their pantry/allergens/diet, step granularity that
EXPANDS for a beginner and COLLAPSES for an expert, seasoning tuned to their taste-DNA. This is the single
highest-leverage use of everything we've built. **Gap: incomplete** (personalization exists; the recipe
doesn't consume it deeply). → L1/L2.

### 2. 👤🏰 Close the loop on the COOK RESULT (GAP: missing entirely)
Every recipe app ends at "here's the recipe." We end blind — we never learn if the dish turned out. **A
post-cook 1-tap "how did it go?" (photo + rating + optional "what went wrong")** is the missing feedback
loop that (a) feeds the WHY-inference/retention engine, (b) flags recipes that fail beginners so we FIX
them, (c) trains the during-cook AI assistant, (d) powers social proof. This converts Garnish from a
cookbook into a *learning system* — and it's the data that makes year-2 better than year-1. **Gap: missing.**
→ L0 capture + L2.5.

### 3. 👤💰 Cost & "use-what-you-have" intelligence (GAP: missing; PantryItem just added is the hook)
Premium users justify $7 when the app SAVES them money. With the ingredient data + the new PantryItem
table: **cost-per-serving, "what's in season & cheap now", "cook this — you already have 8/10 ingredients",
and waste-reduction (use the wilting herbs).** Users feel tangible value; investors see a clean wedge into
grocery/commerce/meal-kit. **Gap: missing.** → L3 + the ingredient/price data.

### 4. 👤🏰 Trust as a visible feature — food-science & safety (GAP: built internally, not surfaced)
We have GRIS food-safety temps + debunked-myth grounding — a trust asset almost no competitor (or generic
AI assistant) has. **Surface it:** "✓ verified food-safe", "no kitchen myths", "why this works" inline, and
let the AI assistant CITE it. This is the antidote to the #1 risk of AI cooking advice (confidently wrong)
and it reads as premium credibility. **Gap: incomplete** (internal, not user-facing-as-trust). → L2 + L3.

---

## Stage 2 — The flywheel & the moat (the investor story)

### 5. 🏰💰 The assistant as a GROWTH flywheel, not support (shapes how we build L2a)
The "never feel lost" assistant should not just answer — it should TEACH on the mastery ladder ("you've
nailed X 3×, ready for Y?"), and EVERY interaction is a taste/skill signal feeding L0. Help → learning →
retention → data → sharper personalization → better help. **Design L2a as a flywheel from day one**, not a
Q&A box. This directly attacks the utility-paradox (learn-it-and-leave). → L2a.

### 6. 💰🏰 Lightweight collective proof = network effects without a social network (GAP: engine exists, surface doesn't)
L1's deflation/cohort engine PRODUCES collective signal; expose it as discovery + proof: "people with your
taste also loved…", "trending in your region this week", "cooked 3× by people like you". Investors love
network effects; users love discovery. No heavy social features — just surface the collective intelligence
we're already computing. **Gap: incomplete** (the math will exist in L1; the surface won't). → L1 + L3.

### 7. 💰 The B2B / API optionality (GAP: never considered — flag for the investor narrative)
The taste graph + substitution engine + allergen/diet intelligence is licensable: grocery (smart carts),
meal-kit (personalization), health/insurers (diet adherence), CPG (new-product taste-fit). This is the
"investor magnet on OUR terms" — a second revenue story that doesn't dilute the consumer app. **Not to
build now — to instrument the data cleanly so it's POSSIBLE, and to put in the pitch.** → strategy.

---

## Stage 3 — Category-defining bets (research-then-decide)

### 8. 👤 Voice / hands-free during cooking (GAP: missing; hands are dirty mid-cook)
The real-time assistant + voice is a genuinely category-defining cooking UX that most apps fumble. Pairs
perfectly with L2a's during-cook help. Research feasibility/cost. → L2a.

### 9. 👤💰 Health journeys done safely (GAP: data exists, vertical doesn't)
Nutrition + allergen + diet data could power real, culturally-aware Persian-diet health journeys
(diabetic-friendly, heart-healthy) — where retention + willingness-to-pay are highest. Carefully (no medical
claims; the health-score stays internal). A serious premium + investor vertical, underserved for Persian food. → L2.5/L3.

### 10. 🏰 Localization depth AS the moat (GAP: partially there; deepen deliberately)
Persian-first done RIGHT — regional cuisines, cultural occasions (Yalda/Nowruz/Ramadan), local
ingredients/substitutions, dialect — is the wall against generic global apps. The occasion-aware real-time
context (next L0 step) is the first brick. "Own Persian food, then port the model." → L0 context + L1 priors.

---

## AI (L2) — elevated from the SOTA research (full detail in `AI_STANDARD.md`)

### 11. 🏰👤 The assistant's "apply" tap IS the missing observability — closes the ZERO-events gap
**Biggest find.** Today swaps/scales emit ZERO events (a known hole — the L1 ranker is starved of its best
signal). The research showed the right L2a design — the assistant ACTS via a closed tool allow-list that
renders native swap/scale **cards (Generative UI)** — and the user's **"apply" tap emits exactly the swap/
scale events we're currently losing.** So building the assistant correctly ALSO instruments the app and
feeds L1 its missing training data. One build closes two gaps. → L2a + L0 observability.

### 12. 🏰 Ground by IN-CONTEXT cached corpus + tool-calling, NOT vector RAG (decision)
At ~1,008 structured records, putting the corpus in-context (with prompt caching) beats vector RAG on
precision, latency, debuggability, and kills retrieval-miss hallucination. A real architectural decision,
not a default. → L2a.

### 13. 👤🏰 Allergy/safety stays DETERMINISTIC and OUTSIDE the LLM (non-negotiable)
Pre-injection + post-generation gate, fails closed; declared allergens never enter a prompt; **the LLM
explains, never enforces.** Consistent with the hard filter we've protected all along — the AI must never
become the safety authority. → L2a guardrail.

### 14. 💰🏰 L2b "which dish has a problem & WHY" = metric-tree + behavior×GRIS join (the edge)
L2b grounds on a **deterministic semantic layer (never raw text-to-SQL)**; ~200 params = an (insight-type ×
metric-family × entity) taxonomy, each a deterministic query the LLM only NARRATES. The unique edge: join
behavior to **GRIS food-science**, so "why is this dish failing" reaches recipe-content depth (e.g. "beginners
overcook step 4") no generic analytics tool can match. Supervised autonomy = propose-only → review queue
with diffs/blast-radius → policy-as-code floor (allergy fields read-only FOREVER) → canary. → L2b.

### 15. 🏰 Phase 0 = observability + cost honesty + a PERSIAN golden eval set (gates everything)
The no-rework AI path starts with observability + cost truth, and **every live-AI flip is gated by a
Persian golden eval set** — English benchmarks do NOT transfer for a Persian-first product. → L2 phase 0.

## How this document stays alive
- Every research workflow (AI SOTA, recsys, retention, …) MUST end with an "ideas + gaps vs world-class"
  contribution appended here — not just a standard doc.
- Each idea graduates: **proposed → researched → designed → in a layer's roadmap → built.**
- I will resurface the top unbuilt ideas at milestones so they're decided, not forgotten.
