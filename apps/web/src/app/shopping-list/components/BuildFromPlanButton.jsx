// app/shopping-list/components/BuildFromPlanButton.jsx
// PLANNER-L4-09: thin FUNCTIONAL "build shopping list from this week's plan" (no visual/brand design).
// Aggregates+merges the plan's ingredients server-side and adds only NEW items (manual/checked preserved).
import { useState } from 'react';
import { Button, Text, Group, Alert } from '@mantine/core';
import { IconListCheck } from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';

export default function BuildFromPlanButton({ onBuilt }) {
  const [state, setState] = useState({ status: 'idle', msg: '' });

  async function build() {
    setState({ status: 'loading', msg: '' });
    try {
      const { data } = await apiClient.post('/shopping-list/from-plan');
      const msg = data?.resultStatus === 'no_plan'
        ? 'برنامهٔ غذایی این هفته خالی است.'
        : `${data?.added ?? 0} قلم اضافه شد${data?.merged ? ` (${data.merged} ادغام‌شده)` : ''}.`;
      setState({ status: 'done', msg });
      if (onBuilt) onBuilt();
    } catch {
      setState({ status: 'error', msg: 'خطا در ساخت لیست از برنامه.' });
    }
  }

  return (
    <Group gap="xs" mb="sm" data-testid="build-from-plan">
      <Button size="xs" variant="light" color="teal" leftSection={<IconListCheck size={14} />} onClick={build} loading={state.status === 'loading'}>
        ساخت از برنامهٔ غذایی
      </Button>
      {state.status === 'done' && <Text size="xs" c="dimmed">{state.msg}</Text>}
      {state.status === 'error' && <Alert color="red" variant="light" p={4}>{state.msg}</Alert>}
    </Group>
  );
}
