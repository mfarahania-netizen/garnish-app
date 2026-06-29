// apps/web/src/app/admin/_ui.jsx
// Shared admin UI primitives — minimal, light, RTL, Vazirmatn. Every data tile renders EITHER a real value
// OR an honest awaiting/post-launch state (status from the backend's self-labelling) — never a fake number.
// Typography is deliberately small/light (founder: minimal). Charts use recharts. Catalog: docs/audit/ADMIN_DASHBOARD_CATALOG.md.
import { Box, Text, UnstyledButton } from '@mantine/core';
import { IconClock, IconLock, IconAlertTriangle, IconRefresh } from '@tabler/icons-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { toFaDigits, faPercent } from '../../components/ges/format';

export { toFaDigits, faPercent };

// ── style helpers ───────────────────────────────────────────────────────────
export const CARD = {
  background: 'var(--g-color-bg-surface)',
  border: '1px solid var(--g-color-border-subtle)',
  borderRadius: '14px',
  padding: '16px 18px',
};
export const sectionTitleStyle = {
  fontFamily: 'var(--g-font-fa)', fontSize: '13px', fontWeight: 600,
  color: 'var(--g-color-text-secondary)', margin: '22px 0 11px',
};
export const grid = (min) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: '11px' });

// ── number helpers ───────────────────────────────────────────────────────────
export const fmtInt = (n) => (typeof n === 'number' && Number.isFinite(n) ? toFaDigits(Math.round(n).toLocaleString('en-US')) : '—');
export const fmtCompact = (n) => {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  if (n >= 1e6) return toFaDigits((Math.round(n / 1e5) / 10).toString()) + 'M';
  if (n >= 1e4) return toFaDigits((Math.round(n / 1e3)).toString()) + 'K';
  return toFaDigits(Math.round(n).toLocaleString('en-US'));
};
export const fmtUsd = (n) => (typeof n === 'number' && Number.isFinite(n) ? '$' + toFaDigits((Math.round(n * 1e4) / 1e4).toString()) : '—');
export const fmtPct01 = (n) => (typeof n === 'number' && Number.isFinite(n) ? faPercent(Math.round(n * 1000) / 10) : '—');
export const fmtMs = (n) => (typeof n === 'number' && Number.isFinite(n) ? toFaDigits(Math.round(n)) + 'ms' : '—');
export const fmtSec = (n) => (typeof n === 'number' && Number.isFinite(n) ? toFaDigits((Math.round(n / 100) / 10).toString()) + 'ث' : '—');

// ── status: a quiet dot, not a loud badge (founder: minimal) ───────────────────
const STATUS = {
  real: { label: 'داده واقعی', dot: 'var(--g-color-state-success-fg)', solid: true },
  awaiting_pilot: { label: 'در انتظار پایلوت', dot: 'var(--g-color-border-strong)', solid: false },
  awaiting_rates: { label: 'در انتظار نرخ', dot: 'var(--g-color-border-strong)', solid: false },
  post_launch: { label: 'پس از لانچ', dot: 'var(--g-color-border-strong)', solid: false },
  partial: { label: 'پوشش جزئی', dot: 'var(--g-color-state-warning-fg, #c0801c)', solid: true },
};
export const isReal = (status) => status === 'real';

export function Dot({ status = 'awaiting_pilot' }) {
  const m = STATUS[status] || STATUS.awaiting_pilot;
  return <Box aria-hidden="true" title={m.label} style={{ inlineSize: 7, blockSize: 7, borderRadius: '50%', flexShrink: 0, background: m.solid ? m.dot : 'transparent', border: m.solid ? 'none' : `1.5px solid ${m.dot}` }} />;
}

export function Legend() {
  return (
    <Box style={{ display: 'flex', alignItems: 'center', gap: 16, marginBlockStart: 12, fontFamily: 'var(--g-font-fa)', fontSize: '11px', color: 'var(--g-color-text-muted)' }}>
      <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Dot status="real" />داده واقعی</Box>
      <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Dot status="awaiting_pilot" />دادهٔ تستی / در انتظار پایلوت</Box>
    </Box>
  );
}

