# GARNISH-RESET-01 — Foundation Close-out, Junk Removal, Status Truth-Alignment

**Task:** GARNISH-RESET-01 · **Date:** 2026-06-15 · **Branch:** `exec/garnish-reset-01` (off master `af9ab380`) · **Owner:** EL/CA
**Scope:** close foundational debt, remove confirmed dead/fake code, re-align status docs. **No features. No new recommendation A-layer. Recommendation stack FROZEN at A14.**

## Verdict
**RESET_01_PASS**

## Phase 0 — Intake (baseline)
- Branch `master` @ `af9ab380` (A14), clean tree; `pnpm` install present; baseline server + web builds green.
- `VoiceInput.jsx`: **present but imported nowhere** (dead fake-voice affordance); `speechService.js`: used **only** by VoiceInput; **no `ai_voice_search` client trigger** in web.
- `personalizationService.js`: present, localStorage preference store + pure date helpers; consumers = `AIChatContext.jsx`, `SuggestionChips.jsx`.
- R-E1 references present; `E1_SECRET_INCIDENT_STATUS.md` documents history commits `e715471` + `a65ec03`, path `apps/server/.env`, backup bundle.
- Recommendation `runtime-shadow/lab/activation-review/` (A14): present (frozen; untouched except build confirmation).

