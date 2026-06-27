# Garnish AI Assistant — TARGET DESIGN (the end-state, designed first)

> Founder mandate (2026-06-27): *design the destination FIRST, then build* — don't build for two weeks and pivot.
> And: **don't compete with free ChatGPT on commodity cooking Q&A** (it's faster/cheaper/broader and burns OUR
> tokens for no moat). Build only what a generic chatbot **structurally cannot** do.
> This doc is the locked target. Build order + monetization + safety are evidence-backed by the 2026-06-27 deep
> research (104 agents, 22 sources, 19/25 claims confirmed adversarially; cited below).

## 1. IDENTITY (one line)
A **health / nutrition / cooking COMPANION that knows YOU, ACTS on your kitchen·plan·profile, and keeps you
SAFE + on-goal** — the app-integrated things ChatGPT can't do. NOT a general cooking-Q&A bot.

## 2. THE MOAT — what ChatGPT structurally CANNOT do (so this is where we invest)
1. **Knows-me (persistent user model):** allergies, dislikes, diet, skill, goals, and *cooking history* — across
   sessions. ChatGPT starts from zero every chat. → emotional: *feeling known*.
2. **Acts on OUR data:** plan the week, build the shopping list, edit the profile, log a cook. ChatGPT can't touch
   our app state. → emotional: *ease*.
3. **Health/nutrition PRECISION + allergy SAFETY guarantee:** real numbers (USDA-locked), hard allergy gate.
   ChatGPT hallucinates nutrition and guarantees nothing. → emotional: *trust*. **This is the differentiator that
   justifies "health/nutrition assistant".**
4. **Proactive, boundary-timed:** notices patterns (dislike-loop, habit) and offers at natural pauses. → *delight*.

**De-emphasize (commodity, ChatGPT wins):** open-ended cooking Q&A. Keep it only as a minimal, *our-data-grounded*
funnel into the actions above. Spend tokens where there's moat + revenue, not on commodity chat.

## 3. CAPABILITY MAP — ranked by impact × effort FOR GARNISH (substrate already built = the agentic brain)

| # | Capability | Why it's the moat | Garnish effort | Evidence |
|---|---|---|---|---|
| **A** | **Recipe/Plan → scaled-ingredients → SHOPPING LIST** (one request) | proven CORE HOOK of the category | **LOW** — endpoints exist (`/shopping-list/from-plan`, `/meal-plans`); just new agentic tools | Samsung Food + SideChef, shipped to millions [3-0] |
| **B** | **WRITE-ACTIONS** — manage allergy/diet, like/dislike, add-to-plan, add-to-list, favorite, set goal | the "acts on our data" moat; founder's exact asks | **LOW** — new tools on the existing tool-loop + the gate | Samsung "Personalize Recipe"; Grocery AI chef [3-0] |
| **C** | **Health/nutrition PRECISION** — nutrition math on a recipe/plan, goal-alignment ("protein this week?") | the trust moat; the "سلامتی/تغذیه" identity; fixes the eval personalization gap | **MED** — USDA data exists; needs a compute-nutrition tool + profile injection | (own data; ChatGPT can't ground it) |
| **D** | **Boundary-timed PROACTIVITY** — dislike-loop detect → offer to update; habit/goal nudges | the retention moat | **MED** — needs signals + an offer-surface | CHI-2025 trade-off [2-1, treat as حدسی] |
| **E** | **Cook-mode COMPANION** — step companion, hands-free voice, instant substitution, timers | daily-ritual habit hook | **HIGH** — FE-heavy + a voice model | SideChef + Grocery AI cook-mode [3-0] |

**Build order:** A + B first (cheapest, the agentic brain makes them near-free, = the founder's examples) → C
(health precision, also closes the eval gap) → D (proactivity) → E (cook-mode, parallel FE track).

## 4. SAFETY — tier writes by REVERSIBILITY (evidence-backed; refines "confirm everything")
- **Reversible prefs** (like/dislike, favorite, add-to-list): **auto-execute, NO confirm**, offer an **undo** toast.
  Blanket confirmation causes documented *confirmation fatigue* ("cry wolf") — NN/g, AWS, arXiv 2510.05307.
- **Consequential / health** (add/REMOVE allergy, clear a plan, dietary-profile edit): **explicit, request-RESTATING
  confirmation** before execution (NOT a generic "Are you sure?") — name the action + the exact value. Anthropic /
  AWS Bedrock / NN/g consensus [3-0].
- **Removing an allergy is the highest-risk write** (could expose the user to an allergen): hardest friction, make
  the confirm deliberately harder to hit (Fitts's Law), never silent. The existing hard gate stays OUTSIDE the LLM.

## 5. MONETIZATION — the killer research insight (directly answers the founder's token worry)
- **AI apps convert well but CHURN ~30% faster** (~21% vs ~30.7% annual retention) AND **cost scales with
  ENGAGEMENT, not installs** — the most-engaged users are the LEAST profitable under flat subscription
  (creem.io / RevenueCat, secondary). → Two consequences:
  1. **Don't put heavy AI on the free tier** (commodity Q&A on free = pure cost, no moat, faster churn).
  2. **Tiered model:** Free = our-data read (search/deliver/troubleshoot, cheap). **Premium subscription** = the
     moat (knows-me + actions + workflows + nutrition precision + proactivity). **AI-credits / usage-based** for the
     heavy stuff (multi-step workflows, voice cook-mode) so heavy users don't sink the margin.
- **Retention ≠ AI wow; retention = HABIT.** The moat features must become *weekly rituals* (plan→list every week,
  cook-mode every cook), not one-off demos. That is what lowers churn — not the novelty.

## 6. WHAT WE DON'T BUILD
- A ChatGPT-style general cooking chatbot.
- US-retailer commerce checkout (Walmart/Amazon/Instacart) — **does not exist for Iran/NL**; commerce hand-off is
  region-gated, defer.
- Silent or mid-task proactivity — only offer-and-confirm at natural pauses.

## 7. HONEST GAPS (what the research could NOT prove — so we must)
- **No hard ROI** tying any single AI cooking capability to retention/revenue was found. The impact ranking is
  *by-analogy*, not proven. → We must run **our own A/B** (the eval harness + analytics events are the substrate).
- **Monetization model** (tier gates vs flat vs credits) needs a dedicated follow-up — no claim survived on the
  exact split.
- **Proactivity timing** evidence is a small coding-domain lab study → **[حدسی]** for cooking; validate in-app.
- **Iran/NL grocery integration** paths unknown.

## Sources (primary unless noted)
Samsung Food (news.samsung.com); SideChef FAQ; Grocery AI (groceryai.com + App Store); Anthropic agent-safety
framework; AWS Bedrock human-in-the-loop; NN/g confirmation-dialog + proximity-of-consequential-options; CHI-2025
proactivity study (arXiv 2502.18658); RevenueCat / creem.io retention+cost (secondary). Full list +
adversarial-verification votes: workflow run wf_614b2e9c-043.
