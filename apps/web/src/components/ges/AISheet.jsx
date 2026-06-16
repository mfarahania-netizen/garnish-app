import { Box, Drawer, Text, UnstyledButton } from '@mantine/core';
import { IconSparkles, IconUsers, IconReplace, IconClock, IconInfoCircle, IconChevronLeft } from '@tabler/icons-react';

/**
 * AISheet — "برای من تنظیمش کن": a disclosed, hedged bottom sheet that lets the user ask the
 * assistant to tune the recipe (servings / ingredient swaps / time). It is DISCLOSED (AI glyph +
 * "AI"), HEDGED (AI can be wrong; nutrition always shows its source), and PROPOSES — it never
 * auto-applies. Any tune routes through `onAsk` to the assistant; this sprint shows no fabricated
 * answer (the real propose→«بله، اعمال کن»/«بی‌خیال» loop lands with the AI Chat screen). Mantine
 * Drawer gives focus-trap / ESC / overlay-close. Token-pure.
 */
const OPTIONS = [
  { key: 'servings', label: 'تعداد نفرات', Icon: IconUsers },
  { key: 'swap', label: 'جایگزینِ مواد', Icon: IconReplace },
  { key: 'time', label: 'زمان', Icon: IconClock },
];

export default function AISheet({ opened, onClose, recipeTitle, onAsk }) {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="bottom"
      zIndex={400}
      withCloseButton
      closeButtonProps={{ 'aria-label': 'بستن', size: 'lg' }}
      overlayProps={{ backgroundOpacity: 0.42, blur: 1 }}
      transitionProps={{ transition: 'slide-up', duration: 240 }}
      title={
        <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
          <Box aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', inlineSize: 24, blockSize: 24, borderRadius: '50%', background: 'var(--g-color-ai-glow)', color: 'var(--g-color-brand-600)', boxShadow: '0 0 0 1px var(--g-color-brand-200)' }}>
            <IconSparkles size={13} stroke={1.8} />
          </Box>
          <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--g-color-brand-700)' }}>AI</Text>
        </Box>
      }
      styles={{
        content: { height: 'auto', maxHeight: '85vh', borderStartStartRadius: 'var(--g-radius-sheet)', borderStartEndRadius: 'var(--g-radius-sheet)', background: 'var(--g-color-bg-surface)' },
        header: { background: 'var(--g-color-bg-surface)' },
        body: { paddingInline: 'var(--g-space-5)', paddingBlockEnd: 'var(--g-space-6)' },
      }}
    >
      {recipeTitle ? (
        <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', paddingInline: 'var(--g-space-3)', paddingBlock: 5, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600 }}>
          دربارهٔ: {recipeTitle}
        </Box>
      ) : null}

      <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-4)' }}>
        {OPTIONS.map(({ key, label, Icon }) => (
          <UnstyledButton
            key={key}
            type="button"
            onClick={() => onAsk?.(key)}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', minBlockSize: 52, paddingInline: 'var(--g-space-4)', borderRadius: 'var(--g-radius-input)', border: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface)' }}
          >
            <Icon size={20} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)', flexShrink: 0 }} />
            <Text component="span" style={{ flex: 1, textAlign: 'start', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600, color: 'var(--g-color-text-primary)' }}>{label}</Text>
            <IconChevronLeft size={18} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)' }} />
          </UnstyledButton>
        ))}
      </Box>

      <Box style={{ display: 'flex', gap: 'var(--g-space-2)', alignItems: 'flex-start', marginBlockStart: 'var(--g-space-4)' }}>
        <IconInfoCircle size={14} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)', flexShrink: 0, marginBlockStart: 2 }} />
        <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-muted)', margin: 0 }}>
          پاسخِ هوش مصنوعی ممکن است اشتباه کند و هر تغییری پیش از اعمال از تو می‌پرسد. اعداد ارزش غذایی همیشه با منبع نشان داده می‌شوند.
        </Text>
      </Box>
    </Drawer>
  );
}
