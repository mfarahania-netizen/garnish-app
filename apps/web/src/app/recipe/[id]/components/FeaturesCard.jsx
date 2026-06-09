// apps/web/src/app/recipe/[id]/components/FeaturesCard.jsx
import { useState } from 'react';
import { Paper, Group, Text, Box, SimpleGrid, ThemeIcon } from '@mantine/core';
import {
  IconInfoCircle, IconArrowDown, IconFlame, IconLeaf, IconFlameFilled,
  IconCoin, IconCalendarEvent, IconExclamationCircle, IconSun, IconSunset, IconMoon
} from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { useAnalytics } from '../../../../hooks/useAnalytics';
import { EventType } from '../../../../lib/eventTaxonomy';
import { difficultyColor, costColor, regionLabel, mealTypeLabel } from './helpers';

export default function FeaturesCard({ recipe }) {
  const { trackEvent } = useAnalytics();
  const [open, setOpen] = useState(false);
  const { region, difficulty, diet, cost, mealType, occasion = [], allergens = [] } = recipe;
  const mealTypes = mealTypeLabel(mealType);

  const toggle = () => {
    const eventType = open ? EventType.FEATURES_COLLAPSE : EventType.FEATURES_EXPAND;
    trackEvent(eventType, { recipeId: recipe.id });
    setOpen(prev => !prev);
  };

  // نگاشت string به کامپوننت
  const iconMap = {
    IconSun: IconSun,
    IconSunset: IconSunset,
    IconMoon: IconMoon,
  };

  return (
    <Paper p="md" radius="lg" mb="lg" style={{ background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(10px)', border: '1px solid rgba(0,0,0,0.05)', cursor: 'pointer' }} onClick={toggle}>
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <IconInfoCircle size={20} color="#FF6B35" />
          <Text size="sm" fw={600} c="#1A237E">ویژگی‌های غذا</Text>
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
                color={diet === 'vegetarian' ? 'green' : 'blue'}
                icon={diet === 'vegetarian' ? <IconLeaf size={12} /> : <IconFlameFilled size={12} />}
                label="رژیم"
                value={diet === 'vegetarian' ? 'گیاهی' : diet}
              />
            )}
            {cost && (
              <FeatureBadge color={costColor(cost)} icon={<IconCoin size={12} />} label="هزینه" value={cost} />
            )}
            {mealTypes.map((m, idx) => {
              const IconComponent = m.icon ? iconMap[m.icon] : null;
              return (
                <FeatureBadge
                  key={idx}
                  color={m.color}
                  icon={IconComponent ? <IconComponent size={12} /> : <IconInfoCircle size={12} />}
                  label="وعده"
                  value={m.label}
                />
              );
            })}
            {occasion.map((occ, idx) => (
              <FeatureBadge key={idx} color="violet" icon={<IconCalendarEvent size={12} />} label="مناسبت" value={occ} />
            ))}
            {allergens.map((a, idx) => (
              <FeatureBadge key={idx} color="red" icon={<IconExclamationCircle size={12} />} label="آلرژن" value={a} />
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
      <Group gap="xs" wrap="nowrap">
        <ThemeIcon size="sm" radius="md" color={color} variant="light">{icon}</ThemeIcon>
        <div>
          <Text size="xs" c="dimmed">{label}</Text>
          <Text size="xs" fw={500}>{value}</Text>
        </div>
      </Group>
    </Paper>
  );
}