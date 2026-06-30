// Admin section — a sidebar dashboard over the real backend (admin.controller: ~24 endpoints + ops/*).
// Layout: a right-side nav rail (RTL inline-start) grouped BY JOB — مرکز فرماندهی / کاربران و پشتیبانی / محصول / هوش مصنوعی / ایمنی / اتوماسیون, a slim top bar,
// and the active tab body. Each tab renders real values or honest awaiting/post-launch states.
// Catalog: docs/audit/ADMIN_DASHBOARD_CATALOG.md.
import { useState, useEffect } from 'react';
import { Box, Text, UnstyledButton, Loader } from '@mantine/core';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  IconLeaf, IconLock, IconShieldLock, IconRefresh, IconHome,
  IconLayoutDashboard, IconSparkles, IconChartBar, IconActivity, IconToolsKitchen2,
  IconShieldCheck, IconBolt, IconCoin, IconChartDots, IconUsersGroup, IconTicket, IconRobot,
} from '@tabler/icons-react';
import { useAuth } from '../../context/AuthContext';
import { PostLaunch, toFaDigits } from './_ui';
import OverviewTab from './tabs/OverviewTab';
import AiCostTab from './tabs/AiCostTab';
import EngagementTab from './tabs/EngagementTab';
import RetentionTab from './tabs/RetentionTab';
import ContentTab from './tabs/ContentTab';
import SafetyTab from './tabs/SafetyTab';
import RealtimeTab from './tabs/RealtimeTab';
import BehaviorTab from './tabs/BehaviorTab';
import UsersTab from './tabs/UsersTab';
import TicketsTab from './tabs/TicketsTab';
import AutomationTab from './tabs/AutomationTab';
import AuthForm from '../../components/auth/AuthForm';

const RANGES = [{ id: 1, label: '۲۴ ساعت' }, { id: 7, label: '۷ روز' }, { id: 30, label: '۳۰ روز' }];

// A live "the panel is breathing" pill — ticks the wall-clock + re-stamps on window focus, so the operator can
// trust the board isn't a frozen snapshot (the per-tab queries poll every 15–30s underneath, and react-query
// refetches on focus). Honest: it signals liveness, not a specific per-metric timestamp.
function FreshnessPill() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const t = setInterval(tick, 20000);
    window.addEventListener('focus', tick);
    return () => { clearInterval(t); window.removeEventListener('focus', tick); };
  }, []);
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return (
    <Box title="پنل زنده است و خودکار به‌روزرسانی می‌شود" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, paddingInline: 10, minBlockSize: 32, borderRadius: '9px', border: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface)' }}>
      <Box aria-hidden="true" style={{ inlineSize: 7, blockSize: 7, borderRadius: '50%', background: 'var(--g-color-state-success-fg, #2e7d4f)' }} />
      <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11px', color: 'var(--g-color-text-secondary)', whiteSpace: 'nowrap' }}>زنده · {toFaDigits(hhmm)}</Text>
    </Box>
  );
}

const TABS = {
  overview: { label: 'نمای کلی', Icon: IconLayoutDashboard, C: OverviewTab, ranged: true },
  behavior: { label: 'رفتار و بهبود', Icon: IconChartDots, C: BehaviorTab },
  engagement: { label: 'درگیری و قیف', Icon: IconChartBar, C: EngagementTab, ranged: true },
  retention: { label: 'ماندگاری', Icon: IconActivity, C: RetentionTab },
  content: { label: 'محتوا و آشپزی', Icon: IconToolsKitchen2, C: ContentTab },
  ai: { label: 'هوش مصنوعی', Icon: IconSparkles, C: AiCostTab },
  safety: { label: 'ایمنی و انطباق', Icon: IconShieldCheck, C: SafetyTab },
  realtime: { label: 'زنده', Icon: IconBolt, C: RealtimeTab },
  users: { label: 'کاربران', Icon: IconUsersGroup, C: UsersTab },
  tickets: { label: 'تیکت‌ها', Icon: IconTicket, C: TicketsTab },
  automation: { label: 'ورک‌فلو', Icon: IconRobot, C: AutomationTab },
  revenue: { label: 'درآمد', Icon: IconCoin, C: () => <PostLaunch note="MRR/churn/LTV و اعتبارِ هوش مصنوعی — با اتصالِ درگاهِ پرداخت خودکار فعال می‌شود (§۱۱/§۱۲)" /> },
};

// P1-7 (advisor §7): job-based navigation, not by metric type. The old grouping mixed the command surface
// with product analytics ('تحلیل') and lumped people + ops + safety into one 'عملیات'. Now the operator
// navigates by the JOB to be done: Command (the "now" — pulse + live feed), People (users + support),
// Product analytics, AI, Safety (stands alone — allergens are critical), and Automation+System. Realtime
// moves up into Command and Safety is separated from ops, per §7. All tab COMPONENTS and the URL routing
// are unchanged — only this grouping/order moved, so nothing breaks.
const GROUPS = [
  { label: 'مرکز فرماندهی', ids: ['overview', 'realtime'] },
  { label: 'کاربران و پشتیبانی', ids: ['users', 'tickets'] },
  { label: 'محصول', ids: ['behavior', 'engagement', 'retention', 'content'] },
  { label: 'هوش مصنوعی', ids: ['ai'] },
  { label: 'ایمنی و انطباق', ids: ['safety'] },
  { label: 'اتوماسیون و سیستم', ids: ['automation', 'revenue'] },
];

