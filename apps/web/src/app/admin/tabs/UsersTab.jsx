// «کاربران» — full admin user control + live monitoring (founder mandate: "do anything, watch moment-by-moment").
// Roster (search + role/status filters) → per-user dossier drawer → every action behind the security layers from the
// advisor audit: owner-gated destructive ops (P0-1), mandatory reason + typed-confirm (P0-2), risk-tiered grouping
// (P1-9). All wired to /admin/users/*; a 403 (super_admin_required) / 400 (reason_required) shows a clear message.
import { useState, useEffect } from 'react';
import { Box, Text, Loader, UnstyledButton, Drawer, Modal, TextInput, PasswordInput, Switch } from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  IconUsers, IconSearch, IconUserPlus, IconShield, IconShieldOff, IconBan, IconLockOpen,
  IconLogout, IconTrash, IconKey, IconDownload, IconDeviceMobile, IconX, IconAlertTriangle, IconUserStar,
} from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';
import { Section, Kpi, Panel, Note, Awaiting, ErrorState, grid, toFaDigits, fmtInt } from '../_ui';

const get = (url) => apiClient.get(url).then((r) => r.data);
const post = (url, body) => apiClient.post(url, body).then((r) => r.data); // P0-3: sensitive reads go via POST + body
const day = (d) => (d ? toFaDigits(String(d).slice(0, 10)) : '—');
const ago = (d) => {
  if (!d) return 'بدونِ فعالیت';
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'هم‌اکنون';
  if (m < 60) return toFaDigits(m) + ' دقیقه پیش';
  const h = Math.floor(m / 60);
  if (h < 24) return toFaDigits(h) + ' ساعت پیش';
  const dd = Math.floor(h / 24);
  return dd < 30 ? toFaDigits(dd) + ' روز پیش' : day(d);
};

const FILTERS = [
  { id: 'all', label: 'همه', q: {} },
  { id: 'registered', label: 'ثبت‌شده', q: { role: 'registered' } },
  { id: 'guest', label: 'مهمان', q: { role: 'guest' } },
  { id: 'admin', label: 'مدیر', q: { role: 'admin' } },
  { id: 'banned', label: 'مسدود', q: { status: 'banned' } },
];

function Chip({ on, children, onClick }) {
  return (
    <UnstyledButton type="button" onClick={onClick} style={{ minBlockSize: 30, paddingInline: 12, borderRadius: '9px', fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', fontWeight: on ? 500 : 400, background: on ? 'var(--g-color-brand-600)' : 'var(--g-color-bg-surface)', color: on ? 'var(--g-color-text-inverse)' : 'var(--g-color-text-secondary)', border: `1px solid ${on ? 'var(--g-color-brand-600)' : 'var(--g-color-border-subtle)'}` }}>{children}</UnstyledButton>
  );
}

function Tag({ children, tone = 'info' }) {
  const map = {
    info: ['var(--g-color-state-info-bg)', 'var(--g-color-text-secondary)'],
    brand: ['var(--g-color-brand-50)', 'var(--g-color-brand-700)'],
    success: ['var(--g-color-state-success-bg)', 'var(--g-color-state-success-fg)'],
    danger: ['var(--g-color-state-danger-bg, #fdeceb)', 'var(--g-color-state-danger-fg, #b3261e)'],
    muted: ['var(--g-color-bg-canvas)', 'var(--g-color-text-muted)'],
  };
  const [bg, fg] = map[tone] || map.info;
  return <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '10.5px', fontWeight: 500, paddingInline: 8, paddingBlock: 2, borderRadius: '6px', background: bg, color: fg, whiteSpace: 'nowrap' }}>{children}</Text>;
}

const roleTag = (u) => (u.isAdmin ? <Tag tone="brand">مدیر</Tag> : u.isGuest ? <Tag tone="muted">مهمان</Tag> : <Tag tone="info">کاربر</Tag>);
const contact = (u) => u.phone || u.email || '—';

// Action button used inside the dossier drawer.
function Act({ icon: Icon, label, tone = 'default', onClick, loading, disabled }) {
  const danger = tone === 'danger';
  return (
    <UnstyledButton type="button" onClick={onClick} disabled={disabled || loading} style={{ display: 'flex', alignItems: 'center', gap: 9, inlineSize: '100%', minBlockSize: 42, paddingInline: 13, borderRadius: '11px', border: `1px solid ${danger ? 'var(--g-color-state-danger-fg, #b3261e)' : 'var(--g-color-border-subtle)'}`, background: 'var(--g-color-bg-surface)', color: danger ? 'var(--g-color-state-danger-fg, #b3261e)' : 'var(--g-color-text-primary)', fontFamily: 'var(--g-font-fa)', fontSize: '13px', opacity: disabled ? 0.5 : 1 }}>
      <Icon size={17} stroke={1.7} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, textAlign: 'start' }}>{label}</span>
      {loading ? <Loader size={14} color="var(--g-color-brand-600)" /> : null}
    </UnstyledButton>
  );
}

