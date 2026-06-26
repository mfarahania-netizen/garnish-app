import { Box, Text, UnstyledButton } from '@mantine/core';
import { motion } from 'framer-motion';
import {
  IconChevronRight, IconArrowLeft, IconCircleCheckFilled, IconCheck, IconPlus, IconMinus,
  IconAlertTriangle, IconInfoCircle, IconShieldHalf, IconSparkles, IconTrendingUp, IconLeaf,
  IconDeviceMobile, IconLock, IconEye, IconEyeOff,
} from '@tabler/icons-react';
import { useOnboarding } from './useOnboarding';
import { toFaDigits } from '../../components/ges/format';
import { prefersReducedMotion } from '../../lib/motion';
import FoodDnaRing from '../../components/ges/FoodDnaRing';
import TasteBuilder from './TasteBuilder';
import {
  PATTERN_OPTIONS, ALLERGEN_OPTIONS, COOKTIME_OPTIONS, GOAL_V1_OPTIONS, STYLE_OPTIONS,
} from './steps';

/* ── layout ── */
const Column = ({ children }) => (
  <Box style={{ minBlockSize: '100dvh', display: 'flex', justifyContent: 'center', background: 'var(--g-color-bg-canvas)' }}>
    <Box style={{ position: 'relative', width: '100%', maxInlineSize: 480, minBlockSize: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--g-color-bg-canvas)', borderInline: '1px solid var(--g-color-border-subtle)' }}>
      {children}
    </Box>
  </Box>
);

const h2 = { fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-22)', fontWeight: 800, lineHeight: 'var(--g-leading-heading)', textWrap: 'balance', color: 'var(--g-color-text-primary)', margin: 0 };
const h3 = { fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 'var(--g-space-5) 0 0' };
const infoText = { display: 'flex', gap: 'var(--g-space-2)', alignItems: 'flex-start', margin: 'var(--g-space-2) 0 0', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)' };

/* ── primitives ── */
function OptionGrid({ options, value, selectedMap, multi = false, onSelect, cols = 2 }) {
  return (
    <Box style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-3)' }}>
      {options.map((o) => {
        const on = multi ? !!selectedMap?.[o.id] : value === o.id;
        return (
          <UnstyledButton
            key={o.id}
            type="button"
            onClick={() => onSelect(o.id)}
            aria-pressed={on}
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', padding: 'var(--g-space-3)', minBlockSize: 54,
              borderRadius: 'var(--g-radius-card)', border: `1.5px solid ${on ? 'var(--g-color-brand-600)' : 'var(--g-color-border-subtle)'}`,
              background: on ? 'var(--g-color-brand-50)' : 'var(--g-color-bg-surface)', boxShadow: 'var(--g-shadow-1)',
            }}
          >
            {o.Icon ? (
              <Box aria-hidden="true" style={{ flexShrink: 0, inlineSize: 34, blockSize: 34, borderRadius: 'var(--g-radius-input)', display: 'grid', placeItems: 'center', background: on ? 'var(--g-color-brand-100)' : 'var(--g-color-bg-canvas)', color: on ? 'var(--g-color-brand-700)' : 'var(--g-color-text-secondary)' }}>
                <o.Icon size={18} stroke={1.8} />
              </Box>
            ) : null}
            <Text component="span" style={{ flex: 1, minInlineSize: 0, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>{o.label}</Text>
            {on ? <IconCircleCheckFilled size={18} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)', flexShrink: 0 }} /> : null}
          </UnstyledButton>
        );
      })}
    </Box>
  );
}

function ChipSelect({ options, selectedMap, onToggle }) {
  return (
    <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-3)' }}>
      {options.map((o) => {
        const on = !!selectedMap?.[o.id];
        return (
          <UnstyledButton
            key={o.id}
            type="button"
            onClick={() => onToggle(o.id)}
            aria-pressed={on}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 38, paddingInline: 'var(--g-space-4)',
              borderRadius: 'var(--g-radius-chip)', border: `1px solid ${on ? 'var(--g-color-brand-600)' : 'var(--g-color-border-subtle)'}`,
              background: on ? 'var(--g-color-brand-50)' : 'var(--g-color-bg-surface)', color: on ? 'var(--g-color-brand-700)' : 'var(--g-color-text-secondary)',
              fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 600,
            }}
          >
            {on ? <IconCheck size={13} stroke={2} aria-hidden="true" /> : <IconPlus size={13} stroke={2} aria-hidden="true" />}
            {o.label}
          </UnstyledButton>
        );
      })}
    </Box>
  );
}

