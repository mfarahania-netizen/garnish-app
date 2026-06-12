import { Group, Text, Checkbox, ActionIcon } from '@mantine/core';
import { IconPlus, IconMinus, IconTrash, IconEdit, IconAlertTriangle } from '@tabler/icons-react';
import { motion } from 'framer-motion';

export default function ShoppingItem({ item, onToggle, onChangeQty, onDelete, onEdit, isAllergen, emoji, dark }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ duration: 0.15 }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDragEnd={(_, info) => {
        if (info.offset.x > 80) onDelete(item.id);
      }}
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      <Group justify="space-between" mb={6} wrap="nowrap">
        <Group gap={8} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <Checkbox checked={item.checked} onChange={() => onToggle(item.id)} size="sm" />
          <Text size="lg" style={{ minWidth: 28, textAlign: 'center' }}>{emoji}</Text>
          <Text
            size="sm"
            style={{
              flex: 1,
              textDecoration: item.checked ? 'line-through' : 'none',
              color: item.checked ? '#999' : (isAllergen ? '#e03131' : dark ? '#fff' : '#333'),
              cursor: 'pointer',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: isAllergen ? 500 : 400,
            }}
            onDoubleClick={() => onEdit(item.id)}
          >
            {item.name}
            {isAllergen && <IconAlertTriangle size={14} color="#e03131" style={{ marginLeft: 6, verticalAlign: 'middle' }} />}
          </Text>
        </Group>
        <Group gap={2} wrap="nowrap" style={{ flexShrink: 0 }}>
          <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap', minWidth: 55, textAlign: 'center' }}>
            {item.qty} {item.unit}
          </Text>
          <ActionIcon size="xs" variant="subtle" color="green" onClick={() => onChangeQty(item.id, 0.5)}>
            <IconPlus size={11} />
          </ActionIcon>
          <ActionIcon size="xs" variant="subtle" color="red" onClick={() => onChangeQty(item.id, -0.5)}>
            <IconMinus size={11} />
          </ActionIcon>
          <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => onEdit(item.id)}>
            <IconEdit size={11} />
          </ActionIcon>
          <ActionIcon size="xs" variant="subtle" color="red" onClick={() => onDelete(item.id)}>
            <IconTrash size={11} />
          </ActionIcon>
        </Group>
      </Group>
    </motion.div>
  );
}
