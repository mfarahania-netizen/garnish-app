# Garnish Onboarding v1 — Build Spec (distilled)

Source: `forge-onboarding-worldclass-v3` (38 agents, web-grounded benchmarks + LIVE-DB re-read, 5 red-team/refine
rounds). Claude independently verified the load-bearing claims against the live DB/code (the earlier v2 run had
anchored on a stale 124-row export and was discarded). Founder bar: ≤5 up-front questions, each must move a
DISTINCT live engine lever — no filler.

## Headline (the rigorous answer)
**v1 asks ONE up-front question (allergy safety).** For the MODAL no-restriction user it moves ZERO recipes (a
pure safety pre-write) — 100% of their first-slate value is AUTO-DERIVED by the engine. For the restricted
MINORITY, allergy + diet move real recipes off the served slate (verified: `generate() → safeIds → rank`). So the
"minimal that earns its place" count is **one-for-the-minority / zero-for-the-majority** — and the engine earning
the majority's value with no question is the IDEAL, not a gap. More up-front questions for the majority = the
exact filler to avoid.

## v1 question set (each earns its place via a LIVE lever)
1. **S1 — Allergy safety (the one up-front question).** A single safety screen: EU-14 declarable allergen chips
   (live 8 + fish, mustard, celery, lupin, sulphites, molluscs) + a visually-primary one-tap **None** fast-exit.
   Copy: "allergies only — not dislikes." Lever: `safeIds` HARD gate. Chip set governed by EU-14 legal
   declarability, NOT recipe count (peanut-at-3 must be protected → so mustard-at-3 cannot be cut).
2. **Diet / observance — optional, post-slate (S4b card + one-tap "hide meat / hide pork" on the slate).**
   Counted honestly (not "free"). Live options only: Vegetarian / Vegan (+ a separate No-pork chip). Lever:
   `where.diet` + VEG_RESTRICTIONS + no-pork path. Zero for the majority; near-required for vegan/halal (serving
   them meat on first impression is a trust violation). No-pork ships only behind a pork-coverage audit.
3. **Effort "short on time tonight" — the ONE demonstrable declared lever, IN v1.** Two cold users differing only
   in declared time get visibly different slates. Ships WITH its full wire (cooking_time persistence + the
   served-pipeline effort term in ranking.service + graded effortFit). Single binary toggle in v1.
- **Account = silent device-keyed GUEST spine** (real User + JWT minted in background) so every request carries a
  userId and hits `safeIds` (anonymous = filter OFF today — unacceptable). Phone+password is NOT the front door;
  email/social moves to a later "claim" step (value before commitment). Guest→registered merge must be additive +
  allergy-preserving.
- **NO swipe deck in v1** — the in-session re-ranker does not exist (a no-effect swipe teaches users the gestures
  are dead). Early taste = zero-effort behavior logging (taps/saves/cook-starts), personalization-gated for
  cross-session use. The swipe returns as an optional "tune these" affordance once the re-ranker ships.
- **Progressive (earned across sessions):** skill (at first "too hard"), dislikes (incl. seafood-aversion),
  servings/household (at first cook), goals/budget (deferred). UI language from device locale; market/familiarity
  cohort from server-side IP-geo at guest-mint (NOT device locale).

## Aha / metrics
Activation = **first safe slate render (S0→S4) in <60s** (the account+consent steps are silent/background or
post-value, stated relative to that clock). Healthy completion 60-80%. Track median + p75 TTV, first-cook.

## Real bugs it found (Claude-verified against live code — fix regardless of onboarding)
- **fish ↔ shellfish entanglement [VERIFIED]:** `looseMatch` (grounding-utils.ts:54-59) is bidirectional
  substring; recipe-fit.ts:93 uses it for allergen matching; `'shellfish'.includes('fish')===true` → a shellfish
  chip ALSO hides all fish dishes and vice-versa. Over-warns (safe direction) but silently shrinks the restricted
  slate. → motivates exact-match canonicalization (set-intersection on canonical tokens).
- **no-pork is best-effort:** PORK_TOKENS misses plain "sausage" + Dutch "worst" → gate the no-pork chip on a
  containsPork coverage audit.
- **personalization consent granted UNCONDITIONALLY** (useOnboarding ~line 132 on both persist paths) → real
  consent-timing defect; un-bundle + ask at a high-engagement moment.
- **anonymous = allergy filter OFF** (recipe-safety-filter:35 `if (!userId) return candidateIds`) → the guest
  spine fixes this (give every user a real JWT).
- **allergen chips chosen by recipe-count** (peanut-3-kept vs mustard-3-cut contradiction) → use the EU-14 legal set.