function AllergenSelect({ options, selected, onToggle, onSeverity }) {
  const chosen = Object.keys(selected);
  return (
    <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)', marginBlockStart: 'var(--g-space-3)' }}>
      <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)' }}>
        {options.map((a) => {
          const on = !!selected[a.id];
          return (
            <UnstyledButton
              key={a.id}
              type="button"
              onClick={() => onToggle(a.id)}
              aria-pressed={on}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 38, paddingInline: 'var(--g-space-4)',
                borderRadius: 'var(--g-radius-chip)', border: `1px solid ${on ? 'var(--g-color-allergen-fg)' : 'var(--g-color-border-subtle)'}`,
                background: on ? 'var(--g-color-allergen-bg)' : 'var(--g-color-bg-surface)', color: on ? 'var(--g-color-allergen-fg)' : 'var(--g-color-text-secondary)',
                fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 600,
              }}
            >
              {on ? <IconAlertTriangle size={13} stroke={2} aria-hidden="true" /> : <IconPlus size={13} stroke={2} aria-hidden="true" />}
              {a.label}
            </UnstyledButton>
          );
        })}
      </Box>
      {chosen.length ? (
        <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)', padding: 'var(--g-space-3)', background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)' }}>
          <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: 'var(--g-color-text-muted)' }}>شدت برای ایمنی</Text>
          {chosen.map((id) => {
            const label = (options.find((x) => x.id === id) || {}).label || id;
            const sev = selected[id];
            const seg = (val, txt) => (
              <UnstyledButton
                key={val}
                type="button"
                onClick={() => onSeverity(id, val)}
                aria-pressed={sev === val}
                style={{
                  paddingInline: 'var(--g-space-3)', paddingBlock: 6, borderRadius: 'var(--g-radius-chip)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600,
                  background: sev === val ? (val === 'severe' ? 'var(--g-color-allergen-fg)' : 'var(--g-color-state-warning-fg)') : 'transparent',
                  color: sev === val ? 'var(--g-color-text-inverse)' : 'var(--g-color-text-secondary)',
                }}
              >
                {txt}
              </UnstyledButton>
            );
            return (
              <Box key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--g-space-2)' }}>
                <Text component="span" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 600, color: 'var(--g-color-text-primary)' }}>
                  <IconAlertTriangle size={14} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-allergen-fg)' }} />{label}
                </Text>
                <Box style={{ display: 'inline-flex', background: 'var(--g-color-bg-canvas)', borderRadius: 'var(--g-radius-chip)', padding: 2 }}>
                  {seg('mild', 'ملایم')}{seg('severe', 'شدید')}
                </Box>
              </Box>
            );
          })}
        </Box>
      ) : null}
    </Box>
  );
}

function Stepper({ valueFa, onInc, onDec }) {
  const btn = { inlineSize: 42, blockSize: 42, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--g-color-text-secondary)' };
  return (
    <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBlockStart: 'var(--g-space-3)', background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)', paddingInline: 'var(--g-space-4)', paddingBlock: 'var(--g-space-2)' }}>
      <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600, color: 'var(--g-color-text-primary)' }}>تعداد نفرات</Text>
      <Box style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--g-color-border-strong)', borderRadius: 'var(--g-radius-input)', overflow: 'hidden' }}>
        <UnstyledButton type="button" onClick={onDec} aria-label="کم‌تر" style={btn}><IconMinus size={18} stroke={1.8} /></UnstyledButton>
        <Text component="span" aria-live="polite" style={{ minInlineSize: 40, textAlign: 'center', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 700 }}>{valueFa}</Text>
        <UnstyledButton type="button" onClick={onInc} aria-label="بیش‌تر" style={btn}><IconPlus size={18} stroke={1.8} /></UnstyledButton>
      </Box>
    </Box>
  );
}

function ProgressDots({ index, total }) {
  return (
    <Box aria-hidden="true" style={{ display: 'flex', gap: 'var(--g-space-1)', marginBlockStart: 'var(--g-space-3)' }}>
      {Array.from({ length: total }, (_, i) => (
        <Box key={i} style={{ flex: 1, blockSize: 5, borderRadius: 'var(--g-radius-chip)', background: i < index ? 'var(--g-color-brand-500)' : 'var(--g-color-border-subtle)' }} />
      ))}
    </Box>
  );
}

