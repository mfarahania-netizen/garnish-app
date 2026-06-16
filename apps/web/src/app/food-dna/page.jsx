import { useState, useEffect } from 'react';
import { Container, Box, Stack, Group, Text, Title } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../lib/apiClient';
import { useAnalytics } from '../../hooks/useAnalytics';
import {
  FoodDnaRing, PreferenceMemoryRow, StatusBadge, ProgressBar, SectionHeader,
  Button as GesButton, CardShell, EmptyState, ErrorState, LoadingSkeleton,
} from '../../components/ges';

/**
 * Food DNA (S22) — the user's evolving food identity from the REAL living profile (GET /profile).
 * Per-dimension with confidence + HONEST RECONCILIATION: where declared and observed differ, BOTH are
 * kept and shown (never erased; declared-safety always wins for allergies). Qualitative forming/
 * developing/mature framing via FoodDnaRing — NOT a % anxiety bar. No medical claim. Owner-only.
 */
const human = (key = '') => key.replace(/^.*\./, '').replace(/[._]/g, ' ');
const fmtValue = (v) => (Array.isArray(v) ? v.join('، ') : typeof v === 'object' && v ? JSON.stringify(v) : String(v ?? ''));
const confTone = (c) => (c >= 0.7 ? 'success' : c >= 0.35 ? 'info' : 'neutral');
const confLabel = (c) => (c >= 0.7 ? 'پررنگ' : c >= 0.35 ? 'در حال شکل‌گیری' : 'کم‌رنگ');

