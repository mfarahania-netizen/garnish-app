import { Box, Group, Text, UnstyledButton } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { pressResponse } from '../../lib/motion';

/**
 * GroceryRow (PL row 19) — one shopping-list item.
 *
 * Anatomy: a 44px checkbox + name + qty/unit + optional merge-chip slot +
 * optional secondary "have it" (pantry signal). States: unchecked | checked
 * (strike-through, NOT color-only) | loading | offline-queued.
 *
 * The whole row toggles the check (big target). Checked uses strike + muted +
 * a check glyph so the state is not conveyed by color alone. Pure presentational.
 * Motion: pressResponse. RTL-safe. Token-pure.
 *
 * Props:
 *  - name: item name (required)
 *  - qty: formatted quantity/unit string (e.g. "2 cups")
 *  - checked: boolean
 *  - onToggle: check/uncheck callback
 *  - onHaveIt: optional "have it" pantry-signal callback
 *  - mergeChip: optional ReactNode (e.g. <MergeChip/>)
 *  - state: 'idle' | 'loading' | 'offline' (default 'idle')
 *  - haveItLabel: copy override
 */
export function GroceryRow({
  name,
  qty,
  checked = false,
  onToggle,
  onHaveIt,
  mergeChip = null,
  state = 'idle',
  haveItLabel = 'Have it',
}) {
  const isLoading = state === 'loading';
  const isOffline = state === 'offline';

  return (
    <Group
      wrap="nowrap"
      align="center"
      style={{
        gap: 'var(--g-space-3)',
        paddingBlock: 'var(--g-space-1)',
        inlineSize: '100%',
        opacity: isLoading ? 0.6 : 1,
      }}
    >
      <UnstyledButton
        component={motion.button}
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={name}
        onClick={() => onToggle?.(!checked)}
        whileTap={pressResponse.whileTap}
        disabled={isLoading}
        style={{
          flex: 1,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--g-space-3)',
          minHeight: 44,
          background: 'transparent',
          textAlign: 'start',
          cursor: isLoading ? 'progress' : 'pointer',
        }}
      >
        <Box
          aria-hidden="true"
          style={{
            inlineSize: 24,
            blockSize: 24,
            flexShrink: 0,
            borderRadius: 'var(--g-radius-input)',
            border: `1px solid ${checked ? 'var(--g-color-food-saffron)' : 'var(--g-color-border-strong)'}`,
            background: checked ? 'var(--g-color-food-saffron)' : 'transparent',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--g-color-text-inverse)',
          }}
        >
          {checked && <IconCheck size={16} stroke={2.2} aria-hidden="true" />}
        </Box>

        <Box style={{ flex: 1, minInlineSize: 0 }}>
          <Text
            style={{
              fontFamily: 'var(--g-font-text)',
              fontSize: 'var(--g-font-size-16)',
              fontWeight: 500,
              color: checked ? 'var(--g-color-text-muted)' : 'var(--g-color-text-primary)',
              textDecoration: checked ? 'line-through' : 'none',
              textAlign: 'start',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {name}
          </Text>
          {(qty || isOffline) && (
            <Text
              style={{
                fontFamily: 'var(--g-font-text)',
                fontSize: 'var(--g-font-size-12)',
                color: 'var(--g-color-text-muted)',
                textAlign: 'start',
              }}
            >
              {qty}
              {isOffline ? (qty ? ' · saved offline' : 'saved offline') : ''}
            </Text>
          )}
        </Box>
      </UnstyledButton>

      {mergeChip && <Box style={{ flexShrink: 0 }}>{mergeChip}</Box>}

      {onHaveIt && (
        <UnstyledButton
          type="button"
          onClick={() => onHaveIt?.()}
          aria-label={`${haveItLabel}: ${name}`}
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 44,
            paddingInline: 'var(--g-space-3)',
            borderRadius: 'var(--g-radius-chip)',
            background: 'transparent',
            border: '1px solid var(--g-color-border-strong)',
            color: 'var(--g-color-text-secondary)',
            fontFamily: 'var(--g-font-text)',
            fontSize: 'var(--g-font-size-12)',
            fontWeight: 500,
          }}
        >
          {haveItLabel}
        </UnstyledButton>
      )}
    </Group>
  );
}

export default GroceryRow;
