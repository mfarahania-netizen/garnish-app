import { Paper, Text, Stack, ThemeIcon } from '@mantine/core';
import { IconPhoto } from '@tabler/icons-react';

export default function MediaSection({ dark }) {
  return (
    <Paper
      p="xl"
      withBorder
      radius="md"
      style={{
        borderStyle: 'dashed',
        borderColor: dark ? '#444' : '#ddd',
        backgroundColor: dark ? '#2a2a2a' : '#fafafa',
      }}
    >
      <Stack align="center" gap="sm">
        <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
          <IconPhoto size={24} />
        </ThemeIcon>
        <Text size="sm" fw={500} c={dark ? '#ccc' : '#555'}>
          بخش آپلود عکس و ویدیو
        </Text>
        <Text size="xs" c="dimmed">
          این قابلیت به‌زودی اضافه می‌شود
        </Text>
      </Stack>
    </Paper>
  );
}