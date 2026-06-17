# GARNISH-FE-AICOMPANION — Execution Report
**Sprint:** Track 5 Reset · Sprint K (screen 6 of 10) — AI Companion (L3 AI surface)
**Branch:** `exec/garnish-fe-aicompanion`  ·  **Baseline:** `master` @ `086c5717`
**Status:** verification GREEN → ff-merged to master + pushed · **STOP for founder screenshot review**
**Date:** 2026-06-17

---

## 1. Summary
Built the **AI Companion** at **`/assistant`** (drawer «دستیار آشپزی» → `/assistant`; Recipe Detail's
AI sheet «برای من تنظیمش کن» → `/assistant`) to `Garnish AI Companion.dc.html`. Files:
`app/assistant/{page.jsx, useAssistant.js}`. Frontend-only; backend untouched; bundle not imported. A
3-lens adversarial review ran before merge (all minors; two fixed).

## 2. The screen
- **Disclosure header** — saffron `ai-glow` glyph + «دستیار گارنیش» + «AI» badge + «ممکنه اشتباه کنه —
  برای ایده و کمک، نه توصیهٔ پزشکی» + new-conversation reset. **AI = saffron, never purple.**
- **Starter** «چطور کمکت کنم؟» + chips; the mockup's «برای لاغری چی بخورم؟» is **reframed** to the
  wellness «یه غذای سبک و مقوی چی بپزم؟» (no weight-loss / diet-as-medical framing).
- **Chat** wired to the **real `POST /ai/chat`** (the orchestrator guards every turn server-side:
  prompt-injection / medical / vision → a safe, kind, non-medical reply). AI bubbles are **disclosed +
  hedged** («پاسخِ AI ممکن است اشتباه کند») with **👍/👎** recorded as a real `ai_feedback` analytics
  event. `conversationId` is kept for thread continuity. The **kind-refusal** is the backend's reply,
  rendered as-is — no fake certainty, no fabricated answer (an honest fallback string only).
- **Thinking** «در حال فکر» indicator; **error** «دستیار در دسترس نیست / یه لحظه دیگه دوباره بپرس» + retry.

## 3. Honesty / safety
Strict AI-surface rules met: always disclosed, always hedged, kind-refusal (server-side) rendered
honestly, no fake certainty, no "AI knows you", wellness-only (reframed chip). `POST /ai/chat` returns a
guarded **string** reply (no structured recs in the response), so the mockup's embedded recipe card is
**not fabricated** — the reply text is rendered as-is. AI accent is saffron, never purple.

## 4. Adversarial review — findings (all minor)
3 lenses; **no blockers/majors**. AI-honesty lens = PASS; tokens/RTL/a11y/no-purple = clean (zero
non-brand hex, saffron not purple, ≥44px targets, labelled controls). Fixed two minors:
- disabled send button used a near-invisible inverse glyph on grey → now a **muted** icon color.
- the chat panel used a magic `calc(100dvh − 124px)` height → now **`flex:1`/`minBlockSize:0`** within
  the shell main (robust to chrome height).
Accepted minors (documented): empty-reply rendered as a normal hedged bubble; `safetyStatus` not used
to restyle refusals (the reply text already carries the refusal — honesty holds); two SoT-matched pixel
literals.

## 5. Clean-room verification (isolated worktree, detached @ `f5fcf613`)
```
git worktree add --detach ../gv-k2 f5fcf613
pnpm install --frozen-lockfile          # frozen
pnpm --dir apps/server exec prisma generate   # ok
pnpm build                              # Tasks: 2 successful, 2 total → exit 0
pnpm coverage:check                     # COVERAGE GATE PASSED → exit 0
( cd apps/server && pnpm exec jest --maxWorkers=2 --workerIdleMemoryLimit=600MB )
                                        # Test Suites: 191/191 ; Tests: 1412/1412 ; skips 0
git diff --name-only master f5fcf613 -- apps/server   # EMPTY (backend untouched)
```

### Scope-proof
- Changed set vs master = `App.jsx` (`/assistant`), `app/assistant/{page.jsx,useAssistant.js}` (new),
  `shell/navConfig.js` (drawer → `/assistant`), `app/recipe/[id]/page.jsx` (AI sheet → `/assistant`),
  `tools/coverage/coverage.registry.json` (`/ai/chat` → frontend:assistant/AssistantPage),
  `docs/coverage/coverage.generated.json`. **No other page. No `apps/server` change (incl. its `.gitignore`).**

## 6. Render — in words
A disclosed AI chat: ask via the composer or a starter chip; the assistant replies with a saffron-marked,
hedged bubble you can rate; medical/unsafe asks get a kind server-side refusal rendered honestly; thinking
and error states are calm. RTL + Vazirmatn; AI saffron, never purple; clean console expected.

---

## VERDICT
```
FE_AICOMPANION RESULT: PASS
Clean install (worktree): build exit 0, coverage green, server tests suites 191/191, tests 1412/1412, skips 0
AI Companion to mockup (header disclosure / starter chips / chat / thinking / kind-refusal / error) = ok
AI disclosed+hedged+kind-refusal, NO fake certainty / NO "AI knows you" = yes · wellness reframe (no لاغری/medical) = yes
Embedded recs n/a (chat returns a guarded string — not fabricated) · nutrition caption n/a (no structured nutrition) · AI = saffron not purple = yes
API: POST /ai/chat (server-guarded) = yes · no fabricated data = yes
bundle runtime NOT imported/bundled = yes · zero non-brand hex = yes,grep · RTL+Vazirmatn+reduced-motion+AA+44px = yes
Frontend-only, backend untouched (incl server .gitignore) = yes · coverage re-mapped; gate green
Merge/push: exec/garnish-fe-aicompanion → master (ff, pushed)
Verdict: FE_AICOMPANION_PASS
```

---

**Next: Settings + Notifications + Achievements + Admin + the final audit — screenshot-gated.**
