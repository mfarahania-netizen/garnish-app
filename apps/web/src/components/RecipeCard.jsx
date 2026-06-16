import { Box, Text, Group } from '@mantine/core';
import {
  IconChefHat, IconCake, IconGlassFull, IconSoup, IconSalad,
  IconClock, IconBolt, IconHeart,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { pressResponse, withReducedMotion } from '../lib/motion';
import { useAnalytics } from '../hooks/useAnalytics';

/**
 * RecipeCard (PL row 15) — the recipe unit used across rails/grids/sliders.
 *
 * GES-reconciled (DS-ALIGN-L4-20): token-pure (no hardcoded hex / gradients /
 * glass), RTL-correct (logical properties only; no physical left/right/ltr),
 * motion via the sanctioned pressResponse preset (no ad-hoc whileHover), 4:3
 * media with the photo scrim token, a branded placeholder when there is no
 * photo (never another dish's image), a 2-line title clamp, and at most three
 * meta chips. The whole card is a single real button (keyboard + focus ring
 * from base.css), aria-labelled by the dish name.
 *
 * Public API is preserved for page-level callers (S21 page alignment depends on
 * it): props `{ recipe, onClick }`; default behavior navigates to the detail
 * route and emits the existing `recipe_view` analytics event.
 */

// Type → calm glyph (informational only; color comes from tokens, never per-type hex).
const TYPE_ICON = {
  main: IconChefHat,
  appetizer: IconSalad,
  dessert: IconCake,
  drink: IconGlassFull,
  bread: IconSoup,
  sauce: IconSoup,
};

// Difficulty → semantic state tone (token-mapped, never raw color).
const DIFFICULTY_TONE = {
  آسان: { fg: 'var(--g-color-state-success-fg)', bg: 'var(--g-color-state-success-bg)' },
  متوسط: { fg: 'var(--g-color-state-warning-fg)', bg: 'var(--g-color-state-warning-bg)' },
};
const difficultyToneFor = (d) =>
  DIFFICULTY_TONE[d] || { fg: 'var(--g-color-state-danger-fg)', bg: 'var(--g-color-state-danger-bg)' };

function MetaChip({ icon, children }) {
  return (
    <Box
      component="span"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--g-space-1)',
        paddingInline: 'var(--g-space-2)',
        paddingBlock: '2px',
        borderRadius: 'var(--g-radius-chip)',
        background: 'var(--g-color-bg-canvas)',
        border: '1px solid var(--g-color-border-subtle)',
        color: 'var(--g-color-text-secondary)',
        fontFamily: 'var(--g-font-text)',
        fontSize: 'var(--g-font-size-12)',
        fontWeight: 500,
        lineHeight: 'var(--g-leading-heading)',
        maxInlineSize: '100%',
      }}
    >
      {icon}
      <Box
        component="span"
        style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {children}
      </Box>
    </Box>
  );
}

// Small overlaid flag pill on the media (quick / healthy). Tokenized, not color-only.
function FlagPill({ icon, label }) {
  return (
    <Box
      component="span"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
        paddingInline: 'var(--g-space-2)',
        paddingBlock: '2px',
        borderRadius: 'var(--g-radius-chip)',
        background: 'var(--g-color-bg-surface)',
        color: 'var(--g-color-text-primary)',
        fontFamily: 'var(--g-font-text)',
        fontSize: 'var(--g-font-size-12)',
        fontWeight: 600,
        boxShadow: 'var(--g-shadow-1)',
      }}
    >
      {icon}
      {label}
    </Box>
  );
}

export default function RecipeCard({ recipe, onClick: externalOnClick }) {
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();
  const { id, title, cook_time, difficulty, foodType, isQuick, isHealthy, mealType } = recipe;
  const TypeIcon = TYPE_ICON[foodType] || IconChefHat;

  const handleClick = () => {
    trackEvent('recipe_view', { recipeId: id, title });
    if (externalOnClick) {
      externalOnClick(recipe);
    } else {
      navigate(`/recipe/${id}`);
    }
  };

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      aria-label={title}
      {...withReducedMotion(pressResponse)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        inlineSize: '100%',
        blockSize: '100%',
        textAlign: 'start',
        cursor: 'pointer',
        overflow: 'hidden',
        padding: 0,
        background: 'var(--g-color-bg-surface)',
        border: '1px solid var(--g-color-border-subtle)',
        borderRadius: 'var(--g-radius-card)',
        boxShadow: 'var(--g-shadow-1)',
        color: 'var(--g-color-text-primary)',
      }}
    >
      {/* Media — 4:3 branded placeholder (calm brand tint + type glyph), scrim for overlays. */}
      <Box
        style={{
          position: 'relative',
          inlineSize: '100%',
          aspectRatio: '4 / 3',
          background: 'var(--g-color-brand-50)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <TypeIcon size={48} stroke={1.4} color="var(--g-color-food-saffron)" aria-hidden="true" />

        {/* Scrim so overlaid pills stay legible on any future photo */}
        <Box
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, background: 'var(--g-scrim-photo)' }}
        />

        {/* Quick / healthy flags (inline-start top), order follows dir */}
        <Group
          gap="var(--g-space-1)"
          wrap="nowrap"
          style={{ position: 'absolute', insetBlockStart: 'var(--g-space-2)', insetInlineStart: 'var(--g-space-2)' }}
        >
          {isQuick && <FlagPill icon={<IconBolt size={12} aria-hidden="true" />} label="سریع" />}
          {isHealthy && <FlagPill icon={<IconHeart size={12} aria-hidden="true" />} label="سالم" />}
        </Group>

        {/* Difficulty (inline-end bottom) */}
        {difficulty && (
          <Box
            component="span"
            style={{
              position: 'absolute',
              insetBlockEnd: 'var(--g-space-2)',
              insetInlineEnd: 'var(--g-space-2)',
              paddingInline: 'var(--g-space-2)',
              paddingBlock: '2px',
              borderRadius: 'var(--g-radius-chip)',
              fontFamily: 'var(--g-font-text)',
              fontSize: 'var(--g-font-size-12)',
              fontWeight: 600,
              background: difficultyToneFor(difficulty).bg,
              color: difficultyToneFor(difficulty).fg,
            }}
          >
            {difficulty}
          </Box>
        )}
      </Box>

      {/* Body — 2-line title clamp + ≤3 meta chips */}
      <Box
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 'var(--g-space-2)',
          paddingInline: 'var(--g-space-3)',
          paddingBlock: 'var(--g-space-3)',
        }}
      >
        <Text
          style={{
            fontFamily: 'var(--g-font-display)',
            fontSize: 'var(--g-font-size-14)',
            fontWeight: 600,
            lineHeight: 'var(--g-leading-heading)',
            color: 'var(--g-color-text-primary)',
            textAlign: 'start',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {title}
        </Text>

        <Group gap="var(--g-space-1)" wrap="wrap" style={{ rowGap: 'var(--g-space-1)' }}>
          {cook_time && (
            <MetaChip icon={<IconClock size={12} aria-hidden="true" />}>{cook_time}</MetaChip>
          )}
          {foodType && <MetaChip>{foodType}</MetaChip>}
          {mealType && <MetaChip>{mealType}</MetaChip>}
        </Group>
      </Box>
    </motion.button>
  );
}
