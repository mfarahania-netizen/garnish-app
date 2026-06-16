import { Text, UnstyledButton } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';

/**
 * SearchField — the Home search affordance. Per the mockup it's a tappable field-styled
 * button (the real query input lives on Discovery); tapping navigates there. Search glyph
 * at the inline-start (right in RTL). Token-pure, ≥44px (50px) target.
 */
export default function SearchField({ placeholder = 'جستجوی غذا، ماده، یا دستور…', onClick }) {
  return (
    <UnstyledButton
      type="button"
      onClick={onClick}
      aria-label={placeholder}
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
      <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', color: 'var(--g-color-text-muted)' }}>
        {placeholder}
      </Text>
    </UnstyledButton>
  );
}
