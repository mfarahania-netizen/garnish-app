import { useState } from 'react';
import { Paper, Group, Text, Box, SimpleGrid, ThemeIcon } from '@mantine/core';
import {
  IconInfoCircle,
  IconArrowDown,
  IconFlame,
  IconLeaf,
  IconFlameFilled,
  IconCoin,
  IconCalendarEvent,
  IconExclamationCircle,
  IconSun,
  IconSunset,
  IconMoon,
} from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { useAnalytics } from '../../../../hooks/useAnalytics';
import { EventType } from '../../../../lib/eventTaxonomy';
import { difficultyColor, costColor, regionLabel, mealTypeLabel } from './helpers';

const normalizeList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [value];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
};

export default function FeaturesCard({ recipe }) {
  const { trackEvent } = useAnalytics();
  const [open, setOpen] = useState(false);
  const { region, difficulty, diet, cost, mealType } = recipe;
  const mealTypes = mealTypeLabel(mealType);
  const occasions = normalizeList(recipe.occasion).slice(0, 4);
  const allergens = normalizeList(recipe.allergens).slice(0, 4);

  const toggle = () => {
    const eventType = open ? EventType.FEATURES_COLLAPSE : EventType.FEATURES_EXPAND;
    trackEvent(eventType, { recipeId: recipe.id });
    setOpen((prev) => !prev);
  };

  const iconMap = {
    IconSun,
    IconSunset,
    IconMoon,
  };

  return (
    <Paper
      p="md"
      radius="lg"
      mb="lg"
      style={{
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(0,0,0,0.05)',
        cursor: 'pointer',
      }}
      onClick={toggle}
    >
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <IconInfoCircle size={20} color="#FF6B35" />
          <Text size="sm" fw={700} c="#1A237E">ویژگی‌های غذا</Text>
        </Group>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }}>
          <IconArrowDown size={18} color="#666" />
        </motion.div>
      </Group>
      {open && (
        <Box mt="md">
          <SimpleGrid cols={2} spacing="sm">
            {region && (
              <FeatureBadge color="teal" icon={<IconInfoCircle size={12} />} label="منطقه" value={regionLabel(region)} />
            )}
            {difficulty && (
              <FeatureBadge color={difficultyColor(difficulty)} icon={<IconFlame size={12} />} label="سطح سختی" value={difficulty} />
            )}
            {diet && (
              <FeatureBadge
                color={diet === 'vegetarian' || diet === 'vegan' ? 'green' : 'blue'}
                icon={diet === 'vegetarian' || diet === 'vegan' ? <IconLeaf size={12} /> : <IconFlameFilled size={12} />}
                label="رژیم"
                value={diet === 'vegetarian' ? 'گیاهی' : diet === 'vegan' ? 'وگان' : diet}
              />
            )}
            {cost && (
              <FeatureBadge color={costColor(cost)} icon={<IconCoin size={12} />} label="هزینه" value={cost} />
            )}
            {mealTypes.map((meal, idx) => {
              const IconComponent = meal.icon ? iconMap[meal.icon] : null;
              return (
                <FeatureBadge
                  key={`${meal.label}-${idx}`}
                  color={meal.color}
                  icon={IconComponent ? <IconComponent size={12} /> : <IconInfoCircle size={12} />}
                  label="وعده"
                  value={meal.label}
                />
              );
            })}
            {occasions.map((occasion, idx) => (
              <FeatureBadge key={`${occasion}-${idx}`} color="violet" icon={<IconCalendarEvent size={12} />} label="مناسب برای" value={occasion} />
            ))}
            {allergens.map((allergen, idx) => (
              <FeatureBadge key={`${allergen}-${idx}`} color="red" icon={<IconExclamationCircle size={12} />} label="آلرژن" value={allergen} />
            ))}
          </SimpleGrid>
        </Box>
      )}
    </Paper>
  );
}

function FeatureBadge({ color, icon, label, value }) {
  return (
    <Paper p="xs" radius="md" withBorder style={{ borderColor: '#eee' }}>
      <Group gap="xs" wrap="nowrap" align="flex-start">
        <ThemeIcon size="sm" radius="md" color={color} variant="light" style={{ flexShrink: 0 }}>{icon}</ThemeIcon>
        <div style={{ minWidth: 0 }}>
          <Text size="xs" c="dimmed">{label}</Text>
          <Text size="xs" fw={600} style={{ overflowWrap: 'anywhere' }}>{value}</Text>
        </div>
      </Group>
    </Paper>
  );
}
