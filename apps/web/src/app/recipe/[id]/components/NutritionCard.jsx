import { useState } from 'react';
import { Paper, Group, Text, Box, SimpleGrid } from '@mantine/core';
import { IconChefHat, IconArrowDown } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { useAnalytics } from '../../../../hooks/useAnalytics';
import { EventType } from '../../../../lib/eventTaxonomy';

const numberValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function NutritionCard({ recipe }) {
  const { trackEvent } = useAnalytics();
  const [open, setOpen] = useState(false);
  const nutrition = recipe.nutrition;
  if (!nutrition) return null;

  const calories = numberValue(nutrition.calories);
  const protein = numberValue(nutrition.protein);
  const fat = numberValue(nutrition.fat);
  const carbs = numberValue(nutrition.carbs);
  const fiber = numberValue(nutrition.fiber);
  if (!calories && !protein && !fat && !carbs && !fiber) return null;

  const toggle = () => {
    const eventType = open ? EventType.NUTRITION_COLLAPSE : EventType.NUTRITION_EXPAND;
    trackEvent(eventType, { recipeId: recipe.id });
    setOpen((prev) => !prev);
  };

  return (
    <Paper
      p="md"
      radius="lg"
      mb="lg"
      style={{
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(76,175,80,0.2)',
        cursor: 'pointer',
      }}
      onClick={toggle}
    >
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <IconChefHat size={20} color="#4CAF50" />
          <Text size="sm" fw={700} c="#1A237E">ارزش غذایی تقریبی</Text>
        </Group>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }}>
          <IconArrowDown size={18} color="#666" />
        </motion.div>
      </Group>
      {open && (
        <Box mt="md">
          <SimpleGrid cols={2} spacing="xs">
            {calories > 0 && <NutritionBadge label="کالری" value={`${calories} کیلوکالری`} color="#FF6B35" />}
            {protein > 0 && <NutritionBadge label="پروتئین" value={`${protein} گرم`} color="#1A237E" />}
            {fat > 0 && <NutritionBadge label="چربی" value={`${fat} گرم`} color="#1A237E" />}
            {carbs > 0 && <NutritionBadge label="کربوهیدرات" value={`${carbs} گرم`} color="#1A237E" />}
            {fiber > 0 && <NutritionBadge label="فیبر" value={`${fiber} گرم`} color="#4CAF50" />}
          </SimpleGrid>
          <Text size="xs" c="dimmed" mt="sm" style={{ lineHeight: 1.7 }}>
            این مقادیر تخمینی هستند و برای رژیم درمانی یا تصمیم پزشکی استفاده نمی‌شوند.
          </Text>
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
