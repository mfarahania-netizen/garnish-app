import { useId } from 'react';
import { Box, Stack, Text } from '@mantine/core';
import { IconChevronDown, IconAlertCircle } from '@tabler/icons-react';

/**
 * SelectField (GES inputs) — a labelled native <select> with token chrome, a
 * designed error state, and RTL-correct flow. Uses the native control for
 * reliable keyboard + platform a11y; the chevron is decorative.
 *
 * Pure presentational + controlled. Token-pure. 44px min target.
 *
 * Props:
 *  - label, value, onChange(value), name, required, disabled
 *  - options: [{ value, label }]
 *  - placeholder: optional disabled first option
 *  - error: string — error border + helper text
 *  - ariaLabel: override accessible name
 */
export function SelectField({
  label,
  value = '',
  onChange,
  options = [],
  placeholder,
  name,
  required = false,
  disabled = false,
  error,
  ariaLabel,
}) {
  const id = useId();
  const errId = `${id}-err`;
  const hasError = Boolean(error);

  return (
    <Stack style={{ gap: 'var(--g-space-1)', inlineSize: '100%' }}>
      {label && (
        <Text
          component="label"
          htmlFor={id}
          style={{
            fontFamily: 'var(--g-font-text)',
            fontSize: 'var(--g-font-size-14)',
            fontWeight: 500,
            color: 'var(--g-color-text-secondary)',
            textAlign: 'start',
          }}
        >
          {label}
          {required && <span aria-hidden="true" style={{ color: 'var(--g-color-state-danger-fg)' }}> *</span>}
        </Text>
      )}
      <Box style={{ position: 'relative', inlineSize: '100%' }}>
        <Box
          component="select"
          id={id}
          name={name}
          value={value}
          required={required}
          disabled={disabled}
          aria-label={ariaLabel || (label ? undefined : placeholder)}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errId : undefined}
          onChange={(e) => onChange?.(e.currentTarget.value)}
          style={{
            inlineSize: '100%',
            minBlockSize: 44,
            paddingInlineStart: 'var(--g-space-3)',
            paddingInlineEnd: 'var(--g-space-8)',
            borderRadius: 'var(--g-radius-input)',
            background: disabled ? 'var(--g-color-bg-canvas)' : 'var(--g-color-bg-surface)',
            border: `1px solid ${hasError ? 'var(--g-color-state-danger-fg)' : 'var(--g-color-border-strong)'}`,
            color: 'var(--g-color-text-primary)',
            fontFamily: 'var(--g-font-text)',
            fontSize: 'var(--g-font-size-16)',
            textAlign: 'start',
            appearance: 'none',
            WebkitAppearance: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
          }}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Box>
        <Box
          aria-hidden="true"
          style={{
            position: 'absolute',
            insetInlineEnd: 'var(--g-space-3)',
            insetBlockStart: '50%',
            transform: 'translateY(-50%)',
            display: 'inline-flex',
            color: 'var(--g-color-text-muted)',
            pointerEvents: 'none',
          }}
        >
          <IconChevronDown size={18} stroke={1.6} />
        </Box>
      </Box>
      {hasError && (
        <Text
          id={errId}
          role="alert"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--g-space-1)',
            fontFamily: 'var(--g-font-text)',
            fontSize: 'var(--g-font-size-12)',
            color: 'var(--g-color-state-danger-fg)',
            textAlign: 'start',
          }}
        >
          <IconAlertCircle size={14} stroke={1.6} aria-hidden="true" />
          {error}
        </Text>
      )}
    </Stack>
  );
}

export default SelectField;
