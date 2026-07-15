import { Box } from '@mantine/core';
import { IconSoup, IconSalad, IconMeat, IconChefHat, IconBread, IconLeaf, IconBowl } from '@tabler/icons-react';

/**
 * PlatePlaceholder — premium branded stand-in for a missing food photo (real photos are the eventual ceiling; this is the
 * intentional bridge, never a bare glyph). A soft, per-dish-varied warm gradient (theme-aware brand tokens, varied angle so
 * each dish looks distinct) + a CATEGORY glyph inferred from the dish name (rice → bowl, kebab → meat, خورش/آش → soup,
 * salad, bread/breakfast, herb/kuku → leaf). Fills its host media slot; token-pure; decorative (the dish name is the title).
 */
const renderGlyph = (label, props) => {
  const s = String(label || '');
  if (/کباب|جوجه|کوبیده|برگ|شیشلیک|بختیاری|گوشت|ماهی|میگو|مرغ|بوقلمون/.test(s)) return <IconMeat {...props} />;
  if (/پلو|برنج|چلو|دمی|کته|پلوی|ته‌چین|تهچین|باقالی/.test(s)) return <IconBowl {...props} />;
  if (/خورش|آبگوشت|سوپ|آش|دیزی|اشکنه|حلیم|عدسی|آبدوغ/.test(s)) return <IconSoup {...props} />;
  if (/سالاد|کاهو|بورانی|ماست‌و|سبزی خوردن|شیرازی/.test(s)) return <IconSalad {...props} />;
  if (/نان|املت|نیمرو|پنیر|صبحانه|عسل|مربا|کره|تخم‌مرغ|حلوا|شیرینی|کیک|دسر/.test(s)) return <IconBread {...props} />;
  if (/کوکو|سبزی|دلمه|کدو|بادمجان|کشک|میرزا/.test(s)) return <IconLeaf {...props} />;
  return <IconChefHat {...props} />;
};

export default function PlatePlaceholder({ label = '', seed = 0, glyphSize = 40 }) {
  const base = Number.isFinite(Number(seed)) ? Math.abs(Number(seed)) : label.length;
  const angle = 110 + (base % 9) * 16; // 110..238deg — each dish gets a distinct gradient sweep (still calm, on-brand)
  const flip = base % 2 === 0;
  const c1 = flip ? 'var(--g-color-brand-50)' : 'var(--g-color-brand-100)';
  const c2 = flip ? 'var(--g-color-brand-100)' : 'var(--g-color-brand-50)';

  return (
    <Box role="img" aria-label={label || 'تصویر غذا'} style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: `linear-gradient(${angle}deg, ${c1}, ${c2})` }}>
      {renderGlyph(label, { size: glyphSize, stroke: 1.5, 'aria-hidden': true, style: { color: 'var(--g-color-brand-600)', opacity: 0.42 } })}
    </Box>
  );
}