// ── KPI tile — small, light ────────────────────────────────────────────────────
export function Kpi({ icon: Icon, label, value, sub, status = 'real', awaitNote, tone }) {
  const real = isReal(status) || status === 'partial';
  const valueColor = tone === 'warn' ? 'var(--g-color-state-warning-fg, #c0801c)' : (status === 'real' || status === 'partial' ? 'var(--g-color-text-primary)' : 'var(--g-color-text-muted)');
  return (
    <Box style={{ ...CARD, ...(real ? {} : { borderStyle: 'dashed' }) }}>
      <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--g-color-text-secondary)', minInlineSize: 0 }}>
          {Icon ? <Icon size={15} stroke={1.7} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)', flexShrink: 0 }} /> : null}
          <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '12px', fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</Text>
        </Box>
        <Dot status={status} />
      </Box>
      {real ? (
        <>
          <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '21px', fontWeight: 600, color: valueColor, marginBlockStart: 7, lineHeight: 1.15, letterSpacing: '.2px' }}>{value}</Text>
          {sub ? <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', color: tone === 'warn' ? 'var(--g-color-state-warning-fg, #c0801c)' : 'var(--g-color-text-muted)', marginBlockStart: 3 }}>{sub}</Text> : null}
        </>
      ) : (
        <Box style={{ marginBlockStart: 7 }}>
          <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '14px', fontWeight: 500, color: 'var(--g-color-text-muted)' }}>—</Text>
          <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', color: 'var(--g-color-text-muted)', marginBlockStart: 3 }}>{awaitNote || 'با ورود کاربران واقعی پر می‌شود'}</Text>
        </Box>
      )}
    </Box>
  );
}

// ── horizontal bar (distribution row) ──────────────────────────────────────────
export function HBar({ label, value, max, suffix, display, color }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <Box style={{ marginBlockStart: 11 }}>
      <Box style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBlockEnd: 5 }}>
        <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '12px', fontWeight: 400, color: 'var(--g-color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</Text>
        <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', color: 'var(--g-color-text-muted)', flexShrink: 0 }}>{display ?? `${toFaDigits(value)}${suffix || ''}`}</Text>
      </Box>
      <Box aria-hidden="true" style={{ blockSize: 5, borderRadius: '4px', background: 'var(--g-color-border-subtle)', overflow: 'hidden' }}>
        <Box style={{ inlineSize: `${pct}%`, blockSize: '100%', borderRadius: '4px', background: color || 'var(--g-color-brand-500)' }} />
      </Box>
    </Box>
  );
}

// ── titled panel + section ──────────────────────────────────────────────────────
export function Panel({ title, sub, right, children, status }) {
  return (
    <Box style={CARD}>
      {(title || right) ? (
        <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBlockEnd: sub ? 2 : 10 }}>
          <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '13px', fontWeight: 600, color: 'var(--g-color-text-primary)' }}>{title}</Text>
          {right ?? (status ? <Dot status={status} /> : null)}
        </Box>
      ) : null}
      {sub ? <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', color: 'var(--g-color-text-muted)', marginBlockEnd: 10 }}>{sub}</Text> : null}
      {children}
    </Box>
  );
}

export function Section({ title, sub, children, right }) {
  return (
    <>
      <Box style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, margin: '22px 0 11px' }}>
        <Text component="h2" style={{ ...sectionTitleStyle, margin: 0 }}>{title}</Text>
        {right || (sub ? <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', color: 'var(--g-color-text-muted)' }}>{sub}</Text> : null)}
      </Box>
      {children}
    </>
  );
}

