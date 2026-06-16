import { useId } from 'react';
import { Box, Stack, Text } from '@mantine/core';
import { IconSearch, IconAlertCircle } from '@tabler/icons-react';

/**
 * TextField (GES inputs) — a text / search input with RTL-correct caret + flow,
 * a visible label, and a designed error state. Focus ring comes from base.css
 * (:focus-visible) — never removed.
 *
 * type 'search' renders a leading search glyph (logical inline-start). The caret
 * and text follow `dir` automatically (textAlign:start). 44px min target.
 *
 * Pure presentational + controlled. Behavior via onChange. Token-pure.
 *
 * Props:
 *  - label: visible field label (also used for aria when no ariaLabel)
 *  - value / onChange(value): controlled value
 *  - type: 'text' | 'search' (default 'text')
 *  - placeholder, name, required, disabled
 *  - error: string — when set, renders the error border + helper text (assertive)
 *  - leftIcon: override leading glyph
 *  - ariaLabel: override accessible name (useful for label-less search bars)
 */
export function TextField({
  label,
  value = '',
  onChange,
  type = 'text',
  placeholder,
  name,
  required = false,
  disabled = false,
  error,
  leftIcon,
  ariaLabel,
}) {
  const id = useId();
  const errId = `${id}-err`;
  const hasError = Boolean(error);
  const icon = leftIcon ?? (type === 'search' ? <IconSearch size={18} stroke={1.6} aria-hidden="true" /> : null);

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
      <Box
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--g-space-2)',
          minBlockSize: 44,
          paddingInline: 'var(--g-space-3)',
          borderRadius: 'var(--g-radius-input)',
          background: disabled ? 'var(--g-color-bg-canvas)' : 'var(--g-color-bg-surface)',
          border: `1px solid ${hasError ? 'var(--g-color-state-danger-fg)' : 'var(--g-color-border-strong)'}`,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {icon && (
          <Box component="span" aria-hidden="true" style={{ display: 'inline-flex', color: 'var(--g-color-text-muted)', flexShrink: 0 }}>
            {icon}
          </Box>
        )}
        <Box
          component="input"
          id={id}
          name={name}
          type={type === 'search' ? 'search' : 'text'}
          value={value}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={ariaLabel || (label ? undefined : placeholder)}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errId : undefined}
          onChange={(e) => onChange?.(e.currentTarget.value)}
          style={{
            flex: 1,
            minInlineSize: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'var(--g-color-text-primary)',
            fontFamily: 'var(--g-font-text)',
            fontSize: 'var(--g-font-size-16)',
            lineHeight: 'var(--g-leading-body)',
            textAlign: 'start',
            paddingBlock: 'var(--g-space-2)',
          }}
        />
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

export default TextField;
