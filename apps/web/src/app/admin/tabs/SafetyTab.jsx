// «ایمنی و انطباق» — guard-fire evidence (real runs over the fixture corpus), the allergen hard-filter,
// logged guard activity, consent posture (GDPR), and notification send posture. §10/§16. Pilot-independent.
import { Box, Text, Loader } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { IconShieldCheck, IconShieldHalf, IconAlertTriangle, IconCircleCheck, IconBell, IconLockCheck } from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';
import { Section, Kpi, HBar, Panel, Note, Awaiting, grid, toFaDigits, fmtInt, fmtPct01 } from '../_ui';

const get = (url) => apiClient.get(url).then((r) => r.data);
const GUARD_FA = { ai_safety: 'ایمنی هوش مصنوعی', prompt_injection: 'تزریق پرامپت', nutrition_claim: 'ادعای تغذیه‌ای' };
// Block-reason codes are raw English snake/kebab-case from the guard corpus — translate to Persian so the RTL
// tab reads professionally (unknown keys fall back to a humanized form, never a raw token).
const REASON_FA = {
  'ignore-previous-instructions': 'نادیده‌گرفتنِ دستورهای قبلی',
  'ignore-previous-fa': 'نادیده‌گرفتنِ دستورهای قبلی (فارسی)',
  'forget-instructions': 'فراموش‌کردنِ دستورها',
  'exfiltrate-system-prompt': 'استخراجِ پرامپتِ سیستم',
  'disable-safety': 'غیرفعال‌سازیِ ایمنی',
  'bypass-safety': 'دور زدنِ ایمنی',
  'override-safety': 'نقضِ ایمنی',
  'role-override': 'تغییرِ نقشِ مدل',
  'role-override-fa': 'تغییرِ نقشِ مدل (فارسی)',
  'jailbreak-mode': 'حالتِ جیلبریک',
  medical_diagnosis_treatment: 'تشخیص یا درمانِ پزشکی',
  strict_diet_planning: 'برنامهٔ غذاییِ درمانیِ سخت‌گیرانه',
  sensitive_inference: 'استنتاجِ اطلاعاتِ حساس',
  health_medical_claim_without_source_lock: 'ادعای سلامتی بدونِ منبعِ معتبر',
  fake_vision_claim: 'ادعای جعلیِ تشخیصِ تصویری',
};

