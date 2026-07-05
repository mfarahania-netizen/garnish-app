# Homepage Navigation Audit

## Current Bottom Navigation
Source: `apps/web/src/shell/navConfig.js`

Current tabs:
1. خانه `/`
2. برنامه `/plan`
3. کشف `/discover`
4. علاقه‌مندی‌ها `/favorites`
5. پروفایل `/profile`

## Diagnosis
[احتمالاً] bottom nav is mostly understandable, but it does not fully match the strongest user jobs. In a food operating system, “shopping list” is often more action-critical than “favorites”. Favorites matters after discovery, but shopping matters during real weekly use.

## Bottom Nav Findings

| Issue | Severity | Evidence | Recommendation |
|---|---|---|---|
| Shopping list hidden in drawer | P1 | `DRAWER_PRIMARY` includes `/shopping-list`; bottom nav does not | For launch, consider replacing Favorites with Shopping if shopping list is core loop |
| AI hidden in drawer | P2 | assistant only in drawer | Keep out of primary nav for now unless AI is the product’s main differentiator |
| Profile primary tab may be overvalued | P2 | `/profile` in bottom nav and drawer | If home already shows Food DNA/profile, profile can move to drawer later |
| Drawer duplicates primary routes | P3 | profile/plan duplicated | acceptable; simplify later |
| Bell always top-level but no badge | P2 | `TopBar.jsx` bell link only | add unread badge or demote if low signal |
| Hamburger only on tab routes | P2 | `TopBar.jsx` `isTab` logic | good for pushed screens, but discoverability depends on users recognizing hamburger |

## Recommended Launch Bottom Nav
Option 1, if shopping list is core:
1. خانه
2. کشف
3. برنامه
4. خرید
5. پروفایل

Option 2, if saved recipes are more important for launch:
1. خانه
2. کشف
3. برنامه
4. ذخیره‌ها
5. پروفایل

Advisor recommendation:
[احتمالاً] choose Option 1 if the app pitch is “food OS”. Shopping list makes the OS loop tangible. Favorites can live in drawer and appear contextually on recipe cards.

## Later Bottom Nav After Backend Matures
1. خانه
2. کشف
3. برنامه
4. خرید
5. دستیار

Profile/settings move to drawer; AI becomes primary only after measured assistant retention and cost safety.

## Hamburger / Side Menu

Should it exist?
[قطعی] yes, but as secondary sitemap/settings, not as a dumping ground.

Should live inside:
- Profile
- Food DNA
- Recipes archive
- Favorites if not in bottom nav
- Shopping if not in bottom nav
- Assistant if not in bottom nav
- Settings
- Notifications
- Support
- Admin only for admins

Should not be hidden there if core:
- Search/discover
- Current plan if meal planning is core
- Shopping list if “OS loop” is core

## Header / Top Bar
- Logo centered is clean.
- Back/hamburger switching is sensible.
- Bell needs unread state.
- TopBar consumes vertical space on home; acceptable, but home should avoid repeating too many hero elements below it.

