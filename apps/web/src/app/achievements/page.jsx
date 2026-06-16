import { useState, useEffect } from 'react';
import { Container, Box, Stack, Group, Text, Title, SimpleGrid } from '@mantine/core';
import { IconTrophy, IconFlame, IconSnowflake, IconAward } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../lib/apiClient';
import { useAnalytics } from '../../hooks/useAnalytics';
import {
  GamificationStrip, StatusBadge, SectionHeader, CardShell, ProgressBar,
  EmptyState, ErrorState, LoadingSkeleton, Button as GesButton,
} from '../../components/ges';

/**
 * Achievements (S22) — the user's OWN private progress (GET /gamification/me): streak (with kind grace),
 * earned badges, mastery. By construction there is NO leaderboard, NO comparison, NO shame — the API
 * exposes only the user's own data, and this screen renders only that. A broken streak is a warm restart.
 */
export default function AchievementsPage() {
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();
  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('token');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(hasToken);
  const [error, setError] = useState(false);

  useEffect(() => { trackEvent('page_view', { page: '/achievements' }); }, [trackEvent]);

  useEffect(() => {
    if (!hasToken) return;
    let alive = true;
    setLoading(true); setError(false);
    apiClient.get('/gamification/me')
      .then((res) => { if (alive) setData(res.data); })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [hasToken]);

  if (!hasToken) {
    return (
      <Container size="sm" style={{ maxWidth: 480, margin: '0 auto', padding: '16px 12px 100px' }}>
        <EmptyState title="پیشرفت تو، خصوصیِ تو" message="برای دیدن دستاوردها و رشته‌ات وارد شو." actionLabel="ورود" onAction={() => navigate('/auth')} />
      </Container>
    );
  }
  if (loading) {
    return (
      <Container size="sm" style={{ maxWidth: 480, margin: '0 auto', padding: '16px 12px 100px' }}>
        <LoadingSkeleton shape="list" lines={5} label="در حال بارگذاری دستاوردها" />
      </Container>
    );
  }
  if (error || !data) {
    return (
      <Container size="sm" style={{ maxWidth: 480, margin: '0 auto', padding: '16px 12px 100px' }}>
        <ErrorState title="خطا در بارگذاری" message="دستاوردها الان در دسترس نبود. چیزی از دست نرفت." retryLabel="تلاش دوباره" onRetry={() => window.location.reload()} />
      </Container>
    );
  }

  const streakWeeks = data?.streak?.currentWeeks ?? 0;
  const graceUsed = !!data?.streak?.graceUsed;
  const earned = data?.achievements?.allEarned || [];
  const mastery = data?.mastery || null;

  return (
    <Container size="sm" style={{ maxWidth: 480, margin: '0 auto', padding: '16px 12px 100px' }}>
      <Box mb="lg" mt="xs">
        <Title order={3} c="var(--g-color-text-primary)" style={{ fontFamily: 'var(--g-font-display)' }}>دستاوردهای تو</Title>
        <Text size="sm" c="var(--g-color-text-secondary)">پیشرفت شخصی‌ات — فقط برای خودت، بدون مقایسه با کسی.</Text>
      </Box>

      {/* Streak (kind grace, never shame) */}
      <CardShell>
        <Group justify="space-between" align="center" wrap="nowrap">
          <Group gap="var(--g-space-2)" align="center">
            <IconFlame size={28} stroke={1.6} color="var(--g-color-food-saffron)" aria-hidden="true" />
            <div>
              <Text fw={700} c="var(--g-color-text-primary)">{streakWeeks > 0 ? `${streakWeeks} هفته پشت‌سرهم` : 'آمادهٔ شروع تازه'}</Text>
              <Text size="xs" c="var(--g-color-text-secondary)">{streakWeeks > 0 ? 'ادامه بده — با ریتم خودت.' : 'هر وقت پختی، رشته‌ات شروع می‌شه.'}</Text>
            </div>
          </Group>
          {graceUsed && (
            <StatusBadge tone="info"><Group gap={4} wrap="nowrap"><IconSnowflake size={12} aria-hidden="true" /> یک هفته استراحت</Group></StatusBadge>
          )}
        </Group>
        <Box mt="var(--g-space-3)">
          <GamificationStrip
            streakDays={streakWeeks}
            streakState={streakWeeks > 0 ? 'active' : 'broken'}
            streakLabelSingular="هفته"
            streakLabelPlural="هفته"
            restartLabel="شروع تازه — هر وقت خواستی"
            achievement={earned[0]?.title ? { label: earned[0].title } : null}
          />
        </Box>
      </CardShell>

      {/* Mastery */}
      {mastery && (
        <Box mt="lg">
          <SectionHeader as="h2" title="سطح مهارت" subtitle={mastery.levelName || ''} />
          <Box mt="var(--g-space-3)">
            <CardShell>
              <Group justify="space-between" align="center" mb="var(--g-space-2)">
                <Group gap="var(--g-space-2)"><IconAward size={20} color="var(--g-color-brand-700)" aria-hidden="true" /><Text fw={600} c="var(--g-color-text-primary)">{mastery.levelName || `سطح ${mastery.level ?? ''}`}</Text></Group>
                <StatusBadge tone="success">{`سطح ${mastery.level ?? 1}`}</StatusBadge>
              </Group>
              {typeof mastery.score === 'number' && <ProgressBar value={Math.round(mastery.score * 100)} showValue={false} tone="success" />}
            </CardShell>
          </Box>
        </Box>
      )}

      {/* Earned badges */}
      <Box mt="lg">
        <SectionHeader as="h2" title="نشان‌های به‌دست‌آمده" />
        {earned.length === 0 ? (
          <Box mt="var(--g-space-3)">
            <EmptyState title="هنوز نشانی نگرفته‌ای" message="با اولین پخت، اولین نشانت رو می‌گیری. بدون عجله." actionLabel="یه رسپی پیدا کن" onAction={() => navigate('/recipes')} />
          </Box>
        ) : (
          <SimpleGrid cols={2} spacing="sm" mt="var(--g-space-3)">
            {earned.map((a) => (
              <CardShell key={a.key}>
                <Stack gap="var(--g-space-1)" align="center" style={{ textAlign: 'center' }}>
                  <IconTrophy size={28} stroke={1.5} color="var(--g-color-state-warning-fg)" aria-hidden="true" />
                  <Text size="sm" fw={700} c="var(--g-color-text-primary)">{a.title}</Text>
                  {a.description && <Text size="xs" c="var(--g-color-text-secondary)" style={{ lineHeight: 'var(--g-leading-body)' }}>{a.description}</Text>}
                </Stack>
              </CardShell>
            ))}
          </SimpleGrid>
        )}
        <Text size="xs" c="var(--g-color-text-muted)" mt="var(--g-space-3)" ta="center">نشان‌های بیشتر با پختن و کاوش بیشتر باز می‌شن.</Text>
      </Box>
    </Container>
  );
}
