import { Box } from '@mantine/core';
import { IconChefHat, IconSoup, IconSalad, IconMeat, IconBread, IconLeaf } from '@tabler/icons-react';

/**
 * PlatePlaceholder — the honest branded stand-in for a missing food photo.
 *
 * A warm saffron-tinted tile with a centered low-opacity dish glyph on a soft
 * "plate" ring. This is NEVER a gray gradient and never fake stock of another
 * dish — per GES, the only image fallback. Token-pure (warm brand tints + saffron
 * glyph); scales to any host aspect ratio (4:3 / 16:9 / 1:1). The glyph is
 * decorative (the dish name is the card title); the tile carries the label as its
 * accessible name. Food glyphs do not mirror in RTL.
 */
const GLYPHS = [IconSoup, IconSalad, IconMeat, IconChefHat, IconBread, IconLeaf];

export default function PlatePlaceholder({ label = '', seed = 0 }) {
  const base = Number.isFinite(Number(seed)) ? Number(seed) : label.length;
  const idx = ((base % GLYPHS.length) + GLYPHS.length) % GLYPHS.length;
  const Glyph = GLYPHS[idx];
  const warm = idx % 2 === 0 ? 'var(--g-color-brand-50)' : 'var(--g-color-brand-100)';

  return (
    <Box
      role="img"
      aria-label={label || 'تصویر غذا'}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: warm,
      }}
    >
      <Box
        aria-hidden="true"
        style={{
          inlineSize: '52%',
          aspectRatio: '1 / 1',
          borderRadius: '50%',
          border: '1px solid var(--g-color-brand-200)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <Glyph style={{ inlineSize: '52%', blockSize: '52%', color: 'var(--g-color-brand-600)', opacity: 0.5 }} stroke={1.5} />
      </Box>
    </Box>
  );
}
