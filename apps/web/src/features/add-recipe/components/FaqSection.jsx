import { Text, Stack } from '@mantine/core';

export default function FaqSection({ textColor }) {
  return (
    <Stack gap="sm">
      <Text c={textColor}>بخش سوالات متداول (در نسخه‌های بعدی تکمیل می‌شود)</Text>
    </Stack>
  );
}