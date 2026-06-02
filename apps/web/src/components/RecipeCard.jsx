import { Box, Text, Group, Paper, Badge, ThemeIcon } from '@mantine/core';
import {
  IconChefHat, IconCake, IconGlassFull, IconSoup, IconSalad,
  IconClock, IconFlame, IconBolt, IconHeart, IconStar
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAnalytics } from '../hooks/useAnalytics';

// پالت رنگی مدرن بر اساس نوع غذا
const typeConfig = {
  main:      { color: '#FF6B35', bg: 'linear-gradient(135deg, #FF6B35, #FF8F65)', icon: IconChefHat },
  appetizer: { color: '#2ECC71', bg: 'linear-gradient(135deg, #2ECC71, #58D68D)', icon: IconSalad },
  dessert:   { color: '#E91E63', bg: 'linear-gradient(135deg, #E91E63, #F06292)', icon: IconCake },
  drink:     { color: '#00BCD4', bg: 'linear-gradient(135deg, #00BCD4, #4DD0E1)', icon: IconGlassFull },
  bread:     { color: '#FF9800', bg: 'linear-gradient(135deg, #FF9800, #FFB74D)', icon: IconSoup },
  sauce:     { color: '#9C27B0', bg: 'linear-gradient(135deg, #9C27B0, #CE93D8)', icon: IconSoup },
};
const defaultType = { color: '#607D8B', bg: 'linear-gradient(135deg, #607D8B, #90A4AE)', icon: IconChefHat };

export default function RecipeCard({ recipe, onClick: externalOnClick }) {
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();
  const { id, title, cook_time, difficulty, foodType, isQuick, isHealthy, mealType, region } = recipe;
  const config = typeConfig[foodType] || defaultType;
  const TypeIcon = config.icon;

  const handleClick = () => {
    trackEvent('recipe_view', { recipeId: id, title });
    if (externalOnClick) {
      externalOnClick(recipe);
    } else {
      navigate(`/recipe/${id}`);
    }
  };

  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      style={{ height: '100%' }}
    >
      <Paper
        shadow="sm"
        radius="lg"
        onClick={handleClick}
        style={{
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.2)',
          cursor: 'pointer',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          transition: 'box-shadow 0.2s, transform 0.2s',
        }}
      >
        {/* بخش تصویر با پوشش رنگی */}
        <Box
          style={{
            height: 140,
            background: config.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <TypeIcon size={48} color="rgba(255,255,255,0.9)" />

          {/* برچسب‌های سریع/سالم */}
          <Group gap="xs" style={{ position: 'absolute', top: 10, left: 10, direction: 'ltr' }}>
            {isQuick && (
              <Badge
                size="sm"
                variant="filled"
                leftSection={<IconBolt size={12} />}
                color="yellow"
                style={{ backgroundColor: 'rgba(0,0,0,0.5)', color: '#FFD54F' }}
              >
                سریع
              </Badge>
            )}
            {isHealthy && (
              <Badge
                size="sm"
                variant="filled"
                leftSection={<IconHeart size={12} />}
                color="teal"
                style={{ backgroundColor: 'rgba(0,0,0,0.5)', color: '#81C784' }}
              >
                سالم
              </Badge>
            )}
          </Group>

          {/* سختی */}
          {difficulty && (
            <Badge
              size="xs"
              variant="light"
              color={difficulty === 'آسان' ? 'green' : difficulty === 'متوسط' ? 'yellow' : 'red'}
              style={{ position: 'absolute', bottom: 8, right: 8 }}
            >
              {difficulty}
            </Badge>
          )}
        </Box>

        {/* اطلاعات اصلی */}
        <Box px="sm" py="sm" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <Text fw={600} size="sm" lineClamp={2} mb={4} style={{ color: '#1A237E' }}>
            {title}
          </Text>

          <Group gap="xs" wrap="wrap" align="center" style={{ rowGap: 4 }}>
            {/* زمان پخت */}
            {cook_time && (
              <Badge variant="light" color="gray" size="xs" leftSection={<IconClock size={12} />}>
                {cook_time}
              </Badge>
            )}
            {/* نوع غذا (دسته‌بندی اصلی) */}
            {foodType && (
              <Badge variant="light" color="orange" size="xs">
                {foodType}
              </Badge>
            )}
            {/* وعده غذایی (در صورت وجود) */}
            {mealType && (
              <Badge variant="outline" color="indigo" size="xs">
                {mealType}
              </Badge>
            )}
            {/* منطقه (اختیاری) */}
            {region && region !== 'international' && (
              <Badge variant="dot" color="teal" size="xs">
                {region === 'persian' ? 'ایرانی' : region}
              </Badge>
            )}
          </Group>
        </Box>
      </Paper>
    </motion.div>
  );
}