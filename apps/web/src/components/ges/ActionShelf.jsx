import { Box, Group } from '@mantine/core';

/**
 * ActionShelf (PL row 2) — bottom-anchored home of primary actions.
 *
 * Chrome: fixed bottom bar · surface-raised · shadow-2 · safe-area padding
 * (.g-safe-bottom) · sits at --g-z-shelf.
 * Capacity: exactly 1 primary action + up to 2 secondary slots (≤3 total).
 * Layout: secondary slots take the inline-start side, primary anchors inline-end
 * and stretches; order follows `dir` automatically (logical, RTL-safe).
 * Semantics: landmark role=toolbar; focus order naturally follows page content.
 *
 * Pure presentational: it only arranges the action nodes the caller passes
 * (e.g. <Button>); it never owns the actions' behavior. No business logic.
 *
 * Props:
 *   primary   — required primary action node (the single saffron CTA)
 *   secondary — array of up to 2 secondary action nodes (extras are dropped)
 *   label     — accessible name for the toolbar landmark
 */
export function ActionShelf({
  primary = null,
  secondary = [],
  label = 'Actions',
}) {
  // Enforce the ≤2 secondary contract defensively.
  const secondaryItems = Array.isArray(secondary)
    ? secondary.filter(Boolean).slice(0, 2)
    : [];

  return (
    <Box
      component="div"
      role="toolbar"
      aria-label={label}
      aria-orientation="horizontal"
      className="g-safe-bottom"
      style={{
        position: 'fixed',
        insetInline: 0,
        insetBlockEnd: 0,
        zIndex: 'var(--g-z-shelf)',
        background: 'var(--g-color-bg-surface-raised)',
        boxShadow: 'var(--g-shadow-2)',
        borderBlockStart: '1px solid var(--g-color-border-subtle)',
        paddingBlockStart: 'var(--g-space-3)',
        paddingInline: 'var(--g-space-4)',
      }}
    >
      <Group
        wrap="nowrap"
        style={{
          gap: 'var(--g-space-3)',
          alignItems: 'stretch',
          inlineSize: '100%',
        }}
      >
        {secondaryItems.map((item, index) => (
          <Box
            // Slots are positional and stable for this presentational bar.
            key={`secondary-slot-${index}`}
            style={{ flex: '0 0 auto', display: 'flex', alignItems: 'stretch' }}
          >
            {item}
          </Box>
        ))}

        {/* Primary anchors at the inline-end and fills remaining width. */}
        {primary && (
          <Box
            style={{
              flex: '1 1 auto',
              minInlineSize: 0,
              display: 'flex',
              alignItems: 'stretch',
              justifyContent: 'flex-end',
            }}
          >
            {primary}
          </Box>
        )}
      </Group>
    </Box>
  );
}

export default ActionShelf;
