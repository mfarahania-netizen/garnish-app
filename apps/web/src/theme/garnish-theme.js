/* ============================================================
   GARNISH THEME — GES v1
   DRAFT — for later implementation by coding assistant after approval
   STATUS: DRAFT_PENDING_UX_APPROVAL (all values are proposals until Designer sign-off)
   Repo evidence: the web app uses Mantine with the theme currently
   defined inline in App.jsx (inspected). This file extracts that into
   a single theme object bound to the CSS variables in tokens.css.
   Adapter note: if the provider differs at implementation time, keep
   the exported shape and re-map at the provider boundary — components
   must keep consuming tokens, never library palette literals.

   Library Adapter Exception:
   Mantine requires a static 10-step color array for internal theme registration.
   This file may mirror the exact token ramp from tokens.css only.
   No component may import these literal values.
   Any change must be made first in tokens.css and then mirrored here in the same PR.
   Hex lint must ignore only this one adapter block.

   Theme Adapter Non-Color Exception (breakpoints only):
   The theme adapter may mirror breakpoint token values as static strings
   because the UI library composes JS media queries from them at
   registration time. Components must not import these literals. Any change
   must be made first in tokens.css and mirrored here in the same PR.
   Radius values are NOT excepted — they bind to CSS variables below.
   ============================================================ */

const v = (name) => `var(${name})`;

export const breakpoints = { sm: '480px', md: '768px', lg: '1024px', xl: '1280px' };

export const radius = {
  input: v('--g-radius-input'),
  card: v('--g-radius-card'),
  sheet: v('--g-radius-sheet'),
  chip: v('--g-radius-chip'),
};

export const elevation = {
  1: v('--g-shadow-1'),
  2: v('--g-shadow-2'),
  3: v('--g-shadow-3'), // max — Calm depth
};

export const semantic = {
  success: { fg: v('--g-color-state-success-fg'), bg: v('--g-color-state-success-bg') },
  warning: { fg: v('--g-color-state-warning-fg'), bg: v('--g-color-state-warning-bg') },
  danger:  { fg: v('--g-color-state-danger-fg'),  bg: v('--g-color-state-danger-bg') }, // destructive only
  info:    { fg: v('--g-color-state-info-fg'),    bg: v('--g-color-state-info-bg') },
  ai:      { surface: v('--g-color-ai-surface'), glow: v('--g-color-ai-glow') },
  nutrition: {
    verified:    { fg: v('--g-color-nutrition-verified-fg'),    bg: v('--g-color-nutrition-verified-bg') },
    estimate:    { fg: v('--g-color-nutrition-estimate-fg'),    bg: v('--g-color-nutrition-estimate-bg') },
    unavailable: { fg: v('--g-color-nutrition-unavailable-fg'), bg: v('--g-color-nutrition-unavailable-bg') },
  },
};

/* Mantine-shaped theme (current library per repo evidence) */
export const garnishTheme = {
  fontFamily: v('--g-font-text'),
  headings: { fontFamily: v('--g-font-display'), lineHeight: 1.25 },
  defaultRadius: 'md',
  radius: { sm: v('--g-radius-input'), md: v('--g-radius-card'), lg: v('--g-radius-sheet'), xl: v('--g-radius-chip') }, // Option A: token-bound
  primaryColor: 'saffron',
  colors: {
    /* LIBRARY ADAPTER EXCEPTION BLOCK (see header) — hex-lint: ignore-block.
       Mirrors tokens.css brand ramp exactly; edit tokens.css first, mirror here same PR. */
    saffron: ['#FFF7ED','#FFEDD5','#FED7AA','#FDBA74','#FB923C','#F97316','#EA6C0A','#C2570A','#9A3C06','#7C2D12'],
  },
  breakpoints,
  other: { elevation, semantic, zIndex: {
    base: 0, sticky: 100, shelf: 200, sheet: 300, overlay: 400, toast: 500,
  }},
  components: {
    Button:   { defaultProps: { radius: 'md' }, styles: { root: { minHeight: 44 } } },
    Paper:    { defaultProps: { radius: 'md', shadow: 'sm' } },
    Modal:    { defaultProps: { radius: 'lg' } }, // sheets preferred over centered modals (GES §6)
    TextInput:{ defaultProps: { radius: 'sm' }, styles: { input: { minHeight: 44 } } },
  },
};

export default garnishTheme;
