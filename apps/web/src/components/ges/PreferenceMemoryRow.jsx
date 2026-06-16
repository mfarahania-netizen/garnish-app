import { Box, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconPencil, IconTrash } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { pressResponse } from '../../lib/motion';

/**
 * PreferenceMemoryRow (PL row 23) — show & edit what the system believes about
 * the user, in plain language, with an honest source tag.
 *
 * Anatomy: belief text ("Avoids cilantro") + source tag (stated | inferred) +
 * edit + delete. Inferred beliefs are clearly labelled (never unexplained);
 * delete is "forget" and the caller offers undo. Explicit user edits win over
 * inference.
 *
 * Pure presentational. Motion: pressResponse. RTL-safe. Token-pure.
 *
 * Props:
 *  - belief: the plain-language belief (required)
 *  - source: 'stated' | 'inferred' (default 'inferred')
 *  - onEdit / onDelete: callbacks
 *  - statedLabel / inferredLabel: source-tag copy overrides
 */
const SOURCE_COPY = { stated: 'You told us', inferred: 'We noticed' };

export function PreferenceMemoryRow({
  belief,
  source = 'inferred',
  onEdit,
  onDelete,
  statedLabel = SOURCE_COPY.stated,
  inferredLabel = SOURCE_COPY.inferred,
}) {
  const tag = source === 'stated' ? statedLabel : inferredLabel;
  const tagFg = source === 'stated' ? 'var(--g-color-state-success-fg)' : 'var(--g-color-text-muted)';
  const tagBg = source === 'stated' ? 'var(--g-color-state-success-bg)' : 'var(--g-color-bg-canvas)';

  return (
    <Group
      wrap="nowrap"
      align="center"
      style={{
        gap: 'var(--g-space-2)',
        padding: 'var(--g-space-3)',
        borderRadius: 'var(--g-radius-card)',
        background: 'var(--g-color-bg-surface)',
        border: '1px solid var(--g-color-border-subtle)',
        inlineSize: '100%',
      }}
    >
      <Stack style={{ flex: 1, minInlineSize: 0, gap: 'var(--g-space-1)' }}>
        <Text
          style={{
            fontFamily: 'var(--g-font-text)',
            fontSize: 'var(--g-font-size-16)',
            fontWeight: 500,
            color: 'var(--g-color-text-primary)',
            textAlign: 'start',
          }}
        >
          {belief}
        </Text>
        <Box
          component="span"
          style={{
            alignSelf: 'flex-start',
            paddingInline: 'var(--g-space-2)',
            paddingBlock: '2px',
            borderRadius: 'var(--g-radius-chip)',
            background: tagBg,
            color: tagFg,
            fontFamily: 'var(--g-font-text)',
            fontSize: 'var(--g-font-size-12)',
            fontWeight: 600,
          }}
        >
          {tag}
        </Box>
      </Stack>

      {onEdit && (
        <UnstyledButton
          component={motion.button}
          type="button"
          onClick={onEdit}
          whileTap={pressResponse.whileTap}
          aria-label={`Edit: ${belief}`}
          style={ctrl('var(--g-color-text-secondary)')}
        >
          <IconPencil size={18} stroke={1.6} aria-hidden="true" />
        </UnstyledButton>
      )}
      {onDelete && (
        <UnstyledButton
          component={motion.button}
          type="button"
          onClick={onDelete}
          whileTap={pressResponse.whileTap}
          aria-label={`Forget: ${belief}`}
          style={ctrl('var(--g-color-state-danger-fg)')}
        >
          <IconTrash size={18} stroke={1.6} aria-hidden="true" />
        </UnstyledButton>
      )}
    </Group>
  );
}

const ctrl = (color) => ({
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
  minWidth: 44,
  background: 'transparent',
  color,
});

export default PreferenceMemoryRow;