const primaryBtn = (disabled) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--g-space-2)', inlineSize: '100%', minBlockSize: 52,
  borderRadius: 'var(--g-radius-input)', background: disabled ? 'var(--g-color-border-strong)' : 'var(--g-color-brand-600)',
  color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 700,
  boxShadow: disabled ? 'none' : 'var(--g-shadow-1)', cursor: disabled ? 'default' : 'pointer',
});

const circleBack = {
  inlineSize: 40, blockSize: 40, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: '50%', border: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-secondary)',
};

/* ── auth field ── */
function Field({ label, icon: Icon, children, helper }) {
  return (
    <Box>
      <Text component="label" style={{ display: 'block', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: 'var(--g-color-text-secondary)', marginBlockEnd: 'var(--g-space-1)' }}>{label}</Text>
      <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', blockSize: 50, paddingInline: 'var(--g-space-4)', background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-strong)', borderRadius: 'var(--g-radius-input)' }}>
        <Icon size={18} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)', flexShrink: 0 }} />
        {children}
      </Box>
      {helper ? <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', margin: 'var(--g-space-1) 2px 0' }}>{helper}</Text> : null}
    </Box>
  );
}
const inputStyle = { flex: 1, minInlineSize: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', color: 'var(--g-color-text-primary)' };

/* ── steps ── */
function Welcome({ onStart, onLogin, showLogin = true }) {
  return (
    <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingInline: 'var(--g-space-6)' }}>
      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <Box aria-hidden="true" style={{ inlineSize: 84, blockSize: 84, borderRadius: 'var(--g-radius-card)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', display: 'grid', placeItems: 'center', boxShadow: 'var(--g-shadow-2)' }}>
          <IconLeaf size={46} stroke={1.8} />
        </Box>
        <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-22)', fontWeight: 800, marginBlockStart: 'var(--g-space-4)', color: 'var(--g-color-text-primary)' }}>گارنیش</Text>
        <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-28)', fontWeight: 800, lineHeight: 'var(--g-leading-heading)', textWrap: 'balance', margin: 'var(--g-space-4) 0 0', color: 'var(--g-color-text-primary)' }}>ذائقه‌ات رو یاد می‌گیرم<br />و کنارت آشپزی می‌کنم</Text>
        <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)', maxInlineSize: 300, margin: 'var(--g-space-3) 0 0' }}>چند پرسشِ کوتاه می‌پرسم تا پیشنهادها از همین حالا به سلیقه‌ات نزدیک باشن — هر وقت خواستی عوضش کن.</Text>
      </Box>
      <Box style={{ paddingBlockEnd: 'calc(var(--g-space-6) + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)' }}>
        <UnstyledButton type="button" onClick={onStart} style={primaryBtn(false)}>بزن بریم</UnstyledButton>
        {showLogin ? (
          <UnstyledButton type="button" onClick={onLogin} style={{ inlineSize: '100%', paddingBlock: 'var(--g-space-2)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600, color: 'var(--g-color-text-secondary)', textAlign: 'center' }}>
            قبلاً حساب داری؟ <Text component="span" style={{ color: 'var(--g-color-brand-700)' }}>ورود</Text>
          </UnstyledButton>
        ) : null}
      </Box>
    </Box>
  );
}

