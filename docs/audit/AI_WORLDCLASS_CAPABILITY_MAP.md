# Garnish AI — World-Class 2026 Capability Map (the proactive 90%)

> **What this document is.** You asked for the full vision, not your two ideas. This is it: a single,
> decisive map of what a world-class 2026 AI cooking *companion* is, drawn from what Anthropic, OpenAI, and
> Google **actually ship today** (verified live, June 2026), folded onto Garnish's own code-grounded
> architecture. Your asks — recipe+nutrition mastery, nutrition math, synonym search, the user-model,
> meal-plan, shopping list, add-allergy, date/time awareness, per-user cost transparency, admin analytics —
> are all in here. But they are a **subset** (~10 of ~50 capability groups). The other 90% is the part nobody
> handed you, and it's the part that wins investors.
>
> **Honesty contract (per the working agreement).** Tags throughout:
> **[HAVE]** = designed or built in your own docs · **[FRONTIER+]** = 2026 SOTA you should add · **[MOAT]** =
> defensible, most rivals lack it · **[BLOCKER]** = not a feature, a launch gate. Confidence: **[قطعی]** the
> labs ship this (checked live) · **[احتمالاً]** strong design judgment · **[نامطمئن]** unproven without your
> own production logs (you have none yet — say so).
>
> **Companion docs (all absolute):** `C:\dev\garnish-app\docs\audit\AI_MASTER_SPEC.md` (the 9-dimension
> design this extends) · `AI_COMPANION_REARCHITECTURE.md` (agent loop + tool catalog + eval harness) ·
> `IDEAS_AND_GAPS.md` (the living 90% backlog) · `L1_PLAN.md` (collective learning) ·
> `GARNISH_GROUND_TRUTH.md` (project state).

---

## Reality Check (read this before the vision seduces you)

[قطعی] **You do not have a thinking gap. You have a build + measurement gap.** Your own specs already
design ~70% of what follows at investor-grade depth. The flagship things are *not built yet*: the agent loop
is unwired, not one learning loop is closed, cost is `null` because the rate catalog is empty, nutrition is
capped at 36% gram-coverage, and there is **zero Dutch** in any deterministic string for a launch aimed at
the European general public. So the danger here is the opposite of inspiration — it's that "thousands of
parameters" becomes an excuse to build breadth before the **instrument** that proves any of it works.

[قطعی] **Model-landscape correction that changes your cost math.** As of June 2026, Opus is no longer
Anthropic's flagship (that's Claude Fable 5). For Garnish this is good news, not bad: the right live-assistant
model is **Sonnet 4.6** (cheap, fast, 1M context, supports thinking), with **Haiku 4.5** for classification
and a Fable-5/Opus-class model reserved for *offline* admin reasoning — never per-turn. The new tokenizer
(Opus 4.7+) emits ~30% more tokens per text; re-estimate budgets. (Anthropic models overview, fetched
2026-06-26.)

**نتیجهٔ عملی up front:** this map is the *enumeration* you asked for. The *sequencing* is the opposite of
"build it all" — it's "build the measurement instrument first, then attack the 15–20 moat capabilities, and
let the other ~160 become red→green regression lines instead of screenshot arguments." Section 4 is that
order.

---

## 1. THE THESIS — what a world-class 2026 cooking companion is

A world-class 2026 cooking companion is **not a chatbot that answers recipe questions — it is an agent that
runs a continuous perceive → reason → act loop, grounded only in a corpus it can cite, that knows *you* (your
allergies, your skill, your pantry, what you cooked last Tuesday), that *does things* (builds the plan, edits
the list, adds the allergy and re-checks the whole session), that *anticipates* (the right nudge at the right
moment, and silence the rest of the time), that follows you hands-free across the counter while your hands are
covered in dough, and that gets measurably better every time anyone cooks — all behind a deterministic safety
wall the model is never allowed to be.** Memory, tool-use, multimodal input, and structured output stopped
being differentiators in 2026; the frontier labs ship them as *table stakes*. The bar they actually set, and
that Garnish must clear: Anthropic ships file-backed **memory + context-editing** that cut tokens ~84% on long
runs and an **Agent SDK** (the same harness running this very subagent) that gives you the tool-loop, MCP
client, sub-agents, and compaction for free; OpenAI ships a **Realtime speech-to-speech** model (EU-available)
that reads steps aloud, answers "are the onions done?", and fires your timers in one low-latency voice loop,
plus **strict JSON-schema** output at ~100% schema compliance; Google ships **Gemini Live** — camera-aware,
barge-in voice that, in Google's *own* cooking demo, adds your ingredients to a shopping list by voice. The
companion is the synthesis of all three patterns — **and the only durable advantage on top of them is the one
thing the labs cannot ship for you: a proprietary taste graph, grounded with no hallucination, gated by
deterministic food-safety, whose unit cost bends *down* with every cook.**

---

## 2. WHAT THE FRONTIER LABS DO → WHAT GARNISH TAKES

[قطعی] on the lab features (checked live 2026-06-26). [احتمالاً] / design-judgment on the "how Garnish uses it"
column. **The single load-bearing rule across every row: none of these — not Constitutional AI, not a memory
file, not a vector store — is allowed to *be* your allergen/observance boundary. That stays deterministic,
outside the LLM. Over-trusting the model here is the one genuinely dangerous mistake in this whole space
(health + GDPR).**