## Convergence — honest
The loop did NOT reach literal zero faults (5 rounds; round 5 still listed ~19 items) — but the SUBSTANCE
converged: the round-5 items are mostly framing/edge-polish (the top one is literally "state the headline more
plainly"), not design flaws. A ruthless 5-lens adversarial panel will never let the count hit exactly 0; chasing
literal-zero is diminishing returns. The design is substantively settled + live-verified.

## Decisions — MADE (manager call + research, 2026-06-21; founder delegated, lacking domain knowledge)
All decided by Claude with web research; the LEGAL ones are the conservative/safe default and still want a final
Dutch IP/privacy-lawyer sign-off before public EU launch (not a build blocker — the safe default ships; the lawyer
confirms wording/scope). Sources cited in chat.
1. **Allergy chip scope → FULL EU-14.** Ship all 14 FIC-1169/2011 Annex-II allergens (add fish, mustard, celery,
   lupin, sulphites, molluscs to the live 8). Rationale: the app's value-prop is allergy safety for an EU general
   public; a sesame/celery/sulphite-allergic user MUST be able to declare it regardless of recipe count; full-14
   is strictly safer than a subset (a subset would itself need legal sign-off). Cost = 14 chips on a one-time
   safety screen with a one-tap "None" — acceptable. Engine: extend canonicalizeAllergens with celery/lupin/
   sulphites/mustard (fish/molluscs/crustaceans already mapped).
2. **Analytics lawful basis → EXPLICIT OPT-IN CONSENT** for analytics + personalization; legitimate interest ONLY
   for strictly-essential first-party operational telemetry. Rationale: EU/GDPR + ePrivacy — non-essential
   analytics needs consent; this matches the premium privacy-first positioning + the existing consent split
   (EVENT_CONSENT_GATE_MODE / consentPurpose) + the consent-un-bundle work. Final essential/non-essential line =
   lawyer sign-off.
3. **Familiarity content → CURATED ALLOWLIST** (a small config of recipe ids flagged approachable-for-newcomers),
   not a full Recipe.familiarity field (faster, controllable). SEED = the founder's ~40 photographed/videoed
   dishes (they carry the only real premium media → perfect for the first slate) ∩ the most universally
   approachable Persian dishes for a zero-background Dutch user. Claude drafts the ranked allowlist; founder
   confirms the cultural-approachability calls + supplies which 40 are photographed.
4. **Scope → ACCEPTED.** v1 is a multi-week multi-workstream build; sequence: safety foundation (DONE: exact-match
   allergen + discover hard-hide) → guest spine → allergy screen (EU-14) → effort lever wire → first-slate
   familiarity allowlist → consent un-bundle + timing → NL/EN i18n + IP-geo cohort → allergy-wipe-safe merge.
   Built with the guardian loop.
5. Minor: **observance coexistence** (vegan AND no-pork together) → ship in v1 (cheap, correct; vegan-halal users
   exist). **Diet corpus** → MAP onboarding diet choices onto live values (vegetarian/vegan); do NOT surface
   internal high_protein/regular as user choices. **Guest-spine abuse controls** → rate-limit + TTL + IP-geo at
   POST /auth/guest (standard, part of the build).

## Imagery (founder-confirmed)
Onboarding swipe-free; the first slate + famous-first use the founder's 40 owned photos/videos (premium, zero
legal risk). Catalog long-tail = branded placeholder now → Wikimedia CC-BY + UGC progressively. No stock-as-the-
dish, no AI-as-real-photo, no scraping. (See chat research for the EU licensing rationale.)

## Build log — Piece 1: guest spine (BACKEND ONLY — honest scope)
Commits 15559c53 (spine) + the guardian-hardening follow-up. What is TRUE today:
- BACKEND only. POST /auth/guest mints/resumes a real guest User + JWT; users.service.findOrCreateGuest;
  User.isGuest + deviceKey; reaper; jwt.strategy carries isGuest.
- NOT yet wired in the FE. AuthContext still has only login/register; RequireAuth still redirects a token-less
  visitor to /onboarding, so a real anonymous visitor never reaches the gated list pages (discover/home). The
  original commit message overclaimed "every visitor now silently gets a guest, so safeIds runs for them" — that
  is the DESIGN, not the current behavior. End-to-end anonymous safety + browse-before-register land WITH the
  onboarding FE redesign (a guest is minted on first load, deviceKey persisted in localStorage), NOT bolted onto
  the about-to-be-replaced register-wall flow.
- Guardian-hardened: deviceKey is SERVER-issued (CSPRNG 256-bit), never a client-chosen value → closes weak-key
  resume-hijack + the upsert concurrent-create race; guest JWT is 24h (vs registered 7d); a @Cron reaper deletes
  EMPTY abandoned guests (>48h, zero allergies/activity/preferences — any trace protects the row).
- DEPLOY REQUIREMENT (do not skip): the guest/login/register throttle is keyed by client IP. In production behind
  a proxy/CDN, set Express `trust proxy` to the exact known hop count and verify the throttler derives the IP from
  the trusted forwarded header — otherwise the bucket either collapses to one global limit (self-DoS) or becomes
  X-Forwarded-For-spoofable (throttle bypass). The throttle is the primary guest-abuse control; the reaper is only
  cleanup.
