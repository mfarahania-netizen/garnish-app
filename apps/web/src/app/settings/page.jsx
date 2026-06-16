import { useState } from 'react';
import { Container, Box, Stack, Group, Text, Title, Switch, Modal } from '@mantine/core';
import {
  IconSalad, IconBell, IconShieldLock, IconDownload, IconTrash, IconMoon, IconChevronLeft,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../lib/apiClient';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getAnalyticsConsent, enableAnalytics, disableAnalytics } from '../../lib/analytics-init';
import { SectionHeader, CardShell, Button as GesButton, ErrorState } from '../../components/ges';

/**
 * Settings (S22) — dietary editing (link to the preferences editor), notification preferences,
 * REVOCABLE consent shown honestly (what's collected + a toggle, POST /users/consent), and account
 * (GDPR export GET /users/me/export + delete DELETE /users/me), plus appearance. No dark patterns,
 * consent never hidden. Account/consent sections are owner-gated.
 */
function Row({ icon, title, subtitle, onClick, right }) {
  const content = (
    <Group justify="space-between" align="center" wrap="nowrap" style={{ gap: 'var(--g-space-3)' }}>
      <Group gap="var(--g-space-3)" wrap="nowrap" align="center" style={{ flex: 1, minWidth: 0 }}>
        <Box style={{ color: 'var(--g-color-food-saffron)', flexShrink: 0 }}>{icon}</Box>
        <div style={{ minWidth: 0 }}>
          <Text fw={600} size="sm" c="var(--g-color-text-primary)">{title}</Text>
          {subtitle && <Text size="xs" c="var(--g-color-text-secondary)" style={{ lineHeight: 'var(--g-leading-body)' }}>{subtitle}</Text>}
        </div>
      </Group>
      {right ?? (onClick && <IconChevronLeft size={18} color="var(--g-color-text-muted)" aria-hidden="true" />)}
    </Group>
  );
  return onClick ? (
    <Box role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }} style={{ cursor: 'pointer' }}>
      <CardShell>{content}</CardShell>
    </Box>
  ) : <CardShell>{content}</CardShell>;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();
  const { dark, toggleDark } = useTheme();
  const auth = useAuth();
  const hasToken = !!(auth?.token || (typeof window !== 'undefined' && localStorage.getItem('token')));

  const [analytics, setAnalyticsState] = useState(() => getAnalyticsConsent() === true);
  const [marketing, setMarketing] = useState(false);
  const [calmNotifs, setCalmNotifs] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const setConsent = async (type, granted) => {
    if (!hasToken) return;
    try { await apiClient.post('/users/consent', { type, granted }); } catch { /* best-effort; local state already reflects choice */ }
  };

  const onAnalytics = (v) => {
    setAnalyticsState(v);
    if (v) enableAnalytics(); else disableAnalytics();
    setConsent('DATA_COLLECTION', v);
    trackEvent('consent_toggle', { type: 'DATA_COLLECTION', granted: v });
  };
  const onMarketing = (v) => { setMarketing(v); setConsent('MARKETING', v); trackEvent('consent_toggle', { type: 'MARKETING', granted: v }); };

  const exportData = async () => {
    setBusy(true); setError('');
    try {
      const { data } = await apiClient.get('/users/me/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'garnish-my-data.json'; a.click();
      URL.revokeObjectURL(url);
      trackEvent('data_export', {});
    } catch { setError('گرفتن خروجی داده الان ممکن نشد. دوباره تلاش کن.'); }
    finally { setBusy(false); }
  };

  const deleteAccount = async () => {
    setBusy(true); setError('');
    try {
      await apiClient.delete('/users/me');
      trackEvent('account_delete', {});
      auth?.logout?.();
      navigate('/');
    } catch { setError('حذف حساب الان ممکن نشد. با پشتیبانی در تماس باش.'); setBusy(false); setDeleteOpen(false); }
  };

  return (
    <Container size="sm" style={{ maxWidth: 480, margin: '0 auto', padding: '16px 12px 100px' }}>
      <Box mb="lg" mt="xs">
        <Title order={3} c="var(--g-color-text-primary)" style={{ fontFamily: 'var(--g-font-display)' }}>تنظیمات</Title>
        <Text size="sm" c="var(--g-color-text-secondary)">کنترل ترجیحات، حریم خصوصی و حسابت — همیشه با خودت.</Text>
      </Box>

      {error && <Box mb="md"><ErrorState variant="inline" title={error} onRetry={() => setError('')} retryLabel="باشه" /></Box>}

      {/* Dietary */}
      <SectionHeader as="h2" title="ترجیحات غذایی" />
      <Stack gap="var(--g-space-2)" mt="var(--g-space-3)" mb="lg">
        <Row icon={<IconSalad size={22} stroke={1.6} />} title="رژیم، حساسیت‌ها و دوست‌نداشتنی‌ها" subtitle="الگوی غذایی، حساسیت‌ها با شدت (برای ایمنی)، و موادی که دوست نداری" onClick={() => navigate('/preferences')} />
      </Stack>

      {/* Notifications */}
      <SectionHeader as="h2" title="اعلان‌ها" />
      <Stack gap="var(--g-space-2)" mt="var(--g-space-3)" mb="lg">
        <Row icon={<IconBell size={22} stroke={1.6} />} title="اعلان‌های آرام" subtitle="یادآوری‌های ملایم، بدون فشار و بدون پیام‌های پی‌درپی" right={<Switch checked={calmNotifs} onChange={(e) => setCalmNotifs(e.currentTarget.checked)} color="saffron" aria-label="اعلان‌های آرام" />} />
        <Row icon={<IconBell size={22} stroke={1.6} />} title="مدیریت اعلان‌ها" subtitle="دیدن و تنظیم همهٔ اعلان‌ها" onClick={() => navigate('/notifications')} />
      </Stack>

      {/* Privacy & consent (revocable, honest) */}
      <SectionHeader as="h2" title="حریم خصوصی و رضایت" />
      <Stack gap="var(--g-space-2)" mt="var(--g-space-3)" mb="lg">
        {hasToken ? (
          <>
            <Row icon={<IconShieldLock size={22} stroke={1.6} />} title="تحلیل استفاده" subtitle="فقط برای بهتر شدن تجربه. هر زمان می‌تونی خاموشش کنی." right={<Switch checked={analytics} onChange={(e) => onAnalytics(e.currentTarget.checked)} color="saffron" aria-label="تحلیل استفاده" />} />
            <Row icon={<IconShieldLock size={22} stroke={1.6} />} title="پیام‌های بازاریابی" subtitle="پیشنهادهای ویژه. پیش‌فرض خاموش است." right={<Switch checked={marketing} onChange={(e) => onMarketing(e.currentTarget.checked)} color="saffron" aria-label="پیام‌های بازاریابی" />} />
          </>
        ) : (
          <Row icon={<IconShieldLock size={22} stroke={1.6} />} title="برای مدیریت رضایت وارد شو" subtitle="کنترل کامل داده‌هایت پس از ورود" onClick={() => navigate('/auth')} />
        )}
      </Stack>

      {/* Account */}
      {hasToken && (
        <>
          <SectionHeader as="h2" title="حساب کاربری" />
          <Stack gap="var(--g-space-2)" mt="var(--g-space-3)" mb="lg">
            <Row icon={<IconDownload size={22} stroke={1.6} />} title="گرفتن خروجی داده‌هایم" subtitle="یک فایل از همهٔ داده‌های تو (GDPR)" right={<GesButton variant="secondary" loading={busy} onClick={exportData}>دانلود</GesButton>} />
            <Row icon={<IconTrash size={22} stroke={1.6} />} title="حذف حساب" subtitle="همهٔ داده‌هایت برای همیشه پاک می‌شود" right={<GesButton variant="destructive" onClick={() => setDeleteOpen(true)}>حذف</GesButton>} />
          </Stack>
        </>
      )}

      {/* Appearance */}
      <SectionHeader as="h2" title="ظاهر" />
      <Stack gap="var(--g-space-2)" mt="var(--g-space-3)">
        <Row icon={<IconMoon size={22} stroke={1.6} />} title="حالت تاریک" subtitle="برای چشم‌های راحت‌تر در شب" right={<Switch checked={dark} onChange={toggleDark} color="saffron" aria-label="حالت تاریک" />} />
      </Stack>

      <Modal opened={deleteOpen} onClose={() => setDeleteOpen(false)} title="حذف حساب" centered radius="lg">
        <Stack gap="md">
          <Text size="sm" c="var(--g-color-text-secondary)">با حذف حساب، همهٔ داده‌هایت (پروفایل، برنامه، لیست خرید و علاقه‌مندی‌ها) برای همیشه پاک می‌شود. این کار قابل بازگشت نیست.</Text>
          <Group justify="flex-end" gap="sm">
            <GesButton variant="secondary" onClick={() => setDeleteOpen(false)}>انصراف</GesButton>
            <GesButton variant="destructive" loading={busy} onClick={deleteAccount}>حذف برای همیشه</GesButton>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