const fieldStyles = { input: { fontFamily: 'var(--g-font-fa)', fontSize: '13px' }, label: { fontFamily: 'var(--g-font-fa)', fontSize: '12px', marginBlockEnd: 4 } };

export default function UsersTab() {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [danger, setDanger] = useState(null); // { kind:'role'|'password'|'ban'|'export'|'delete', user } — unified P0-2 modal
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState(null);
  const [revealed, setRevealed] = useState(null); // {phone,email} — real PII for the open dossier (P0-5 reveal)

  useEffect(() => { const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 400); return () => clearTimeout(t); }, [searchInput]);
  useEffect(() => { setRevealed(null); }, [selectedId]); // a new dossier starts masked again

  const fq = FILTERS.find((f) => f.id === filter)?.q || {};
  const qs = new URLSearchParams({ page: String(page), limit: '20', ...(search ? { search } : {}), ...fq }).toString();

  const stats = useQuery({ queryKey: ['admin', 'users', 'stats'], queryFn: () => get('/admin/users/stats') });
  const list = useQuery({ queryKey: ['admin', 'users', qs], queryFn: () => get('/admin/users?' + qs), placeholderData: (prev) => prev });
  const detail = useQuery({ queryKey: ['admin', 'user', selectedId], queryFn: () => get('/admin/users/' + selectedId), enabled: !!selectedId });

  const closeDanger = () => { setDanger(null); setExportErr(null); };
  // shared onSuccess: refresh the roster + the open dossier, then run the per-mutation follow-up (close a modal, etc).
  const onDone = (extra) => ({ onSuccess: (...a) => { qc.invalidateQueries({ queryKey: ['admin', 'users'] }); if (selectedId) qc.invalidateQueries({ queryKey: ['admin', 'user', selectedId] }); if (extra) extra(...a); } });
  const createM = useMutation({ mutationFn: (body) => apiClient.post('/admin/users', body), ...onDone(() => setCreateOpen(false)) });
  const updateM = useMutation({ mutationFn: ({ id, body }) => apiClient.patch('/admin/users/' + id, body), ...onDone(closeDanger) });
  const pwM = useMutation({ mutationFn: ({ id, password, reason }) => apiClient.patch('/admin/users/' + id + '/password', { password, reason }), ...onDone(closeDanger) });
  const banM = useMutation({ mutationFn: ({ id, banned, reason }) => apiClient.post('/admin/users/' + id + '/ban', { banned, reason }), ...onDone(closeDanger) });
  const logoutM = useMutation({ mutationFn: ({ id }) => apiClient.post('/admin/users/' + id + '/force-logout'), ...onDone() });
  const delM = useMutation({ mutationFn: ({ id, reason }) => apiClient.delete('/admin/users/' + id, { data: { reason } }), ...onDone(() => { closeDanger(); setSelectedId(null); }) });

  // export now carries a mandatory reason (owner-gated + audited server-side) and THROWS on failure so the modal can show it.
  const exportUser = async (id, name, reason) => {
    const data = await post('/admin/users/' + id + '/export', { reason }); // P0-3: reason in body, never the URL
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `user-${(name || id).toString().slice(0, 16)}.json`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  };

  // dispatch the confirmed sensitive op (reason already validated by the modal).
  const onDanger = async ({ reason, password }) => {
    const usr = danger?.user; if (!usr) return;
    if (danger.kind === 'role') updateM.mutate({ id: usr.id, body: { isAdmin: !usr.isAdmin, reason } });
    else if (danger.kind === 'password') pwM.mutate({ id: usr.id, password, reason });
    else if (danger.kind === 'ban') banM.mutate({ id: usr.id, banned: true, reason });
    else if (danger.kind === 'delete') delM.mutate({ id: usr.id, reason });
    else if (danger.kind === 'export') { setExporting(true); setExportErr(null); try { await exportUser(usr.id, usr.name, reason); closeDanger(); } catch (e) { setExportErr(e); } finally { setExporting(false); } }
    else if (danger.kind === 'reveal') { setExporting(true); setExportErr(null); try { const d = await post('/admin/users/' + usr.id + '/reveal', { reason }); setRevealed(d); closeDanger(); } catch (e) { setExportErr(e); } finally { setExporting(false); } }
  };

  const s = stats.data || {};
  const rows = list.data?.data || [];
  const total = list.data?.total || 0;
  const pages = Math.ceil(total / 20);
  const u = detail.data; // selected user dossier
  const dangerBusy = updateM.isPending || pwM.isPending || banM.isPending || delM.isPending || exporting;
  const dangerError = updateM.error || pwM.error || banM.error || delM.error || exportErr;

  return (
    <>
      <Box style={grid(150)}>
        <Kpi icon={IconUsers} label="کل کاربران" status="real" value={fmtInt(s.total)} sub="ثبت‌شده در پایگاه" />
        <Kpi icon={IconUserStar} label="ثبت‌شده" status="real" value={fmtInt(s.registered)} sub={`${toFaDigits(s.guests ?? 0)} مهمان`} />
        <Kpi icon={IconShield} label="مدیران" status="real" value={fmtInt(s.admins)} sub="نقشِ admin" />
        <Kpi icon={IconBan} label="مسدودشده" status={s.banned > 0 ? 'partial' : 'real'} value={fmtInt(s.banned)} sub="حساب‌های مسدود" tone={s.banned > 0 ? 'warn' : undefined} />
      </Box>

      <Section title="فهرستِ کاربران" right={
        <UnstyledButton type="button" onClick={() => setCreateOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minBlockSize: 32, paddingInline: 12, borderRadius: '9px', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: '12px', fontWeight: 500 }}>
          <IconUserPlus size={15} stroke={1.8} /> افزودنِ کاربر
        </UnstyledButton>
      } />

      <Box style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBlockEnd: 11 }}>
        <Box style={{ position: 'relative', flex: 1, minInlineSize: 200 }}>
          <IconSearch size={15} stroke={1.8} style={{ position: 'absolute', insetInlineStart: 11, insetBlockStart: '50%', transform: 'translateY(-50%)', color: 'var(--g-color-text-muted)' }} />
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="جستجو با نام، تلفن یا ایمیل…" style={{ inlineSize: '100%', minBlockSize: 38, paddingInline: '34px 12px', borderRadius: '10px', border: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface)', fontFamily: 'var(--g-font-fa)', fontSize: '12.5px', color: 'var(--g-color-text-primary)' }} />
        </Box>
        <Box style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => <Chip key={f.id} on={filter === f.id} onClick={() => { setFilter(f.id); setPage(1); }}>{f.label}</Chip>)}
        </Box>
      </Box>

      <Panel>
        {list.isLoading ? (
          <Box style={{ display: 'grid', placeItems: 'center', paddingBlock: 30 }}><Loader size="sm" color="var(--g-color-brand-600)" /></Box>
        ) : list.isError ? (
          <ErrorState note="فهرستِ کاربران از سرور خوانده نشد." onRetry={() => list.refetch()} />
        ) : rows.length ? (
          <Box style={{ overflowX: 'auto' }}>
            <Box component="table" style={{ inlineSize: '100%', borderCollapse: 'collapse', fontFamily: 'var(--g-font-fa)' }}>
              <Box component="thead"><Box component="tr">
                {['کاربر', 'تماس', 'نقش', 'وضعیت', 'فعالیت', 'عضویت'].map((h) => <Box component="th" key={h} style={{ textAlign: 'start', padding: '7px 8px', fontSize: '11px', fontWeight: 500, color: 'var(--g-color-text-muted)', borderBlockEnd: '1px solid var(--g-color-border-subtle)', whiteSpace: 'nowrap' }}>{h}</Box>)}
              </Box></Box>
              <Box component="tbody">
                {rows.map((r) => (
                  <Box component="tr" key={r.id} role="button" tabIndex={0} aria-label={`پروندهٔ ${r.name || 'کاربرِ بی‌نام'}`} onClick={() => setSelectedId(r.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(r.id); } }} style={{ cursor: 'pointer' }} className="adminUserRow">
                    <Box component="td" style={tdS}>
                      <Text component="span" style={{ fontWeight: 500, fontSize: '12.5px' }}>{r.name || <span style={{ color: 'var(--g-color-text-muted)' }}>بی‌نام</span>}</Text>
                      {r.country ? <Text component="span" style={{ color: 'var(--g-color-text-muted)', fontSize: '11px', marginInlineStart: 6 }}>{r.country}</Text> : null}
                    </Box>
                    <Box component="td" style={{ ...tdS, color: 'var(--g-color-text-secondary)', direction: 'ltr', textAlign: 'start' }}>{contact(r)}</Box>
                    <Box component="td" style={tdS}>{roleTag(r)}</Box>
                    <Box component="td" style={tdS}>{r.isBanned ? <Tag tone="danger">مسدود</Tag> : <Tag tone="success">فعال</Tag>}</Box>
                    <Box component="td" style={{ ...tdS, color: 'var(--g-color-text-muted)', fontSize: '11.5px' }}>{ago(r.lastActiveAt)}</Box>
                    <Box component="td" style={{ ...tdS, color: 'var(--g-color-text-muted)', fontSize: '11.5px' }}>{day(r.createdAt)}</Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        ) : <Awaiting note="کاربری با این فیلتر نیست." icon={IconUsers} />}

        {pages > 1 ? (
          <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBlockStart: 12 }}>
            <UnstyledButton type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} style={pgBtn(page <= 1)}>قبلی</UnstyledButton>
            <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', color: 'var(--g-color-text-muted)' }}>صفحهٔ {toFaDigits(page)} از {toFaDigits(pages)} · {toFaDigits(total)} کاربر</Text>
            <UnstyledButton type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} style={pgBtn(page >= pages)}>بعدی</UnstyledButton>
          </Box>
        ) : null}
      </Panel>

      {/* ── DOSSIER DRAWER ── */}
      <Drawer opened={!!selectedId} onClose={() => setSelectedId(null)} position="left" size={420} withCloseButton={false} padding={0} overlayProps={{ opacity: 0.4 }}>
        {detail.isLoading || !u ? (
          <Box style={{ display: 'grid', placeItems: 'center', minBlockSize: 200 }}><Loader color="var(--g-color-brand-600)" /></Box>
        ) : (
          <Box style={{ display: 'flex', flexDirection: 'column', minBlockSize: '100dvh' }}>
            <Box style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, padding: '16px 18px', borderBlockEnd: '1px solid var(--g-color-border-subtle)' }}>
              <Box style={{ minInlineSize: 0 }}>
                <Box style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '16px', fontWeight: 600, color: 'var(--g-color-text-primary)' }}>{u.name || 'بی‌نام'}</Text>
                  {roleTag(u)} {u.isBanned ? <Tag tone="danger">مسدود</Tag> : null}
                </Box>
                <Box style={{ display: 'flex', alignItems: 'center', gap: 8, marginBlockStart: 2 }}>
                  <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '12px', color: 'var(--g-color-text-muted)', direction: 'ltr', textAlign: 'start' }}>{revealed ? (revealed.phone || revealed.email || '—') : contact(u)}</Text>
                  {!revealed && !u.isGuest && (u.phone || u.email) ? <UnstyledButton type="button" onClick={() => setDanger({ kind: 'reveal', user: u })} style={{ fontFamily: 'var(--g-font-fa)', fontSize: '10.5px', color: 'var(--g-color-brand-600)', flexShrink: 0, whiteSpace: 'nowrap' }}>نمایشِ کامل</UnstyledButton> : null}
                </Box>
              </Box>
              <UnstyledButton type="button" onClick={() => setSelectedId(null)} aria-label="بستن" style={{ inlineSize: 30, blockSize: 30, borderRadius: '8px', display: 'grid', placeItems: 'center', color: 'var(--g-color-text-muted)', flexShrink: 0 }}><IconX size={18} /></UnstyledButton>
            </Box>

            <Box style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {u.isBanned ? <Note tone="warn" icon={IconAlertTriangle}>مسدود از {day(u.bannedAt)}{u.banReason ? ` — «${u.banReason}»` : ''}</Note> : null}

              <Box style={grid(120)}>
                {[['رویداد', u._count?.events], ['تیکت', u._count?.tickets], ['علاقه‌مندی', u._count?.favorites], ['برنامه', u._count?.mealPlans], ['نشست', u._count?.sessions], ['رسپی', u._count?.recipes]].map(([l, v]) => (
                  <Box key={l} style={{ background: 'var(--g-color-bg-canvas)', border: '1px solid var(--g-color-border-subtle)', borderRadius: '10px', padding: '8px 10px' }}>
                    <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '16px', fontWeight: 600, color: 'var(--g-color-text-primary)' }}>{fmtInt(v ?? 0)}</Text>
                    <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '10.5px', color: 'var(--g-color-text-muted)' }}>{l}</Text>
                  </Box>
                ))}
              </Box>

              <DossierRow label="عضویت" value={`${day(u.createdAt)} · ${ago(u.recentEvents?.[0]?.timestamp)}`} />
              <DossierRow label="منطقه" value={[u.locale, u.country].filter(Boolean).join(' · ') || '—'} />
              {u.preferences ? <DossierRow label="ترجیحات" value={[u.preferences.diet, u.preferences.skillLevel, u.preferences.budget].filter(Boolean).join(' · ') || '—'} /> : null}
              {u.allergiesCount ? <DossierRow label="آلرژی" value={`${toFaDigits(u.allergiesCount)} مورد (محرمانه — سلامت)`} tone="danger" /> : null}
              {u.healthGoalsCount ? <DossierRow label="هدفِ سلامت" value={`${toFaDigits(u.healthGoalsCount)} مورد (محرمانه)`} /> : null}
              {u.cuisines?.length ? <DossierRow label="آشپزی‌ها" value={u.cuisines.join('، ')} /> : null}

              <Box>
                <Text component="div" style={lblS}>نشست‌ها ({toFaDigits(u.activeSessions ?? 0)} فعال)</Text>
                {u.sessions?.length ? u.sessions.slice(0, 5).map((sx) => (
                  <Box key={sx.id} style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBlock: 5, fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', color: 'var(--g-color-text-secondary)' }}>
                    <IconDeviceMobile size={13} stroke={1.7} style={{ color: sx.endTime ? 'var(--g-color-text-muted)' : 'var(--g-color-state-success-fg)' }} />
                    <span style={{ flex: 1 }}>{sx.device || 'دستگاهِ نامشخص'} {sx.ip ? `· ${sx.ip}` : ''}</span>
                    <span style={{ color: 'var(--g-color-text-muted)' }}>{ago(sx.startTime)}</span>
                  </Box>
                )) : <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', color: 'var(--g-color-text-muted)' }}>نشستِ ثبت‌شده‌ای نیست.</Text>}
              </Box>

              <Box>
                <Text component="div" style={lblS}>فعالیتِ اخیر</Text>
                {u.recentEvents?.length ? u.recentEvents.slice(0, 8).map((e) => (
                  <Box key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingBlock: 4, fontFamily: 'var(--g-font-fa)', fontSize: '11.5px' }}>
                    <Text component="span" style={{ color: 'var(--g-color-text-primary)' }}>{e.type}{e.page ? ` · ${e.page}` : ''}</Text>
                    <Text component="span" style={{ color: 'var(--g-color-text-muted)', flexShrink: 0 }}>{ago(e.timestamp)}</Text>
                  </Box>
                )) : <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', color: 'var(--g-color-text-muted)' }}>فعالیتی ثبت نشده.</Text>}
              </Box>

              {/* P1-6: per-user observability cabin — Timeline / Signals / Profile Trace / Consent / AI calls / Tickets */}
              <ObservabilityCabin userId={u.id} />
            </Box>

            {/* actions — grouped by risk tier (advisor P1-9): session/security ops, then owner-only irreversible ops */}
            <Box style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '14px 18px', borderBlockStart: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface)' }}>
              <Text component="div" style={actGroupLbl}>نشست و دسترسی</Text>
              <Act icon={IconLogout} label="خروجِ اجباری (ابطالِ نشست‌ها)" loading={logoutM.isPending} onClick={() => logoutM.mutate({ id: u.id })} />
              {u.isBanned
                ? <Act icon={IconLockOpen} label="رفعِ مسدودی" loading={banM.isPending} onClick={() => banM.mutate({ id: u.id, banned: false })} />
                : <Act icon={IconBan} label="مسدود کردن" tone="danger" onClick={() => setDanger({ kind: 'ban', user: u })} />}
              <Text component="div" style={{ ...actGroupLbl, marginBlockStart: 6 }}>عملیاتِ مالک · برگشت‌ناپذیر</Text>
              <Act icon={u.isAdmin ? IconShieldOff : IconShield} label={u.isAdmin ? 'برداشتنِ نقشِ مدیر' : 'مدیر کردن'} tone="danger" onClick={() => setDanger({ kind: 'role', user: u })} />
              <Act icon={IconKey} label="ریستِ رمزِ عبور" tone="danger" onClick={() => setDanger({ kind: 'password', user: u })} />
              <Act icon={IconDownload} label="خروجیِ دادهٔ کاربر (GDPR)" tone="danger" onClick={() => setDanger({ kind: 'export', user: u })} />
              <Act icon={IconTrash} label="حذفِ کامل (پاک‌سازیِ GDPR)" tone="danger" onClick={() => setDanger({ kind: 'delete', user: u })} />
            </Box>
          </Box>
        )}
      </Drawer>

      {/* ── CREATE ── */}
      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="افزودنِ کاربرِ جدید" centered styles={{ title: { fontFamily: 'var(--g-font-fa)', fontWeight: 600 } }}>
        <CreateForm pending={createM.isPending} error={createM.error} onSubmit={(body) => createM.mutate(body)} />
      </Modal>

      {/* ── UNIFIED DANGER MODAL — reason (required) + typed-confirm for delete (P0-2), owner/reason errors surfaced ── */}
      <DangerModal state={danger} onClose={closeDanger} busy={dangerBusy} error={dangerError} onConfirm={onDanger} />
    </>
  );
}

