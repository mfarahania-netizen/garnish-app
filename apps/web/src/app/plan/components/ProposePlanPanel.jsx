// app/plan/components/ProposePlanPanel.jsx
// PLANNER-L4-09: thin FUNCTIONAL "generate plan" (no visual/brand design). Calls the intelligent
// PROPOSE endpoint and renders the proposed slots + WHY. It PROPOSES — applying stays the existing
// add-meal flow (this panel does not write the plan).
import { useState } from 'react';
import { Paper, Button, Group, Text, Stack, Badge, Loader, Alert } from '@mantine/core';
import { IconWand } from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';

export default function ProposePlanPanel() {
  const [state, setState] = useState({ status: 'idle', data: null });

  async function propose() {
    setState({ status: 'loading', data: null });
    try {
      const { data } = await apiClient.post('/meal-plans/propose', { days: 7, meals: ['lunch', 'dinner'] });
      setState({ status: 'done', data });
    } catch {
      setState({ status: 'error', data: null });
    }
  }

  return (
    <Paper p="sm" radius="md" withBorder mb="md" data-testid="propose-plan">
      <Group justify="space-between">
        <Text size="sm" fw={700}>برنامهٔ هوشمند هفته</Text>
        <Button size="xs" color="orange" leftSection={<IconWand size={14} />} onClick={propose} loading={state.status === 'loading'}>پیشنهاد بده</Button>
      </Group>
      {state.status === 'error' && <Alert mt="xs" color="red" variant="light">خطا در ساخت پیشنهاد.</Alert>}
      {state.status === 'done' && state.data && (
        state.data.slots?.length ? (
          <Stack gap={4} mt="xs">
            <Text size="xs" c="dimmed">{state.data.slots.length} وعدهٔ پیشنهادی (پیشنهاد است — برای اعمال، وعده را اضافه کن).</Text>
            {state.data.slots.slice(0, 8).map((s, i) => (
              <Group key={i} gap={6} wrap="nowrap">
                <Badge size="xs" variant="light">{s.mealType}</Badge>
                <Text size="xs" fw={600}>{s.title}</Text>
                <Text size="xs" c="dimmed" lineClamp={1}>— {s.why}</Text>
              </Group>
            ))}
          </Stack>
        ) : (
          <Alert mt="xs" color="gray" variant="light">پیشنهاد کافی پیدا نشد (با مواد/محدودیت‌های فعلی).</Alert>
        )
      )}
    </Paper>
  );
}
