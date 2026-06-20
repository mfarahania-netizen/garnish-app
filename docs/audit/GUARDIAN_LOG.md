# 🛡️ GUARDIAN LOG — Garnish oversight

> Ruthless, evidence-based oversight against the recorded sources of truth (EXECUTION_LEDGER, FOUNDER_REQUIREMENTS,
> MASTER_REBUILD_PLAN, AI_STANDARD, IDEAS_AND_GAPS, auto-memory). Every claim carries file:line / commit / requirement id.
> No flattery. Newest entry on top.

---

## 2026-06-20 — Entry 1 (synthesis of 3 auditors, 20 raw findings → de-duped + source-verified)

**Verification stance:** every claim below was re-checked against live source today. Where a raw finding's number was wrong
it is corrected here (e.g. shadow tree is **148 files**, not 385 — matches MASTER_REBUILD_PLAN.md:194's own "148 files confirmed";
the 385 figure was inflated). Two findings were sharpened by a NEW founder directive the auditors hadn't fully weighted:
**FOUNDER_REQUIREMENTS.md:7-13 (2026-06-20) — the Europe launch now targets the GENERAL European population, NOT the diaspora;
European occasions + the Gregorian calendar are CORE, not deferred localization.** This reframes the pork and occasion items.

### 🔴 FORGOTTEN / DROPPED (things we lost)

1. **[HIGH] `no_pork` / halal soft-filter decided + half-built, but enforcement is missing — pork dishes are NOT filtered for users who opt out.**
   - Decision: `garnish-data-quality-initiative.md` PORK decision (2026-06-19) — keep pork dishes BUT a "no pork" toggle + soft filter so opt-out/halal users "never see pork dishes (soft filter, like an allergen)."
   - Built half: `schema.prisma:189` has `Recipe.containsPork`; `recipes.service.ts:74-81` reads it; `declared-dimension-registry.ts:70` defines `dietary.cultural_constraints` with a `no_pork` option whose `safeExplanationTemplate` claims **"applied as recipe constraints."**
   - **VERIFIED unwired:** grep for `cultural_constraints`/`no_pork`/`containsPork` across `apps/server/src` returns the dimension definition + `question-bank.ts:37` + the recipe read + data scripts ONLY. **ZERO references in `apps/server/src/recommendation/` or any fit/filter path** (grep returned no files). So the dimension's "applied as recipe constraints" explanation is **literally false** — a no_pork/halal user is still shown carbonara, feijoada, full-English, etc.
   - Under the NEW general-European target this is still valid (halal/no-pork users exist in any general population) — it is a real dietary-constraint feature, not just a diaspora concern.
   - **Action:** wire `no_pork` (and `halal`) in `cultural_constraints` to exclude `Recipe.containsPork=true` in the candidate/fit filter (mirror the allergen soft-filter); add the onboarding/preference toggle on web (web references pork nowhere). Until wired, fix the false `safeExplanationTemplate`.

2. **[HIGH — NEW, auditors missed this] European / Gregorian occasions are entirely absent from the context engine, contradicting the founder's CORE-launch directive.**
   - `FOUNDER_REQUIREMENTS.md:12`: "European occasions + the Gregorian calendar are CORE to the launch (not a deferred localization)."
   - **VERIFIED:** `apps/server/src/context/` has Jalali/Persian occasions only (`jalali.ts` persianOccasion = nowruz/yalda/chaharshanbe_suri/sizdah_bedar). grep for `christmas|easter|gregorianOccasion|europeanOccasion` in `context/` = **zero hits**. The "every second" context engine has no Christmas, no Easter, no European weekend-meal/holiday awareness — for an app whose stated primary audience is the Dutch/European general public.
   - **Action:** add a Gregorian/European occasion detector alongside `persianOccasion` (Christmas, Easter, NYE, etc.), keyed off the same `RecommendationContext`. Persian occasions stay as cultural-discovery moments (per the directive), but European occasions are the CORE path and are currently nonexistent.

3. **[MEDIUM] Admin/observability "watch the loop close" viewer (founder R8 — "don't delete one second", meat→mushroom behavioral cabin) is still UNBUILT — and it is the rebuild's own acceptance-test surface.**
   - `MASTER_REBUILD_PLAN.md:137-141` + checklist item 9 (:244) move observability INTO L0 ("not an L3 nicety… how the founder sees the loop close; without it the rebuild is unfalsifiable").
   - `EXECUTION_LEDGER.md:41` R8 = "✅ ثبت · L0" (recorded, NOT built); L0 row (:26) + §5 (:62) still list "مشاهده‌پذیریِ ادمین" as remaining. No viewer commit in the log.
   - This is correctly *tracked* (not lost) but it is now the **highest-value unbuilt L0 item** since the context object shipped. Without it the L0 EXIT test (:145 "admin viewer shows the loop closing for a real user") cannot pass.
   - **Action:** keep it at the TOP of the L0-remaining queue. Build the thin read-only event/observation/profile-trace/counters viewer over L0 tables (per :140).

