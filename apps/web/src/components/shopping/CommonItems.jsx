import { Text, Group } from '@mantine/core';
import { IconCircleFilled } from '@tabler/icons-react';

export default function CommonItems({ items, onSelect, dark }) {
  if (!items?.length) return null;

  return (
    <div style={{ marginTop: 10 }}>
      <Text size="xs" c="dimmed" mb={6}>🔹 پرتکرارهای شما:</Text>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
        {items.slice(0, 10).map((item, index) => (
          <span
            key={index}
            onClick={() => onSelect(item.name)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              cursor: 'pointer',
              fontSize: 13,
              color: dark ? '#ddd' : '#333',
              fontWeight: 400,
              transition: 'color 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            <IconCircleFilled size={6} style={{ marginLeft: 6, color: '#FF6B35' }} />
            {item.name}
            {index < Math.min(items.length, 10) - 1 && <span style={{ marginLeft: 2 }}>•</span>}
          </span>
        ))}
      </div>
    </div>
  );
}