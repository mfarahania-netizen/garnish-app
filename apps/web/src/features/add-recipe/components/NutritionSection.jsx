import { Text, Stack } from '@mantine/core';

export default function NutritionSection({ textColor }) {
  return (
    <Stack gap="sm">
      <Text c={textColor}>بخش ارزش غذایی (در نسخه‌های بعدی تکمیل می‌شود)</Text>
    </Stack>
  );
}