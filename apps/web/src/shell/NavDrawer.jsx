import { Box, Drawer, Text, UnstyledButton } from '@mantine/core';
import { NavLink as RouterNavLink, useNavigate } from 'react-router-dom';
import { IconX, IconLeaf, IconLogout } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { DRAWER_PRIMARY, DRAWER_SECONDARY } from './navConfig';
import { useAuth } from '../context/AuthContext';
import apiClient from '../lib/apiClient';
import { faPercent } from '../components/ges/format';

/**
 * NavDrawer — the hamburger drawer, rebuilt to the approved mockup as a SINGLE clean panel:
 * a user header (avatar + name + taste-maturity line) at the top, one grouped nav list
 * (each destination rendered exactly ONCE), and a red «خروج» logout pinned to the bottom.
 *
 * Built on Mantine's Drawer for accessible behaviour (focus trap, ESC, overlay-click,
 * scroll lock, ARIA). Under dir="rtl" Mantine maps position="left" to the inline-start
 * (right) edge — the conventional side for an RTL menu — and slides in from the right.
 * Each item is a real react-router link, so tapping both routes and closes the drawer.
 * Token-pure; motion respects the OS reduced-motion setting.
 */

// Taste-maturity band → short Persian status (matches the mockup's «در حال شکل‌گیری»).
const BAND_SHORT = {
  empty: 'تازه شروع شده',
  forming: 'در حال شکل‌گیری',
  developing: 'در حال رشد',
  mature: 'پخته و روشن',
};

function DrawerLink({ item, onNavigate, secondary }) {
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
        paddingBlock: secondary ? 'var(--g-space-2)' : 'var(--g-space-3)',
        borderRadius: 'var(--g-radius-input)',
        borderInlineStart: isActive ? '3px solid var(--g-color-brand-600)' : '3px solid transparent',
        textDecoration: 'none',
        color: isActive
          ? 'var(--g-color-brand-700)'
          : secondary ? 'var(--g-color-text-secondary)' : 'var(--g-color-text-primary)',
        fontWeight: isActive ? 700 : secondary ? 500 : 600,
      })}
    >
      {({ isActive }) => (
        <>
          <item.Icon
            size={secondary ? 20 : 22}
            stroke={1.8}
            aria-hidden="true"
            color={isActive ? 'var(--g-color-brand-600)' : secondary ? 'var(--g-color-text-muted)' : 'var(--g-color-text-secondary)'}
          />
          <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: secondary ? 'var(--g-font-size-14)' : 'var(--g-font-size-16)', color: 'inherit' }}>
            {item.label}
          </Text>
        </>
      )}
    </RouterNavLink>
  );
}

export default function NavDrawer({ opened, onClose }) {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();

  // Maturity for the header line — shares the cache key with Home's /profile fetch (deduped).
  const profile = useQuery({
    queryKey: ['home', 'profile'],
    queryFn: () => apiClient.get('/profile').then((r) => r.data),
    enabled: !!token,
  });

  const maturity = profile.data?.maturity;
  const band = maturity?.band;
  const score = typeof maturity?.overallScore === 'number' ? maturity.overallScore : null;
  const pct = score == null ? null : score <= 1 ? score * 100 : score;

  const name = (user?.name || '').trim() || 'مهمان';
  const initial = name.charAt(0) || 'گ';

  const handleLogout = () => {
    onClose();
    logout();
    navigate('/');
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="left"
      size={306}
      zIndex={400}
      withCloseButton={false}
      aria-label="منوی کاربری گارنیش"
      overlayProps={{ backgroundOpacity: 0.42, blur: 2 }}
      transitionProps={{ duration: 240 }}
      styles={{
        content: { background: 'var(--g-color-bg-surface)', display: 'flex', flexDirection: 'column' },
        body: { padding: 0, flex: 1, display: 'flex', flexDirection: 'column', minBlockSize: 0 },
      }}
    >
      {/* USER HEADER */}
      <Box
        style={{
          paddingInline: 'var(--g-space-5)',
          paddingBlockStart: 'calc(var(--g-space-5) + env(safe-area-inset-top))',
          paddingBlockEnd: 'var(--g-space-5)',
          background: 'var(--g-color-bg-canvas)',
          borderBlockEnd: '1px solid var(--g-color-border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--g-space-3)',
        }}
      >
        <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', minInlineSize: 0 }}>
          <Box
            aria-hidden="true"
            style={{
              flexShrink: 0, inlineSize: 50, blockSize: 50, borderRadius: '50%',
              background: 'var(--g-color-brand-100)', color: 'var(--g-color-brand-700)',
              display: 'grid', placeItems: 'center', fontFamily: 'var(--g-font-fa)', fontWeight: 800, fontSize: 'var(--g-font-size-18)',
            }}
          >
            {initial}
          </Box>
          <Box style={{ minInlineSize: 0 }}>
            <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontWeight: 800, fontSize: 'var(--g-font-size-16)', color: 'var(--g-color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </Text>
            {band ? (
              <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', marginBlockStart: 2 }}>
                <IconLeaf size={12} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-700)' }} />
                <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontWeight: 600, fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-brand-700)' }}>
                  ذائقه: {BAND_SHORT[band] || 'در حال شکل‌گیری'}{pct != null ? ` ${faPercent(pct)}` : ''}
                </Text>
              </Box>
            ) : null}
          </Box>
        </Box>
        <UnstyledButton
          type="button"
          onClick={onClose}
          aria-label="بستن منو"
          style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', inlineSize: 40, blockSize: 40, borderRadius: '50%', color: 'var(--g-color-text-muted)' }}
        >
          <IconX size={20} stroke={1.8} />
        </UnstyledButton>
      </Box>

      {/* NAV (scrolls; each item rendered once) */}
      <Box style={{ flex: 1, overflowY: 'auto', minBlockSize: 0 }}>
        <Box component="nav" aria-label="منوی اصلی" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-1)', paddingInline: 'var(--g-space-3)', paddingBlock: 'var(--g-space-3)' }}>
          {DRAWER_PRIMARY.map((item) => (
            <DrawerLink key={item.to} item={item} onNavigate={onClose} />
          ))}
        </Box>
        <Box aria-hidden="true" style={{ blockSize: 1, background: 'var(--g-color-border-subtle)', marginInline: 'var(--g-space-5)' }} />
        <Box component="nav" aria-label="بیشتر" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-1)', paddingInline: 'var(--g-space-3)', paddingBlock: 'var(--g-space-3)' }}>
          {DRAWER_SECONDARY.map((item) => (
            <DrawerLink key={item.to} item={item} onNavigate={onClose} secondary />
          ))}
        </Box>
      </Box>

      {/* LOGOUT (pinned bottom; only when signed in) */}
      {token ? (
        <Box style={{ paddingInline: 'var(--g-space-5)', paddingBlockStart: 'var(--g-space-3)', paddingBlockEnd: 'calc(var(--g-space-4) + env(safe-area-inset-bottom))', borderBlockStart: '1px solid var(--g-color-border-subtle)' }}>
          <UnstyledButton
            type="button"
            onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', inlineSize: '100%', minBlockSize: 44, color: 'var(--g-color-state-danger-fg)' }}
          >
            <IconLogout size={20} stroke={1.8} aria-hidden="true" />
            <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontWeight: 600, fontSize: 'var(--g-font-size-14)', color: 'inherit' }}>خروج</Text>
          </UnstyledButton>
        </Box>
      ) : null}
    </Drawer>
  );
}
