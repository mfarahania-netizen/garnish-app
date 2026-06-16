import { Box } from '@mantine/core';
import { IconSoup, IconSalad, IconMeat, IconChefHat, IconBread, IconLeaf } from '@tabler/icons-react';

/**
 * PlatePlaceholder — honest branded stand-in for a missing food photo.
 *
 * A warm saffron-tinted tile with a SMALL, low-opacity dish glyph (capped, scales
 * down on small thumbnails) — never a gray gradient, never a giant glyph filling
 * the card, never an empty box. Fills its host media slot (16:9 / 1:1 / banner).
 * Token-pure; the glyph is decorative (the dish name is the card title).
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
      style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: warm }}
    >
      <Glyph
        aria-hidden="true"
        stroke={1.5}
        style={{ blockSize: '30%', inlineSize: 'auto', maxBlockSize: 44, minBlockSize: 15, color: 'var(--g-color-brand-600)', opacity: 0.4 }}
      />
    </Box>
  );
}
