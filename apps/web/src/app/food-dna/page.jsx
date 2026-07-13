import { Box, Text, UnstyledButton } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import {
  IconChevronRight, IconSparkles, IconCloudOff, IconRefresh, IconCheck, IconSeedling,
  IconThumbUp, IconThumbDown, IconArrowLeft,
} from '@tabler/icons-react';
import { useFoodDna, useTaste } from './useFoodDna';
import { useState, useRef, useEffect, useCallback } from 'react';
import FoodDnaRing from '../../components/ges/FoodDnaRing';
import { SkeletonLine } from '../../components/ges/LoadingSkeleton';
import Toast from '../../components/ges/Toast';
import { toFaDigits } from '../../components/ges/format';
import {
  DNA_TITLE_FA, bandFa, bandLineFa, dimFa, dimLineFa, metricFa,
  questionPromptFa, questionOptionsFa, summaryFa,
} from './dna-fa';

const Column = ({ children }) => (
  <Box style={{ minBlockSize: '100dvh', display: 'flex', justifyContent: 'center', background: 'var(--g-color-bg-canvas)' }}>
    <Box style={{ position: 'relative', width: '100%', maxInlineSize: 480, minBlockSize: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--g-color-bg-canvas)', borderInline: '1px solid var(--g-color-border-subtle)' }}>
      {children}
    </Box>
  </Box>
);

const h2 = { fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: '0 0 var(--g-space-3)' };
const body = { fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)' };
const muted = { fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)' };

function Header({ onBack }) {
  return (
    <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', paddingInline: 'var(--g-space-3)', paddingBlockStart: 'calc(var(--g-space-3) + env(safe-area-inset-top))', paddingBlockEnd: 'var(--g-space-3)', borderBlockEnd: '1px solid var(--g-color-border-subtle)' }}>
      <UnstyledButton type="button" onClick={onBack} aria-label="بازگشت" style={{ inlineSize: 44, blockSize: 44, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--g-color-text-primary)' }}>
        <IconChevronRight size={22} stroke={1.8} />
      </UnstyledButton>
      <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>{DNA_TITLE_FA}</Text>
    </Box>
  );
}

function DnaLoading() {
  return (
    <Column>
      <Box role="status" aria-busy="true" aria-label="در حال بارگذاری…" style={{ padding: 'var(--g-space-4)' }}>
        <Box style={{ display: 'flex', justifyContent: 'center', marginBlock: 'var(--g-space-5)' }}><Box className="g-skeleton" style={{ inlineSize: 140, blockSize: 140, borderRadius: '50%' }} /></Box>
        {[0, 1, 2].map((i) => <Box key={i} className="g-skeleton" style={{ blockSize: 88, borderRadius: 'var(--g-radius-card)', marginBlockEnd: 'var(--g-space-3)' }} />)}
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

// Only dimensions that actually carry signal are rendered here. Cards without confidence are hidden
// (one calm empty-state block is shown at the top instead of four near-empty cards).
function DimensionCard({ dim }) {
  const meta = dimFa(dim.key);
  const chips = (dim.metrics || [])
    .map((m) => metricFa(m.key, m.value))
    .filter(Boolean)
    .slice(0, 2); // cap at 2 meaningful chips — no metric dumps
  return (
    <Box style={{ background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)', padding: 'var(--g-space-4)', boxShadow: 'var(--g-shadow-1)' }}>
      <Text component="h3" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>{meta.label}</Text>
      <Text component="p" style={{ ...body, margin: 'var(--g-space-2) 0 0' }}>{dimLineFa(dim.key, dim.status, dim.evidenceCount)}</Text>
      {meta.hint ? <Text component="p" style={{ ...muted, margin: '2px 0 0' }}>{meta.hint}</Text> : null}
      {chips.length ? (
        <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-3)' }}>
          {chips.map((c, i) => (
            <Box key={i} style={{ paddingInline: 'var(--g-space-3)', paddingBlock: 5, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600 }}>{c}</Box>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

// chips for affinities / avoidances — large, tappable, the most meaningful signal on the page.
function ChipRow({ items }) {
  return (
    <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)' }}>
      {items.map((c, i) => (
        <Box key={`${c}-${i}`} style={{ paddingInline: 'var(--g-space-3)', paddingBlock: 6, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 700 }}>{c}</Box>
      ))}
    </Box>
  );
}

function Section({ title, children, muted: mutedTone }) {
  return (
    <Box style={{ marginBlockStart: 'var(--g-space-5)' }}>
      <Text component="h2" style={{ ...h2, color: mutedTone ? 'var(--g-color-text-muted)' : 'var(--g-color-text-primary)' }}>{title}</Text>
      {children}
    </Box>
  );
}

function QuestionCard({ question, remaining, onAnswer, submitting }) {
  if (!question) {
    return (
      <Box style={{ background: 'var(--g-color-ai-surface)', border: 'var(--g-border-ai)', borderRadius: 'var(--g-radius-card)', padding: 'var(--g-space-4)' }}>
        <Text component="p" style={{ ...body, margin: 0 }}>فعلاً سؤالی نیست — بیشترین رشدِ شناسهٔ ذائقه از آشپزیِ واقعی می‌آد.</Text>
      </Box>
    );
  }
  const opts = questionOptionsFa(question); // DROPS unmappable options — never leaks English
  return (
    <Box style={{ background: 'var(--g-color-ai-surface)', border: 'var(--g-border-ai)', borderRadius: 'var(--g-radius-card)', padding: 'var(--g-space-4)' }}>
      <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)' }}>
        <IconSparkles size={14} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} />
        <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--g-color-brand-700)' }}>کمک به شناخت بهتر</Text>
      </Box>
      <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-15)', fontWeight: 700, color: 'var(--g-color-text-primary)', margin: 'var(--g-space-2) 0 0' }}>{questionPromptFa(question)}</Text>
      {opts.length ? (
        <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-3)' }}>
          {opts.map((o) => (
            <UnstyledButton key={o.key} type="button" disabled={submitting} onClick={() => onAnswer(question.dimensionKey || question.id, o.key)} style={{ minBlockSize: 44, paddingInline: 'var(--g-space-3)', display: 'inline-flex', alignItems: 'center', borderRadius: 'var(--g-radius-chip)', border: '1px solid var(--g-color-border-strong)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-primary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 600, opacity: submitting ? 0.6 : 1 }}>{o.label}</UnstyledButton>
          ))}
        </Box>
      ) : null}
      {remaining > 0 ? <Text component="p" style={{ ...muted, margin: 'var(--g-space-3) 0 0' }}>{toFaDigits(remaining)} سؤال دیگه می‌تونی جواب بدی.</Text> : null}
      <Text component="p" style={{ ...muted, margin: 'var(--g-space-2) 0 0' }}>پاسخ‌ها فقط یه نقطهٔ شروعِ کوچیکن؛ آشپزیِ واقعی شناسه رو می‌سازه.</Text>
    </Box>
  );
}

const STANCES = [
  { id: 'like', label: 'دوستش دارم', Icon: IconThumbUp },
  { id: 'dislike', label: 'دوست ندارم', Icon: IconThumbDown },
];

function TasteRow({ pref, onCorrect, busy, first }) {
  const mine = pref.source === 'you';
  return (
    <Box style={{ padding: 'var(--g-space-3) var(--g-space-4)', borderBlockStart: first ? 'none' : '1px solid var(--g-color-border-subtle)' }}>
      <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--g-space-2)' }}>
        <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>{pref.name}</Text>
        <Text component="span" style={{ ...muted, color: mine ? 'var(--g-color-brand-700)' : 'var(--g-color-text-muted)' }}>
          {mine ? '✓ تأیید خودت' : (pref.stance === 'like' ? 'به‌نظر دوستش داری' : 'به‌نظر دوست نداری')}
        </Text>
      </Box>
      <Box style={{ display: 'flex', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-2)' }}>
        {STANCES.map((s) => {
          const active = mine ? s.id === pref.stance : false;
          const Icon = s.Icon;
          return (
            <UnstyledButton
              key={s.id}
              type="button"
              disabled={busy}
              aria-pressed={active}
              onClick={() => onCorrect(pref.ingredientId, s.id)}
              style={{
                flex: 1, minBlockSize: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                borderRadius: 'var(--g-radius-chip)',
                border: `1px solid ${active ? 'var(--g-color-brand-600)' : 'var(--g-color-border-strong)'}`,
                background: active ? 'var(--g-color-brand-50)' : 'var(--g-color-bg-surface)',
                color: active ? 'var(--g-color-brand-700)' : 'var(--g-color-text-secondary)',
                fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, opacity: busy ? 0.6 : 1,
              }}
            >
              <Icon size={15} stroke={1.8} aria-hidden="true" />{s.label}
            </UnstyledButton>
          );
        })}
      </Box>
    </Box>
  );
}

function TasteSection({ showToast }) {
  const { items, loading, correct, correcting } = useTaste();
  if (loading) return null;
  if (!items.length) {
    return (
      <Section title="مواد و سلیقهٔ تو" muted>
        <Box style={{ background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)', padding: 'var(--g-space-4)' }}>
          <Text component="p" style={{ ...muted, margin: 0 }}>هنوز حدسِ مشخصی از سلیقه‌ات در مواد ندارم — با پختن روشن می‌شه.</Text>
        </Box>
      </Section>
    );
  }
  const onCorrect = async (ingredientId, stance) => {
    try { await correct(ingredientId, stance); showToast('ذائقه‌ات به‌روز شد', IconCheck); }
    catch { showToast('ثبت نشد، دوباره تلاش کن', IconCloudOff); }
  };
  return (
    <Section title="مواد و سلیقهٔ تو">
      <Text component="p" style={{ ...muted, margin: '0 0 var(--g-space-3)' }}>این‌ها رو از آشپزیت حدس زدم. اشتباهه؟ اصلاحش کن.</Text>
      <Box style={{ background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)', boxShadow: 'var(--g-shadow-1)' }}>
        {items.map((p, i) => <TasteRow key={p.ingredientId} pref={p} onCorrect={onCorrect} busy={correcting} first={i === 0} />)}
      </Box>
    </Section>
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

  const dna = m.dna || {};
  const maturity = dna.maturity || { band: 'empty', score: 0 };
  const band = maturity.band || 'empty';
  const { caption, tone } = bandFa(band);
  const cold = band === 'empty' || (maturity.score ?? 0) <= 0;
  const observations = dna.evidence?.observationCount ?? 0;

  // dimensions: hide silent ones, order strongest → weakest
  const strongest = Array.isArray(dna.strongestDimensions) ? dna.strongestDimensions : [];
  const dimsWithSignal = (dna.dimensions || []).filter((d) => d.confidence > 0);
  const visibleDims = [...dimsWithSignal].sort((a, b) => {
    const sa = strongest.indexOf(a.key); const sb = strongest.indexOf(b.key);
    if (sa !== -1 && sb !== -1) return sa - sb;
    if (sa !== -1) return -1;
    if (sb !== -1) return 1;
    return b.confidence - a.confidence;
  });

  const summary = summaryFa(dna.dimensions);
  const affinities = Array.isArray(dna.dimensions) ? Array.from(new Set(dna.dimensions.filter((d) => d.key === 'taste').flatMap((d) => d.affinities || []))).slice(0, 8) : [];
  const avoidances = Array.isArray(dna.dimensions) ? Array.from(new Set(dna.dimensions.filter((d) => d.key === 'taste').flatMap((d) => d.avoidances || []))).slice(0, 8) : [];

  return (
    <Column>
      <Header onBack={() => navigate(-1)} />
      <Box component="main" style={{ flex: 1, overflowY: 'auto', paddingInline: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-8)' }}>
        {/* Maturity is a qualitative band; the decorative ring is static and does not encode the heuristic score. */}
        <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBlock: 'var(--g-space-5)' }}>
          <FoodDnaRing
            size={148}
            tone={tone}
            caption={caption}
            showValue={false}
            displayMode="qualitative"
            centerIcon={cold ? IconSeedling : undefined}
          />
          <Text component="p" style={{ ...body, textAlign: 'center', maxInlineSize: 320, margin: 'var(--g-space-3) 0 0' }}>{bandLineFa(band, observations)}</Text>
        </Box>

        {/* ONE calm growth hint near the top (deduped — was repeated in every card) */}
        <Text component="p" style={{ ...muted, textAlign: 'center', maxInlineSize: 320, marginInline: 'auto', marginBlock: '0 var(--g-space-4)' }}>هر چی بیشتر بپزی و جست‌وجو کنی، این تصویر دقیق‌تر می‌شه.</Text>

        {/* synthesized one-liner at the top — meaning first */}
        {summary ? (
          <Box style={{ background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)', padding: 'var(--g-space-4)', boxShadow: 'var(--g-shadow-1)' }}>
            <Text component="p" style={{ ...body, margin: 0 }}>{summary}</Text>
          </Box>
        ) : null}

        {/* silent dimension fallback: one calm empty-state block instead of four near-empty cards */}
        {visibleDims.length === 0 ? (
          <Box style={{ marginBlockStart: 'var(--g-space-5)', background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)', padding: 'var(--g-space-4)' }}>
            <Text component="p" style={{ ...body, margin: 0 }}>هنوز نشانهٔ کافی از آشپزیت ندارم. با چند بار پختن، ذائقه و سبک آشپزیت اینجا روشن می‌شه.</Text>
          </Box>
        ) : null}

        {/* affinities + avoidances — the most meaningful signals, promoted to first-class chips */}
        {affinities.length ? (
          <Section title="موادی که بهشون گرایش داری">
            <ChipRow items={affinities} />
          </Section>
        ) : null}
        {avoidances.length ? (
          <Section title="موادی که کمتر دوست داری" muted>
            <ChipRow items={avoidances} />
          </Section>
        ) : null}

        {/* dimensions with signal, strongest first */}
        {visibleDims.length ? (
          <Box style={{ marginBlockStart: 'var(--g-space-5)' }}>
            <Text component="h2" style={h2}>بیشتر بدون</Text>
            <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)' }}>
              {visibleDims.map((d) => <DimensionCard key={d.key} dim={d} />)}
            </Box>
          </Box>
        ) : null}

        {/* inferred taste the user can correct */}
        <TasteSection showToast={showToast} />

        {/* onboarding question entry */}
        <Box style={{ marginBlockStart: 'var(--g-space-5)' }}>
          <QuestionCard question={m.question} remaining={m.questionRemaining} onAnswer={onAnswer} submitting={m.submitting} />
        </Box>

        {/* primary CTA — the page's payoff */}
        <Box style={{ marginBlockStart: 'var(--g-space-6)' }}>
          <UnstyledButton type="button" onClick={() => navigate('/discover')} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--g-space-2)', inlineSize: '100%', minBlockSize: 52, borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-15)', fontWeight: 700 }}>
            غذاهای مناسب ذائقه‌ات
            <IconArrowLeft size={18} stroke={1.8} aria-hidden="true" />
          </UnstyledButton>
        </Box>
      </Box>
      <Toast toast={toast} />
    </Column>
  );
}
