import { Box, Text, UnstyledButton } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import {
  IconChevronRight, IconLeaf, IconSparkles, IconCloudOff, IconRefresh, IconCheck, IconFlame,
} from '@tabler/icons-react';
import { useFoodDna } from './useFoodDna';
import { useState, useRef, useEffect, useCallback } from 'react';
import FoodDnaRing from '../../components/ges/FoodDnaRing';
import { SkeletonLine } from '../../components/ges/LoadingSkeleton';
import Toast from '../../components/ges/Toast';
import { toFaDigits } from '../../components/ges/format';

const Column = ({ children }) => (
  <Box style={{ minBlockSize: '100dvh', display: 'flex', justifyContent: 'center', background: 'var(--g-color-bg-canvas)' }}>
    <Box style={{ position: 'relative', width: '100%', maxInlineSize: 480, minBlockSize: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--g-color-bg-canvas)', borderInline: '1px solid var(--g-color-border-subtle)' }}>
      {children}
    </Box>
  </Box>
);

// band → calm Persian label + ring tone (the engine decides the band; we only localize it)
const BAND = {
  empty: { label: 'تازه شروع شده', tone: 'forming' },
  forming: { label: 'در حال شکل‌گیری', tone: 'forming' },
  developing: { label: 'در حال رشد', tone: 'mature' },
  mature: { label: 'پخته و روشن', tone: 'mature' },
};
const DIM = {
  taste: { label: 'ذائقه', Icon: IconLeaf },
  effort: { label: 'زمان و تلاش', Icon: IconFlame },
  skill: { label: 'مهارت', Icon: IconSparkles },
  routine: { label: 'روال', Icon: IconLeaf },
};
const METRIC_LABEL = {
  flavorPattern: 'الگوی طعم', exploration: 'کنجکاوی', repetition: 'تکرارپسندی',
  quickMeal: 'سرعت‌پسندی', lowPrep: 'کم‌زحمت‌پسندی', complexReady: 'آمادگی برای پیچیده',
  technique: 'تکنیک', completionGrowth: 'رشد تکمیل', nextChallenge: 'آمادگی چالش بعدی',
  weeklyPlanning: 'برنامه‌ریزی هفتگی', mealTiming: 'ریتم وعده‌ها', weekendCooking: 'آشپزی آخر هفته',
};
const fmtMetric = (v) => (typeof v === 'number' ? `${toFaDigits(Math.round(v * 100))}٪` : String(v));

function Header({ onBack }) {
  return (
    <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', paddingInline: 'var(--g-space-3)', paddingBlockStart: 'calc(var(--g-space-3) + env(safe-area-inset-top))', paddingBlockEnd: 'var(--g-space-3)', borderBlockEnd: '1px solid var(--g-color-border-subtle)' }}>
      <UnstyledButton type="button" onClick={onBack} aria-label="بازگشت" style={{ inlineSize: 40, blockSize: 40, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--g-color-text-primary)' }}>
        <IconChevronRight size={22} stroke={1.8} />
      </UnstyledButton>
      <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>شناسهٔ ذائقه</Text>
    </Box>
  );
}

function DnaLoading() {
  return (
    <Column>
      <Box role="status" aria-busy="true" aria-label="در حال بارگذاری…" style={{ padding: 'var(--g-space-4)' }}>
        <Box style={{ display: 'flex', justifyContent: 'center', marginBlock: 'var(--g-space-5)' }}><Box className="g-skeleton" style={{ inlineSize: 140, blockSize: 140, borderRadius: '50%' }} /></Box>
        {[0, 1, 2, 3].map((i) => <Box key={i} className="g-skeleton" style={{ blockSize: 88, borderRadius: 'var(--g-radius-card)', marginBlockEnd: 'var(--g-space-3)' }} />)}
      </Box>
    </Column>
  );
}

function DnaError({ onRetry }) {
  return (
    <Column>
      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingInline: 'var(--g-space-6)', gap: 'var(--g-space-2)' }}>
        <Box aria-hidden="true" style={{ inlineSize: 56, blockSize: 56, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--g-color-state-info-bg)', color: 'var(--g-color-text-secondary)', marginBlockEnd: 'var(--g-space-2)' }}><IconCloudOff size={26} stroke={1.6} /></Box>
        <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>شناسهٔ ذائقه بارگذاری نشد</Text>
        <UnstyledButton type="button" onClick={onRetry} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 44, paddingInline: 'var(--g-space-5)', marginBlockStart: 'var(--g-space-3)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700 }}><IconRefresh size={16} stroke={1.8} aria-hidden="true" />تلاش دوباره</UnstyledButton>
      </Box>
    </Column>
  );
}

function DimensionCard({ dim }) {
  const meta = DIM[dim.key] || { label: dim.key, Icon: IconLeaf };
  const Icon = meta.Icon;
  const hasSignal = dim.confidence > 0 && dim.safeExplanation;
  return (
    <Box style={{ background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)', padding: 'var(--g-space-4)', boxShadow: 'var(--g-shadow-1)' }}>
      <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--g-space-2)' }}>
        <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
          <Icon size={18} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} />
          <Text component="h3" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>{meta.label}</Text>
        </Box>
        <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: 'var(--g-color-text-muted)' }}>{toFaDigits(Math.round(dim.confidence * 100))}٪ اطمینان</Text>
      </Box>
      {/* the engine's honest, computed explanation — never our own claim */}
      <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', lineHeight: 'var(--g-leading-body)', color: hasSignal ? 'var(--g-color-text-secondary)' : 'var(--g-color-text-muted)', margin: 'var(--g-space-2) 0 0' }}>
        {hasSignal ? dim.safeExplanation : 'هنوز نشانهٔ کافی برای این بُعد نداریم — با پختن بیشتر روشن می‌شه.'}
      </Text>
      {hasSignal && dim.metrics?.length ? (
        <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-3)' }}>
          {dim.metrics.map((m) => (
            <Box key={m.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, paddingInline: 'var(--g-space-2)', paddingBlock: 3, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600 }}>
              {METRIC_LABEL[m.key] || m.key}: {fmtMetric(m.value)}
            </Box>
          ))}
        </Box>
      ) : null}
      {hasSignal && dim.affinities?.length ? (
        <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', margin: 'var(--g-space-2) 0 0' }}>گرایش به: {dim.affinities.join('، ')}</Text>
      ) : null}
      <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', margin: 'var(--g-space-2) 0 0' }}>↗ چطور رشد می‌کند: با پختن، جست‌وجو و ذخیرهٔ غذاها این بُعد دقیق‌تر می‌شود.</Text>
    </Box>
  );
}

