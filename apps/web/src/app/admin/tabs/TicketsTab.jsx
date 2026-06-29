// «تیکت‌ها» — admin support inbox (own tab, pulled out of ModerationTab). Metrics + filterable queue + a full
// dossier drawer: conversation thread, staff reply (fires the user notification), triage (status/priority/category/
// assignee/tags), and internal admin-only notes. Backed by the verified /admin/tickets* endpoints.
import { useState } from 'react';
import { Box, Text, Loader, UnstyledButton, Drawer, Textarea, Select } from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  IconTicket, IconSearch, IconClockExclamation, IconClockHour4, IconInbox, IconX,
  IconSend, IconNote, IconUserCheck, IconHeadset, IconUserCircle, IconAlertTriangle,
} from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';
import { Section, Kpi, Panel, Awaiting, grid, toFaDigits, fmtInt } from '../_ui';

const get = (url) => apiClient.get(url).then((r) => r.data);
const STATUS = {
  open: ['باز', 'var(--g-color-state-info-bg)', 'var(--g-color-text-secondary)'],
  pending: ['در انتظار', 'var(--g-color-state-warning-bg, #fdf3e3)', 'var(--g-color-state-warning-fg, #8a5a14)'],
  in_progress: ['در حال بررسی', 'var(--g-color-brand-50)', 'var(--g-color-brand-700)'],
  resolved: ['حل‌شده', 'var(--g-color-state-success-bg)', 'var(--g-color-state-success-fg)'],
  closed: ['بسته', 'var(--g-color-bg-canvas)', 'var(--g-color-text-muted)'],
};
const PRIORITY = { low: ['کم', 'var(--g-color-text-muted)'], normal: ['عادی', 'var(--g-color-text-secondary)'], high: ['زیاد', 'var(--g-color-state-warning-fg, #c0801c)'], urgent: ['فوری', 'var(--g-color-state-danger-fg, #b3261e)'] };
const CATEGORY = { general: 'عمومی', account: 'حساب کاربری', technical: 'فنی', billing: 'پرداخت', feature: 'ویژگی', content: 'محتوا' };
const STATUS_OPTS = Object.keys(STATUS).map((v) => ({ value: v, label: STATUS[v][0] }));
const PRIORITY_OPTS = Object.keys(PRIORITY).map((v) => ({ value: v, label: PRIORITY[v][0] }));
const CATEGORY_OPTS = Object.keys(CATEGORY).map((v) => ({ value: v, label: CATEGORY[v] }));
const FILTERS = [
  { id: 'all', label: 'همه', q: {} },
  { id: 'active', label: 'فعال', q: { status: 'active' } },
  { id: 'unanswered', label: 'بی‌پاسخ', q: { unanswered: 'true' } },
  { id: 'in_progress', label: 'در بررسی', q: { status: 'in_progress' } },
  { id: 'resolved', label: 'حل‌شده', q: { status: 'resolved' } },
  { id: 'closed', label: 'بسته', q: { status: 'closed' } },
];
const ago = (d) => {
  if (!d) return '—';
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'هم‌اکنون';
  if (m < 60) return toFaDigits(m) + 'د پیش';
  const h = Math.floor(m / 60);
  if (h < 24) return toFaDigits(h) + 'س پیش';
  const dd = Math.floor(h / 24);
  return dd < 30 ? toFaDigits(dd) + 'ر پیش' : toFaDigits(String(d).slice(0, 10));
};
const dur = (mins) => (mins == null ? '—' : mins < 60 ? toFaDigits(mins) + ' دقیقه' : toFaDigits(Math.round(mins / 60)) + ' ساعت');

