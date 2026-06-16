import { Box, Text, UnstyledButton } from '@mantine/core';
import { motion } from 'framer-motion';
import { pressResponse } from '../../lib/motion';

/**
 * BottomNav (PL row 3) — global wayfinding tabs.
 *
 * Data-driven: the caller passes the tab list. The active tab uses a saffron
 * tint + bolder label + filled-icon slot; labels are ALWAYS visible (never
 * icon-only). Badge counts cap at 9 ("9+"). 44px targets, role=tablist.
 *
 * Kit guidance is ≤4 primary tabs (use the Action Shelf for actions, not the
 * nav). This component renders whatever list it is given so the app can adopt it
 * incrementally; keep the list short and put actions in the Shelf.
 *
 * `hidden` collapses the bar (immersive / Cook Mode). Token chrome, safe-area
 * aware, sits at --g-z-shelf. Motion: pressResponse. RTL-safe (logical flow).
 *
 * Pure presentational. Behavior via onChange. Token-pure.
 *
 * Props:
 *  - items: [{ value, label, icon, badge? }]
 *  - value: the active tab's `value`
 *  - onChange(value): tab change callback
 *  - hidden: boolean — hide in immersive modes
 *  - label: accessible name for the tablist
 */
export function BottomNav({ items = [], value, onChange, hidden = false, label = 'Main' }) {
  if (hidden) return null;

  return (
    <Box
      role="tablist"
      aria-label={label}
      className="g-safe-bottom"
      style={{
        position: 'fixed',
        insetInline: 0,
        insetBlockEnd: 0,
        zIndex: 'var(--g-z-shelf)',
        display: 'flex',
        justifyContent: 'space-around',
        gap: 'var(--g-space-1)',
        paddingBlockStart: 'var(--g-space-2)',
        paddingInline: 'var(--g-space-2)',
        background: 'var(--g-color-bg-surface)',
        borderBlockStart: '1px solid var(--g-color-border-subtle)',
        boxShadow: 'var(--g-shadow-2)',
      }}
    >
      {items.map((item) => {
        const active = item.value === value;
        const badge = item.badge != null && item.badge > 0;
        return (
          <UnstyledButton
            key={item.value}
            component={motion.button}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={item.label}
            onClick={() => onChange?.(item.value)}
            whileTap={pressResponse.whileTap}
            style={{
              position: 'relative',
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              flex: 1,
              minHeight: 44,
              paddingBlock: 'var(--g-space-1)',
              background: 'transparent',
              color: active ? 'var(--g-color-brand-600)' : 'var(--g-color-text-muted)',
            }}
          >
            <Box style={{ position: 'relative', display: 'inline-flex' }}>
              {item.icon}
              {badge && (
                <Box
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    insetBlockStart: -4,
                    insetInlineEnd: -8,
                    minInlineSize: 16,
                    blockSize: 16,
                    paddingInline: 4,
                    borderRadius: 'var(--g-radius-chip)',
                    background: 'var(--g-color-state-danger-fg)',
                    color: 'var(--g-color-text-inverse)',
                    fontSize: 'var(--g-font-size-12)',
                    fontWeight: 700,
                    lineHeight: '16px',
                    textAlign: 'center',
                  }}
                >
                  {item.badge > 9 ? '9+' : item.badge}
                </Box>
              )}
            </Box>
            <Text
              component="span"
              style={{
                fontFamily: 'var(--g-font-text)',
                fontSize: 'var(--g-font-size-12)',
                fontWeight: active ? 700 : 500,
                color: 'inherit',
                lineHeight: 1.2,
              }}
            >
              {item.label}
            </Text>
          </UnstyledButton>
        );
      })}
    </Box>
  );
}

export default BottomNav;
