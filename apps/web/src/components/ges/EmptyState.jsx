import { Box, Text, UnstyledButton } from '@mantine/core';

/**
 * EmptyState — a designed forward path, never a dead end. Warm saffron medallion, a kind
 * title + body, and one saffron primary action. No shame. Token-pure.
 */
export default function EmptyState({ icon: Icon, title, body, actionLabel, onAction, actionIcon: ActionIcon, children }) {
  return (
    <Box
      style={{
        background: 'var(--g-color-bg-surface)',
        border: '1px solid var(--g-color-border-subtle)',
        borderRadius: 'var(--g-radius-card)',
        boxShadow: 'var(--g-shadow-1)',
        padding: 'var(--g-space-6) var(--g-space-5)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      {Icon ? (
        <Box
          aria-hidden="true"
          style={{
            display: 'grid',
            placeItems: 'center',
            inlineSize: 64,
            blockSize: 64,
            borderRadius: '50%',
            background: 'var(--g-color-brand-50)',
            color: 'var(--g-color-brand-600)',
            border: '1.5px solid var(--g-color-brand-200)',
            marginBlockEnd: 'var(--g-space-4)',
          }}
        >
          <Icon size={30} stroke={1.6} />
        </Box>
      ) : null}

      <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, lineHeight: 'var(--g-leading-heading)', color: 'var(--g-color-text-primary)', textWrap: 'balance', margin: 0 }}>
        {title}
      </Text>

      {body ? (
        <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)', maxInlineSize: '34ch', margin: 'var(--g-space-2) 0 0' }}>
          {body}
        </Text>
      ) : null}

      {actionLabel ? (
        <UnstyledButton
          type="button"
          onClick={onAction}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--g-space-1)',
            minBlockSize: 48,
            paddingInline: 'var(--g-space-6)',
            marginBlockStart: 'var(--g-space-5)',
            borderRadius: 'var(--g-radius-input)',
            background: 'var(--g-color-brand-600)',
            color: 'var(--g-color-text-inverse)',
            fontFamily: 'var(--g-font-fa)',
            fontSize: 'var(--g-font-size-16)',
            fontWeight: 700,
          }}
        >
          {ActionIcon ? <ActionIcon size={18} stroke={1.8} aria-hidden="true" /> : null}
          {actionLabel}
        </UnstyledButton>
      ) : null}

      {children}
    </Box>
  );
}
