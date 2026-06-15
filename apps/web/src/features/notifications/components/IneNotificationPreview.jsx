// features/notifications/components/IneNotificationPreview.jsx
// NOTIF-L4-10: thin FUNCTIONAL preview of the Notification Intelligence Engine (DRY-RUN). Calls the
// owner-only /notifications/ine/preview endpoint and renders what the engine WOULD decide right now
// (send / suppress / defer) and WHY. Decides only — never sends. Degrades silently on empty/error.
import { useEffect, useState } from 'react';
import { Paper, Text, Group, Stack, Badge, Loader } from '@mantine/core';
import { IconBrain } from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';

const DECISION = {
  send: { color: 'green', label: 'ارسال می‌شد' },
  defer: { color: 'yellow', label: 'به وقت بهتر موکول می‌شد' },
  suppress: { color: 'gray', label: 'ارسال نمی‌شد' },
};

export default function IneNotificationPreview() {
  const [state, setState] = useState({ status: 'loading', data: null });

  useEffect(() => {
    let active = true;
    apiClient
      .get('/notifications/ine/preview')
      .then((res) => { if (active) setState({ status: 'done', data: res.data }); })
      .catch(() => { if (active) setState({ status: 'error', data: null }); });
    return () => { active = false; };
  }, []);

  if (state.status === 'error') return null;
  if (state.status === 'loading') return <Group px="md" my="sm"><Loader size="xs" color="orange" /><Text size="xs" c="dimmed">تحلیل اعلان‌ها…</Text></Group>;

  const decisions = state.data?.decisions || [];
  if (!decisions.length) return null;

  return (
    <Paper p="md" radius="lg" mb="lg" withBorder data-testid="ine-preview">
      <Group gap="xs" mb="sm">
        <IconBrain size={18} color="#FF6B35" />
        <Text size="sm" fw={700}>پیش‌نمایش هوشمند اعلان‌ها</Text>
        {state.data?.dryRun && <Badge size="xs" color="blue" variant="light">آزمایشی</Badge>}
      </Group>
      <Stack gap={8}>
        {decisions.map((d) => {
          const meta = DECISION[d.decision] || DECISION.suppress;
          return (
            <div key={d.triggerKey}>
              <Group gap="xs" justify="space-between">
                <Text size="sm" fw={600}>{d.content?.title || d.triggerKey}</Text>
                <Badge size="xs" color={meta.color} variant="light">{meta.label}</Badge>
              </Group>
              {d.reasons?.length > 0 && <Text size="xs" c="dimmed">{d.reasons[0]}</Text>}
            </div>
          );
        })}
      </Stack>
    </Paper>
  );
}
