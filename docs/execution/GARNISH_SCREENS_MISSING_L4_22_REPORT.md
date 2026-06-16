# GARNISH-SCREENS-MISSING-L4-22 — missing screens + secondary alignment + hex stragglers

**Branch:** `exec/garnish-screens-missing-l4-22` · **Baseline:** master `aa61d4f6` (after S21) ·
**Scope:** Track 5 / S22 — FRONTEND only. Build the 5 missing screens, align 3 secondary features, drive the
non-brand hex to 0 in recipe sub-components + profile + notifications + ai-chat. No backend change.

---

## Phase 0 — intake (confirmed)
- **5 screens absent** (`app/{onboarding,cook,food-dna,achievements,settings}` did not exist) — confirmed.
- **Secondary features to align:** `features/profile` (ProfilePage/PreferencesPage), `features/notifications`
  (NotificationsPage + components), `features/ai-chat` (12 files).
- **Non-brand hex located:** recipe sub-components (~16), profile (~18), notifications (6), ai-chat (~10) — the
  legacy `#FF6B35`/`#1A237E`/`#4CAF50` (+ greys/glass rgba), NOT the saffron brand.
- **Endpoints wired:** `/profile/next-question` + `/profile/answer` (onboarding), `/recipes/:id` steps (Cook),
  `/profile` living profile (Food DNA + profile summary), `/gamification/me` (Achievements), `/users/preferences`,
  `/users/consent`, `/users/me/export`, `/users/me` DELETE (Settings), `/notifications` (Notifications).

## 1. Built — 5 missing screens (compose kit, real APIs, 4 states, routed)
- **Onboarding** `/onboarding` — wellness-framed flow on the REAL question engine (`GET /profile/next-question`
  → `POST /profile/answer`). Composes FoodDnaStepCard + Chip + FoodDnaRing. Budget is asked as a BAND (engine
  options); the allergy step is routed to the safety allergy flow (non-medical framing); **consent is surfaced
  honestly** — a `consent_required` answer opens ConsentModal, then retries. The **Food DNA reveal is the one
  earned Celebrate** (successCelebrate, reduced-motion safe). Unauthed → welcome → /auth.
- **Cook Mode** `/cook/:id` — immersive standalone route (no bottom nav), **entered from Recipe Detail's بپز**
  (one-line wiring, sanctioned by the mission). CookStep over `recipe.steps`, grounded AISheet step-help, finish
  **Celebrate** (cook_complete). 4 states (loading/error/empty-no-steps/default).
- **Food DNA** `/food-dna` — `GET /profile` living profile: per-dimension confidence + **HONEST RECONCILIATION**
  (where declared & observed differ, BOTH are shown and kept; declared-safety wins). FoodDnaRing is the
  qualitative band — **no % anxiety bar**. PreferenceMemoryRow for declared beliefs. No medical claim.
