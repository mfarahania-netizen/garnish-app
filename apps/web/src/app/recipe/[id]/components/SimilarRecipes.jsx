// features/recipe/[id]/components/SimilarRecipes.jsx
// SEARCH-L4-08: thin FUNCTIONAL "similar recipes" (no visual/brand design). Calls the deterministic
// nearest-neighbor endpoint and renders explainable links. Degrades silently if none/empty/error.
import { useEffect, useState } from 'react';
import { Paper, Text, Group, Anchor, Stack, Loader } from '@mantine/core';
import { IconToolsKitchen2 } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import apiClient from '../../../../lib/apiClient';

export default function SimilarRecipes({ recipeId }) {
  const [state, setState] = useState({ status: 'idle', results: [] });

  useEffect(() => {
    if (!recipeId) return undefined;
    let active = true;
    setState({ status: 'loading', results: [] });
    apiClient
      .get(`/recipes/${recipeId}/similar`)
      .then((res) => { if (active) setState({ status: 'done', results: res.data?.results || [] }); })
      .catch(() => { if (active) setState({ status: 'error', results: [] }); });
    return () => { active = false; };
  }, [recipeId]);

  if (state.status === 'idle' || state.status === 'error') return null;
  if (state.status === 'loading') return <Group px="md" my="md"><Loader size="xs" color="orange" /><Text size="xs" c="dimmed">غذاهای مشابه…</Text></Group>;
  if (!state.results.length) return null;

  return (
    <Paper p="md" radius="lg" mb="lg" withBorder data-testid="similar-recipes">
      <Group gap="xs" mb="sm"><IconToolsKitchen2 size={18} color="#FF6B35" /><Text size="sm" fw={700}>غذاهای مشابه</Text></Group>
      <Stack gap={6}>
        {state.results.map((r) => (
          <Anchor key={r.recipeId} component={Link} to={`/recipe/${r.recipeId}`} underline="never">
            <Text size="sm" fw={600}>{r.title}</Text>
            {r.why?.reasons?.length > 0 && <Text size="xs" c="dimmed">{r.why.reasons[0]}</Text>}
          </Anchor>
        ))}
      </Stack>
    </Paper>
  );
}
