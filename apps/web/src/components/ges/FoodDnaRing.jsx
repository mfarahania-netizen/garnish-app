import { Box, Stack, Text } from '@mantine/core';
import { motion } from 'framer-motion';
import { gentleFade, withReducedMotion } from '../../lib/motion';

/**
 * FoodDnaRing — the signature, calm representation of a user's evolving food
 * identity (GES "Food DNA"). It is a qualitative MATURITY indicator, never a
 * precise completion percentage and never an anxiety bar (GES §10 / Guide:
 * "no % anxiety bar"). It makes no medical claim.
 *
 * Band states (the only states): empty | forming | developing | mature — each
 * fills the ring qualitatively (a seed → a near-full arc) with a warm saffron
 * tone that deepens as the identity matures. Honest copy: an empty ring says it
 * is just getting started, never that the user is "incomplete".
 *
 * Motion: a single settle fade on mount (withReducedMotion → opacity-only for
 * reduced-motion users). The arc never spins or loops.
 *
 * A11y: role="img" with a descriptive, plain-language aria-label; the visible
 * caption repeats the band so meaning is never color-only.
 *
 * Pure presentational. Props:
 *  - band: 'empty' | 'forming' | 'developing' | 'mature' (default 'empty')
 *  - size: ring diameter in px (default 160)
 *  - label: small heading above the band caption (default "Food DNA")
 *  - caption: override the band caption copy
 */

const BAND_CONFIG = {
  empty: {
    fraction: 0.05,
    stroke: 'var(--g-color-brand-200)',
    caption: 'Just getting started',
    aria: 'just getting started — share a little and it begins to take shape',
  },
  forming: {
    fraction: 0.34,
    stroke: 'var(--g-color-brand-300)',
    caption: 'Forming',
    aria: 'forming — your tastes are starting to take shape',
  },
  developing: {
    fraction: 0.67,
    stroke: 'var(--g-color-brand-500)',
    caption: 'Developing',
    aria: 'developing — a clearer picture of what you enjoy',
  },
  mature: {
    fraction: 1,
    stroke: 'var(--g-color-brand-600)',
    caption: 'Well developed',
    aria: 'well developed — a rich picture of your food tastes',
  },
};

export function FoodDnaRing({
  band = 'empty',
  size = 160,
  label = 'Food DNA',
  caption,
}) {
  const config = BAND_CONFIG[band] ?? BAND_CONFIG.empty;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arc = Math.max(0, Math.min(1, config.fraction)) * c;
  const bandCaption = caption ?? config.caption;

  return (
    <motion.div
      variants={withReducedMotion(gentleFade)}
      initial="initial"
      animate="animate"
      role="img"
      aria-label={`${label}: ${config.aria}`}
      data-band={band}
      style={{ display: 'inline-flex' }}
    >
      <Box style={{ position: 'relative', inlineSize: size, blockSize: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          aria-hidden="true"
          style={{ display: 'block', transform: 'rotate(-90deg)' }}
        >
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--g-color-border-subtle)"
            strokeWidth={stroke}
          />
          {/* Maturity arc — qualitative, rounded cap, calm */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={config.stroke}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arc} ${c}`}
          />
        </svg>

        {/* Center caption — repeats the band as text (never color-only) */}
        <Stack
          align="center"
          justify="center"
          gap={2}
          style={{ position: 'absolute', inset: 0, paddingInline: 'var(--g-space-4)' }}
        >
          <Text
            style={{
              fontFamily: 'var(--g-font-text)',
              fontSize: 'var(--g-font-size-12)',
              fontWeight: 500,
              letterSpacing: '0.04em',
              color: 'var(--g-color-text-muted)',
              textAlign: 'center',
            }}
          >
            {label}
          </Text>
          <Text
            style={{
              fontFamily: 'var(--g-font-display)',
              fontSize: 'var(--g-font-size-16)',
              fontWeight: 700,
              lineHeight: 'var(--g-leading-heading)',
              color: 'var(--g-color-text-primary)',
              textAlign: 'center',
            }}
          >
            {bandCaption}
          </Text>
        </Stack>
      </Box>
    </motion.div>
  );
}

export default FoodDnaRing;
