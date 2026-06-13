import { Box, Text, Group, Paper, ThemeIcon, Stack } from '@mantine/core';
import { IconMessage, IconChefHat, IconBulb, IconSalad } from '@tabler/icons-react';

const SUGGESTIONS = [
  { icon: <IconMessage size={20} />, text: 'با مرغ و برنج چی بپزم؟', color: 'orange' },
  { icon: <IconSalad size={20} />, text: 'با مواد توی خونه چی بپزم؟', color: 'blue' },
  { icon: <IconChefHat size={20} />, text: 'یه غذای سریع برای ناهار', color: 'green' },
  { icon: <IconBulb size={20} />, text: 'جایگزین تخم‌مرغ چیه؟', color: 'grape' },
];

export default function EmptyState({ onSuggestionClick }) {
  return (
    <Box ta="center" py={40} px={20}>
      <Text style={{ fontSize: 64 }} mb="md">🧑‍🍳</Text>
      <Text fw={600} size="lg" mb="sm">به دستیار هوشمند گارنیش خوش آمدید!</Text>
      <Text size="sm" c="dimmed" mb="xl">
        مواد اولیه‌ای که دارید را بنویسید تا بهترین غذاها را پیشنهاد دهم.
        همچنین می‌توانید سوالات آشپزی بپرسید.
      </Text>
      <Stack gap="sm" align="center">
        {SUGGESTIONS.map((s, i) => (
          <Paper
            key={i}
            p="sm"
            radius="xl"
            withBorder
            style={{ cursor: 'pointer', maxWidth: 320, width: '100%' }}
            onClick={() => onSuggestionClick(s.text)}
          >
            <Group gap="sm" justify="center">
              <ThemeIcon radius="xl" size="md" color={s.color} variant="light">
                {s.icon}
              </ThemeIcon>
              <Text size="sm">{s.text}</Text>
            </Group>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}