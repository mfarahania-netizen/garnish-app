# Chat Intelligence — URGENT Execution Plan (the "make it genuinely smart" track)

> **Status:** ACTIVE / top priority (founder: the chat is «پایهٔ اصلیِ اپ» — the core foundation). The old
> aspirational AI design spec was RETIRED 2026-06-26; the AI source of truth is now
> [`AI_COMPANION_REARCHITECTURE.md`](AI_COMPANION_REARCHITECTURE.md) (architecture) +
> [`AI_WORLDCLASS_CAPABILITY_MAP.md`](AI_WORLDCLASS_CAPABILITY_MAP.md) (full capability map). THIS doc is the
> prioritized EXECUTION list of chat fixes (shipped + remaining). Grounded in the 2026-06-26 multi-agent chat
> audit (45 verified findings) + live verification.
> **Confidence tags:** [قطعی]/[احتمالاً]/[حدسی]/[نامطمئن].

## The brutal diagnosis (why it felt like "20-year-old tech")
[قطعی] The assistant answered by **keyword substring** and **ignored the corpus's rich metadata**, so it could
not reason about a *criterion*. Three founder-visible failures, all root-caused:
1. **It denied food it owns** — «غذای خارجی» → «فقط ایرانی داریم», though the corpus has **163 international
   recipes**. Cause: retrieval never read `Recipe.region` AND the live prompt literally ordered the model to deny
   foreign food.
2. **It couldn't filter by criterion** — «شام»/«دسر»/«سریع»/«رژیمی» returned unfiltered or empty results.
   `mealType`/`cookingTime` were populated but never queried; stray colloquial verbs («میدی»/«داری») over-constrained.
3. **Cost was totally blind** — the founder couldn't see tokens/cost. Cause: the AICallLog observability migration
   was never applied to the running DB → every real Gemini call threw P2022 on its ledger write, silently swallowed.

Plus a **safety leak** the audit surfaced: halal/kosher/no-pork users were served pork (the chat gate dropped only
allergen conflicts, not the observance constraint).

## DONE this session (shipped + live-verified)
- **[قطعی] Pork/observance HARD gate** (`e2283577`) — halal/kosher/no-pork users never get pork (gate now drops
  `avoid_constraint`; FIT_SELECT reads `containsPork`). New leak test. **Safety invariant.**
- **[قطعی] Criteria retrieval** (`b9224b20`) — `parseSearchQuery` extracts region/mealType/cookingTime (token-exact);
  `search_recipes` ANDs them into the WHERE. Live: «خارجی»→شاورما/پیتزا, «شام»→واویشکا/گمج‌کباب, «دسر»→شله‌زرد/فرنی,
  «صبحانه»→املت, «سریع»→≤30m. Deleted the "deny foreign" prompt + the Persian-only identity. Fixed «بی»-suffix
  collision (کبابی بادمجان) + stray-verb over-constraining.
- **[قطعی] Recipe DELIVERY inline** (`bf390a1e` + units in `b9224b20`) — «دستور پختش» returns real ingredients
  (WITH unit: «گوشت چرخ‌کرده — ۴۰۰ گرم») + ordered steps from GRIS, deterministic.
- **[قطعی] Cost/token observability** (migration applied + `3e542259`) — real per-turn provider token counts now
  persist («in:783 out:138 tot:921 src:provider»); failures now log `err.code`.

## REMAINING — prioritized (file:line + pass/fail)

### P0 — ship next (correctness/safety the founder will hit)
1. **Remembered-recipe / ordinal memory** [قطعی CRITICAL] — `chat-orchestration.service.ts:~412` + delivery `:216`.
   «اولی رو»/«دستورش رو بده»/«اون که گفتی» retrieve the WRONG recipe — the assistant has **zero memory of what it
   just recommended** (retrieval is built from USER turns only). Fix: persist the ordered shown recipe ids on the
   assistant message; a deterministic ordinal/anaphor resolver short-circuits `getRecipeContent(ids[i])` before
   retrieval re-runs. **Pass:** recommend 3 → «دومی رو بده» delivers recipe #2, not a re-search.
2. **Topic-shift vs refinement** [قطعی HIGH] — `chat-orchestration.service.ts:~412`. «دسر چی داری» after a lamb
   thread still mixes the prior dish (memory pollution). Make the carry intent-aware: a NEW dish/criterion resets;
   a pure modifier («کمتر/گیاهیش/بدون») refines. **Pass:** mid-thread «دسر چی داری» returns desserts only.
3. **Recipe-delivery ambiguity guard** [قطعی HIGH] — `chat-orchestration.service.ts:216`. `wantsRecipeDetail` takes
   `safeRecipes[0]` blindly → can deliver the WRONG full recipe with full confidence. Gate on a strong title match
   OR exactly one safe recipe; else list. Also: `wantsRecipeDetail` over-triggers on bare «چطور» — require a dish.

### P1 — intelligence depth + cost completeness
4. **$ cost** [قطعی HIGH] — `ai-cost-policy.ts` `PRODUCTION_RATE_CATALOG=[]` → `estimatedCost` always null. Add a
   verified gemini-3.1-flash-lite pricing row → real per-turn/per-user USD. Add `GET /admin/ai/usage?userId=` (sum
   tokens/cost/count) so the founder can SEE per-user spend. **Pass:** a turn shows tokens AND $.
5. **migrate-on-boot** [احتمالاً HIGH] — `main.ts` has no `migrate deploy`; that's why the ledger went blind. Add it
   to the entrypoint/release so code can't run against an un-migrated DB.
6. **Carry mealType/diet into the prompt list** [قطعی] — retrieval already filters, but emitting the tags lets the
   model frame answers precisely. (region already carried.)
7. **dishType criteria** (سوپ/سالاد/خورش) + **diet depth** (dairy-free via `gris.dietary`) — additive to the criteria layer.

### P2 — polish / data-gated (do NOT fake)
8. **«رژیمی»/calorie filter — BLOCKED on data** [قطعی] — there is **no numeric kcal field** and no «رژیمی» category
   (verified). Be honest ("can't rank by calories yet"); DO NOT ship a calorie filter until a numeric field is
   authored. Faking it = the same dishonesty as the foreign-denial.
9. **«تند»/spice** — no heat metadata (data gap); weak substring only. Stopgap: expand the spicy match set + boost.
10. **Recipe label i18n** (`مواد لازم`/`مراحل پخت` are raw fa) · **step truncation marker** · **role-tagged prompt turns**.
11. **screenLiveOutput substring false-positives** — safety-sensitive; over-blocking is the SAFE direction. Revisit
    with negation-awareness («بدون آجیل» is a SAFE mention), not a blind drop.

## Non-negotiables (unchanged)
HARD allergy + observance gate stays OUTSIDE the LLM, fail-closed, pre+post — NEVER weakened. Deterministic-first:
the LLM narrates an allergy-safe, criteria-filtered, grounded set; it is never the source of a fact/quantity/safety
decision. Every public recipe read filters `PUBLISHED_RECIPE_WHERE`.
