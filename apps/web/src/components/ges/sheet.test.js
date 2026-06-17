import { bottomSheetStyles, SHEET_MAX_INLINE } from './sheet';

// FE-PLAN-AND-MODALS FIX 5: every bottom Drawer/Modal must be capped to the app column (≤480px) and
// centered, so on desktop it renders as a centered mobile sheet — not a full-width strip.
describe('bottomSheetStyles — caps + centers bottom sheets to ≤480px', () => {
  it('caps content to 480px, centers it, and stretches to 100% under the cap', () => {
    expect(SHEET_MAX_INLINE).toBe(480);
    const s = bottomSheetStyles({ content: { height: 'auto', background: 'x' } });
    expect(s.content.maxInlineSize).toBe(480);
    expect(s.content.marginInline).toBe('auto');
    expect(s.content.inlineSize).toBe('100%');
    expect(s.inner.justifyContent).toBe('center');
    // per-sheet content styles are preserved (radius/background/height etc.)
    expect(s.content.height).toBe('auto');
    expect(s.content.background).toBe('x');
  });

  it('the width cap ALWAYS wins, even if a sheet passes its own width', () => {
    const s = bottomSheetStyles({ content: { maxInlineSize: 9999, marginInline: 0 } });
    expect(s.content.maxInlineSize).toBe(480);
    expect(s.content.marginInline).toBe('auto');
  });

  it('passes header/body through and tolerates being called with no args', () => {
    const s = bottomSheetStyles({ header: { background: 'h' }, body: { padding: 2 } });
    expect(s.header.background).toBe('h');
    expect(s.body.padding).toBe(2);
    expect(() => bottomSheetStyles()).not.toThrow();
    expect(bottomSheetStyles().content.maxInlineSize).toBe(480);
  });
});
