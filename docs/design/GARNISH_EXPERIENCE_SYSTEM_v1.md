# GARNISH EXPERIENCE SYSTEM v1 (GES)

**Status:** Specification — review draft, externally audited patch v1.0.1 applied (Appendix A added). No UI claimed implemented. 30 core sections + Appendix A.
**Owner:** UX/UI Designer (A/R per Constitution Part 10). **Binding source:** `GARNISH_OS_MASTER_EXECUTION_CONSTITUTION_v1.0.1.md` (A1.8, EPIC 42, E47 Annex, Part 2.3). **Design source:** Strategic Correction v3 §5 (5.1–5.20). **Legacy evidence:** `GARNISH_DESIGN_SYSTEM.md` v3.0 (superseded where conflicting; see COMPONENT_MIGRATION_MAP and Conflict Resolution in the pack report).
**Language note:** Docs are English-first (universal-first repo, EPIC 41); Persian copy examples appear where the fa locale differs.

---

## 1. Executive Summary

GES v1 is the single design language for Garnish OS: a calm, warm, mobile-first system for an AI-native food intelligence product. It encodes how the product looks (Saffron Warm Neutral palette, two-scale typography), how it behaves (a fixed gesture vocabulary, bottom-anchored "Action Shelf", progressive disclosure), how AI appears (exactly three surfaces: **AI Whisper / AI Sheet / AI Companion**, always with disclosure and a **Why/Explainability** path), how it moves (three motion intents: **Settle / Respond / Celebrate**), and how it protects people (nutrition **Source/Confidence badges**, no medical-claim UI, no dark patterns, no public-feed/chat patterns, **reduced motion** and **RTL/LTR parity** everywhere). Every rule below is testable; acceptance criteria feed `DESIGN_QA_CHECKLIST.md`. Implementation is gated: tokens/base/theme land via EPIC 29/30 (W4), motion via EPIC 31 (W5), surfaces migrate per `COMPONENT_MIGRATION_MAP.md`. Nothing in this document is a claim that UI already exists.

## 2. What GES Is

- The **only** source of visual, interaction, AI-surface, motion, and state language for Garnish (Constitution A1.8.1).
- **Inspiration without copying:** Apple-HIG-grade clarity and restraint; One-UI-grade one-hand reachability; Headspace-grade kindness — translated into a Garnish-native, food-intelligence-specific language (v3 §5 preamble, §13 benchmarking).
- **Behavior-aware:** every surface is designed to produce clean, low-friction behavioral signals and to show users what the system inferred, with a correction path (v3 §5.16).
- **Safety-first:** nutrition uncertainty is visible; AI presence is disclosed; consent surfaces are honest.
- Implementation-ready: each principle maps to tokens, components, acceptance criteria, and QA checks.

## 3. What GES Is Not

- Not a copy of Apple, Samsung, or any vendor system; not a generic SaaS kit; not a restaurant/recipe-blog aesthetic.
- Not an investor-pitch document and not evidence that any UI is implemented.
- Not a place for new product features, roadmap items, or strategy (File Closing Rule applies).
- Not permitted to define: public feed, public chat/DM, public leaderboards, shame comparison, medical diagnosis/treatment UI, hidden consent, casino-style rewards, fake AI certainty, nutrition certainty without source (Constitution Part 2.3; prompt §9 boundaries).
- Not overridable by the Coding Assistant: CA implements, never redefines (Part 10; Guide §27).

## 4. Design Philosophy

Five global laws inherited from v3 §5 govern every section below:

1. **Calm depth** — depth communicates hierarchy, never spectacle: max 3 elevation levels, soft warm shadows, blur used sparingly for sheets only.
2. **One-hand mobile reach** — primary actions live in the lower third ("Action Shelf"); the top of the screen is for orientation, not work.
3. **Content-first, chrome-less** — food imagery and the decision at hand dominate; UI appears when needed (progressive disclosure).
4. **Every state tells a story** — empty/loading/error are designed moments that guide, never dead ends (Empty-state storytelling).
5. **Respect** — `prefers-reduced-motion` honored, AA contrast, RTL/LTR parity, no dark patterns, honest AI and nutrition uncertainty.

Tone of voice: "the calm cooking companion" — short sentences, second person, zero shame (see §10 Emotional Design).

---

## 5. Visual Language

