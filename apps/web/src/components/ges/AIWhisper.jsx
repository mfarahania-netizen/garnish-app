import { Box, Text, UnstyledButton } from '@mantine/core';
import { IconSparkles } from '@tabler/icons-react';
import { motion } from 'framer-motion';

/**
 * AIWhisper — one disclosed, hedged, dismissible AI suggestion on a saffron-glow surface.
 *
 * Always labelled "AI" with the sparkles glyph (never fake-certain). Carries one warm line
 * + a real reason sub-line, an accept action (saffron) and a quiet dismiss. The reason is
 * real, never decorative. Enters with a settle motion (opacity+rise; rise is dropped under
 * reduced motion via the page's MotionConfig). Token-pure.
 */
export default function AIWhisper({ text, sub, acceptLabel = 'ببین', dismissLabel = 'نه الان', onAccept, onDismiss }) {
  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
      style={{
        background: 'var(--g-color-ai-surface)',
        border: 'var(--g-border-ai)',
        borderRadius: 'var(--g-radius-card)',
        padding: 'var(--g-space-4)',
      }}
    >
      <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
        <Box
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            inlineSize: 22,
            blockSize: 22,
            borderRadius: '50%',
            background: 'var(--g-color-ai-glow)',
            color: 'var(--g-color-brand-600)',
            boxShadow: '0 0 0 1px var(--g-color-brand-200)',
          }}
        >
          <IconSparkles size={12} stroke={1.8} />
        </Box>
        <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--g-color-brand-700)' }}>
          AI
        </Text>
      </Box>

      <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600, lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-primary)', margin: 'var(--g-space-2) 0 0' }}>
        {text}
      </Text>

      {sub ? (
        <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-secondary)', margin: 'var(--g-space-1) 0 0', lineHeight: 'var(--g-leading-body)' }}>
          {sub}
        </Text>
      ) : null}

      <Box style={{ display: 'flex', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-3)' }}>
        <UnstyledButton
          type="button"
          onClick={onAccept}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--g-space-1)',
            minBlockSize: 44,
            paddingInline: 'var(--g-space-4)',
            borderRadius: 'var(--g-radius-input)',
            background: 'var(--g-color-brand-600)',
            color: 'var(--g-color-text-inverse)',
            fontFamily: 'var(--g-font-fa)',
            fontSize: 'var(--g-font-size-14)',
            fontWeight: 600,
          }}
        >
          {acceptLabel}
        </UnstyledButton>
        <UnstyledButton
          type="button"
          onClick={onDismiss}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--g-space-1)',
            minBlockSize: 44,
            paddingInline: 'var(--g-space-3)',
            borderRadius: 'var(--g-radius-input)',
            background: 'transparent',
            color: 'var(--g-color-text-secondary)',
            fontFamily: 'var(--g-font-fa)',
            fontSize: 'var(--g-font-size-14)',
            fontWeight: 600,
          }}
        >
          {dismissLabel}
        </UnstyledButton>
      </Box>
    </Box>
  );
}
