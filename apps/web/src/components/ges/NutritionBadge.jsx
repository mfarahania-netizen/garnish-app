import { Box } from '@mantine/core';
import { IconCircleCheck, IconInfoCircle, IconHelpCircle } from '@tabler/icons-react';

/**
 * NutritionBadge — honesty indicator for nutrition data: verified / estimate / unavailable,
 * each with its own earthy token pair. Informational (non-interactive); always paired with the
 * mandatory non-medical caption «اطلاعات عمومی، نه توصیهٔ پزشکی» by the consumer. Token-pure.
 */
const STATES = {
  verified: { label: 'تأییدشده', fg: 'var(--g-color-nutrition-verified-fg)', bg: 'var(--g-color-nutrition-verified-bg)', Icon: IconCircleCheck },
  estimate: { label: 'تخمینی', fg: 'var(--g-color-nutrition-estimate-fg)', bg: 'var(--g-color-nutrition-estimate-bg)', Icon: IconInfoCircle },
  unavailable: { label: 'در دسترس نیست', fg: 'var(--g-color-nutrition-unavailable-fg)', bg: 'var(--g-color-nutrition-unavailable-bg)', Icon: IconHelpCircle },
};

export default function NutritionBadge({ state = 'estimate' }) {
  const s = STATES[state] || STATES.estimate;
  const Icon = s.Icon;
  return (
    <Box
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--g-space-1)',
        minBlockSize: 28,
        paddingInline: 'var(--g-space-3)',
        borderRadius: 'var(--g-radius-chip)',
        background: s.bg,
        color: s.fg,
        fontFamily: 'var(--g-font-fa)',
        fontSize: 'var(--g-font-size-12)',
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={13} stroke={1.8} aria-hidden="true" />
      {s.label}
    </Box>
  );
}
