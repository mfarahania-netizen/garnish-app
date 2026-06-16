import { Box, Stack, Group, Text } from '@mantine/core';
import RecipeCard from '../RecipeCard';
import { WhyChip } from './WhyChip';

/**
 * RecommendationCard (PL row 16) — a Recipe Card under the explanation contract.
 *
 * Composes the shared RecipeCard with a MANDATORY Why chip + a one-line reason
 * snippet. The contract (PL row 16 / library-wide rule 3): a recommendation
 * always carries a REAL reason. When the explanation payload is missing the chip
 * is hidden and the caller logs the gap — this component NEVER fabricates a
 * reason. Only render this from a rec payload.
 *
 * Pure presentational. Token-pure, RTL-safe.
 *
 * Props:
 *  - recipe: the recipe summary (passed straight to RecipeCard)
 *  - reason: the one-line, payload-fed reason (omit ⇒ chip hidden, no fabrication)
 *  - onWhy: open the Why sheet for this item
 *  - onClick: forwarded to RecipeCard (rec click handling)
 *  - whyLabel: chip copy override
 */
export function RecommendationCard({ recipe, reason, onWhy, onClick, whyLabel = 'Why this?' }) {
  const hasReason = Boolean(reason);

  return (
    <Stack style={{ gap: 'var(--g-space-2)', inlineSize: '100%' }} data-has-reason={hasReason || undefined}>
      <RecipeCard recipe={recipe} onClick={onClick} />
      {hasReason && (
        <Group wrap="nowrap" justify="space-between" align="center" style={{ gap: 'var(--g-space-2)' }}>
          <Text
            style={{
              flex: 1,
              minInlineSize: 0,
              fontFamily: 'var(--g-font-text)',
              fontSize: 'var(--g-font-size-12)',
              lineHeight: 'var(--g-leading-body)',
              color: 'var(--g-color-text-secondary)',
              textAlign: 'start',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {reason}
          </Text>
          <Box style={{ flexShrink: 0 }}>
            <WhyChip label={whyLabel} onOpen={onWhy} ariaLabel={`${whyLabel} — ${recipe?.title ?? ''}`} />
          </Box>
        </Group>
      )}
    </Stack>
  );
}

export default RecommendationCard;