- **Achievements** `/achievements` — `GET /gamification/me`: streak with **kind grace** (frozen/fresh-start, never
  shame), earned badges, mastery. **Private — no leaderboard/comparison** (the API exposes only the owner's data).
- **Settings** `/settings` — dietary editing (→ preferences), notification prefs, **revocable consent** toggles
  (`POST /users/consent` + analytics enable/disable, honest "what's collected"), **GDPR export**
  (`GET /users/me/export` → download) + **delete** (`DELETE /users/me` → confirm → logout), dark-mode.

## 2. Aligned — 3 secondary features (kit + tokenized)
- **Notifications** — rewritten to compose **GES NotificationRow** + EmptyState + honest opt-out (settings link,
  calm "no FOMO" copy); reflects the S6 INE dry-run (IneNotificationPreview kept).
- **AI Companion** — **ChatHeader** now carries the mandatory AI disclosure (saffron glyph + an "AI" chip);
  message bubbles + input + thinking indicator tokenized. (Also fixed mechanical white-text→surface regressions
  so chat/input text stays legible.)
- **Profile** — added a **Food DNA summary** (FoodDnaRing on the real `maturity.band`) + quick links to
  Food DNA / Achievements / Settings.

## 3. Fixed — non-brand hex → 0 (GES tokens)
Tokenized via mapping (orange→`--g-color-food-saffron`/`--g-color-brand-*`, navy→`--g-color-text-primary`,
green→`--g-color-state-success-*`, greys→`--g-color-text-muted`/`--g-color-border-*`, glass rgba→surface/shadow):
- recipe sub-components: 16→**0** · profile: 18→**0** · notifications: 6→**0** · ai-chat: 10→**0**.
  Final grep (`#[0-9a-fA-F]{3,8}` and `rgba(`) across all four areas = **0**.
- Caught + fixed the over-mechanical mapping that turned white-on-dark text into `bg-surface` (invisible on light
  surfaces): ChatHeader title, MessageBubble/ChatMessages bubbles (now `text-inverse` on the dark user bubble /
  `text-primary` on the light assistant bubble), ChatInput field, and the Profile XP line.

## Safety / honesty per screen — intact
Onboarding wellness-only + banded budget + consent-surfaced + allergy→safety-flow; Cook finish-Celebrate (≤1);
Food DNA honest reconciliation (both kept, declared-safety precedence) + qualitative band (no %anxiety); Achievements
private + grace, no leaderboard; Settings revocable consent + export/delete; AI disclosure (glyph+"AI") + grounded
step-help; Notifications calm + opt-out, no FOMO. 4 states each; real imagery via branded placeholder; RTL +
reduced-motion.

---

## PHASE 2 — isolated worktree clean-install (verbatim)

```
$ git worktree add --detach ../garnish-verify exec/garnish-screens-missing-l4-22
HEAD is now at 366d55c4 feat(SCREENS-MISSING-L4-22): build 5 missing screens + align profile/notifications/AI + tokenize stragglers

$ pnpm --dir ../garnish-verify install --frozen-lockfile
Done in 30.5s                         # frozen lockfile → NO dependency changes

$ pnpm --dir ../garnish-verify/apps/server exec prisma generate
prisma ok

$ pnpm --dir ../garnish-verify build            # web (vite) + server (nest)
garnish-app:build: ✓ built in 3.27s
Tasks:    2 successful, 2 total                  # exit 0

$ pnpm --dir ../garnish-verify coverage:check
coverage: mapped=66 internal=15 admin=46 deferred=14 | UNMAPPED=0 UNREGISTERED=0
COVERAGE GATE PASSED.

$ pnpm --dir ../garnish-verify test
server:test: Test Suites: 191 passed, 191 total
server:test: Tests:       1412 passed, 1412 total     # 0 skips (= baseline)

$ git -C ../garnish-verify status --short            # only docs/qa + coverage.generated regen churn (NOT committed)
$ git -C ../garnish-verify diff --name-only master..HEAD   # 29 files (all frontend)
$ git worktree remove ../garnish-verify --force ; git worktree prune ; rm -rf ../garnish-verify
```

**Diff vs master (29 files):** `App.jsx` (5 routes) · 5 new screens (`app/{onboarding,cook/[id],food-dna,
achievements,settings}/page.jsx`) · 12 recipe-area files (11 sub-components tokenized + `recipe/[id]/page.jsx`
بپز→cook wiring) · 6 `features/ai-chat` · 3 `features/notifications` · 2 `features/profile`. **No `apps/server/**`,
no shared `components/ges/**`, no S21-core page except the sanctioned Recipe-Detail بپز wiring.**

**Scope-proof:** 5 screens exist + routed; compose kit (grep FoodDnaRing/FoodDnaStepCard/CookStep/GamificationStrip/
PreferenceMemoryRow/ConsentModal/NotificationRow/AISheet across the new screens + aligned features = present);
**non-brand hex = 0** across recipe sub-components + profile + notifications + ai-chat (grep `#hex`/`rgba(` = 0);
safety per screen (above); 4 states each; APIs preserved; RTL + reduced-motion; no new dep; server tests 1412 / 0
skips; build green. (Web has no render-test runner — pre-existing gap; the vite build is the runnable frontend gate.)

---

## REQUIRED VERDICT BLOCK

```
SCREENS_MISSING_L4_22 RESULT: PASS
Clean install (worktree): build(web+server) exit 0, coverage:check green, server tests Test Suites 191/191, Tests 1412/1412, skips 0
Missing screens built+routed: Onboarding=ok, Cook Mode=ok, Food DNA=ok, Achievements=ok, Settings=ok
Secondary aligned: Profile=ok, Notifications=ok, AI Companion=ok
Composed from S20 kit = yes
Non-brand hex = 0 in scope (recipe sub-components 16→0, profile 18→0, notifications 6→0, ai-chat 10→0) = yes, grep
Safety/honesty: onboarding wellness+consent+banded-budget, Food DNA honest-reconciliation+no-%anxiety, Achievements no-leaderboard+grace, Settings revocable-consent+export/delete, AI disclosure+kind-refusal+badge, Cook finish-Celebrate, Notifications no-FOMO = yes
4 states each + real imagery (no glyphs) + RTL + reduced-motion = yes
Frontend-only: APIs preserved, no backend/shared-component/S21-core change = yes (Recipe-Detail بپز→cook wiring is the sanctioned entry)
Boundaries: new-dep=NONE, newIngredientIDs=0, medical-framing=NONE, PII=none, runtime-shadow untouched = yes
Coverage gate: green
Merge/push: exec/garnish-screens-missing-l4-22 → master ff/pushed (commit 366d55c4 + report)
Verdict: SCREENS_MISSING_L4_22_PASS
```

> **Next:** S23 (admin to design), S24 (dark + LTR), S25 (final polish) remain.
