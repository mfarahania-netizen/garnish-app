// Automation tab — the workflow control surface (spec §B6 / §7). Shows the in-house "guards" (workflows),
// the flags they raise (alerts feed), and lets the operator run one on demand or acknowledge an alert.
// Every part is explained in plain Persian (no cryptic labels) and reads the real /admin/workflows endpoints.
import { Box, Text, UnstyledButton } from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IconSitemap, IconBolt, IconPlayerPlay, IconCheck, IconShieldCheck, IconClock, IconAlertTriangle } from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';
import { CARD, Section, Note, Awaiting, toFaDigits } from '../_ui';

const get = (url) => apiClient.get(url).then((r) => r.data);

// severity → minimal colour language (danger / warning / quiet info)
const SEV = {
  critical: { label: 'بحرانی', fg: 'var(--g-color-state-danger-fg, #c0392b)', bg: 'var(--g-color-state-danger-bg, #fdecea)' },
  warning: { label: 'هشدار', fg: 'var(--g-color-state-warning-fg, #c0801c)', bg: 'var(--g-color-state-warning-bg, #fdf3e3)' },
  info: { label: 'اطلاع', fg: 'var(--g-color-text-secondary)', bg: 'var(--g-color-state-info-bg)' },
};

// "every N seconds" → a human Persian cadence
function cadenceFa(sec) {
  if (!sec) return 'دستی';
  if (sec % 604800 === 0) return `هر ${toFaDigits(sec / 604800)} هفته`;
  if (sec % 86400 === 0) return sec === 86400 ? 'هر روز' : `هر ${toFaDigits(sec / 86400)} روز`;
  if (sec % 3600 === 0) return sec === 3600 ? 'هر ساعت' : `هر ${toFaDigits(sec / 3600)} ساعت`;
  if (sec % 60 === 0) return `هر ${toFaDigits(sec / 60)} دقیقه`;
  return `هر ${toFaDigits(sec)} ثانیه`;
}

function agoFa(iso) {
  if (!iso) return '—';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'همین حالا';
  if (s < 3600) return `${toFaDigits(Math.floor(s / 60))} دقیقه پیش`;
  if (s < 86400) return `${toFaDigits(Math.floor(s / 3600))} ساعت پیش`;
  return `${toFaDigits(Math.floor(s / 86400))} روز پیش`;
}

const fmtNum = (n) => (typeof n === 'number' && Number.isFinite(n) ? toFaDigits(Math.round(n * 1000) / 1000) : '—');
const ALERT_BTN = { display: 'inline-flex', alignItems: 'center', gap: 5, minBlockSize: 30, paddingInline: 9, borderRadius: '8px', border: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-secondary)', fontFamily: 'var(--g-font-fa)', fontSize: '11px', fontWeight: 500, flexShrink: 0 };

// turn the last run's structured outcome into a plain coloured sentence — so a guard "reports its state"
// on the card WITHOUT you clicking anything (healthy / alerted / digest / error / never-run).
function resultLine(lr) {
  if (!lr) return { text: 'هنوز اجرا نشده', color: 'var(--g-color-text-muted)' };
  if (lr.failed) return { text: 'خطا در اجرا', color: 'var(--g-color-state-danger-fg, #c0392b)' };
  const c = lr.checked;
  if (lr.alerted) {
    return { text: c && c.value != null ? `هشدار — مقدار ${fmtNum(c.value)} (آستانه ${fmtNum(c.threshold)})` : 'هشدار/گزارش ساخته شد', color: 'var(--g-color-state-warning-fg, #c0801c)' };
  }
  if (lr.isDigest) return { text: 'گزارش ساخته شد', color: 'var(--g-color-text-secondary)' };
  return { text: c && c.value != null ? `سالم — مقدار ${fmtNum(c.value)}، زیرِ آستانه ${fmtNum(c.threshold)}` : 'سالم — مشکلی نیست', color: 'var(--g-color-state-success-fg, #2e7d4f)' };
}