const tdS = { padding: '9px 8px', fontSize: '12.5px', color: 'var(--g-color-text-primary)', borderBlockEnd: '1px solid var(--g-color-border-subtle)', verticalAlign: 'middle' };
const lblS = { fontFamily: 'var(--g-font-fa)', fontSize: '11px', fontWeight: 500, color: 'var(--g-color-text-muted)', marginBlockEnd: 6 };
const actGroupLbl = { fontFamily: 'var(--g-font-fa)', fontSize: '10px', fontWeight: 600, color: 'var(--g-color-text-muted)', textTransform: 'uppercase', letterSpacing: '.3px', marginBlockEnd: 1 };
const pgBtn = (dis) => ({ fontFamily: 'var(--g-font-fa)', fontSize: '12px', color: dis ? 'var(--g-color-text-muted)' : 'var(--g-color-brand-600)', paddingInline: 10, minBlockSize: 32 });

function DossierRow({ label, value, tone }) {
  return (
    <Box style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '12px', color: 'var(--g-color-text-muted)', flexShrink: 0 }}>{label}</Text>
      <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '12px', color: tone === 'danger' ? 'var(--g-color-state-danger-fg, #b3261e)' : 'var(--g-color-text-primary)', textAlign: 'end' }}>{value}</Text>
    </Box>
  );
}

