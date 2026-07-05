# Homepage Accessibility Audit

| Issue | Severity | File/component | Fix recommendation |
|---|---|---|---|
| SearchField is button styled as input | P1 | `SearchField.jsx` | Use role/copy that makes it clear it opens search, or implement actual input |
| Recipe card title/body not fully tappable | P2 | `RecipeCard.jsx` | Make whole card a button/link with nested action controls handled safely |
| Horizontal rails lack explicit carousel controls | P2 | `RecipeRail.jsx`, home chip rows | Add “scrollable list” semantics or ensure keyboard scroll/focus path |
| Icon-only save/dismiss buttons rely on aria but no visible hint | P2 | `RecipeCard.jsx` | Keep aria; consider visible labels for primary recommendation only |
| Notification bell has no unread state | P2 | `TopBar.jsx` | Add accessible badge with `aria-label` count |
| Long Persian bottom-nav label may wrap/crowd | P2 | `BottomNav.jsx`, `navConfig.js` | Test at 360px; shorten “علاقه‌مندی‌ها” to “ذخیره‌ها” |
| Drawer close and nav are accessible through Mantine | Good | `NavDrawer.jsx` | Keep Mantine Drawer focus trap |
| Tap targets mostly >=44px | Good | TopBar, BottomNav, chips, cards | Maintain 44px minimum |
| Reduced motion is respected at provider/page level | Good | `App.jsx`, `HomePage MotionConfig` | Keep; avoid excessive animation |
| Placeholder image has role img with label | P2 | `PlatePlaceholder.jsx` | For decorative card media, consider `aria-hidden` if title already names recipe to avoid duplicate reading |
| Empty state action mismatch | P2 | `HomePage` empty branch | Copy says taste recognition; route should match action |

## Accessibility Verdict
[احتمالاً] no obvious P0 accessibility blocker in home shell, but the search affordance and card click semantics are major UX/accessibility issues before a serious pilot.

