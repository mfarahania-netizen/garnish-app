import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Stack, Text, Container, ActionIcon } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import apiClient from '../../../lib/apiClient';
import { useAnalytics } from '../../../hooks/useAnalytics';
import {
  CookStep, TopBar, AISheet, Button as GesButton, LoadingSkeleton, ErrorState, EmptyState, FoodDnaRing,
} from '../../../components/ges';
import { successCelebrate, withReducedMotion, prefersReducedMotion } from '../../../lib/motion';

const stepText = (s) => (typeof s === 'string' ? s : (s?.instruction || s?.text || s?.title || ''));

/**
 * Cook Mode (S22) — immersive, distraction-free cooking, one CookStep at a time over the recipe's
 * RecipeStep[]. AI help is anchored to the current step (grounded — no free-roaming agent). The finish
 * is the ONE earned Celebrate (cook_complete). 4 states. Routed standalone (no bottom nav) so the step
 * controls own the screen.
 */
export default function CookModePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();

  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [idx, setIdx] = useState(0);
  const [finished, setFinished] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(false);
    apiClient.get(`/recipes/${id}`)
      .then((res) => { if (alive) setRecipe(res.data); })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  useEffect(() => { trackEvent('cook_mode_open', { recipeId: id }); }, [id, trackEvent]);

  const steps = recipe?.steps || [];
  const total = steps.length;

  const exit = () => navigate(`/recipe/${id}`);

  const onNext = () => {
    trackEvent('cook_step_complete', { recipeId: id, stepIdx: idx });
    if (idx + 1 >= total) {
      trackEvent('cook_complete', { recipeId: id });
      setFinished(true);
    } else {
      setIdx((i) => i + 1);
    }
  };
  const onPrev = () => setIdx((i) => Math.max(0, i - 1));

  const Frame = ({ children }) => (
    <Box style={{ minBlockSize: '100dvh', background: 'var(--g-color-bg-canvas)' }} dir="rtl">
      <TopBar title={recipe?.title || 'حالت پخت'} actions={<ActionIcon variant="subtle" onClick={exit} aria-label="بستن حالت پخت" style={{ color: 'var(--g-color-text-secondary)' }}><IconX size={20} /></ActionIcon>} />
      <Container size="sm" style={{ maxWidth: 560, margin: '0 auto', padding: 'var(--g-space-5) var(--g-space-4) var(--g-space-10)' }}>
        {children}
      </Container>
    </Box>
  );

  if (loading) return <Frame><LoadingSkeleton shape="card" lines={4} label="در حال بارگذاری مراحل" /></Frame>;
  if (error) return <Frame><ErrorState title="خطا در بارگذاری" message="مراحل پخت در دسترس نبود. چیزی از دست نرفت." retryLabel="بازگشت به رسپی" onRetry={exit} /></Frame>;
  if (total === 0) return <Frame><EmptyState title="مراحل پخت ثبت نشده" message="برای این رسپی مرحله‌ای ثبت نشده است." actionLabel="بازگشت به رسپی" onAction={exit} /></Frame>;

  // Finish — the one earned Celebrate (≤1/session, reduced-motion safe).
  if (finished) {
    const cel = prefersReducedMotion() ? {} : successCelebrate;
    return (
      <Frame>
        <Stack align="center" gap="var(--g-space-5)" style={{ textAlign: 'center', paddingBlock: 'var(--g-space-8)' }}>
          <motion.div initial={cel.initial} animate={cel.animate}><FoodDnaRing band="developing" size={150} label="آفرین" /></motion.div>
          <Text style={{ fontFamily: 'var(--g-font-display)', fontSize: 'var(--g-font-size-28)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>پختت تموم شد! 🎉</Text>
          <Text c="var(--g-color-text-secondary)" style={{ maxWidth: 340, lineHeight: 'var(--g-leading-body)' }}>نوش جان. این پخت به ذائقهٔ غذایی‌ات اضافه می‌شه.</Text>
          <Box style={{ inlineSize: '100%', maxWidth: 320 }}>
            <Stack gap="var(--g-space-2)">
              <GesButton fullWidth onClick={() => navigate('/')}>بازگشت به خانه</GesButton>
              <GesButton variant="secondary" fullWidth onClick={exit}>دیدن دوبارهٔ رسپی</GesButton>
            </Stack>
          </Box>
        </Stack>
      </Frame>
    );
  }

  const current = steps[idx];
  return (
    <Frame>
      <CookStep
        stepNumber={idx + 1}
        totalSteps={total}
        text={stepText(current)}
        state="active"
        isFirst={idx === 0}
        isLast={idx + 1 >= total}
        onPrev={onPrev}
        onNext={onNext}
        prevLabel="قبلی"
        nextLabel="مرحلهٔ بعد"
        doneLabel="تمومه"
      />
      <Box mt="var(--g-space-5)">
        <GesButton variant="ghost" onClick={() => { setAiOpen(true); trackEvent('ai_sheet_open', { recipeId: id, surface: 'cook', stepIdx: idx }); }}>
          کمک از دستیار برای این مرحله
        </GesButton>
      </Box>

      <AISheet
        opened={aiOpen}
        onClose={() => setAiOpen(false)}
        contextLabel={`مرحلهٔ ${idx + 1}`}
        title="کمک برای این مرحله"
        state="answer"
      >
        <Text>
          برای این مرحله می‌تونم نکته بدم یا ساده‌ترش کنم. برای گفتگوی کامل دستیار رو باز کن.
        </Text>
        <Box mt="var(--g-space-3)">
          <GesButton onClick={() => { setAiOpen(false); navigate('/ai-chat'); }}>باز کردن دستیار</GesButton>
        </Box>
      </AISheet>
    </Frame>
  );
}