function QuestionShell({ o, children }) {
  return (
    <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', minBlockSize: 0 }}>
      <Box className="g-safe-top" style={{ flexShrink: 0, paddingInline: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-2)' }}>
        <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-3)' }}>
          <UnstyledButton type="button" onClick={o.back} aria-label="بازگشت" style={circleBack}><IconChevronRight size={20} stroke={1.8} /></UnstyledButton>
          <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: 'var(--g-color-text-muted)' }}>گام {toFaDigits(o.progressIndex)} از {toFaDigits(o.progressTotal)}</Text>
          <UnstyledButton type="button" onClick={o.skip} style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 600, color: 'var(--g-color-text-muted)', paddingInline: 'var(--g-space-2)', minBlockSize: 40 }}>فعلاً رد کن</UnstyledButton>
        </Box>
        <ProgressDots index={o.progressIndex} total={o.progressTotal} />
      </Box>
      <Box data-onb-scroll style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingInline: 'var(--g-space-4)', paddingBlock: 'var(--g-space-3)' }}>
        {children}
      </Box>
      <Box style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-3)', paddingBlockEnd: 'calc(var(--g-space-3) + env(safe-area-inset-bottom))', background: 'var(--g-color-bg-surface-raised)', borderBlockStart: '1px solid var(--g-color-border-subtle)', boxShadow: 'var(--g-shadow-2)' }}>
        <UnstyledButton type="button" onClick={o.back} style={{ flexShrink: 0, minBlockSize: 52, paddingInline: 'var(--g-space-5)', borderRadius: 'var(--g-radius-input)', border: '1px solid var(--g-color-border-strong)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-primary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600 }}>قبلی</UnstyledButton>
        <Box style={{ flex: 1 }}>
          <UnstyledButton type="button" onClick={o.canContinue ? o.next : undefined} disabled={!o.canContinue} aria-disabled={!o.canContinue} style={primaryBtn(!o.canContinue)}>
            ادامه<IconArrowLeft size={18} stroke={1.8} aria-hidden="true" />
          </UnstyledButton>
        </Box>
      </Box>
    </Box>
  );
}

function Reveal({ o }) {
  const reduce = prefersReducedMotion();
  return (
    <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingInline: 'var(--g-space-6)' }}>
      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <Box style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
          {!reduce ? (
            <motion.span
              aria-hidden="true"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: [0.7, 1, 1.9], opacity: [0, 0.85, 0] }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 1.0 }}
              style={{ position: 'absolute', inlineSize: 140, blockSize: 140, borderRadius: '50%', background: 'var(--g-color-brand-400)' }}
            />
          ) : null}
          <FoodDnaRing value={0.2} size={168} tone="forming" showValue={false} centerIcon={IconLeaf} caption="" />
        </Box>
        <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', marginBlockStart: 'var(--g-space-5)', paddingInline: 'var(--g-space-3)', paddingBlock: 5, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700 }}>
          <IconTrendingUp size={14} stroke={1.8} aria-hidden="true" />در حال شکل‌گیری
        </Box>
        <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-28)', fontWeight: 800, lineHeight: 'var(--g-leading-heading)', textWrap: 'balance', margin: 'var(--g-space-3) 0 0', color: 'var(--g-color-text-primary)' }}>ذائقه‌ات داره شکل می‌گیره</Text>
        <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)', maxInlineSize: 300, margin: 'var(--g-space-2) 0 0' }}>از همین چند پاسخ، این‌طور شروع کردیم به شناختت:</Text>
        {o.traits.length ? (
          <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)', justifyContent: 'center', marginBlockStart: 'var(--g-space-3)' }}>
            {o.traits.map((t) => (
              <Box key={t.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', paddingInline: 'var(--g-space-3)', paddingBlock: 6, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-brand-200)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700 }}>
                {t.Icon ? <t.Icon size={13} stroke={1.8} aria-hidden="true" /> : null}{t.label}
              </Box>
            ))}
          </Box>
        ) : null}
      </Box>
      <Box style={{ paddingBlockEnd: 'calc(var(--g-space-6) + env(safe-area-inset-bottom))' }}>
        <UnstyledButton type="button" onClick={o.authed ? o.finish : o.next} disabled={o.submitting} aria-disabled={o.submitting} style={primaryBtn(o.submitting)}>
          <IconArrowLeft size={18} stroke={1.8} aria-hidden="true" />{o.submitting ? 'در حال ذخیره…' : 'ذخیره و ادامه'}
        </UnstyledButton>
      </Box>
    </Box>
  );
}