// ── P1-6: observability cabin (consumes the read-only /admin/observability/user/:id/* endpoints) ──
const OBS_TABS = [
  { id: 'events', label: 'تایم‌لاین' },
  { id: 'observations', label: 'سیگنال‌ها' },
  { id: 'profile-trace', label: 'پروفایل' },
  { id: 'consent', label: 'رضایت' },
  { id: 'ai-calls', label: 'AI' },
  { id: 'tickets', label: 'تیکت' },
];
const obsMuted = { fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', color: 'var(--g-color-text-muted)', paddingBlock: 8 };
const obsChip = (on) => ({ minBlockSize: 26, paddingInline: 9, borderRadius: '7px', fontFamily: 'var(--g-font-fa)', fontSize: '10.5px', fontWeight: on ? 600 : 400, background: on ? 'var(--g-color-brand-600)' : 'var(--g-color-bg-canvas)', color: on ? 'var(--g-color-text-inverse)' : 'var(--g-color-text-secondary)', border: `1px solid ${on ? 'var(--g-color-brand-600)' : 'var(--g-color-border-subtle)'}` });

function ObsRow({ a, b, c }) {
  return (
    <Box style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBlock: 4, borderBlockEnd: '1px solid var(--g-color-border-subtle)', fontFamily: 'var(--g-font-fa)', fontSize: '11.5px' }}>
      <Text component="span" style={{ color: 'var(--g-color-text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a}</Text>
      <Text component="span" style={{ color: 'var(--g-color-text-secondary)', flexShrink: 0 }}>{b}</Text>
      {c ? <Text component="span" style={{ color: 'var(--g-color-text-muted)', fontSize: '10px', flexShrink: 0, maxInlineSize: 96, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c}</Text> : null}
    </Box>
  );
}

function ObsContent({ tab, d }) {
  if (!d) return <Text component="div" style={obsMuted}>—</Text>;
  if (tab === 'events') {
    const ev = d.events || [];
    return ev.length ? <Box>{ev.slice(0, 30).map((e) => <ObsRow key={e.id} a={e.type + (e.page ? ' · ' + e.page : '')} b={ago(e.timestamp)} c={e.consentPurpose} />)}</Box> : <Text component="div" style={obsMuted}>رویدادی ثبت نشده.</Text>;
  }
  if (tab === 'observations') {
    const sum = d.summary || [];
    return sum.length ? <Box>{sum.slice(0, 20).map((s) => <ObsRow key={s.signalName} a={s.signalName} b={`×${toFaDigits(s.count)}`} c={(s.values || []).slice(0, 2).join('، ')} />)}</Box> : <Text component="div" style={obsMuted}>سیگنالی استخراج نشده.</Text>;
  }
  if (tab === 'profile-trace') {
    if (d.error) return <Text component="div" style={obsMuted}>پروفایل در دسترس نیست.</Text>;
    const rec = d.reconciled || {};
    const keys = Object.keys(rec);
    return (
      <Box>
        <ObsRow a="بلوغ" b={d.maturity && typeof d.maturity === 'object' ? String(d.maturity.band ?? d.maturity.stage ?? d.maturity.overallScore ?? '—') : String(d.maturity ?? '—')} />
        {d.observed ? <ObsRow a="مشاهده‌شده" b={String(d.observed.status ?? '—')} c={d.observed.overallConfidence != null ? 'اطمینان ' + toFaDigits(d.observed.overallConfidence) : ''} /> : null}
        {keys.length ? keys.map((k) => { const v = rec[k] || {}; return <ObsRow key={k} a={k} b={k === 'allergies' ? `${toFaDigits(v.count ?? 0)} مورد (مخفی)` : String(v.value ?? v.status ?? '—')} c={v.confidence != null ? toFaDigits(v.confidence) : ''} />; }) : <Text component="div" style={obsMuted}>بُعدی reconcile نشده.</Text>}
      </Box>
    );
  }
  if (tab === 'consent') {
    const cs = d.consents || [];
    return cs.length ? <Box>{cs.map((c, i) => <ObsRow key={i} a={c.purpose} b={c.status} c={c.withdrawnAt ? 'لغو ' + day(c.withdrawnAt) : c.grantedAt ? day(c.grantedAt) : c.lawfulBasis} />)}</Box> : <Text component="div" style={obsMuted}>رکوردِ رضایتی نیست.</Text>;
  }
  if (tab === 'ai-calls') {
    const ca = d.calls || [];
    return ca.length ? <Box>{ca.map((c) => <ObsRow key={c.id} a={c.surface || c.intent || 'chat'} b={c.model || '—'} c={`${c.status || ''}${c.latencyMs != null ? ' · ' + toFaDigits(c.latencyMs) + 'ms' : ''}`} />)}</Box> : <Text component="div" style={obsMuted}>فراخوانِ AI نیست.</Text>;
  }
  if (tab === 'tickets') {
    const tk = d.tickets || [];
    return tk.length ? <Box>{tk.map((t) => <ObsRow key={t.id} a={t.category || 'تیکت'} b={t.status} c={day(t.createdAt)} />)}</Box> : <Text component="div" style={obsMuted}>تیکتی نیست.</Text>;
  }
  return null;
}

function ObservabilityCabin({ userId }) {
  const [tab, setTab] = useState('events');
  const q = useQuery({ queryKey: ['admin', 'obs', userId, tab], queryFn: () => get(`/admin/observability/user/${userId}/${tab}`), enabled: !!userId, staleTime: 30000 });
  return (
    <Box>
      <Text component="div" style={lblS}>کابینِ مشاهده‌پذیری</Text>
      <Box style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBlockEnd: 9 }}>
        {OBS_TABS.map((t) => <UnstyledButton key={t.id} type="button" onClick={() => setTab(t.id)} style={obsChip(tab === t.id)}>{t.label}</UnstyledButton>)}
      </Box>
      {q.isLoading ? <Box style={{ display: 'grid', placeItems: 'center', paddingBlock: 16 }}><Loader size="xs" color="var(--g-color-brand-600)" /></Box>
        : q.isError ? <Text component="div" style={obsMuted}>خواندن از سرور ناموفق بود.</Text>
          : <ObsContent tab={tab} d={q.data} />}
    </Box>
  );
}

