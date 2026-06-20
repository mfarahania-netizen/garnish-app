# Garnish AI Standard & Phased Roadmap

> The world-class bar for Garnish's two AI pillars, grounded in 2025–2026 SOTA (see `_research/ai-sota.md`) and in the *actual* code-grounded state of the app today.
> Persian-first product. Founder's bar: true premium ($7 that feels like $20), learning not rules, investor-magnet, ruthless-no-flattery.
>
> **The one-sentence thesis:** Garnish does NOT need to "build AI from scratch." It needs to *flip on* a live model already wired behind a fail-closed allergy gate, *plug in* the structured data moat that is built-but-unused, *make the assistant act* (not just answer) via tools, and *layer* an insight+supervised-change agent on top of the honest analytics substrate it already has — all on a no-rework layered path where each layer auto-activates the next.

---

## A. The Two Pillars (restated)

**L2a — The Omnipresent User Assistant.** Helps *anywhere in the app, on anything* — ingredient swaps, recipe, method, and during-cooking problems — on-the-second, fully grounded in the whole DB, LIVE (not rules/filters). The user never feels lost ANYWHERE. It is the premium layer ON TOP of a deterministic system that still works when the model is down.

**L2b — The Admin-Analytics AI.** Analyzes ALL app+user data into ~200 categorized parameters for an admin panel (trends, problem dishes, what's good/bad/where), and proposes positive changes the founder approves — supervised, auditable, reversible. Learning, not a rules engine.

**Non-negotiable invariant shared by both:** the **HARD allergy/safety gate is deterministic and lives OUTSIDE the LLM**, applied BEFORE any context reaches the model and AFTER any output leaves it. It fails closed. No generation path may bypass `assessRecipeFit` / `analyzeRecipeIntegrity`, and declared allergens are NEVER injected into a prompt (only the pre-filtered SAFE set is).

---

## B. Target Architecture

### B.1 — L2a: omnipresent, DB-grounded, real-time, tool-using, never-lost

**Grounding strategy — IN-CONTEXT CACHED CORPUS + TOOL-CALLING, *not* vector RAG.**
At ~1,008 structured ingredients Garnish is in the band where in-context beats RAG on precision, latency, and debuggability and eliminates retrieval-miss hallucination. Concretely:

```
Prompt layout (Claude, prompt-cached):
┌─ CACHED PREFIX (1-hour TTL during a cooking session) ───────────┐
│  system rails + domain tool defs                                 │
│  + full ingredient table (taste/texture/cookingBehavior/         │
│    allergens/substitutionOptions, serialized "LLM-wiki" style)   │
│  + GRIS v2.1 schema                                              │
├─ PER-SCREEN (below cache boundary) ─────────────────────────────┤
│  the current recipe's GRIS doc + focused entity                  │
├─ VOLATILE SUFFIX (never cached) ────────────────────────────────┤
│  minimal derived L0 signals (allergens, dislikes, skill level)   │
│  + the user turn + typed AssistantContext                        │
└──────────────────────────────────────────────────────────────────┘
```

**The typed `AssistantContext` every screen emits** (the cheapest, highest-leverage thing — makes "help on anything here" need zero user explanation):
`{ route, recipeId, GRIS slice, focusedIngredientId + its full structured attrs, currentStepIndex, L0 derived signals, allergySet }`.

**The assistant ACTS via a closed allow-list of grounded tools** (architectural scoping > prompt scoping — it physically cannot answer except through tools that already enforce the gate). Reuse Garnish's existing 8 read-only tools, promoted from "one-per-HTTP-route human router" to **LLM tool-caller (ReAct / function-calling)**:
`search_ingredients · get_recipe_gris · check_allergy_gate · find_substitutes · scale_recipe · explain_step · diagnose_problem · suggest_pairings`.
Outputs render as **native interactive cards (Generative-UI style)**, never prose. An "apply swap" tap both helps the user AND emits the swap event currently lost (closes the ZERO-events gap *for free*).

**Grounding guarantees:**
- **Constrained/structured-output decoding on the data SLOTS only** (ingredient IDs, substitution choices, citations must EXIST in the DB) — leave the Persian explanation free (over-constraining hurts reasoning).
- **Span-level provenance** — every factual claim carries a field pointer ("per USDA-locked nutrition", "curated substitution table", a GRIS step), rendered for trust and reused as L2b's audit trail.
- **Anthropic grounding tactics enforced in the system prompt:** external-knowledge restriction (answer ONLY from retrieved records), verify-with-citations (retract unsupported claims), explicit permission to say "I don't know" rather than invent a ratio/temperature.

**Real-time / during-cooking (the hard, high-differentiation part):**
- Optimize **TTFT, not total latency** — stream the first corrective instruction (<~300ms / <500ms TTFT), let grounding detail trail.
- **Model tiering:** Haiku 4.5 for the long tail (conversions, timers, simple swaps); escalate to Opus only for during-cook diagnosis + multi-constraint reasoning.
- **Multi-tier caching:** provider prefix-cache + app-side semantic cache for common swap/method Qs — **but allergy/substitution cache hits are re-validated against the live record** (never serve a semantic-cache neighbor for safety answers).
- **Selective, timed intervention (AROMA's core finding): default to silence.** Proactively warn ONLY at step boundaries, GRIS `commonMistakes` failure points (emulsion, caramel, dough hydration), or allergy hard-stops. Respect the ~3–5/day attention ceiling. A mistimed during-cook pop-up is uniquely costly.
- **Voice/vision (next-horizon, highest-differentiation, lowest-competition):** Gemini Live / gpt-realtime for hands-free + **live-camera "my sauce broke"** (point the phone at the pan). Surface tool calls as explicit auditable steps so speech-to-speech doesn't hide the allergy gate. Semantic turn-detection + barge-in for kitchen noise. Verify Farsi quality empirically before any on-device routing.

**Graceful degradation:** on model timeout/unavailability/low-confidence, fall back to the *existing* deterministic layer (curated substitutions + hard allergy filter + `composeDeterministicReply`). The screen is never dead — that is the literal mechanism for "never lost ANYWHERE."

### B.2 — L2b: admin-analytics over ~200 params + supervised autonomy

**Grounding substrate — a SEMANTIC LAYER, never raw text-to-SQL.** (dbt MetricFlow, Apache-2.0 since Dec 2025, or Cube.) The LLM only decomposes a question into metrics + dimensions; the engine generates queries deterministically. Benchmark: 98–100% vs 84–90% for text-to-SQL, and **failure becomes an error message, not a silent-wrong number** — the only acceptable property for a founder-facing panel.

- **Metrics:** completion rate, step drop-off, swap rate, rating, retention, planner adherence, AI-abstention rate.
- **Dimensions:** dish, step, ingredient, cohort, skill-level, screen.
- Built ON TOP of the existing `AnalyticsIntelligenceService` (the honest "real-or-`awaiting_pilot`" metric base) — **do not replace it.**

**The ~200 parameters = a DEFINED TAXONOMY, not 200 dashboards:**
`parameter = (insight-type from a fixed catalog, e.g. Tableau Pulse's 13) × (metric family) × (entity)`.
Each parameter resolves to ONE deterministic semantic-layer query; the LLM only narrates. Each is tagged `real | awaiting_pilot | inferred` (mirroring the existing honesty convention). Auditable, testable, reaches 200 without bespoke builds.

**"Which dish has a problem and WHY" = a metric-tree / decomposition engine** (Top Drivers / Detractors / Concentrated Contribution). Contribution math is done **deterministically**; the LLM narrates: *"completion fell 12%, driven mostly by Step 4 of Ghormeh Sabzi for beginner users."* **Garnish's moat in the WHY layer:** join behavioral events to GRIS food-science + per-ingredient `cookingBehavior` so diagnostics reach recipe-content depth — *"Step 4 timing is ambiguous for this ingredient's cookingBehavior"* — which generic Amplitude/Mixpanel agents cannot do.

**Proactive, not pull:** nightly anomaly + trend-break scans push narrated alerts ("saffron swap spiked 3×", "beginner abandonment on dish X breached threshold"). The same substrate later feeds supervised changes.

**Multi-agent shape with an explicit "out":** manager (out-of-domain detect + route) over workers (presenter / insight-generator); math via deterministic tools; **explicit refusal when a question exceeds the data** — the L2b analogue of L2a's hard allergy gate, and the single most important anti-hallucination lever for a panel the founder acts on.

**Supervised autonomy (propose → approve → apply, reversible):**
- Default to **PROPOSE-ONLY** (Claude Agent SDK `plan` mode / LangGraph `interrupt()` before every write). Nothing mutates the DB until the founder approves/edits/rejects.
- **Founder review surface** = moderation-style queue. Each proposal shows: (a) the AI's reasoning, (b) a concrete before/after DIFF of exact rows/fields, (c) blast radius, (d) the L0 behavioral evidence that triggered it, (e) Approve / Edit / Reject / Snooze. Every decision logged with attribution + timestamp.
- **Policy-as-code OUTSIDE the LLM** (OPA / Cedar): "AI may stage but never DELETE", "no write >N rows without escalation", **"allergen/safety fields are read-only to the agent."** A prompt-injected agent is *structurally* unable to violate these.
- **Never write to production directly:** apply to a staging copy → ship behind a feature flag / canary to a small cook segment → **use L0 signals (cook_complete, abandonment, swap) as the canary metric** → auto-rollback on regression, promote on improvement.
- **Autonomy ladder (CSA/NIST):** start every change-type at Tier 1; graduate only proven low-blast-radius categories (dishType tagging, chefTip phrasing); keep substitutions feeding the allergy gate **permanently human-in-the-loop.** (Also the EU AI Act Art. 14 governance story, enforced Aug 2026.)
- **Reasoning-linked audit + async correction loop:** founder edits/rejects feed NL reasons back to improve future proposals → the panel *learns* instead of staying rules-based.

---

## C. How it grounds on L0 + L1 + the structured data moat

| Layer | What it is today | How the AI uses it |
|---|---|---|
| **L0 — live behavioral profile** | `getLivingUserProfile` composes declared + observed (SignalObservation-hydrated) food-identity graph with a reconciled allergy dimension; maturity/coverage bands. Frozen, byte-identical, feeds the allergy filter. | **L2a:** the allergy set is established FIRST and gates retrieval; only **minimal derived signals** (allergens, dislikes, skill level) go into the volatile prompt suffix — never the raw profile (privacy + cost + cache-bloat). **L2b:** L0 maturity bands + observed signals are canary metrics and the "evidence that triggered a proposal." |
| **L1 — taste ranker** | The recsys ranker (~0% learning today per the world-class program). | **L2a:** the assistant's `find_substitutes`/`suggest_pairings` should *call* the ranker for personalized ordering, and the "apply swap" events it emits become **the ranker's missing training signal** — L2a is how L1 finally starts learning. **L2b:** "recsys quality" is one of the ~200 params (offline-eval-harness-backed). |
| **Structured data moat** | Per-ingredient taste/texture/cookingBehavior/nutrition(USDA source-locked)/allergens/substitutionOptions × ~1008; `Recipe.gris` (GRIS v2.1). **Built but unplugged — assistant sees only keyword `contains` today.** | **L2a:** serialized into the cached prefix (LLM-wiki) + exposed via tools = grounding goes from keyword-`contains` to structured-knowledge grounding (the 2025 GraphRAG thesis). **L2b:** the GRIS/ingredient ontology is the domain layer that makes "WHY" answers reach food-science depth instead of platitudes. |

**Cross-cutting prerequisite (blocks both pillars learning):** close the **observability gap** — swaps emit ZERO events today; instrument every assistant turn (intent, step, photo-attached, tool calls, resolution) and every swap/scale/remove. This is the raw material L2b mines and the signal L1 learns from. *No semantic layer or metric tree is better than the events under it.*

---

## D. Phased Build Plan (no-rework, layered, each phase auto-activates the next)

> Ordering principle: ship the cheapest grounding + safety wins first behind the existing gate; instrument as you go so later phases have data; keep every layer additive so nothing is thrown away.

**Phase 0 — Observability + cost honesty (prerequisite; unblocks everything).**
Instrument swap/scale/remove + every assistant turn as structured events. Populate the empty `ai-cost-rate-catalog` with verified Gemini/Claude rates so the existing budget/spend-alert machinery becomes a real cost governor. *Auto-activates:* L1 learning signal + L2b's data substrate.

**Phase 1 — L2a grounding enrichment (no live model yet).**
Plug the moat into the deterministic path: enrich retrieval beyond keyword `contains`; serialize the ingredient corpus + GRIS into a prompt-cacheable prefix; expose taste/texture/cookingBehavior via tools. Build the typed `AssistantContext` + the inline ambient affordance (long-press ingredient, "I'm stuck" on cook-mode) — destination-less, calm. *Ships value even while stubbed.*

**Phase 2 — Flip live LLM on, controlled pilot.**
Enable live chat behind the existing `buildLivePrompt → guards → screenLiveOutput` rails. Gate the flip on: cost catalog populated (Phase 0), output-safety regression corpus + pilot-readiness gate green, **a Persian golden eval set** (allergen edge cases, swap correctness, scaling math, during-cook fixes). Add prompt caching + Haiku/Opus tiering. *The allergy gate stays the source of truth; LLM only explains it.*

**Phase 3 — Make the assistant ACT (agentic tool-calling + Generative UI).**
Promote the 8-tool layer from human-router to LLM tool-caller (ReAct/function-calling); render swap/scale cards; constrain data slots; add span-level citations. The "apply" tap emits events (feeds Phase 0). *Auto-activates:* L1 ranker learning from real applied swaps.

**Phase 4 — Real-time during-cooking.**
Streaming token output, stream-safe per-segment gating, selective AROMA-style intervention at GRIS failure points, semantic cache for common Qs. Then the next-horizon: Gemini Live voice + live-camera "my sauce broke." *Highest differentiation, lowest competition.*

**Phase 5 — L2b semantic layer + ~200-param taxonomy (read-only).**
Stand up the semantic layer over events/recipes/ingredients/GRIS/L0 on top of `AnalyticsIntelligenceService`. Define the (insight-type × metric-family × entity) taxonomy, each param a deterministic query tagged `real|awaiting_pilot|inferred`. Add the metric-tree decomposition engine + nightly anomaly scans. Build the eval harness (Correctness/Completeness/Relevance, Persian-calibrated judge). *Read-only — no changes yet.*

**Phase 6 — L2b supervised autonomy (propose → approve → apply).**
PROPOSE-ONLY agent in `plan` mode; founder review queue with diffs + reasoning + blast radius + Approve/Edit/Reject; policy-as-code floor (no DELETE, allergy fields read-only); staging + canary on L0 signals; autonomy ladder starting at Tier 1; reasoning-linked audit + async correction loop. *Graduate only low-blast-radius categories; allergy-relevant changes stay human-in-the-loop forever.*

---

## E. Guardrails (apply to BOTH pillars)

- **Scoped/bounded model — architecturally, not by prompt.** Closed tool allow-list + a Constitutional-Classifiers-style input/output guard (keeps the model in the food domain, hard-blocks unsafe food-handling advice). "Stay on cooking topics" in a system prompt is NOT a security boundary — it falls to injection.
- **Safety is deterministic and outside the LLM.** The hard allergy gate (`assessRecipeFit`/`analyzeRecipeIntegrity`) runs pre-injection and post-generation, fails closed; declared allergens never enter a prompt. Techniques reduce but do NOT eliminate hallucination — the gate stays ground truth, the LLM only explains it.
- **Cost/latency.** Prompt-cache the stable prefix (volatile content MUST go last or the cache is destroyed); Haiku→Opus tiering; Batch API for L2b's scheduled synthesis (never for interactive turns); target TTFT <500ms; graceful degradation to the deterministic floor.
- **Privacy.** Send only minimal derived L0 signals per turn, never raw PII/account data; tokenize identifiers; zero-data-retention tier; semantic (not keyword) redaction; aggregates-only in L2b (already the convention).
- **Human-in-the-loop for changes.** Every L2b change is a typed, schema-validated, reversible, audited proposal a human approves before it lands. Match approval intensity to risk (batch + rank low-risk to avoid rubber-stamping); auto-rollback on signal regression; keep irreversible/allergy actions permanently human-gated. For L2a, any action that changes saved user state (apply swap, scale, edit plan) is preview-then-confirm.
- **Eval before trust.** Trace every turn; LLM-as-judge for "grounded in cited record?" + "respected allergy gate?"; a Persian golden set is a release gate (English benchmarks do NOT transfer); calibrate the judge against human-labeled Persian examples.

---

## F. Hard anti-patterns (the founder should reject these on sight)

1. Building a vector RAG store over ~1,008 structured records (over-engineering; adds retrieval-miss hallucination for zero benefit).
2. An "AI tab" / loud branded AI bubble (defeats omnipresence; Windows had to walk it back).
3. Free-form text-to-SQL anywhere (fails silently; ~10–17% on realistic schemas).
4. Letting the LLM enforce allergens, do scaling arithmetic, or compute analytics numbers (all deterministic; LLM only narrates).
5. Treating today's deterministic `composeDeterministicReply` / `AnalyticsIntelligenceService` as "we already have AI" (there is no live model and no insight agent — both pillars are ~0% generative today).
6. Flipping live Gemini on without the cost catalog, pilot gate, and Persian eval set (re-introduces exactly the risks the kill switches contain).
7. An admin AI that writes to production without staging + diff + approval + audit (irreversible corruption of the moat corpus).
