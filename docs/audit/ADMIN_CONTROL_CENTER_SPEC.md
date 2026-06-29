# Garnish — Admin Control Center (سند جامع)

> The intelligent, automated **control room**: capture everything → analyze everything → automate (workflows) → narrate with AI → feed the engines back. Built to be **COMPLETE + TESTED before launch (T‑10 days)**, so from real‑user second 1 every behavior is captured and analyzed. **Empty‑now is fine; missing‑at‑launch is not.** Built in **stages** (first ~5 workflows → ~20 → a research‑derived target, not a magic 100).

---

## خلاصهٔ فارسی (۲ دقیقه)

این سند نقشهٔ کلِ «مرکزِ کنترلِ هوشمندِ خودکار» است — نه یک داشبوردِ شمارشِ ساده. پنج لایه:
1. **ثبت (Capture):** هر رفتارِ کاربر (~۱۳۰ نوع رویداد که تعریف شده) واقعاً emit + ذخیره شود — از ثانیهٔ اولِ لانچ. الان اکثرشان تعریف‌شده‌اند ولی emit نمی‌شوند؛ این لایه آن را کامل می‌کند + sessionِ واقعی + زمانِ ماندن، و آشغالِ admin/cron را از دیدِ کاربر حذف می‌کند.
2. **تحلیل (Analysis):** موتورِ قطعی که این رویدادها را به **رفتار و جواب** تبدیل می‌کند — نرخِ بازدیدِ هر صفحه/رسپی، قیفِ «کلیک‌خورده‌ولی‌نپخته vs پخته»، مسیرِ صفحه‌به‌صفحه، زمانِ ماندن، صفحاتِ مرده، الگوی ورود/خروج/تکرار، سلیقهٔ مواد/غذا، رتبهٔ استفاده از قابلیت‌ها، موضوعات/مشکلات/سؤالاتِ چتِ AI، **دلیلِ ریزش**، کوهورت/ماندگاری.
3. **اتوماسیون (Workflows):** موتورِ ورک‌فلوِ سبکِ خودی (Trigger → Nodes → Action). مرحله‌به‌مرحله: اول ۵ ورک‌فلوِ پراولویت، بعد ~۲۰، تا هدفِ ~۳۰–۵۰ (نه ۱۰۰ — تحلیلم می‌گوید ۱۰۰ over-engineering است).
4. **هوش (AI):** موتورِ قطعیِ تشخیصِ انحراف+ریشه‌یابی **الان**؛ لایهٔ **روایتِ زبانیِ** «۵ دقیقه بفهم چه خبره» + **پاسخِ خودکارِ تیکت** با مدلِ رایگانِ تو حالا، مدلِ پولیِ فردا.
5. **حلقهٔ فیدبک (Flywheel):** تحلیل‌ها به موتورِ شخصی‌سازی/پیشنهاد فیدبک می‌دهند و برعکس — اینجا می‌بینی‌اش و هدایتش می‌کنی.

**اصلِ کار:** الان هسته + موتور + ۵ ورک‌فلوِ اول را می‌سازیم و تست می‌کنیم؛ بقیه بعدِ لانچ پشتِ‌هم اضافه می‌شوند. هیچ‌چیز فیک نیست — یا واقعی، یا صادقانه «در انتظارِ کاربر».

---

