import { Box, Stack, Group, Text, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconAlertTriangle } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { pressResponse } from '../../lib/motion';

/**
 * MergeChip (PL row 20) — show a cross-recipe ingredient merge HONESTLY.
 *
 * A small chip "×N recipes" that expands to the source list (recipe + qty each),
 * so the math is always shown — never a silent quantity sum. The conflict variant
 * surfaces unit mismatches ("review units") rather than guessing a conversion.
 *
 * Merge is by ingredientId only (the caller's concern). States: collapsed |
 * expanded | conflict. Pure presentational. Motion: pressResponse. RTL-safe.
 *
 * Props:
 *  - count: number of source recipes (drives the chip label)
 *  - sources: [{ recipe, qty }] shown when expanded
 *  - conflict: boolean — unit conflict, surfaced (never silently converted)
 *  - expanded: controlled expanded state
 *  - onToggle: expand/collapse callback
 *  - reviewLabel: copy for the conflict note
 */
export function MergeChip({
  count = 0,
  sources = [],
  conflict = false,
  expanded = false,
  onToggle,
  reviewLabel = 'Review units',
}) {
  return (
    <Box style={{ display: 'inline-block', maxInlineSize: '100%' }}>
      <UnstyledButton
        component={motion.button}
        type="button"
        onClick={() => onToggle?.(!expanded)}
        whileTap={pressResponse.whileTap}
        aria-expanded={expanded}
        aria-label={`From ${count} recipes${conflict ? ` — ${reviewLabel}` : ''}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--g-space-1)',
          minHeight: 44,
          paddingInline: 'var(--g-space-3)',
          borderRadius: 'var(--g-radius-chip)',
          background: conflict ? 'var(--g-color-state-warning-bg)' : 'var(--g-color-bg-canvas)',
          border: `1px solid ${conflict ? 'var(--g-color-state-warning-fg)' : 'var(--g-color-border-strong)'}`,
          color: conflict ? 'var(--g-color-state-warning-fg)' : 'var(--g-color-text-secondary)',
          fontFamily: 'var(--g-font-text)',
          fontSize: 'var(--g-font-size-12)',
          fontWeight: 600,
        }}
      >
        {conflict && <IconAlertTriangle size={14} stroke={1.6} aria-hidden="true" />}
        {conflict ? reviewLabel : `×${count} recipes`}
        <IconChevronDown
          size={14}
          stroke={1.6}
          aria-hidden="true"
          style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
        />
      </UnstyledButton>

      {expanded && sources.length > 0 && (
        <Stack
          component="ul"
          style={{
            gap: 'var(--g-space-1)',
            margin: 0,
            marginBlockStart: 'var(--g-space-2)',
            padding: 'var(--g-space-2)',
            listStyle: 'none',
            borderRadius: 'var(--g-radius-input)',
            background: 'var(--g-color-bg-surface)',
            border: '1px solid var(--g-color-border-subtle)',
          }}
        >
          {sources.map((s, i) => (
            <Group key={i} component="li" wrap="nowrap" justify="space-between" style={{ gap: 'var(--g-space-3)' }}>
              <Text style={{ flex: 1, minInlineSize: 0, fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-secondary)', textAlign: 'start', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.recipe}
              </Text>
              <Text style={{ flexShrink: 0, fontFamily: 'var(--g-font-display)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: 'var(--g-color-text-primary)' }}>
                {s.qty}
              </Text>
            </Group>
          ))}
        </Stack>
      )}
    </Box>
  );
}

export default MergeChip;
