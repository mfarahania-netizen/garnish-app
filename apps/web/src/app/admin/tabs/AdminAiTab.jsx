// «هوش ادمین» — a REAL deterministic analyst: scans the live metrics and surfaces honest findings via fixed
// rules (not a model guessing). The LLM-narration layer is a later, founder-gated step. §14.
import { Box, Text, Loader } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { IconRobot, IconAlertTriangle, IconCircleCheck, IconInfoCircle, IconFlame } from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';
import { Section, Kpi, Note, Awaiting, grid, toFaDigits } from '../_ui';

const get = (url) => apiClient.get(url).then((r) => r.data);
const SEV = {
  critical: { fa: 'بحرانی', bg: 'var(--g-color-state-danger-bg, #fdeceb)', fg: 'var(--g-color-state-danger-fg, #b3261e)', Icon: IconFlame },
  warn: { fa: 'هشدار', bg: 'var(--g-color-state-warning-bg, #fdf3e3)', fg: 'var(--g-color-state-warning-fg, #8a5a14)', Icon: IconAlertTriangle },
  info: { fa: 'اطلاع', bg: 'var(--g-color-state-info-bg)', fg: 'var(--g-color-text-secondary)', Icon: IconInfoCircle },
  ok: { fa: 'سالم', bg: 'var(--g-color-state-success-bg)', fg: 'var(--g-color-state-success-fg)', Icon: IconCircleCheck },
};

export default function AdminAiTab() {
  const q = useQuery({ queryKey: ['admin', 'insights'], queryFn: () => get('/admin/ai/insights'), refetchInterval: 15000 });
  if (q.isLoading) return <Box style={{ display: 'grid', placeItems: 'center', paddingBlock: 60 }}><Loader color="var(--g-color-brand-600)" /></Box>;

  const d = q.data || {};
  const insights = d.insights || [];
  const count = (sev) => insights.filter((i) => i.severity === sev).length;

  return (
    <>
      <Note tone="brand" icon={IconRobot}>
        <Text component="span" style={{ fontWeight: 600 }}>تحلیل‌گرِ قطعی</Text> — این یافته‌ها با قواعدِ ثابت روی متریک‌های <Text component="span" style={{ fontWeight: 600 }}>زنده</Text> ساخته می‌شوند، نه حدسِ مدل. هیچ‌چیز جعل نمی‌شود. لایهٔ روایتِ زبانی (Claude) قدمِ بعدی است.
      </Note>

      <Box style={grid(170)}>
        <Kpi icon={IconFlame} label="بحرانی" status={count('critical') ? 'real' : 'awaiting_pilot'} value={toFaDigits(count('critical'))} sub="نیازِ اقدامِ فوری" tone={count('critical') ? 'warn' : undefined} awaitNote="بدونِ مورد ✓" />
        <Kpi icon={IconAlertTriangle} label="هشدار" status="real" value={toFaDigits(count('warn'))} sub="نیازِ توجه" tone={count('warn') ? 'warn' : undefined} />
        <Kpi icon={IconInfoCircle} label="اطلاع" status="real" value={toFaDigits(count('info'))} sub="نکتهٔ زمینه‌ای" />
        <Kpi icon={IconCircleCheck} label="سالم" status="real" value={toFaDigits(count('ok'))} sub="در محدودهٔ سالم" />
      </Box>

      <Section title="یافته‌ها" sub={d.method} />
      {insights.length ? (
        <Box style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {insights.map((i, idx) => {
            const m = SEV[i.severity] || SEV.info;
            return (
              <Box key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: '14px', padding: '14px 16px' }}>
                <Box aria-hidden="true" style={{ inlineSize: 34, blockSize: 34, borderRadius: '9px', flexShrink: 0, display: 'grid', placeItems: 'center', background: m.bg, color: m.fg }}><m.Icon size={18} stroke={1.8} /></Box>
                <Box style={{ flex: 1, minInlineSize: 0 }}>
                  <Box style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '13.5px', fontWeight: 600, color: 'var(--g-color-text-primary)' }}>{i.title}</Text>
                    <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '10.5px', fontWeight: 500, color: m.fg, background: m.bg, paddingInline: 8, paddingBlock: 2, borderRadius: '6px' }}>{m.fa} · {i.area}</Text>
                  </Box>
                  <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '12.5px', color: 'var(--g-color-text-secondary)', marginBlockStart: 4, lineHeight: 1.6 }}>{i.detail}</Text>
                </Box>
              </Box>
            );
          })}
        </Box>
      ) : <Awaiting note="یافته‌ای نیست." />}
    </>
  );
}
