// apps/web/src/app/recipe/[id]/components/TimingCard.jsx
import { useState } from 'react';
import { Paper, Group, Text, Box, Stack } from '@mantine/core';
import { IconClockHour4, IconArrowDown } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { useAnalytics } from '../../../../hooks/useAnalytics';
import { EventType } from '../../../../lib/eventTaxonomy';
import { formatTime } from './helpers';

export default function TimingCard({ recipe }) {
  const { trackEvent } = useAnalytics();
  const [open, setOpen] = useState(false);
  const { prep_time, cook_time, total_time, servings } = recipe;

  const toggle = () => {
    const eventType = open ? EventType.TIMING_COLLAPSE : EventType.TIMING_EXPAND;
    trackEvent(eventType, { recipeId: recipe.id });
    setOpen(prev => !prev);
  };

  return (
    <Paper p="md" radius="lg" mb="lg" style={{ background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,107,53,0.15)', cursor: 'pointer' }} onClick={toggle}>
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <IconClockHour4 size={20} color="#FF6B35" />
          <Text size="sm" fw={600} c="#1A237E">زمان‌بندی</Text>
        </Group>
        <Group gap="xs">
          {total_time && <Text size="xs" c="dimmed">{formatTime(total_time)}</Text>}
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }}>
            <IconArrowDown size={18} color="#666" />
          </motion.div>
        </Group>
      </Group>
      {open && (
        <Box mt="md">
          <Stack gap="xs">
            {prep_time && <TimingRow label="آماده‌سازی" value={formatTime(prep_time)} />}
            {cook_time && <TimingRow label="پخت" value={formatTime(cook_time)} />}
            {total_time && <TimingRow label="کل" value={formatTime(total_time)} />}
            {servings && <TimingRow label="تعداد" value={`${servings} نفر`} />}
          </Stack>
        </Box>
      )}
    </Paper>
  );
}

function TimingRow({ label, value }) {
  return (
    <Group justify="space-between">
      <Text size="xs" c="dimmed">{label}</Text>
      <Text size="xs" fw={500}>{value}</Text>
    </Group>
  );
}