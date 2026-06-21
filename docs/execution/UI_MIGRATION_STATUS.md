# UI MIGRATION STATUS

> ⚠️ **SUPERSEDED (2026-06-21).** This artifact described the Phase-4A FREEZE (2026-06-13). It is **stale**:
> the UI was subsequently RESET and rebuilt under **Track-5** — all 14 screens rebuilt + a Vitest web
> smoke-test net (see root `README.md` §Frontend). The current source of truth for UI state is the root
> README + the `garnish-fe-reset` track. The historical freeze record below is kept for context only; design
> maturity (componentization of ~1180 inline styles, food imagery) remains an open pre-launch quality item.

> _(historical)_ Execution artifact tracking the GES (Garnish Experience System) UI migration phases and their
> acceptance state. UI work was FROZEN (Founder decision, 2026-06-13).

## Current state: ❄️ FROZEN (after Phase 4A visual rejection) — _superseded by Track-5 reset; see banner above_

Phase 4A passed technical scans but **failed visual / product-quality review**. The Coding Assistant (CA)
**must not continue visual redesign** without an approved visual spec / screenshot direction from
**Founder / Claude Max / UX**. The Phase 4A technical cleanup is **kept** (not rolled back); only the
**visual direction is marked rejected**.

> **Amendment 2 alignment (proposed, pending founder ratification — RESET-01, 2026-06-15):**
> - **§A2.1 — L4 quality bar:** a clean technical scan (token purity, passing build) is explicitly **not**
>   acceptance. UI must meet the L4 visual/product bar; this is exactly why Phase 4A was rejected.
> - **§A2.4 — visual direction is the unblock:** the freeze lifts only when an **approved visual spec /
>   screenshot direction** (Founder / Claude Max / UX) exists. The visual spec — not more CA token work — is
>   the single blocker. See the mandatory order in "Next UI process" below.

## Phase status

| Phase | Scope | Status |
|-------|-------|--------|
| **Phase 3 — Shell / Nav** | App shell, global layout, header/top bar, side drawer, bottom nav, route shell (`MainLayout.jsx`) → GES tokens + `lib/motion` | **Conditionally accepted** (`PHASE_3_SHELL_NAV_REPORT.md`) |
| **Phase 3.1 — Route fallback token cleanup** | `RouteFallback` loader `orange → saffron` (`App.jsx`) | **Accepted** (`PHASE_3_1_MICRO_CLEANUP_REPORT.md`) |
| **Phase 4A — Home / Command Center** | `home/page.jsx` → GES tokens + primitives + motion; loading/empty/error states | **Technical PASS, visual / product-quality REJECTED** (`PHASE_4A_HOME_COMMAND_CENTER_REPORT.md` + `qa/phase4a/PHASE_4A_VISUAL_QA_REPORT.md`) |
| **Phase 4B and beyond** | (Home polish, other surfaces) | **🚫 BLOCKED** — no work until an approved visual spec exists |
| RecipeCard migration | tokenize/redesign the recipe card | 🚫 Blocked (legacy; needs design direction) |
| Admin migration | — | 🚫 Blocked |
| AI Chat migration | — | 🚫 Blocked |
| Recipe Detail migration | — | 🚫 Blocked |
| Meal Planner migration | — | 🚫 Blocked |
| Grocery migration | — | 🚫 Blocked |

## Reason for the freeze
A clean technical scan (zero hardcoded hex/rgba, token purity, GES primitives, passing build) is **not
sufficient** for acceptance. Token compliance does **not** equal good UX. The **visual design must be
created and approved outside the Coding Assistant** (by Founder / Claude Max / UX) **before**
implementation. See evidence: [`PHASE_4A_VISUAL_QA_REPORT.md`](../qa/phase4a/PHASE_4A_VISUAL_QA_REPORT.md)
and screenshots in [`docs/qa/phase4a/`](../qa/phase4a/) (mobile/desktop, light/dark, RTL, populated +
loading/empty/error).

## Rule (binding on the Coding Assistant)
> The Coding Assistant may **only implement an approved visual spec**. It **must not invent the design
> language**, choose layout/hierarchy/art-direction, or continue visual redesign on its own initiative.
> Design decisions belong to UX (Constitution Part 18 / README §18). CA surfaces options and problems;
> it does not decide the visual direction.

## Remaining UI blockers (require a visual spec / design direction before implementation)
1. **Desktop / command-center layout** — Home is a ~480px mobile column stranded in a 1440px void; no desktop layout. (UX)
2. **Legacy `RecipeCard`** — loud orange gradient, chef-hat placeholder (no food imagery), no dark-mode handling; dominant visual element. (UX + own phase)
3. **Dark-mode canvas bug** — app `body`/AppShell background stays white while GES card tokens go dark (not bound to `--g-color-bg-canvas`; Mantine colorScheme not flipping the body). App-level/theme integration, mostly pre-existing. (patchable, but currently frozen)
4. **Hero / banner art direction** — current pale `brand-100→300` banner is accessible but washed-out / empty-feeling; needs proper art direction. (UX)
5. **Hierarchy** — flat, equal-weight stacked cards; no focal point / first-screen impact. (UX)
6. **Why / explainability** — recommendation rail has no per-item Why; data is ready (`explanation`, `reasonSignals`) but Persian reason copy (CM) + exposure decision (AA/UX) are required. (CM + AA/UX)
7. **`RecipeCard` tokenization** — not migrated to GES tokens; out of Phase 4A scope. (own phase)

## Next UI process (mandatory order)
1. **Visual spec first** — Founder / Claude Max / UX produce an approved visual direction (layout, hero,
   card system, dark mode, hierarchy), ideally as annotated screenshots / a spec doc.
2. **Implementation second** — only then does CA implement the approved spec, surface by surface, with a
   visual QA package (screenshots) per surface.

## What continues during the freeze
Non-UI **infrastructure** work resumes (does not touch any visual surface). Current infrastructure task:
**E43-W6 — Event Envelope code contract** (`docs/adr/ADR-0001-canonical-event-envelope.md`).

## References
- `docs/execution/PHASE_3_SHELL_NAV_REPORT.md`
- `docs/execution/PHASE_3_1_MICRO_CLEANUP_REPORT.md`
- `docs/execution/PHASE_4A_HOME_COMMAND_CENTER_REPORT.md`
- `docs/qa/phase4a/PHASE_4A_VISUAL_QA_REPORT.md` + `docs/qa/phase4a/*.png`
- `docs/design/GARNISH_EXPERIENCE_SYSTEM_v1.md` (+ GES design docs)
