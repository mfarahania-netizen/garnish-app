import { Accordion, Group, Text, Badge, Paper } from '@mantine/core';
import { IconTools } from '@tabler/icons-react';
import { getToolEmoji } from './helpers';

export default function ToolsSection({ tools }) {
  const parsedTools = Array.isArray(tools)
    ? tools
    : typeof tools === 'string'
      ? (() => {
          try {
            return JSON.parse(tools);
          } catch {
            return [];
          }
        })()
      : [];

  if (!parsedTools.length) return null;

  return (
    <Accordion.Item value="tools">
      <Accordion.Control>
        <Group justify="space-between" style={{ width: '100%' }}>
          <Group gap="xs">
            <IconTools size={20} color="var(--g-color-food-saffron)" />
            <Text fw={700} size="sm">ابزارها</Text>
          </Group>
          <Badge variant="light" color="orange" size="sm">{parsedTools.length} عدد</Badge>
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        <Group gap="sm">
          {parsedTools.map((tool, idx) => (
            <Paper key={`${tool}-${idx}`} p="xs" radius="md" withBorder style={{ background: 'var(--g-color-bg-surface)' }}>
              <Group gap={6} wrap="nowrap">
                <Text>{getToolEmoji(tool)}</Text>
                <Text size="xs">{tool}</Text>
              </Group>
            </Paper>
          ))}
        </Group>
      </Accordion.Panel>
    </Accordion.Item>
  );
}