function QuestionCard({ question, remaining, onAnswer, submitting }) {
  if (!question) {
    return (
      <Box style={{ background: 'var(--g-color-ai-surface)', border: 'var(--g-border-ai)', borderRadius: 'var(--g-radius-card)', padding: 'var(--g-space-4)' }}>
        <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600, color: 'var(--g-color-text-primary)', margin: 0 }}>فعلاً سؤالی نیست — بیشترین رشدِ شناسهٔ ذائقه از آشپزیِ واقعی می‌آد.</Text>
      </Box>
    );
  }
  const opts = Array.isArray(question.options) ? question.options : [];
  return (
    <Box style={{ background: 'var(--g-color-ai-surface)', border: 'var(--g-border-ai)', borderRadius: 'var(--g-radius-card)', padding: 'var(--g-space-4)' }}>
      <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)' }}>
        <IconSparkles size={14} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} />
        <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--g-color-brand-700)' }}>یک سؤال کوتاه</Text>
      </Box>
      <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-15)', fontWeight: 700, color: 'var(--g-color-text-primary)', margin: 'var(--g-space-2) 0 0' }}>{question.prompt}</Text>
      {opts.length ? (
        <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-3)' }}>
          {opts.map((o) => (
            <UnstyledButton key={o} type="button" disabled={submitting} onClick={() => onAnswer(question.dimensionKey || question.id, o)} style={{ minBlockSize: 44, paddingInline: 'var(--g-space-3)', display: 'inline-flex', alignItems: 'center', borderRadius: 'var(--g-radius-chip)', border: '1px solid var(--g-color-border-strong)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-primary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 600, opacity: submitting ? 0.6 : 1 }}>{o}</UnstyledButton>
          ))}
        </Box>
      ) : null}
      <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', margin: 'var(--g-space-3) 0 0' }}>پاسخ‌ها فقط یک نقطهٔ شروعِ کوچک‌اند (حداکثر ۲۰٪)؛ آشپزیِ واقعی شناسه را می‌سازد.</Text>
    </Box>
  );
}

export default function FoodDnaPage() {
  const navigate = useNavigate();
  const m = useFoodDna();
  const [toast, setToast] = useState(null);
  const toastTimer = useRef();
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const showToast = useCallback((message, Icon) => { clearTimeout(toastTimer.current); setToast({ message, Icon }); toastTimer.current = setTimeout(() => setToast(null), 2200); }, []);
  const onAnswer = async (key, value) => {
    const ok = await m.submitAnswer(key, value);
    showToast(ok ? 'ثبت شد' : 'ثبت نشد، دوباره تلاش کن', ok ? IconCheck : IconCloudOff);
  };

  if (m.status === 'loading') return <DnaLoading />;
  if (m.status === 'error') return <DnaError onRetry={m.refetch} />;

  const dna = m.dna;
  const band = BAND[dna?.maturity?.band] || BAND.forming;
  const score = typeof dna?.maturity?.score === 'number' ? dna.maturity.score : 0;
  const cold = dna?.status === 'cold_start';

  return (
    <Column>
      <Header onBack={() => navigate(-1)} />
      <Box component="main" style={{ flex: 1, overflowY: 'auto', paddingInline: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-8)' }}>
        {/* maturity ring — REAL band/score (no hardcoded number) */}
        <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBlock: 'var(--g-space-5)' }}>
          <FoodDnaRing value={score} size={148} tone={band.tone} caption={band.label} />
          {dna?.maturity?.trustGuidance ? (
            <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)', textAlign: 'center', maxInlineSize: 320, margin: 'var(--g-space-3) 0 0' }}>{dna.maturity.trustGuidance}</Text>
          ) : null}
        </Box>

        {/* honest cold-start / forming banner — never a fake high % */}
        {cold ? (
          <Box style={{ background: 'var(--g-color-brand-50)', border: '1px solid var(--g-color-brand-200)', borderRadius: 'var(--g-radius-card)', padding: 'var(--g-space-4)', marginBlockEnd: 'var(--g-space-4)' }}>
            <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600, lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-primary)', margin: 0 }}>شناسهٔ ذائقه‌ات تازه داره شکل می‌گیره 🌱 چند غذا بپز و جست‌وجو کن تا دقیق‌تر بشه.</Text>
          </Box>
        ) : null}

        {/* the four dimensions with the engine's safeExplanation */}
        <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)' }}>
          {(dna?.dimensions || []).map((d) => <DimensionCard key={d.key} dim={d} />)}
        </Box>

        {/* real onboarding question engine entry */}
        <Box style={{ marginBlockStart: 'var(--g-space-4)' }}>
          <QuestionCard question={m.question} remaining={m.questionRemaining} onAnswer={onAnswer} submitting={m.submitting} />
        </Box>
      </Box>
      <Toast toast={toast} />
    </Column>
  );
}
