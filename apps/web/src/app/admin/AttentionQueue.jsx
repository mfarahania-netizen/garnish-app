// AttentionQueue (P0-2) — the mission-control "ONE ranked queue". Merges open workflow alerts (which already
// cover the safety / AI-cost / reliability guards) + unanswered support tickets into a single severity-then-time
// list with inline Acknowledge / Resolve / Snooze + deep-link. Replaces the 4 fragmented action-feeds. Empty =
// calm, honest, never padded with demo incidents. Every card cites the real trigger (no card without a measure).
import { Box, Text, UnstyledButton, Loader } from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { IconCircleCheck, IconCheck, IconClockPause, IconTicket, IconBolt, IconChevronLeft } from '@tabler/icons-react';
import apiClient from '../../lib/apiClient';
import { ErrorState, toFaDigits } from './_ui';

const get = (url) => apiClient.get(url).then((r) => r.data);
const SEV_RANK = { critical: 0, warning: 1, info: 2 };
const PRIO_TO_SEV = { urgent: 'critical', high: 'warning', normal: 'info', low: 'info' };
const SEV = {
  critical: { label: 'بحرانی', fg: 'var(--g-color-state-danger-fg, #c0392b)', bg: 'var(--g-color-state-danger-bg, #fdecea)' },
  warning: { label: 'هشدار', fg: 'var(--g-color-state-warning-fg, #c0801c)', bg: 'var(--g-color-state-warning-bg, #fdf3e3)' },
  info: { label: 'اطلاع', fg: 'var(--g-color-text-secondary)', bg: 'var(--g-color-state-info-bg)' },
};
const ago = (d) => {
  if (!d) return '';
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'هم‌اکنون';
  if (m < 60) return toFaDigits(m) + ' دقیقه پیش';
  const h = Math.floor(m / 60);
  if (h < 24) return toFaDigits(h) + ' ساعت پیش';
  return toFaDigits(Math.floor(h / 24)) + ' روز پیش';
};
const fmtNum = (n) => (typeof n === 'number' ? toFaDigits(Math.round(n * 1000) / 1000) : null);

