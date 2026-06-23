# 🤝 CODEX BRIDGE — for the Codex (ChatGPT) session, and Claude's verification of it

> Codex writes directly into this repo (same folder Claude has). This file (a) tells Codex how to work so its
> output is checkable, and (b) defines EXACTLY how Claude verifies that work afterward and continues — with the
> **cheap guardian (no token-burning swarm)**.
>
> **BASELINE = `master` @ `6b584134`** (246 server suites / 2007 tests, web 36 / 171, `tsc --noEmit` clean). Tomorrow's
> review surface is precisely `git diff 6b584134..HEAD`.

---

## FOR CODEX — working rules (read FIRST, before touching code)
1. Read `docs/audit/CONTINUATION_HANDOFF.md` and follow its method.
2. **Small, complete increments. The repo stays GREEN:** `npm test` (server + web) + `npx tsc --noEmit` must pass **before every commit**. Never commit red.
3. **Deterministic-first:** the LLM narrates a deterministic answer; it is NEVER the source of a fact, quantity, or safety decision.
4. **The HARD allergy/safety gate lives OUTSIDE the LLM, fail-closed. NEVER weaken it.** Learning may only change DATA the core reads — never the request-time control flow or the gate.
5. Commit with descriptive messages; **commit + push as separate steps**; work on `master`.
6. **Keep a running log in `docs/audit/CODEX_WORK_LOG.md`** (template below), updated each meaningful step — this is how Claude understands what you did.

## SAFETY-CRITICAL FILES — do NOT change silently; if you touch one, flag it LOUDLY in the work log
- `apps/server/src/recipes/intelligence/recipe-integrity.ts` — `canonicalizeAllergens` + `ALLERGEN_ALIASES` + the Persian fold.
- `apps/server/src/ai/intent/allergen-extractor.ts` — `CANONICAL_ALLERGEN_TOKENS` + extractor word-boundaries.
- `apps/server/src/recipes/intelligence/recipe-visibility.ts` — `PUBLISHED_RECIPE_WHERE` (UGC must never reach a public surface).
- The recommendation safety filter (`RecipeSafetyFilterService`) + any allergy-gate / consent path.
- `apps/server/src/users/users.service.ts` — the allergy-write allowlist on BOTH `addAllergies` and `updatePreferences`.

## STANDING CONSTRAINTS (do not violate)
- **VPN required for live Gemini → make NO live Gemini call.** Keep everything deterministic / inert.
- `PRODUCTION_RATE_CATALOG` stays **EMPTY** (no invented prices).
- **§3: NEVER auto-write an allergy** — only a user-tapped `POST /users/allergies` writes to the safe set.
- `apps/server/.env` is gitignored (the key is local-only) — never commit it.
- No food images.

## `docs/audit/CODEX_WORK_LOG.md` — fill this and commit it
```markdown
# CODEX WORK LOG (baseline 6b584134)
## 1. Goal this session
## 2. Commits — paste `git log --oneline 6b584134..HEAD`
## 3. DONE (complete + which test covers it)
## 4. IN-PROGRESS / half-done (file:line + exact next step)
## 5. BROKEN / failing tests (exact test name + error)
## 6. Decisions made + WHY (especially any deviation from the spec/plan)
## 7. Safety-critical files touched?  (yes/no + list)
## 8. Build/test state at stop — server npm test / web npm test / tsc --noEmit
## 9. EXACT next step for the new Claude chat
```

---

## FOR CLAUDE — verification protocol when the work is handed back (the cheap guardian, NO swarm)
Run in order. Do **not** continue building until it is green + safe.
1. `git log --oneline 6b584134..HEAD` — see the commits. Read `docs/audit/CODEX_WORK_LOG.md`.
2. **Tier 0 (deterministic, $0):** `apps/server` → `npm test`; `apps/web` → `npm test` + `npx tsc --noEmit`. **Any red = fix FIRST, no continuation.**
3. **Tier 1 (targeted, cheap — a single focused read, NOT a swarm):** `git diff 6b584134..HEAD --` on the SAFETY-CRITICAL files above. Look for: gate weakened / made fail-open · an ungrounded fact or quantity · allowlist drift · a public recipe read missing `PUBLISHED_RECIPE_WHERE`.
4. **Escalate only if needed:** a scoped single-agent adversarial review ONLY if a safety file changed substantively; the Tier-2 swarm ONLY for a large/architectural change. Most days, steps 1–3 are the entire check.
5. **Green + safe → continue** from `CODEX_WORK_LOG` §9. Encode any newly found invariant as a Tier-0 test before moving on (see `GUARDIAN_PROTOCOL.md`).
