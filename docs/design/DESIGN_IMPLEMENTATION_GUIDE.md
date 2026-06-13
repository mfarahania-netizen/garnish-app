# DESIGN IMPLEMENTATION GUIDE — Garnish OS

**Audience:** the Coding Assistant (Claude Code or equivalent). **Status:** Specification for review — no code applied yet. **Authority:** Constitution v1.0.1 (A1.8.3, Part 10, Part 11); design language defined in `GARNISH_EXPERIENCE_SYSTEM_v1.md` (GES). If anything here seems to conflict with GES, GES + Constitution win and the conflict must be raised as a ticket comment, not resolved by the CA.

## 1. Purpose
Make GES v1 implementable without interpretation drift: exact files, exact token rules, exact component contracts, exact boundaries. The CA implements; the UX/UI Designer decides.

## 2. Required Files
```text
apps/web/src/styles/tokens.css      # all design tokens (DRAFT provided)
apps/web/src/styles/base.css        # resets, defaults, a11y, RTL helpers (DRAFT provided)
apps/web/src/theme/garnish-theme.js # framework theme bound to CSS vars (DRAFT provided)
apps/web/src/lib/motion.js          # the only motion source (DRAFT provided)
```
Component-level contracts live in `COMPONENT_PATTERN_LIBRARY_v1.md` (25 components) — required reading alongside this guide.
Repo evidence (inspected): `apps/web/src/styles/` and `apps/web/src/theme/` directories **do not currently exist** — these are new files; current global CSS lives in `apps/web/src/index.css` (contains legacy `--accent` and a fixed-width `#root` that the migration map retires).

## 3. Source of Truth
1) Constitution v1.0.1 → 2) GES v1 doc → 3) this Guide → 4) QA Checklist & Migration Map → 5) approved tickets (Part 11). Legacy `GARNISH_DESIGN_SYSTEM.md` is evidence only; never implement from it directly.

## 4. Ownership and Boundaries
UX/UI Designer: owns every visual/interaction/motion decision and approves all UI PRs. Coding Assistant: implements tickets exactly; may propose (as comments) but never decide; never invents components, colors, motions, or copy. Founder: approves irreversible/visible-brand changes. (Constitution Part 10.)

## 5. Non-Negotiable Rules
1. No hardcoded hex colors in JSX/CSS except inside `tokens.css`.
2. No ad-hoc animation outside `lib/motion.js`.
3. No UI component may ship without empty/loading/error states.
4. Primary actions must be reachable in the lower third on mobile where possible (Action Shelf).
5. Every AI surface must use one of: **AI Whisper / AI Sheet / AI Companion**.
6. Every recommendation must support a **Why/Explainability** surface.
7. Every nutrition-related UI must show **source/confidence** state.
8. Every new component must pass RTL **and** mobile review.
9. Design decisions are owned by the UX/UI Designer, not the Coding Assistant.
10. The Coding Assistant may implement, but not redefine, the design language.
11. **Reduced motion must be supported** (`prefers-reduced-motion` ⇒ `reducedMotionFallback`).
12. UI must never imply medical diagnosis or treatment.
13. No infinite feed patterns.
14. No public chat/DM patterns.
15. No leaderboard-style shame/comparison patterns.
16. No hidden consent or dark-pattern notification prompts.
Violation of any rule = PR blocked, no exceptions without a Designer-approved Decision Log entry.

## 6. Token System
All tokens live in `tokens.css` under `:root` (light) and `[data-theme="dark"]` overrides, namespaced `--g-*`. Categories (each present in the DRAFT): color · typography · spacing · radius · shadow/elevation · motion · z-index · semantic state · AI surface · nutrition/safety state. Components consume tokens via `var()` or the theme object — never literals. Adding a token = Designer-approved PR touching only `tokens.css` + docs.

