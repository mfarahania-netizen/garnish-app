import { Box, Text, UnstyledButton } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { pressResponse } from '../../lib/motion';

/**
 * AllergenMark (PL row 11) — flag a declared allergen on a matching ingredient row.
 *
 * A subtle pill (icon + allergen name) on the --g-color-allergen-bg surface. The
 * tone is INFORMATIVE, not alarming (PL "Do: informative tone" / "Don't: fear
 * styling, medical wording"): it uses the calm allergen background tint with the
 * danger foreground for the icon + label, never a loud full danger fill, and never
 * medical copy. The caller derives the match from the user profile via ingredientId;
 * tapping opens the profile allergy sheet via `onOpen`.
 *
 * Not color-only (a11y / PL row): the allergen is named in text AND carries an icon,
 * and the control's aria-label announces it within the ingredient-row label. The
 * mark renders inline next to the ingredient name and never wraps away from it.
 *
 * States: present (rendered) | absent (caller renders nothing) | loading.
 *  - This component covers `present` (default) and `loading`. `absent` is the
 *    caller's responsibility — when there is no profile match, render nothing.
 *
 * RTL-safe: icon + name order follows `dir` via flex; logical spacing only
 * (gap / paddingInline / paddingBlock). Motion: pressResponse whileTap only when
 * interactive. No inline transitions, no keyframes.
 *
 * Pure presentational — behavior via onOpen. Sensible defaults so it renders
 * standalone.
 *
 * Props:
 *  - allergen: the declared allergen name (e.g. "Peanuts" / "بادام‌زمینی"). Required
 *      for the non-color-only signal; falls back to a neutral label if omitted.
 *  - onOpen: () => void — opens the profile allergy sheet for this allergen. When
 *      omitted the mark renders as a static informational pill (still announced).
 *  - state: 'present' | 'loading' (default 'present').
 *  - ariaLabel: override the full accessible label.
 */
export function AllergenMark({
  allergen,
  onOpen,
  state = 'present',
  ariaLabel,
}) {
  // ── Loading: inline pill-sized skeleton twin (zero layout shift). ──
  if (state === 'loading') {
    return (
      <Box
        role="status"
        aria-busy="true"
        aria-live="polite"
        data-state="loading"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          inlineSize: 80,
          maxInlineSize: '100%',
        }}
      >
        <span className="g-sr-only">Loading allergen information</span>
        <Box
          className="g-skeleton"
          aria-hidden="true"
          style={{
            inlineSize: '100%',
            blockSize: 'var(--g-space-5)',
            borderRadius: 'var(--g-radius-chip)',
          }}
        />
      </Box>
    );
  }

  const name = allergen || 'Allergen';
  const computedAria = ariaLabel || `Contains ${name}`;

  // Shared visual interior (icon + allergen name) on the calm allergen tint.
  const interior = (
    <Box
      component="span"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--g-space-2)',
        paddingInline: 'var(--g-space-3)',
        paddingBlock: 'var(--g-space-1)',
        borderRadius: 'var(--g-radius-chip)',
        background: 'var(--g-color-allergen-bg)',
        color: 'var(--g-color-allergen-fg)',
        fontFamily: 'var(--g-font-text)',
        fontSize: 'var(--g-font-size-12)',
        fontWeight: 500,
        lineHeight: 'var(--g-leading-heading)',
        maxInlineSize: '100%',
      }}
    >
      <IconAlertTriangle
        size={14}
        stroke={1.6}
        aria-hidden="true"
        style={{ inlineSize: 14, blockSize: 14, flexShrink: 0 }}
      />
      <Text
        component="span"
        style={{
          minInlineSize: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'start',
        }}
      >
        {name}
      </Text>
    </Box>
  );

  // ── Interactive: opens the profile allergy sheet. ──
  if (onOpen) {
    return (
      <UnstyledButton
        component={motion.button}
        type="button"
        data-state="present"
        onClick={() => onOpen()}
        whileTap={pressResponse.whileTap}
        aria-label={computedAria}
        style={{
          // 44px hit-area; the visible pill inside stays compact.
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 44,
          minWidth: 44,
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
      >
        {interior}
      </UnstyledButton>
    );
  }

  // ── Static informational pill (still announced for SR users). ──
  return (
    <Box
      data-state="present"
      role="note"
      aria-label={computedAria}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        maxInlineSize: '100%',
      }}
    >
      {interior}
    </Box>
  );
}

export default AllergenMark;