| Capability | Who ships it (and the proof point) | How Garnish takes it |
|---|---|---|
| **Agentic engine** | Anthropic **Agent SDK** (`@anthropic-ai/claude-agent-sdk`) — tool-loop + MCP client + sub-agents + auto-compaction; OpenAI **Responses API** (Assistants API dies Aug 26 2026); Google function-calling AUTO/ANY/NONE | **Build the companion on the Agent SDK, don't hand-roll a loop.** Highest-leverage adoption on the roadmap — it directly de-risks "rebuild AI as agentic companion." Use **sub-agents** to isolate the eval harness and the safety pass from the conversational agent. |
| **Tool-use / function-calling** | All three; Anthropic adds **parallel** + **forced** tool choice; Google supports compositional/sequential | Define real tools: `search_recipes`, `get_recipe`, `compute_nutrition`, `add_to_meal_plan`, `add_to_shopping_list`, `add_allergy`, `check_allergen_fit`. **READS parallel, WRITES serial + idempotent + confirm-first.** The LLM picks intent; *your deterministic code* runs the action and enforces the gate. |
| **Structured output** | OpenAI strict JSON-schema (~100% vs <40% legacy); Anthropic **Structured Outputs** beta (~99.8%); Google `responseSchema` | **Force every turn into a typed envelope** `{intent, recipeIds[], substitutions[], warnings[], action}` so your FE renders deterministically, your gate inspects *data not prose*, and your eval can *diff* it. This is what makes the assistant gate-able **and** eval-able. Model-agnostic — adopt the pattern on your current stack. |
| **Memory (durable user model)** | Anthropic **Memory Tool** (file-backed, your infra; +39% task / −84% tokens with context-editing); OpenAI "reference chat history" (Apr 2025); Google personal-context | Persist the living user model (allergies, observance, dislikes, skill, past cooks) as memory the agent reads each session — "picks up where you left off" without re-stuffing context. **Caveat [قطعی]: memory is a convenience store, never the safety boundary.** |
| **Long context** | 1M tokens on Fable 5 / Opus 4.8 / **Sonnet 4.6** and Gemini 2.5/3.x | Fit the *retrieved recipe + user profile + this session's transcript* — **not** the whole corpus. Long context is a safety net, not a default; brute-forcing it is slow, costly, and worse than retrieval. |
| **Grounding / retrieval** | OpenAI hosted File Search + vector stores; Google **grounding-with-Search** (inline citations, mandatory UI chip) + **Maps grounding** (250M places) | **Keep recipe retrieval as function-calls over your own SQL/Prisma DB**, never a vendor vector store — it preserves your `PUBLISHED_RECIPE_WHERE` + allergy invariants + freshness, and prevents the store from leaking un-gated results. Use Search-grounding *only* for external facts (saffron price/season, a holiday date); never for in-corpus answers. |
| **Multimodal (vision in)** | All three; Google ~88% dish recognition / ~75% composition but **calorie-from-photo stays unreliable**; OpenAI + Anthropic image-in standard | **Fridge/pantry photo → "what can I cook"**, dish-photo → "is it done?", label/recipe photo → structured import. A real differentiator for a zero-Persian-background European user. **Hard caveat: vision *suggests*; the allergy gate still verifies against the profile deterministically** — a misdetected peanut must never breach the gate. |
| **Voice / realtime** | OpenAI **gpt-realtime** (GA, speech-to-speech, EU-available via API); Google **Live API** (native-audio, 30 voices, barge-in) | The truest expression of "during cooking." Hands-free Cook Mode: reads steps, answers "how do I know it's done?", sets timers via tool-calls, swaps live. **Build via the API, not the consumer apps.** Most expensive + complex item → **post-MVP**, after the grounded text core is rock-solid. EU note: stick to *task* voice, not emotion/affect inference (EU AI-Act friction). |
| **Deep research (agentic)** | OpenAI + Google **Deep Research** modes (autonomous multi-iteration cited reports over 1M context) | **Not a runtime feature** (a 3-min report is the opposite of "my pan is hot"). Use the *pattern* as an **offline corpus-authoring agent** — research regional variants, substitution science, European-occasion menus to feed your GRIS content layer. |
| **Personalization** | OpenAI saved-memories + inferred history; Google "Personal Intelligence" (account-gated, toggleable, "no direct training") | Validates your **L0/L1 living-profile** direction. **The lesson that matters is the consent architecture, not the feature** — explicit "remember this" separated from inferred signals, a reviewable memory page, withdrawal stops processing. Under GDPR your bar is *higher* than theirs. Do **not** mimic silent dossier-building. |
| **Proactivity** | OpenAI **Tasks/Scheduled** ("every Sunday, plan my dinners"); Google Live + connectors | Own it natively (you have cron + push). "Sunday plan nudge," "your saffron is low," "Nowruz menu next week," tied to the **European calendar** (Sinterklaas/Christmas/Easter). But governed: JITAI — right moment, acceptance-supervised, **default to silence**. |
| **Structured-output admin / analytics** | All three (the same JSON-schema machinery) | Power **L2b** on a **deterministic semantic layer** (insight-type × metric-family × entity), the LLM only *narrates* the number — **never text-to-SQL**. Churn prediction is now the board-level metric investors ask about first. |
| **Cost + caching** | Anthropic **prompt caching** (reads 0.10× = 90% off) + **Batch** (50% off, stacks to ~95%); **effort/Adaptive Thinking** (`standard/high/xhigh/max`); OpenAI/Gemini context-caching | **Cache the session preamble** (system prompt + pinned profile + retrieved recipe are identical across a cooking session's turns) → pay full once, 90% off every "now scale it / swap the butter / next step." **Batch** the offline jobs (USDA normalization across 1008 recipes, eval runs). **Route by effort, not by swapping models.** Caching the preamble is your single biggest cost lever for a chatty during-cook assistant. |
| **Domain packaging** | Anthropic **Agent Skills** (`SKILL.md`, open standard) + **Tool Search** (defer-load tools, ~85% context saved) | Externalize hard-won cooking logic into versioned, testable Skills — `recipe-scaling`, `dietary-substitution`, `cooking-troubleshooting` — instead of one mega-prompt. **Defer-load** tools so a during-cook turn loads only the 2 relevant ones, not all 15. Aligned with your "learning not rules / Swiss-watch" bar. |
| **Computer-use / browser agents** | Anthropic computer-use; OpenAI **Operator (killed Aug 31 2025, failed at checkout)** → Atlas; Google Mariner | **Ignore for the product [قطعی].** No cooking reason to drive a desktop, and Operator *itself died at exactly the "auto-order groceries" task.* For groceries, integrate a real Dutch grocer API emitting a structured cart — deterministic, not an agent flailing through a DOM. |

---

## 3. THE FULL CAPABILITY MAP — every group (your asks ⭐, surrounded by the 90%)

Ten capability groups, ~150 atoms, so "thousands of parameters" is concrete, not a vibe. **Your explicit asks
are marked ⭐ and live inside Groups 1, 2, 3, 6, 7, 9, 10 — they are real and necessary, and they are a fraction
of the surface.** Each atom: what it does for the user · why it matters · frontier inspiration. Status tags as
defined at top.

### GROUP 1 — Conversation & Understanding ("it gets me")
*Frontier bar: continuous perceive→reason→act; multimodal + memory + tool-use are table-stakes now.*

- **Intent classification, deterministic-first** [HAVE] — sub-ms €0 router as the cost + safety governor. *(your `IntentClassifier`, live)*
- ⭐ **Synonym / exact-ingredient search** [HAVE→FRONTIER+] — alias-aware retrieval ("kip" = chicken, "limu omani" = dried lime), relax-on-empty. *Your ask. The alias-graph wiring is the Dutch launch-blocker.*
- **Multilingual at the *answer* layer (fa/nl/en)** [BLOCKER] — not just the lexicon. *Zero Dutch in deterministic strings today = the single biggest understanding gap for the EU general public.*
- **Intra-utterance code-switch** [FRONTIER+] — "یه recipe برای kip" in one sentence; the hardest NLU/ASR case.
- **Typo / fuzzy / phonetic tolerance** [FRONTIER+] — Damerau-Levenshtein + Double-Metaphone, €0.
- **Paraphrase / semantic match** [FRONTIER+, OFF] — local embedding (e5/LaBSE) for ambiguous non-safety turns only.
- **Clarifying-question repair — ask ONE sharp question** [HAVE] — force-clarify only for allergen / destructive writes. *Inspiration: every frontier agent now asks rather than guesses.*
- **Verbalized abstention ("OK to say I don't know")** [HAVE] — a first-class success state; explicit uncertainty kills ~half of hallucinations.
- **Calibrated abstention dial per intent** [FRONTIER+] — tunable accuracy↔hallucination threshold; your ladder is "designed, not calibrated."
- ⭐ **Multi-turn working memory** [FRONTIER+, not wired] — 8 verbatim turns + rolling summary, summary EARLY in the cacheable prefix, untrusted-for-safety. *Your #1 named UX gap: "for 6 people" doesn't resolve today.*
- **Entity / coreference across turns** [FRONTIER+] — "scale *the second one*", "*it's* too salty."
- **Cross-session episodic recall** [FRONTIER+] — "last time you asked about a walnut substitute." *Inspiration: OpenAI reference-history, Anthropic memory tool.*
- **Topic-shift / reset detection** [FRONTIER+] — "now a dessert" drops the kebab context.
- **Implicit-persona inference** [FRONTIER+, beyond your spec] — learn terse-vs-guided, adventurous-vs-safe from behavior, not a form.
- **Register / reading-level adaptation** [FRONTIER+] — a beginner gets expanded explanations automatically.
- **Frustration / sentiment detection mid-cook** [FRONTIER+, not in spec] — escalate help, soften tone.
- **Honesty throttle on familiarity** [HAVE] — maturity-band gating so it never says "I know you" at cold-start. *A rare guardrail rivals lack.*

### GROUP 2 — Agentic ACTIONS (chatbot → agent; your largest vision↔code gap)
*Frontier bar: agents DO, via an allow-listed tool catalog over real systems. This is the leap that defines the category — and for Garnish it's mostly cheap tool-wrapping over already-tested services.*

- ⭐ **`search_recipes_structured`** [HAVE] — hybrid retrieval, alias-aware, relax-on-empty.
- ⭐ **`get_recipe`** [HAVE] — full ingredients + amounts + steps, PUBLISHED-gated, from DB never invented.
- ⭐ **`compute_nutrition`** [FRONTIER+] — *computes* macros, exposes a `coverage` flag, abstains when partial.
- ⭐ **`get_user_profile`** [FRONTIER+] — skill / likes / dislikes / diet, consent-gated, allergens stripped in code.
- **`get_cooking_history`** [FRONTIER+] — bias toward what they cook most. *Blocked: `cook_complete` events = 0 today.*
- ⭐ **`get_context` (date / day / time-of-day / season / region / units)** [FRONTIER+] — *your date/time ask; now-awareness.*
- **`ask_clarifying_question` as a tool the model chooses** [HAVE].
- ⭐ **`add_allergy` (write, confirm → write → re-ground this session)** [FRONTIER+] — *your ask; your highest-severity gap: "designed, not built." The session must re-filter immediately after the add.*
- ⭐ **`add_to_shopping_list` (write)** [FRONTIER+] — idempotency-keyed, amounts mapped from `RecipeIngredient`.
- ⭐ **`build_or_edit_meal_plan` (write)** [FRONTIER+] — model drafts, deterministic code adjudicates hard constraints, **per-slot gate in verify.** *Your ask; the named liability if shipped without the per-slot gate.*
- **`remove / move_meal_slot` (write)** [FRONTIER+] — always-confirm, logged.
- **`save / favorite_recipe` (write)** [FRONTIER+].
- **`apply_swap` + emit event** [MOAT] — **the "apply" tap *is* the missing L1 taste signal.** One build closes the chatbot→action gap AND the ZERO-events observability hole. *Your own "biggest find," IDEAS #11.*
- **Set a timer / multi-timer** [FRONTIER+, not in your catalog] — "12 min rice, 4 min eggs"; table-stakes for cook-mode (voice appliances already do this).
- **Create a reminder / calendar event** [FRONTIER+] — "remind me to marinate tomorrow 6pm", "block 90 min Sunday to batch-cook." *You have calendar + scheduled-task MCPs available — a real connector opportunity.*
- ⭐ **Scale a recipe / convert units** [HAVE deterministic] — as an explicit action with the math shown.
- **Pantry write** [FRONTIER+] — "I just bought 2kg rice" → `PantryItem`. *Model unused, 0 rows, no write API today.*
- **Shared write wrapper `confirm → write → audit → re-ground`** [HAVE designed] — all writes behind one wrapper.
- **Generative-UI action cards** [MOAT] — render a native swap/scale/add card; the tap is the write AND the signal.
- **Reversible-by-default + Undo; dangerous (allergy / destructive) asks first** [HAVE] — the correct act-vs-ask policy.
- **Tool-call provenance in the response** (`meta.toolCalls`, `meta.action.status: proposed|written`) [HAVE] — so an eval can *prove* the model drove the tools and confirm-then-write held. The keystone eval hook.

### GROUP 3 — Deep PERSONALIZATION & the learning loop (your declared moat)
*Frontier bar moved past "remember longer" to correctly interpreting sparse / implicit / dynamic preference signals.*

- **Ingredient-level taste graph** [MOAT] — taste/texture/cookingBehavior/nutrition/allergen × 1008 ingredients + GRIS. *Your central defensible asset; recipes are content, the graph is the moat.*
- ⭐ **Per-user learned taste vector** [MOAT, partial] — likes/dislikes/cuisine affinity. *(`LivingUserProfile` — your "know the user" ask.)*
- **Dual memory: episodic (raw events) vs profile (distilled identity), purpose-tagged at write** [HAVE] — SOTA-aligned, GDPR-clean.
- **Hierarchical empirical-Bayes shrinkage** person→cohort→population; n=0 ⇒ exactly the curated prior [HAVE, OFF] *(L1 `RecipePrior`).*
- **Curated `populationMu` seed** [FRONTIER+] — Europe-gate map + occasion calendar; **delivers value at ZERO user data.** *Ship the seed even if you never flip the learner.*
- **Collective taste loop (L1 ranker)** [MOAT, built + OFF] — cohort-keyed learning.
- **Skill-growth / mastery ladder** [FRONTIER+] — "nailed X 3×, ready for Y?"; beginner never served `hard` first; steps EXPAND for beginners, COLLAPSE for experts. *IDEAS #1/#5.*
- **Adaptive recipe rendering** [MOAT] — the recipe instance re-renders per user (servings, swaps, seasoning to taste-DNA). *"The single highest-leverage use of everything built," IDEAS #1 — you have the parts, not the product.*
- **Cook-result feedback loop** [FRONTIER+] — post-cook 1-tap "how did it go?" (photo + rating + what-went-wrong). *IDEAS #2, "missing entirely" — the data that makes year-2 > year-1.*
- **Implicit-signal capture** [FRONTIER+] — swap/scale/remove/abandon as `UserEvents`. *Currently sessionStorage, ZERO events — starves every loop.*
- **Fold-back loop (Loop-3)** [MOAT] — LLM-handles-novel → capture → deterministic-learns-it-back; `paid-turn-decay-rate` KPI. *The cost-flywheel; needs the absent `AiTurnDecision` substrate.*
- **Off-policy evaluation with variance reduction (DR/SWITCH-DR)** [FRONTIER+] — not plain clipped-IPS; biased propensity could greenlight a flip on noise.
- **Off-policy replay harness as the founder-gate** [FRONTIER+] — *does NOT exist; don't mistake the content-quality harness for it.*
- **Minority-protection / LIFT-ONLY invariant** (`penMult=0`) [HAVE] — positive personal signal ⇒ score never drops; machine-enforced property test.
- **Localized signal extraction** [FRONTIER+] — cooking a chicken recipe sets `likes_chicken` for an en/nl user. *Matcher is Persian-only today = a launch-correctness bug.*
- **Household / multi-eater modeling** [FRONTIER+, thin] — cook-for-N, conflicting diets in one home.
- **Post-deploy drift / regression monitoring** [FRONTIER+] — canary + rollback + catastrophic-forgetting guard after a learned change ships.
- ⭐ **"What do you know about me?" transparency surface** [FRONTIER+] — ≥12 true facts in <300ms at €0. *Your user-model, made visible + GDPR-clean.*

### GROUP 4 — PROACTIVITY (anticipatory, not reactive)
*Frontier bar: JITAI — just-in-time adaptive intervention, acceptance-supervised, default to silence. You have the playbook but explicitly NO intervention-control policy in code.*

- **"What's for dinner?" anticipation** [FRONTIER+] — time + profile + history → a ready suggestion before asked.
- **Expiring-ingredient alerts** [FRONTIER+] — items expiring in 48–72h surface first. *Live SOTA in waste-aware apps; blocked on pantry data.*
- **Seasonal / occasion nudges** [FRONTIER+] — "late-June NL weekday → lighter"; Yalda/Nowruz/Ramadan + Sinterklaas/Christmas/Easter. *Core to launch, IDEAS #10; engine unbuilt.*
- **Restock prompts** [FRONTIER+] — "you're low on rice" from consumption pattern.
- **Mastery-ladder nudges** [FRONTIER+] — "ready for Y?"
- **Don't-repeat fatigue** [FRONTIER+] — yesterday's dish down-weighted.
- **AROMA selective silence** [HAVE] — intervene ONLY at step boundaries / GRIS `commonMistakes` failure points / allergy hard-stops.
- **Attention ceiling ≤3–5 interventions/day, enforced in code** [FRONTIER+] — designed, not enforced.
- **Because-you-did-X rationale + one-tap "why am I seeing this / turn off"** [HAVE] — on every nudge.
- **Acceptance-supervised penalty loop** [FRONTIER+] — an ignored nudge RAISES that trigger's future threshold. *The missing control policy; a mistimed during-cook pop-up is uniquely costly.*
- **Calibrated timing model** [FRONTIER+] — *when*, not just *whether.* (JITAI core.)
- **Churn-risk proactivity (user-facing)** [FRONTIER+] — re-engage a lapsing user with "you loved X, try Y."

### GROUP 5 — MULTIMODAL & Voice (the category-defining cook-mode bet)
*Frontier bar: text+image+voice in one run; speech-to-speech realtime; ~88% dish recognition but calorie-from-photo stays unreliable. Your spec correctly frames a photo as a discovery aid, NEVER an allergen/nutrition source.*

- **Photo of fridge/pantry → "what can I cook"** [FRONTIER+] — *Samsung Family Hub + WhisperChef ship this; post-v1 in your spec; the highest "wow"-per-effort for a zero-Persian-background user.*
- **Photo of a dish → identify → recipe / technique help** [FRONTIER+].
- **Photo of a label/package → parse allergens** [FRONTIER+] — **assist only, always defer to the physical label** (MDR hedge).
- **Photo of a *result* → "did it turn out?" + diagnose** [FRONTIER+] — "too dark = overcooked"; closes the cook-result loop.
- **Receipt/grocery photo → pantry stock + price** [FRONTIER+].
- **Push-to-talk + one wake-phrase (NOT always-listening)** [FRONTIER+] — privacy/battery/GDPR default.
- **Barge-in + semantic turn-detection** [FRONTIER+] — for kitchen noise. *Inspiration: Gemini Live native-audio, gpt-realtime.*
- **Hands-free step narration** [FRONTIER+] — "next", "repeat", "how long again?"
- **Voice timer / conversion hands-free** [FRONTIER+].
- **Every spoken tool-call surfaced as an auditable step** [HAVE] — voice never hides the allergy gate.
- **Graceful degrade to on-screen step on low ASR confidence** [HAVE].
- **Empirical Farsi / code-switch ASR validation gate before shipping voice** [FRONTIER+] — commercial ASR degrades badly on Perso-Arabic; validate, don't assume.
- **Voice rides the SAME router/grounding/gate** [HAVE] — a new I/O channel, not a second brain.

### GROUP 6 — NUTRITION & HEALTH GOALS (compute, don't read a tag — a real differentiator)
*Frontier bar: conversational coaches that COMPUTE macros + track 80+ micronutrients and adapt to progress. Your "it DOES the arithmetic" framing is above most rivals — but capped by 36% gram-coverage.*

- ⭐ **Compute per-dish macros** Σ(gramsForLine × per100g/100 ÷ servings) [FRONTIER+] — *your nutrition-math ask; reuse `sumNutrition()`.*
- ⭐ **Compute from raw ingredients** ("200g meat + 100g split peas = ? protein") with the arithmetic shown [FRONTIER+].
- ⭐ **Rank / filter by a macro target** ("high-protein dinner", "under 10g fat") by COMPUTED value, not a tag [FRONTIER+].
- **Coverage honesty** [MOAT-grade trust] — `coverage` flag; "approximately, from N of M ingredients" or abstain; **never silent-zero.** *The trust differentiator vs hallucinating rivals.*
- **Source-locked provenance** [MOAT] — every number → a USDA FDC id; protects the MDR boundary.
- **Hit a daily protein/calorie target across a plan** [FRONTIER+] — sum the week, flag the gap.
- **Dietary-pattern adherence** (Mediterranean / diabetic-friendly / heart-healthy, culturally-aware Persian) [FRONTIER+] — *IDEAS #9, "a serious premium vertical, data exists, vertical doesn't"; highest retention + WTP.*
- **Micronutrient breadth** (fiber/sodium/sugar beyond the 4 macros) [FRONTIER+] — *stored `Nutrition` lacks sugar/sodium; data-work.*
- **Cost-per-serving + nutrition-per-currency** [FRONTIER+] — *IDEAS #3.*
- **NEVER a health/therapeutic claim** [HAVE partial] — Reg.1924/2006 permitted-list, **Dutch lexicon too** *(a named launch-blocker).*
- **Always-defer-to-label hedge** [HAVE] — on anything allergen/medical.
- **Glucose / biometric integration** (Levels-style, if a wearable connects) [FRONTIER+, future].
- **Gram-normalization data fix (36%→100%)** [FRONTIER+] — *the single highest-leverage data work; unlocks honest per-recipe + scaled + per-serving nutrition. Your #3 data gap.*

### GROUP 7 — PLANNING & Optimization (weekly plans, budget, waste, occasions)
*Frontier bar: plan ingredient LIFECYCLES, not individual dishes; optimize buy-timing + cook-order + leftovers; substitute against what you own.*

- ⭐ **Build a full week** [FRONTIER+] — 7 days of real, published, allergy-safe, non-repeating recipes within a time budget; model drafts, deterministic adjudicates, only failing slots redrawn. *(`generateSmartPlan` exists — your meal-plan ask.)*
- **Per-slot safety gate in plan-build** [HAVE] — 21 slots = 21 leak chances; mandatory, the named liability.
- **Constraint optimization** [FRONTIER+] — time/budget/skill/variety/nutrition as joint constraints.
- **Ingredient-lifecycle planning** [FRONTIER+] — same ingredient across meals to minimize waste (the SOTA zero-waste pattern).
- **Leftover-aware chaining** [FRONTIER+] — Tuesday's roast → Thursday's soup.
- **Expiry-aware sequencing** [FRONTIER+] — cook the wilting herbs first; blocked on pantry data.
- **Budget-aware plan** [FRONTIER+] — hit a weekly spend target. *IDEAS #3.*
- **Seasonality** [FRONTIER+] — "in season & cheap now."
- **Occasion / guest planning** [FRONTIER+] — "dinner for 6, one vegetarian, Friday" → a coherent menu. *EU occasion calendar is launch-core.*
- ⭐ **Smart shopping-list from a plan** [FRONTIER+] — consolidated, deduped, amounts aggregated, aisle-grouped. *(`from-plan` exists — your shopping-list ask.)*
- **Pantry-diff list** [FRONTIER+] — "you have 8/10; buy these 2." *IDEAS #3.*
- **Batch-cook / meal-prep optimization** [FRONTIER+] — what to prep Sunday for the week.
- **Plan repair / re-draw a slot** [FRONTIER+] — "swap Wednesday for something faster."
- **Waste-reduction reporting** [FRONTIER+] — "you wasted ~0 this week" — the tangible $7-justifies value.

### GROUP 8 — TRUST / SAFETY / GOVERNANCE (your crown jewel — keep it the crown jewel)
*Frontier bar: guardrails as ARCHITECTURE not afterthought; gate OUTSIDE the model; NLI-based faithfulness with span citations; OWASP-LLM / NIST-AI-RMF. This is where you already lead the field.*

- **HARD deterministic allergy gate, fail-closed** [MOAT] — safe-set-first, declared allergens NEVER in prompt, output re-screened, UGC excluded. *Your strongest, SOTA-grade asset.*
- ⭐ **Observance gate** (halal/kosher/no-pork user NEVER served pork) [HAVE, regression-tested] — *the add-allergy/observance correctness you already shipped.*
- **Pre-filter candidates (P1) + post-screen output (P2) + writes-only-via-confirm (P3)** [HAVE].
- **Runtime groundedness validator** [FRONTIER+] — reject any reply naming an entity-id no tool returned, or an uncomputed quantity → degrade. *Exists eval-side, NOT runtime — the gap between "no-hallucination" as aspiration vs measured property.*
- **NLI / entailment faithfulness check** [FRONTIER+] — not citation-presence (which is gameable); 2026 SOTA.
- **Provenance pointer on every claim** [HAVE partial] — "per USDA FDC-id", "GRIS step N", "curated edge."
- **Structural prompt-injection defense** [FRONTIER+] — spotlight/delimit untrusted corpus + UGC vs instructions; not regex. *Only layer-1 regex today; unguarded once UGC lands.*
- **OWASP-LLM-Top-10 named control each** [HAVE] — LLM01 injection, LLM02 disclosure, LLM05 output-handling, LLM06 excessive-agency, LLM07 prompt-leak, LLM09 misinformation, LLM10 denial-of-wallet.
- **Per-table userId-scoped tools** (`where:{userId}`) [MOAT] — data ownership enforced in CODE; closes LLM01 structurally. *Most vector-RAG rivals can't do this.*
- ⭐ **Cost ceiling / denial-of-wallet** [HAVE] — daily token budget, fail-closed before any paid call, degrade-never-lockout + 429/Retry-After. *Underpins your per-user cost-transparency ask.*
- **EU AI Act Art.50 first-turn AI disclosure (fa/nl/en, in-product)** [BLOCKER] — only a cosmetic string today; €15M/3% penalty.
- **Art.9 / GDPR special-category consent gate** [BLOCKER] — no `ai_personalization` consent ⇒ public-tools assistant only.
- **Food-safety hard-stops** [HAVE] — raw-chicken-"safe" / mold-"cut-it-off" / danger-zone reheating BLOCKED (`output-safety-evaluator`). *A layer most rivals lack.*
- **Reg.1924/2006 health-claim permitted-list + Reg.1169/2011 14-allergen posture** [FRONTIER+] — blocklist today, Dutch-blind.
- **DPIA before EU live flip; Iran sandbox first** [HAVE] — correct posture.
- **Unified safety pipeline across ALL generative surfaces** [FRONTIER+] — close the `ai-assist.service.ts` side-door; ambient/assist must route the same gate.
- **fa/nl/en red-team / adversarial corpus as a CI gate** [FRONTIER+] — jailbreak/medical/allergy/code-switch; allergen-leak = HARD fail. *English-heavy today.*
- **Transparency / explainability** [MOAT-flavored] — surface "✓ verified food-safe / no kitchen myths / why this works" and let the AI cite it. *IDEAS #4, the antidote to confidently-wrong AI cooking advice.*

### GROUP 9 — ADMIN / BUSINESS Intelligence (L2b — supervised-autonomy analytics agent)
*Frontier bar: AI churn prediction is now board-level (NRR = #1 investor metric); product-data + conversational-data lifts prediction ~23%. Your L2b grounds on a deterministic semantic layer, never raw text-to-SQL — exactly right.*

- ⭐ **Usage analytics per user / cohort** [FRONTIER+] — DAU/WAU, sessions, feature adoption. *Your admin-analytics ask.*
- ⭐ **LLM cost per user / feature / intent** [FRONTIER+] — real tokens, non-null cost. *Your per-user cost-transparency ask. `PRODUCTION_RATE_CATALOG=[]` today → cost always null → you cannot yet state a unit-economic as fact. Fix this to make the claim real.*
- **Most-asked questions / intents** [FRONTIER+] — demand signal.
- **Popular / trending dishes by region & cohort** [FRONTIER+].
- **Content-gap = unmet demand** [MOAT-flavored] — "users search X, we have no recipe" → the authoring backlog. *Turns analytics into a content roadmap; few rivals close this loop.*
- **Failed-retrieval / abstention rate** [FRONTIER+] — where the assistant says "I don't have it" = the unmet-demand goldmine.
- **Churn / retention prediction** [FRONTIER+] — behavioral signals preceding lapse; board-level.
- **Cohort retention curves** [FRONTIER+] — identify the retention *pattern* (the ~64%-spend-saving insight).
- **Customer health score** [FRONTIER+] — composite engagement + cook-success + adherence.
- **"Which dish has a problem & WHY"** [MOAT] — behavior × **GRIS food-science** join ("beginners overcook step 4"). *Your unique edge — "no generic analytics tool can match," IDEAS #14.*
- **Cook-success / failure rate per recipe** [FRONTIER+] — flag recipes that fail beginners → FIX them; needs the cook-result loop.
- **Deterministic semantic layer (~200 params = insight-type × metric-family × entity)** [MOAT] — LLM only NARRATES the number, never text-to-SQL. *The anti-hallucination admin design — your ~200-param ask, done safely.*
- **Supervised autonomy** [HAVE] — propose-only → review queue with diffs/blast-radius → policy-as-code floor (allergy fields read-only FOREVER) → canary. *EU AI Act Art.14 human-oversight on-bar.*
- **Cost / spend alerting + budget dashboards** [HAVE partial].
- **A/B & param-diff experiment readout** [FRONTIER+].
- **Anomaly / drift detection** on metrics + on shipped learned params [FRONTIER+].
- **B2B / API optionality instrumentation** [MOAT-strategy] — clean data so the taste-graph/allergen engine is licensable (grocery/meal-kit/insurer/CPG). *IDEAS #7, "the investor magnet on OUR terms" — instrument now, don't build.*

### GROUP 10 — OMNIPRESENCE (one brain across every surface)
*Frontier bar: ambient assistants attach to the current object, carry ONE thread, never make the user re-explain.*

- **Typed `AssistantContext` per surface** [HAVE] — `{route, recipeId, GRIS slice, focusedIngredientId, currentStepIndex, locale, reconciledAllergenSet}`.
- **ONE `conversationId` carried** recipe→cook→shopping→plan [FRONTIER+] — *not built; the user re-explains today.*
- **Ambient affordances** [FRONTIER+] — long-press-an-ingredient, "I'm-stuck-on-this-step", instead of an AI tab.
- **Live per-request context** [FRONTIER+] — `currentScreen/recipeId/stepIndex/clientLocalTime` every turn; ~5-surface client change, not passed today.
- **Help-with-THIS-step** [FRONTIER+] — answers the exact current step without re-stating; tool exists, live stepIndex not passed.
- **Same router/grounding/gate/cost-governor across web/voice/(future native)** [HAVE] — never a second brain.
- **Cross-surface action continuity** [FRONTIER+] — start a plan in chat, finish in the planner, items already there.
- **Connector omnipresence** [FRONTIER+] — calendar (meal-prep blocks), reminders, smart-fridge/appliance, grocery hand-off. *You have calendar + scheduled-task MCPs — a real surface-expansion path.*

---

## 4. PRIORITY TIERS — honest about effort + data needs

The map is the *enumeration*. This is the *order* — and it deliberately refuses "build the thousands." Of
~150 atoms, **~15–20 are the whole investment thesis; ~130 are table-stakes-to-excellent you execute over
quarters.** Build the measurement instrument first, then the moat, then breadth.

### Tier 0 — FOUNDATION (the instrument; blocks everything) — *build this week*
*Effort: low–moderate. Data needs: none — it's plumbing. Without it, every later capability is a screenshot argument instead of a regression line.*
- **The eval `meta` block** — structured, eval-only `{servedRecipeIds, droppedForSafety, toolCalls, action.status, coverage, honestyTag}` on every chat response. The keystone: it makes the agent *provable*.
- **Generalize the golden runner + a SAFETY.json suite** with its own fail-closed exit semantics (allergen-leak = HARD fail). Three numbers, never collapsed to one: task-success, safety-pass, hallucination-rate.
- **Cost honesty: populate `PRODUCTION_RATE_CATALOG`** so cost stops being `null`. You cannot pitch unit economics you can't measure.
- **Prompt-caching on the session preamble + Batch for offline jobs** — the cost flywheel's first turn; wire before you scale traffic.
- **The Agent SDK as the engine** — adopt the harness (tool-loop + MCP client + sub-agents + compaction) instead of a homegrown loop.

### Tier 1 — THE MUST-HAVE COMPANION (what makes it an agent, not a chatbot) — *next*
*Effort: moderate, mostly cheap tool-wrapping over already-tested services. Data needs: low — your DB already has the recipes, ingredients, USDA ids.*
- **The 3 write-tools behind one `confirm→write→audit→re-ground` wrapper**: `add_allergy`, `add_to_shopping_list`, `build_or_edit_meal_plan` — *closes your largest vision↔code gap and is the cheapest high-impact work on the board.*
- **`compute_nutrition` with the `coverage` flag** + **the 36%→100% gram-normalization data fix** (this one is real data work — the long pole of Tier 1).
- **User-model tools** (`get_user_profile`, `get_context` for date/time) + the **"what do you know about me?"** transparency surface.
- **Alias-graph wiring + Dutch answer-layer strings** — the Dutch launch-blocker; without it the EU general-public target fails on turn one.
- **Multi-turn working memory + coreference** — so "for 6 people" and "scale the second one" resolve.
- **`apply_swap` + event emission** — closes the ZERO-events hole *and* feeds L1 in the same build.

### Tier 2 — THE DIFFERENTIATORS (what makes $7 feel like $20) — *after the floor is proven*
*Effort: moderate–high. Data needs: HIGH — most of these are starved until Tier 1 starts emitting events and the cook-result loop exists.*
- **Adaptive recipe rendering** — the recipe re-renders per user (servings/swaps/seasoning/step-granularity). The highest-leverage use of everything built; you have the parts, not the product.
- **The learning loop, activated** — `populationMu` seed first (value at zero data), then the L1 ranker behind an **off-policy replay harness** (which does not exist yet — build it; don't mistake the content harness for it).
- **Cook-result feedback loop** (1-tap "how did it go?") — the data that makes year-2 > year-1.
- **Proactivity with a real control policy** — JITAI: acceptance-supervised penalty loop + the ≤3–5/day ceiling *enforced in code*, not just designed. Mistimed during-cook pop-ups are uniquely costly.
- **Multimodal** — fridge-photo → recipe (high wow-per-effort), dish-photo → "is it done?" Vision suggests; the gate still verifies.
- **Voice / hands-free cook-mode** — the category-defining bet, built via the Realtime/Live API. **The most expensive + complex item; earn it after the grounded core is solid.** Gate it behind an empirical Farsi/code-switch ASR validation.

### Tier 3 — THE ADMIN BRAIN + ADVANCED — *parallel from ~Tier 1, governed*
*Effort: moderate (read-only) → high (autonomy). Data needs: HIGH — needs the event substrate and non-null cost from Tier 0/1.*
- **L2b read-only insight** on the deterministic semantic layer — churn/retention, cohort curves, content-gap = authoring backlog, "which dish fails beginners & WHY" (behavior × GRIS). The first live-Gemini beachhead; can run in parallel.
- **L2b supervised autonomy** — propose-only → review queue with blast-radius → policy-as-code floor (allergy fields read-only FOREVER) → canary. EU AI Act Art.14 on-bar.
- **B2B/API optionality instrumentation** — instrument the taste-graph cleanly so it's *licensable*; don't build the B2B product, make it possible and put it in the pitch.
- **Connector omnipresence + household modeling + dietary-pattern health journeys** — the depth bets, after the floor.

**EU compliance is not a tier — it's a gate that sits across Tiers 1–3** [BLOCKER]: Art.50 disclosure, Art.9
consent gate, Dutch health-claim lexicon, DPIA before the live EU flip (Iran sandbox first). Cosmetic today.
Ship none of the live assistant to Dutch users until these are real.

---

## 5. WHAT MAKES IT DEFENSIBLE — the moat

[احتمالاً, investor-grade] The labs commoditized the *capabilities* — memory, tools, multimodal, voice are a
credit-card-and-an-API away for any competitor. **So the moat is never a feature on this map. It is four
compounding assets the labs cannot ship for you, and that a fast-following competitor cannot copy by calling
the same API:**

1. **The taste graph (the flywheel).** An ingredient-level food-intelligence layer —
   taste/texture/cookingBehavior/nutrition/allergen across 1008 ingredients + GRIS food-science + per-user
   learned taste vectors — that **compounds with every cook.** Recipes are content (copyable); the graph is
   proprietary data that gets sharper the more the app is used. This is what turns Garnish from "a cookbook"
   into "the taste intelligence of Persian, then global, cuisine." **Investors fund flywheels, not cookbooks.**
   *Defensibility: high and increasing. Status: parts built, product not — Tier 2 activates it.*

2. **Grounded, no-hallucination answers.** Retrieval as **function-calls over your own gated DB** (not a vendor
   vector store) + a **runtime groundedness validator** that refuses any entity-id no tool returned or any
   uncomputed quantity. Most "AI cooking" rivals hallucinate recipes and confidently invent food-safety advice.
   Garnish *structurally cannot* (when the validator is wired runtime, not just eval-side). **"Confidently
   wrong" is the #1 risk of AI cooking advice — and the one you've designed out.** *Defensibility: medium-high;
   it's a discipline rivals keep failing.*

3. **The deterministic safety gate (the crown jewel).** A HARD, fail-closed allergen + observance gate
   **outside the LLM** — declared allergens never enter a prompt, output re-screened, UGC excluded, per-table
   userId-scoped tools enforcing data ownership in code. Public guardrail benchmarks show rivals' model-level
   safety jailbreaks at 15–30%; your gate is not the model's discretion, so it doesn't jailbreak. **This is
   your strongest, most SOTA-grade asset — guard it byte-for-byte and never let any "smarter model" become the
   safety authority.** It is also the thing that makes the health/diet vertical (Group 6/9) legally shippable
   when rivals can't. *Defensibility: high; regulatory + trust moat.*

4. **The cost flywheel (the unit-economic moat).** The fold-back loop — LLM handles a novel turn → the system
   captures it → deterministic logic learns to handle it for €0 next time — plus prompt-caching on the session
   preamble and effort-routing. The result every investor wants to hear: **unit cost per turn bends *down* as
   usage grows**, instead of the linear LLM-bill-per-user that sinks most AI-wrapper margins. Combined with the
   ~$1.14/user-month ceiling and denial-of-wallet governor, this is a defensible *margin* story, not just a
   product story. *Defensibility: medium-high; needs the `AiTurnDecision` substrate (absent today) to become
   real.*

**The honest one-line moat thesis for the deck:** *"Everyone can buy the AI. No one else has the taste graph
that compounds, the safety gate that lets us ship health/diet where they legally can't, the grounding that
makes us trustworthy where they hallucinate, and the fold-back loop that makes our margins improve with scale.
The app is the data engine; the four of those together are the wall."*

---

## نتیجهٔ عملی (the precise next step — one move, not a menu)

**This week: build Tier 0 — the eval instrument — before any agent autonomy.** Concretely, the keystone is the
structured `meta` block (`servedRecipeIds` + `droppedForSafety` + `toolCalls` + `coverage`) on the chat
response, the generalized golden runner, and a `SAFETY.json` suite with fail-closed exit semantics — plus
populating `PRODUCTION_RATE_CATALOG` so cost stops being `null`. **Why this and not the exciting stuff:** the
moment the companion can plan and act, the number of ways an unsafe recipe can reach a user multiplies — you
must be able to *prove* the gate holds before you add the autonomy that stresses it. And it gives you a
regression net for free, so every capability you then pull off this map turns into a red→green line in a diff
instead of an argument. **Then, in order: Tier 1 (the 3 write-tools behind one wrapper + alias-graph + Dutch +
compute-nutrition) → the four moat rows in Section 5 — taste-graph activation, runtime groundedness, the
gram-normalization data fix, the fold-back substrate — NOT the breadth.** Build the 15–20 that are the thesis;
let the other ~130 follow as regression lines.

> **One pushback, stated plainly [مخالفم, سازنده]:** the instinct to enumerate "thousands of parameters" is
> right for *ambition* and wrong for *sequencing*. Breadth before (a) the agent loop is wired, (b) one learning
> loop is closed, and (c) cost + nutrition are *measurable* is exactly the over-engineering your own
> `AI_COMPANION_REARCHITECTURE.md` warns against ("a stream of regex patches that never converges"). Don't let
> "thousands of params" become the reason to defer the instrument that makes any of them real.
