# Homepage Recipe Card Audit

## Current Card Problem Table

| Current Card Problem | Impact | Better Pattern | Data Needed | Implementation Cost |
|---|---|---|---|---|
| Media is always placeholder | food app feels less appetizing | compact cards can use smaller visual or real image when available | imageUrl/media pipeline | product/backend/media |
| Full-card tap affordance weak | user may tap title/meta and nothing happens | entire card as primary button, save/dismiss as nested actions | none | frontend-only |
| Same card used for hero, rail, search with minor compact flag | hierarchy becomes flat | define hero/compact/task variants | same data | frontend-only |
| Recommendation reason hidden behind WhyChip | personalization value is less obvious | show one short reason on hero only | `matchedSignals` already exists | frontend-only |
| Dismiss X visually ambiguous | may look like close/delete rather than learning signal | add visible “علاقه ندارم” on full recommendation or clearer affordance | none | frontend-only |
| Metadata line is useful but low contrast | time/difficulty may be missed | stronger amount/time chips on hero | existing fields | frontend-only |
| Compact rail cards are 188px wide | decent but cramped for long Persian titles | 164-176px with 2-line title or row-list for some rails | existing fields | frontend-only |
| No “start cooking” quick action | card only opens detail | hero card can have primary CTA: “شروع پخت” | recipeId | frontend-only |
| No cuisine/category reason | users cannot browse mentally | show one category/cuisine chip if known | categories/region already available in recipe payload | small mapping |
| No image failure distinction | placeholder hides missing media debt | internal audit should track no-image rate | media fields | reporting/backend |

## Proposed Card Variants

### 1. Hero Recommendation Card
- Use for one top suggestion only.
- Full-width, stronger title, one reason, time/difficulty, primary CTA.
- Actions:
  - `دیدن دستور`
  - `ذخیره`
  - quiet `علاقه ندارم`
- Data source:
  - `GET /recommendations`
  - enrich from `/recipes` or better backend includes card metadata directly.
- Acceptance:
  - one tap opens recipe.
  - reason is real from matched signals.
  - no medical wording.

### 2. Compact Recipe Card
- Use for rails and saved suggestions.
- Smaller media, title, time.
- Save icon only if favorites available.
- No WhyChip unless recommendation context exists.
- Better for:
  - “محبوب‌ها”
  - “زیر ۳۰ دقیقه”
  - “ایرانی‌های محبوب”

### 3. Continue / Active Task Card
- Use only after real persisted state exists.
- Shows:
  - recipe title
  - current step
  - progress
  - CTA: `ادامه پخت`
- Data dependency:
  - cook-mode state persistence; currently absent (`resume: null`).
- Do not fake.

### 4. Category Card
- Keep only if category maps to reliable query.
- Avoid too many icon tiles.
- Better as “quick action chips” unless category has strong identity.

## Specific Recommendation
[قطعی] next sprint should first make the hero recommendation card and compact card visually distinct. Right now every recipe surface feels too similar, so the user cannot tell what is important.

