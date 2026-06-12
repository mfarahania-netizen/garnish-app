import { Accordion, Group, Text, Badge, Stack, Paper, Box } from '@mantine/core';
import { IconToolsKitchen } from '@tabler/icons-react';
import { getIngredientEmoji } from './helpers';

export default function IngredientsSection({ ingredients }) {
  if (!ingredients?.length) return null;

  const cleanInternalJson = (value) => {
    if (typeof value !== 'string') return value || '';
    const trimmed = value.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return trimmed;
    try {
      const parsed = JSON.parse(trimmed);
      return parsed.preparation || parsed.line || '';
    } catch {
      return '';
    }
  };

  const formatAmount = (ingredient) => {
    const amount = ingredient.amount;
    const unit = ingredient.displayUnit || ingredient.unit;
    if (amount == null || amount === '') return '';
    return [amount, unit].filter(Boolean).join(' ');
  };

  return (
    <Accordion.Item value="ingredients">
      <Accordion.Control>
        <Group justify="space-between" style={{ width: '100%' }}>
          <Group gap="xs">
            <IconToolsKitchen size={20} color="#FF6B35" />
            <Text fw={700} size="sm">مواد اولیه</Text>
          </Group>
          <Badge variant="light" color="orange" size="sm">{ingredients.length} قلم</Badge>
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        <Stack gap="sm">
          {ingredients.map((ingredient, idx) => {
            const amount = formatAmount(ingredient);
            const note = cleanInternalJson(ingredient.preparation || ingredient.notes);

            return (
              <Paper
                key={ingredient.id || idx}
                p="sm"
                radius="md"
                style={{
                  borderRight: '4px solid #FF6B35',
                  background: 'rgba(255,255,255,0.86)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <Group gap={12} wrap="nowrap" align="flex-start">
                  <Text style={{ fontSize: '1.7rem', lineHeight: 1.2 }}>{getIngredientEmoji(ingredient.name)}</Text>
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Group justify="space-between" gap="xs" wrap="nowrap" align="flex-start">
                      <Text size="sm" fw={700} style={{ lineHeight: 1.7, overflowWrap: 'anywhere' }}>{ingredient.name}</Text>
                      {amount && (
                        <Badge variant="light" color="orange" size="sm" style={{ flexShrink: 0 }}>
                          {amount}
                        </Badge>
                      )}
                    </Group>
                    {note && (
                      <Text size="xs" c="dimmed" mt={4} style={{ lineHeight: 1.7 }}>
                        {note}
                      </Text>
                    )}
                  </Box>
                </Group>
              </Paper>
            );
          })}
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
  );
}
