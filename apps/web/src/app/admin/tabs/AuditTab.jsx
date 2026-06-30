import { useEffect, useState } from 'react';
import { Box, Text, Loader, UnstyledButton } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { IconSearch, IconShieldLock } from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';
import { Section, Panel, ErrorState, Awaiting, Table, toFaDigits } from '../_ui';

const get = (url) => apiClient.get(url).then((r) => r.data);
const dayTime = (d) => (d ? toFaDigits(new Date(d).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' })) : '—');
const riskFa = (r) => ({ high: 'بالا', medium: 'متوسط', low: 'پایین' }[r] || '—');
const riskColor = (r) => r === 'high' ? 'var(--g-color-state-danger-fg, #b3261e)' : r === 'medium' ? 'var(--g-color-state-warning-fg, #8a5a14)' : 'var(--g-color-text-muted)';

const inputS = { minBlockSize: 36, borderRadius: '9px', border: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-primary)', fontFamily: 'var(--g-font-fa)', fontSize: '12.5px', paddingInline: 10 };

export default function AuditTab() {
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState({ action: '', actorId: '', targetId: '', riskLevel: 'all' });
  const [filters, setFilters] = useState(draft);
  useEffect(() => { setPage(1); }, [filters.action, filters.actorId, filters.targetId, filters.riskLevel]);

  const qs = new URLSearchParams({
    page: String(page),
    limit: '50',
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.actorId ? { actorId: filters.actorId } : {}),
    ...(filters.targetId ? { targetId: filters.targetId } : {}),
    ...(filters.riskLevel && filters.riskLevel !== 'all' ? { riskLevel: filters.riskLevel } : {}),
  }).toString();
  const q = useQuery({ queryKey: ['admin', 'audit-logs', qs], queryFn: () => get('/admin/audit-logs?' + qs), placeholderData: (p) => p });

  const rows = q.data?.data || [];
  const total = q.data?.total || 0;
  const pages = Math.max(1, Math.ceil(total / 50));
  const cols = [
    { key: 'createdAt', label: 'زمان', render: (r) => dayTime(r.createdAt) },
    { key: 'riskLevel', label: 'ریسک', align: 'center', render: (r) => <Text component="span" style={{ color: riskColor(r.riskLevel), fontWeight: 600 }}>{riskFa(r.riskLevel)}</Text> },
    { key: 'action', label: 'اکشن' },
    { key: 'actorId', label: 'عامل', render: (r) => <Text component="span" style={{ direction: 'ltr', display: 'inline-block' }}>{r.actorId || '—'}</Text> },
    { key: 'targetId', label: 'هدف', render: (r) => <Text component="span" style={{ direction: 'ltr', display: 'inline-block' }}>{r.targetType || '—'} · {r.targetId || '—'}</Text> },
    { key: 'reason', label: 'دلیل', render: (r) => r.reason || '—' },
  ];

  return (
    <>
      <Section title="دفتر ممیزی ادمین" sub="owner-only · اکشن‌های حساس با actor/target/reason/risk قابل جست‌وجو" />
      <Panel>
        <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8, marginBlockEnd: 10 }}>
          <input value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })} placeholder="اکشن..." style={inputS} />
          <input value={draft.actorId} onChange={(e) => setDraft({ ...draft, actorId: e.target.value })} placeholder="actorId" dir="ltr" style={inputS} />
          <input value={draft.targetId} onChange={(e) => setDraft({ ...draft, targetId: e.target.value })} placeholder="targetId" dir="ltr" style={inputS} />
          <select value={draft.riskLevel} onChange={(e) => setDraft({ ...draft, riskLevel: e.target.value })} style={inputS}>
            <option value="all">همه ریسک‌ها</option>
            <option value="high">بالا</option>
            <option value="medium">متوسط</option>
            <option value="low">پایین</option>
          </select>
          <UnstyledButton type="button" onClick={() => setFilters({ ...draft, action: draft.action.trim(), actorId: draft.actorId.trim(), targetId: draft.targetId.trim() })} style={{ minBlockSize: 36, borderRadius: '9px', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: '12.5px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <IconSearch size={14} stroke={1.8} />جست‌وجو
          </UnstyledButton>
        </Box>
        {q.isLoading ? (
          <Box style={{ display: 'grid', placeItems: 'center', paddingBlock: 30 }}><Loader size="sm" color="var(--g-color-brand-600)" /></Box>
        ) : q.isError ? (
          <ErrorState note={q.error?.response?.status === 403 ? 'این دفتر فقط برای مالک پنل باز است.' : 'دفتر ممیزی از سرور خوانده نشد.'} onRetry={() => q.refetch()} />
        ) : rows.length ? (
          <>
            <Table columns={cols} rows={rows} />
            <Pager page={page} pages={pages} total={total} onPage={setPage} />
          </>
        ) : <Awaiting icon={IconShieldLock} note="هیچ audit log مطابق این فیلتر پیدا نشد." />}
      </Panel>
    </>
  );
}

function Pager({ page, pages, total, onPage }) {
  return (
    <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBlockStart: 12, fontFamily: 'var(--g-font-fa)', fontSize: '12px', color: 'var(--g-color-text-secondary)' }}>
      <Text component="span">{toFaDigits(total)} ردیف · صفحه {toFaDigits(page)} از {toFaDigits(pages)}</Text>
      <Box style={{ display: 'inline-flex', gap: 6 }}>
        <UnstyledButton type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} style={btnS(page <= 1)}>قبلی</UnstyledButton>
        <UnstyledButton type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} style={btnS(page >= pages)}>بعدی</UnstyledButton>
      </Box>
    </Box>
  );
}

const btnS = (disabled) => ({ minBlockSize: 32, paddingInline: 12, borderRadius: '8px', border: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-primary)', fontFamily: 'var(--g-font-fa)', fontSize: '12px', opacity: disabled ? 0.45 : 1 });
