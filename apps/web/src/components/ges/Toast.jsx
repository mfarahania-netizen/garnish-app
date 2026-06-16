import { Box, Text } from '@mantine/core';

/**
 * Toast — a brief status message for graceful no-ops ("به‌زودی فعال می‌شود") and confirmations.
 * Ink surface, inverse text, saffron icon; pinned near the bottom of the shell column above
 * the nav. Caller owns the timeout. role="status" for screen readers. Token-pure.
 */
export default function Toast({ toast }) {
  if (!toast) return null;
  const Icon = toast.Icon;
  return (
    <Box
      role="status"
      style={{
        position: 'fixed',
        insetInline: 16,
        insetBlockEnd: 'calc(72px + env(safe-area-inset-bottom))',
        zIndex: 'var(--g-z-toast)',
        maxInlineSize: 448,
        marginInline: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--g-space-3)',
        padding: 'var(--g-space-3) var(--g-space-4)',
        background: 'var(--g-color-text-primary)',
        color: 'var(--g-color-text-inverse)',
        borderRadius: 'var(--g-radius-input)',
        boxShadow: 'var(--g-shadow-3)',
      }}
    >
      {Icon ? <Icon size={18} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-300)', flexShrink: 0 }} /> : null}
      <Text component="span" style={{ flex: 1, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 500 }}>
        {toast.message}
      </Text>
    </Box>
  );
}
