import { Box, Image, UnstyledButton } from '@mantine/core';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { IconBell, IconMenu2, IconChevronRight } from '@tabler/icons-react';

/**
 * TopBar — persistent app header.
 *
 * Three-slot grid so the wordmark stays optically centered regardless of the
 * side controls: at the inline-start (RIGHT in RTL) a BACK chevron on pushed
 * routes (so no pushed screen is a dead-end) or the hamburger on the 5 top-level
 * bottom-nav tabs (the drawer opens from that same side); logo centered; bell at
 * the inline-end (LEFT). Sticky, safe-area aware, token-pure chrome.
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

// The bottom-nav tabs — these show the hamburger (drawer access), not a back control.
const TAB_PATHS = new Set(['/', '/plan', '/discover', '/favorites', '/profile']);

export default function TopBar({ onMenuOpen }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isTab = TAB_PATHS.has(pathname);
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
        {/* inline-start (RIGHT in RTL) — back on pushed routes, hamburger (drawer) on the tabs */}
        {isTab ? (
          <UnstyledButton type="button" onClick={onMenuOpen} aria-label="باز کردن منو" style={iconButton}>
            <IconMenu2 size={24} stroke={1.8} aria-hidden="true" />
          </UnstyledButton>
        ) : (
          <UnstyledButton type="button" onClick={() => navigate(-1)} aria-label="بازگشت" style={iconButton}>
            <IconChevronRight size={24} stroke={1.8} aria-hidden="true" />
          </UnstyledButton>
        )}

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
