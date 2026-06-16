import { Box, Image, UnstyledButton } from '@mantine/core';
import { Link } from 'react-router-dom';
import { IconBell, IconMenu2 } from '@tabler/icons-react';

/**
 * TopBar — persistent app header.
 *
 * Three-slot grid so the wordmark stays optically centered regardless of the
 * side controls: hamburger at the inline-start (RIGHT in RTL) — the same side
 * the NavDrawer opens from — logo centered, bell at the inline-end (LEFT). The
 * hamburger calls `onMenuOpen`. Sticky, safe-area aware, token-pure chrome.
 */
const iconButton = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minBlockSize: 44,
  minInlineSize: 44,
  color: 'var(--g-color-text-primary)',
  background: 'transparent',
};

export default function TopBar({ onMenuOpen }) {
  return (
    <Box
      component="header"
      className="g-safe-top"
      style={{
        position: 'sticky',
        insetBlockStart: 0,
        zIndex: 'var(--g-z-sticky)',
        background: 'var(--g-color-bg-surface)',
        borderBlockEnd: '1px solid var(--g-color-border-subtle)',
      }}
    >
      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: '44px 1fr 44px',
          alignItems: 'center',
          minBlockSize: 56,
          paddingInline: 'var(--g-space-3)',
          paddingBlock: 'var(--g-space-2)',
        }}
      >
        {/* inline-start (RIGHT in RTL) — open the navigation drawer (drawer opens from the right) */}
        <UnstyledButton type="button" onClick={onMenuOpen} aria-label="باز کردن منو" style={iconButton}>
          <IconMenu2 size={24} stroke={1.8} aria-hidden="true" />
        </UnstyledButton>

        {/* center — wordmark → home */}
        <Box style={{ display: 'flex', justifyContent: 'center', minInlineSize: 0 }}>
          <UnstyledButton component={Link} to="/" aria-label="گارنیش — خانه" style={{ display: 'inline-flex' }}>
            <Image src="/logo-garnish.png" alt="گارنیش" h={32} w="auto" fit="contain" />
          </UnstyledButton>
        </Box>

        {/* inline-end (LEFT in RTL) — notifications */}
        <UnstyledButton component={Link} to="/notifications" aria-label="اعلان‌ها" style={iconButton}>
          <IconBell size={22} stroke={1.8} aria-hidden="true" />
        </UnstyledButton>
      </Box>
    </Box>
  );
}
