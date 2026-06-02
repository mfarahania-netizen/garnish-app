// TODO
import { Paper, Group, Text, ActionIcon, Tooltip } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { getMealEmoji } from '../services/planHelpers';

export default function MealSlot({ day, meal, recipeTitle, onOpenPicker, onRemove, dark }) {
  return (
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
      <Paper
        p="xs"
        mb="xs"
        radius="md"
        withBorder
        style={{
          cursor: 'pointer',
          backgroundColor: recipeTitle ? (dark ? 'rgba(255,255,255,0.05)' : '#f9f9fb') : 'transparent',
          borderColor: recipeTitle ? '#FF6B35' : undefined,
          minHeight: 52,
        }}
        onClick={() => onOpenPicker(day, meal)}
      >
        <Group justify="space-between" wrap="nowrap">
          <Group gap={4} wrap="nowrap">
            <Text size="sm">{getMealEmoji(meal)}</Text>
            <Text size="xs" fw={500} c={dark ? 'white' : '#333'}>
              {meal}
            </Text>
          </Group>
          {recipeTitle ? (
            <Tooltip label="حذف">
              <ActionIcon
                size="xs"
                variant="subtle"
                color="red"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(day, meal);
                }}
              >
                <IconTrash size={12} />
              </ActionIcon>
            </Tooltip>
          ) : (
            <IconPlus size={16} color="#ccc" />
          )}
        </Group>
        {recipeTitle && (
          <Text size="xs" c="dimmed" mt={4} lineClamp={1}>
            {recipeTitle}
          </Text>
        )}
      </Paper>
    </motion.div>
  );
}