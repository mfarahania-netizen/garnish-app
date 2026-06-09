// apps/web/src/app/recipe/[id]/components/TipsSection.jsx
import { Accordion, Group, Text, Badge, Stack, Paper } from '@mantine/core';
import { IconBulb, IconCircleCheck } from '@tabler/icons-react';

export default function TipsSection({ tips }) {
  // اگر tips رشته‌ای است (JSON)، آن را parse کن
  let parsedTips = tips;
  if (typeof tips === 'string') {
    try { parsedTips = JSON.parse(tips); } catch { parsedTips = []; }
  }
  if (!Array.isArray(parsedTips) || parsedTips.length === 0) return null;

  return (
    <Accordion.Item value="tips">
      <Accordion.Control>
        <Group justify="space-between" style={{ width: '100%' }}>
          <Group gap="xs">
            <IconBulb size={20} color="#FF6B35" />
            <Text fw={600} size="sm">نکات</Text>
          </Group>
          <Badge variant="light" color="orange" size="sm">{parsedTips.length} نکته</Badge>
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        <Stack gap="sm">
          {parsedTips.map((tip, idx) => (
            <Paper key={idx} p="sm" radius="md" style={{ borderRight: '4px solid #4CAF50', background: 'rgba(76,175,80,0.05)' }}>
              <Group gap={10} align="flex-start" wrap="nowrap">
                <IconCircleCheck size={18} color="#4CAF50" style={{ marginTop: 2 }} />
                <Text size="sm" style={{ lineHeight: 1.6 }}>{typeof tip === 'string' ? tip : tip.instruction || tip.text || ''}</Text>
              </Group>
            </Paper>
          ))}
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
  );
}