function Tag({ children, bg, fg }) {
  return <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '10.5px', fontWeight: 600, paddingInline: 8, paddingBlock: 2, borderRadius: '6px', background: bg, color: fg, whiteSpace: 'nowrap' }}>{children}</Text>;
}
const StatusTag = ({ s }) => { const [l, bg, fg] = STATUS[s] || STATUS.open; return <Tag bg={bg} fg={fg}>{l}</Tag>; };
const PrioTag = ({ p }) => { const [l, c] = PRIORITY[p] || PRIORITY.normal; return <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', fontWeight: 600, color: c }}>{l}</Text>; };
const fieldStyles = { input: { fontFamily: 'var(--g-font-fa)', fontSize: '13px' }, label: { fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', fontWeight: 600, marginBlockEnd: 4 } };
const tdS = { padding: '9px 8px', fontSize: '12.5px', color: 'var(--g-color-text-primary)', borderBlockEnd: '1px solid var(--g-color-border-subtle)', verticalAlign: 'middle', fontFamily: 'var(--g-font-fa)' };

function Chip({ on, children, onClick }) {
  return <UnstyledButton type="button" onClick={onClick} style={{ minBlockSize: 30, paddingInline: 12, borderRadius: '9px', fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', fontWeight: on ? 500 : 400, background: on ? 'var(--g-color-brand-600)' : 'var(--g-color-bg-surface)', color: on ? 'var(--g-color-text-inverse)' : 'var(--g-color-text-secondary)', border: `1px solid ${on ? 'var(--g-color-brand-600)' : 'var(--g-color-border-subtle)'}` }}>{children}</UnstyledButton>;
}

export default function TicketsTab() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);

  const metrics = useQuery({ queryKey: ['admin', 'tickets', 'metrics'], queryFn: () => get('/admin/tickets/metrics') });
  const fq = FILTERS.find((f) => f.id === filter)?.q || {};
  const qs = new URLSearchParams({ limit: '50', sort: 'activity', ...(search ? { search } : {}), ...fq }).toString();
  const list = useQuery({ queryKey: ['admin', 'tickets', qs], queryFn: () => get('/admin/tickets?' + qs), placeholderData: (p) => p });

  const m = metrics.data || {};
  const rows = list.data?.data || [];

  return (
    <>
      <Box style={grid(184)}>
        <Kpi icon={IconTicket} label="کل تیکت‌ها" status="real" value={fmtInt(m.total)} sub="ثبت‌شده" />
        <Kpi icon={IconInbox} label="بازِ فعال" status="real" value={fmtInt(m.active)} sub="نیازمندِ رسیدگی" tone={m.active > 0 ? 'warn' : undefined} />
        <Kpi icon={IconClockExclamation} label="بی‌پاسخ" status={m.unanswered > 0 ? 'partial' : 'real'} value={fmtInt(m.unanswered)} sub="هنوز پاسخِ اول نگرفته" tone={m.unanswered > 0 ? 'warn' : undefined} />
        <Kpi icon={IconClockHour4} label="میانگینِ اولین‌پاسخ" status={m.avgFirstResponseMins != null ? 'real' : 'awaiting_pilot'} value={dur(m.avgFirstResponseMins)} sub={`حل: ${dur(m.avgResolutionMins)}`} awaitNote="—" />
      </Box>

      <Section title="صندوقِ تیکت‌ها" />
      <Box style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBlockEnd: 11 }}>
        <Box style={{ position: 'relative', flex: 1, minInlineSize: 200 }}>
          <IconSearch size={15} stroke={1.8} style={{ position: 'absolute', insetInlineStart: 11, insetBlockStart: '50%', transform: 'translateY(-50%)', color: 'var(--g-color-text-muted)' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجو در موضوع، متن یا نامِ کاربر…" style={{ inlineSize: '100%', minBlockSize: 38, paddingInline: '34px 12px', borderRadius: '10px', border: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface)', fontFamily: 'var(--g-font-fa)', fontSize: '12.5px', color: 'var(--g-color-text-primary)' }} />
        </Box>
        <Box style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => <Chip key={f.id} on={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</Chip>)}
        </Box>
      </Box>

      <Panel>
        {list.isLoading ? (
          <Box style={{ display: 'grid', placeItems: 'center', paddingBlock: 30 }}><Loader size="sm" color="var(--g-color-brand-600)" /></Box>
        ) : rows.length ? (
          <Box style={{ overflowX: 'auto' }}>
            <Box component="table" style={{ inlineSize: '100%', borderCollapse: 'collapse' }}>
              <Box component="thead"><Box component="tr">
                {['موضوع', 'کاربر', 'دسته', 'اولویت', 'وضعیت', 'پاسخ', 'فعالیت'].map((h) => <Box component="th" key={h} style={{ textAlign: 'start', padding: '7px 8px', fontSize: '11px', fontWeight: 500, color: 'var(--g-color-text-muted)', borderBlockEnd: '1px solid var(--g-color-border-subtle)', whiteSpace: 'nowrap', fontFamily: 'var(--g-font-fa)' }}>{h}</Box>)}
              </Box></Box>
              <Box component="tbody">
                {rows.map((t) => (
                  <Box component="tr" key={t.id} onClick={() => setSelectedId(t.id)} style={{ cursor: 'pointer' }}>
                    <Box component="td" style={{ ...tdS, fontWeight: 500, maxInlineSize: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}{t.firstResponseAt ? null : <Box aria-hidden="true" style={{ display: 'inline-block', inlineSize: 7, blockSize: 7, borderRadius: '50%', background: 'var(--g-color-state-warning-fg, #c0801c)', marginInlineStart: 6 }} />}</Box>
                    <Box component="td" style={{ ...tdS, color: 'var(--g-color-text-secondary)' }}>{t.user?.name || '—'}</Box>
                    <Box component="td" style={{ ...tdS, color: 'var(--g-color-text-muted)', fontSize: '11.5px' }}>{CATEGORY[t.category] || 'عمومی'}</Box>
                    <Box component="td" style={tdS}><PrioTag p={t.priority} /></Box>
                    <Box component="td" style={tdS}><StatusTag s={t.status} /></Box>
                    <Box component="td" style={{ ...tdS, textAlign: 'center', color: 'var(--g-color-text-muted)' }}>{toFaDigits(t._count?.replies ?? 0)}</Box>
                    <Box component="td" style={{ ...tdS, color: 'var(--g-color-text-muted)', fontSize: '11.5px' }}>{ago(t.lastReplyAt || t.createdAt)}</Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        ) : <Awaiting note="تیکتی با این فیلتر نیست." icon={IconTicket} />}
      </Panel>

      <Drawer opened={!!selectedId} onClose={() => setSelectedId(null)} position="left" size={460} withCloseButton={false} padding={0} overlayProps={{ opacity: 0.4 }}>
        {selectedId ? <TicketDetail id={selectedId} onClose={() => setSelectedId(null)} /> : null}
      </Drawer>
    </>
  );
}

function TicketDetail({ id, onClose }) {
  const qc = useQueryClient();
  const detail = useQuery({ queryKey: ['admin', 'ticket', id], queryFn: () => get('/admin/tickets/' + id) });
  const [reply, setReply] = useState('');
  const [note, setNote] = useState('');
  const t = detail.data;

  const inval = () => { qc.invalidateQueries({ queryKey: ['admin', 'tickets'] }); qc.invalidateQueries({ queryKey: ['admin', 'ticket', id] }); };
  const respondM = useMutation({ mutationFn: (message) => apiClient.post(`/admin/tickets/${id}/respond`, { message }), onSuccess: () => { setReply(''); inval(); } });
  const updateM = useMutation({ mutationFn: (body) => apiClient.patch(`/admin/tickets/${id}`, body), onSuccess: inval });
  const noteM = useMutation({ mutationFn: (body) => apiClient.post(`/admin/tickets/${id}/notes`, { body }), onSuccess: () => { setNote(''); inval(); } });

  if (detail.isLoading || !t) return <Box style={{ display: 'grid', placeItems: 'center', minBlockSize: 200 }}><Loader color="var(--g-color-brand-600)" /></Box>;

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', minBlockSize: '100dvh' }}>
      <Box style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, padding: '15px 18px', borderBlockEnd: '1px solid var(--g-color-border-subtle)' }}>
        <Box style={{ minInlineSize: 0 }}>
          <Box style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '15px', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>{t.subject}</Text><StatusTag s={t.status} /></Box>
          <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '12px', color: 'var(--g-color-text-muted)', marginBlockStart: 2 }}>{t.user?.name || 'کاربر'} · <span style={{ direction: 'ltr' }}>{t.user?.phone || t.user?.email || '—'}</span></Text>
        </Box>
        <UnstyledButton type="button" onClick={onClose} aria-label="بستن" style={{ inlineSize: 30, blockSize: 30, borderRadius: '8px', display: 'grid', placeItems: 'center', color: 'var(--g-color-text-muted)', flexShrink: 0 }}><IconX size={18} /></UnstyledButton>
      </Box>

      <Box style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* triage */}
        <Box style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <Select label="وضعیت" data={STATUS_OPTS} value={t.status} onChange={(v) => v && updateM.mutate({ status: v })} allowDeselect={false} size="xs" styles={fieldStyles} comboboxProps={{ withinPortal: false }} />
          <Select label="اولویت" data={PRIORITY_OPTS} value={t.priority} onChange={(v) => v && updateM.mutate({ priority: v })} allowDeselect={false} size="xs" styles={fieldStyles} comboboxProps={{ withinPortal: false }} />
          <Select label="دسته" data={CATEGORY_OPTS} value={t.category} onChange={(v) => v && updateM.mutate({ category: v })} allowDeselect={false} size="xs" styles={fieldStyles} comboboxProps={{ withinPortal: false }} />
        </Box>

        {/* thread */}
        <Box>
          <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11px', fontWeight: 600, color: 'var(--g-color-text-muted)', marginBlockEnd: 7 }}>گفت‌وگو</Text>
          <Box style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[{ isStaff: false, message: t.message, createdAt: t.createdAt }, ...(t.replies || [])].map((r, i) => (
              <Box key={i} style={{ display: 'flex', gap: 7, flexDirection: r.isStaff ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
                <Box aria-hidden="true" style={{ inlineSize: 26, blockSize: 26, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center', background: r.isStaff ? 'var(--g-color-brand-600)' : 'var(--g-color-bg-canvas)', color: r.isStaff ? '#fff' : 'var(--g-color-text-secondary)', border: r.isStaff ? 'none' : '1px solid var(--g-color-border-subtle)' }}>{r.isStaff ? <IconHeadset size={14} stroke={1.8} /> : <IconUserCircle size={15} stroke={1.7} />}</Box>
                <Box style={{ maxInlineSize: '85%', padding: '8px 11px', borderRadius: '12px', background: r.isStaff ? 'var(--g-color-brand-50)' : 'var(--g-color-bg-surface)', border: `1px solid ${r.isStaff ? 'var(--g-color-brand-200)' : 'var(--g-color-border-subtle)'}` }}>
                  <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '13px', color: 'var(--g-color-text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{r.message}</Text>
                  <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '9.5px', color: 'var(--g-color-text-muted)', marginBlockStart: 3, textAlign: 'end' }}>{r.isStaff ? 'پشتیبانی' : 'کاربر'} · {ago(r.createdAt)}</Text>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        {/* reply composer */}
        <Box style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="پاسخ به کاربر…" autosize minRows={2} maxRows={6} styles={fieldStyles} />
          <UnstyledButton type="button" onClick={() => reply.trim() && respondM.mutate(reply.trim())} disabled={!reply.trim() || respondM.isPending} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minBlockSize: 40, borderRadius: '10px', background: 'var(--g-color-brand-600)', color: '#fff', fontFamily: 'var(--g-font-fa)', fontSize: '13px', fontWeight: 600, opacity: reply.trim() ? 1 : 0.5 }}>{respondM.isPending ? <Loader size={15} color="#fff" /> : <><IconSend size={15} stroke={1.8} />ارسالِ پاسخ</>}</UnstyledButton>
        </Box>

        {/* internal notes */}
        <Box style={{ background: 'var(--g-color-state-warning-bg, #fdf7ec)', border: '1px solid var(--g-color-state-warning-fg, #e8d3a8)', borderRadius: '12px', padding: '11px 13px' }}>
          <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBlockEnd: 7 }}><IconNote size={14} stroke={1.8} style={{ color: 'var(--g-color-state-warning-fg, #8a5a14)' }} /><Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', fontWeight: 600, color: 'var(--g-color-state-warning-fg, #8a5a14)' }}>یادداشتِ داخلی (کاربر نمی‌بیند)</Text></Box>
          {(t.notes || []).map((n) => (
            <Box key={n.id} style={{ fontFamily: 'var(--g-font-fa)', fontSize: '12px', color: 'var(--g-color-text-primary)', paddingBlock: 4, borderBlockStart: '1px solid var(--g-color-border-subtle)' }}>{n.body} <Text component="span" style={{ fontSize: '9.5px', color: 'var(--g-color-text-muted)' }}>· {ago(n.createdAt)}</Text></Box>
          ))}
          <Box style={{ display: 'flex', gap: 6, marginBlockStart: 7 }}>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="یادداشت…" style={{ flex: 1, minBlockSize: 34, paddingInline: 10, borderRadius: '8px', border: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface)', fontFamily: 'var(--g-font-fa)', fontSize: '12px' }} />
            <UnstyledButton type="button" onClick={() => note.trim() && noteM.mutate(note.trim())} disabled={!note.trim() || noteM.isPending} style={{ paddingInline: 12, minBlockSize: 34, borderRadius: '8px', background: 'var(--g-color-text-secondary)', color: '#fff', fontFamily: 'var(--g-font-fa)', fontSize: '12px', display: 'grid', placeItems: 'center' }}>افزودن</UnstyledButton>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