export default function FoodDnaPage() {
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();
  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('token');

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(hasToken);
  const [error, setError] = useState(false);

  useEffect(() => { trackEvent('page_view', { page: '/food-dna' }); }, [trackEvent]);

  useEffect(() => {
    if (!hasToken) return;
    let alive = true;
    setLoading(true); setError(false);
    apiClient.get('/profile')
      .then((res) => { if (alive) setProfile(res.data); })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [hasToken]);

  if (!hasToken) {
    return (
      <Container size="sm" style={{ maxWidth: 480, margin: '0 auto', padding: '16px 12px 100px' }}>
        <EmptyState title="ذائقهٔ تو، خصوصیِ تو" message="برای دیدن ذائقهٔ غذایی‌ات وارد شو. اطلاعاتت فقط برای خودته." actionLabel="ورود" onAction={() => navigate('/auth')} />
      </Container>
    );
  }
  if (loading) {
    return (
      <Container size="sm" style={{ maxWidth: 480, margin: '0 auto', padding: '16px 12px 100px' }}>
        <Stack align="center" mb="lg"><LoadingSkeleton shape="text" lines={1} label="در حال بارگذاری" /></Stack>
        <LoadingSkeleton shape="list" lines={5} label="در حال بارگذاری ذائقهٔ غذایی" />
      </Container>
    );
  }
  if (error || !profile) {
    return (
      <Container size="sm" style={{ maxWidth: 480, margin: '0 auto', padding: '16px 12px 100px' }}>
        <ErrorState title="خطا در بارگذاری" message="ذائقهٔ غذایی‌ات الان در دسترس نبود. چیزی از دست نرفت." retryLabel="تلاش دوباره" onRetry={() => window.location.reload()} />
      </Container>
    );
  }

  const band = profile?.maturity?.band || 'forming';
  const declaredDims = Object.values(profile?.declared?.dimensions || {}).filter((d) => d?.status === 'declared' || d?.status === 'stale');
  const observed = profile?.observed || {};
  const observedDims = (observed.strongestDimensions || []).map((k) => ({ key: k, confidence: observed.byDimension?.[k] ?? 0 }));
  const reconciledDims = Object.entries(profile?.reconciled?.dimensions || {});
  const conflicts = reconciledDims.filter(([, d]) => d?.status === 'conflict');
  const isEmpty = declaredDims.length === 0 && observedDims.length === 0;

  return (
    <Container size="sm" style={{ maxWidth: 480, margin: '0 auto', padding: '16px 12px 100px' }}>
      {/* Overall — qualitative ring, not an anxiety bar */}
      <CardShell>
        <Group justify="space-between" align="center" wrap="nowrap" style={{ gap: 'var(--g-space-4)' }}>
          <Stack style={{ flex: 1, minWidth: 0, gap: 'var(--g-space-1)' }}>
            <Title order={3} c="var(--g-color-text-primary)" style={{ fontFamily: 'var(--g-font-display)' }}>ذائقهٔ غذایی تو</Title>
            <Text size="sm" c="var(--g-color-text-secondary)" style={{ lineHeight: 'var(--g-leading-body)' }}>
              {profile?.maturity?.trustGuidance ? 'هرچه بیشتر بپزی، این تصویر کامل‌تر می‌شود.' : 'هنوز در حال شکل‌گیری است.'}
            </Text>
          </Stack>
          <FoodDnaRing band={band} size={120} label="ذائقهٔ تو" />
        </Group>
      </CardShell>

      {isEmpty && (
        <Box mt="lg">
          <EmptyState title="هنوز سیگنالی نداریم" message="چند سؤال کوتاه پاسخ بده تا ذائقه‌ات شکل بگیره." actionLabel="شروع شناخت ذائقه" onAction={() => navigate('/onboarding')} />
        </Box>
      )}

      {/* What you told us — declared (stated) */}
      {declaredDims.length > 0 && (
        <Box mt="lg">
          <SectionHeader as="h2" title="آنچه گفته‌ای" subtitle="مستقیم از تو — هر وقت بخوای ویرایش کن" />
          <Stack gap="var(--g-space-2)" mt="var(--g-space-3)">
            {declaredDims.map((d) => (
              <PreferenceMemoryRow key={d.key} belief={`${human(d.key)}: ${fmtValue(d.value)}`} source="stated" onEdit={() => navigate('/settings')} />
            ))}
          </Stack>
        </Box>
      )}

      {/* What we noticed — observed (inferred), confidence shown qualitatively */}
      {observedDims.length > 0 && (
        <Box mt="lg">
          <SectionHeader as="h2" title="آنچه متوجه شده‌ایم" subtitle="از روی انتخاب‌های تو — به‌مرور دقیق‌تر" />
          <Stack gap="var(--g-space-3)" mt="var(--g-space-3)">
            {observedDims.map((d) => (
              <CardShell key={d.key}>
                <Group justify="space-between" align="center" mb="var(--g-space-2)">
                  <Text size="sm" fw={600} c="var(--g-color-text-primary)">{human(d.key)}</Text>
                  <StatusBadge tone={confTone(d.confidence)}>{confLabel(d.confidence)}</StatusBadge>
                </Group>
                <ProgressBar value={Math.round((d.confidence || 0) * 100)} showValue={false} tone="brand" />
              </CardShell>
            ))}
          </Stack>
        </Box>
      )}

      {/* Honest reconciliation — where declared & observed differ, BOTH are kept */}
      {conflicts.length > 0 && (
        <Box mt="lg">
          <SectionHeader as="h2" title="جایی که فرق دارند" />
          <Stack gap="var(--g-space-2)" mt="var(--g-space-3)">
            {conflicts.map(([key, d]) => (
              <CardShell key={key}>
                <Text size="sm" fw={600} c="var(--g-color-text-primary)" mb={4}>{human(key)}</Text>
                <Text size="xs" c="var(--g-color-text-secondary)" style={{ lineHeight: 'var(--g-leading-body)' }}>
                  گفته‌ای: «{fmtValue(d.declaredValue ?? d.declared ?? '—')}» · متوجه شده‌ایم: «{fmtValue(d.observedValue ?? d.observed ?? '—')}». هر دو نگه داشته می‌شن — برای ایمنی، آنچه خودت گفته‌ای اولویت داره.
                </Text>
              </CardShell>
            ))}
          </Stack>
        </Box>
      )}

      <Box mt="xl">
        <GesButton variant="secondary" fullWidth onClick={() => navigate('/settings')}>ویرایش ترجیحات و حساسیت‌ها</GesButton>
      </Box>
    </Container>
  );
}
