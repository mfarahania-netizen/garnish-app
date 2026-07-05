# Homepage Final Ranked Recommendations

## P0 — Must Fix Before Launch
No hard P0 blocker found that prevents homepage from functioning.

## P1 — Should Fix Before Serious Pilot

| Title | Problem | User Impact | Area | Files likely involved | Backend dependency | Risk | Acceptance Criteria |
|---|---|---|---|---|---|---|---|
| Make home search honest | search looks like input but routes away | confusion/friction | frontend | `SearchField.jsx`, `home/page.jsx`, `discover/page.jsx` | none or small | low | user can type directly or copy clearly says it opens search |
| Remove fake/dead homepage surfaces | occasion card and resume are not real | trust damage | frontend | `home/page.jsx`, `useHomeData.js` | none | low | no “به‌زودی” card; resume hidden until real data |
| Clarify pantry rail | “based on kitchen” not proven pantry-backed | fake personalization | frontend/backend | `useHomeData.js`, rec pipeline | maybe | medium | title matches actual data source |
| Redesign section order | primary action diluted | lower clicks | frontend | `home/page.jsx` | none | low | search + hero recommendation visible first viewport |
| Make cards fully tappable | card title/meta not obvious click | missed opens | frontend | `RecipeCard.jsx` | none | medium | tapping title/body opens recipe; save/dismiss unaffected |
| Add real plan/shopping preview or keep out | OS promise not visible | app feels recipe-list | frontend + small backend | `home/page.jsx`, plan/shopping hooks | maybe | medium | home shows today plan/list count only when real |

## P2 — Improve After Launch
- Add notification unread badge.
- Reduce rails to max two.
- Rename `Fresh` rail or remove.
- Add one visible recommendation reason to hero card.
- Shorten bottom-nav labels.
- Add lightweight card endpoint.
- Add home summary endpoint.

## P3 — Later Product Expansion
- AI as primary bottom-nav tab.
- Pantry-aware home after pantry adoption.
- Persistent continue cooking.
- Social/community.
- Media/photo pipeline.
- Advanced recsys activation.

## Do Not Build Yet
- Social feed.
- Medical health personalization.
- Autonomous shopping execution.
- AI “does everything for you” homepage.
- Public recommendation lab/debug UI.

## Remove / Hide For Now
- Occasion teaser card.
- Resume card until data exists.
- “Fresh” rail if it competes with relevance.
- Any “AI picked this perfectly for you” wording.

## Can Implement Immediately
- Reorder sections.
- Search affordance fix.
- Card variant split.
- Remove dead teaser.
- Rename rail labels.
- Limit rails.
- Improve visible CTA copy.

## Needs Backend Support
- Home summary endpoint.
- Lightweight recipe card endpoint.
- Continue cooking persistence.
- True pantry-based recommendations.
- Unread notifications count.
- Recency-window “popular now”.

