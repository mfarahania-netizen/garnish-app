import { Box } from '@mantine/core';

/**
 * StatusBadge — a small pill: dot + label.
 *
 * tone: success | warning | danger | info | neutral — mapped to --g-color-state-*.
 * The state is conveyed by BOTH text (label) and a colored dot — never color-only.
 *
 * Props:
 *   tone     — semantic tone (default 'neutral')
 *   children — the label text (required for non-color signalling)
 *
 * Pure presentational; no business logic.
 */

const TONE_STYLES = {
  success: {
    fg: 'var(--g-color-state-success-fg)',
    bg: 'var(--g-color-state-success-bg)',
  },
  warning: {
    fg: 'var(--g-color-state-warning-fg)',
    bg: 'var(--g-color-state-warning-bg)',
  },
  danger: {
    fg: 'var(--g-color-state-danger-fg)',
    bg: 'var(--g-color-state-danger-bg)',
  },
  info: {
    fg: 'var(--g-color-state-info-fg)',
    bg: 'var(--g-color-state-info-bg)',
  },
  neutral: {
    fg: 'var(--g-color-text-secondary)',
    bg: 'var(--g-color-bg-canvas)',
  },
};

export function StatusBadge({ tone = 'neutral', children, ...rest }) {
  const toneStyle = TONE_STYLES[tone] ?? TONE_STYLES.neutral;

  return (
    <Box
      component="span"
      data-tone={tone}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--g-space-2)',
        paddingInline: 'var(--g-space-3)',
        paddingBlock: 'var(--g-space-1)',
        borderRadius: 'var(--g-radius-chip)',
        background: toneStyle.bg,
        color: toneStyle.fg,
        fontFamily: 'var(--g-font-text)',
        fontSize: 'var(--g-font-size-12)',
        fontWeight: 500,
        lineHeight: 'var(--g-leading-heading)',
        border: '1px solid var(--g-color-border-subtle)',
        maxInlineSize: '100%',
      }}
      {...rest}
    >
      <Box
        component="span"
        aria-hidden="true"
        style={{
          inlineSize: 8,
          blockSize: 8,
          flex: '0 0 auto',
          borderRadius: 'var(--g-radius-chip)',
          background: toneStyle.fg,
        }}
      />
      <Box
        component="span"
        style={{
          minInlineSize: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export default StatusBadge;
