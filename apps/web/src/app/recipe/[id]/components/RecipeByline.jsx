// features/recipe/[id]/components/RecipeByline.jsx
// RECIPE-L4-07: thin FUNCTIONAL surfacing of recipe.author (attribution) + recipe.categories
// (multi-category chips; also usable as a filter facet via /recipes?category=). No visual/brand design.
import { Group, Text, Badge, Anchor } from '@mantine/core';
import { IconUser } from '@tabler/icons-react';
import { Link } from 'react-router-dom';

export default function RecipeByline({ recipe }) {
  const { author, categories } = recipe || {};
  const cats = Array.isArray(categories) ? categories.filter(Boolean) : [];
  const authorName = author && typeof author === 'object' ? author.name : null; // owner-safe: display name only

  if (!authorName && cats.length === 0) return null;

  return (
    <Group gap="xs" mb="md" wrap="wrap" data-testid="recipe-byline">
      {authorName && (
        <Group gap={4}><IconUser size={14} color="var(--g-color-text-muted)" /><Text size="xs" c="dimmed">به‌کوشش {authorName}</Text></Group>
      )}
      {cats.map((c) => (
        // categories double as a filter facet (links to the category-filtered recipe list)
        <Anchor key={c} component={Link} to={`/recipes?category=${encodeURIComponent(c)}`} underline="never">
          <Badge size="sm" variant="light" color="indigo">{c}</Badge>
        </Anchor>
      ))}
    </Group>
  );
}
