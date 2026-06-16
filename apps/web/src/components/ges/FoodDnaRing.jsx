import { useId } from 'react';
import { Box, Text } from '@mantine/core';
import { motion } from 'framer-motion';
import { prefersReducedMotion, duration, ease } from '../../lib/motion';
import { toFaDigits } from './format';

/**
 * FoodDnaRing — the calm taste-maturity ring (NOT a %-anxiety bar, no medical claim).
 *
 * Soft donut arc filling by maturity (0..1). Track = warm border; arc = a saffron
 * gradient (brand-400 → brand-600) when developing/mature, a lighter solid while
 * forming, with a gentle saffron drop-shadow. Center shows the percent + caption
 * ("بلوغ ذائقه"). Fills via framer-motion (no extra CSS keyframe — base.css reserves
 * those for the shimmer) and is disabled under prefers-reduced-motion. Token-pure.
 */
export default function FoodDnaRing({ value = 0, size = 104, caption = 'بلوغ ذائقه', tone = 'mature', label }) {
  const gid = `dnaArc${useId().replace(/:/g, '')}`; // sanitize React useId for use in SVG url(#…)
  const clamped = Math.max(0, Math.min(1, Number(value) || 0));
  const sw = Math.max(7, Math.round(size * 0.096));
  const r = (size - sw) / 2;
  const circumference = 2 * Math.PI * r;
  const target = circumference * (1 - clamped);
  const arc = tone === 'forming' ? 'var(--g-color-brand-300)' : `url(#${gid})`;
  const reduce = prefersReducedMotion();
  const pct = label ?? `${toFaDigits(Math.round(clamped * 100))}٪`;
  const big = size >= 96;

  return (
    <Box role="img" aria-label={`${caption}: ${pct}`} style={{ position: 'relative', inlineSize: size, blockSize: size, flexShrink: 0 }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)', filter: 'drop-shadow(0 3px 5px color-mix(in srgb, var(--g-color-brand-600) 22%, transparent))' }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--g-color-brand-400)" />
            <stop offset="1" stopColor="var(--g-color-brand-600)" />
          </linearGradient>
        </defs>
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
