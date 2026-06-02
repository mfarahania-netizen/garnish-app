import { useState } from 'react';
import { Modal, TextInput, Paper, Text, ScrollArea, Badge, Group, Highlight } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useRecipeContext } from '../../../context/RecipeContext';
import { useMantineColorScheme } from '@mantine/core';

export default function RecipePickerModal({ opened, onClose, onSelect }) {
  const { recipes } = useRecipeContext();
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? recipes.filter(r => {
        const title = r.title || '';
        const ings = (r.ingredients || []).join(' ');
        return title.includes(search) || ings.includes(search);
      })
    : recipes;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="🍽️ انتخاب غذا"
      centered
      size="sm"
      styles={{
        title: { color: dark ? '#fff' : '#333' },
        content: { backgroundColor: dark ? '#1e1e24' : '#fff' },
      }}
    >
      <TextInput
        placeholder="جستجوی غذا..."
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        mb="md"
      />

      <ScrollArea.Autosize mah={400}>
        {filtered.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            غذایی یافت نشد.
          </Text>
        ) : (
          filtered.map(recipe => (
            <Paper
              key={recipe.id}
              p="sm"
              mb="xs"
              withBorder
              radius="md"
              style={{
                cursor: 'pointer',
                backgroundColor: dark ? '#25252b' : '#fafafa',
                transition: 'all 0.2s',
              }}
              onClick={() => {
                onSelect(recipe.id);
                onClose();
              }}
            >
              <Group justify="space-between" wrap="nowrap" mb={4}>
                <Highlight
                  highlight={search}
                  size="sm"
                  fw={500}
                  c={dark ? '#fff' : '#1A237E'}
                >
                  {recipe.title}
                </Highlight>
                <Group gap="xs">
                  {recipe.cook_time && (
                    <Badge variant="light" color="orange" size="xs">
                      ⏱ {recipe.cook_time}
                    </Badge>
                  )}
                  {recipe.difficulty && (
                    <Badge variant="light" color="blue" size="xs">
                      📊 {recipe.difficulty}
                    </Badge>
                  )}
                </Group>
              </Group>
              <Text size="xs" c="dimmed" lineClamp={1}>
                {(recipe.ingredients || []).join('، ')}
              </Text>
            </Paper>
          ))
        )}
      </ScrollArea.Autosize>
    </Modal>
  );
}