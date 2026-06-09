// apps/web/src/app/recipe/[id]/components/IngredientsSection.jsx
import { Accordion, Group, Text, Badge, Stack, Paper, Box } from '@mantine/core';
import { IconToolsKitchen } from '@tabler/icons-react';
import { getIngredientEmoji } from './helpers';

export default function IngredientsSection({ ingredients }) {
  if (!ingredients?.length) return null;
  return (
    <Accordion.Item value="ingredients">
      <Accordion.Control>
        <Group justify="space-between" style={{ width: '100%' }}>
          <Group gap="xs">
            <IconToolsKitchen size={20} color="#FF6B35" />
            <Text fw={600} size="sm">مواد اولیه</Text>
          </Group>
          <Badge variant="light" color="orange" size="sm">{ingredients.length} قلم</Badge>
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        <Stack gap="sm">
          {ingredients.map((ing, idx) => (
            <Paper key={idx} p="sm" radius="md" style={{ borderRight: '4px solid #FF6B35', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(4px)' }}>
              <Group gap={12} wrap="nowrap">
                <Text style={{ fontSize: '1.8rem' }}>{getIngredientEmoji(ing.name)}</Text>
                <Box style={{ flex: 1 }}>
                  <Text size="sm" fw={600}>{ing.name}</Text>
                  {ing.amount && <Text size="xs" c="dimmed" mt={2}>{ing.amount}</Text>}
                  {ing.notes && <Text size="xs" fs="italic" c="gray.5" mt={2}>{ing.notes}</Text>}
                </Box>
              </Group>
            </Paper>
          ))}
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
  );
}