export default function AutomationTab() {
  const qc = useQueryClient();
  const workflows = useQuery({ queryKey: ['admin', 'workflows'], queryFn: () => get('/admin/workflows'), refetchInterval: 15000 });
  const alerts = useQuery({ queryKey: ['admin', 'workflow-alerts'], queryFn: () => get('/admin/workflows/alerts?status=all&limit=30'), refetchInterval: 15000 });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['admin', 'workflows'] }); qc.invalidateQueries({ queryKey: ['admin', 'workflow-alerts'] }); };
  const runMut = useMutation({ mutationFn: ({ key, reason }) => apiClient.post(`/admin/workflows/${key}/run`, { reason }).then((r) => r.data), onSuccess: invalidate });
  const ackMut = useMutation({ mutationFn: (id) => apiClient.post(`/admin/workflows/alerts/${id}/ack`).then((r) => r.data), onSuccess: invalidate });
  const resolveMut = useMutation({ mutationFn: ({ id, reason }) => apiClient.post(`/admin/workflows/alerts/${id}/resolve`, { reason }).then((r) => r.data), onSuccess: invalidate });
  const snoozeMut = useMutation({ mutationFn: ({ id, reason }) => apiClient.post(`/admin/workflows/alerts/${id}/snooze?minutes=60`, { reason }).then((r) => r.data), onSuccess: invalidate });
  // P0-4: run/resolve/snooze are audit-grade — the server requires a reason (>=3). ack stays reason-free.
  const askReason = (label) => { const r = (window.prompt(label) || '').trim(); return r.length >= 3 ? r : null; };

  const wfList = workflows.data?.workflows || [];
  const alertList = alerts.data?.alerts || [];
  const openAlerts = alertList.filter((a) => a.status === 'open');
  // P1-14: map each workflow's operating runbook by key, so an open alert shows "who owns it + the first action".
  const runbookByKey = {};
  wfList.forEach((w) => { if (w.runbook) runbookByKey[w.key] = w.runbook; });

  return (
    <Box>
      <Note icon={IconSitemap}>
        این بخش، «نگهبان‌های خودکارِ» اپ است. هر نگهبان (ورک‌فلو) طبق زمان‌بندی، بخشی از سلامتِ اپ را چک می‌کند؛ اگر چیزی از حد گذشت،
        اینجا یک «پرچم» (هشدار) می‌گذارد و اگر همه‌چیز خوب بود ساکت می‌مانَد. می‌توانی هر نگهبان را دستی هم اجرا کنی.
      </Note>

      {/* ── FLAGS: the alerts the guards raised ── */}
      <Section title="پرچم‌های فعال" sub={`${toFaDigits(openAlerts.length)} پرچمِ باز`}>
        {openAlerts.length === 0 ? (
          <Box style={{ ...CARD, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Box aria-hidden="true" style={{ inlineSize: 34, blockSize: 34, borderRadius: '10px', display: 'grid', placeItems: 'center', background: 'var(--g-color-state-success-bg, #e9f6ee)', color: 'var(--g-color-state-success-fg, #2e7d4f)', flexShrink: 0 }}>
              <IconShieldCheck size={19} stroke={1.7} />
            </Box>
            <Box>
              <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '13px', fontWeight: 600, color: 'var(--g-color-text-primary)' }}>همه‌چیز آرام است</Text>
              <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', color: 'var(--g-color-text-muted)', marginBlockStart: 2 }}>هیچ پرچمی بالا نیست — نگهبان‌ها چیزی خارج از حد ندیده‌اند.</Text>
            </Box>
          </Box>
        ) : (
          <Box style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {openAlerts.map((a) => {
              const sev = SEV[a.severity] || SEV.info;
              return (
                <Box key={a.id} style={{ ...CARD, borderInlineStartWidth: 3, borderInlineStartColor: sev.fg, borderInlineStartStyle: 'solid' }}>
                  <Box style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <Box style={{ minInlineSize: 0, flex: 1 }}>
                      <Box style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        <Box style={{ fontFamily: 'var(--g-font-fa)', fontSize: '10.5px', fontWeight: 600, color: sev.fg, background: sev.bg, borderRadius: '6px', padding: '2px 7px' }}>{sev.label}</Box>
                        <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '13px', fontWeight: 600, color: 'var(--g-color-text-primary)' }}>{a.title}</Text>
                      </Box>
                      <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '12px', color: 'var(--g-color-text-secondary)', lineHeight: 1.7, margin: '6px 0 0' }}>{a.body}</Text>
                      <Box style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBlockStart: 8, fontFamily: 'var(--g-font-fa)', fontSize: '11px', color: 'var(--g-color-text-muted)' }}>
                        {a.value != null ? <span>مقدار: <b style={{ color: sev.fg, fontWeight: 600 }}>{fmtNum(a.value)}</b>{a.threshold != null ? ` · آستانه: ${fmtNum(a.threshold)}` : ''}</span> : null}
                        <span>منبع: {a.workflowKey}</span>
                        <span>{agoFa(a.createdAt)}</span>
                      </Box>
                      {runbookByKey[a.workflowKey] ? (
                        <Box style={{ marginBlockStart: 9, padding: '8px 10px', borderRadius: '8px', background: 'var(--g-color-bg-canvas)', border: '1px solid var(--g-color-border-subtle)' }}>
                          <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11px', color: 'var(--g-color-text-secondary)', lineHeight: 1.75 }}><b>مسئول:</b> {runbookByKey[a.workflowKey].ownerRole} · <b>اقدامِ اول:</b> {runbookByKey[a.workflowKey].expectedAction}</Text>
                          <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '10.5px', color: 'var(--g-color-text-muted)', marginBlockStart: 3 }}>{runbookByKey[a.workflowKey].steps}</Text>
                        </Box>
                      ) : null}
                    </Box>
                    <Box style={{ display: 'inline-flex', gap: 5, flexShrink: 0 }}>
                      <UnstyledButton type="button" onClick={() => ackMut.mutate(a.id)} disabled={ackMut.isPending} title="تأیید — دیده شد" style={ALERT_BTN}>
                        <IconCheck size={14} stroke={1.8} />تأیید
                      </UnstyledButton>
                      <UnstyledButton type="button" onClick={() => { const reason = askReason('دلیلِ تعویقِ ۱ساعتهٔ این هشدار؟'); if (reason) snoozeMut.mutate({ id: a.id, reason }); }} disabled={snoozeMut.isPending} title="۱ ساعت بعد دوباره نشانم بده" style={ALERT_BTN}>
                        <IconClock size={14} stroke={1.8} />۱ ساعت
                      </UnstyledButton>
                      <UnstyledButton type="button" onClick={() => { const reason = askReason('دلیلِ بستن (حل‌شدن) این هشدار؟'); if (reason) resolveMut.mutate({ id: a.id, reason }); }} disabled={resolveMut.isPending} title="حل شد — بستنِ کامل" style={{ ...ALERT_BTN, color: 'var(--g-color-state-success-fg, #2e7d4f)' }}>
                        <IconShieldCheck size={14} stroke={1.8} />حل شد
                      </UnstyledButton>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Section>

      {/* ── GUARDS: the workflows themselves ── */}
      <Section title="نگهبان‌ها" sub={`${toFaDigits(wfList.length)} ورک‌فلو`}>
        {wfList.length === 0 ? (
          <Awaiting note="هنوز نگهبانی ساخته نشده." />
        ) : (
          <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 11 }}>
            {wfList.map((w) => {
              const sev = SEV[w.defaultSeverity] || SEV.info;
              const last = w.lastRun;
              const rl = resultLine(w.lastResult);
              return (
                <Box key={w.key} style={CARD}>
                  <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '13.5px', fontWeight: 600, color: 'var(--g-color-text-primary)' }}>{w.name}</Text>
                    <Box style={{ fontFamily: 'var(--g-font-fa)', fontSize: '10px', fontWeight: 600, color: sev.fg, background: sev.bg, borderRadius: '6px', padding: '2px 7px', flexShrink: 0 }}>{sev.label}</Box>
                  </Box>
                  <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', color: 'var(--g-color-text-secondary)', lineHeight: 1.7, margin: '6px 0 0' }}>{w.description}</Text>
                  <Box style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBlockStart: 10, fontFamily: 'var(--g-font-fa)', fontSize: '11px', color: 'var(--g-color-text-muted)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconClock size={13} stroke={1.7} />{cadenceFa(w.intervalSec)}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconSitemap size={13} stroke={1.7} />{toFaDigits(w.nodeCount)} مرحله</span>
                  </Box>
                  {/* the guard's auto-reported state — what its last (scheduled or manual) run found, no click needed */}
                  <Box style={{ display: 'flex', alignItems: 'center', gap: 6, marginBlockStart: 9 }}>
                    <Box aria-hidden="true" style={{ inlineSize: 7, blockSize: 7, borderRadius: '50%', flexShrink: 0, background: rl.color }} />
                    <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', color: rl.color, fontWeight: 500 }}>{rl.text}</Text>
                    {last ? <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '10.5px', color: 'var(--g-color-text-muted)' }}>· {agoFa(last.startedAt)}</Text> : null}
                  </Box>
                  {w.runbook ? (
                    <Text component="div" title={w.runbook.steps} style={{ fontFamily: 'var(--g-font-fa)', fontSize: '10.5px', color: 'var(--g-color-text-muted)', marginBlockStart: 8, lineHeight: 1.65, paddingBlockStart: 8, borderBlockStart: '1px dashed var(--g-color-border-subtle)' }}>
                      <b style={{ color: 'var(--g-color-text-secondary)' }}>مسئول:</b> {w.runbook.ownerRole} — {w.runbook.expectedAction}
                    </Text>
                  ) : null}
                  <UnstyledButton type="button" onClick={() => { const reason = askReason('دلیلِ اجرای دستیِ این نگهبان؟'); if (reason) runMut.mutate({ key: w.key, reason }); }} disabled={runMut.isPending}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBlockStart: 11, minBlockSize: 34, paddingInline: 13, borderRadius: '9px', border: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-canvas)', color: 'var(--g-color-text-primary)', fontFamily: 'var(--g-font-fa)', fontSize: '12px', fontWeight: 500, opacity: runMut.isPending && runMut.variables?.key === w.key ? 0.6 : 1 }}>
                    <IconPlayerPlay size={14} stroke={1.8} />{runMut.isPending && runMut.variables?.key === w.key ? 'در حال بررسی…' : 'بررسیِ دستی'}
                  </UnstyledButton>
                </Box>
              );
            })}
          </Box>
        )}
      </Section>

      <Note icon={IconAlertTriangle} tone="info">
        یادداشت: نگهبان‌ها خودکار و طبق زمان‌بندی اجرا می‌شوند و وضعیتشان را روی همین کارت‌ها گزارش می‌دهند — لازم نیست کاری کنی.
        دکمهٔ «بررسیِ دستی» فقط برای وقتی است که بخواهی همین لحظه دوباره چک شود. یک مشکلِ تکرارشونده فقط یک پرچم می‌سازد (نه پرچمِ تکراری) تا «رسیدگی شد» را بزنی.
      </Note>
    </Box>
  );
}