function Auth({ o }) {
  return (
    <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingInline: 'var(--g-space-6)', paddingBlockEnd: 'calc(var(--g-space-6) + env(safe-area-inset-bottom))' }}>
      <Box className="g-safe-top" style={{ paddingBlockStart: 'var(--g-space-3)' }}>
        <UnstyledButton type="button" onClick={o.back} aria-label="بازگشت" style={circleBack}><IconChevronRight size={20} stroke={1.8} /></UnstyledButton>
      </Box>
      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-26)', fontWeight: 800, lineHeight: 'var(--g-leading-heading)', textWrap: 'balance', margin: 0, color: 'var(--g-color-text-primary)' }}>{o.isSignup ? 'یک قدم تا شروع' : 'خوش برگشتی'}</Text>
        <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)', margin: 'var(--g-space-2) 0 0' }}>{o.isSignup ? 'حسابت رو بساز تا شناسهٔ ذائقه‌ات ذخیره بمونه.' : 'وارد شو و آشپزی رو ادامه بده.'}</Text>

        <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)', marginBlockStart: 'var(--g-space-5)' }}>
          <Field label="موبایل" icon={IconDeviceMobile} helper="مثل ۰۹۱۲۳۴۵۶۷۸۹">
            <input dir="ltr" type="tel" inputMode="numeric" autoComplete="tel" placeholder="۰۹..." value={o.phone} onChange={(e) => o.setPhone(e.target.value)} style={{ ...inputStyle, textAlign: 'start' }} />
          </Field>
          <Field label="گذرواژه" icon={IconLock} helper={o.isSignup ? 'حداقل ۸ کاراکتر' : 'گذرواژهٔ حسابت'}>
            <input type={o.showPass ? 'text' : 'password'} autoComplete={o.isSignup ? 'new-password' : 'current-password'} placeholder="••••••••" value={o.password} onChange={(e) => o.setPassword(e.target.value)} style={inputStyle} />
            <UnstyledButton type="button" onClick={o.toggleShowPass} aria-label={o.showPass ? 'پنهان کردن گذرواژه' : 'نمایش گذرواژه'} style={{ flexShrink: 0, color: 'var(--g-color-text-muted)', display: 'inline-flex' }}>
              {o.showPass ? <IconEyeOff size={18} stroke={1.8} /> : <IconEye size={18} stroke={1.8} />}
            </UnstyledButton>
          </Field>

          {o.isSignup ? (
            <Box style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-1)' }}>
              <UnstyledButton
                type="button"
                onClick={o.toggleConsent}
                role="checkbox"
                aria-checked={o.consent}
                aria-label="پذیرش شرایط استفاده و حریم خصوصی"
                style={{ flexShrink: 0, inlineSize: 22, blockSize: 22, marginBlockStart: 1, borderRadius: 'var(--g-radius-chip)', border: `1.5px solid ${o.consent ? 'var(--g-color-brand-600)' : 'var(--g-color-border-strong)'}`, background: o.consent ? 'var(--g-color-brand-600)' : 'transparent', color: 'var(--g-color-text-inverse)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {o.consent ? <IconCheck size={14} stroke={2.4} /> : null}
              </UnstyledButton>
              <Text component="span" onClick={o.toggleConsent} style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)', cursor: 'pointer' }}>
                با <a href="/terms" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--g-color-brand-700)', fontWeight: 700 }}>شرایط استفاده</a> و <a href="/privacy" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--g-color-brand-700)', fontWeight: 700 }}>حریم خصوصی</a> موافقم. پروفایلِ ذائقه‌ام با رضایتِ خودم ساخته می‌شود.
              </Text>
            </Box>
          ) : null}

          {o.error ? (
            <Box role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--g-space-2)', padding: 'var(--g-space-3)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-state-danger-bg)' }}>
              <IconAlertTriangle size={16} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-state-danger-fg)', flexShrink: 0, marginBlockStart: 1 }} />
              <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-state-danger-fg)' }}>{o.error}</Text>
            </Box>
          ) : null}
        </Box>
      </Box>

      <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)' }}>
        <UnstyledButton type="button" onClick={o.submit} disabled={o.submitting} aria-disabled={o.submitting} style={primaryBtn(o.submitting)}>
          {o.submitting ? 'لطفاً صبر کن…' : o.isSignup ? 'ثبت‌نام و شروع' : 'ورود'}
        </UnstyledButton>
        <UnstyledButton type="button" onClick={o.toggleAuth} style={{ inlineSize: '100%', paddingBlock: 'var(--g-space-2)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600, color: 'var(--g-color-text-secondary)', textAlign: 'center' }}>
          {o.isSignup ? 'حساب داری؟ ورود' : 'حساب نداری؟ ثبت‌نام'}
        </UnstyledButton>
      </Box>
    </Box>
  );
}

/** Visually-primary one-tap "no allergies" fast-exit for the modal (no-restriction) user. */
function NoneFastExit({ onClick }) {
  return (
    <UnstyledButton
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--g-space-2)', inlineSize: '100%', minBlockSize: 50,
        marginBlockStart: 'var(--g-space-4)', borderRadius: 'var(--g-radius-input)', border: '1.5px solid var(--g-color-brand-600)',
        background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-15)', fontWeight: 700,
      }}
    >
      <IconCircleCheckFilled size={18} aria-hidden="true" />حساسیتی ندارم — برو ادامه
    </UnstyledButton>
  );
}

