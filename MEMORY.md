# Garnish Memory Index

Last updated: 2026-06-24

## Non-negotiable method
- Advisor mode: confidence tags, direct disagreement when needed, no flattery, no inflated state.
- Every piece closes by dimension: what it must do, exact gates, files/runtime path, tests, 100% status, remaining gaps.
- Deterministic-first; the LLM narrates deterministic facts and never decides safety, quantities, or truth.
- Allergy/safety gate stays outside the LLM, pre+post, fail-closed. Learning may only change data the core reads.
- Live Gemini requires founder VPN. Stop and ask before any future live Gemini call.
- Production rates are allowed only when source-verified, dated, and exact-model matched.

## Current AI phase
- P0 Observability + Cost Honesty + Safety-Wiring is closed as of commit `227db7e7` plus docs commit to follow.
- P1 has started: the multi-turn memory slice is built and verified; fa/nl/en TemplateRegistry, repair, retrieval upgrades, cross-surface context, and groundedness remain.
- Default live model is now `gemini-3.1-flash-lite`, aligned to the verified production rate row.

## Latest completed work: assistant relevance audit + fixes
- Date: 2026-06-25. Commits: `90fe933e`, `97fb297e`. Founder asked to "test every word/term/phrase" after a screenshot showed irrelevant «لپه» results + Latin difficulty labels.
- Method: live-probed ~40 Persian queries (Node/UTF-8 — PowerShell mangles Persian bodies; single guest + 3.3s pacing for the 20/min throttle) + a 5-lens multi-agent Workflow audit.
- Fixed + verified live: ranking title>ingredient>desc + de-weight generic dish words (خورش/آش/پلو/کباب) so «خورش قیمه»→قیمه dishes; colloquial→canonical ingredient alias map (شیر/تخم مرغ/کره→کره بدون نمک/گوجه/رب گوجه/پیاز…) alias-first+raw-fallback, ZWNJ-insensitive gate (raw OR alias); bare «جای X» now a substitution anchor; non-recipe intents (greeting/feedback/medical/ood/nutrition/technique) get canned replies not recipe dumps; gibberish/empty/scaling get a NEUTRAL clarifier (not allergy-flavored); difficulty labels rendered Persian.
- Suite: 250 suites / 2062 tests green.
- RESIDUALS (handoff §4l + ideas): لپه/iconic ranking (no popularity signal); Finglish/typos/Dutch/diet/NEGATION («بدون گوشت» may include meat — possible bug, do first)/during-cook coverage thin; saffron data gap (گلرنگ absent).

## Latest completed work: intent-aware assistant routing (substitution)
- Date: 2026-06-25. Commit: `1d00f77c`. Founder-chosen P1 after the assistant revival.
- A substitution question («جایگزینِ ماست چی بزنم؟») now answers with a SWAP, not a recipe list. Classifier already labels `substitution`; chat used to ignore it.
- Routes `intent==='substitution'` → grounded, allergy-filtered SubstitutionEngine (`AiAssistService.substitutions` + nutrition guard). Ingredient extracted deterministically (`extractSubstitutionTargets`, phrase-first); declared allergies sourced from the SAME reconciled profile as the hard gate (`GroundedReplyService.getDeclaredAllergens`; null=fail-closed → no unfiltered swap).
- Resolution upgraded (contains+take-1 → EXACT → base+modifier → shortest), so «کره»→«کره شور» (real butter) not «کره سیب» (apple butter). `isConfidentIngredientMatch` + a confidence gate: a confidently-WRONG resolution is NEVER surfaced — falls through to the safe grounded path.
- Verified live + 250 suites / 2056 tests. KNOWN BOUND: precision is capped by the USDA dictionary lacking colloquial base rows (no plain «کره»/«تخم مرغ»); next lift = colloquial-alias map / dictionary base entries (data-quality initiative).

