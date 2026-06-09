// apps/web/src/app/recipe/[id]/components/RecipeHero.jsx
import { Box, Title, Group, Badge, ActionIcon, Tooltip, Paper, rem } from '@mantine/core';
import { IconHeart, IconShare, IconStarFilled } from '@tabler/icons-react';

export default function RecipeHero({ recipe, favorite, onToggleFavorite, onShare }) {
  const { title, category } = recipe;
  return (
    <Paper
      radius="xl"
      style={{
        background: 'linear-gradient(135deg, #1A237E, #FF6B35)',
        padding: 0,
        overflow: 'hidden',
        marginBottom: 24,
        boxShadow: '0 12px 30px rgba(26,35,126,0.3)',
        position: 'relative',
      }}
    >
      <Box style={{ height: 240, opacity: 0.2, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <Box style={{ position: 'relative', zIndex: 2, padding: '32px 20px 20px', color: 'white' }}>
        <Group justify="space-between" align="flex-start">
          <div style={{ flex: 1 }}>
            <Title order={2} style={{ color: 'white', fontSize: rem(28), fontWeight: 800, lineHeight: 1.3 }}>
              {title}
            </Title>
            {category && (
              <Badge variant="filled" color="orange" size="lg" radius="xl" mt="sm" leftSection={<IconStarFilled size={12} />}>
                {category}
              </Badge>
            )}
          </div>
          <Group gap="xs">
            <Tooltip label={favorite ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}>
              <ActionIcon variant="filled" color={favorite ? 'red' : 'dark'} size="lg" radius="xl" onClick={onToggleFavorite}
                style={{ backgroundColor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)' }}>
                <IconHeart size={18} fill={favorite ? 'white' : 'none'} color="white" />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="اشتراک‌گذاری">
              <ActionIcon variant="filled" size="lg" radius="xl" onClick={onShare}
                style={{ backgroundColor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)' }}>
                <IconShare size={18} color="white" />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Box>
    </Paper>
  );
}