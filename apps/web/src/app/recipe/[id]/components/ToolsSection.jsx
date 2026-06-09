// apps/web/src/app/recipe/[id]/components/ToolsSection.jsx
import { Accordion, Group, Text, Badge, Paper } from '@mantine/core';
import { IconTools } from '@tabler/icons-react';
import { getToolEmoji } from './helpers';

export default function ToolsSection({ tools }) {
  // تبدیل tools به آرایه (اگر رشتهٔ JSON بود parse کن)
  const parsedTools = Array.isArray(tools)
    ? tools
    : typeof tools === 'string'
      ? (() => { try { return JSON.parse(tools); } catch { return []; } })()
      : [];

  if (!parsedTools.length) return null;

  return (
    <Accordion.Item value="tools">
      <Accordion.Control>
        <Group justify="space-between" style={{ width: '100%' }}>
          <Group gap="xs">
            <IconTools size={20} color="#FF6B35" />
            <Text fw={600} size="sm">ابزارها</Text>
          </Group>
          <Badge variant="light" color="orange" size="sm">{parsedTools.length} عدد</Badge>
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        <Group gap="sm">
          {parsedTools.map((tool, idx) => (
            <Paper key={idx} p="xs" radius="md" withBorder style={{ background: 'rgba(255,255,255,0.7)' }}>
              <Group gap={4}>
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