import { Box, Text, UnstyledButton } from '@mantine/core';
import { IconCloudOff, IconShieldCheck, IconRefresh } from '@tabler/icons-react';

/**
 * ErrorState — kind, safe, blame-free, with exactly one retry. Uses a calm INFO medallion
 * (not an alarming danger fill), reassures what is still safe, and offers a single retry.
 * Token-pure.
 */
export default function ErrorState({
  title = 'نتونستیم پیشنهادِ امشب رو بیاریم',
  body = 'یک اتصال کوتاه قطع شد. چیزی از دست نرفته.',
  reassurance = 'لیست خریدت آفلاین ذخیره است',
  retryLabel = 'تلاش دوباره',
  onRetry,
}) {
  return (
    <Box
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        paddingInline: 'var(--g-space-4)',
        paddingBlock: 'var(--g-space-8)',
      }}
    >
      <Box
        aria-hidden="true"
        style={{
          display: 'grid',
          placeItems: 'center',
          inlineSize: 60,
          blockSize: 60,
          borderRadius: '50%',
          background: 'var(--g-color-state-info-bg)',
          color: 'var(--g-color-text-secondary)',
          marginBlockEnd: 'var(--g-space-4)',
        }}
      >
        <IconCloudOff size={28} stroke={1.6} />
      </Box>

      <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, lineHeight: 'var(--g-leading-heading)', color: 'var(--g-color-text-primary)', textWrap: 'balance', margin: 0 }}>
        {title}
      </Text>

      <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)', maxInlineSize: '34ch', margin: 'var(--g-space-2) 0 0' }}>
        {body}
      </Text>

      {reassurance ? (
        <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', marginBlockStart: 'var(--g-space-3)', color: 'var(--g-color-state-success-fg)' }}>
          <IconShieldCheck size={15} stroke={1.8} aria-hidden="true" />
          <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 500 }}>
            {reassurance}
          </Text>
        </Box>
      ) : null}

      <UnstyledButton
        type="button"
        onClick={onRetry}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--g-space-1)',
          minBlockSize: 44,
          paddingInline: 'var(--g-space-5)',
          marginBlockStart: 'var(--g-space-5)',
          borderRadius: 'var(--g-radius-input)',
          background: 'var(--g-color-brand-600)',
          color: 'var(--g-color-text-inverse)',
          fontFamily: 'var(--g-font-fa)',
          fontSize: 'var(--g-font-size-14)',
          fontWeight: 700,
        }}
      >
        <IconRefresh size={16} stroke={1.8} aria-hidden="true" />
        {retryLabel}
      </UnstyledButton>
    </Box>
  );
}