## 0. Operating principles (the non‑negotiables)
1. **Capture‑first.** Every behavior is emitted + stored from launch second 1. We never say "we'll add tracking later" — at launch there's no time.
2. **Real or honestly‑empty.** Never a fabricated number. An empty tile says "awaiting pilot/billing", never a fake zero‑dressed‑as‑real.
3. **Deterministic now, AI later.** A real deterministic analysis + insight engine ships now (no LLM needed — Amplitude/Mixpanel aren't LLMs). The LLM **narration** + **AI‑ticketing** layer swaps in: free model now → paid Claude at the budget window (the swap is one config line — the multi‑model chain already exists).
4. **Operator noise is not user behavior.** `admin_*`, `cron_*`, and system events NEVER pollute any user‑behavior view. (Today they flood the realtime feed — fixed here.)
5. **Staged, every section.** Start small, grow to target. Workflows: 5 → 20 → ~30–50. Analyses: the day‑1 core → the long tail.
6. **The flywheel is the point.** Analytics feeds the personalization/recsys engines; the engines' health + levers live in the control center.
7. **5‑minute comprehension.** Open it, and in 5 minutes know: what's happening, what's good/bad, what rose/dropped, where users struggle, where the app is strong/weak.

---

## 1. Architecture — 5 layers + the loop

```
            ┌──────────────────────────── CONTROL‑CENTER UI ────────────────────────────┐
            │  Command (AI brief + the numbers that matter + alerts) · Behavior · Content │
            │  Users · AI · Engines · Automation · Safety · Moderation · Revenue          │
            └───────────▲─────────────────────────────────────────────────▲──────────────┘
                        │                                                  │
  (5) INTELLIGENCE  ┌───┴───────────────┐      (3) AUTOMATION       ┌──────┴─────────┐
  deterministic     │ insight/anomaly/  │◄────  workflow engine  ──►│ alerts/digests │
  + LLM narration   │ RCA + LLM brief + │      trigger→nodes→action │ tickets/actions│
  + AI ticketing    │ ticket auto‑answer│                           └────────────────┘
                    └───▲───────────────┘
                        │ reads
  (2) ANALYSIS ENGINE ──┴────────────────────────────────────────────  page/recipe/journey/session/
  deterministic, real:  behavior → ANSWERS                              preference/feature/AI‑chat/churn
                        ▲ reads
  (1) CAPTURE ──────────┴──────────  UserEvent stream (+ EventOutbox + signal engine)  ◄── FE trackEvent
                                                                                            (~130 events)
                        │ feeds ▼                          ▲ health + levers
  (6) FEEDBACK LOOP ── personalization / recsys / behavior engines ──────────────────────────────────
```

Each layer is independently shippable + testable. We build bottom‑up: Capture → Analysis → Automation → Intelligence, with the UI + loop woven through.

---

## 2. Layer 1 — CAPTURE (complete, day‑1)

**The taxonomy already declares ~130 event types** (`apps/server/src/analytics/event-taxonomy.ts`) across families. This IS the "~80–200 parameters." The problem is **declared ≠ emitted ≠ analyzed.**

### 2a. Families (declared) — and the honest emit status
| Family | Examples (declared) | Emit status today |
|---|---|---|
| Auth/identity | login, **register**, logout, profile_edit | login fires; register now wired (this session) |
| Session/page | **session_start/end**, page_view | page_view fires; **sessions NOT emitted** → gap |
| Home/nav | banner_click, category_click/view, today_special_click, filter_use, home_scroll_to_bottom | mostly **not emitted** → gap |
| Search | **search_query**, search_result_click, voice_search_* | search_query now wired; result_click/voice **not emitted** |
| Recipe | recipe_view, start_cooking_click, **cook_complete**, recipe_share, favorite_add/remove | core fires (view/start/cook/fav) |
| **Recipe sections** | nutrition/steps/ingredients/tools/tips/faq **_expand/_collapse/_read**, recipe_scroll_to_bottom | **these fire** (~250 rows) → enables "which tab opened most" |
| Meal‑plan | mealplan_add/remove/generate/clear | fires |
| Shopping | shopping_item_add/toggle/remove, shopping_add_from_plan | partially fires |
| Personalization (P0) | **ingredient_swapped, portion_scaled, ingredient_removed** | declared+wired but **0 fired** → the #1 taste signal gap |
| Recommendation | impression/click/save/cook/dismiss/ignore | impression/click fire |
| Negative | recipe_skip, not_interested, quick_exit | **not emitted** → gap |
| AI | ai_message_send, ai_response_like/dislike, ai_suggestion_generated, ai_error, ai_feedback | message_send + suggestion fire; **like/dislike NOT emitted** (no thumbs UI) |
| Profile/prefs | preference_update, **allergy_changed**, diet_changed, skill_changed | diet/skill fire; allergy_changed **not emitted** |
| Notifications | notification_generate/read/delete + **send/suppress** | send/suppress decision **not logged** (Layer‑10 gap) |
| Support | ticket_create/reply/close | awaiting tickets |

### 2b. The CAPTURE build (day‑1 must‑haves)
1. **Per‑surface emit coverage** — add the missing `trackEvent` calls so every surface (home/discover/recipe/cook/plan/shopping/profile/AI/notifications) emits its declared events. The components exist; the emit calls don't.
2. **Session tracking** — a real `sessionId` (client‑generated, persisted per session) + `session_start`/`session_end` (and resolve the `UserEvent.sessionId → UserSession` FK: either create the `UserSession` row on session_start, or relax the FK). Unlocks: when users arrive/leave, session length, visits/day, frequency, recency.
3. **Time‑on‑page / dwell** — emit page dwell on navigation away (the `duration` column on UserEvent already exists; wire it).
4. **Feature/page tagging** — ensure `page` + a `feature` tag on events so per‑page + per‑feature analytics are exact (also fixes AI "cost by feature": tag AI calls with the surface/feature — note: `intent` already gives a real split, so this is secondary).
5. **Exclude operator noise** — a single shared predicate `isUserBehaviorEvent(type)` that excludes `admin_*`, `cron_*`, and system markers. EVERY user‑behavior query + the realtime feed uses it. (Kills "بازدید ادمین" in the feed.)
6. **PII discipline (unchanged):** events carry references + shape only, never raw text (search → length/wordCount; chat → conversationId/messageId, never content). GDPR‑safe by construction.

**Ingestion (exists):** FE `trackEvent` → `POST /analytics/event` → `AnalyticsService.trackEvent` → `UserEvent` (+ `EventOutbox` durable routing + signal engine). We extend, not replace.

**Day‑1 capture checklist (the must‑emit set):** session_start/end + sessionId · page dwell · the home/nav clicks · search_result_click · recipe negative signals (skip/quick_exit) · the P0 swap/scale/remove · allergy_changed · AI thumbs (needs a 1‑tap 👍/👎 in chat) · notification send/suppress. Each is a small `trackEvent`/server emit.

---

## 3. Layer 2 — ANALYSIS ENGINE (deterministic, real — the behavioral intelligence)

This is the heart the founder is missing. For each: **what · why · how (from events)**. All deterministic (no LLM), all real once capture flows.

### 3a. Page & navigation
- **Page view rate** (per page; most/least viewed) — where attention goes. ← count `page_view` by `page`.
- **Dead pages** (declared/reachable pages with ~0 views) — wasted surface. ← page registry minus observed pages.
- **Time on page / dwell** (avg + distribution per page) — engagement vs bounce. ← `duration` on page events.
- **Entry / exit pages** — where journeys start/end. ← first/last event of a session.
- **Journeys / paths (page→page flows, Sankey)** + top paths + where they drop off. ← ordered events within a session.

### 3b. Recipe analytics (the operator's bread‑and‑butter)
- **Per‑recipe view rate** (most/least viewed) — content demand. ← `recipe_view` by recipeId.
- **Click→Cook funnel per recipe**: `recipe_view → start_cooking_click → cook_complete` → **"clicked but NOT cooked" vs "clicked AND cooked"** — the exact thing the founder asked. ← the 3 events joined by recipeId+user.
- **Save→Cook** — do saved recipes get made or rot. ← favorite_add → cook_complete.
- **Section engagement** — which recipe tab (nutrition/steps/ingredients/tips/faq) opened most/least, scroll depth. ← the `*_expand/_read` events (already firing).
- **Cook‑mode drop‑off** — where in cooking users quit (needs per‑step events — Layer‑1 follow‑up).
- **Underperformers** (high views, low cook/rating) — the rewrite/demote list.

### 3c. Sessions & timing
- **Session length, frequency (visits/day), recency, time‑of‑day, return cadence** — when/how often users come. ← session events.
- **Stickiness** (DAU/WAU/MAU; for a weekly meal‑planner, WAU/MAU is truer) — habit. ← active users on a value event.
- **Power‑user curve (L7/L28)** — the engaged core. ← days‑active histogram.

### 3d. Preferences & affinity (what each user likes)
- **Top ingredients / dishes / cuisines per user + globally** — derived from views/saves/cooks/searches/chat/swaps. ← cross‑join behavior with recipe metadata + the behavior‑profile (favorite/disliked foods already on `UserBehaviorProfile`).
- **Disliked / avoided** — from skips/dismiss/removes/hard‑dislikes.

### 3e. Feature usage
- **Feature adoption ranking** (which features used most/least, depth, time‑to‑adopt) — what's earning its place. ← feature‑tagged events.
- **Unused features** — candidates to cut or fix.

### 3f. AI‑conversation analytics (the founder's explicit ask)
- **Top topics / intents** (what people talk to the AI about) — ← `ai_message_send` enrichment (already extracts ingredients/concepts/recipes) + `AICallLog.intent`.
- **Top questions / problems / unresolved** — what users struggle with → content + product backlog. ← chat enrichment + a deterministic clustering (keyword/concept buckets now; LLM clustering later).
- **AI helpfulness** (thumbs, regenerations, acceptance→cook) — does the AI drive outcomes. ← needs AI thumbs (Layer‑1) + suggestion→cook linkage.

### 3g. Churn & retention (with the WHY)
- **Churn risk + DRIVERS** — not just the score (which today reads a scary 97% over inactive seed users), but the **behaviors that precede churn** (declining session frequency, core‑feature drop‑off, failed cooks, unmet searches) surfaced as readable reasons. ← `UserBehaviorProfile.churnRiskScore` + the contributing signals.
- **At‑risk cohort** (who, and why) — the re‑engagement list.
- **Cohort retention** D1/D7/D30 + curves + heatmap. ← signup cohorts × activity (already built).

### 3h. Engine health (for the flywheel — §6)
- recsys CTR / save / cook reward, coverage, diversity, popularity‑bias, NDCG, cold‑start; personalization maturity bands; ranker learning coverage. ← existing recsys eval + `UserBehaviorProfile`.

**Build note:** much of this extends existing services (`AnalyticsIntelligenceService`, `OpsIntelligenceService`, the behavior engine) + new aggregations. The earlier `docs/audit/ADMIN_DASHBOARD_CATALOG.md` is the metric reference; THIS doc is the system that computes + automates + narrates them.

---

## 4. Layer 3 — AUTOMATION / WORKFLOW ENGINE

The founder's vision: the admin **runs workflows** that continuously analyze + alert + act. Number is research‑derived, not 100.

### 4a. Architecture decision (my analysis)
**Build a lightweight in‑house DAG runner inside NestJS — do NOT embed Temporal/n8n/Airflow.** Reasons: a 10‑day launch + small team can't operate a heavy external orchestrator; our workflows are mostly *read metric → evaluate → alert/act*, not long‑running distributed sagas. A simple in‑house engine (a few hundred lines) is enough now and we can graduate to Temporal at real scale. [قطعی for our stage]

### 4b. Model
- **Workflow** `{ id, name, description, trigger, schedule?, nodes: Node[], enabled, lastRunAt }`
- **Node** `{ id, type, config, inputs[] }` — a DAG (each node consumes prior outputs).
- **WorkflowRun** `{ id, workflowId, startedAt, finishedAt, status, output, log[] }` — every run is recorded (auditable, replayable).
- **Triggers:** `schedule` (cron), `event` (on a UserEvent type), `threshold` (metric crosses a bound), `manual`.

### 4c. Node types (the ~50‑node palette)
- **Source:** `metric.query` (call an analysis method), `db.query` (safe read), `events.window` (recent events).
- **Transform:** `filter`, `aggregate`, `compare` (vs baseline/previous), `topN`, `join`.
- **Condition:** `threshold`, `anomaly` (z‑score/EWMA), `change%`.
- **AI:** `classify` (intent/topic), `summarize` (→ the brief), `answer` (ticket draft) — via the free chain now, paid later.
- **Action:** `alert` (in‑panel), `notify` (email/Slack/push), `write` (e.g. flag a recipe), `ticket.reply`, `webhook`.
- **Output:** `digest`, `insight`, `report`.

A workflow with ~50 nodes = a rich pipeline (e.g. pull 10 metrics → compare each to baseline → detect anomalies → classify → summarize → route alerts). Most workflows are 3–10 nodes; 50 is the ceiling, not the norm.

### 4d. Staged plan — **the FIRST 5 (built now), then grow**
**Phase 1 (now, T‑10 → launch): 5 workflows**
1. **Daily Ops Brief** — pull the key metrics → compare to yesterday/baseline → summarize → admin digest. (The "5‑minute brief" backbone.)
2. **Churn‑Risk Watch** — users crossing churn threshold → at‑risk list + driver reasons → alert.
3. **AI Cost & Health Guardrail** — cost/latency/fallback/429 anomaly → alert (+ optional throttle).
4. **Content‑Gap Digest** — unmet searches + low‑coverage demand → authoring backlog.
5. **Allergy‑Safety Sentinel** — ANY gate violation → critical page. Zero tolerance.

**Phase 2 (post‑launch, ~weeks 1–4): → ~20** — add: anomaly detector per key metric, re‑engagement nudge (dormant users), onboarding‑funnel drop alert, recipe‑underperformer digest, AI‑topic trend report, recsys‑quality watch, A/B readout, **AI ticket auto‑answer** (§5c), pantry/shopping nudges, weekly exec report.

**Phase 3 (ongoing): → target ~30–50** — fill per‑section detectors + automations as real‑user data justifies each. (We log what we DON'T yet automate, so coverage is honest.)

---

## 5. Layer 4 — INTELLIGENCE (AI)

### 5a. Deterministic insight / anomaly / RCA engine (NOW, no LLM)
Already started (`getAdminInsights`). Expand into a real engine: anomaly detection (z‑score/EWMA over each metric's history), threshold rules, **contribution/root‑cause** (decompose a metric move by dimension → "cooks dropped 20%, driven by the meal‑plan page"). Output: ranked, honest findings. This is real "what's wrong" without an LLM.

### 5b. LLM narration — the "5‑minute brief" (free now → paid Claude later)
A node/service that takes the analyzed metrics + anomalies and writes a plain‑language brief: *"Today: 88 events, AI latency high (24s — switch model), 9 unmet searches (X demand), churn risk concentrated in cohort Y."* Grounded strictly in the computed numbers (no free‑form hallucination), behind the existing multi‑model chain — **free model now, swap to paid Claude with one config line at the budget window.** This is the "هوش" the founder wants; the deterministic engine makes it safe + cheap.

### 5c. AI ticket auto‑answer (the founder's explicit ask)
Pipeline: incoming ticket → `classify` intent → retrieve from the curated KB (the during‑cook troubleshooting KB + FAQ already exist) → `answer` draft → **CONFIDENCE + SAFETY gate** (allergy/medical/financial → never auto‑send; low confidence → suggest‑to‑human) → auto‑send if high‑confidence + safe, else queue a suggested reply for one‑click human send. Free model now → paid later. Every auto‑answer is logged + reversible.

---

## 6. The FEEDBACK LOOP (flywheel)

- **analytics → engines:** behavioral signals (cook/save/skip/dwell/swap/search) feed the recsys reward + the personalization profile + the ranker. The control center surfaces **engine health** (CTR/save/cook reward, coverage, diversity, drift) + **operator levers** (boost/suppress a recipe, trigger retrain, set guardrails).
- **engines → analytics:** expose **why** a user got a recommendation (attribution) + the recsys quality metrics, in the panel.
- **The loop closes in the control center:** you SEE the flywheel turning and can steer it. (Our recsys exposure/attribution/reward tables + the L1 ranker already exist — this wires them to the operator.)

---

## 7. CONTROL‑CENTER UI (the redesign)

Reorganized around **behavior + answers**, every section **explained**, built for **5‑minute comprehension**, automation **visible**, operator noise **gone**.

- **Command** (landing): the **AI brief** + the 8–10 numbers that actually matter + active **alerts** + live workflow runs. Open → understand in 5 min.
- **Behavior**: journeys/paths, page rates, dead pages, time‑on‑page, sessions/timing/frequency. (User behavior only — no admin/cron.)
- **Content**: recipe rates, the click→cook funnel, section engagement, content gaps, underperformers.
- **Users**: cohorts, retention, churn + drivers, at‑risk list, preferences/affinity.
- **AI**: chat topics/problems/questions, helpfulness, + the cost/latency/model panel (already real — kept).
- **Engines**: recsys/personalization health + levers (the flywheel).
- **Automation**: the workflows — runs, alerts, enable/disable, output.
- **Safety/Compliance**: guards, allergen sentinel, consent posture (now real). **Kept.**
- **Moderation**: recipes/tickets/users (+ AI‑assisted ticket replies).
- **Revenue**: post‑launch (billing).

**Explanation everywhere:** each metric carries a one‑line "what it means + why it matters + how to read it" (hover/info), not a bare 2‑word label. The founder must never ask "این از کجا اومده؟".

---

## 8. STAGED ROADMAP (realistic — T‑10 to launch, then beyond)

**NOW (pre‑launch, T‑10 → T‑0):**
- Layer 1 CAPTURE complete (wire emits + sessions + dwell + exclude admin/cron).
- Layer 2 ANALYSIS engine core (page/recipe‑funnel/journey/session/preference/feature/AI‑topic/churn‑driver).
- Layer 3 workflow ENGINE + the **first 5 workflows**.
- Layer 4 deterministic insight/anomaly engine.
- UI redesign (Command + Behavior + the real panels) + explanations.
- **All TESTED with seed data**, so it's correct and live from real‑user second 1. (Most behavioral tiles read "awaiting users" honestly until pilot — that's correct, and they fill the instant users arrive.)

**Post‑launch weeks 1–4:** grow to ~20 workflows · LLM narration (at budget) · AI ticket‑automation · more behavioral analyses · flywheel levers.

**Ongoing:** to the ~30–50 target by need · paid Claude · fuller automation.

**Cadence:** 5 → 20 → target. Same incremental approach for every section. We never block launch on the long tail; we ship the engine + the core + the first 5, and grow.

---

## 9. Honesty discipline (kept from the current build)
Every tile is **real** or **honestly‑awaiting** (needs pilot users / billing / a new event) — never fabricated, no `Math.random`, fixtures labelled. The backend self‑labels `real`/`awaiting`; the UI shows the awaiting state. This doc is the living home for the control center; updated as each layer ships.

---

# PART II — Build Artifacts & Specifications

> Part I is the blueprint (the *why* + the *what*). Part II is the *how*: the copy‑able data models, formulas, and gate logic, each grounded in (a) our actual codebase and (b) how the best products do it (citations inline). This is what we build stage‑by‑stage. Confidence tags: **[قطعی]** strong evidence · **[احتمالاً]** good but calibrate on our data · **[حدسی]** pattern‑inference.

## B0. What is already wired vs missing (codebase ground truth, 2026‑06‑29)
A codebase audit mapped the real state. We build on what exists; we do **not** rebuild it.
- **REAL & live:** `UserEvent` stream + `EventOutbox` durable outbox + `EventQualityService` (anti‑bot gate, deliberate‑signal bypass); `AnalyticsIntelligenceService` (funnels/trends/cohorts/product‑intel); `OpsIntelligenceService` (health/safety/economics/ai‑observability — `AICallLog` genuinely live, 563 rows); the living user profile + Food‑DNA; the 10‑component live ranker; the L1 learning **seams** (`RecommendationServedItem` / `RecommendationAttributionEvent` with `requestId`, `RecipePrior`, `WeightSource`) all present but **default‑OFF**; `AiSpendAlert` (one alert primitive); ~14 `@nestjs/schedule` cron services.
- **WIRED‑BUT‑OFF:** recipe‑prior learning, minority‑protection slate term, A/B weight‑override path, consent‑by‑purpose write.
- **MISSING (must capture — see B1):** the P0 taste signals (`ingredient_swapped`/`portion_scaled`/`ingredient_removed` — **0 fired**), `requestId` echoed ranker→client→reward (the exposure↔reward join is broken), AI 👍/👎, session start/end + `sessionId`, `mealplan_copy_week`, `pwa_install`, `ConsentLog.purpose` write, cook‑mode per‑step events, `User.locale`/`country` (nullable → cohort priors blind).
- **No new infra needed:** no BullMQ/Temporal/Redis today. The workflow engine (B6) is a thin layer over primitives already in production.

## B1. Event capture — the day‑1 must‑emit set
The taxonomy declares ~130 types; the gap is *emission*. **Un‑backfillable signals must ship before launch** — feedback and the action‑join cannot be reconstructed later [قطعی, codebase + AI‑chat agent].

| Priority | Capture | Where | Why un‑backfillable / why #1 |
|---|---|---|---|
| **P0** | `ingredient_swapped` · `portion_scaled` · `ingredient_removed` | cook‑mode FE → `trackEvent` | the #1 taste signal; declared+gated but **0 fired**; "swaps emit zero events" is the single flywheel blocker |
| **P0** | echo `requestId` ranker→client→`recommendation_*` reward | ranking response + FE reward emit | exposure↔reward join (IPS/off‑policy learning) is **impossible** without it; cannot backfill |
| **P0** | AI 👍/👎 per assistant message | chat FE (1‑tap) + `ai_response_like/dislike` | cheapest ground‑truth label; every other chat metric is an *estimate* without it |
| **P0** | `sessionId` + `session_start`/`session_end` | client session id (persist per session) | unlocks ALL session/timing/frequency/path analytics; `UserSession` is 0 rows today |
| **P1** | page dwell (`duration`) on nav‑away | FE router | time‑on‑page, dead pages, bounce — column exists, unwired |
| **P1** | `recipe_id` on every AI suggestion | chat tool output | exact chat→cook attribution (not fuzzy) |
| **P1** | `mealplan_copy_week` · `pwa_install` · home/nav clicks · `search_result_click` · negative signals (`recipe_skip`/`quick_exit`) | respective surfaces | habit + acquisition + journey completeness |
| **P1** | `ConsentLog.purpose` on write + `allergy_changed` | consent + profile | GDPR‑by‑purpose; onboarding funnel completeness |
| **gate** | `isUserBehaviorEvent(type)` — exclude `admin_*`/`cron_*`/system | shared predicate, used by EVERY user‑behavior query + the feed | kills "بازدید ادمین" pollution (the founder's complaint) |

**PII rule (unchanged):** events carry references + shape only — never raw text (search → length/wordCount; chat → conversationId/messageId). GDPR‑safe by construction.

## B2. Behavioral‑analysis formulas (deterministic, vendor‑grounded)
Sessionize once, reuse everywhere. **30‑minute inactivity gap, 24h hard cap** is the cross‑vendor standard (Mixpanel/PostHog/Heap/Amplitude‑web) [قطعی]. `session_start` = first event, `session_end` = last — *derive*, don't instrument.
- **DAU/WAU/MAU** = distinct users with ≥1 *active* event in trailing 24h/7d/30d; **stickiness = avg DAU/MAU** (use **WAU/MAU** too — cooking is weekly‑cadence). Define "active" two‑track: any‑open + **engaged** (cook/save) [قطعی, Mixpanel/June].
- **Retention** = N‑day **bounded** ("Return On day N", for cohort comparison) + **unbounded** ("Return On or After"); render the cohort triangle [قطعی, Amplitude].
- **Page rate** = `count()` by normalized path; **uniques** = `count(distinct user)`; **dead pages** = route‑catalog **LEFT‑ANTI‑JOIN** observed paths (the one analysis you can't get from the event stream alone) [قطعی].
- **Dwell** = `lead(ts) − ts` within session (cap or use active‑minutes to avoid "left tab open" inflation); **bounce** = single‑pageview session < 10s [قطعی, PostHog].
- **Recipe click→cook** = ordered funnel `recipe_view → start_cooking_click → cook_complete`, **generous conversion window (7–30d)** — a 1h window massively understates it; **"clicked‑not‑cooked"** = viewers `LEFT‑ANTI‑JOIN` cookers, sliced by recipeId [قطعی, Mixpanel].
- **Paths/Sankey** = `lead(event) OVER (PARTITION BY session ORDER BY ts)` → transition pairs → weight by sessions; anchor start/end; prune to top‑N [قطعی, PostHog/Amplitude].
- **Frustration** = rage (`>3 clicks / 1s` same element, PostHog), dead (`no DOM mutation 2500ms`), error (click right before JS error), u‑turn; composite score **with a min‑evidence gate** (one stray rage ≠ frustrated session) [قطعی].
- **Feature usage** = the **80%‑of‑click‑volume** rule (Pendo) + adoption rate + breadth/depth + time‑to‑adopt → tells us if chat/meal‑plan/cook‑mode are used or decorative [قطعی].
- **Affinity (B‑level preference)** = per‑user **facet profile**: fan each event to the recipe's facets (cuisine/protein/ingredient/dishType/spice/difficulty), `score[facet] += weight(event) × decay`, weights `view 1 < click 2 < dwell 3 < save 5 < plan 6 < cook 10 < repeat 15`, half‑life ~30–60d. **Always show lift vs baseline** `P(facet|user)/P(facet|all)` so "everyone likes Persian" never masquerades as a personal taste [قطعی, Algolia/Dynamic‑Yield]. Depends on complete recipe facet tags — highest‑leverage data investment.

## B3. AI‑conversation analysis (the founder's explicit ask)
Canonical log row: `message_id, conversation_id, user_id, turn_index, role, ts, text, model, latency_ms, retrieved_doc_ids, tool_calls, feedback` + a separate events table to join chat→action.
- **Topics:** at launch (hundreds of chats) → LLM summarizes each thread to a 3–5 word topic, cluster those. At volume → embed (`all‑mpnet‑base‑v2`) → **HDBSCAN** (`min_cluster_size≈10`) → LLM‑label → `value_counts`. For the admin VIEW use the **Clio** pattern: facet‑extract → cluster → **show a cluster only above a min unique‑user+conversation count** (admin sees aggregates, never one user's chat → GDPR‑clean) [قطعی, Langfuse/Anthropic Clio].
- **Intent:** LLM zero/few‑shot into a fixed cooking set (`recipe_lookup, substitution, technique, nutrition, troubleshooting, meal_planning, scaling, equipment, dietary_allergy, other`), **multi‑label + an out‑of‑scope bucket** (OOS rate is itself a signal) [قطعی].
- **Unmet needs (highest value):** join three signals on `conversation_id` — low‑confidence/fallback answers + no downstream cook/save + OOS intent → cluster → **authoring backlog**. Directly attacks the "chat recommends obscure stews" gap [قطعی].
- **Groundedness (safety‑critical):** atomic‑claim verification of each assistant answer against `retrieved_doc_ids` — a hallucinated substitution/calorie is a trust failure and crosses our existing nutrition hard line [قطعی].
- **Resolution:** **do NOT use containment/deflection** — no human to escalate to → it reads ~100% and hides failures. Use fallback‑rate (<15% target), implicit‑unresolved (rephrase/repeat/error‑correct/abandon/👎), and **chat→cook goal‑completion** as the real north‑star [قطعی, Intercom Fin/Zendesk + the chat‑analytics agent's reality check].

## B4. Churn — score AND drivers (the part the founder demanded)
- **Label:** behavioral lapse — `days_since_core_action > N`; pick N where the return curve flattens (cooking ≈ **14–21d** start, validate). Separate **activation churn** (never reached first cook) from **lapsed** [قطعی, PostHog/Mixpanel].
- **Features:** recency, **frequency *trend*** (Δ vs prior window — a *declining slope* predicts better than a low level), stickiness, core‑action drop, **feature‑breadth narrowing** (stopped using meal‑planner), negative experience (errors/zero‑results), activation/tenure [قطعی, Amplitude].
- **Drivers Layer (i) — now, deterministic:** for each behavior B, `churn_rate(did B)` vs `churn_rate(didn't B)`, rank by gap → protective (planner use, repeat cook) vs toxic (early inactivity). Per‑user reasons = which feature values deviate most (z‑score vs healthy‑cohort median) — a cheap SHAP surrogate [قطعی, Amplitude/Mixpanel].
- **Drivers Layer (ii) — later:** XGBoost + **SHAP** for per‑user signed contributions once enough labels exist (premature modeling on tiny data overfits — build (i) first) [قطعی + our deterministic‑first law].
- **At‑risk cohort (admin headline):** rule v1 (was active ≥2 cooks AND in decay zone OR frequency halved OR breadth dropped OR negative‑experience‑without‑recovery) → risk tiers → row spec: `user · tier · days_since_cook · 7d sparkline · top‑3 drivers · top affinity tags (for personalized outreach) · suggested action`.

## B5. Recommender/engine health metrics (the flywheel's gauges)
Minimum dashboard, **segmented new‑vs‑established users** [قطعی, Amazon Personalize console + the offline‑metrics agent]:
1. **Ranking:** NDCG@k (1=perfect) + Hit‑Rate@k (anyone‑served) — beat a **popularity baseline** (Personalize makes this a first‑class question).
2. **Catalog health:** Coverage (∪ recommended / catalog) + ILD (intra‑list diversity).
3. **Bias/amplification:** Gini of item exposure + **Popularity‑Lift PL** (`(GAP_recs − GAP_profile)/GAP_profile`; **PL>0 = amplification alarm** — our obscure‑vs‑famous‑dish problem in one number).
4. **Calibration KL** `C(p,q)` — minority‑taste fidelity (0 = faithful to the user's genre mix).
5. **Cold‑start slice:** coverage + NDCG on new‑user/new‑item buckets.
6. **One online north‑star** (save‑ or cook‑rate) — with the standing caveat that offline gains need online/counterfactual confirmation.

**ML‑monitoring (the ops layer behind the steering panel)** [قطعی, Huyen/Google ML‑Test‑Score]:
- Distinguish **covariate / label / concept** drift; **concept drift is the dangerous one** (model wrong, inputs look normal). Detect via PSI (<0.1 stable / 0.1–0.25 / >0.25) + Wasserstein/JS (0.1) — **gate alerts**, most drift is benign.
- **Delayed‑label two‑loop** (our "did they cook it?" is a long‑delayed natural label): a real‑time **proxy loop** (prediction + feature drift) + a **delayed loop** that joins impression→cook when the label lands (Michelangelo's log‑and‑join).
- **Degenerate feedback loop is our #1 risk** — popularity amplification = the obscure‑dish problem. Panel metric: **long‑tail coverage % + per‑popularity‑bucket cook‑rate**; break it with **exploration (randomized injection) + position features**.
- **Gate every retrain** behind a frozen golden set + canary + auto‑rollback (CACE: changing anything changes everything).

## B6. Workflow engine — the data model (build in‑house) [قطعی]
**Decision:** build a ~300‑LOC in‑house DAG runner on `@nestjs/schedule` + Prisma + `EventOutbox`. **Reject Temporal/n8n/Inngest** — our workflows are single‑process internal jobs over our own Postgres, exactly the case Inngest itself says "you might not need a queue" and n8n runs in‑process; a parallel runtime is the over‑engineering our own rules forbid 10 days from launch. Graduate to **pg‑boss** (Postgres `SKIP LOCKED`, no Redis) only when run‑volume demands.

**Three Prisma tables** (definition vs run vs alert — the maintainability rule; n8n/Windmill pattern):
```prisma
model Workflow {            // DEFINITIONS — small, edited rarely, versioned immutably
  id String @id @default(uuid())
  key String @unique        // 'ai-cost-guardrail'
  name String; description String?; enabled Boolean @default(true)
  triggerType String        // 'schedule'|'event'|'threshold'|'manual'
  cron String?; eventType String?
  graph Json                // { nodes:[{id,type,params,next[]}], edges:[...] }  ← React-Flow-ready
  version Int @default(1)   // runs pin the version they executed
  defaultSeverity String @default("info")
  nextRunAt DateTime?; lastRunAt DateTime?
  @@index([enabled, triggerType, nextRunAt])   // the scheduler's hot query
  @@index([eventType])
}
model WorkflowRun {         // RUNS — high-volume, pruned (n8n: 14d/10k), ONE row + JSONB step-state (Windmill)
  id String @id @default(uuid())
  workflowId String; workflowVersion Int
  trigger String; status String @default("running")  // running|succeeded|failed|skipped
  startedAt DateTime @default(now()); finishedAt DateTime?; durationMs Int?
  stepState Json            // { [nodeId]: { status, output, error?, ms } }
  outcome Json?; error String?   // sanitized, no PII
  @@index([workflowId, startedAt]); @@index([status, startedAt])
}
model WorkflowAlert {       // ALERTS — generalize the existing AiSpendAlert; the Command feed reads this
  id String @id @default(uuid())
  workflowId String; runId String?
  severity String           // info|warning|critical
  title String; body String; metric String?; value Float?; threshold Float?
  status String @default("open")   // open|acknowledged|snoozed|resolved
  channelsSent Json?        // ['in_app'] now → ['slack','email'] later
  createdAt DateTime @default(now())
  @@index([status, severity, createdAt])
}
```
**Node palette (~the 50‑node ceiling; most workflows are 3–10 nodes):** Source(`metric.query`/`db.query`/`events.window`) · Transform(`filter`/`aggregate`/`compare`/`topN`/`join`) · Condition(`threshold`/`anomaly`/`change%`) · AI(`classify`/`summarize`/`answer` — via the guarded chain) · Action(`alert`/`notify`/`write`/`ticket.reply`/`webhook`) · Output(`digest`/`insight`/`report`). Each Source/Transform reuses an existing analytics method — nodes are thin wrappers, not new logic.

**Runner:** a single `@Cron` tick (every 5 min) scans `Workflow WHERE enabled AND triggerType='schedule' AND nextRunAt<=now()`; the `EventOutbox` drain matches `triggerType='event'`. Each due workflow → create a `WorkflowRun`, walk `nodes` in topological order threading a `context` object, persist `stepState`, wrap in try/catch (failed runs are rows, not crashes).

**The first 10 workflows (ordered by value/effort — all real on our data today):** ①AI‑cost guardrail (burn‑rate vs cap → critical — must exist on launch day, paid model imminent) ②Allergy‑safety sentinel (any gate breach → critical, zero tolerance) ③AI reliability (fallback‑depth/429 spike) ④Daily ops brief (the 5‑min digest) ⑤Content‑gap digest (unmet searches → authoring backlog) ⑥Churn‑risk cohort ⑦North‑star anomaly (cooks WoW drop >20%) ⑧Problem‑recipe watch (high views, low completion) ⑨Event‑pipeline health (quality drop) ⑩GDPR/consent posture. **Ship the first 5 for launch**; ①② are non‑negotiable.

## B7. Anomaly + RCA engine (deterministic, the LLM never does math) [قطعی]
**The load‑bearing rule:** detection + root‑cause are **deterministic statistics**; the LLM only *narrates* a pre‑computed finding. This is literally how Amplitude/Mixpanel/Datadog are built (Prophet/STL detect; the LLM is a separate narration layer). Invert it and you get "confident, wrong, expensive."
- **Metric registry:** typed KPIs `{key, grain, seasonality, direction, minSampleFloor, method, dimensions[]}`.
- **Detection ladder:** robust **z‑score** (median+MAD, `σ=1.4826·MAD`, flag `|z|>3.5`) for non‑seasonal · **EWMA** (`λ≈0.2–0.3`, `L≈3`) for level shifts (latency/errors) · **STL+Generalized‑ESD** (median‑trend residual) for seasonal product metrics (DAU/cooks). **Node has no first‑class Prophet/STL — implement z+EWMA+TS‑STL‑ESD natively; defer Prophet/a Python sidecar until a metric genuinely needs holiday modeling** [قطعی].
- **Baseline hygiene:** exclude known events (deploys, our deliberate analytics signals), enforce `minSampleFloor` (same honesty as our nutrition NULLs), and a **Dutch/European holiday calendar** (Europe launch — else every holiday reads as a DAU crash).
- **RCA Engine 1 — dimensional drill‑down** (higher ROI): per dimension (platform/appVersion/country/locale/recipeId/isNewUser) compute `Δ_v = actual_v − expected_v` + `shareOfDelta`; **concentration > 0.6 ⇒ a specific‑segment cause** (e.g. a bad `appVersion` deploy) vs spread = real demand change.
- **RCA Engine 2 — correlation + change‑event timeline:** window‑join the anomaly (±N min) against a deploys/model‑swap/flag table; cross‑metric correlation; **root vs symptom by precedence** (the metric that moved first in a known dependency edge: LLM‑error → chat → engagement).
- **Output = a structured `Finding`** (`metric, window, observed, expected, deltaPct, severity, detector, topSegments[], coincidentChanges[], correlatedMetrics[], candidateRootCause{kind,ref,confidence}`) — the **only** thing the LLM sees.
- **Flap control (the #1 reason these get muted):** hold an open incident per (metric, segment); re‑notify only on escalation/resolution.

## B8. LLM narration + AI ticket automation (free now → paid Claude later) [قطعی]
**Narration ("5‑minute brief"):** the LLM receives the `Finding` JSON + the daily snapshot and writes prose — it **never queries data, never computes a number, never sets severity**. Guards (defense in depth): (1) **grounding** — no number not in the input; (2) low temperature; (3) a **programmatic number‑validator** — regex‑extract every number in the output, assert each exists in the input, else **fall back to a deterministic template** (same architecture as our chat's `claimsWriteWithoutDoing` anti‑fake gate); (4) cause‑whitelist. **The deterministic template means the admin always gets a correct brief even if the free model 429s or fabricates** — the LLM is pure polish. Swap free→Claude via one config line on the existing multi‑model chain; on Claude use **prompt caching** (stable system prefix → ~90% input savings) + **batch API** for the daily (non‑real‑time) brief (~50% cost). Tone = the founder's voice (simple, an analogy, one concrete next step).

**Ticket auto‑answer (two gates, SUGGEST‑first):** classify intent → RAG‑retrieve from our KB → draft → **SAFETY gate (hard, deterministic, first): allergy/medical/billing/legal/account‑security/abuse → ALWAYS human** (a wrong allergy auto‑reply is catastrophic — consistent with our hard allergy gate) → **CONFIDENCE gate:** auto‑send only if `intent≥0.85 AND retrieval≥0.78 AND topic∈allowlist AND not safety‑flagged`; `retrieval≥0.5` → **SUGGEST** (one‑click human send); else **HANDOFF** with full transcript+summary+reason. **Roll out SUGGEST‑only for 2–4 weeks, measure per‑topic acceptance, promote only vetted topics to AUTO_SEND** (independent testing: most tools miss the 70% auto‑resolution they claim — don't assume it). Every auto‑answer logs + ends with "didn't solve it? a human will help."

## B9. The flywheel — log‑discipline that closes the loop [قطعی]
The whole engine→analytics loop is cheap to close **if we log at recommend‑time** (Netflix/Spotify/YouTube/Duolingo all do). Per recommendation store: **(1) the seed item** ("چون قورمه‌سبزی پختی" — free explainability *and* satisfies DSA Art.27 "main parameters" disclosure for the EU launch), **(2) rank + propensity** (enables IPS off‑policy eval + an incrementality holdout — without it "recommendations drove N cooks" is unverifiable), **(3) top contributing features** (reason codes; RankSHAP later). Reward = behavior folded to a scalar with confidence (`c = 1 + α·r`) or watch‑time‑as‑weight; serve via a **stochastic policy with exploration** (ε‑greedy/Boltzmann) so logs don't self‑confirm; **off‑policy eval (IPS/NCIS/replay) before any A/B**; batch retrain <24h. **Duolingo's lesson is the thesis of this whole doc: the *same* loop powers the recommendation, the A/B test, and the DAU number — engine and analytics are one system, not two.** Our blocker is unchanged and singular: **swaps/recommendations emit zero events today** (B1‑P0).

## B10. Sources (verified by the research agents)
Workflow/ops: n8n DeepWiki, Windmill, Inngest, Temporal docs, pg‑boss, Google SRE. Anomaly/RCA/AI‑ops: Amplitude/Mixpanel anomaly+RCA, Datadog Watchdog, Anodot, Twitter SH‑ESD, Chip Huyen (drift), Google ML‑Test‑Score, Looker trusted‑metrics, Anthropic prompt‑caching. Support: Intercom Fin, Zendesk triage. Behavioral: PostHog/Mixpanel/Amplitude/Heap/Pendo/June/FullStory/Hotjar. Recsys/flywheel: Netflix (long‑term satisfaction, interleaving), Spotify BaRT, YouTube (Covington; Top‑K REINFORCE), Hu/Koren/Volinsky, LinUCB, Abdollahpouri (popularity bias), Steck (calibration), Amazon Personalize, Uber Michelangelo, Duolingo (Birdbrain/HLR/Growth‑Model), Sculley "Hidden Technical Debt". Privacy: GDPR Art.22, DSA Art.26/27, EDPB 2025. (Full URL list in the agents' research outputs.)

---

# PART III — The Automation Catalog (the full ~40, with modes + steps)

> An "automation" is NOT just "query → threshold → alert". The first 5 shipped are deliberately the simple
> launch-critical GUARDS (a safety check shouldn't be 50 steps). The real catalog spans **8 modes** — most are
> multi-step ANALYTICAL pipelines that produce decisions, backlogs, and actions, not one-line alerts. Each
> automation below: **what it delivers** (the value) · **steps** (the pipeline) · **mode** · **stage**.
> Built stage-by-stage. ✅ = shipped · ⏳ = next · ◻ = planned. Counts: ~43 automations, 8 modes.

**The 8 modes** — (1) GUARD (alert), (2) DIGEST (analytical report), (3) ANOMALY+RCA (statistical detect + root-cause), (4) LIFECYCLE-ACTION (writes/notifies users), (5) CONTENT-OPS (improves catalog), (6) FLYWHEEL (feeds the engines), (7) AUTO-ANSWER (agentic support), (8) NARRATION (LLM voice on a digest).

## Mode 1 — GUARD (simple by design: detect a breach → alert). Critical ones auto-run + auto-notify (no button).
1. ✅ **AI cost guardrail** — stops a bill surprise. Steps: query today's spend → compare to daily cap → alert critical + auto-notify. *(auto-run, no manual button)*
2. ✅ **Allergy-safety sentinel** — zero-tolerance safety. Steps: run the hard allergy filter over the fixture catalog → any leak → page critical + auto-notify. *(event-triggered + auto-run)*
3. ✅ **AI reliability watch** — primary-model-down detector. Steps: query fallback rate → > 50% → warn.
4. ◻ **Latency-SLA breach** — query AI p95 → > threshold (e.g. 8s) → warn. *(our live p95 is 23.9s — this would already fire)*
5. ◻ **Error-rate spike** — query error rate over a short window → z-score vs baseline → alert.
6. ✅ **Event-pipeline health** — query malformed-event rate → < 95% well-formed → warn (bad instrumentation poisons everything).
7. ◻ **Outbox backlog** — count un-routed `EventOutbox` rows → piling up → warn (signal loss risk).
8. ◻ **GDPR/consent drift** — query consent posture + erasure SLA → anomaly → warn (EU launch = compliance is ops).

## Mode 2 — DIGEST (multi-step ANALYTICAL reports — the "give me precise, analytical info" the founder wants)
9. ✅ **Daily ops brief** — the 5-minute glance. Steps: query health + cost + reliability → assemble → (Stage-4 narrate) → digest.
10. ◻ **Weekly executive report** — Steps: pull north-star (cooks) + DAU/WAU/MAU + signups → WoW deltas → top movers (recipes/searches) → cohort retention → ranked summary → digest. *(6 steps)*
11. ⏳ **Content-gap → authoring backlog** — *the one that grows the catalog*. Steps: pull unmet searches (window) → cluster by concept (shape-only) → overlay on catalog coverage (what we lack) → rank by volume × gap → ranked "dishes to author next" → write backlog. *(5 steps)*
12. ⏳ **Recipe performance report** — *winners + rewrite list*. Steps: pull view/start/cook events → join catalog → per-recipe view→cook funnel + save→cook → rank winners + flag high-view/low-cook underperformers → rewrite backlog + digest. *(6 steps)*
13. ◻ **AI-chat topic digest** — *what users actually ask*. Steps: pull chat enrichment + intents → cluster topics/problems → flag unmet/unresolved → rank → product+content backlog. *(5 steps)*
14. ◻ **Churn-driver report** — *not a score, the WHY*. Steps: pull per-user features (recency, freq-trend, breadth, errors) → label churned vs retained → per behavior compute churn-rate(did) vs (didn't) → rank drivers by gap → per at-risk user z-score reasons → at-risk list + drivers digest. *(6 steps)*
15. ◻ **Journey/page report** — Steps: sessionize events → page rates + dead pages (anti-join vs routes) + top paths (lead-window) + drop-offs → digest. *(5 steps)*
16. ◻ **Preference/affinity rollup** — Steps: fan behavior to recipe facets → score per facet × lift-vs-baseline → top ingredients/cuisines globally + emerging → digest.

## Mode 3 — ANOMALY + RCA (statistical detection + root-cause — "tell me what changed AND why")
17. ◻ **North-star anomaly + RCA** — Steps: cook trend → WoW/robust-z → if anomalous, break down by segment (platform/locale/recipe) → concentration score → "cooks down 20%, 90% from the meal-plan page" → alert. *(5 steps)*
18. ◻ **Per-metric anomaly sweep** — Steps: for each KPI (DAU, signups, sessions, search) → robust-z/EWMA over history → mask known events + holidays → flag outliers → dedup incidents → alert.
19. ◻ **Recipe demand spike/drop** — Steps: per-recipe view/cook trend → detect sudden spike or drop → surface ("X is suddenly trending" / "Y collapsed") → digest.
20. ◻ **Search-trend shift** — Steps: weekly query-cluster shares → detect an emerging cluster (seasonal/occasion, e.g. شب‌یلدا) → surface for merchandising + authoring.
21. ◻ **Funnel-drop alert** — Steps: onboarding + cook funnel conversion → WoW → drop > band → which step → alert.
22. ◻ **Recsys-quality drift** — Steps: CTR/cook-rate/coverage/popularity-lift → drift vs baseline (PSI) → alert (the degenerate-loop early-warning).

## Mode 4 — LIFECYCLE-ACTION (these DO things — write/notify users via the notification engine, behind consent)
23. ◻ **Dormant re-engagement** — Steps: at-risk cohort (churn-risk rising + no cook N days) → pull each user's top affinity dish → compose personalized nudge → consent + fatigue gate → enqueue notification → measure return. *(6 steps, ACTION)*
24. ◻ **First-cook activation nudge** — Steps: signed up but 0 cooks in N days → pick an easy famous dish matched to their declared taste → nudge → measure activation.
25. ◻ **Saved-not-cooked reminder** — Steps: favorited but never cooked (window) → reminder with the recipe → measure cook.
26. ◻ **Shopping-list-not-completed nudge** — Steps: built a list, items unchecked N days → gentle nudge.
27. ◻ **Streak-at-risk save** — Steps: streak about to break (no cook today, streak ≥ N) → nudge → measure save-rate.
28. ◻ **Win-back** — Steps: churned (no activity 30d+) → comeback content/offer → measure resurrection.

## Mode 5 — CONTENT-OPS (improve the product automatically)
29. ◻ **Underperformer rewrite queue** — Steps: high views / low cook + low rating → flag → content-team backlog.
30. ◻ **Missing-data backfill trigger** — Steps: recipes with null nutrition / missing allergen tags / missing gram-conversions → queue for backfill.
31. ◻ **New-recipe cold-start boost** — Steps: freshly authored recipe → inject into discovery at a controlled rate → gather first signal → auto-graduate or demote.
32. ◻ **Famous-dish-gap** — Steps: dishes users search/ask-AI-for that we lack or under-serve → cross with a familiarity allowlist → prioritize authoring (fixes the "obscure stew" problem).
33. ◻ **Recipe-quality audit** — Steps: scan recipes for missing steps/photos/tips → score → flag the weak ones.

## Mode 6 — FLYWHEEL (close the loop — feed the personalization/recsys engines)
34. ◻ **Exposure→reward rollup** — Steps: join served↔attribution by requestId (IPS de-bias) → per-recipe reward → update RecipePrior (Welford) → feed ranker → log lift. *(the Stage-1 capture now makes this possible)*
35. ◻ **Taste-signal → profile update** — Steps: swaps/removes/scales → update affinity dimensions → refresh the living profile.
36. ◻ **Popularity/canonical signal builder** — Steps: chat→cook + view→cook conversions per dish → build a popularity prior → fix ranking so famous dishes surface.
37. ◻ **A/B readout** — Steps: experiment metrics → significance + guardrails → ship / ship-none verdict → digest.
38. ◻ **Ranker-prior refresh** — Steps: recompute RecipePrior from accumulated rewards on a schedule → gated activation.

## Mode 7 — AUTO-ANSWER (agentic AI support — the ticket bot)
39. ◻ **Ticket triage** — Steps: new ticket → classify intent + sentiment + language → route/tag.
40. ◻ **AI ticket auto-answer** — Steps: → safety gate (allergy/medical/billing/legal → human) → RAG retrieve from KB → draft → confidence gate → auto-send (safe + high-conf) | suggest-to-human | handoff with summary → log. *(7 steps, agentic — SUGGEST-only first, promote vetted topics)*
41. ◻ **Frustration escalation** — Steps: detect negative sentiment / repeated rephrase / rage → escalate to human with the transcript + a summary.

## Mode 8 — NARRATION (the LLM voice — agentic layer over Mode-2/3 digests; free model now → paid Claude later)
42. ◻ **AI-narrated daily brief** — Steps: take the deterministic brief's numbers → grounded LLM narration (number-validator + deterministic fallback) → plain-language "here's what happened / good-bad / do this".
43. ◻ **AI weekly insight** — Steps: take the weekly report + anomalies → LLM writes "what changed, why, what to do" → the founder's voice.

## What this proves
- Only **Mode 1 (guards)** is "simple by design" — and that's correct for safety/cost.
- **Modes 2–8 are multi-step, analytical, action-taking** — they grow the catalog, re-engage users, close the recsys loop, and auto-answer tickets. That's the "help me move my work forward / analytical info" the founder asked for.
- **Staged build:** ✅ 7 shipped (5 guards + the brief + event-health) → ⏳ next: the 3 catalog-growing analytical digests (#11 content-gap, #12 recipe-performance) + fix the guard UX → ◻ then anomaly+RCA, lifecycle actions, flywheel, auto-answer, narration.

---
*Companion: `docs/audit/ADMIN_DASHBOARD_CATALOG.md` (the ~260 metric reference). This spec is the SYSTEM that captures, computes, automates, and narrates them. Part I = blueprint; Part II = build artifacts; Part III = the automation catalog.*