## 7. Color Token Rules
Roles, not raw values, in components: `--g-color-bg-canvas|surface|surface-raised`, `--g-color-text-primary|secondary|muted|inverse`, `--g-color-border-subtle|strong`, brand ramp `--g-color-brand-50…900` (600 = saffron `#EA6C0A`, the only "decision" color), `--g-color-scrim-photo`. Saffron usage: primary CTA, selected states, earned success accents — never large decorative fills. Dark theme: mirrored roles, same component code. Forbidden: the legacy AI-purple ramp; per-feature accent colors; alpha-hacking brand for new tints (use defined ramp).
**Library Adapter Exception (the only hex outside tokens.css):** Mantine requires a static 10-step color array for internal theme registration. `garnish-theme.js` may mirror the exact token ramp from `tokens.css` only. No component may import these literal values. Any change must be made first in `tokens.css` and then mirrored there in the same PR. Hex lint must ignore only this one adapter block. Consolidated rule: **no raw rgba/hex anywhere outside `tokens.css` except this documented Mantine adapter color block** — the skeleton shimmer now consumes `--g-color-skeleton-shimmer` (light/dark variants in tokens).
**Theme Adapter Non-Color Exception (breakpoints only):** the adapter may mirror breakpoint token values as static strings because the library composes JS media queries at registration; components must not import these literals; change tokens.css first and mirror in the same PR. Radius is *not* excepted — `garnish-theme.js` binds radius to `var(--g-radius-*)`.

