import { Paper, Title, Text, Group, Badge, ThemeIcon } from '@mantine/core';
import { IconSun, IconSunset, IconMoonStars, IconClock, IconChefHat } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { MEALS } from '../services/planHelpers';

const mealIcons = {
  'صبحانه': <IconSun size={20} />,
  'ناهار': <IconSunset size={20} />,
  'شام': <IconMoonStars size={20} />,
};

const mealColors = {
  'صبحانه': 'yellow',
  'ناهار': 'orange',
  'شام': 'indigo',
};

export default function TodayDashboard({ today, getRecipeData, onOpenPicker, dark }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Paper
        p="lg"
        radius="xl"
        mb="md"
        style={{
          background: dark
            ? 'linear-gradient(135deg, #1A237E, #283593)'
            : 'linear-gradient(135deg, #FF6B35, #FF8A65)',
          color: 'white',
        }}
      >
        <Group justify="space-between" mb="lg">
          <div>
            <Text size="xs" opacity={0.8}>امروز</Text>
            <Title order={3}>{today}</Title>
          </div>
          <ThemeIcon size={48} radius="xl" color="white" variant="light">
            <IconChefHat size={28} />
          </ThemeIcon>
        </Group>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {MEALS.map(meal => {
            const recipe = getRecipeData(today, meal);
            return (
              <Paper
                key={meal}
                p="sm"
                radius="lg"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(10px)',
                  cursor: 'pointer',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
                onClick={() => onOpenPicker(today, meal)}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="sm" wrap="nowrap">
                    <ThemeIcon size="md" radius="md" color={mealColors[meal]} variant="filled">
                      {mealIcons[meal]}
                    </ThemeIcon>
                    <div>
                      <Text size="sm" fw={600} c="white">
                        {meal}
                      </Text>
                      {recipe ? (
                        <Text size="xs" opacity={0.8}>
                          {recipe.title}
                        </Text>
                      ) : (
                        <Text size="xs" opacity={0.5}>
                          + افزودن غذا
                        </Text>
                      )}
                    </div>
                  </Group>
                  {recipe && (
                    <Group gap="xs">
                      {recipe.cook_time && (
                        <Badge variant="filled" color="white" size="xs" c="dark">
                          <IconClock size={10} style={{ marginRight: 4 }} />
                          {recipe.cook_time}
                        </Badge>
                      )}
                    </Group>
                  )}
                </Group>
              </Paper>
            );
          })}
        </div>
      </Paper>
    </motion.div>
  );
}
