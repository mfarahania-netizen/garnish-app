# Homepage AI Entry Audit

## Reality Check
[قطعی] AI باید روی homepage کمک‌کننده باشد، نه ادعای خودکار/پزشکی/همه‌چیزدان. backend فعلی chat، opener و چند ابزار محدود دارد، اما autonomous meal/shopping execution ندارد.

## Current AI Surfaces
- `AIWhisper` on home: one recommendation-like card, accepts by opening recipe.
- `/assistant`: full assistant with chat, conversation history, starters, opener.
- Backend:
  - `GET /ai/opener`
  - `POST /ai/chat`
  - `POST /ai/substitutions`
  - `POST /ai/pantry-match`
  - `GET /ai/recipes/:id/technique`
  - `POST /ai/pairings`

## Should AI Be Top Bar, Hero, Floating, Bottom Nav, Or Card?
[احتمالاً] for launch: card/chip, not bottom nav and not floating button.

Reason:
- AI has rate/cost/runtime limits.
- It can help, but core food browsing must work without it.
- A floating AI button can distract from recipe choice.

## Safe Homepage AI Actions Now
- “نمی‌دونی چی بپزی؟”
- “شام سریع پیشنهاد بده”
- “با مواد خونه ایده بده”
- “جایگزین امن برای مواد”
- “در مورد این دستور بپرس” from recipe detail, not generic home.

## What AI Should Not Say
- “رژیم درمانی می‌چینم”
- “برای کاهش وزن/دیابت/فشار خون بهترین برنامه”
- “خودکار خریدت را انجام می‌دهم”
- “من دقیقاً می‌دانم بدنت چه می‌خواهد”
- “بدون خطا”

## Recommended Home AI Copy
- Primary small chip: `از دستیار بپرس`
- Starter card copy: `نمی‌دونی چی بپزی؟ چند ایدهٔ امن و ساده می‌دم.`
- Disclaimer if prominent: `برای ایده و کمک آشپزی؛ نه توصیهٔ پزشکی.`

## Implementation Recommendation
P1:
- Replace current AI whisper accept label if it opens recipe. Use `دیدن دستور`.
- Add a small “از دستیار بپرس” quick action near search.
- Do not make AI a primary bottom-nav tab until usage and cost are proven.

