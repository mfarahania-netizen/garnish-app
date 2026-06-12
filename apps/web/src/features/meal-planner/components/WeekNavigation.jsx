import { ActionIcon, Group, Text } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

export default function WeekNavigation({ currentWeekLabel, onPrev, onNext, dark }) {
  return (
    <Group justify="center" mb="md" gap="xs">
      <ActionIcon variant="subtle" onClick={onPrev}>
        <IconChevronRight size={20} />
      </ActionIcon>
      <Text size="sm" fw={500} c={dark ? 'white' : '#333'}>
        {currentWeekLabel}
      </Text>
      <ActionIcon variant="subtle" onClick={onNext}>
        <IconChevronLeft size={20} />
      </ActionIcon>
    </Group>
  );
}
