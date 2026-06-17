/**
 * Shared bottom-sheet sizing for Mantine Drawers/Modals that portal to <body>.
 *
 * Without a cap, a `position="bottom"` Drawer spans the full viewport WIDTH on desktop — an ugly
 * full-width strip. `bottomSheetStyles` caps the sheet to the app column (≤480px) and centers it
 * horizontally, so on desktop it renders as a proper centered mobile bottom-sheet; on mobile (<480px)
 * it stays full-width. Per-sheet `content`/`header`/`body` styles are merged, but the width cap always
 * wins. Apply to every bottom sheet so future ones inherit the constraint.
 *
 * (Side drawers — e.g. the hamburger NavDrawer at `position="left"` size 306 — are already narrower than
 * the cap and are edge-anchored by design, so they intentionally do NOT use this helper.)
 */
export const SHEET_MAX_INLINE = 480;

export function bottomSheetStyles({ content, header, body, inner } = {}) {
  return {
    inner: { justifyContent: 'center', ...inner },
    // width cap is appended LAST so it always overrides any per-sheet width
    content: { ...content, inlineSize: '100%', maxInlineSize: SHEET_MAX_INLINE, marginInline: 'auto' },
    ...(header ? { header } : {}),
    ...(body ? { body } : {}),
  };
}
