import { useState } from 'react';
import { Paper, Group, Text, Box, SimpleGrid } from '@mantine/core';
import { IconChefHat, IconArrowDown } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { NutritionBadge } from '../../../../components/ges';
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

  const rows = [
    calories > 0 && { label: 'کالری', value: `${calories} کیلوکالری` },
    protein > 0 && { label: 'پروتئین', value: `${protein} گرم` },
    fat > 0 && { label: 'چربی', value: `${fat} گرم` },
    carbs > 0 && { label: 'کربوهیدرات', value: `${carbs} گرم` },
    fiber > 0 && { label: 'فیبر', value: `${fiber} گرم` },
  ].filter(Boolean);

  return (
    <Paper
      p="md"
      radius="lg"
      mb="lg"
      style={{
        background: 'var(--g-color-bg-surface)',
        border: '1px solid var(--g-color-border-subtle)',
        cursor: 'pointer',
      }}
      onClick={toggle}
    >
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <IconChefHat size={20} color="var(--g-color-food-saffron)" aria-hidden="true" />
          <Text size="sm" fw={700} c="var(--g-color-text-primary)">ارزش غذایی تقریبی</Text>
          {/* Source/confidence on every nutrition number — these are estimates, never medical certainty */}
          <NutritionBadge state="estimate" label="تخمینی" />
        </Group>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }}>
          <IconArrowDown size={18} color="var(--g-color-text-muted)" aria-hidden="true" />
        </motion.div>
      </Group>
      {open && (
        <Box mt="md">
          <SimpleGrid cols={2} spacing="xs">
            {rows.map((row) => (
              <Paper key={row.label} p="xs" radius="md" style={{ border: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-canvas)' }}>
                <Text size="xs" c="var(--g-color-text-muted)">{row.label}</Text>
                <Text size="sm" fw={700} c="var(--g-color-text-primary)">{row.value}</Text>
              </Paper>
            ))}
          </SimpleGrid>
          <Text size="xs" c="var(--g-color-text-secondary)" mt="sm" style={{ lineHeight: 1.7 }}>
            این مقادیر تخمینی هستند و برای رژیم درمانی یا تصمیم پزشکی استفاده نمی‌شوند.
          </Text>
        </Box>
      )}
    </Paper>
  );
}