| Principle | Implementation Rule | Components Affected | Acceptance Criteria | Anti-Pattern |
|---|---|---|---|---|
| Saffron Warm Neutral palette: saffron `--g-color-brand-600` is reserved for *decisions and earned success*; ~80% of any screen is warm neutral; food photography is the only saturated mass | All colors come from `tokens.css`; brand ramp 50–900 (legacy #EA6C0A ramp adopted); canvas `#FAF7F2`, surface `#FFFFFF`, ink `#1F1B16` (dark theme mirrors via `[data-theme="dark"]`) | Buttons, chips, links, RecipeCard, badges, charts | Hex-lint: 0 raw hex outside tokens.css; per-screen audit: ≤1 saffron primary action visible at a time | Rainbow category colors; saffron used for decoration; pure-black text on pure-white |
| Two-scale typography: Display for emotional titles, Text for function | EN Display = Plus Jakarta Sans (600–800), EN Text = Inter (400–500), FA = Vazirmatn (adopted from legacy evidence; fonts must actually be loaded — v2 finding #73); scale: 12/14/16(base)/18/22/28/34 px, optional 48 hero for splash/demo only | All text components, Home greeting, Food DNA summary card | Base body = 16px; line-height ≥1.5 body, ≥1.25 headings; fonts present in network tab on first load | 15px default body (legacy) for dense screens; >2 families per locale; decorative fonts |
| Food imagery as the hero | Fixed ratios: 4:3 card, 1:1 grid, 16:9 hero; warm natural-light treatment; bottom scrim gradient `--g-scrim-photo` for text-on-photo; never stretch/tint photos with brand color | RecipeCard, RecipeDetail hero, Cook Mode header, Weekly food story frames | All images use `<img>` with ratio boxes + blurhash placeholder; CLS contribution ≈ 0 | Stock-photo gloss; saffron-tinted overlays on food; watermark UI |
| Iconography: one family, outline-first | Tabler Icons (legacy choice adopted — compatible with GES restraint), 1.75px stroke, 20/24 sizes; filled variants only for active nav states | Nav, chips, badges, list rows | No mixed icon families in a screen; icon-only buttons have aria-labels | Emoji as UI icons; multicolor icon sets |

## 6. Interaction Language

| Principle | Implementation Rule | Components Affected | Acceptance Criteria | Anti-Pattern |
|---|---|---|---|---|
| Fixed gesture vocabulary | tap = select/confirm · long-press = preview/secondary actions · horizontal swipe on cards = save (right) / dismiss (left), wired to EPIC 19 feedback · pull = refresh · **bottom sheet** = any multi-option decision | RecommendationRail, RecipeCard, lists, all pickers | The 8 core screens use no interaction outside this vocabulary (design review log) | Center modals for choices; hidden custom gestures; swipe meanings that differ per screen |
| Action Shelf (bottom-anchored primaries) | Every working screen exposes its primary action(s) in a persistent lower-third shelf or floating bar ≥44px targets, thumb-reachable | Home Briefing CTA, RecipeDetail "Cook", Planner "Fill with AI", Grocery "Store mode", Cook Mode controls | Reach-map audit: no primary action above 66% screen height on a 6.1–6.7" device | Primary CTAs in the top app bar; FABs hiding content |
| Touch ergonomics | Min target 44×44px (fix v2 #30); spacing tokens only; haptic light on save/complete where supported | All tappables | Automated check on padding/size in QA; manual thumb test both hands | 32px icon buttons; targets at screen corners |
| Forgiveness over confirmation | Destructive/dismiss actions get **undo (5s toast)** instead of confirm dialogs where safe; true-destructive (delete account/data) keeps explicit confirm | Lists, grocery check-off, plan slot clear | Undo present on swipe-dismiss and check-off; e2e covers undo restore | "Are you sure?" walls for trivial actions; silent destructive swipes |

## 7. AI Surface Language

AI appears in **exactly three shapes** — anything else is a violation (E47 Annex; Guide §22):

| Principle | Implementation Rule | Components Affected | Acceptance Criteria | Anti-Pattern |
|---|---|---|---|---|
| **AI Whisper** — one-line, in-context, dismissible suggestion with a reason | Single sentence + optional inline reason + [accept]/[dismiss]; appears inline in the surface (never blocks); frequency-capped per screen per session; always marked with the AI glyph + "AI" label (AI-Act-aware disclosure, EPIC 40) | Home, Planner empty slots, Grocery gaps, Detail tips | Each Whisper logs `whisper_shown/accepted/dismissed`; dismiss = no re-show same suggestion ≤7 days; glyph present 100% | Toast-spam suggestions; auto-applying without accept; unlabeled AI text |
| **AI Sheet** — contextual conversation anchored to the current object | Bottom sheet over current screen, pre-filled context chip ("About: Ghormeh Sabzi"), supports the 4 v1 tools only (`search_recipes`, `explain_recommendation`, `get_user_food_context`, `log_ai_feedback`); streams reply; never navigates away | RecipeDetail "Adjust for me", Cook Mode help, Planner slot help, DNA edit | Sheet opens <300ms (Settle); context chip correct; closing returns scroll position | Full-screen takeover for one question; tool fantasies beyond E47 |
| **AI Companion** — the full chat | Dedicated screen; persistent history (ChatMessage); same disclosure header; feedback 👍/👎 per answer (`ai_answer_feedback`) | /ai-chat | Streaming TTFT <1.5s target; every answer carries feedback affordance + Why where a recommendation is given | Pretending memory/abilities it lacks; fake typing theatrics >600ms |
| Honest uncertainty (no fake AI certainty) | AI never states nutrition numbers unless source-locked (badge appears, §26); hedged phrasing tokens for low-confidence ("This is an estimate…"); refusal styles are kind and offer alternatives | All three surfaces | Guard-block responses render the safe-refusal pattern, not raw errors | Confident hallucinated facts; "AI knows you" mystique copy |
| Visual identity of AI = saffron-tinted glow, not "AI purple" | `--g-color-ai-glow` = brand-600 @12% alpha halo + neutral surface; legacy purple ramp (#A855F7) is **superseded** | Whisper container, Sheet header, Companion header | Zero purple-ramp usage in new work; glow only as 1px-blur halo, never full backgrounds | Neon gradients; sparkle confetti on every AI line |

## 8. Motion System

Three intents only — **Settle** (things arriving), **Respond** (things reacting), **Celebrate** (earned success) — implemented exclusively via `lib/motion.js` presets (Guide §24).

| Principle | Implementation Rule | Components Affected | Acceptance Criteria | Anti-Pattern |
|---|---|---|---|---|
| Settle: calm arrival | Durations `--g-motion-duration-base` 240ms (lists/cards) to `slow` 360ms (sheets/pages); easing `enter` cubic-bezier(.16,1,.3,1); presets `gentleFade`, `riseIn`, `sheetEnter`, `cardShift` (stagger ≤55ms, ≤6 items) | Page transitions, rails, sheets | All entries use presets; no entry >400ms; stagger capped | Parallax theatrics; >600ms page loads of motion |
| Respond: tactile feedback | Press = scale 0.97 @120ms `fast` + light haptic; toggles/checks animate state in ≤200ms | Buttons, chips, check-off, swipe cards | Press feedback visible on every primary control | Bouncy spring on every tap (legacy `bounce` easing is **superseded** as gimmick) |
| Celebrate: rare, earned | `successCelebrate` (≤600ms, one soft saffron pulse + check draw) fires only on: cook_complete, level-up, milestone — **max 1/session** (v3 §5.4) | Cook Mode finish, Achievement unlock | Event-gated; never on routine saves; respects reduced motion (falls back to static check) | Confetti rain; streak fireworks; celebration on app open |
| Reduced motion is first-class | `prefers-reduced-motion` ⇒ `reducedMotionFallback`: opacity-only ≤120ms, zero transform/scale/pulse | Everything | QA toggles OS setting: no translate/scale anywhere; Celebrate becomes static | "Reduced" that still slides; ignoring the media query |

## 9. Food Photography System

| Principle | Implementation Rule | Components Affected | Acceptance Criteria | Anti-Pattern |
|---|---|---|---|---|
| Editorial warmth, consistent grammar | Natural warm light, 30–45° angle, neutral textured backgrounds; ratios per §5; loading = blurhash → full | RecipeCard, Detail hero, Story frames | Phase-1 asset checklist passes for the 40 hero recipes (v3 §5.5); zero off-grammar images on core surfaces | Mixed flash/dark stock; busy props stealing focus |
| Honest placeholders for missing media | Current dataset media paths have no files (v2 evidence) ⇒ branded generative placeholder (saffron line-pattern plate motif) with recipe initial — never fake stock of a *different* dish | Anywhere an image is absent | Placeholder component exists; no broken-image icons; no misleading substitutes | Random stock photos implying the dish; gray boxes |
| Photography never carries UI | Text on photo only over `--g-scrim-photo`; no buttons floating on uncontrolled imagery | Cards, heroes | Contrast on scrim ≥4.5:1 for title text | White text on bright food; icon soup over photos |

## 10. Emotional Design

| Principle | Implementation Rule | Components Affected | Acceptance Criteria | Anti-Pattern |
|---|---|---|---|---|
| Voice: calm cooking companion | Short sentences, second person, plain words; bilingual voice doc owned by Content (W5 gestures/voice deliverable); never shame ("Busy week — want to start simple?" not "You failed your streak") | All microcopy, notifications, empty/error states | Every new string reviewed against voice doc; zero shame-words list enforced | Drill-sergeant fitness tone; cutesy overload; guilt pushes |
| Kind moments at emotional peaks | First DNA reveal, first cook completion, streak rescue get bespoke copy + Celebrate/Settle pairing | DNA summary, Cook finish, streak-care notification | The three moments have specced copy in both locales | Generic "Success!" toasts at peaks |
| Errors preserve trust | Error pattern = what happened + what's safe ("Your list is saved offline") + one retry action; technical codes hidden behind "details" | All error states | Error-copy review in QA #24; no raw stack/HTTP text user-facing | Blame-the-user copy; dead-end errors |

## 11. Mobile Ergonomics

| Principle | Implementation Rule | Components Affected | Acceptance Criteria | Anti-Pattern |
|---|---|---|---|---|
| One-hand mobile reach | Action Shelf bottom-anchored; nav at bottom; top reserved for context/orientation; safe-area insets respected (`env(safe-area-inset-*)`) | Every screen | Reach-map audit on 2 device sizes; primaries ≤ lower third | Hamburger-top primaries; toolbars at the very top for actions |
| Typing is a last resort | Frequent inputs = chips/sliders/steppers/voice; search keyboards open only on explicit tap | Onboarding, filters, planner, grocery add | Food DNA completable with ≤1 free-text field; grocery quick-add ≤2 taps | Form-first flows; mandatory text everywhere |
| Big-knuckle Cook Mode | In Cook Mode: ≥56px controls, bottom cluster, voice next/back optional | Cook Mode | Controls usable with knuckle test; wake-lock active | Tiny step arrows mid-screen |

## 12. Progressive Disclosure

| Principle | Implementation Rule | Components Affected | Acceptance Criteria | Anti-Pattern |
|---|---|---|---|---|
| Decision layer first (≤3 choices above the fold) | Each screen's first viewport = the decision: e.g., Detail shows photo, time, difficulty, "Cook" CTA; nutrition/substitutions/FAQ live in accordions/sheets | Home, Detail, Planner, Profile | Fold-audit screenshots per screen: ≤3 decisions visible | Spec-sheet walls; 8 equal CTAs |
| Depth is one gesture away | Accordions and sheets, never new full pages for secondary info | Detail sections, Why surfaces, settings | Secondary info reachable in 1 tap; back returns scroll position | Pogo-stick navigation |
| Defaults beat questions | System pre-fills from DNA/behavior with visible "change" affordance | Planner autofill, serving sizes, filters | Every default editable inline; edit emits correction event (§20) | Locked smart defaults; silent personalization |

## 13. Cook Mode Experience

| Principle | Implementation Rule | Components Affected | Acceptance Criteria | Anti-Pattern |
|---|---|---|---|---|
| **Cook Mode stepper**: one step, one screen | Full-screen, distraction-free: step text ≤2 lines large type, optional photo, prev/next giant bottom controls; progress dots top; wake-lock on | CookMode feature (NEW — no current implementation claimed) | Complete a recipe without leaving mode; steps legible at arm's length (≥22px) | Showing the whole recipe scroll; notifications overlaying steps |
| Multi-timer that forgives | Timers attach to steps, persist across steps, survive backgrounded tab where platform allows; gentle chime + visual pulse | Timer chip cluster (sticky) | Two parallel timers run correctly in e2e; missed timer shows kind catch-up copy | Modal alarm walls; silent timer loss |
| Dirty-hands operation | Voice next/back (existing speechService — re-verify), large targets, high-contrast | Cook Mode controls | Voice toggle works where supported; all actions ≥56px | Gesture-only secrets |
| Outcome capture closes the loop | Finish ⇒ Celebrate + 3-option `post_cook_feedback` (loved/ok/no) + optional photo (private by default — no public share pattern) | Finish screen | `cook_complete` + feedback events fire; skip allowed | Forced ratings; public-share nags (pre-C1) |

## 14. Grocery Interaction Experience

| Principle | Implementation Rule | Components Affected | Acceptance Criteria | Anti-Pattern |
|---|---|---|---|---|
| **Grocery merge state** is visible and trustworthy | Items merged across recipes by `ingredientId` (EPIC 27) show a merge chip ("3 recipes") expandable to sources; unit-merge conflicts surface as a gentle review row, never silent math | Shopping list rows | Zero duplicate ingredient rows in e2e; merge chip expands to correct sources | Silent quantity guesses; duplicate rows per recipe |
| Store mode = speed | Aisle-category sort (dictionary categories), giant check targets, 5s undo, "have it" secondary action feeding pantry signal, sticky progress | Store-mode view | 20 items checkable ≤40s (usability test); undo restores | Alphabet-only sort; confirm dialogs per item |
| Substitution surfaces are honest | Suggested swaps (dataset substitutions) appear as Whisper with reason + price/time impact when known; never auto-replace | List + Detail | Swap requires accept; emits events | Auto-substitution; sponsored-looking swaps |

## 15. Meal Planning Interaction Experience

| Principle | Implementation Rule | Components Affected | Acceptance Criteria | Anti-Pattern |
|---|---|---|---|---|
| Week as calm columns | Day columns, low density, drag with polished physics (EPIC 26); slot affordance for empty days | Planner board | Drag works without jumps on 2 devices; plan a full week ≤60s with autofill | Spreadsheet grids; cramped month views |
| **Plan-with-AI** is a confirmed tool, not an agent | Whisper offers to fill gaps using DNA/behavior; user confirms before any write (E47 Annex: AI cannot create/modify plans without explicit confirmation); each filled slot shows Why | Planner Whisper + slot cards | No plan mutation without explicit accept (e2e); each AI slot has Why chip | Auto-filled weeks; "AI planned for you" surprises |
| **Meal plan confidence** is visible | Each AI-filled slot carries a small confidence tint/label (high/medium) derived from snapshot match; low-confidence slots invite a tap-to-adjust | Slot card corner badge | Badge present on 100% AI fills; tap opens AI Sheet for that slot | Fake 100% confidence; hidden uncertainty |

## 16. Home Command Center

| Principle | Implementation Rule | Components Affected | Acceptance Criteria | Anti-Pattern |
|---|---|---|---|---|
| Home answers "what now?" with exactly four blocks | 1) **Daily Briefing** card (tonight's suggestion + one-line Why + accept CTA) 2) **Continue** (in-progress plan/cook) 3) personal **Recommendation Rail** 4) **Habit pulse** (streak/weekly goal) — nothing else (v3 §5.12; supersedes legacy home IA) | HomeV3 | Above-the-fold = Briefing + Continue only; fold-audit screenshot in PR | **No public-feed patterns**: no infinite scroll, no social cards, no stories bar |
| Briefing is the daily ritual | One per day per meal context; accept/reject/swap logged; reason text from explain_recommendation | BriefingCard | `briefing_view/accept/reject` events wired; reason renders | Multiple competing "for you" stacks |
| **Behavioral insight card** (when earned) | Occasional single card surfacing a confirmed insight ("Tuesdays are your best cooking days") with confirm/correct affordance feeding §20; capped 1/week on Home | InsightCard | Insight has evidence-trace tap; correction event exists; cap enforced | Horoscope-y daily "insights"; uncorrectable claims |
| **Weekly food story** entry lives here, gently | Sunday-personal entry chip to Story viewer (10.7); never blocks Home | StoryEntryChip | Chip appears only when story ready; view event logged | Auto-playing story takeovers |

## 17. Empty / Loading / Error Storytelling

| Principle | Implementation Rule | Components Affected | Acceptance Criteria | Anti-Pattern |
|---|---|---|---|---|
| **Empty-state storytelling**: every empty guides | Pattern = warm illustration (line, saffron accent) + one sentence + one next action ("Nothing saved yet — start with these three") | EmptyState library used by all lists | 100% list surfaces use library; every empty has an action (QA #25) | Blank voids; "No data" text |
| Loading is branded skeleton, never spinner-first | Skeleton blocks mirror final layout; spinner only as fallback >3s with copy | SkeletonCard/Row/Hero | No bare spinners <300–3000ms range; skeleton matches layout (no CLS) | Full-screen spinners; fake progress bars |
| Errors keep people safe (see §10) | Library ErrorState with cause-category copy + retry + offline reassurance where true | ErrorState | All fetch surfaces route through ErrorState; copy reviewed | Raw error JSON; punitive red walls |
| Privacy-sensitive states are explicit | Consent-off analytics state, data-export pending, account-deletion pending each have a clear labeled state (no silent limbo) | Settings/Privacy surfaces, ConsentModal flow | Each state visible + explained + next step; matches EPIC 4/39 flows | Hidden toggles; ambiguous "syncing…" forever |

## 18. Investor Demo Visual Standard

| Principle | Implementation Rule | Components Affected | Acceptance Criteria | Anti-Pattern |
|---|---|---|---|---|
| Demo = the product at its truthful best | Demo seed (EPIC 34): photographed hero recipes, realistic names, both themes clean, incomplete flags hidden; rhythm: Briefing → DNA → Cook Mode → Insight, a visual beat ≤ every 45s | Demo dataset + flagged build | Recorded run ×2 without dead ends; Founder sign-off | Faking unbuilt features on stage; lorem data |
| No claims beyond build | Demo never shows community/feed/B2B/agents; AI shown = E47 scope only | Demo script | Script cross-checked against Part 2.3 / E47 Annex | "Coming soon" smoke as if live |

## 19. Design QA System

| Principle | Implementation Rule | Components Affected | Acceptance Criteria | Anti-Pattern |
|---|---|---|---|---|
| No UI merges without QA evidence | Every UI PR: `DESIGN_QA_CHECKLIST.md` filled + before/after screenshots (both themes, RTL+LTR) + UX approval (Part 10) | All UI PRs | Checklist file referenced in PR template; merges blocked without UX review | "Small tweak" exemptions |
| Five golden screens under visual regression | Home, Detail, Planner, Grocery, Cook Mode snapshotted in CI (post-W5) | CI visual tests | Diffs reviewed; baseline updates require UX approval | Auto-accepting diffs |
| New UI tasks must cite design docs | From W5 gate: no UI ticket starts without GES/Guide references (Constitution A1.8.6) | Ticketing | Ticket template carries GES refs | Vibes-based UI tickets |

## 20. Behavioral UX System

| Principle | Implementation Rule | Components Affected | Acceptance Criteria | Anti-Pattern |
|---|---|---|---|---|
| Every surface yields one clean explicit signal | One-tap save/dismiss/cooked/skip-reason affordances designed-in (not bolted on); events per Envelope (ADR-0001) with surface/context | Rail, Detail, Planner, Grocery, Notifications | Signal affordance present per surface map; events validated | Inferring everything from dwell only; signal-less pretty screens |
| **No inference without a correction path** | Anything the system "believes" (DNA traits, insights, segments shown) is viewable & editable in Preference Memory; edits override models immediately (explicit wins) | Memory Dashboard, DNA card, InsightCard | 100% displayed inferences editable; `insight_correction` wired | Black-box "we know you" UI |
| Comparison is self-only | Progress visualizations compare user to their own past, never to others (Constitution: no public comparison) | Habit pulse, progress charts | Zero cross-user comparison elements | Percentile shaming; friend rankings |

## 21. Habit Formation UX

| Principle | Implementation Rule | Components Affected | Acceptance Criteria | Anti-Pattern |
|---|---|---|---|---|
| Visible cue→action→reward loop | Cue = Briefing/notification at personal time; action = one CTA; reward = progress tick + occasional Celebrate; loop completable ≤3 taps from notification to outcome | Briefing, notifications, Cook finish | Funnel instrumented for the dinner loop | Multi-step ceremonies between cue and action |
| Streaks with kindness | Auto **streak freeze** 1/week; breaking a streak shows a warm restart, never red shame; streak UI small, not the hero | Habit pulse, streak chip | Freeze logic visible; zero red/negative streak states | Loss-aversion countdowns; guilt pushes |
| **Notification fatigue state** is honored in UI | In-app notification center shows a quiet "We've paused some nudges" state when fatigue controller suppresses (suppressed decisions exist per INE); per-category toggles one tap away | Notification center, settings | Fatigue state renders when active; toggles work; `notif_suppressed` reflected | Hiding suppression; opt-out buried |

## 22. Gamification UX

| Principle | Implementation Rule | Components Affected | Acceptance Criteria | Anti-Pattern |
|---|---|---|---|---|
| Mastery/Insight/Delight only (v3 §5.19) | Every engagement element maps to one of the three allowed reward types; mapping table maintained with EPIC 48 | Achievements, levels, missions | Mapping table complete; unmapped mechanic = blocked | Coins, loot, variable-ratio rewards |
| **No dark-pattern rewards** | No timers creating FOMO, no paid streak repair, no social pressure mechanics, exit from any loop ≤1 tap | All engagement UI | Anti-dark checklist (QA #21) passes | Limited-time chest UX; shame leaderboards |
| Achievements are quiet pride | Minimal line-style badges, saffron accent, grouped notifications, achievement center calm grid | Achievement center | Celebrate ≤1/session; grouping works | Badge confetti storms |

## 23. Premium Consumer Experience Standards

| Principle | Implementation Rule | Components Affected | Acceptance Criteria | Anti-Pattern |
|---|---|---|---|---|
| No raw edges | Budgets: mobile TTI <2.5s core screens, route transition <300ms, CLS <0.1, 60fps interactions on mid-tier device | App shell, all screens | Lighthouse mobile ≥90 on Home/Detail/Planner; budget checks in CI (W-D+) | Jank tolerated as "beta" |
| Offline grace (PWA, EPIC 45) | Saved recipes + active grocery list readable offline; offline banner pattern with reassurance | SW + list/detail | Airplane-mode e2e: view saved recipe + check items | Hard offline walls |
| Haptics & sound restraint | Haptic map: save/complete/celebrate only; sound opt-in only (Cook Mode timers) | Interaction layer | Haptic map documented; no default sounds | Buzzing every tap |

## 24. Accessibility and Inclusive Design

Binding with EPIC 33. Rules: WCAG 2.1 AA contrast (4.5:1 text, 3:1 large/UI) — *target, verified by axe + manual audit; legacy doc's AA claim is treated as unverified until tested*. Full keyboard operability for web surfaces; visible focus ring token `--g-focus-ring` (2px brand-600 outline + 2px offset) never removed; semantic landmarks per screen; `aria-live="polite"` for async results (rail refresh, AI streaming); form errors programmatically associated; touch targets ≥44px; text resizable to 200% without loss; icons never sole meaning-carriers (pair with label or aria-label); motion gated by `prefers-reduced-motion` (§8); color never the only signal (badges carry icon+text, §26). Acceptance: axe serious/critical = 0 on the 8 core screens; keyboard-only run of Home→Detail→Cook start recorded for QA #15.

## 25. RTL / LTR / Internationalization Rules

**RTL/LTR parity** is a release gate, not a nice-to-have (EPIC 32/41). Rules: all layout via CSS logical properties (`margin-inline-start`, `padding-inline-end`, `inset-inline`) — no left/right physical properties in new code; direction set at root from locale (`dir="rtl|ltr"`); directional icons flip via existing `DirectionalIcon` pattern (component present in repo — re-verify usage) — chevrons/back arrows mirror, food photos and brand glyph do **not** mirror; numerals: Latin digits in EN, locale-aware in FA where Content decides, but data inputs always store canonical; fonts per locale (§5) with `font-display: swap`; line-length max 68ch EN / comfortable FA measure; string expansion budget +35% (German-class) — components must not truncate critical actions; dates/units localized at the formatting layer only (data stays canonical); RTL screenshots required in every UI PR (QA #3/#4). Acceptance: 8 core screens audited in fa-RTL and en-LTR with zero mirrored-content bugs.

## 26. Nutrition and Safety UI Rules

**No medical claim UI** — ever (Constitution Part 2.3; E47 Annex). Rules: the **Source/Confidence badge** is mandatory wherever a nutrition number renders: three states — `verified` (green dot + "Source-verified", tap reveals source name), `estimate` (amber dot + "Estimate"), `unavailable` (neutral "Not available" — never a fake zero). Numeric nutrition renders **only** when `nutritionSourceStatus = source-locked` (EPIC 12); otherwise qualitative or hidden. Uncertainty copy is plain ("Estimated from similar ingredients"). Allergy-related UI: allergens user declared are highlighted in ingredient lists with a distinct (non-fear) marker; allergy edits live one tap from any recipe via profile sheet; AI surfaces repeat the dual-guard outcome kindly when blocked. Wellness language only (energy, balance, variety); banned-words list (cure/treat/diagnose/burns fat/detox…) enforced in copy review. Disclaimers: persistent, honest line on nutrition panels ("General information, not medical advice"), styled as calm caption, never hidden in settings. Acceptance: QA #11 + #22; zero numeric nutrition without badge in audit; banned-words lint on content files.

## 27. Explainability UI Rules

**Why / Explainability surface** is universal for recommendations (Constitution rule; EPIC 18/21). Pattern: every recommended item carries a subtle `Why` chip (ⓘ + "Why this?") opening a small sheet: 1–3 plain-language reasons derived from real contributions ("Quick (≤25 min) · You loved lemony dishes · Uses your saved chicken") + a "Not quite right?" correction row (dislike ingredient / wrong time / not my taste) feeding §20 events. Rules: reasons must come from the actual explanation payload (no decorative fake reasons); max 3 reasons, ranked; correction is one tap and acknowledged ("Got it — fewer like this"); AI Sheet answers that include a recommendation embed the same Why affordance; Briefing always shows one inline reason by default. Acceptance: 100% of rail/briefing/planner-AI items expose Why (QA #10); correction events verified; fake-reason audit = 0.

## 28. Component Experience Principles

Cross-cutting contracts every component must honor: 1) **States are part of the component** — default/hover/active/focus/disabled + empty/loading/error designed together; no state, no ship (Guide §17). 2) **Token-pure** — colors/space/radius/shadow/type/z only from tokens; size variants from the scale. 3) **Self-describing** — accessible name, role, state; testid contract for e2e. 4) **Bidirectional by construction** — logical properties; verified in both dirs. 5) **Motion via presets** with reduced-motion path. 6) **Density** — comfortable default, compact list variant only where specced. 7) **Composition over configuration** — slots (leading icon, meta, action) instead of boolean explosions. 8) **Event-emitting** — interaction events per Envelope wired at the component boundary, not ad-hoc in pages. 9) **Skeleton twin** — every async component ships its skeleton. 10) **Documentation stub** — props + dos/don'ts added to the design docs index on creation.

