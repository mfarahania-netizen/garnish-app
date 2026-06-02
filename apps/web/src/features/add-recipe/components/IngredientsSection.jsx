import { useState } from 'react';
import { TextInput, Button, Group, Paper, Text, Stack, ActionIcon } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';

export default function IngredientsSection({ textColor, ingredients, setIngredients }) {
  const [name, setName] = useState('');

  const addIngredient = () => {
    if (!name.trim()) return;
    setIngredients([...ingredients, { name: name.trim() }]);
    setName('');
  };

  return (
    <Stack gap="sm">
      <Text c={textColor} fw={500}>مواد اولیه</Text>
      <Group gap="xs" wrap="nowrap">
        <TextInput
          placeholder="نام ماده"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ flex: 1 }}
          onKeyDown={(e) => e.key === 'Enter' && addIngredient()}
        />
        <Button variant="light" leftSection={<IconPlus size={16} />} onClick={addIngredient}>
          افزودن
        </Button>
      </Group>
      {ingredients.length > 0 && (
        <Stack gap="xs">
          {ingredients.map((ing, idx) => (
            <Paper key={idx} p="xs" withBorder radius="md">
              <Group justify="space-between">
                <Text size="sm">{ing.name}</Text>
                <ActionIcon variant="subtle" color="red" onClick={() => {
                  const updated = ingredients.filter((_, i) => i !== idx);
                  setIngredients(updated);
                }}>
                  <IconTrash size={14} />
                </ActionIcon>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}