// GARNISH-DASHBOARD-L4-17 — honest "awaiting real users" state.
// Rendered whenever an S12 metric returns status==='awaiting_pilot' / null. NEVER a fake line or a
// misleading zero — a calm, clear statement that the metric activates with real pilot users (Track 7).
import { Stack, Text, ThemeIcon } from '@mantine/core';
import { IconHourglassHigh } from '@tabler/icons-react';
import { GES, T } from './gesTheme';

export default function AwaitingPilot({ label, height = 220, note }) {
  return (
    <Stack align="center" justify="center" gap={6} style={{ height, textAlign: 'center', padding: 'var(--g-space-6)' }}>
      <ThemeIcon size={44} radius="xl" variant="light" style={{ background: 'var(--g-color-state-info-bg)', color: GES.neutral }}>
        <IconHourglassHigh size={22} />
      </ThemeIcon>
      <Text fw={700} size="sm" style={{ color: T.textSecondary }}>{label || 'در انتظار کاربران واقعی'}</Text>
      <Text size="xs" style={{ color: T.textMuted, maxWidth: 320 }}>
        {note || 'این متریک با ورود کاربران واقعی در مرحلهٔ پایلوت (Track 7) محاسبه و نمایش داده می‌شود — هیچ داده‌ای ساختگی نشان داده نمی‌شود.'}
      </Text>
    </Stack>
  );
}

/** True when an S12 sub-metric is awaiting real-user data. */
export const isAwaiting = (m) => !m || m.status === 'awaiting_pilot';