// map a backend error code (403 super_admin / 400 reason / self-protect) to a clear Persian line.
function errLine(error) {
  const code = error?.response?.data?.message || error?.response?.data?.error;
  const map = {
    super_admin_required: 'فقط مالک (super-admin) می‌تواند این کار را انجام دهد — شناسهٔ تو در ADMIN_OWNER_IDS نیست.',
    reason_required: 'دلیل الزامی است (حداقل ۳ کاراکتر).',
    cannot_delete_self: 'نمی‌توانی حسابِ خودت را حذف کنی.',
    cannot_ban_self: 'نمی‌توانی خودت را مسدود کنی.',
    cannot_demote_self: 'نمی‌توانی نقشِ مدیرِ خودت را برداری.',
    phone_or_email_required: 'تلفن یا ایمیل لازم است.',
    password_min_6: 'رمز حداقل ۶ کاراکتر.',
    phone_taken: 'این تلفن قبلاً ثبت شده.',
    email_taken: 'این ایمیل قبلاً ثبت شده.',
  };
  return map[code] || 'خطا رخ داد.';
}

function ErrorLine({ error, fallback }) {
  if (!error) return null;
  return <Text style={{ color: 'var(--g-color-state-danger-fg, #b3261e)', fontFamily: 'var(--g-font-fa)', fontSize: '12px', marginBlockEnd: 8 }}>{errLine(error) === 'خطا رخ داد.' && fallback ? fallback : errLine(error)}</Text>;
}

