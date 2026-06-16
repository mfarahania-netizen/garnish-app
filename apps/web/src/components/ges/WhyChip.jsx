import { Box, Popover, Text, UnstyledButton } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

/**
 * WhyChip — the signature "چرا این؟" explainability moment. A small saffron-leaning pill
 * that reveals the REAL reasons a recipe was suggested (localized from matchedSignals — never
 * raw tokens, never the English explanation). If no concrete reasons are available it shows a
 * calm, disclosed generic line. Hedged: a suggestion, not a certainty.
 */
export default function WhyChip({ reasons = [], label = 'چرا این؟' }) {
  const hasReasons = Array.isArray(reasons) && reasons.length > 0;

  return (
    <Popover width={248} position="top-end" withArrow shadow="md" radius={14} trapFocus>
      <Popover.Target>
        <UnstyledButton
          type="button"
          aria-label={label}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--g-space-1)',
            minBlockSize: 32,
            paddingInline: 'var(--g-space-3)',
            borderRadius: 'var(--g-radius-chip)',
            background: 'var(--g-color-brand-50)',
            color: 'var(--g-color-brand-700)',
            fontFamily: 'var(--g-font-fa)',
            fontSize: 'var(--g-font-size-12)',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          <IconInfoCircle size={14} stroke={1.8} aria-hidden="true" />
          {label}
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown
        style={{
          background: 'var(--g-color-ai-surface)',
          border: 'var(--g-border-ai)',
          boxShadow: 'var(--g-shadow-2)',
        }}
      >
        <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700, color: 'var(--g-color-brand-700)', margin: 0 }}>
          چرا این پیشنهاد؟
        </Text>
        {hasReasons ? (
          <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-1)', marginBlockStart: 'var(--g-space-2)' }}>
            {reasons.map((r) => (
              <Box
                key={r}
                style={{
                  paddingInline: 'var(--g-space-2)',
                  paddingBlock: 2,
                  borderRadius: 'var(--g-radius-chip)',
                  background: 'var(--g-color-brand-50)',
                  color: 'var(--g-color-brand-700)',
                  fontFamily: 'var(--g-font-fa)',
                  fontSize: 'var(--g-font-size-12)',
                  fontWeight: 600,
                }}
              >
                {r}
              </Box>
            ))}
          </Box>
        ) : (
          <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-secondary)', margin: 'var(--g-space-2) 0 0', lineHeight: 'var(--g-leading-body)' }}>
            بر اساس انتخاب‌های اخیر تو انتخاب شده — یک پیشنهاد است، نه نسخهٔ قطعی.
          </Text>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}
