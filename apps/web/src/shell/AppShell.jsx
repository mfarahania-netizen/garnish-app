import { Box } from '@mantine/core';
import { Outlet } from 'react-router-dom';
import { useDisclosure } from '@mantine/hooks';
import TopBar from './TopBar';
import NavDrawer from './NavDrawer';
import BottomNav from './BottomNav';

/**
 * AppShell — the persistent chrome that wraps every routed screen.
 *
 * Mobile-first column (max 480) centred on the canvas, framed by a subtle
 * border. TopBar sticks to the top, BottomNav sticks to the bottom, the routed
 * content lives in the scrolling <main> between them. The hamburger drives the
 * NavDrawer open/close state. Token-pure; RTL via logical properties + the
 * document `dir="rtl"`.
 */
export default function AppShell() {
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <Box
      style={{
        minBlockSize: '100dvh',
        display: 'flex',
        justifyContent: 'center',
        background: 'var(--g-color-bg-canvas)',
      }}
    >
      <Box
        style={{
          width: '100%',
          maxInlineSize: 480,
          minBlockSize: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--g-color-bg-canvas)',
          borderInline: '1px solid var(--g-color-border-subtle)',
        }}
      >
        <TopBar onMenuOpen={open} />
        <NavDrawer opened={opened} onClose={close} />

        <Box component="main" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Outlet />
        </Box>

        <BottomNav />
      </Box>
    </Box>
  );
}
