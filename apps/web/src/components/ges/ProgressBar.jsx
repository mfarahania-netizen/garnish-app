import { Box, Group, Text } from '@mantine/core';

/**
 * ProgressBar — a calm determinate progress indicator (e.g. profile completeness,
 * a multi-step task). Static fill (no looping/indeterminate spectacle); honest —
 * shows the real fraction, never a fake-progress percentage.
 *
 * NOTE on onboarding: the Food DNA flow must NOT use a "% anxiety bar" (GES).
 * Use the step-dots in CookStep / FoodDnaStepCard there. This bar is for genuine
 * determinate progress where a fraction is meaningful and calming.
 *
 * A11y: role="progressbar" with aria-valuenow/min/max; optional visible label +
 * value text (never color-only). Token-pure. RTL-safe (logical fill direction).
 *
 * Props:
 *  - value: current progress (0–100; clamped)
 *  - label: optional visible label
 *  - showValue: show the "NN%" text (default true when label is set)
 *  - tone: 'brand' | 'success' (default 'brand')
 */
export function ProgressBar({ value = 0, label, showValue, tone = 'brand' }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const fill = tone === 'success' ? 'var(--g-color-state-success-fg)' : 'var(--g-color-food-saffron)';
  const withValue = showValue ?? Boolean(label);

  return (
    <Box style={{ inlineSize: '100%' }}>
      {(label || withValue) && (
        <Group justify="space-between" align="center" style={{ marginBlockEnd: 'var(--g-space-1)' }}>
          {label && (
            <Text style={{ fontFamily: 'var(--g-font-text)', fontSize: 'var(--g-font-size-12)', fontWeight: 500, color: 'var(--g-color-text-secondary)', textAlign: 'start' }}>
              {label}
            </Text>
          )}
          {withValue && (
            <Text style={{ fontFamily: 'var(--g-font-display)', fontSize: 'var(--g-font-size-12)', fontWeight: 700, color: 'var(--g-color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
              {pct}%
            </Text>
          )}
        </Group>
      )}
      <Box
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Progress'}
        style={{
          inlineSize: '100%',
          blockSize: 8,
          borderRadius: 'var(--g-radius-chip)',
          background: 'var(--g-color-border-subtle)',
          overflow: 'hidden',
        }}
      >
        <Box style={{ inlineSize: `${pct}%`, blockSize: '100%', background: fill, borderRadius: 'var(--g-radius-chip)' }} />
      </Box>
    </Box>
  );
}

export default ProgressBar;
