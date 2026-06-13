/* ============================================================
   GARNISH MOTION — GES v1
   DRAFT — for later implementation by coding assistant after approval
   STATUS: DRAFT_PENDING_UX_APPROVAL (all values are proposals until Designer sign-off)
   The ONLY motion source (Guide rule #2). Three intents:
   Settle (arrive) · Respond (react) · Celebrate (earned, ≤1/session).
   Framer-motion-shaped variants; adapt at boundary if library differs.
   No flashy/casino effects. Legacy bounce easing: superseded — do not port.
   ============================================================ */

export const duration = { fast: 0.12, base: 0.24, slow: 0.36, celebrate: 0.6 };

export const ease = {
  standard: [0.2, 0.8, 0.2, 1],
  enter:    [0.16, 1, 0.3, 1],
  exit:     [0.4, 0, 1, 1],
};

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/* ── Settle ── */
export const gentleFade = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: duration.base, ease: ease.enter } },
  exit:    { opacity: 0, transition: { duration: duration.fast, ease: ease.exit } },
};

export const riseIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.enter } },
  exit:    { opacity: 0, y: -8, transition: { duration: duration.fast, ease: ease.exit } },
};

export const sheetEnter = {
  initial: { y: '100%' },
  animate: { y: 0, transition: { duration: duration.slow, ease: ease.enter } },
  exit:    { y: '100%', transition: { duration: duration.base, ease: ease.exit } },
};

/* List/card arrival with capped stagger (≤6 items, 55ms) */
export const cardShift = {
  container: { animate: { transition: { staggerChildren: 0.055, delayChildren: 0.05 } } },
  item: riseIn,
};

/* ── Respond ── */
export const pressResponse = { whileTap: { scale: 0.97, transition: { duration: duration.fast } } };

/* AI Whisper presence: one soft halo pulse on mount — never looping */
export const whisperPulse = {
  initial: { opacity: 0, boxShadow: '0 0 0 0 var(--g-color-ai-glow)' },
  animate: {
    opacity: 1,
    boxShadow: ['0 0 0 0 var(--g-color-ai-glow)', '0 0 0 8px var(--g-color-ai-glow-transparent)'],
    transition: { duration: duration.slow, ease: ease.enter },
  },
};

/* ── Celebrate ── (cook_complete / level-up / milestone only; gate ≤1/session in caller) */
export const successCelebrate = {
  initial: { scale: 0.9, opacity: 0 },
  animate: { scale: [0.9, 1.04, 1], opacity: 1,
    transition: { duration: duration.celebrate, ease: ease.standard } },
};

/* ── Reduced motion ── */
export const reducedMotionFallback = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.12 } },
  exit:    { opacity: 0, transition: { duration: 0.08 } },
};

/* Helper: pick variant respecting the OS setting */
export const withReducedMotion = (variant) =>
  prefersReducedMotion() ? reducedMotionFallback : variant;

export default {
  duration, ease, gentleFade, riseIn, sheetEnter, cardShift,
  pressResponse, whisperPulse, successCelebrate, reducedMotionFallback, withReducedMotion,
};
