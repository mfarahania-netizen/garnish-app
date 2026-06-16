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
  const prepTime = recipe.prepTime ?? recipe.prep_time;
  const cookTime = recipe.cookingTime ?? recipe.cook_time;
  const totalTime = recipe.totalTime ?? recipe.total_time;
  const { servings } = recipe;

  if (!prepTime && !cookTime && !totalTime && !servings) return null;

  const toggle = () => {
    const eventType = open ? EventType.TIMING_COLLAPSE : EventType.TIMING_EXPAND;
    trackEvent(eventType, { recipeId: recipe.id });
    setOpen((prev) => !prev);
  };

  return (
    <Paper
      p="md"
      radius="lg"
      mb="lg"
      style={{
        background: 'var(--g-color-bg-surface)',
        backdropFilter: 'blur(10px)',
        border: '1px solid var(--g-color-border-subtle)',
        cursor: 'pointer',
      }}
      onClick={toggle}
    >
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <IconClockHour4 size={20} color="var(--g-color-food-saffron)" />
          <Text size="sm" fw={700} c="var(--g-color-text-primary)">زمان‌بندی</Text>
        </Group>
        <Group gap="xs">
          {totalTime && <Text size="xs" c="dimmed">{formatTime(totalTime)}</Text>}
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }}>
            <IconArrowDown size={18} color="var(--g-color-text-muted)" />
          </motion.div>
        </Group>
      </Group>
      {open && (
        <Box mt="md">
          <Stack gap="xs">
            {prepTime && <TimingRow label="آماده‌سازی" value={formatTime(prepTime)} />}
            {cookTime && <TimingRow label="پخت" value={formatTime(cookTime)} />}
            {totalTime && <TimingRow label="کل زمان" value={formatTime(totalTime)} />}
            {servings && <TimingRow label="مناسب برای" value={`${servings} نفر`} />}
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
      <Text size="xs" fw={600}>{value}</Text>
    </Group>
  );
}
