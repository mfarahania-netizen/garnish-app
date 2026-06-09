// apps/web/src/app/recipe/[id]/components/NutritionCard.jsx
import { useState } from 'react';
import { Paper, Group, Text, Box, SimpleGrid } from '@mantine/core';
import { IconChefHat, IconArrowDown } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { useAnalytics } from '../../../../hooks/useAnalytics';
import { EventType } from '../../../../lib/eventTaxonomy';

const extractNum = (str) => { const n = parseInt(str, 10); return isNaN(n) ? 0 : n; };

export default function NutritionCard({ recipe }) {
  const { trackEvent } = useAnalytics();
  const [open, setOpen] = useState(false);
  const { nutrition } = recipe;
  if (!nutrition) return null;

  const calVal = nutrition?.کالری ? extractNum(nutrition.کالری) : 0;
  const protVal = nutrition?.پروتئین ? extractNum(nutrition.پروتئین) : 0;
  const fatVal = nutrition?.چربی ? extractNum(nutrition.چربی) : 0;
  const carbVal = nutrition?.کربوهیدرات ? extractNum(nutrition.کربوهیدرات) : 0;
  if (!calVal && !protVal && !fatVal && !carbVal) return null;

  const toggle = () => {
    const eventType = open ? EventType.NUTRITION_COLLAPSE : EventType.NUTRITION_EXPAND;
    trackEvent(eventType, { recipeId: recipe.id });
    setOpen(prev => !prev);
  };

  return (
    <Paper p="md" radius="lg" mb="lg" style={{ background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(10px)', border: '1px solid rgba(76,175,80,0.2)', cursor: 'pointer' }} onClick={toggle}>
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <IconChefHat size={20} color="#4CAF50" />
          <Text size="sm" fw={600} c="#1A237E">ارزش غذایی</Text>
        </Group>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }}>
          <IconArrowDown size={18} color="#666" />
        </motion.div>
      </Group>
      {open && (
        <Box mt="md">
          <SimpleGrid cols={2} spacing="xs">
            {calVal > 0 && <NutritionBadge label="🔥 کالری" value={`${calVal} کیلوکالری`} color="#FF6B35" />}
            {protVal > 0 && <NutritionBadge label="🥩 پروتئین" value={`${protVal} گرم`} color="#1A237E" />}
            {fatVal > 0 && <NutritionBadge label="🧈 چربی" value={`${fatVal} گرم`} color="#1A237E" />}
            {carbVal > 0 && <NutritionBadge label="🍚 کربوهیدرات" value={`${carbVal} گرم`} color="#1A237E" />}
          </SimpleGrid>
        </Box>
      )}
    </Paper>
  );
}

function NutritionBadge({ label, value, color }) {
  return (
    <Paper p="xs" radius="md" withBorder style={{ borderColor: '#eee' }}>
      <Text size="xs" c="dimmed">{label}</Text>
      <Text size="sm" fw={700} c={color}>{value}</Text>
    </Paper>
  );
}