## Latest completed work: chat assistant retrieval revival (the "dead assistant")
- Date: 2026-06-25. Commit: `ce9ba378`.
- Symptom: the UI assistant felt dead — every turn returned "no safe match".
- Root cause: NOT wiring/auth/CORS (those were fine; `/ai/chat` returned 200). `search_recipes` matched the WHOLE prompt as one substring, so any natural-language turn (incl. all 3 UI starter chips, which are full sentences) retrieved nothing. Codex's memory slice also fed the annotated `[SHORT_TERM_MEMORY_UNTRUSTED]` block to retrieval, dead-ending turn-2+.
- Fix (deterministic, hard allergy gate UNCHANGED): `persian-search.ts` (Arabic kaf/yeh + digit fold; tokenize -> content terms; stopword strip; bare keyword falls back to whole query). `search_recipes` OR-matches content terms + ranks by distinct-term hits. `chat-orchestration` feeds grounding a CLEAN retrieval query (current turn + recent USER turns) while the annotated block still feeds the LIVE LLM.
- Safety: intent classify, §3 declaration detection, and `extractStatedAllergens` still read ONLY `input.prompt`.
- Verification: full server suite 250 suites / 2038 tests green; server tsc green; live guest-auth probe of all 3 starters + a 2-turn follow-up returns real grounded recipes. Browser-pixel pass not run (preview can't reuse external :5173; no Chrome extension) — proven at the API layer + web `assistant.smoke.test`.
- Follow-up: a substitution question still returns matching recipes, not a substitution — intent-aware routing is the next layer.

## Latest completed work: onboarding/auth dev-loop CORS fix
- Date: 2026-06-24 (committed 2026-06-25).
- Commit: `1685480a fix(server): allow same-port loopback CORS peer for dev auth`.
- Claude verification (2026-06-25): Tier 0 green (server 249 suites/2026 tests, server tsc, web 36/169, web build); Tier 1 diff read clean — no wildcard, same-port loopback only; safety-critical files (allergen-extractor/recipe-integrity/recipe-visibility/users.service) unchanged; memory boundary intact (intent/extractStatedAllergens/§3 read only input.prompt); requestId echo additive (no safety-filter bypass). CAVEAT: the verified `gemini-3.1-flash-lite` rate ($0.25/$1.50 per 1M) is identical to the prior unverified guess; live-smoke proves a call + non-null cost rows but does NOT independently confirm the price number (cost is computed FROM the catalog) — re-confirm against the live pricing page (VPN) before any cost claim leaves the system.
- Bug: the app could appear stuck in onboarding/login when opened from Vite's `http://127.0.0.1:5173` URL while the server allowed only `http://localhost:5173` in CORS.
- Root cause proof: local auth from `Origin: http://localhost:5173` returned CORS headers and `/users/me` worked; local auth from `Origin: http://127.0.0.1:5173` previously returned no `Access-Control-Allow-Origin`, so browsers blocked login/register responses.
- Fix: server CORS now keeps configured origins narrow, but expands same-port loopback peers between `localhost` and `127.0.0.1`; no wildcard.
- Verification: register/login/users-me from `Origin: http://127.0.0.1:5173` all return OK with `Access-Control-Allow-Origin: http://127.0.0.1:5173`; server full test, server tsc, web test, and web build passed.
## Latest completed work: P1 multi-turn memory slice
- Date: 2026-06-24.
- Commit: `d00b1980 ai: wire chat short-term memory` (docs closure commit follows).
- Built: `ChatMessageService.listRecentForMemory(userId, conversationId, limit=8)` reads only the current user's user/assistant turns, newest-limited then oldest-first.
- Built: `ChatOrchestrationService` now builds a deterministic short-term memory prompt before chat grounding: untrusted summary, 8 recent verbatim turns, and the current user turn last.
- Safety boundary: memory is context only. Intent classification, conversational-allergy detection, and confirm-then-write still read `input.prompt` only; memory cannot auto-write an allergy.
- Failure mode: if memory read fails, chat falls back to the raw current prompt and continues safely.
- Tests: focused chat memory/safety tests, grounded reply tests, cross-dimension acceptance, full server test, server `tsc --noEmit`, web test, and web build all passed.
- Closure status: 100% for the multi-turn memory slice. Dimension 1 as a whole is NOT 100% closed yet: TemplateRegistry Dutch, conversational repair, cross-surface context, retrieval upgrade, and groundedness validator remain.
## Latest completed work: verified Gemini rate catalog / whole-P0 closure
- Date: 2026-06-24.
- Commit: `227db7e7 ai: promote verified Gemini rate catalog`.
- Source: official Google AI for Developers Gemini API pricing page, verified 2026-06-24: `https://ai.google.dev/gemini-api/docs/pricing`.
- Built: `PRODUCTION_RATE_CATALOG` now contains an active, source-attributed `gemini-3.1-flash-lite` row (`$0.25/1M input`, `$1.50/1M output`, USD). `REFERENCE_RATES_2026` keeps nearby tiers inactive.
- Model alignment: server default `AI_MODEL_NAME` moved from stale `gemini-2.5-flash` to `gemini-3.1-flash-lite`; `.env.example`, eval harnesses, and tests were updated.
- Runtime cost: `estimateCostUsdFromCatalog('gemini','gemini-3.1-flash-lite',...)` now returns non-null. Unknown models still return null.
- Spend alerts: daily estimated cost is now a real UTC-day aggregate from `AICallLog.estimatedCost`, not a per-call fake or hardcoded null.
- Ops: economics reports `awaiting_pilot` when verified rates exist but no rated rows exist, and `real` when rated rows exist.
- Live proof: controlled live Gemini smoke executed with VPN + real key + `RUN_LIVE_AI_SMOKE=true`: 3 safe live calls, 0 provider calls for blocked prompts, 6 AICallLog writes, 3 rows with non-null `estimatedCostUsd`.
- Tests: server `npm.cmd test` passed (248 suites / 2018 tests); server `npx.cmd tsc --noEmit` passed; web `npm.cmd test` passed (36 files / 169 tests); web `npm.cmd run build` passed.
- Closure status: P0 is 100% closed under the current spec gates previously tracked in handoff. P1 remains not started.

## Previously completed work: non-VPN P0 observability + Redis quota closure
- Date: 2026-06-24.
- Commit: `60c8c45b`.
- AICallLog fields `intent`, `tier`, `cacheHit`, `cacheTokens`; P0 producer inventory truth for assistant-turn and swap/scale/remove; Redis-atomic live quota.
- Closure status: 100% for non-VPN P0 observability/quota.

## Previously completed work: assistant-turn EventOutbox / tier tagging
- Date: 2026-06-24.
- Commits: `ce0d9fbb`, `559c5c73`.
- Every assistant reply emitted by `ChatOrchestrationService.handleChat` records structured `ai_suggestion_generated` via `AnalyticsService.trackEvent` and EventOutbox.
- Closure status: 100% for assistant-turn EventOutbox/tier tagging.

## Previously completed work: requestId echo propagation + capstone closure
- Date: 2026-06-24.
- Commits: `639065b1`, `3ce75146`, `0f292da2`.
- Recommendation served-slate `requestId` round-trips through Home, web impressions, controller payload, EventOutbox, and `RecommendationAttributionEvent.requestId`.
- Closure status: 100% for requestId echo.

## Dimension closure rule going forward
For every AI/spec dimension or piece, close with:
1. What the dimension must do.
2. Exact pass/fail gates from `docs/audit/AI_MASTER_SPEC.md`.
3. Files changed and runtime path.
4. Unit + integration/acceptance tests run.
5. Whether it is 100% closed.
6. If not 100%, exact remaining gaps and next smallest step.

## Immediate next step
Move to P1 only after Claude verifies Codex work from baseline `6b584134` using `docs/audit/CODEX_BRIDGE.md`: committed diff + the two remaining unstaged historical QA JSONs. Recommended next P1 step: fa/nl/en TemplateRegistry (Dutch required) or conversational repair; multi-turn memory slice is now built and verified.

## Known repo/document caveats
- `apps/web` currently has no `tsconfig*.json` and no local `typescript` dependency; documented `npx tsc --noEmit` is not a real web gate yet.
- Existing unrelated modified files remain unstaged/uncommitted: `docs/qa/ai/e47_a12_ai_internal_pilot_readiness_results.json`, `docs/qa/analytics/e43_a2_event_producer_migration_results.json`.