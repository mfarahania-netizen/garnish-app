// GARNISH-DASHBOARD-L4-17 — GES-tokenized admin theme helpers.
// Single source for chart/UI colors: the GES palette (saffron brand + warm neutral + state) from
// styles/tokens.css. No random hex anywhere in the admin dashboard — series come from GES_SERIES.

// Brand + state hexes mirror tokens.css (--g-color-brand-600 saffron etc.). Used where recharts needs a
// concrete color string; everything else uses the CSS var tokens directly (var(--g-color-*)).
export const GES = {
  saffron: '#EA6C0A',      // brand-600 (primary)
  saffron500: '#F97316',   // brand-500
  saffron400: '#FB923C',   // brand-400
  saffron700: '#C2570A',   // brand-700
  success: '#2E7D4F',
  warning: '#C9821B',
  danger: '#B43C2E',       // destructive only
  info: '#4A443D',
  neutral: '#8A817A',
  verified: '#3F7A4E',
};

// Calm, warm chart series palette anchored on saffron (no rainbow, no non-brand hex).
export const GES_SERIES = [
  GES.saffron, GES.success, GES.warning, GES.info, GES.saffron500, GES.verified, GES.neutral, GES.saffron700,
];

// Token-driven role colors (resolve at render via CSS vars — respects light/dark + RTL automatically).
export const T = {
  textPrimary: 'var(--g-color-text-primary)',
  textSecondary: 'var(--g-color-text-secondary)',
  textMuted: 'var(--g-color-text-muted)',
  surface: 'var(--g-color-bg-surface)',
  canvas: 'var(--g-color-bg-canvas)',
  borderSubtle: 'var(--g-color-border-subtle)',
  borderStrong: 'var(--g-color-border-strong)',
  brand: 'var(--g-color-brand-600)',
};

/** GES card surface — calm depth (shadow-2), tokenized, RTL-neutral. */
export function gesPanel() {
  return {
    background: T.surface,
    borderRadius: 'var(--g-radius-card)',
    padding: 'var(--g-space-6)',
    border: `1px solid ${T.borderSubtle}`,
    boxShadow: 'var(--g-shadow-2)',
  };
}

/** Recharts axis tick style (muted, tokenized). */
export const axisTick = { fontSize: 12, fill: GES.neutral };
export const gridStroke = '#EDE7DF'; // --g-color-border-subtle
export const tooltipStyle = {
  background: '#FFFFFF',
  border: `1px solid ${'#EDE7DF'}`,
  borderRadius: 12,
  fontSize: 13,
  fontFamily: 'var(--g-font-fa)',
};
