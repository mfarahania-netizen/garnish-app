import { Box, Text, UnstyledButton } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { pressResponse } from '../../lib/motion';

/**
 * Chip — the shared filter / category / trait chip (GES "typing is a last
 * resort": chips over text inputs for frequent choices).
 *
 * A pill with optional leading glyph + label. Selectable (toggle) and/or
 * removable. Selection is conveyed by fill + a check glyph (never color-only).
 *
 * Variants (`variant`): 'filter' (toggle) | 'category' | 'trait'. All share the
 * same chrome; `selected` drives the saffron-tinted active look on filter chips.
 *
 * A11y: a real button; toggle chips expose aria-pressed; the 44px hit-area wraps
 * a compact visible pill; remove control is a separate labelled button.
 * Motion: pressResponse only. RTL-safe (logical flow). Token-pure.
 *
 * Props:
 *  - label: chip text (required for a meaningful chip)
 *  - icon: optional leading ReactNode glyph
 *  - selected: boolean — active state (filter/trait)
 *  - onClick: toggle/select callback
 *  - onRemove: when provided, renders a trailing remove (×) control
 *  - variant: 'filter' | 'category' | 'trait' (default 'filter')
 *  - ariaLabel: override the accessible label
 */
export function Chip({
  label,
  icon = null,
  selected = false,
  onClick,
  onRemove,
  variant = 'filter',
  ariaLabel,
}) {
  const interior = (
    <Box
      component="span"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--g-space-1)',
        blockSize: 32,
        paddingInline: 'var(--g-space-3)',
        borderRadius: 'var(--g-radius-chip)',
        background: selected ? 'var(--g-color-brand-50)' : 'var(--g-color-bg-surface)',
        border: `1px solid ${selected ? 'var(--g-color-brand-600)' : 'var(--g-color-border-strong)'}`,
        color: selected ? 'var(--g-color-brand-700)' : 'var(--g-color-text-secondary)',
        fontFamily: 'var(--g-font-text)',
        fontSize: 'var(--g-font-size-14)',
        fontWeight: 500,
        lineHeight: 'var(--g-leading-heading)',
        maxInlineSize: '100%',
      }}
    >
      {selected ? (
        <IconCheck size={14} stroke={2} aria-hidden="true" style={{ flexShrink: 0 }} />
      ) : (
        icon
      )}
      <Box component="span" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </Box>
    </Box>
  );

  return (
    <Box style={{ display: 'inline-flex', alignItems: 'center' }}>
      <UnstyledButton
        component={motion.button}
        type="button"
        onClick={onClick}
        whileTap={pressResponse.whileTap}
        aria-pressed={variant === 'category' ? undefined : selected}
        aria-label={ariaLabel || label}
        data-variant={variant}
        data-selected={selected || undefined}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 44,
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
      >
        {interior}
      </UnstyledButton>
      {onRemove && (
        <UnstyledButton
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 44,
            minWidth: 44,
            marginInlineStart: 'calc(var(--g-space-2) * -1)',
            color: 'var(--g-color-text-muted)',
            background: 'transparent',
          }}
        >
          <IconX size={14} stroke={1.8} aria-hidden="true" />
        </UnstyledButton>
      )}
    </Box>
  );
}

export default Chip;