// ── honest empty / awaiting state ────────────────────────────────────────────────
export function Awaiting({ note, icon: Icon = IconClock }) {
  return (
    <Box style={{ textAlign: 'center', paddingBlock: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <Box aria-hidden="true" style={{ inlineSize: 36, blockSize: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--g-color-state-info-bg)', color: 'var(--g-color-text-muted)', marginBlockEnd: 2 }}><Icon size={18} stroke={1.6} /></Box>
      <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '13px', fontWeight: 500, color: 'var(--g-color-text-secondary)' }}>در انتظار داده</Text>
      <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', color: 'var(--g-color-text-muted)', maxInlineSize: 320 }}>{note || 'این متریک با ورود کاربران واقعی فعال می‌شود.'}</Text>
    </Box>
  );
}

// ── honest ERROR state — a FOURTH state, distinct from Awaiting (no-data) and OK. A failed fetch must read
// "error", never fake-green. This is load-bearing for a control tower: a dead backend can't say "all healthy".
export function ErrorState({ note, onRetry }) {
  return (
    <Box style={{ textAlign: 'center', paddingBlock: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <Box aria-hidden="true" style={{ inlineSize: 36, blockSize: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--g-color-state-danger-bg, #fdeceb)', color: 'var(--g-color-state-danger-fg, #b3261e)', marginBlockEnd: 2 }}><IconAlertTriangle size={18} stroke={1.7} /></Box>
      <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '13px', fontWeight: 600, color: 'var(--g-color-state-danger-fg, #b3261e)' }}>بارگذاری نشد</Text>
      <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', color: 'var(--g-color-text-muted)', maxInlineSize: 340 }}>{note || 'این بخش از سرور پاسخ نگرفت — این «خطا» است، نه «بدونِ داده».'}</Text>
      {onRetry ? <UnstyledButton type="button" onClick={onRetry} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minBlockSize: 36, paddingInline: 14, marginBlockStart: 6, borderRadius: 'var(--g-radius-input)', border: '1px solid var(--g-color-border-strong)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-primary)', fontFamily: 'var(--g-font-fa)', fontSize: '12.5px', fontWeight: 600 }}><IconRefresh size={14} stroke={1.8} />تلاش دوباره</UnstyledButton> : null}
    </Box>
  );
}

export function Building({ section, note }) {
  return (
    <Box style={{ ...CARD, textAlign: 'center', paddingBlock: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, borderStyle: 'dashed' }}>
      <Box aria-hidden="true" style={{ inlineSize: 40, blockSize: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-600)', marginBlockEnd: 2 }}><IconClock size={20} stroke={1.6} /></Box>
      <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '15px', fontWeight: 600, color: 'var(--g-color-text-primary)' }}>در حال ساخت</Text>
      <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '12.5px', color: 'var(--g-color-text-secondary)', maxInlineSize: 400 }}>{section}</Text>
      {note ? <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', color: 'var(--g-color-text-muted)', maxInlineSize: 400, marginBlockStart: 2 }}>{note}</Text> : null}
    </Box>
  );
}

export function PostLaunch({ note }) {
  return (
    <Box style={{ ...CARD, textAlign: 'center', paddingBlock: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, borderStyle: 'dashed' }}>
      <Box aria-hidden="true" style={{ inlineSize: 38, blockSize: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--g-color-state-info-bg)', color: 'var(--g-color-text-muted)', marginBlockEnd: 2 }}><IconLock size={18} stroke={1.6} /></Box>
      <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '14px', fontWeight: 500, color: 'var(--g-color-text-secondary)' }}>پس از فعال‌سازی اشتراک</Text>
      <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', color: 'var(--g-color-text-muted)', maxInlineSize: 340 }}>{note || 'با اتصال درگاه پرداخت، این متریک خودکار فعال می‌شود.'}</Text>
    </Box>
  );
}

// ── charts (recharts) ──────────────────────────────────────────────────────────
const CHART_FA_TIP = (suffix) => ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <Box style={{ background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: '8px', padding: '6px 9px', fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <Text component="div" style={{ color: 'var(--g-color-text-muted)', marginBlockEnd: 2 }}>{label}</Text>
      <Text component="div" style={{ color: 'var(--g-color-text-primary)', fontWeight: 600 }}>{toFaDigits(payload[0].value)}{suffix || ''}</Text>
    </Box>
  );
};

// data: [{ label, value }]
export function TrendChart({ data = [], height = 150, color = 'var(--g-color-brand-500)', suffix }) {
  if (!Array.isArray(data) || data.length === 0) return <Awaiting note="هنوز داده‌ای برای نمودار نیست." />;
  return (
    <Box style={{ inlineSize: '100%', blockSize: height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: 'var(--g-color-text-muted)', fontFamily: 'var(--g-font-fa)' }} axisLine={false} tickLine={false} minTickGap={26} reversed />
          <YAxis hide domain={[0, 'auto']} />
          <Tooltip content={CHART_FA_TIP(suffix)} cursor={{ stroke: 'var(--g-color-border-strong)', strokeWidth: 1 }} />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.8} fill={color} fillOpacity={0.08} dot={false} activeDot={{ r: 3, strokeWidth: 0 }} />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
}

