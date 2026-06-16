// app/plan/components/ProposePlanPanel.jsx
// PLANNER-L4-09: FUNCTIONAL "propose plan". Calls the intelligent PROPOSE endpoint and renders the
// proposed slots as AI-suggested MealSlotCards. It PROPOSES — applying is an EXPLICIT per-slot confirm
// (onApply); this panel never writes the plan itself (E47 Annex: no AI auto-commit).
import { useState } from 'react';
import { Paper, Group, Text, Stack, Alert, Box } from '@mantine/core';
import { IconWand } from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';
import { MealSlotCard, Button as GesButton, LoadingSkeleton } from '../../../components/ges';

const MEAL_FA = { lunch: 'ناهار', dinner: 'شام', breakfast: 'صبحانه' };
const faMealOf = (m) => MEAL_FA[m] || m;

export default function ProposePlanPanel({ onApply }) {
  const [state, setState] = useState({ status: 'idle', data: null });
  const [dismissed, setDismissed] = useState({});

  async function propose() {
    setState({ status: 'loading', data: null });
    try {
      const { data } = await apiClient.post('/meal-plans/propose', { days: 7, meals: ['lunch', 'dinner'] });
      setState({ status: 'done', data });
      setDismissed({});
    } catch {
      setState({ status: 'error', data: null });
    }
  }

  const slots = state.data?.slots || [];
  const visible = slots.filter((_, i) => !dismissed[i]);

  return (
    <Paper p="sm" radius="md" mb="md" data-testid="propose-plan" style={{ border: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface)' }}>
      <Group justify="space-between" align="center">
        <Text size="sm" fw={700} c="var(--g-color-text-primary)">برنامهٔ هوشمند هفته</Text>
        <Box>
          <GesButton variant="secondary" leftIcon={<IconWand size={16} />} loading={state.status === 'loading'} onClick={propose}>
            پیشنهاد بده
          </GesButton>
        </Box>
      </Group>

      {state.status === 'loading' && <Box mt="xs"><LoadingSkeleton shape="list" lines={2} label="در حال ساخت پیشنهاد" /></Box>}
      {state.status === 'error' && <Alert mt="xs" color="red" variant="light">خطا در ساخت پیشنهاد.</Alert>}

      {state.status === 'done' && (
        slots.length ? (
          <Stack gap="var(--g-space-2)" mt="xs">
            <Text size="xs" c="var(--g-color-text-secondary)">
              {visible.length} وعدهٔ پیشنهادی — پیشنهاد است؛ هر کدام را خواستی تأیید کن.
            </Text>
            {visible.map((s) => {
              const idx = slots.indexOf(s);
              const faMeal = faMealOf(s.mealType);
              return (
                <MealSlotCard
                  key={idx}
                  mealLabel={faMeal}
                  state="suggested"
                  recipeTitle={s.title}
                  confidence={s.confidence === 'high' ? 'high' : 'medium'}
                  onConfirm={() => { onApply?.(faMeal, s.recipeId, s.title); setDismissed((d) => ({ ...d, [idx]: true })); }}
                  onDecline={() => setDismissed((d) => ({ ...d, [idx]: true }))}
                />
              );
            })}
            {visible.length === 0 && <Text size="xs" c="var(--g-color-text-muted)">همهٔ پیشنهادها بررسی شد.</Text>}
          </Stack>
        ) : (
          <Alert mt="xs" color="gray" variant="light">پیشنهاد کافی پیدا نشد (با مواد/محدودیت‌های فعلی).</Alert>
        )
      )}
    </Paper>
  );
}
