// DailyBrief (P1) — the mission-control "what's happening, in plain words". Renders the DETERMINISTIC analyst
// (admin.service.getAdminInsights: fixed rules over live metrics, NOT a model guessing) as a briefing the operator
// reads first: severity-ranked findings, each an area + headline + what-it-means/what-to-do. Honest by construction
// — the badge says "rules, not a model". Calm when nothing breaches a threshold (the analyst still affirms safety).
import { Box, Text, Loader } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { IconAlertTriangle, IconInfoCircle, IconCircleCheck, IconAlertOctagon } from '@tabler/icons-react';
import apiClient from '../../lib/apiClient';
import { ErrorState } from './_ui';

const get = (url) => apiClient.get(url).then((r) => r.data);
const SEV_RANK = { critical: 0, warn: 1, info: 2, ok: 3 };
const SEV = {
  critical: { fg: 'var(--g-color-state-danger-fg, #c0392b)', bg: 'var(--g-color-state-danger-bg, #fdecea)', icon: IconAlertOctagon },
  warn: { fg: 'var(--g-color-state-warning-fg, #c0801c)', bg: 'var(--g-color-state-warning-bg, #fdf3e3)', icon: IconAlertTriangle },
  info: { fg: 'var(--g-color-text-secondary)', bg: 'var(--g-color-state-info-bg)', icon: IconInfoCircle },
  ok: { fg: 'var(--g-color-state-success-fg, #2e7d4f)', bg: 'var(--g-color-state-success-bg, #e9f6ee)', icon: IconCircleCheck },
};

export default function DailyBrief() {
  const q = useQuery({ queryKey: ['admin', 'daily-brief'], queryFn: () => get('/admin/ai/insights'), refetchInterval: 60000 });

  if (q.isError) return <Box style={{ ...cardBase }}><ErrorState note="بریف از سرور خوانده نشد." onRetry={() => q.refetch()} /></Box>;
  if (q.isLoading) return <Box style={{ ...cardBase, display: 'grid', placeItems: 'center', paddingBlock: 20 }}><Loader size="sm" color="var(--g-color-brand-600)" /></Box>;

  const insights = [...(q.data?.insights || [])].sort((a, b) => (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9)).slice(0, 7);

  return (
    <Box style={cardBase}>
      <Box style={{ display: 'flex', alignItems: 'center', gap: 8, marginBlockEnd: 11 }}>
        <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '13px', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>بریفِ امروز</Text>
        <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '10px', color: 'var(--g-color-text-muted)', background: 'var(--g-color-state-info-bg)', borderRadius: '5px', padding: '2px 7px' }}>قواعدِ قطعی، نه حدسِ مدل</Text>
      </Box>
      <Box style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {insights.map((it, i) => {
          const s = SEV[it.severity] || SEV.info;
          const Icon = s.icon;
          return (
            <Box key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
              <Box aria-hidden="true" style={{ inlineSize: 24, blockSize: 24, flexShrink: 0, borderRadius: '7px', display: 'grid', placeItems: 'center', background: s.bg, color: s.fg, marginBlockStart: 1 }}><Icon size={14} stroke={1.8} /></Box>
              <Box style={{ flex: 1, minInlineSize: 0 }}>
                <Box style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '10px', fontWeight: 600, color: s.fg }}>{it.area}</Text>
                  <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '12.5px', fontWeight: 600, color: 'var(--g-color-text-primary)' }}>{it.title}</Text>
                </Box>
                <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', color: 'var(--g-color-text-secondary)', marginBlockStart: 2, lineHeight: 1.55 }}>{it.detail}</Text>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

const cardBase = { background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: '16px', padding: '14px 16px' };
