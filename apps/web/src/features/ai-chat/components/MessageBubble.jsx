import { Box, Text, Paper, Stack, ThemeIcon, Badge, Group } from '@mantine/core';
import { IconClock, IconFlame } from '@tabler/icons-react';
import { motion } from 'framer-motion';

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 12,
        padding: '0 8px',
      }}
    >
      <Paper
        radius="lg"
        p="sm"
        style={{
          maxWidth: '85%',
          background: isUser ? '#1A237E' : '#fff',
          color: isUser ? 'white' : '#000',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <Text size="sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
          {message.content}
        </Text>

        {/* رسپی‌های پیشنهادی */}
        {message.recipes?.length > 0 && (
          <Stack mt="sm" gap="xs">
            {message.recipes.map((r, idx) => (
              <Paper key={idx} p="xs" radius="md" withBorder>
                <Text size="sm" fw={600}>{r.title}</Text>
                <Group gap="xs" mt={4}>
                  {r.cookTime && (
                    <Badge size="xs" variant="light" leftSection={<IconClock size={10} />}>
                      {r.cookTime}
                    </Badge>
                  )}
                  {r.difficulty && (
                    <Badge size="xs" variant="light" leftSection={<IconFlame size={10} />}>
                      {r.difficulty}
                    </Badge>
                  )}
                </Group>
                {r.missingIngredients?.length > 0 && (
                  <Text size="xs" c="orange.6" mt={4}>
                    🛒 مواد اضافی: {r.missingIngredients.join('، ')}
                  </Text>
                )}
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>
    </motion.div>
  );
}