## 29. Design Anti-Patterns

Hard NOs (merge-blocking): raw hex/inline styles outside tokens · ad-hoc keyframes/transitions outside `motion.js` · center modal pickers · primary CTAs in the top third on mobile · spinner-first loading · dead-end empties/errors · unlabeled AI output · recommendations without Why · nutrition numbers without Source/Confidence badge · medical/diagnostic phrasing anywhere · **public-feed patterns** (infinite scroll feeds, social cards, follower counts) · public chat/DM affordances · leaderboards/cross-user comparison · FOMO timers, paid streak repair, variable-ratio rewards, confetti spam · hidden consent toggles, pre-checked boxes, nagging permission walls · fake AI certainty or fabricated "AI is thinking" theatrics · purple "AI brand" surfaces (superseded) · physical left/right CSS in new code · components shipped without empty/loading/error · screenshots-less UI PRs.

## 30. Relationship to Constitution and Epic 42

GES v1 operationalizes **EPIC 42** and is required by **Amendment A1.8** of `GARNISH_OS_MASTER_EXECUTION_CONSTITUTION_v1.0.1.md`. Authority chain: Constitution Part 1/2 decisions and Part 2.3 do-not-build list constrain everything here; v3 §5 is the design source this document freezes; the legacy `GARNISH_DESIGN_SYSTEM.md` is evidence only — adopted where compatible (saffron #EA6C0A ramp, Vazirmatn/Plus Jakarta Sans/Inter, Tabler icons, 4px spacing), superseded where not (AI purple ramp, 15px body default, bounce easing, legacy home IA, any pattern conflicting with Part 2.3). Companion artifacts (A1.8.1): `DESIGN_IMPLEMENTATION_GUIDE.md` (rules for the Coding Assistant), `DESIGN_QA_CHECKLIST.md` (merge gate), `COMPONENT_MIGRATION_MAP.md` (path from current UI), plus implementation drafts `tokens.css`, `base.css`, `garnish-theme.js`, `motion.js` (DRAFT status until approved). Ownership: UX/UI Designer decides (Part 10); Coding Assistant implements only from approved tickets (Part 11) and may never redefine this language. Delivery weeks: this doc = W3 [D]; tokens/base/theme + Guide = W4; motion + Checklist + Migration Map = W5; from the W5 gate, **no new UI task starts without referencing these docs**. Changes to GES itself require UX+Founder sign-off recorded in the Decision Log — never a silent PR.

## Appendix A — Golden Screen Composition Notes (External Audit Patch v1.0.1)

Layout authority for the five golden screens — the Coding Assistant may not invent structure beyond these notes; finer visual decisions remain with UX.

| Screen | Above-the-fold Structure | Primary Action | Secondary Action | AI Surface Allowed | Empty State | Error State | Mobile Reach Rule | Anti-Pattern |
|---|---|---|---|---|---|---|---|---|
| Home Command Center | Top: greeting + date (orientation only) → **Briefing card** (photo strip, one-line Why, CTA) → **Continue** row; Rail + Habit pulse below fold | Briefing **Accept** (in card footer, lower-third) | Swap / Not tonight (inline, same footer) | Whisper (capped 1/screen) + Briefing's inline Why; Sheet via card "adjust" | Pre-DNA: single invite card → start DNA (no fake content) | Briefing-unavailable card with retry; Rail degrades to saved items | All CTAs in card footers; nothing actionable above greeting | Feed-like vertical recs above fold; >1 saffron CTA visible |
| Recipe Detail | Hero photo (16:9, scrim title) → meta row (time·difficulty·servings) → **Action Shelf: Cook** | **Cook** (persistent bottom shelf) | Save · Add-to-plan (shelf secondary slots) | Sheet ("Adjust for me", anchored); Whisper for substitution | Image-missing → branded placeholder; nutrition-unavailable badge state | Section-level ErrorState with retry; never blank page | Shelf fixed bottom + safe-area; accordions open downward | Nutrition table above fold; top-bar Cook button; naked numbers |
| Food DNA Onboarding | Full-screen step card: progress dots top → one question (chips/swipe) → **Next** bottom | **Next/Continue** (bottom, ≥56px) | Skip (text, bottom-start) | None until final **DNA summary** card (template/guarded LLM) — no mid-flow AI | n/a (flow) — resume state after drop | Save-fail: inline retry, answers cached locally | One thumb completes 15/15 steps; no top inputs | % completion anxiety bar; free-text walls; allergy step without explicit confirm+privacy note |
| Cook Mode | Step counter dots → **step text ≤2 lines (≥22px)** → optional step photo → timer chip row | **Next step** (giant, bottom-end) | Back (bottom-start) · timer add | Sheet only ("help with this step"); no Whisper interrupts | n/a (entered with recipe) | Timer/wake failure → calm inline notice, steps continue | Controls ≥56px in bottom cluster; wake-lock on | Full recipe scroll; notifications overlay; tiny mid-screen arrows |
| Planner / Grocery | Planner: week columns header → today highlighted → slot cards; Grocery: progress bar → aisle groups | Planner: **Fill week with AI** (shelf, explicit-confirm) · Grocery: **Store mode** (shelf) | Add meal manually · share-list later (C1-gated) | Whisper per empty slot (capped); confidence badge on AI fills; Sheet per slot | Empty week → 3 starter-plan suggestions; empty list → "add from plan" | Slot/list save-fail inline with retry; offline list reassurance | Shelf actions bottom; drag handles thumb-zone | Auto-filled week w/o confirm; duplicate grocery rows; checkbox confirm dialogs |

— END OF GES v1 (+ Appendix A) —
