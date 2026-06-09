// apps/web/src/app/recipe/[id]/components/StepsSection.jsx
import { Accordion, Group, Text, Badge, Box, Stack, ThemeIcon } from '@mantine/core';
import { IconChefHat } from '@tabler/icons-react';
import { motion } from 'framer-motion';

export default function StepsSection({ steps }) {
  if (!steps?.length) return null;
  return (
    <Accordion.Item value="steps">
      <Accordion.Control>
        <Group justify="space-between" style={{ width: '100%' }}>
          <Group gap="xs">
            <IconChefHat size={20} color="#FF6B35" />
            <Text fw={600} size="sm">مراحل پخت</Text>
          </Group>
          <Badge variant="light" color="orange" size="sm">{steps.length} مرحله</Badge>
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        <Box style={{ position: 'relative', paddingRight: 36 }}>
          <div style={{ position: 'absolute', top: 10, right: 16, bottom: 10, width: 2, background: 'linear-gradient(to bottom, #FF6B35, #1A237E)' }} />
          <Stack gap="xl">
            {steps.map((step, idx) => (
              <motion.div key={idx} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}>
                <Box style={{ position: 'relative' }}>
                  <ThemeIcon size={28} radius="xl" variant="gradient" gradient={{ from: 'orange', to: 'red' }}
                    style={{ position: 'absolute', right: -36, top: 0 }}>
                    <Text size="xs" fw={800}>{idx + 1}</Text>
                  </ThemeIcon>
                  {/* 👇 رندر instruction به‌جای خود step */}
                  <Text size="sm" style={{ lineHeight: 1.8 }}>
                    {typeof step === 'string' ? step : step.instruction}
                  </Text>
                </Box>
              </motion.div>
            ))}
          </Stack>
        </Box>
      </Accordion.Panel>
    </Accordion.Item>
  );
}