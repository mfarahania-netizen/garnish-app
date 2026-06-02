import { useState, useMemo, useCallback } from 'react';
import { TextInput, Popover, ScrollArea, Text } from '@mantine/core';
import { IconSearch, IconPlus } from '@tabler/icons-react';
import { INGREDIENTS_500 } from '../../data/commonIngredients';
import { normalize } from '../../data/shoppingConstants';
import { useMantineColorScheme } from '@mantine/core';

export default function IngredientSearch({ onAdd }) {
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';

  const filtered = useMemo(() => {
    if (!value.trim()) return INGREDIENTS_500.slice(0, 20);
    const q = normalize(value);
    return INGREDIENTS_500
      .filter(ing => normalize(ing.name).includes(q))
      .slice(0, 15);
  }, [value]);

  const handleSelect = useCallback((ing) => {
    onAdd(ing.name);
    setValue('');
    setOpen(false);
  }, [onAdd]);

  return (
    <Popover opened={open} onChange={setOpen} width="target" position="bottom" shadow="md">
      <Popover.Target>
        <TextInput
          placeholder="جستجوی ۵۰۰ ماده غذایی رایج..."
          leftSection={<IconSearch size={18} />}
          value={value}
          onChange={(e) => { setValue(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          styles={{
            input: {
              textAlign: 'right',
              height: 46,
              fontSize: 15,
              borderRadius: 14,
              backgroundColor: dark ? '#2a2a2a' : '#fff',
              color: dark ? '#fff' : '#000',
            },
          }}
        />
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <ScrollArea.Autosize mah={300} mx="auto">
          {filtered.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="md">ماده‌ای یافت نشد</Text>
          ) : (
            filtered.map((ing, idx) => (
              <div
                key={idx}
                onClick={() => handleSelect(ing)}
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  borderBottom: '1px solid #f0f0f0',
                  transition: 'background 0.15s',
                }}
              >
                <Text size="lg">{ing.emoji}</Text>
                <div style={{ flex: 1 }}>
                  <Text size="sm">{ing.name}</Text>
                  <Text size="xs" c="dimmed">{ing.category}</Text>
                </div>
                <IconPlus size={16} color="#FF6B35" />
              </div>
            ))
          )}
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
}