function ActBtn({ icon: Icon, label, tone, onClick, loading }) {
  const danger = tone === 'danger';
  return (
    <UnstyledButton type="button" onClick={onClick} disabled={loading} title={label} aria-label={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minBlockSize: 28, paddingInline: 9, borderRadius: '7px', border: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface)', color: danger ? 'var(--g-color-state-success-fg, #2e7d4f)' : 'var(--g-color-text-secondary)', fontFamily: 'var(--g-font-fa)', fontSize: '11px', fontWeight: 500, opacity: loading ? 0.6 : 1 }}>
      {loading ? <Loader size={11} color="var(--g-color-brand-600)" /> : <Icon size={13} stroke={1.8} />}{label}
    </UnstyledButton>
  );
}

export default function AttentionQueue() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const alertsQ = useQuery({ queryKey: ['admin', 'attention', 'alerts'], queryFn: () => get('/admin/workflows/alerts?status=open&limit=50'), refetchInterval: 20000 });
  const ticketsQ = useQuery({ queryKey: ['admin', 'attention', 'tickets'], queryFn: () => get('/admin/tickets?unanswered=true&limit=20'), refetchInterval: 30000 });

  const inval = () => qc.invalidateQueries({ queryKey: ['admin', 'attention'] });
  const ackM = useMutation({ mutationFn: (id) => apiClient.post(`/admin/workflows/alerts/${id}/ack`), onSuccess: inval });
  const resolveM = useMutation({ mutationFn: (arg) => { const id = typeof arg === 'string' ? arg : arg.id; const reason = typeof arg === 'string' ? 'attention queue quick resolve' : arg.reason; return apiClient.post(`/admin/workflows/alerts/${id}/resolve`, { reason }); }, onSuccess: inval });
  const snoozeM = useMutation({ mutationFn: (arg) => { const id = typeof arg === 'string' ? arg : arg.id; const reason = typeof arg === 'string' ? 'attention queue quick snooze' : arg.reason; return apiClient.post(`/admin/workflows/alerts/${id}/snooze?minutes=60`, { reason }); }, onSuccess: inval });
  const askReason = (label) => { const r = (window.prompt(label) || '').trim(); return r.length >= 3 ? r : null; };
  const busyId = ackM.variables ?? (typeof resolveM.variables === 'string' ? resolveM.variables : resolveM.variables?.id) ?? (typeof snoozeM.variables === 'string' ? snoozeM.variables : snoozeM.variables?.id);
  const busy = ackM.isPending || resolveM.isPending || snoozeM.isPending;

  if (alertsQ.isError && ticketsQ.isError) return <Box style={{ ...cardBase }}><ErrorState note="صفِ توجه از سرور خوانده نشد." onRetry={() => { alertsQ.refetch(); ticketsQ.refetch(); }} /></Box>;
  if (alertsQ.isLoading && ticketsQ.isLoading) return <Box style={{ ...cardBase, display: 'grid', placeItems: 'center', paddingBlock: 24 }}><Loader size="sm" color="var(--g-color-brand-600)" /></Box>;

  const alertItems = (alertsQ.data?.alerts || []).map((a) => ({ id: a.id, kind: 'alert', sev: SEV[a.severity] ? a.severity : 'info', title: a.title, subsystem: a.workflowKey || 'workflow', metric: a.metric, value: a.value, threshold: a.threshold, since: a.createdAt, ownerRole: a.ownerRole, assignedTo: a.assignedTo, dueAt: a.dueAt, isOverdue: a.isOverdue }));
  const ticketItems = (ticketsQ.data?.data || []).map((t) => ({ id: t.id, kind: 'ticket', sev: PRIO_TO_SEV[t.priority] || 'info', title: t.subject, subsystem: 'پشتیبانی', since: t.createdAt }));
  const items = [...alertItems, ...ticketItems].sort((a, b) => (SEV_RANK[a.sev] - SEV_RANK[b.sev]) || (new Date(b.since) - new Date(a.since)));

  if (!items.length) {
    // calm + honest: a quiet "all clear" with the last-checked time — NEVER a padded/loud green wall.
    return (
      <Box style={{ ...cardBase, display: 'flex', alignItems: 'center', gap: 9 }}>
        <IconCircleCheck size={18} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)', flexShrink: 0 }} />
        <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '12.5px', fontWeight: 600, color: 'var(--g-color-text-secondary)' }}>همه‌چیز آرام است — ۰ پرچم.</Text>
        <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11px', color: 'var(--g-color-text-muted)', marginInlineStart: 'auto' }}>بررسی: {ago(new Date().toISOString())}</Text>
      </Box>
    );
  }

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((it) => {
        const s = SEV[it.sev] || SEV.info;
        const dueLabel = it.dueAt ? `${it.isOverdue ? 'overdue' : 'due'} ${ago(it.dueAt)}` : null;
        const trigger = it.metric ? `${it.metric}: ${fmtNum(it.value)}${it.threshold != null ? ` (آستانه ${fmtNum(it.threshold)})` : ''}` : null;
        return (
          <Box key={`${it.kind}-${it.id}`} style={{ ...cardBase, borderInlineStartWidth: 3, borderInlineStartStyle: 'solid', borderInlineStartColor: s.fg, display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
            <Box aria-hidden="true" style={{ inlineSize: 30, blockSize: 30, flexShrink: 0, borderRadius: '8px', display: 'grid', placeItems: 'center', background: s.bg, color: s.fg }}>{it.kind === 'ticket' ? <IconTicket size={16} stroke={1.8} /> : <IconBolt size={16} stroke={1.8} />}</Box>
            <Box style={{ flex: 1, minInlineSize: 0 }}>
              <Box style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '10px', fontWeight: 600, color: s.fg, background: s.bg, borderRadius: '5px', padding: '2px 7px' }}>{s.label}</Text>
                <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '12.5px', fontWeight: 600, color: 'var(--g-color-text-primary)' }}>{it.title}</Text>
              </Box>
              <Box style={{ display: 'flex', alignItems: 'center', gap: 7, marginBlockStart: 3, fontFamily: 'var(--g-font-fa)', fontSize: '11px', color: 'var(--g-color-text-muted)' }}>
                <span>{it.subsystem}</span><span aria-hidden style={{ opacity: 0.5 }}>•</span><span>{ago(it.since)}</span>
                {trigger ? <><span aria-hidden style={{ opacity: 0.5 }}>•</span><span>{trigger}</span></> : null}
              </Box>
              {it.kind === 'alert' && (it.ownerRole || it.assignedTo || dueLabel) ? (
                <Box style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBlockStart: 4, fontFamily: 'var(--g-font-fa)', fontSize: '10.5px', color: 'var(--g-color-text-muted)' }}>
                  {it.ownerRole ? <span>{it.ownerRole}</span> : null}
                  {it.assignedTo ? <span>assigned: {it.assignedTo}</span> : null}
                  {dueLabel ? <span style={{ color: it.isOverdue ? 'var(--g-color-state-danger-fg, #c0392b)' : undefined }}>{dueLabel}</span> : null}
                </Box>
              ) : null}
            </Box>
            <Box style={{ display: 'inline-flex', gap: 5, flexShrink: 0 }}>
              {it.kind === 'alert' ? (
                <>
                  <ActBtn icon={IconCheck} label="تأیید" onClick={() => ackM.mutate(it.id)} loading={busy && busyId === it.id} />
                  <ActBtn icon={IconClockPause} label="۱ ساعت" onClick={() => snoozeM.mutate(it.id)} loading={busy && busyId === it.id} />
                  <ActBtn icon={IconCircleCheck} label="حل شد" tone="danger" onClick={() => resolveM.mutate(it.id)} loading={busy && busyId === it.id} />
                </>
              ) : (
                <ActBtn icon={IconChevronLeft} label="باز کردن" onClick={() => navigate('/admin?tab=tickets')} />
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

const cardBase = { background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: '14px', padding: '11px 14px' };
