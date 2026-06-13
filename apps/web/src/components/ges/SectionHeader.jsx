import { Box, Group, Stack, Text } from '@mantine/core';

/**
 * SectionHeader — a section title (display font) + optional subtitle + optional action slot.
 *
 * Logical alignment only (text-align: start, inline flow follows dir).
 * Props:
 *   title       — heading text (rendered with the display font)
 *   subtitle    — optional secondary line
 *   action      — optional node rendered at the inline-end (e.g. a Button / link)
 *   as          — heading element ('h2' default) for document outline correctness
 *   id          — optional id (useful for aria-labelledby on the section)
 *
 * Pure presentational; no business logic.
 */

export function SectionHeader({
  title,
  subtitle = null,
  action = null,
  as = 'h2',
  id,
  ...rest
}) {
  return (
    <Group
      justify="space-between"
      align="flex-start"
      wrap="nowrap"
      gap="var(--g-space-3)"
      style={{ inlineSize: '100%' }}
      {...rest}
    >
      <Stack gap="var(--g-space-1)" style={{ minInlineSize: 0, flex: 1 }}>
        <Text
          component={as}
          id={id}
          style={{
            fontFamily: 'var(--g-font-display)',
            fontSize: 'var(--g-font-size-22)',
            fontWeight: 700,
            lineHeight: 'var(--g-leading-heading)',
            color: 'var(--g-color-text-primary)',
            textAlign: 'start',
            margin: 0,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              fontFamily: 'var(--g-font-text)',
              fontSize: 'var(--g-font-size-14)',
              lineHeight: 'var(--g-leading-body)',
              color: 'var(--g-color-text-secondary)',
              textAlign: 'start',
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </Stack>

      {action ? (
        <Box style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center' }}>
          {action}
        </Box>
      ) : null}
    </Group>
  );
}

export default SectionHeader;
