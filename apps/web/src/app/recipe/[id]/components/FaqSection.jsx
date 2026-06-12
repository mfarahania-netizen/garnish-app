import { Accordion, Group, Text, Badge, Stack, Paper } from '@mantine/core';
import { IconQuestionMark } from '@tabler/icons-react';

export default function FaqSection({ faq }) {
  let parsedFaq = faq;
  if (typeof faq === 'string') {
    try {
      parsedFaq = JSON.parse(faq);
    } catch {
      parsedFaq = [];
    }
  }
  if (!Array.isArray(parsedFaq) || parsedFaq.length === 0) return null;

  return (
    <Accordion.Item value="faq">
      <Accordion.Control>
        <Group justify="space-between" style={{ width: '100%' }}>
          <Group gap="xs">
            <IconQuestionMark size={20} color="#FF6B35" />
            <Text fw={700} size="sm">سوالات متداول</Text>
          </Group>
          <Badge variant="light" color="orange" size="sm">{parsedFaq.length} پرسش</Badge>
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        <Stack gap="sm">
          {parsedFaq.map((faqItem, idx) => (
            <Paper key={idx} p="sm" radius="md" withBorder style={{ background: 'rgba(255,255,255,0.75)' }}>
              <Group gap={6} align="flex-start" wrap="nowrap" mb={6}>
                <Text style={{ fontSize: '1.1rem' }}>؟</Text>
                <Text size="sm" fw={700} style={{ lineHeight: 1.6 }}>
                  {typeof faqItem === 'string' ? faqItem : faqItem.question}
                </Text>
              </Group>
              {faqItem.answer && (
                <Text size="xs" c="dimmed" style={{ lineHeight: 1.8, paddingRight: 30 }}>
                  {faqItem.answer}
                </Text>
              )}
            </Paper>
          ))}
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
  );
}
