import { Box, Drawer, Image, Text } from '@mantine/core';
import { NavLink as RouterNavLink } from 'react-router-dom';
import { DRAWER_ITEMS } from './navConfig';

/**
 * NavDrawer — the working hamburger drawer (the #1 thing that was missing).
 *
 * Built on Mantine's Drawer for correct, accessible behaviour out of the box:
 * focus trap, ESC to close, overlay-click to close, scroll lock, ARIA. Under
 * dir="rtl", Mantine maps position="left" to the inline-start (right) edge —
 * the conventional side for an RTL navigation menu — and slides it in from the
 * right. Each item is a real react-router link, so tapping it both routes and
 * closes the drawer; the active destination reads as saffron (brand-700 label +
 * brand-600 icon + a saffron inline-start accent bar), AA-legible. Token-pure;
 * motion respects the OS reduced-motion setting (theme respectReducedMotion).
 */
function DrawerLink({ item, onNavigate }) {
  return (
    <RouterNavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--g-space-3)',
        minBlockSize: 44,
        paddingInline: 'var(--g-space-3)',
        paddingBlock: 'var(--g-space-3)',
        borderRadius: 'var(--g-radius-input)',
        borderInlineStart: isActive ? '3px solid var(--g-color-brand-600)' : '3px solid transparent',
        textDecoration: 'none',
        color: isActive ? 'var(--g-color-brand-700)' : 'var(--g-color-text-primary)',
        fontWeight: isActive ? 700 : 500,
      })}
    >
      {({ isActive }) => (
        <>
          <item.Icon
            size={20}
            stroke={1.8}
            aria-hidden="true"
            color={isActive ? 'var(--g-color-brand-600)' : 'var(--g-color-text-secondary)'}
          />
          <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', color: 'inherit' }}>
            {item.label}
          </Text>
        </>
      )}
    </RouterNavLink>
  );
}

export default function NavDrawer({ opened, onClose }) {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="left"
      size={300}
      zIndex={400}
      withCloseButton
      closeButtonProps={{ 'aria-label': 'بستن منو', size: 'lg' }}
      title={<Image src="/logo-garnish.png" alt="گارنیش" h={28} w="auto" fit="contain" />}
      overlayProps={{ backgroundOpacity: 0.5, blur: 2 }}
      transitionProps={{ duration: 240 }}
      styles={{
        content: { background: 'var(--g-color-bg-surface)' },
        header: {
          background: 'var(--g-color-bg-surface)',
          borderBlockEnd: '1px solid var(--g-color-border-subtle)',
          minBlockSize: 56,
        },
        body: { paddingInline: 'var(--g-space-3)', paddingBlock: 'var(--g-space-3)' },
      }}
    >
      <Box component="nav" aria-label="منوی اصلی" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-1)' }}>
        {DRAWER_ITEMS.map((item) => (
          <DrawerLink key={item.to} item={item} onNavigate={onClose} />
        ))}
      </Box>
    </Drawer>
  );
}
