import { Box, Title, Group, Badge, ActionIcon, Tooltip, Paper, rem } from '@mantine/core';
import { IconHeart, IconShare, IconStarFilled } from '@tabler/icons-react';

export default function RecipeHero({ recipe, favorite, onToggleFavorite, onShare }) {
  const { title, category } = recipe;

  return (
    <Paper
      radius="xl"
      style={{
        background: 'linear-gradient(135deg, var(--g-color-brand-400), var(--g-color-brand-600))',
        padding: 0,
        overflow: 'hidden',
        marginBottom: 24,
        boxShadow: 'var(--g-shadow-1)',
        position: 'relative',
      }}
    >
      <Box style={{ height: 240, opacity: 0.2, position: 'absolute', inset: 0 }} />
      <Box style={{ position: 'relative', zIndex: 2, padding: '32px 20px 20px', color: 'white' }}>
        <Group justify="space-between" align="flex-start">
          <div style={{ flex: 1, minWidth: 0 }}>
            <Title order={2} style={{ color: 'white', fontSize: rem(28), fontWeight: 800, lineHeight: 1.3, overflowWrap: 'anywhere' }}>
              {title}
            </Title>
            {category && (
              <Badge variant="filled" color="orange" size="lg" radius="xl" mt="sm" leftSection={<IconStarFilled size={12} />}>
                {category}
              </Badge>
            )}
          </div>
          <Group gap="xs" style={{ flexShrink: 0 }}>
            <Tooltip label={favorite ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}>
              <ActionIcon
                variant="filled"
                color={favorite ? 'red' : 'dark'}
                size="lg"
                radius="xl"
                onClick={onToggleFavorite}
                style={{ backgroundColor: 'var(--g-color-bg-surface)', backdropFilter: 'blur(4px)' }}
              >
                <IconHeart size={18} fill={favorite ? 'white' : 'none'} color="white" />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="اشتراک‌گذاری">
              <ActionIcon
                variant="filled"
                size="lg"
                radius="xl"
                onClick={onShare}
                style={{ backgroundColor: 'var(--g-color-bg-surface)', backdropFilter: 'blur(4px)' }}
              >
                <IconShare size={18} color="white" />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Box>
    </Paper>
  );
}