export default function OnboardingPage() {
  const o = useOnboarding();
  const a = o.answers;
  return (
    <Column>
      {o.step === 1 ? <Welcome onStart={o.next} onLogin={o.goLogin} showLogin={!o.authed} /> : null}

      {o.step >= 2 && o.step <= 4 ? (
        <QuestionShell o={o}>
          {/* STEP 2 — the ONE required up-front question: allergy safety (EU-14 + a one-tap "None" fast-exit). */}
          {o.step === 2 ? (
            <>
              <Text component="h2" style={h2}>اول، ایمنی</Text>
              <Text component="p" style={infoText}><IconShieldHalf size={14} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-state-warning-fg)', flexShrink: 0, marginBlockStart: 2 }} />به چیزی حساسیت داری؟ این‌ها رو هیچ‌وقت بهت پیشنهاد نمی‌دیم — فقط آلرژی، نه سلیقه. (اطلاع‌رسانی، نه توصیهٔ پزشکی)</Text>
              <AllergenSelect options={ALLERGEN_OPTIONS} selected={a.allergens} onToggle={o.toggleAllergen} onSeverity={o.setSeverity} />
              <NoneFastExit onClick={o.clearAllergensAndNext} />
            </>
          ) : null}

          {/* STEP 3 — one tight "taste & time" screen: the levers that make the first slate precise (diet → pool,
              cooking-time → assessRecipeFit, dislikes → assistant). Everything here is optional/skippable. */}
          {o.step === 3 ? (
            <>
              <Text component="h2" style={h2}>یه کم از سلیقه‌ات</Text>
              <Text component="p" style={infoText}><IconSparkles size={14} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)', flexShrink: 0, marginBlockStart: 2 }} />همین چند تا، پیشنهادها رو از اولین لیست به ذائقه‌ات نزدیک می‌کنه — هر کدوم خواستی رد کن.</Text>
              <Text component="h3" style={h3}>چه‌جور غذایی دوست داری؟</Text>
              <OptionGrid options={PATTERN_OPTIONS} value={a.pattern} onSelect={o.setPattern} />
              <Text component="h3" style={h3}>توی روزهای هفته معمولاً چقدر وقت برای آشپزی داری؟</Text>
              <OptionGrid options={COOKTIME_OPTIONS} value={a.workdayTime} onSelect={o.setWorkdayTime} />
              <Text component="h3" style={h3}>چی دوست داری، چی رو نه؟</Text>
              <Text component="p" style={infoText}><IconInfoCircle size={14} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)', flexShrink: 0, marginBlockStart: 2 }} />هر ماده‌ای رو سرچ کن و بزن «دوست دارم» یا «دوست ندارم» — هر تعداد که خواستی، از بینِ همهٔ مواد.</Text>
              <TasteBuilder likes={a.taste.likes} dislikes={a.taste.dislikes} onAdd={o.addTaste} onRemove={o.removeTaste} />
            </>
          ) : null}

          {/* STEP 4 — intent + style. Goal → declared goals.primary; style → the SOFT cuisine lean (never a filter). */}
          {o.step === 4 ? (
            <>
              <Text component="h2" style={h2}>هدف و سبک</Text>
              <Text component="h3" style={h3}>دنبالِ چی هستی؟ <Text component="span" style={{ fontWeight: 600, color: 'var(--g-color-text-muted)' }}>(هرچند تا)</Text></Text>
              <OptionGrid options={GOAL_V1_OPTIONS} multi selectedMap={a.goals} onSelect={o.toggleGoal} />
              <Text component="h3" style={h3}>بیشتر سنتی، یا سریع و امروزی؟</Text>
              <Text component="p" style={infoText}><IconInfoCircle size={14} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)', flexShrink: 0, marginBlockStart: 2 }} />این فقط وزن می‌ده — اون یکی هیچ‌وقت ازت پنهان نمی‌شه.</Text>
              <OptionGrid options={STYLE_OPTIONS} value={a.style} onSelect={o.setStyle} cols={3} />
            </>
          ) : null}
        </QuestionShell>
      ) : null}

      {o.step === 5 ? <Reveal o={o} /> : null}
      {o.step === 6 ? <Auth o={o} /> : null}
    </Column>
  );
}
