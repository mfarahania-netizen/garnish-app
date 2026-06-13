import { Box, Text, UnstyledButton } from '@mantine/core';
import { IconCircleCheck, IconCircleDashed, IconCircleMinus } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { pressResponse } from '../../lib/motion';

/**
 * NutritionBadge (PL row 10) — source / confidence on EVERY nutrition number.
 *
 * The single shared component that states how trustworthy a nutrition number is:
 * dot (8px) + glyph + label, mapped to the --g-color-nutrition-* token set. State
 * is conveyed by TEXT + COLOR + DOT together — never color-only (a11y / PL row).
 *
 * SAFETY CONTRACT (PL Appendix A — primary risk: implied medical certainty):
 *  - A numeric value renders ONLY when `state === 'verified'` AND `value` is given.
 *    In every other case we show the estimate / unavailable presentation instead —
 *    we NEVER invent a number and NEVER render a fake `0` for missing data.
 *  - `verified` is tappable: it opens the source-name sheet via `onSourceOpen`
 *    (and surfaces the source name when provided). `estimate` / `unavailable` are
 *    non-interactive informational badges.
 *  - Copy is hedged / plain — no medical wording (banned-words list applies in the
 *    caller's adjacent copy; this component only ships neutral labels).
 *
 * States: verified | estimate | unavailable | loading.
 *  - loading uses the shared .g-skeleton helper (inline text-sized twin, zero CLS).
 *  - On a data-layer fetch error the caller should fall back to `state="unavailable"`
 *    (fail-safe presentation) — this component renders that calmly.
 *
 * RTL-safe: dot + glyph + label order follows `dir` via flex; logical spacing only
 * (gap / paddingInline / paddingBlock). The badge never wraps away from its number.
 *
 * Motion: pressResponse (small whileTap) on the interactive verified badge only.
 * No inline transitions, no keyframes.
 *
 * Pure presentational — behavior via onSourceOpen. Provides sensible defaults so it
 * renders standalone.
 *
 * Props:
 *  - state: 'verified' | 'estimate' | 'unavailable' | 'loading' (default 'unavailable')
 *  - value: the formatted nutrition number/string (e.g. "320 kcal"). Rendered ONLY
 *      when state === 'verified'. Already-formatted by the caller's locale layer.
 *  - sourceName: human-readable source (e.g. "USDA FoodData Central") — shown as a
 *      hint and announced; tapping a verified badge opens the full source sheet.
 *  - onSourceOpen: () => void — opens the source-name sheet (verified only).
 *  - label: override the default state label (pass a localized string if needed).
 *  - ariaLabel: override the full accessible label.
 */

const STATE_CONFIG = {
  verified: {
    fg: 'var(--g-color-nutrition-verified-fg)',
    bg: 'var(--g-color-nutrition-verified-bg)',
    Icon: IconCircleCheck,
    label: 'Verified',
  },
  estimate: {
    fg: 'var(--g-color-nutrition-estimate-fg)',
    bg: 'var(--g-color-nutrition-estimate-bg)',
    Icon: IconCircleDashed,
    label: 'Estimate',
  },
  unavailable: {
    fg: 'var(--g-color-nutrition-unavailable-fg)',
    bg: 'var(--g-color-nutrition-unavailable-bg)',
    Icon: IconCircleMinus,
    label: 'Not available',
  },
};

function Dot({ color }) {
  return (
    <Box
      component="span"
      aria-hidden="true"
      style={{
        inlineSize: 8,
        blockSize: 8,
        flex: '0 0 auto',
        borderRadius: 'var(--g-radius-chip)',
        background: color,
      }}
    />
  );
}

export function NutritionBadge({
  state = 'unavailable',
  value,
  sourceName,
  onSourceOpen,
  label,
  ariaLabel,
}) {
  // ── Loading: inline text-sized skeleton twin (zero layout shift). ──
  if (state === 'loading') {
    return (
      <Box
        role="status"
        aria-busy="true"
        aria-live="polite"
        data-state="loading"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          inlineSize: 96,
          maxInlineSize: '100%',
        }}
      >
        <span className="g-sr-only">Loading nutrition source</span>
        <Box
          className="g-skeleton"
          aria-hidden="true"
          style={{
            inlineSize: '100%',
            blockSize: 'var(--g-space-5)',
            borderRadius: 'var(--g-radius-chip)',
          }}
        />
      </Box>
    );
  }

  const config = STATE_CONFIG[state] ?? STATE_CONFIG.unavailable;
  const { Icon } = config;
  const stateLabel = label ?? config.label;

  // Number renders ONLY for verified + a real value. Never invent a number/zero.
  const showNumber = state === 'verified' && value != null && value !== '';

  // Shared visual interior (dot + glyph + label + optional number).
  const interior = (
    <Box
      component="span"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--g-space-2)',
        paddingInline: 'var(--g-space-3)',
        paddingBlock: 'var(--g-space-1)',
        borderRadius: 'var(--g-radius-chip)',
        background: config.bg,
        color: config.fg,
        fontFamily: 'var(--g-font-text)',
        fontSize: 'var(--g-font-size-12)',
        fontWeight: 500,
        lineHeight: 'var(--g-leading-heading)',
        maxInlineSize: '100%',
      }}
    >
      <Dot color={config.fg} />
      <Icon
        size={14}
        stroke={1.6}
        aria-hidden="true"
        style={{ inlineSize: 14, blockSize: 14, flexShrink: 0 }}
      />
      {showNumber && (
        <Text
          component="span"
          style={{
            fontFamily: 'var(--g-font-display)',
            fontWeight: 600,
            color: 'var(--g-color-text-primary)',
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </Text>
      )}
      <Text
        component="span"
        style={{
          minInlineSize: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'start',
        }}
      >
        {stateLabel}
      </Text>
    </Box>
  );

  // ── Verified: tappable to open the source-name sheet. ──
  if (state === 'verified') {
    const computedAria =
      ariaLabel ||
      [
        showNumber ? value : null,
        stateLabel,
        sourceName ? `source ${sourceName}` : null,
      ]
        .filter(Boolean)
        .join(', ');

    return (
      <UnstyledButton
        component={motion.button}
        type="button"
        data-state="verified"
        onClick={() => onSourceOpen?.()}
        whileTap={pressResponse.whileTap}
        aria-label={computedAria}
        style={{
          // 44px hit-area; the visible badge inside stays compact.
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 44,
          minWidth: 44,
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
      >
        {interior}
      </UnstyledButton>
    );
  }

  // ── Estimate / unavailable: informational, non-interactive. ──
  return (
    <Box
      data-state={state}
      aria-label={ariaLabel || (showNumber ? `${value}, ${stateLabel}` : stateLabel)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        maxInlineSize: '100%',
      }}
    >
      {interior}
    </Box>
  );
}

export default NutritionBadge;