const DANGER_CFG = {
  role: (u) => ({ title: `${u.isAdmin ? 'برداشتنِ نقشِ مدیر' : 'مدیر کردن'} — ${u.name || 'کاربر'}`, warn: u.isAdmin ? 'دسترسیِ کاملِ مدیر از این کاربر گرفته می‌شود.' : 'این کاربر دسترسیِ کاملِ مدیر می‌گیرد (عملیاتِ حساس). فقط مالک می‌تواند.', btn: 'تغییرِ نقش', danger: true }),
  password: (u) => ({ title: `ریستِ رمز — ${u.name || 'کاربر'}`, warn: 'رمزِ جدید تنظیم و کاربر از همهٔ دستگاه‌ها خارج می‌شود. فقط مالک می‌تواند.', btn: 'ریستِ رمز', pw: true, danger: false }),
  ban: (u) => ({ title: `مسدود کردن — ${u.name || 'کاربر'}`, warn: 'کاربر بلافاصله خارج و تا رفعِ مسدودی نمی‌تواند وارد شود.', btn: 'مسدود کن', danger: true }),
  export: (u) => ({ title: `خروجیِ دادهٔ کاربر — ${u.name || 'کاربر'}`, warn: 'کلِ پروفایلِ کاربر (شاملِ PII) دانلود می‌شود؛ این کار server-side ثبت و audit می‌شود. فقط مالک می‌تواند.', btn: 'خروجی بگیر', danger: false }),
  delete: (u) => ({ title: `حذفِ کاملِ کاربر — ${u.name || 'کاربر'}`, warn: 'غیرقابلِ بازگشت — کلِ دادهٔ کاربر طبقِ GDPR پاک می‌شود. فقط سندِ اثباتِ پاک‌سازی (بدونِ PII) می‌ماند. فقط مالک می‌تواند.', btn: 'حذفِ دائمی', confirmWord: true, danger: true }),
  reveal: (u) => ({ title: `نمایشِ اطلاعاتِ کامل — ${u.name || 'کاربر'}`, warn: 'تلفن/ایمیلِ واقعیِ این کاربر نمایش داده می‌شود؛ با دلیل ثبت و audit می‌شود.', btn: 'نمایش بده', danger: false }),
};