export default function SafetyTab() {
  const safety = useQuery({ queryKey: ['admin', 'ops-safety'], queryFn: () => get('/admin/ops/safety-compliance') });
  if (safety.isLoading) return <Box style={{ display: 'grid', placeItems: 'center', paddingBlock: 60 }}><Loader color="var(--g-color-brand-600)" /></Box>;

  const s = safety.data || {};
  const gc = s.guardCorpus || {};
  const al = s.allergySafety;
  const lg = s.loggedGuards || {};
  const cp = s.consentPosture || {};
  const nd = s.notificationDelivery || {};
  const byReason = Object.entries(gc.byReason || {}).sort((a, b) => b[1] - a[1]);
  const byPurpose = Object.entries(cp.byPurpose || {});

  return (
    <>
      <Note tone="brand" icon={IconShieldCheck}>
        <Text component="span" style={{ fontWeight: 600 }}>شواهدِ واقعی، مستقل از پایلوت</Text> — اعداد از اجرای واقعیِ گاردها روی پیکرهٔ تست‌اند، نه دادهٔ ساختگی. این بخش برای سرمایه‌گذار قابلِ‌دفاع است.
      </Note>

      <Box style={grid(184)}>
        <Kpi icon={IconShieldCheck} label="گاردِ مسدودشده" status="real" value={`${toFaDigits(gc.blockedCases ?? 0)} / ${toFaDigits(gc.casesEvaluated ?? 0)}`} sub="روی پیکرهٔ تست" />
        <Kpi icon={IconShieldHalf} label="فیلتر آلرژن" status={al ? 'real' : 'awaiting_pilot'} value={al?.pass ? 'گذراند' : 'بررسی'} sub={al ? `${toFaDigits(al.leaks ?? 0)} نشت` : ''} tone={al && !al.pass ? 'warn' : undefined} awaitNote="در حال ارزیابی" />
        <Kpi icon={IconShieldCheck} label="فراخوانِ واقعیِ گارد" status={lg.status === 'real' ? 'real' : 'awaiting_pilot'} value={fmtInt(lg.totalCalls)} sub={lg.status === 'real' ? `نرخِ مسدودی ${fmtPct01(lg.guardBlockRate)}` : 'از فراخوان‌های زنده'} awaitNote="در انتظار فراخوان واقعی" />
        <Kpi icon={IconLockCheck} label="رضایت (GDPR)" status={cp.status === 'real' ? 'real' : 'awaiting_pilot'} value={cp.status === 'real' ? toFaDigits(byPurpose.length) : '—'} sub="هدف‌های ثبت‌شده" awaitNote="purpose روی رکوردها ثبت نشده" />
      </Box>

      <Section title="شواهدِ گارد" sub="اجرای واقعیِ گاردها روی پیکره" />
      <Box style={grid(300)}>
        <Panel title="شلیک هر گارد" status="real" sub={`${toFaDigits(gc.blockedCases ?? 0)} مسدود · روی ${toFaDigits(gc.casesEvaluated ?? 0)} موردِ پیکره`}>
          {Object.entries(gc.byGuard || {}).map(([k, v]) => <HBar key={k} label={GUARD_FA[k] || k} value={v} max={gc.casesEvaluated || 1} display={toFaDigits(v)} />)}
        </Panel>
        <Panel title="دلایلِ مسدودی" status={byReason.length ? 'real' : 'awaiting_pilot'}>
          {byReason.length ? byReason.slice(0, 8).map(([k, v]) => <HBar key={k} label={REASON_FA[k] || k.replace(/[-_]/g, ' ')} value={v} max={gc.blockedCases || 1} display={toFaDigits(v)} color="var(--g-color-brand-400)" />) : <Awaiting note="دلیلی ثبت نشده." />}
        </Panel>
      </Box>

      <Box style={grid(300)}>
        <Panel title="فیلتر سختِ آلرژن">
          <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBlockStart: 2, paddingInline: 12, paddingBlock: 7, borderRadius: '10px', background: al?.pass ? 'var(--g-color-state-success-bg)' : 'var(--g-color-state-info-bg)', color: al?.pass ? 'var(--g-color-state-success-fg)' : 'var(--g-color-text-secondary)', fontFamily: 'var(--g-font-fa)', fontSize: '12.5px', fontWeight: 600 }}>
            {al?.pass ? <IconCircleCheck size={15} stroke={1.8} /> : <IconAlertTriangle size={15} stroke={1.8} />}{al?.indicator || (al?.pass ? 'گذراند' : 'در حال ارزیابی')}
          </Box>
          <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', color: 'var(--g-color-text-muted)', marginBlockStart: 10 }}>این یک شاخصِ ایستا و قطعی است — هر آلرژن که از فیلتر رد شود یک حادثهٔ ایمنی است (باید صفر بماند).</Text>
        </Panel>
        <Panel title="رضایت و ارسالِ اعلان">
          {byPurpose.length ? byPurpose.map(([k, v]) => <HBar key={k} label={k} value={v.granted || 0} max={(v.granted || 0) + (v.withdrawn || 0) || 1} display={`${toFaDigits(v.granted || 0)} موافق · ${toFaDigits(v.withdrawn || 0)} لغو`} />) : (
            <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '12px', color: 'var(--g-color-text-muted)' }}>وضعیتِ رضایت به‌تفکیکِ هدف هنوز ثبت نمی‌شود (ستونِ purpose خالی است).</Text>
          )}
          <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBlockStart: 12, fontFamily: 'var(--g-font-fa)', fontSize: '12px', color: 'var(--g-color-text-secondary)' }}>
            <IconBell size={14} stroke={1.8} />ارسالِ اعلان: {nd.realSendEnabled ? 'واقعی فعال' : 'DRY-RUN (فقط شبیه‌سازی)'}
          </Box>
        </Panel>
      </Box>
    </>
  );
}
