import { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Text, UnstyledButton, Drawer } from '@mantine/core';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  IconX, IconChevronRight, IconChevronLeft, IconClockPlay, IconPlayerPause, IconRefresh,
  IconSparkles, IconTag, IconInfoCircle, IconCheck, IconHeart, IconCloudOff, IconFlame,
} from '@tabler/icons-react';
import { useCook } from './useCook';
import { toFaDigits } from '../../../components/ges/format';
import { prefersReducedMotion } from '../../../lib/motion';
import { SkeletonLine } from '../../../components/ges/LoadingSkeleton';
import Toast from '../../../components/ges/Toast';

const FA = '۰۱۲۳۴۵۶۷۸۹';
const toLatinNum = (s) => String(s ?? '').replace(/[۰-۹]/g, (d) => FA.indexOf(d));
const mmss = (sec) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${toFaDigits(String(m).padStart(2, '0'))}:${toFaDigits(String(s).padStart(2, '0'))}`;
};

// honest per-step duration parsed from the REAL step text (e.g. «۶ تا ۷ دقیقه» → 7m, «۲ ساعت» → 120m)
function stepMinutes(text) {
  const t = toLatinNum(text);
  let mins = 0;
  const h = t.match(/(\d+)\s*ساعت/);
  if (h) mins += parseInt(h[1], 10) * 60;
  const range = t.match(/(\d+)\s*(?:تا|الی|-)\s*(\d+)\s*دقیقه/);
  const m = t.match(/(\d+)\s*دقیقه/);
  if (range) mins += parseInt(range[2], 10);
  else if (m) mins += parseInt(m[1], 10);
  return mins > 0 && mins <= 600 ? mins : 0;
}

const Column = ({ children }) => (
  <Box style={{ minBlockSize: '100dvh', display: 'flex', justifyContent: 'center', background: 'var(--g-color-bg-canvas)' }}>
    <Box style={{ position: 'relative', width: '100%', maxInlineSize: 480, minBlockSize: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--g-color-bg-canvas)', borderInline: '1px solid var(--g-color-border-subtle)' }}>
      {children}
    </Box>
  </Box>
);

function StepTimer({ minutes, onDone }) {
  const [remaining, setRemaining] = useState(minutes * 60);
  const [running, setRunning] = useState(false);
  const tick = useRef();
  useEffect(() => () => clearInterval(tick.current), []);
  useEffect(() => {
    if (!running) return undefined;
    tick.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { clearInterval(tick.current); setRunning(false); onDone?.(); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(tick.current);
  }, [running, onDone]);

  const done = remaining === 0;
  const toggle = () => { if (done) { setRemaining(minutes * 60); return; } setRunning((x) => !x); };
  const label = done ? 'تمام' : running ? mmss(remaining) : `شروع تایمر · ${mmss(remaining)}`;
  return (
    <UnstyledButton type="button" onClick={toggle} aria-label={done ? 'تنظیم دوبارهٔ تایمر' : running ? 'مکث تایمر' : 'شروع تایمر'} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-5)', paddingInline: 'var(--g-space-5)', minBlockSize: 52, borderRadius: 'var(--g-radius-card)', background: 'var(--g-color-brand-50)', border: '1px solid var(--g-color-brand-200)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-22)', fontWeight: 800, inlineSize: 'max-content' }}>
      {done ? <IconRefresh size={22} stroke={1.8} aria-hidden="true" /> : running ? <IconPlayerPause size={22} stroke={1.8} aria-hidden="true" /> : <IconClockPlay size={22} stroke={1.8} aria-hidden="true" />}
      {label}
    </UnstyledButton>
  );
}

function CookError({ onRetry, onExit, title }) {
  return (
    <Column>
      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingInline: 'var(--g-space-6)', gap: 'var(--g-space-2)' }}>
        <Box aria-hidden="true" style={{ inlineSize: 56, blockSize: 56, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--g-color-state-info-bg)', color: 'var(--g-color-text-secondary)', marginBlockEnd: 'var(--g-space-2)' }}><IconCloudOff size={26} stroke={1.6} /></Box>
        <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>{title || 'مراحل بارگذاری نشد'}</Text>
        <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', color: 'var(--g-color-text-secondary)', margin: 0 }}>دوباره امتحان کن.</Text>
        <Box style={{ display: 'flex', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-3)' }}>
          <UnstyledButton type="button" onClick={onExit} style={{ minBlockSize: 44, paddingInline: 'var(--g-space-5)', borderRadius: 'var(--g-radius-input)', border: '1px solid var(--g-color-border-strong)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-primary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600 }}>بازگشت</UnstyledButton>
          {onRetry ? <UnstyledButton type="button" onClick={onRetry} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 44, paddingInline: 'var(--g-space-5)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700 }}><IconRefresh size={16} stroke={1.8} aria-hidden="true" />تلاش دوباره</UnstyledButton> : null}
        </Box>
      </Box>
    </Column>
  );
}

function CookLoading() {
  return (
    <Column>
      <Box style={{ padding: 'var(--g-space-5)' }}>
        <Box className="g-skeleton" style={{ blockSize: 6, borderRadius: 'var(--g-radius-chip)' }} />
        <Box className="g-skeleton" style={{ inlineSize: 64, blockSize: 64, borderRadius: 'var(--g-radius-card)', marginBlockStart: 'var(--g-space-6)' }} />
        <SkeletonLine w="95%" h={18} style={{ marginBlockStart: 'var(--g-space-5)' }} />
        <SkeletonLine w="80%" h={18} style={{ marginBlockStart: 'var(--g-space-2)' }} />
        <Box className="g-skeleton" style={{ inlineSize: 140, blockSize: 48, borderRadius: 'var(--g-radius-card)', marginBlockStart: 'var(--g-space-5)' }} />
      </Box>
    </Column>
  );
}

function Finish({ c, onDone, onRate }) {
  const reduce = prefersReducedMotion();
  return (
    <Column>
      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingInline: 'var(--g-space-6)' }}>
        <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <Box style={{ position: 'relative', display: 'grid', placeItems: 'center', inlineSize: 130, blockSize: 130 }}>
            {!reduce ? (
              <motion.span aria-hidden="true" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: [0.6, 1, 2], opacity: [0, 0.85, 0] }} transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1], delay: 0.15 }} style={{ position: 'absolute', inlineSize: 120, blockSize: 120, borderRadius: '50%', background: 'var(--g-color-brand-400)' }} />
            ) : null}
            <motion.div initial={reduce ? false : { scale: 0.5 }} animate={reduce ? false : { scale: [0.5, 1.12, 1] }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.25 }} style={{ inlineSize: 108, blockSize: 108, borderRadius: '50%', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', display: 'grid', placeItems: 'center', boxShadow: 'var(--g-shadow-2)' }}>
              <IconCheck size={56} stroke={2} aria-hidden="true" />
            </motion.div>
          </Box>
          <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-28)', fontWeight: 800, lineHeight: 'var(--g-leading-heading)', margin: 'var(--g-space-6) 0 0', color: 'var(--g-color-text-primary)' }}>آفرین — نوشِ جان!</Text>
          <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)', maxInlineSize: 290, margin: 'var(--g-space-3) 0 0' }}>
            {c.recipe.title} آماده‌ست.{c.loggedIn ? ' پختت رو ثبت کردیم.' : ''}
          </Text>
          {c.loggedIn && c.streakWeeks > 0 ? (
            <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', marginBlockStart: 'var(--g-space-3)', paddingInline: 'var(--g-space-3)', paddingBlock: 6, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700 }}>
              <IconFlame size={14} stroke={1.8} aria-hidden="true" />رشتهٔ فعلیت: {toFaDigits(c.streakWeeks)} هفتهٔ پیاپی
            </Box>
          ) : null}
        </Box>
        <Box style={{ paddingBlockEnd: 'calc(var(--g-space-6) + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)' }}>
          <UnstyledButton type="button" onClick={onDone} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', inlineSize: '100%', minBlockSize: 52, borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 700 }}>تمام</UnstyledButton>
          <UnstyledButton type="button" onClick={onRate} style={{ inlineSize: '100%', paddingBlock: 'var(--g-space-2)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600, color: 'var(--g-color-text-secondary)', textAlign: 'center' }}>
            چطور بود؟ <Text component="span" style={{ color: 'var(--g-color-brand-700)' }}>یک نظر بده</Text>
          </UnstyledButton>
        </Box>
      </Box>
    </Column>
  );
}

export default function CookPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const c = useCook(id);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef();
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const showToast = useCallback((message, Icon) => {
    clearTimeout(toastTimer.current);
    setToast({ message, Icon });
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);
  const exit = useCallback(() => navigate(`/recipe/${id}`), [navigate, id]);

  if (c.status === 'loading') return <CookLoading />;
  if (c.status === 'error' || c.status === 'empty' || !c.recipe) return <CookError onRetry={() => c.refetch()} onExit={exit} />;
  if (c.total === 0) return <CookError onExit={exit} title="این دستور مرحله‌ای ثبت‌نشده" />;
  if (c.finished) return <Finish c={c} onDone={() => navigate('/')} onRate={() => showToast('ممنون! نظرت ثبت شد', IconHeart)} />;

  const last = c.step === c.total - 1;
  const mins = stepMinutes(c.currentStep);

  return (
    <Column>
      {/* top */}
      <Box style={{ flexShrink: 0, paddingInline: 'var(--g-space-5)', paddingBlockStart: 'calc(var(--g-space-3) + env(safe-area-inset-top))', paddingBlockEnd: 'var(--g-space-3)' }}>
        <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--g-space-2)', marginBlockEnd: 'var(--g-space-3)' }}>
          <UnstyledButton type="button" onClick={exit} aria-label="بستن حالت پخت" style={{ inlineSize: 44, blockSize: 44, borderRadius: '50%', border: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-secondary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><IconX size={20} stroke={1.8} /></UnstyledButton>
          <Text component="span" style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.recipe.title}</Text>
          <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 700, color: 'var(--g-color-brand-700)', flexShrink: 0 }}>مرحلهٔ {toFaDigits(c.step + 1)} از {toFaDigits(c.total)}</Text>
        </Box>
        <Box aria-hidden="true" style={{ blockSize: 6, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-border-subtle)', overflow: 'hidden' }}>
          <Box style={{ inlineSize: `${Math.round(((c.step + 1) / c.total) * 100)}%`, blockSize: '100%', background: 'var(--g-color-brand-500)' }} />
        </Box>
      </Box>

      {/* big step */}
      <Box component="main" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', paddingInline: 'var(--g-space-6)', paddingBlock: 'var(--g-space-3)' }}>
        <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Box aria-hidden="true" style={{ inlineSize: 64, blockSize: 64, borderRadius: 'var(--g-radius-card)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', display: 'grid', placeItems: 'center', fontFamily: 'var(--g-font-fa)', fontWeight: 800, fontSize: 'var(--g-font-size-28)', boxShadow: 'var(--g-shadow-2)' }}>{toFaDigits(c.step + 1)}</Box>
          <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-22)', fontWeight: 600, lineHeight: 'var(--g-leading-body)', textWrap: 'pretty', color: 'var(--g-color-text-primary)', margin: 'var(--g-space-5) 0 0' }}>{c.currentStep}</Text>
          {mins > 0 ? <StepTimer key={c.step} minutes={mins} onDone={() => showToast('تایمر تمام شد', IconClockPlay)} /> : null}
        </Box>
      </Box>

      {/* bottom controls */}
      <Box style={{ flexShrink: 0, paddingInline: 'var(--g-space-5)', paddingBlockStart: 'var(--g-space-3)', paddingBlockEnd: 'calc(var(--g-space-4) + env(safe-area-inset-bottom))', borderBlockStart: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface-raised)', boxShadow: 'var(--g-shadow-2)' }}>
        <UnstyledButton type="button" onClick={c.openHelp} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--g-space-2)', inlineSize: '100%', minBlockSize: 44, marginBlockEnd: 'var(--g-space-3)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-ai-surface)', border: 'var(--g-border-ai)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700 }}>
          <IconSparkles size={16} stroke={1.8} aria-hidden="true" />کمک برای این مرحله
        </UnstyledButton>
        <Box style={{ display: 'flex', gap: 'var(--g-space-2)' }}>
          <UnstyledButton type="button" onClick={c.prev} disabled={c.step === 0} aria-label="مرحلهٔ قبلی" style={{ inlineSize: 64, minBlockSize: 60, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--g-radius-card)', border: '1px solid var(--g-color-border-strong)', background: 'var(--g-color-bg-surface)', color: c.step === 0 ? 'var(--g-color-text-muted)' : 'var(--g-color-text-primary)' }}><IconChevronRight size={24} stroke={1.8} /></UnstyledButton>
          <UnstyledButton type="button" onClick={c.next} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--g-space-2)', minBlockSize: 60, borderRadius: 'var(--g-radius-card)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 700, boxShadow: 'var(--g-shadow-1)' }}>{last ? 'پایان' : 'بعدی'}<IconChevronLeft size={22} stroke={1.8} aria-hidden="true" /></UnstyledButton>
        </Box>
      </Box>

      {/* AI help sheet (disclosed + hedged + grounded) */}
      <Drawer
        opened={c.sheetOpen}
        onClose={c.closeHelp}
        position="bottom"
        withCloseButton
        closeButtonProps={{ 'aria-label': 'بستن' }}
        size="auto"
        zIndex={500}
        title={(
          <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
            <Box aria-hidden="true" style={{ inlineSize: 24, blockSize: 24, borderRadius: '50%', background: 'var(--g-color-ai-glow)', color: 'var(--g-color-brand-600)', display: 'grid', placeItems: 'center', boxShadow: '0 0 0 1px var(--g-color-brand-200)' }}><IconSparkles size={13} stroke={1.8} /></Box>
            <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--g-color-brand-700)' }}>دستیارِ AI</Text>
          </Box>
        )}
        overlayProps={{ backgroundOpacity: 0.42, blur: 2 }}
        styles={{ content: { background: 'var(--g-color-bg-surface)', borderStartStartRadius: 'var(--g-radius-sheet)', borderStartEndRadius: 'var(--g-radius-sheet)' }, header: { background: 'var(--g-color-bg-surface)' }, body: { paddingInline: 'var(--g-space-5)', paddingBlockEnd: 'var(--g-space-5)' } }}
      >
        <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', paddingInline: 'var(--g-space-3)', paddingBlock: 5, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600 }}>
          <IconTag size={13} stroke={1.8} aria-hidden="true" />دربارهٔ: مرحلهٔ {toFaDigits(c.step + 1)} از {toFaDigits(c.total)}
        </Box>
        <Box style={{ marginBlockStart: 'var(--g-space-4)', minBlockSize: 64 }}>
          {c.help.loading ? (
            <Box aria-busy="true"><SkeletonLine w="90%" h={12} /><SkeletonLine w="62%" h={12} style={{ marginBlockStart: 'var(--g-space-2)' }} /></Box>
          ) : c.help.text ? (
            <>
              <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-primary)', margin: 0 }}>{c.help.text}</Text>
              <Text component="p" style={{ display: 'flex', gap: 'var(--g-space-2)', alignItems: 'flex-start', margin: 'var(--g-space-3) 0 0', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-muted)' }}>
                <IconInfoCircle size={14} stroke={1.8} aria-hidden="true" style={{ flexShrink: 0, marginBlockStart: 1 }} />پاسخِ AI ممکن است اشتباه کند.
              </Text>
            </>
          ) : (
            <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)', margin: 0 }}>الان نتونستم کمکِ روشنی بیارم — یه لحظه دیگه دوباره امتحان کن. پاسخِ AI ممکن است اشتباه کند.</Text>
          )}
        </Box>
      </Drawer>

      <Toast toast={toast} />
    </Column>
  );
}