### 🟡 CARELESS / INCOMPLETE (quality)

4. **[HIGH] Consent-at-ingest gate FAILS OPEN, contradicting commit 9a294066's own "fail-CLOSED for non-core" claim.**
   - **VERIFIED `analytics.service.ts:107`:** `const allowed = await this.consent.hasPurpose(data.userId, 'personalization').catch(() => true);` — on ANY throw, `allowed = true` → the event is routed into the signal engine (line 115) even under `enforce`. For a GDPR/Holland launch a consent-lookup failure must NOT result in processing personal (non-core) data.
   - **Action:** change `.catch(() => true)` → `.catch(() => false)` (fail closed). Add a spec where `hasPurpose` rejects and assert the event is stored-but-not-routed. This must land BEFORE flipping `EVENT_CONSENT_GATE_MODE=enforce`, else enforce mode is undermined by the catch.

5. **[MEDIUM] Dead/unreachable Sizdah-Bedar branch — it can NEVER be emitted; silently misclassified as nowruz.**
   - **VERIFIED `jalali.ts:61-62`:** line 61 `if (jm === 1 && jd <= 13) return { key:'nowruz', fa: jd===13 ? 'سیزده‌بدر' : 'نوروز' }` returns FIRST on Farvardin 13, so line 62 `if (jm === 1 && jd === 13) return { key:'sizdah_bedar' }` is **unreachable**. `occasion.key` is always `'nowruz'` on Sizdah-Bedar (only the `fa` label flips). Consumers key off `occasion.key`, so the distinct outdoor/picnic occasion collapses into Nowruz. The `OccasionKey` type advertises `'sizdah_bedar'` as real; `real-time-context.spec.ts` never tests Farvardin 13 so it passed unnoticed.
   - **Action:** fold the branch — `jm===1 && jd<=13` → `key: jd===13 ? 'sizdah_bedar' : 'nowruz'`; delete the dead line 62; add a spec asserting `occasion.key==='sizdah_bedar'` on Farvardin 13.

6. **[MEDIUM] R14 full factual allergen audit (milk/coconut) is deferred and still open — an allergen-SAFETY item parked on the one path where a miss is catastrophic.**
   - `EXECUTION_LEDGER.md:47` R14: "✅ انجام · ⏳ ممیزیِ فاکتیِ کامل (شیر/نارگیل) به‌تعویق". Tracked (good) but unresolved; nothing since `4eac343c` closes it.
   - **Action:** schedule + complete the milk/coconut factual derivation audit BEFORE any live-AI flip or production allergen claims. Safety items should not stay "deferred" indefinitely.

7. **[LOW] Europe-weekend default keyed on an exact timezone STRING — non-canonical Iran zones silently get the European weekend.**
   - **VERIFIED `real-time-context.ts:59`:** `const weekendDays = opts.weekendDays || (timeZone === IRAN_TZ ? [4,5] : [0,6]);` with `IRAN_TZ='Asia/Tehran'`. Any other Iran IANA alias (e.g. `'Iran'`) falls into `[0,6]` (Sun+Sat, European) — wrong for Iran (Thu+Fri). The `opts.weekendDays` seam exists but nothing populates it.
   - **Action:** derive weekend from a country/locale field (the real signal) or normalize Iran aliases. Low priority given the general-European pivot, but it is a correctness bug in a file whose whole purpose is locale-correctness.

8. **[LOW] Stale Persian-only health-goal strings in the live ranker, against the general-European pivot.**
   - **VERIFIED `recommendation.service.ts:36`:** `healthGoals.some(g => ['کاهش وزن','تناسب اندام','سلامت قلب'].includes(g))` — hardcoded Persian goal labels. A Dutch/European user's health goals will never match. (This whole heuristic is slated for L1 replacement anyway — see DRIFT #11 — but flagged as a concrete symptom of the diaspora→general drift.)

### 🧭 DRIFT / PATH (are we on the layered no-rework path?)

