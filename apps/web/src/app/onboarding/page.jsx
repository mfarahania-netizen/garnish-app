import { useState, useEffect, useCallback } from 'react';
import { Container, Box, Stack, Group, Text, Title } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import apiClient from '../../lib/apiClient';
import { useAnalytics } from '../../hooks/useAnalytics';
import ConsentModal from '../../components/ConsentModal';
import {
  FoodDnaStepCard, FoodDnaRing, Chip, Button as GesButton, LoadingSkeleton, ErrorState,
} from '../../components/ges';
import { successCelebrate, withReducedMotion, prefersReducedMotion } from '../../lib/motion';

/**
 * Onboarding (S22) — the guided, wellness-framed flow that learns the user's taste via the REAL
 * question engine (GET /profile/next-question → POST /profile/answer). Composes the kit
 * (FoodDnaStepCard, Chip, FoodDnaRing). No medical framing; budget is asked as a BAND (engine options);
 * allergies are routed to the safety allergy-flow honestly; consent is surfaced (ConsentModal) when the
 * engine reports a purpose isn't granted. The Food DNA reveal is the ONE earned Celebrate moment.
 *
 * Stages: welcome → questions (engine-driven) → reveal. The final step hands off to /auth when the
 * visitor isn't signed in (the profile is consent- + auth-gated; nothing is fabricated).
 */