## Phase 1 — R-E1 git history purge (Epic E1, P0)
- **Plan written:** `docs/security/E1_HISTORY_PURGE_PLAN.md` — exact path/commits, mirror-clone + bundle backup/rollback, canonical `git filter-repo --invert-paths --path apps/server/.env` command set, **force-push consequences**, **collaborator re-clone** instructions, post-purge gitleaks/trufflehog verification. **Force-push is HUMAN-GATED — CA did NOT execute any history rewrite or force-push.**
- **Working-tree secret scan:** `gitleaks`/`trufflehog` binaries are **not installed** in this environment (consistent with `E1_SECRET_INCIDENT_STATUS.md`). Ran a documented ripgrep pattern scan over the tracked tree (`.gitignore`-respecting → `apps/server/.env` + `node_modules` excluded). **Result: 0 real secrets** — all 15 pattern hits are placeholders (`username:password`, `u:p`), redacted (`postgresql://garnish:***@…`), or deliberate denylist/eval/test fixtures (e.g. the output-safety regression corpus's fake `AIzaSy…1234567890`). No `.env` is tracked (only `*.env.example`).
- **RISK_REGISTER updated:** R-E1 → "Mitigated (active) / **purge plan ready, history rewrite pending founder execution**".

## Phase 2 — Junk removal (Amendment 2 §A2.3)
- **Removed fake voice input:** deleted `apps/web/src/features/ai-chat/components/VoiceInput.jsx` and its only backend `apps/web/src/features/ai-chat/services/speechService.js` (browser-`SpeechRecognition` wrapper; no server voice backend exists). VoiceInput was imported nowhere → no dangling imports. The harmless server-side `ai_voice_search` admin analytics counter was **left untouched** (historical metric, as instructed).
- **Replaced localStorage "personalization":** rewrote `apps/web/src/features/ai-chat/services/personalizationService.js` — removed the localStorage preference store (`loadUserPreferences` / `saveUserPreferences` + the localStorage-reading `getUserContext`). Kept only the pure ephemeral `getTimeBasedContext` / `getSeasonContext` date helpers (no localStorage, no fake personalization). Updated `AIChatContext.jsx` to drop the `loadUserPreferences` import + the localStorage-load effect; `preferences` is now ephemeral React state only. Real personalization comes from the server (`/ai/chat` BehavioralContextSnapshot orchestrator).
- Web build green after removal; chat still functions (no capability lost — both were fake/non-functional).

## Phase 3 — Status truth-alignment (Epic E0-1, P0)
- **README.md** status snapshot (→ 2026-06-15): added **L4 quality bar** (Amendment 2 §A2.1), **recommendation FROZEN at A14** (§A2.2), **fake-voice + localStorage-personalization removal** note, and R-E1 **plan-ready / pending founder force-push**. No claims of unbuilt capability.
- **UI_MIGRATION_STATUS.md:** added the Amendment 2 alignment block — §A2.1 (technical pass ≠ acceptance; L4 bar) and §A2.4 (an approved visual spec is the single unblock). UI remains FROZEN.
- **DECISION_LOG.md:** added **D11** — Constitution **Amendment 2 (PROPOSED — pending founder ratification)**: L4 bar + recommendation freeze + junk removal + visual-direction unblock + drift correction back onto W1–W26. (No Amendment 2 doc exists in `docs/execution/` yet → placeholder logged, to be superseded by the ratified doc.)

## Phase 4 — Verify
- **Tests (bounded, `--runInBand --testTimeout=30000`):** **1148 / 1152 passed**; **4 failures = exactly the known R19** legacy specs (`ranking.service`, `recipes.service`, `recipes.controller`, `feature-store.service`). No new failures (RESET-01 touched no server code).
- **Builds:** server **ok**, web **ok** (`pnpm build` green, both apps).
- **Lint:** web **ok**; server **fail** — pre-existing **R20** prettier/format debt (~2241 errors, `continue-on-error` in CI), **not introduced by RESET-01** (no server source changed). Note: the `lint` script runs `eslint --fix` which reformatted unrelated server files; that out-of-scope churn was **reverted** (`git checkout -- apps/server`) to keep the frozen recommendation stack and RESET-01 scope clean.

## Files changed
- **New:** `docs/security/E1_HISTORY_PURGE_PLAN.md`, `docs/execution/GARNISH_RESET_01_REPORT.md`
- **Deleted:** `apps/web/src/features/ai-chat/components/VoiceInput.jsx`, `apps/web/src/features/ai-chat/services/speechService.js`
- **Modified:** `apps/web/src/features/ai-chat/services/personalizationService.js`, `apps/web/src/features/ai-chat/context/AIChatContext.jsx`, `README.md`, `docs/execution/RISK_REGISTER.md`, `docs/execution/UI_MIGRATION_STATUS.md`, `docs/execution/DECISION_LOG.md`

## Boundaries honored
No live recommendation ranking change · no user-visible API response change · no recommendation `runtime-shadow` A-layer added (build-confirmed only) · no DB migration / no data import or change / no recipe/ingredient deletion · no secret values printed · **R3/R4 remain Mitigating (not closed)** · all previously-passing tests still pass (only the 4 known R19 remain).

## Remaining risks
- **R-E1:** history rewrite still pending founder execution (HUMAN-GATED force-push on a machine with Python3 + git-filter-repo + gitleaks + trufflehog).
- **R19:** 4 known legacy failing specs (non-blocking CI debt).
- **R20:** server lint/format (prettier/CRLF) debt (~2241 errors, continue-on-error); a future `prettier --write` + EOL-policy pass is the fix.
- **Amendment 2:** proposed, pending founder ratification (logged D11).
- **R3 / R4:** remain Mitigating.

## Status
Committed on review branch `exec/garnish-reset-01`. **Not merged** (no merge instruction for RESET-01; merge is a separate founder step).

---
```
RESET_01 RESULT: PASS
Files changed: E1_HISTORY_PURGE_PLAN.md (new), GARNISH_RESET_01_REPORT.md (new), VoiceInput.jsx (del), speechService.js (del), personalizationService.js, AIChatContext.jsx, README.md, RISK_REGISTER.md, UI_MIGRATION_STATUS.md, DECISION_LOG.md
Removed: VoiceInput.jsx (+ speechService.js backend; imported nowhere), localStorage personalization store (loadUserPreferences/saveUserPreferences/getUserContext)
R-E1: plan ready / pending founder force-push (HUMAN-GATED)
Build: server ok, web ok, lint server=fail (pre-existing R20 only; web=ok)
Tests (bounded): 1148/1152, failures = ranking.service, recipes.service, recipes.controller, feature-store.service (R19-only)
gitleaks (working tree): 0 (binary unavailable → documented ripgrep pattern scan = 0 real secrets)
Remaining risks: R-E1 history rewrite pending founder; R19 (4 legacy specs); R20 (lint/format debt); Amendment 2 pending ratification; R3/R4 Mitigating
Verdict: RESET_01_PASS
```