9. **[HIGH] The L0 EXIT GATE was never met, yet consumer-layer work already shipped — the locked gate is being bypassed.**
   - `MASTER_REBUILD_PLAN.md:145` "No consumer work starts until this passes" + :246 "✅ GATE". The gate requires: Phase-0 counters, durable outbox routing, admin observability viewer, shadow-tree deletion, and the L0 EXIT integration test.
   - **VERIFIED unmet:** no `model Counter`/`model Impression` in `schema.prisma` (grep: only `SignalObservation`:582 and `PantryItem`:630 exist — note PantryItem IS already present, correcting a raw finding); the shadow tree the plan orders DELETED (:228 step 10/11) is **still fully present — 148 files** under `runtime-shadow/`; no counters/outbox/observability/shadow-deletion/exit-test commit in the log. Meanwhile recipe-perso (a consumer surface, `a4f77ead`) + GRIS render already shipped.
   - The plan itself (`8b297627`) was authored AFTER recipe-perso phases 0-6 already shipped — i.e. the route was "locked" partly to rationalize a sequence that had already drifted.
   - **Action (pick ONE, in writing — do not keep both the gate and the violation live):** (a) finish L0 to its exit criterion (counters + durable routing + delete the 148-file shadow tree + write the cook-N-stews integration test) before any new L1/L2/L3 BUILD; OR (b) explicitly amend the plan to de-gate L0 and record WHY.

10. **[HIGH] The EXECUTION_LEDGER narrates L0 as effectively done ("A·B·C·D زنده", "loop proven") while the binary EXIT GATE is unmet — exactly the "careless / forgotten as the session grows" failure the founder named.**
   - `EXECUTION_LEDGER.md:26` "🟢 A·B·C·D زنده؛ context+admin مانده" + §5 (:60-63) lists three co-equal parallel NOW tracks (batch-04, L0, AI standard). A green-sounding ledger over an unmet gate is how the path is silently lost.
   - **Action:** add ONE explicit binary line at the TOP of the ledger: **"L0 EXIT GATE: NOT MET — remaining: counters, durable outbox, observability viewer, shadow deletion, integration test. No further L1/L2/L3 BUILD until met."** Make §5's "NOW" name a SINGLE L0 task, not three parallel tracks.

