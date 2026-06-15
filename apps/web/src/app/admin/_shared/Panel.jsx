// GARNISH-DASHBOARD-L4-17 — GES card panel (tokenized, calm depth) + section title + export action.
import { Paper, Group, Text, Stack, Button } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import { gesPanel, T } from './gesTheme';

export default function Panel({ title, subtitle, children, onExport, exportLabel = 'خروجی CSV', right }) {
  return (
    <Paper style={gesPanel()}>
      {(title || onExport || right) && (
        <Group justify="space-between" align="flex-start" mb={subtitle ? 4 : 'sm'} wrap="nowrap">
          <div>
            {title && <Text fw={700} size="sm" style={{ color: T.textPrimary }}>{title}</Text>}
            {subtitle && <Text size="xs" style={{ color: T.textMuted }} mt={2}>{subtitle}</Text>}
          </div>
          <Group gap="xs">
            {right}
            {onExport && (
              <Button size="xs" variant="light" color="orange" radius="md" leftSection={<IconDownload size={14} />} onClick={onExport}>
                {exportLabel}
              </Button>
            )}
          </Group>
        </Group>
      )}
      <div style={{ marginTop: title ? 'var(--g-space-4)' : 0 }}>{children}</div>
    </Paper>
  );
}

export function SectionHeader({ title, subtitle, right }) {
  return (
    <Group justify="space-between" align="flex-start">
      <Stack gap={2}>
        <Text fw={800} size="1.6rem" style={{ color: T.textPrimary }}>{title}</Text>
        {subtitle && <Text size="sm" style={{ color: T.textMuted }}>{subtitle}</Text>}
      </Stack>
      {right}
    </Group>
  );
}