## 8. Typography Token Rules
Families: `--g-font-display` (Plus Jakarta Sans), `--g-font-text` (Inter), `--g-font-fa` (Vazirmatn) — applied per `lang`/`dir`. Sizes: `--g-font-size-12|14|16|18|22|28|34` (+`--g-font-size-hero-48` demo/splash only); base body = 16. Weights: 400/500 text, 600–800 display. Line-heights: `--g-leading-body:1.55`, `--g-leading-heading:1.25`. Rules: no px font sizes in components; numerals use display family for stats; FA text never falls back to system Arabic fonts (load Vazirmatn, v2 finding #73).
**§8a Font Loading Rule:** fonts are loaded in `index.html` (preconnect + stylesheet, or self-hosted files later) — *current repo loading was NOT inspected; verify before relying on it*. `font-display: swap` is mandatory on every face — **no FOIT**: text must paint immediately in the fallback stack (`system-ui` last in every `--g-font-*` token). Locale selection: root `lang`/`dir` drives `:lang(fa)` → Vazirmatn; EN display/text per tokens. Subsets: `latin` + `arabic` for Vazirmatn. Any font substitution or weight change requires UX/UI Designer approval recorded in the Decision Log.

## 9. Spacing Token Rules
4px scale only: `--g-space-1:4px … --g-space-10:40px` (+`--g-space-12:48`, `--g-space-16:64` for layout). Components use space tokens for padding/gap/margin; no odd literals. Screen gutters: `--g-space-4` mobile, `--g-space-6` ≥md. Stack rhythm: section gap `--g-space-8`.

## 10. Radius Token Rules
`--g-radius-input:12px`, `--g-radius-card:16px`, `--g-radius-sheet:20px 20px 0 0`, `--g-radius-chip:999px`, `--g-radius-photo:16px`. No other radii. Nested elements step down one level (card 16 → inner media 12).

## 11. Shadow / Elevation Rules
Exactly three levels (Calm depth): `--g-shadow-1` (cards, soft warm), `--g-shadow-2` (raised/sticky), `--g-shadow-3` (sheets/overlays). Warm-tinted (ink at low alpha), never pure black harshness. No drop-shadow stacking; elevation changes animate via motion presets only.

## 12. Motion Token Rules
Durations: `--g-motion-duration-fast:120ms`, `base:240ms`, `slow:360ms`, `celebrate:600ms`. Easings: `--g-ease-standard: cubic-bezier(.2,.8,.2,1)`, `--g-ease-enter: cubic-bezier(.16,1,.3,1)`, `--g-ease-exit: cubic-bezier(.4,0,1,1)`. JS consumes the same values exported from `motion.js` — single source. Legacy `bounce` easing: superseded, do not port.

## 13. Z-Index Rules
`--g-z-base:0`, `--g-z-sticky:100` (timer cluster, store-mode progress), `--g-z-shelf:200` (Action Shelf/nav), `--g-z-sheet:300`, `--g-z-overlay:400` (scrims), `--g-z-toast:500`. No arbitrary z values; stacking bugs are fixed by structure, not z escalation.

## 14. Semantic State Tokens
`--g-color-state-success` (calm green #2E7D4F base + bg tint), `--g-color-state-warning` (amber #C9821B), `--g-color-state-danger` (clay red #B43C2E — destructive only, never streak shame), `--g-color-state-info` (neutral ink tint). Each pairs `-bg`/`-fg` tokens with AA contrast. Success ≠ brand: earned-success accents may use saffron per GES §22, status messaging uses state-success.

## 15. AI Surface Tokens
`--g-color-ai-glow` = brand-600 @12% alpha (halo only), `--g-color-ai-surface` (neutral raised), `--g-border-ai` (1px brand-200), `--g-ai-glyph-size:16px`. The AI glyph + "AI" label token pair is mandatory on Whisper/Sheet/Companion headers (disclosure, EPIC 40). Forbidden: purple ramps, animated gradient borders, glow as background fill.

## 16. Nutrition / Safety State Tokens
`--g-color-nutrition-verified` (#3F7A4E + bg tint) · `--g-color-nutrition-estimate` (#C98A1B + bg tint) · `--g-color-nutrition-unavailable` (neutral). Badge anatomy token set: dot 8px + label 12px + optional source-name on tap. Allergen marker: `--g-color-allergen` uses danger-fg on subtle bg — informative, not alarming. These tokens may only be consumed by the NutritionBadge/AllergenMark components (single implementation, no copies).

## 17. Component State Requirements
Every component ships with: default/hover(where pointer)/active/focus-visible/disabled **and** — for any async/data component — empty/loading(skeleton twin)/error wired to the shared State library. Storybook (or equivalent) story per state for the golden components. PRs adding a component without its three data states are auto-blocked (Rule 3, QA #6–8). Per-component anatomy/states/behavior/a11y/events contracts: see `COMPONENT_PATTERN_LIBRARY_v1.md` — components must match their pattern-library row before merge.

## 18. Responsive / Mobile Rules
Mobile-first breakpoints: `--g-bp-sm:480`, `md:768`, `lg:1024`, `xl:1280`. The current fixed-width `#root` (1126px in `index.css` — inspected) is retired in migration P0. Layout: fluid 4/8/12-col grid by breakpoint; Action Shelf + bottom nav respect `env(safe-area-inset-bottom)`; sticky elements use `--g-z-sticky`. Hover is enhancement-only; all functionality reachable by touch. Test matrix: 360×740 and 414×896 minimum.

## 19. RTL / LTR Rules
Logical properties only (`*-inline-*`, `inset-inline`, `text-align:start`) — physical left/right in new code = PR blocked. Root sets `dir` + `lang`; the existing `DirectionalIcon` pattern (component present in repo — verify before reuse) handles mirroring; food photography and brand glyph never mirror. Both-direction screenshots required (QA #3/#4). String expansion +35% must not break shelves/chips.

## 20. Accessibility Rules
Implements GES §24: AA contrast via tokens; `--g-focus-ring` on every interactive (never `outline:none` without replacement); keyboard paths for web; aria-live for streams/results; labels for icon-only buttons; reduced-motion compliance; axe serious/critical = 0 in CI for golden screens. A11y failures are release blockers, not backlog items.

## 21. Recommendation Explainability Rules
Implements GES §27: a single `WhyChip` + `WhySheet` pair, fed exclusively by the explanation payload from the recommendation/AI layer (EPIC 18/21; tool `explain_recommendation`). Max 3 reasons; correction row emits the standard correction events. Building a recommendation surface without wiring Why = Rule 6 violation. Never fabricate reasons client-side.

## 22. AI Surface Implementation Rules
Only the three patterns below; all calls go through the AI Orchestrator with a `BehavioralContextSnapshot` (E47 Annex — calls without snapshot must fail fast, UI shows the safe-degraded state). Disclosure header (glyph+label) mandatory; streaming UI only in Companion/Sheet; plan/list **writes require explicit user confirmation** in the UI before any mutation call. Guard-blocked responses render the kind refusal pattern with alternatives.

### Allowed AI Surface Patterns
| Pattern | Use When | UI Behavior | Must Include | Must Not Do |
|---|---|---|---|---|
| **AI Whisper** | A single in-context suggestion can save the user a decision (empty plan slot, gap in list, relevant tip) | One-line inline card; accept/dismiss; appears with `gentleFade`; capped per screen/session; dismiss suppresses ≥7 days | AI glyph+label · one-line reason or Why chip · accept & dismiss · event emission | Block content · auto-apply · stack multiple whispers · re-nag after dismiss |
| **AI Sheet** | The user wants to act on the *current* object ("adjust this recipe", "help with this step/slot") | Bottom sheet (`sheetEnter`), context chip of the anchored object, streamed answer, inline actions; closes back to same scroll | Disclosure header · context chip · E47 four tools only · explicit-confirm for any write · Why on embedded recs | Navigate away · full-screen takeover · invent tools · silent writes |
| **AI Companion** | Open-ended food conversation, multi-turn | Dedicated `/ai-chat` screen; history persisted; streaming; per-answer 👍/👎 | Disclosure header · feedback per answer · safe-refusal pattern · nutrition badge on any numbers | Claim memory/abilities beyond build · medical advice · unlabeled certainty |

## 23. Nutrition UI Implementation Rules
Implements GES §26: one `NutritionBadge` component (three states) consumed everywhere numbers appear; numeric values render only when the data layer marks `source-locked` (EPIC 12) — otherwise the estimate/unavailable presentation, never invented zeros; `AllergenMark` on declared allergens in ingredient lists; persistent calm disclaimer line on nutrition panels; banned-words list enforced in copy (no diagnose/treat/cure/detox/fat-burning). Duplicate badge implementations are forbidden — extend the single component.

## 24. Motion Implementation Rules
`lib/motion.js` is the only motion source: presets `gentleFade · riseIn · sheetEnter · whisperPulse · cardShift · successCelebrate · reducedMotionFallback` (DRAFT provided). Components import presets; no inline `transition`/`@keyframes`/animation libs elsewhere (lint guards this). `successCelebrate` may fire only on cook_complete / level-up / milestone, max once per session, and must route through the reduced-motion check. **Approved exception:** the skeleton shimmer (`@keyframes g-shimmer` in `base.css`) is the single sanctioned CSS keyframe, owned by the shared Skeleton/State pattern; it is part of the design system, not ad-hoc motion. Any other `@keyframes`/inline transition outside `motion.js` remains forbidden. New presets = Designer approval + motion.js PR only.

## 25. Do-Not-Implement List
Anything in Constitution Part 2.3 / GES §29, plus specifically for the CA: public feed/chat/DM/leaderboards or any social-graph UI · community UGC publishing surfaces (pre-C4) · medical/diagnostic UI or copy · multi-agent/autonomous-agent UI affordances ("agents working for you" theatre) beyond E47 · paid-streak/FOMO/variable-reward mechanics · hidden consent, pre-checked boxes, permission nags · purple AI branding · new fonts/colors/radii/motions outside tokens & motion.js · per-page bespoke empty/error styles · left/right physical CSS · localStorage-based consent bypasses · any UI claiming unbuilt capabilities.

## 26. Pull Request Checklist
Every UI PR must contain: link to the approved ticket (Part 11) + GES/Guide section references · filled `DESIGN_QA_CHECKLIST.md` · before/after screenshots: light+dark × RTL+LTR · state evidence (empty/loading/error) · axe summary for touched screens · note on events emitted (Envelope fields) · Designer review approval · no tokens.css/motion.js edits unless the ticket says so. CI gates: hex-lint, motion-import lint, logical-properties lint, visual diff on golden screens (post-W5).

## 27. Coding Assistant Boundaries
The CA: implements approved tickets exactly; raises conflicts as comments; proposes improvements only as comments tagged `proposal:`; never alters design tokens, motion presets, copy voice, or interaction patterns without a Designer-approved ticket; never merges its own UI work; never marks design work "done" without the QA evidence; stops and asks when a spec is ambiguous instead of inventing. Strategy, UX vision, AI policy, market positioning, scope: out of bounds permanently (Constitution Part 10/11; the README warning text applies verbatim).

## Design Token Naming Convention
Stable standard (proposed; current code has no competing convention — `styles/` dir absent, legacy `--accent` in `index.css` is being retired):
```text
--g-{category}-{role}[-{variant}][-{state}]

--g-color-bg-canvas          --g-color-bg-surface        --g-color-bg-surface-raised
--g-color-text-primary       --g-color-text-secondary    --g-color-text-muted
--g-color-border-subtle      --g-color-brand-600         --g-color-food-saffron (alias of brand-600)
--g-color-ai-glow            --g-color-ai-surface
--g-color-state-success-bg   --g-color-state-danger-fg
--g-color-nutrition-verified --g-color-nutrition-estimate --g-color-nutrition-unavailable
--g-font-display             --g-font-size-16            --g-leading-body
--g-space-1 … --g-space-10   --g-radius-card             --g-shadow-2
--g-motion-duration-fast     --g-ease-enter              --g-z-sheet
--g-focus-ring               --g-scrim-photo             --g-bp-md
```
Rules: lowercase kebab; numeric scales for size-like tokens; role names (never raw color names except the brand ramp + the single `food-saffron` alias); dark theme overrides the same names under `[data-theme="dark"]` — components never reference theme-specific tokens.

— END OF IMPLEMENTATION GUIDE —