// Unified sensitive-op modal: mandatory reason (P0-2) + typed-name confirmation for delete + clear owner/reason errors.
function DangerModal({ state, onClose, busy, error, onConfirm }) {
  const [reason, setReason] = useState('');
  const [pw, setPw] = useState('');
  const [word, setWord] = useState('');
  useEffect(() => { setReason(''); setPw(''); setWord(''); }, [state?.kind, state?.user?.id]);
  if (!state) return null;
  const u = state.user;
  const cfg = DANGER_CFG[state.kind](u);
  const expect = String(u.name || u.phone || u.email || 'حذف');
  const reasonOk = reason.trim().length >= 3;
  const pwOk = !cfg.pw || pw.length >= 6;
  const wordOk = !cfg.confirmWord || word.trim() === expect;
  const ok = reasonOk && pwOk && wordOk;
  return (
    <Modal opened onClose={onClose} title={cfg.title} centered styles={{ title: { fontFamily: 'var(--g-font-fa)', fontWeight: 600 } }}>
      <Box style={{ display: 'flex', flexDirection: 'column', gap: 11, fontFamily: 'var(--g-font-fa)' }}>
        <Note tone={cfg.danger ? 'warn' : 'info'} icon={IconAlertTriangle}>{cfg.warn}</Note>
        {error ? <Text style={{ color: 'var(--g-color-state-danger-fg, #b3261e)', fontSize: '12px' }}>{errLine(error)}</Text> : null}
        {cfg.pw ? <PasswordInput label="رمزِ جدید (حداقل ۶)" value={pw} onChange={(e) => setPw(e.target.value)} styles={fieldStyles} /> : null}
        <TextInput label="دلیل (الزامی — در سندِ audit ثبت می‌شود)" value={reason} onChange={(e) => setReason(e.target.value)} styles={fieldStyles} placeholder="چرا این کار را انجام می‌دهی؟" />
        {cfg.confirmWord ? <TextInput label={`برای تأیید، «${expect}» را تایپ کن`} value={word} onChange={(e) => setWord(e.target.value)} styles={fieldStyles} /> : null}
        <Box style={{ display: 'flex', gap: 8, marginBlockStart: 2 }}>
          <UnstyledButton type="button" onClick={onClose} style={{ flex: 1, minBlockSize: 42, borderRadius: '11px', border: '1px solid var(--g-color-border-subtle)', fontFamily: 'var(--g-font-fa)', fontSize: '13px', color: 'var(--g-color-text-primary)' }}>انصراف</UnstyledButton>
          <UnstyledButton type="button" disabled={!ok || busy} onClick={() => onConfirm({ reason: reason.trim(), password: pw })} style={{ flex: 1, minBlockSize: 42, borderRadius: '11px', background: cfg.danger ? 'var(--g-color-state-danger-fg, #b3261e)' : 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse, #fff)', fontFamily: 'var(--g-font-fa)', fontSize: '13px', fontWeight: 500, display: 'grid', placeItems: 'center', opacity: (!ok || busy) ? 0.5 : 1 }}>{busy ? <Loader size={15} color="var(--g-color-text-inverse, #fff)" /> : cfg.btn}</UnstyledButton>
        </Box>
      </Box>
    </Modal>
  );
}

function CreateForm({ onSubmit, pending, error }) {
  const [f, setF] = useState({ phone: '', email: '', name: '', password: '', isAdmin: false, reason: '' });
  const needsReason = f.isAdmin && f.reason.trim().length < 3; // P0-2: granting admin requires a justification (server enforces it)
  return (
    <Box style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      <ErrorLine error={error} />
      <TextInput label="نام" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} styles={fieldStyles} />
      <TextInput label="تلفن" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} styles={fieldStyles} dir="ltr" />
      <TextInput label="ایمیل (اختیاری)" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} styles={fieldStyles} dir="ltr" />
      <PasswordInput label="رمزِ عبور (حداقل ۶)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} styles={fieldStyles} />
      <Switch label="نقشِ مدیر (فقط مالک)" checked={f.isAdmin} onChange={(e) => setF({ ...f, isAdmin: e.currentTarget.checked })} styles={{ label: { fontFamily: 'var(--g-font-fa)', fontSize: '12.5px' } }} />
      {f.isAdmin ? <TextInput label="دلیلِ ساختِ مدیر (الزامی — در audit ثبت می‌شود)" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} styles={fieldStyles} placeholder="چرا این فرد مدیر می‌شود؟" /> : null}
      <UnstyledButton type="button" onClick={() => onSubmit(f)} disabled={pending || needsReason} style={{ minBlockSize: 44, borderRadius: '11px', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse, #fff)', fontFamily: 'var(--g-font-fa)', fontSize: '13px', fontWeight: 500, display: 'grid', placeItems: 'center', marginBlockStart: 4, opacity: (pending || needsReason) ? 0.5 : 1 }}>{pending ? <Loader size={15} color="var(--g-color-text-inverse, #fff)" /> : 'ساختِ کاربر'}</UnstyledButton>
    </Box>
  );
}
