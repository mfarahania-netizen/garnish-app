import { Box, Text, UnstyledButton } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { pressResponse } from '../../lib/motion';

/**
 * WhyChip (PL row 8) — entry point to explainability.
 *
 * A tiny chip (ⓘ glyph + "Why this?" / "چرا این؟") attached to any *recommended*
 * item. Tapping it opens the Why Sheet for that item via `onOpen`. Presence is
 * meant to be 100% on rec surfaces (rail / briefing / AI fills); when an item has
 * no real explanation payload the chip is simply not rendered (caller hides it and
 * logs the gap) — this component never fabricates a reason.
 *
 * Sizing (PL contract): the visible glyph + label is a compact ~24px-tall chip,
 * but the interactive control carries a >=44px hit-area so it stays thumb-safe.
 * The chip is NEVER icon-only — the label is always present (a11y row).
 *
 * Motion: pressResponse (a small whileTap scale) — the only animation. No inline
 * transitions, no keyframes.
 *
 * A11y: a real <button> with role=button (UnstyledButton), visible focus ring from
 * base.css :focus-visible, and an explicit aria-label so screen-reader users hear
 * which item the explanation is about.
 *
 * RTL-safe: logical spacing only (gap / paddingInline); flex order follows dir, so
 * glyph + label mirror automatically. Pure presentational — behavior via onOpen.
 *
 * Props:
 *  - label: chip text (default "Why this?"; pass "چرا این؟" for Persian)
 *  - onOpen: () => void — opens the Why Sheet for this item
 *  - ariaLabel: full accessible label (defaults to the visible label; pass a richer
 *      string like `Why this? — ${itemName}` for context)
 */
export function WhyChip({
  label = 'Why this?',
  onOpen,
  ariaLabel,
}) {
  return (
    <UnstyledButton
      component={motion.button}
      type="button"
      onClick={() => onOpen?.()}
      whileTap={pressResponse.whileTap}
      aria-label={ariaLabel || label}
      style={{
        // 44px hit-area; the visible chip inside stays compact.
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
        minWidth: 44,
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
      }}
    >
      {/* Visible chip — ~24px tall pill, glyph + label */}
      <Box
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--g-space-1)',
          blockSize: 24,
          paddingInline: 'var(--g-space-2)',
          borderRadius: 'var(--g-radius-chip)',
          background: 'var(--g-color-bg-surface)',
          border: '1px solid var(--g-color-border-subtle)',
          color: 'var(--g-color-text-secondary)',
        }}
      >
        <IconInfoCircle
          size={14}
          stroke={1.5}
          aria-hidden="true"
          style={{ inlineSize: 14, blockSize: 14, flexShrink: 0 }}
        />
        <Text
          component="span"
          style={{
            fontFamily: 'var(--g-font-text)',
            fontSize: 'var(--g-font-size-12)',
            fontWeight: 500,
            lineHeight: 'var(--g-leading-heading)',
            color: 'var(--g-color-text-secondary)',
            whiteSpace: 'nowrap',
            textAlign: 'start',
          }}
        >
          {label}
        </Text>
      </Box>
    </UnstyledButton>
  );
}

export default WhyChip;
