import { Text, Stack } from '@mantine/core';

export default function TipsSection({ textColor }) {
  return (
    <Stack gap="sm">
      <Text c={textColor}>بخش نکات و ترفندها (در نسخه‌های بعدی تکمیل می‌شود)</Text>
    </Stack>
  );
}