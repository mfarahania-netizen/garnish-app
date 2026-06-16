import { Box, Text } from '@mantine/core';
import { motion } from 'framer-motion';
import { prefersReducedMotion, duration, ease } from '../../lib/motion';
import { toFaDigits } from './format';

/**
 * FoodDnaRing — the calm taste-maturity ring (NOT a %-anxiety bar, no medical claim).
 *
 * A soft donut arc that fills by maturity (0..1). Track = warm border; arc = saffron
 * (brand-600 when developing/mature, the lighter brand-400 while still forming). Center
 * shows the percent + a small caption ("بلوغ ذائقه"). The fill animates with framer-motion
 * (no extra CSS keyframe — base.css reserves keyframes for the shimmer) and is disabled under
 * prefers-reduced-motion (jumps straight to the target). Token-pure.
 *
 * Props: value (0..1), size (px), caption, tone ('mature' | 'forming'), label (override).
 */
export default function FoodDnaRing({ value = 0, size = 100, caption = 'بلوغ ذائقه', tone = 'mature', label }) {
  const clamped = Math.max(0, Math.min(1, Number(value) || 0));
  const sw = Math.max(6, Math.round(size * 0.09));
  const r = (size - sw) / 2;
  const circumference = 2 * Math.PI * r;
  const target = circumference * (1 - clamped);
  const arc = tone === 'forming' ? 'var(--g-color-brand-400)' : 'var(--g-color-brand-600)';
  const reduce = prefersReducedMotion();
  const pct = label ?? `${toFaDigits(Math.round(clamped * 100))}٪`;
  const big = size >= 96;

  return (
    <Box role="img" aria-label={`${caption}: ${pct}`} style={{ position: 'relative', inlineSize: size, blockSize: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--g-color-border-subtle)" strokeWidth={sw} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={arc}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: reduce ? target : circumference }}
          animate={{ strokeDashoffset: target }}
          transition={reduce ? { duration: 0 } : { duration: duration.slow + 0.5, ease: ease.enter, delay: 0.15 }}
        />
      </svg>
      <Box style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontWeight: 800, fontSize: big ? 'var(--g-font-size-22)' : 'var(--g-font-size-16)', lineHeight: 1, color: 'var(--g-color-text-primary)' }}>
          {pct}
        </Text>
        {caption ? (
          <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontWeight: 600, fontSize: 'var(--g-font-size-12)', marginBlockStart: 3, color: 'var(--g-color-text-muted)' }}>
            {caption}
          </Text>
        ) : null}
      </Box>
    </Box>
  );
}
