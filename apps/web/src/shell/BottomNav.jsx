import { Box, Text } from '@mantine/core';
import { NavLink as RouterNavLink } from 'react-router-dom';
import { BOTTOM_TABS } from './navConfig';

/**
 * BottomNav — global wayfinding, 5 tabs in RTL order. Each tab is a real
 * react-router link; the active route reads as saffron and is reinforced by
 * non-color cues (bolder weight, a heavier icon, and a saffron indicator bar)
 * so it never relies on colour alone.
 *
 * Contrast: the active LABEL uses brand-700 (#C2570A, 4.5:1 AA on the white
 * surface) while the active ICON keeps the vivid brand-600 saffron (an icon is
 * a graphical object). Inactive label + icon use text-secondary (7.63:1 AA) —
 * not the lighter text-muted, which fell below AA at 12px. Sticky to the bottom
 * of the shell column, safe-area aware, ≥44px targets, token-pure chrome.
 */
export default function BottomNav() {
  return (
    <Box
      component="nav"
      aria-label="ناوبری اصلی"
      className="g-safe-bottom"
      style={{
        position: 'sticky',
        insetBlockEnd: 0,
        zIndex: 'var(--g-z-shelf)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'stretch',
        gap: 'var(--g-space-1)',
        paddingBlockStart: 'var(--g-space-2)',
        paddingInline: 'var(--g-space-2)',
        background: 'var(--g-color-bg-surface)',
        borderBlockStart: '1px solid var(--g-color-border-subtle)',
        boxShadow: 'var(--g-shadow-2)',
      }}
    >
      {BOTTOM_TABS.map((tab) => (
        <RouterNavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          style={({ isActive }) => ({
            position: 'relative',
            flex: 1,
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            minBlockSize: 44,
            paddingBlock: 'var(--g-space-1)',
            textDecoration: 'none',
            color: isActive ? 'var(--g-color-brand-700)' : 'var(--g-color-text-secondary)',
          })}
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <Box
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    insetBlockStart: 0,
                    insetInline: '32%',
                    blockSize: 3,
                    borderRadius: 'var(--g-radius-chip)',
                    background: 'var(--g-color-brand-600)',
                  }}
                />
              )}
              <tab.Icon
                size={24}
                stroke={isActive ? 2.2 : 1.7}
                aria-hidden="true"
                color={isActive ? 'var(--g-color-brand-600)' : 'var(--g-color-text-secondary)'}
              />
              <Text
                component="span"
                style={{
                  fontFamily: 'var(--g-font-fa)',
                  fontSize: 'var(--g-font-size-12)',
                  fontWeight: isActive ? 700 : 500,
                  color: 'inherit',
                  lineHeight: 1.2,
                }}
              >
                {tab.label}
              </Text>
            </>
          )}
        </RouterNavLink>
      ))}
    </Box>
  );
}
