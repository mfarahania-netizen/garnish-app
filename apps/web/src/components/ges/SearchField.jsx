import { Text, UnstyledButton } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';

/**
 * SearchField — the Home search action. It is intentionally a button/link-like action,
 * not a fake editable input; the real query input lives on Discovery.
 */
export default function SearchField({ label = 'چی می‌خوای بپزی؟', placeholder = 'جستجو در دستورها', onClick }) {
  return (
    <UnstyledButton
      type="button"
      onClick={onClick}
      aria-label={`${label} — ${placeholder}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--g-space-2)',
        inlineSize: '100%',
        boxSizing: 'border-box',
        minBlockSize: 50,
        paddingInline: 'var(--g-space-4)',
        background: 'var(--g-color-bg-surface)',
        border: '1px solid var(--g-color-border-subtle)',
        borderRadius: 'var(--g-radius-input)',
        boxShadow: 'var(--g-shadow-1)',
      }}
    >
      <IconSearch size={19} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)' }} />
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minInlineSize: 0 }}>
        <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 800, color: 'var(--g-color-text-primary)', lineHeight: 1.35 }}>
          {label}
        </Text>
        <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', lineHeight: 1.35 }}>
          {placeholder}
        </Text>
      </span>
    </UnstyledButton>
  );
}