export default function OnboardingPage() {
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();
  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('token');

  const [stage, setStage] = useState('welcome');     // welcome | questions | reveal
  const [question, setQuestion] = useState(null);    // { key, prompt, options?, consentPurpose }
  const [remaining, setRemaining] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [band, setBand] = useState('forming');
  const [note, setNote] = useState('');

  const fetchNext = useCallback(async () => {
    setLoading(true); setError(false); setSelected(null); setNote('');
    try {
      const { data } = await apiClient.get('/profile/next-question');
      if (!data?.question) { setQuestion(null); await goReveal(); return; }
      setQuestion(data.question);
      setRemaining(data.remaining ?? 0);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const goReveal = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/profile');
      setBand(data?.maturity?.band || 'forming');
    } catch { setBand('forming'); }
    trackEvent('onboarding_complete', {});
    setStage('reveal');
  }, [trackEvent]);

  useEffect(() => {
    trackEvent('page_view', { page: '/onboarding' });
  }, [trackEvent]);

  const start = () => {
    if (!hasToken) { navigate('/auth'); return; }
    trackEvent('onboarding_start', {});
    setStage('questions');
    fetchNext();
  };

  const isAllergy = question?.key?.toLowerCase().includes('allerg');

  const submit = async () => {
    if (!question) return;
    if (isAllergy) {
      // Declared allergies are safety-critical — managed via the dedicated allergy/settings flow.
      setNote('حساسیت‌های غذایی را در تنظیمات با شدت و جزئیات ثبت کن — برای ایمنی پیشنهادها.');
      setAnswered((n) => n + 1);
      setTimeout(fetchNext, 600);
      return;
    }
    if (selected == null) { setAnswered((n) => n + 1); fetchNext(); return; } // honest skip
    setSaving(true);
    try {
      const { data } = await apiClient.post('/profile/answer', { key: question.key, value: selected });
      if (data?.status === 'consent_required') { setConsentOpen(true); setSaving(false); return; }
      if (data?.status === 'use_allergy_flow') { setNote('این مورد را در تنظیمات حساسیت‌ها مدیریت کن.'); }
      trackEvent('dna_step_complete', { key: question.key, status: data?.status });
      setAnswered((n) => n + 1);
      await fetchNext();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  const total = Math.max(answered + remaining + 1, answered + 1);

  // ── Welcome ──
  if (stage === 'welcome') {
    return (
      <Container size="sm" style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px 100px' }}>
        <Stack align="center" gap="var(--g-space-5)" style={{ textAlign: 'center', paddingBlock: 'var(--g-space-8)' }}>
          <FoodDnaRing band="empty" size={150} label="ذائقهٔ تو" />
          <Title order={2} c="var(--g-color-text-primary)" style={{ fontFamily: 'var(--g-font-display)' }}>به گارنیش خوش اومدی</Title>
          <Text c="var(--g-color-text-secondary)" style={{ maxWidth: 360, lineHeight: 'var(--g-leading-body)' }}>
            با چند سؤال کوتاه، ذائقه‌ات رو می‌شناسیم تا پیشنهادها برات دقیق‌تر و سالم‌تر بشن. هر چیزی رو می‌تونی رد کنی،
            و کنترل اطلاعاتت همیشه با خودته.
          </Text>
          <Box style={{ inlineSize: '100%', maxWidth: 320 }}>
            <GesButton fullWidth onClick={start}>{hasToken ? 'شروع کنیم' : 'ورود و شروع'}</GesButton>
          </Box>
          <GesButton variant="ghost" onClick={() => navigate('/')}>الان نه</GesButton>
        </Stack>
      </Container>
    );
  }

  // ── Reveal (the one earned Celebrate) ──
  if (stage === 'reveal') {
    const reveal = prefersReducedMotion() ? {} : successCelebrate;
    return (
      <Container size="sm" style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px 100px' }}>
        <Stack align="center" gap="var(--g-space-5)" style={{ textAlign: 'center', paddingBlock: 'var(--g-space-8)' }}>
          <motion.div initial={reveal.initial} animate={reveal.animate}>
            <FoodDnaRing band={band} size={170} label="ذائقهٔ تو" />
          </motion.div>
          <Title order={2} c="var(--g-color-text-primary)" style={{ fontFamily: 'var(--g-font-display)' }}>ذائقهٔ غذایی تو شکل گرفت</Title>
          <Text c="var(--g-color-text-secondary)" style={{ maxWidth: 360, lineHeight: 'var(--g-leading-body)' }}>
            هرچه بیشتر بپزی و انتخاب کنی، این تصویر کامل‌تر و پیشنهادها دقیق‌تر می‌شن. هر زمان می‌تونی ویرایشش کنی.
          </Text>
          <Box style={{ inlineSize: '100%', maxWidth: 320 }}>
            <Stack gap="var(--g-space-2)">
              <GesButton fullWidth onClick={() => navigate('/')}>بزن بریم</GesButton>
              <GesButton variant="secondary" fullWidth onClick={() => navigate('/food-dna')}>دیدن ذائقهٔ کامل</GesButton>
            </Stack>
          </Box>
        </Stack>
      </Container>
    );
  }

  // ── Questions (engine-driven) ──
  return (
    <Container size="sm" style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px 100px' }}>
      {loading ? (
        <LoadingSkeleton shape="card" lines={3} label="در حال آماده‌سازی سؤال" />
      ) : error ? (
        <ErrorState title="یه مشکل کوچیک پیش اومد" message="چیزی از دست نرفت. می‌تونی دوباره تلاش کنی." retryLabel="تلاش دوباره" onRetry={fetchNext} />
      ) : question ? (
        <FoodDnaStepCard
          stepNumber={answered + 1}
          totalSteps={total}
          question={question.prompt}
          isAllergyStep={isAllergy}
          saving={saving}
          saveError={note || undefined}
          onNext={submit}
          onSkip={() => { trackEvent('dna_step_skip', { key: question.key }); setAnswered((n) => n + 1); fetchNext(); }}
        >
          {Array.isArray(question.options) && question.options.length > 0 ? (
            <Group gap="var(--g-space-2)" wrap="wrap">
              {question.options.map((opt) => (
                <Chip key={opt} label={opt} selected={selected === opt} onClick={() => setSelected(opt)} />
              ))}
            </Group>
          ) : (
            <Text size="sm" c="var(--g-color-text-secondary)">برای ادامه «بعدی» را بزن.</Text>
          )}
        </FoodDnaStepCard>
      ) : (
        <LoadingSkeleton shape="card" lines={3} label="در حال آماده‌سازی" />
      )}

      <ConsentModal
        opened={consentOpen}
        onClose={() => setConsentOpen(false)}
        onConsentGiven={() => { setConsentOpen(false); submit(); }}
      />
    </Container>
  );
}