// data: [{ name, value }] ; colors optional
const DONUT_COLORS = ['var(--g-color-brand-600)', 'var(--g-color-brand-400)', 'var(--g-color-brand-300)', 'var(--g-color-border-strong)', 'var(--g-color-brand-200)', 'var(--g-color-border-subtle)'];
export function Donut({ data = [], height = 168, unit }) {
  const rows = (Array.isArray(data) ? data : []).filter((d) => d && d.value > 0);
  if (rows.length === 0) return <Awaiting note="—" />;
  const total = rows.reduce((s, d) => s + d.value, 0);
  return (
    <Box style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <Box style={{ inlineSize: height, blockSize: height, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="100%" paddingAngle={2} stroke="none">
              {rows.map((d, i) => <Cell key={i} fill={d.color || DONUT_COLORS[i % DONUT_COLORS.length]} />)}
            </Pie>
            <Tooltip content={CHART_FA_TIP(unit)} />
          </PieChart>
        </ResponsiveContainer>
      </Box>
      <Box style={{ flex: 1, minInlineSize: 120, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((d, i) => (
          <Box key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--g-font-fa)', fontSize: '12px' }}>
            <Box aria-hidden="true" style={{ inlineSize: 9, blockSize: 9, borderRadius: '3px', flexShrink: 0, background: d.color || DONUT_COLORS[i % DONUT_COLORS.length] }} />
            <Text component="span" style={{ color: 'var(--g-color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{d.name}</Text>
            <Text component="span" style={{ color: 'var(--g-color-text-muted)', flexShrink: 0 }}>{toFaDigits(d.value)} · {faPercent(Math.round((d.value / total) * 100))}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ── simple table ──────────────────────────────────────────────────────────────
export function Table({ columns = [], rows = [], empty = 'داده‌ای نیست' }) {
  if (!rows.length) return <Awaiting note={empty} />;
  return (
    <Box style={{ overflowX: 'auto' }}>
      <Box component="table" style={{ inlineSize: '100%', borderCollapse: 'collapse', fontFamily: 'var(--g-font-fa)' }}>
        <Box component="thead">
          <Box component="tr">
            {columns.map((c) => (
              <Box component="th" key={c.key} style={{ textAlign: c.align || 'start', padding: '7px 8px', fontSize: '11px', fontWeight: 500, color: 'var(--g-color-text-muted)', borderBlockEnd: '1px solid var(--g-color-border-subtle)', whiteSpace: 'nowrap' }}>{c.label}</Box>
            ))}
          </Box>
        </Box>
        <Box component="tbody">
          {rows.map((r, i) => (
            <Box component="tr" key={r._key ?? i}>
              {columns.map((c) => (
                <Box component="td" key={c.key} style={{ textAlign: c.align || 'start', padding: '8px', fontSize: '12.5px', color: 'var(--g-color-text-primary)', borderBlockEnd: '1px solid var(--g-color-border-subtle)', verticalAlign: 'middle' }}>
                  {c.render ? c.render(r) : r[c.key]}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

// ── note banner (real-evidence / context) ───────────────────────────────────────
export function Note({ children, tone = 'brand', icon: Icon }) {
  const bg = tone === 'brand' ? 'var(--g-color-brand-50)' : tone === 'warn' ? 'var(--g-color-state-warning-bg, #fdf3e3)' : 'var(--g-color-state-info-bg)';
  const fg = tone === 'brand' ? 'var(--g-color-brand-700)' : tone === 'warn' ? 'var(--g-color-state-warning-fg, #8a5a14)' : 'var(--g-color-text-secondary)';
  const bd = tone === 'brand' ? 'var(--g-color-brand-200)' : 'var(--g-color-border-subtle)';
  return (
    <Box style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: bg, border: `1px solid ${bd}`, borderRadius: '12px', padding: '11px 13px', marginBlockEnd: 11 }}>
      {Icon ? <Icon size={15} stroke={1.8} aria-hidden="true" style={{ color: fg, flexShrink: 0, marginBlockStart: 2 }} /> : null}
      <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', lineHeight: 1.65, color: fg }}>{children}</Text>
    </Box>
  );
}