function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 880px)');
    const on = () => setNarrow(mq.matches);
    on(); mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}

export default function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading, logout } = useAuth();
  const isAdmin = !!user?.isAdmin;
  const [params, setParams] = useSearchParams();
  const narrow = useNarrow();

  const tab = TABS[params.get('tab')] ? params.get('tab') : 'overview';
  const active = TABS[tab];
  const days = parseInt(params.get('days'), 10) || 30;
  const setTab = (id) => setParams((p) => { p.set('tab', id); return p; }, { replace: true });
  const setDays = (d) => setParams((p) => { p.set('days', String(d)); return p; }, { replace: true });

  if (authLoading) {
    return <Box style={{ minBlockSize: '100dvh', display: 'grid', placeItems: 'center', background: 'var(--g-color-bg-canvas)' }}><Loader color="var(--g-color-brand-600)" /></Box>;
  }
  if (!isAdmin) {
    const loggedInNonAdmin = !!user && !user.isGuest;
    return (
      <Box style={{ minBlockSize: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--g-color-bg-canvas)', paddingInline: 'var(--g-space-5)', paddingBlock: 'var(--g-space-6)' }}>
        {loggedInNonAdmin ? (
          <Box style={{ inlineSize: '100%', maxInlineSize: 380, textAlign: 'center', background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: '18px', padding: '28px 24px' }}>
            <Box aria-hidden="true" style={{ inlineSize: 52, blockSize: 52, borderRadius: '14px', margin: '0 auto', background: 'var(--g-color-state-info-bg)', color: 'var(--g-color-text-secondary)', display: 'grid', placeItems: 'center' }}><IconShieldLock size={28} stroke={1.7} /></Box>
            <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '18px', fontWeight: 600, color: 'var(--g-color-text-primary)', margin: '12px 0 0' }}>دسترسیِ مدیر ندارید</Text>
            <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '12.5px', color: 'var(--g-color-text-secondary)', margin: '6px 0 0', lineHeight: 1.6 }}>این حساب وارد شده ولی نقشِ مدیر ندارد. برای پنل، با حسابِ مدیر وارد شو.</Text>
            <UnstyledButton type="button" onClick={() => logout()} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', inlineSize: '100%', minBlockSize: 46, marginBlockStart: 16, borderRadius: '12px', border: '1px solid var(--g-color-border-strong)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-primary)', fontFamily: 'var(--g-font-fa)', fontSize: '14px', fontWeight: 500 }}>خروج و ورود با حسابِ دیگر</UnstyledButton>
            <UnstyledButton type="button" onClick={() => navigate('/')} style={{ inlineSize: '100%', paddingBlock: 8, marginBlockStart: 4, fontFamily: 'var(--g-font-fa)', fontSize: '12.5px', color: 'var(--g-color-text-muted)' }}>بازگشت به اپ</UnstyledButton>
          </Box>
        ) : (
          <AuthForm allowSignup={false} initialMode="login" icon={IconShieldLock} accent="admin" badge="ورود مدیران" heading="پنل مدیریت گارنیش" sub="برای ورود به پنل، با حسابِ مدیر وارد شو." footer={
            <UnstyledButton type="button" onClick={() => navigate('/')} style={{ inlineSize: '100%', paddingBlock: 6, fontFamily: 'var(--g-font-fa)', fontSize: '12.5px', color: 'var(--g-color-text-muted)', textAlign: 'center' }}>بازگشت به اپ</UnstyledButton>
          } />
        )}
      </Box>
    );
  }

  // invalidateQueries refetches only the ACTIVE (mounted) observers — i.e. the current tab + pulse/attention,
  // not all 12 tabs — so this is already scoped (P1-10). The whole-cache JSON export was REMOVED (P0-4): it
  // dumped real PII client-side with no server-side audit trail (silent exfiltration). Any export must be a
  // server endpoint, super-admin-gated, reason+audited, redacted — not a browser cache dump.
  const onRefresh = () => queryClient.invalidateQueries({ queryKey: ['admin'] });

  const railW = narrow ? 58 : 204;
  const ActiveBody = active.C;
  const iconBtn = { inlineSize: 34, blockSize: 34, borderRadius: '9px', border: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-secondary)', display: 'grid', placeItems: 'center', flexShrink: 0 };

  return (
    <Box style={{ minBlockSize: '100dvh', background: 'var(--g-color-bg-canvas)', display: 'flex', alignItems: 'flex-start' }}>
      {/* RIGHT nav rail (RTL inline-start) */}
      <Box component="nav" aria-label="بخش‌های مدیریت" style={{ inlineSize: railW, flexShrink: 0, position: 'sticky', insetBlockStart: 0, blockSize: '100dvh', overflowY: 'auto', background: 'var(--g-color-bg-surface)', borderInlineEnd: '1px solid var(--g-color-border-subtle)', display: 'flex', flexDirection: 'column', paddingBlock: 14, paddingInline: narrow ? 8 : 12 }}>
        <Box style={{ display: 'flex', alignItems: 'center', gap: 9, paddingInline: narrow ? 0 : 6, paddingBlockEnd: 14, justifyContent: narrow ? 'center' : 'flex-start' }}>
          <Box aria-hidden="true" style={{ inlineSize: 32, blockSize: 32, borderRadius: '9px', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-600)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><IconLeaf size={19} stroke={1.8} /></Box>
          {!narrow ? <Box><Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '14px', fontWeight: 600, color: 'var(--g-color-text-primary)' }}>گارنیش</Text><Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11px', color: 'var(--g-color-text-muted)' }}>پنل مدیریت</Text></Box> : null}
        </Box>

        {GROUPS.map((g) => (
          <Box key={g.label} style={{ marginBlockStart: 8 }}>
            {!narrow ? <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '10.5px', color: 'var(--g-color-text-muted)', padding: '8px 8px 5px' }}>{g.label}</Text> : <Box style={{ blockSize: 1, background: 'var(--g-color-border-subtle)', marginInline: 6, marginBlock: 8 }} />}
            {g.ids.map((id) => {
              const t = TABS[id]; const on = id === tab;
              return (
                <UnstyledButton key={id} type="button" onClick={() => setTab(id)} aria-current={on ? 'page' : undefined} title={narrow ? t.label : undefined} style={{ display: 'flex', alignItems: 'center', gap: 9, inlineSize: '100%', minBlockSize: 38, paddingInline: narrow ? 0 : 10, justifyContent: narrow ? 'center' : 'flex-start', borderRadius: '10px', marginBlockEnd: 2, background: on ? 'var(--g-color-brand-50)' : 'transparent', color: on ? 'var(--g-color-brand-700)' : 'var(--g-color-text-secondary)', fontFamily: 'var(--g-font-fa)', fontSize: '12.5px', fontWeight: on ? 500 : 400 }}>
                  <t.Icon size={18} stroke={1.7} aria-hidden="true" style={{ color: on ? 'var(--g-color-brand-600)' : 'var(--g-color-text-muted)', flexShrink: 0 }} />
                  {!narrow ? <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</span> : null}
                </UnstyledButton>
              );
            })}
          </Box>
        ))}

        <UnstyledButton type="button" onClick={() => navigate('/')} title="بازگشت به اپ" style={{ marginBlockStart: 'auto', display: 'flex', alignItems: 'center', gap: 9, minBlockSize: 38, paddingInline: narrow ? 0 : 10, justifyContent: narrow ? 'center' : 'flex-start', borderRadius: '10px', color: 'var(--g-color-text-muted)', fontFamily: 'var(--g-font-fa)', fontSize: '12px' }}>
          <IconHome size={18} stroke={1.7} aria-hidden="true" />{!narrow ? <span>بازگشت به اپ</span> : null}
        </UnstyledButton>
      </Box>

      {/* MAIN */}
      <Box style={{ flex: 1, minInlineSize: 0, display: 'flex', flexDirection: 'column' }}>
        <Box style={{ position: 'sticky', insetBlockStart: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', paddingInline: 20, paddingBlock: 13, background: 'var(--g-color-bg-surface)', borderBlockEnd: '1px solid var(--g-color-border-subtle)' }}>
          <Box style={{ minInlineSize: 0 }}>
            <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '16px', fontWeight: 600, color: 'var(--g-color-text-primary)', margin: 0 }}>{active.label}</Text>
            <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', color: 'var(--g-color-text-muted)', margin: '1px 0 0' }}>پنل مدیریت گارنیش</Text>
          </Box>
          <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            {active.ranged ? (
              <Box style={{ display: 'inline-flex', background: 'var(--g-color-bg-canvas)', border: '1px solid var(--g-color-border-subtle)', borderRadius: '9px', overflow: 'hidden' }}>
                {RANGES.map((r) => (
                  <UnstyledButton key={r.id} type="button" onClick={() => setDays(r.id)} aria-pressed={days === r.id} style={{ minBlockSize: 32, paddingInline: 11, display: 'inline-flex', alignItems: 'center', background: days === r.id ? 'var(--g-color-brand-600)' : 'transparent', color: days === r.id ? 'var(--g-color-text-inverse)' : 'var(--g-color-text-secondary)', fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', fontWeight: 400 }}>{r.label}</UnstyledButton>
                ))}
              </Box>
            ) : null}
            <FreshnessPill />
            <UnstyledButton type="button" onClick={onRefresh} aria-label="به‌روزرسانی" style={iconBtn}><IconRefresh size={16} stroke={1.8} /></UnstyledButton>
          </Box>
        </Box>

        <Box style={{ maxInlineSize: 1340, inlineSize: '100%', marginInline: 'auto', paddingInline: 20, paddingBlock: 18 }}>
          <ActiveBody days={days} />
        </Box>
      </Box>
    </Box>
  );
}