11. **[HIGH] The "every second" context engine (founder R5, 2 commits) is wired to NOTHING in the live recsys path — built into a vacuum.**
   - **VERIFIED:** `ContextModule`/`ContextService`/`buildRealTimeContext` importers = the 4 files inside `apps/server/src/context/` ONLY. `app.module.ts` has **no ContextModule import** (grep: no matches). The live entrypoint `recommendation.controller.ts:38` still calls `pipeline.getRecommendations(userId, +limit)` with ZERO context; `recommendation.service.ts:12` is still the old Prisma where-clause heuristic (diet/region/healthGoals). The context object **cannot** make 8am≠8pm because the ranker never receives it — this is the exact AUDIT C6 joint L0 ④ was meant to fix.
   - Also note the in-code comments (`context.service.ts:5-8`, `context.module.ts:4`) assert it is "injected by the L1 ranker + L2a assistant" — **aspirational, not live.** EXECUTION_LEDGER §2/§5 and commit `184a2254` present it as a delivered L0 brick.
   - **Action:** plumb `RecommendationContext` request → controller → `service.getRecommendations`, starting with time-of-day→mealType candidate gating (the plan's smallest-change-that-proves-it, :135). Until consumed, the "every second" commits are theater. Either wire it or downgrade the comments to "designed to be injected (not yet wired)".

12. **[MEDIUM] Effort is dominated by R12 data-enrichment (GRIS batches) + recipe-perso premium-render UI — both consumer/content work ABOVE an incomplete L0 — while the learning-engine foundation is half-built.**
   - The large majority of the last ~40 commits are data batches (`3153381f`, `45e2ed30`, `fd1c17a1`, …) + recipe-perso phases 0-6 + GRIS render (`a4f77ead`, `d80fc0c7`..`b6a465ff`). `EXECUTION_LEDGER.md:45` R12 shows 74/~700 done with batch-04 in background. Meanwhile `recommendation.service.ts:12` has 0% of the learning rebuild and the 148-file shadow tree is undeleted. recipe-perso "recipe knows you" is `IDEAS_AND_GAPS` Idea #1, explicitly → L1/L2 (build AFTER the foundation).
   - **Action:** background data batches may run in parallel (fine), but they must NOT substitute for L0 completion. The next ENGINE commit should be an L0 item (counters / context-wiring / shadow deletion), not batch-05 or more render polish.

13. **[MEDIUM] Deep AI work (AI_STANDARD.md + SOTA research) produced while L1 (the ranker AI must ground on) is ~0% learning — premature vs the locked 1→2→3 sequence.**
   - Research-NOW is sanctioned (`FOUNDER_REQUIREMENTS.md:143` + ledger R10 "DEEP AI RESEARCH starts NOW (background)"). BUT `MASTER_REBUILD_PLAN.md:167-176` is explicit that L2 depends on L1's taste vector + shared `assessRecipeFit`, and the live ranker has none of the funnel/embeddings/collective trio.
   - **Action:** keep AI as RESEARCH/STANDARD only (correct). Add an explicit ledger guard: **NO AI_STANDARD phase past "Phase 0 observability" gets BUILT until L1's exit test (the 4 founder acceptance tests) passes.** Treating "the standard is written" as license to start building L2 ahead of L1 is the single biggest on-path risk.

### ✅ ON-TRACK (confirmed)

14. **The genuine L0 core — cook loop, cuisine-affinity extractor, consent-at-ingest, consent-gated observed hydration — was built in correct dependency order and proven end-to-end on a real DB.** Commits `88e52e1d` (cook loop / AUDIT C1), `54c48f84` (cuisine-affinity → Food-DNA graph), `7432143e` (additive schema: SignalObservation + recipeId + consent/pantry), `2882d37d` (consent-gated hydration), `9a294066` (consent wiring + ingest gate), `fa852873` (live cook→signal→consent→hydration verified). Matches MASTER_REBUILD_PLAN §4 steps 1-5. **This is real, not theater — protect it.** (Caveat: the ingest gate's fail-open catch — item #4 — weakens it.)

15. **The food-dna-activation memory's "DORMANT hydration" warning is now RESOLVED/STALE — consent-grant wiring shipped.** `garnish-food-dna-activation.md` warned grantConsent never set the personalization purpose. Now built: ConsentService (`consent/consent.service.ts`), `users.service.ts:155-163` mirrors grants into the purpose ledger, `9a294066` + `fa852873`. **Action: update `garnish-food-dna-activation.md` to mark phase B DONE (9a294066) and drop the DORMANT warning, so a future session doesn't re-investigate a solved problem.**

16. **Internal-only health-score rule is holding — no visible A–E / Nutri-Score grade leaked to UI (EU legal guardrail).** grep for `nutriScore/healthGrade/letterGrade` in `apps/web/src` found no nutrition-grade render. Keep the guardrail when the recipe-page rebuild lands (badge/raw-value only).

17. **Byte-identical invariants (getLivingUserProfile cold-start + allergy filter) appear respected by recent context/consent work.** The context engine (`184a2254`) is standalone and never imports the profile; consent wiring kept ConsentLog/cold-start byte-identical; gate default `off` preserves routing. Re-verify the green suite still covers cold-start AFTER the `.catch(() => false)` fix (item #4) lands.

### 🎯 DO-NEXT (prioritized correction + reminder list)

1. **Make the L0 gate binary & visible (5 min, highest leverage):** add the "L0 EXIT GATE: NOT MET" line to the TOP of EXECUTION_LEDGER (item #10) and collapse §5's three parallel tracks to one L0 task. This is the single fix that stops the session-drift the founder named.
2. **Fix the consent fail-open (item #4):** `.catch(() => true)` → `.catch(() => false)` in `analytics.service.ts:107` + a rejecting-hasPurpose spec. Must precede any `EVENT_CONSENT_GATE_MODE=enforce` flip. Add a ledger launch-gate: "before Europe go-live, set enforce, fail-closed verified."
3. **Wire the context engine into the live ranker (item #11)** OR downgrade its "injected by L1/L2a" comments to "not yet wired." Built-but-unwired is the exact theater this audit exists to kill.
4. **Wire `no_pork`/halal to actually filter `containsPork` (item #1)** and fix the false `safeExplanationTemplate` until it does.
5. **Fix the unreachable Sizdah-Bedar branch (item #5)** + add the Farvardin-13 spec.
6. **Add European/Gregorian occasions to the context engine (item #2)** — CORE to the launch per the founder's general-population pivot, currently nonexistent.
7. **Keep the admin observability viewer (item #3) at the top of the L0-remaining queue** — it is how the founder verifies R8 and is required for the L0 exit test.
8. **Refresh README.md + docs/README.md** (last touched `c70d6219`, 2026-06-18; ~47 commits since): correct README.md:17 "recipes 200"/"Nutrition is not source-locked" (both FALSE — 258 USDA-locked `45e2ed30`, 74 GRIS), and README.md:14 (still E47 A1–A12, no L0/consent/AI_STANDARD). Per `garnish-readme-cadence.md` (~every 6 prompts).
9. **Update `garnish-food-dna-activation.md`** to drop the resolved DORMANT warning (item #15).
10. **Guard AI at Phase-0 (item #13):** ledger note — no AI_STANDARD phase past Phase-0 observability builds until L1's exit test passes.

---
