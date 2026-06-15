// features/ai-chat/components/GroundedAssist.jsx
// E47-L4 thin FUNCTIONAL UI (logic, not visual design — Phase 3 owns styling).
// Reaches the grounded backend tools and renders their STRUCTURED responses with
// loading / empty / error states. Uses existing Mantine primitives only.
import { useState } from 'react';
import { Paper, SegmentedControl, TextInput, NumberInput, Button, Group, Stack, Text, List, Badge, Loader, Alert } from '@mantine/core';
import { getSubstitutions, matchPantry, getPairings, getTechnique } from '../services/aiEngine';

const MODES = [
  { label: 'جایگزین ماده', value: 'subs' },
  { label: 'با موادِ من', value: 'pantry' },
  { label: 'هم‌نشینی', value: 'pair' },
  { label: 'توضیح مرحله', value: 'tech' },
];

// resultStatus values that mean "grounded but nothing to show" → graceful, honest empty state.
const EMPTY_STATUS = new Set([
  'ingredient_not_found', 'no_substitution_data', 'no_match', 'empty_pantry',
  'insufficient_data', 'recipe_not_found', 'no_steps', 'step_out_of_range', 'empty_query', 'unavailable',
]);

export default function GroundedAssist() {
  const [mode, setMode] = useState('subs');
  const [q, setQ] = useState('');
  const [step, setStep] = useState('');
  const [state, setState] = useState({ status: 'idle', data: null });

  async function run() {
    const value = q.trim();
    if (!value || state.status === 'loading') return;
    setState({ status: 'loading', data: null });
    try {
      let data;
      if (mode === 'subs') data = await getSubstitutions(value);
      else if (mode === 'pantry') data = await matchPantry(value.split(/[،,]/).map((s) => s.trim()).filter(Boolean));
      else if (mode === 'pair') data = await getPairings({ ingredient: value });
      else data = await getTechnique(value, step);
      setState({ status: 'done', data });
    } catch {
      setState({ status: 'error', data: null });
    }
  }

  return (
    <Paper p="sm" radius="md" withBorder m="md" data-testid="grounded-assist">
      <SegmentedControl size="xs" fullWidth value={mode} onChange={(m) => { setMode(m); setState({ status: 'idle', data: null }); }} data={MODES} />
      <Group gap="xs" mt="xs" align="flex-end" wrap="nowrap">
        <TextInput
          style={{ flex: 1 }}
          size="xs"
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          placeholder={
            mode === 'pantry' ? 'موادی که داری (با ، جدا کن)' :
            mode === 'tech' ? 'شناسهٔ رسپی (recipeId)' :
            'نام ماده (مثلاً کره)'
          }
        />
        {mode === 'tech' && (
          <NumberInput size="xs" w={90} value={step} onChange={setStep} placeholder="مرحله" min={1} />
        )}
        <Button size="xs" color="orange" onClick={run} loading={state.status === 'loading'}>بپرس</Button>
      </Group>

      <Results mode={mode} state={state} />
    </Paper>
  );
}

function Results({ mode, state }) {
  if (state.status === 'idle') return null;
  if (state.status === 'loading') return <Group mt="sm" gap="xs"><Loader size="xs" color="orange" /><Text size="xs" c="dimmed">در حال جست‌وجو در داده‌های گارنیش…</Text></Group>;
  if (state.status === 'error') return <Alert mt="sm" color="red" variant="light" data-testid="ga-error">خطا در ارتباط با دستیار. دوباره تلاش کن.</Alert>;

  const data = state.data || {};
  if (EMPTY_STATUS.has(data.resultStatus)) {
    // honest "I don't have that in my data" — never fabricates
    return <Alert mt="sm" color="gray" variant="light" data-testid="ga-empty">{data.note || 'برای این مورد داده‌ای در پایگاه گارنیش پیدا نشد.'}</Alert>;
  }

  return (
    <Stack mt="sm" gap={4} data-testid="ga-results">
      {data.note && <Text size="xs" c="dimmed">{data.note}</Text>}
      {mode === 'subs' && (
        <List size="xs" spacing={2}>
          {(data.substitutions || []).map((s, i) => (
            <List.Item key={i}><b>{s.name}</b> — <Text span size="xs" c="dimmed">{s.reason}</Text></List.Item>
          ))}
        </List>
      )}
      {mode === 'pantry' && (
        <List size="xs" spacing={4}>
          {(data.matches || []).map((m) => (
            <List.Item key={m.recipeId}>
              <Group gap={6}><b>{m.title}</b><Badge size="xs" color="green" variant="light">{m.coveragePct}%</Badge></Group>
              {m.missing?.length > 0 && <Text size="xs" c="dimmed">کم داری: {m.missing.join('، ')}</Text>}
            </List.Item>
          ))}
        </List>
      )}
      {mode === 'pair' && (
        <Group gap={6}>
          {(data.pairings || []).map((p, i) => (
            <Badge key={i} size="sm" variant="light" color="grape" title={`${p.coOccurringRecipes} رسپی`}>{p.name}</Badge>
          ))}
        </Group>
      )}
      {mode === 'tech' && (
        data.step ? (
          <Text size="sm"><b>مرحلهٔ {data.step}{data.stepTitle ? ` — ${data.stepTitle}` : ''}:</b> {data.instruction}</Text>
        ) : (
          <List size="xs">{(data.steps || []).map((s) => <List.Item key={s.order}>مرحلهٔ {s.order}{s.title ? `: ${s.title}` : ''}</List.Item>)}</List>
        )
      )}
    </Stack>
  );
}
