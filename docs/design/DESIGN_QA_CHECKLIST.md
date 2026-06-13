# DESIGN QA CHECKLIST — Garnish OS

**Use:** copy this file's tables into every UI PR description, fill Pass/Fail + evidence. **Authority:** Constitution A1.8.4; GES v1; Implementation Guide; `COMPONENT_PATTERN_LIBRARY_v1.md` (component contracts — verify the touched component matches its row; for **AI Sheet, Recipe Card, Cook Step, Meal Slot Card, Nutrition Badge** also review against Pattern Library **Appendix A — Critical Component Deep Dives**, including its Reviewer-rejection criteria). **Gate:** no UI merge without a completed checklist + UX/UI Designer approval (Part 10). From the W5 gate, no new UI task may even start without referencing the design docs.

## Required Before Any UI Merge

| # | Check | Pass/Fail | Evidence Required | Notes |
|--:|-------|-----------|-------------------|-------|
| 1 | Uses tokens only | | grep/lint output clean | colors/space/radius/shadow/type/z |
| 2 | No hardcoded hex | | hex-lint CI green | tokens.css is the only exception |
| 3 | RTL works | | fa-RTL screenshots | logical properties; mirrored icons correct |
| 4 | LTR works | | en-LTR screenshots | parity with RTL |
| 5 | Mobile reachability works | | reach-map note / device video | primaries in lower third (Action Shelf) |
| 6 | Loading state exists | | skeleton screenshot | skeleton twin, not spinner-first |
| 7 | Empty state exists | | empty screenshot | from shared State library |
| 8 | Error state exists | | error screenshot | trust-preserving copy + retry |
| 9 | AI disclosure exists if AI is used | | header screenshot | glyph + "AI" label (Whisper/Sheet/Companion) |
| 10 | Explainability exists if recommendation is used | | Why chip + sheet screenshot | real payload reasons, max 3 |
| 11 | Nutrition confidence/source badge exists if nutrition appears | | badge screenshot | verified/estimate/unavailable; no naked numbers |
| 12 | Motion uses `lib/motion.js` | | import audit / lint | no inline transitions/keyframes — sole exception: approved `g-shimmer` skeleton keyframe in base.css (Guide §24) |
| 13 | Reduced motion supported | | OS-toggle video/gif | opacity-only fallback |
| 14 | Accessibility checked | | axe report | serious/critical = 0 |
| 15 | Keyboard navigation works | | recorded tab-through | web surfaces |
| 16 | Focus state visible | | focus screenshots | `--g-focus-ring`, never removed |
| 17 | Color contrast passes | | contrast tool output | AA: 4.5:1 text / 3:1 UI |
| 18 | Screenshot before/after attached | | both themes × both directions | 4 images minimum |
| 19 | No public-feed pattern introduced | | reviewer attestation | no infinite feed/social cards |
| 20 | No public chat/DM pattern introduced | | reviewer attestation | Companion ≠ social chat |
| 21 | No dark-pattern reward introduced | | reviewer attestation | no FOMO timers/variable rewards/shame |
| 22 | No medical claim UI introduced | | copy review note | banned-words list clean |
| 23 | Consent-sensitive surfaces are clear | | screenshot | no pre-checks, no hidden toggles |
| 24 | Error copy is trust-preserving | | copy review note | what happened + what's safe + retry |
| 25 | Empty state has useful next action | | screenshot | every empty offers one action |

## Page-Specific QA

| Surface | Required States | Required Checks | Evidence |
|---|---|---|---|
| Home / Command Center | first-run empty (pre-DNA) · loading skeleton (Briefing+Rail) · Briefing-unavailable · offline | exactly 4 blocks, no feed; Briefing has inline Why; insight card editable/correctable; habit pulse self-comparison only | fold screenshot; events `briefing_view/accept/reject` in console |
| Recipe Detail | loading hero+sections · image-missing placeholder · nutrition unavailable · error | ≤3 decisions above fold; Cook CTA in shelf; accordion depth; NutritionBadge on every number; AllergenMark on declared allergens; AI Sheet "Adjust for me" anchored | fold + accordion + badge screenshots |
| Recipe Card | skeleton twin · image placeholder · saved/dismissed feedback | 4:3 ratio; scrim contrast ≥4.5:1; swipe save/dismiss with undo; Why chip present in rail context | card grid screenshot RTL+LTR |
| AI Chat (Companion) | empty (starter prompts) · streaming · guard-refusal · error/retry · offline | disclosure header; 👍/👎 per answer; nutrition badge on numbers; no fake-memory claims; TTFT note | streaming capture; refusal screenshot |
| Food DNA Onboarding | per-step skip states · resume-after-drop · DNA-summary fallback (template if LLM off) · saving | ≤15s per step; dots progress (no % anxiety); taste-swipe haptic; allergy step privacy note + explicit confirm; summary lines tap-to-edit | step flow video; edit event log |
| Meal Planner | empty week · loading board · autofill-pending · slot error | drag smoothness on 2 devices; Plan-with-AI explicit confirm before write; Why + confidence badge on AI slots; undo on clear | board screenshots; confirm-flow video |
| Shopping List | empty · merged-list loading · store-mode · offline | merge chip expands to sources; zero duplicate rows; aisle sort; check undo 5s; "have it" secondary | store-mode video; merge screenshot |
| Cook Mode | step view · timer running ×2 · interruption/return · finish/celebrate · abandon | wake-lock active; ≥56px controls; timers persist across steps; Celebrate ≤1/session; reduced-motion static check; outcome 3-option + skip | timer video; finish capture |
| Notifications (in-app center) | empty · list · fatigue-paused state · per-category toggles | suppressed/“paused nudges” state renders; one-tap category opt-out; no nag re-prompts | center screenshots incl. paused state |
| Profile / Preferences | loading · saved-confirm · consent states (on/off) · export/delete pending | Preference Memory edits apply immediately (event check); privacy states explicit; no hidden toggles | memory edit video; consent screenshots |
| Admin / Intelligence Dashboard | loading · empty datasets · error | token-pure even if internal; no user PII beyond role-gated need; charts readable both themes | dashboard screenshots |

— END OF QA CHECKLIST —
