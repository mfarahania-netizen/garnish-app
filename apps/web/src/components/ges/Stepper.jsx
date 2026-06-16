import { Box, Group, Text, UnstyledButton } from '@mantine/core';
import { IconMinus, IconPlus } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { pressResponse } from '../../lib/motion';

/**
 * Stepper (GES inputs) — a numeric quantity stepper (GES "typing is a last
 * resort": steppers over keyboards for quantities — grocery / servings).
 *
 * Two 44px −/+ controls flanking a live value. Clamps to [min, max]; disables
 * the control at a bound. The value is announced via aria-live so screen-reader
 * users hear changes without focus moving.
 *
 * Pure presentational + controlled. Motion: pressResponse. RTL-safe. Token-pure.
 *
 * Props:
 *  - label: accessible group label (visually rendered when provided)
 *  - value, onChange(next): controlled numeric value
 *  - min (default 0), max (default Infinity), step (default 1)
 *  - unit: optional unit suffix shown next to the value (e.g. "g", "cups")
 *  - disabled
 */
export function Stepper({
  label,
  value = 0,
  onChange,
  min = 0,
  max = Infinity,
  step = 1,
  unit,
  disabled = false,
}) {
  const clamp = (n) => Math.max(min, Math.min(max, n));
  const dec = () => !disabled && onChange?.(clamp(value - step));
  const inc = () => !disabled && onChange?.(clamp(value + step));
  const atMin = value <= min;
  const atMax = value >= max;

  const ctrlStyle = (off) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
    borderRadius: 'var(--g-radius-input)',
    background: 'var(--g-color-bg-surface)',
    border: '1px solid var(--g-color-border-strong)',
    color: off ? 'var(--g-color-text-muted)' : 'var(--g-color-text-primary)',
    cursor: off || disabled ? 'not-allowed' : 'pointer',
    opacity: off || disabled ? 0.5 : 1,
    flexShrink: 0,
  });

  return (
    <Group
      role="group"
      aria-label={label || 'Quantity'}
      wrap="nowrap"
      align="center"
      style={{ gap: 'var(--g-space-2)' }}
    >
      {label && (
        <Text
          style={{
            fontFamily: 'var(--g-font-text)',
            fontSize: 'var(--g-font-size-14)',
            fontWeight: 500,
            color: 'var(--g-color-text-secondary)',
            textAlign: 'start',
            marginInlineEnd: 'var(--g-space-1)',
          }}
        >
          {label}
        </Text>
      )}
      <UnstyledButton
        component={motion.button}
        type="button"
        onClick={dec}
        whileTap={pressResponse.whileTap}
        disabled={disabled || atMin}
        aria-label="Decrease"
        style={ctrlStyle(atMin)}
      >
        <IconMinus size={18} stroke={1.8} aria-hidden="true" />
      </UnstyledButton>

      <Box
        aria-live="polite"
        style={{
          minInlineSize: 48,
          textAlign: 'center',
          fontFamily: 'var(--g-font-display)',
          fontSize: 'var(--g-font-size-16)',
          fontWeight: 700,
          color: 'var(--g-color-text-primary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}{unit ? ` ${unit}` : ''}
      </Box>

      <UnstyledButton
        component={motion.button}
        type="button"
        onClick={inc}
        whileTap={pressResponse.whileTap}
        disabled={disabled || atMax}
        aria-label="Increase"
        style={ctrlStyle(atMax)}
      >
        <IconPlus size={18} stroke={1.8} aria-hidden="true" />
      </UnstyledButton>
    </Group>
  );
}

export default Stepper;
