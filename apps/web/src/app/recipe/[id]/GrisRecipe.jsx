import { useState } from 'react';
import { Box, Text, UnstyledButton } from '@mantine/core';
import {
  IconChevronDown, IconClock, IconChefHat, IconAlertTriangle, IconToolsKitchen2, IconArrowsExchange,
  IconBook, IconFlask, IconSchool, IconHelpCircle, IconArchive, IconSparkles, IconListNumbers,
} from '@tabler/icons-react';
import { toFaDigits } from '../../../components/ges/format';
import { stripGrisIds } from '../../../components/ges/personalize';
import { formatIngredientAmountDisplay } from '../../../components/ges/ingredientAmountDisplay';
import { ingredientSafetyMeta } from '../../../components/ges/ingredientSafety';
import { presentIngredientSectionsV3 } from './ingredientDisplayPresenterV3';
import IngredientListSection from './IngredientListSection.jsx';

/**
 * GrisRecipe — renders the Garnish Recipe Intelligence Standard (GRIS v2) as a premium recipe page built on
 * PROGRESSIVE DISCLOSURE: the minimal visible surface is story → at-a-glance → ingredients; everything deeper
 * (the food-science «why it works», skills, the chef-secret finish, troubleshooting, variations, storage,
 * pairings, FAQ) lives in a clean stack of expandables — present and understandable, never cluttering. The
 * cooking STEPS live in guided mode (/cook/:id), and nutrition is unified into one quiet accordion the
 * parent renders. Pure presenter: renders only what the gris object provides (graceful omission), no fabrication.
 *
 * Content rules (the founder's feedback): the story OPENS as a story (origin/occasion, never a technique line);
 * any technique insight (story.hook, or the recipe's technique-flavoured description passed as `techniqueTip`)
 * is relocated into the «چرا این‌طوری؟» science section where technique belongs.
 */

const fa = (n) => (typeof n === 'number' ? toFaDigits(n) : n);
const list = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);
const recipeIngredientsForGris = (recipe) => list(recipe?.ingredients).map((ingredient) => ({
  name: ingredient.name,
  volume: ingredient.amountText || null,
  weightG: null,
  prepState: null,
  component: '',
  role: null,
  buyTip: null,
  swap: null,
})).filter((ingredient) => ingredient.name);

const card = { background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)' };
const h2 = { fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 'var(--g-space-6) 0 var(--g-space-3)', display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' };
const body = { fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)' };
const muted = { fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)' };

function H2({ icon: Icon, children }) {
  return <Text component="h2" style={h2}><Icon size={19} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} />{children}</Text>;
}

function Chip({ children, tone }) {
  return (
    <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 4, paddingInline: 'var(--g-space-3)', paddingBlock: 5, borderRadius: 'var(--g-radius-chip)', background: tone === 'brand' ? 'var(--g-color-brand-50)' : 'var(--g-color-bg-surface)', border: tone === 'brand' ? 'none' : '1px solid var(--g-color-border-strong)', color: tone === 'brand' ? 'var(--g-color-brand-700)' : 'var(--g-color-text-secondary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600 }}>{children}</Box>
  );
}

// shared progressive-disclosure container (also exported so the parent can keep the nutrition accordion identical)
export function Accordion({ icon: Icon, title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Box style={{ ...card, overflow: 'hidden', marginBlockEnd: 'var(--g-space-2)' }}>
      <UnstyledButton type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', inlineSize: '100%', minBlockSize: 48, paddingInline: 'var(--g-space-4)' }}>
        <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
          <Icon size={18} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} />
          <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>{title}</Text>
        </Box>
        <IconChevronDown size={18} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)', transform: open ? 'rotate(180deg)' : 'none' }} />
      </UnstyledButton>
      {open ? <Box style={{ paddingInline: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-4)' }}>{children}</Box> : null}
    </Box>
  );
}

export default function GrisRecipe({ gris, recipe = null, scaleFactor = 1, servedFor = null, swaps = {}, onAskSwap = null, removed = [], onToggleRemove = null, techniqueTip = null }) {
  if (!gris) return null;
  const g = gris;
  const scaled = scaleFactor !== 1;
  const ing = list(g.ingredients).length ? list(g.ingredients) : recipeIngredientsForGris(recipe);
  const ingredientSections = presentIngredientSectionsV3(ing, { recipe }).sections;

  // technique insights relocated OUT of the intro/story INTO the «why it works» science section
  const techLines = [techniqueTip, g.story?.hook].map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean);
  const why = list(g.whyItWorks);

  return (
    <Box>
      {/* STORY — opens as a story (origin → occasion); never a technique line */}
      {g.story && (g.story.origin || g.story.occasion) ? (
        <>
          <H2 icon={IconBook}>داستان</H2>
          {g.story.origin ? <Text component="p" style={{ ...body, fontSize: 'var(--g-font-size-16)', color: 'var(--g-color-text-primary)', margin: 0 }}>{g.story.origin}</Text> : null}
          {g.story.occasion ? <Text component="p" style={{ ...muted, margin: 'var(--g-space-2) 0 0' }}>🗓️ {g.story.occasion}</Text> : null}
        </>
      ) : null}

      {/* GLANCE — at-a-glance facts. Time lives ONLY in the page header (no duplicate/contradictory chips here). */}
      {g.glance ? (
        <>
          <H2 icon={IconClock}>نگاهِ اول</H2>
          {g.glance.promise ? <Text component="p" style={{ ...body, margin: '0 0 var(--g-space-3)' }}>{g.glance.promise}</Text> : null}
          <Box style={{ ...card, padding: 'var(--g-space-4)', display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)' }}>
            {typeof g.glance.handsOffMin === 'number' ? <Chip>🤲 بی‌دخالت: {fa(g.glance.handsOffMin)} دقیقه</Chip> : null}
            {g.glance.difficulty ? <Chip>📊 {g.glance.difficulty}</Chip> : null}
            {g.glance.costBand ? <Chip>💰 {g.glance.costBand}</Chip> : null}
            {typeof g.glance.servings === 'number' || servedFor ? <Chip tone={scaled ? 'brand' : undefined}>🍽️ {fa(servedFor || g.glance.servings)} نفر{scaled ? ' (تنظیم‌شده)' : ''}</Chip> : null}
          </Box>
          {list(g.glance.keyEquipment).length ? <Text component="p" style={{ ...muted, margin: 'var(--g-space-2) 0 0' }}>🔧 ابزار: {g.glance.keyEquipment.join(' · ')}</Text> : null}
          {list(g.glance.goodFor).length ? <Text component="p" style={{ ...muted, margin: 'var(--g-space-1) 0 0' }}>👌 مناسبِ: {g.glance.goodFor.join(' · ')}</Text> : null}
        </>
      ) : null}

      {/* INGREDIENTS — clean presenter output: compact rows, useful subgroups, no raw role/buy-tip metadata dump. */}
      {ingredientSections.length ? (
        <>
          <H2 icon={IconToolsKitchen2}>مواد لازم</H2>
          {scaled && servedFor ? <Text component="p" style={{ ...muted, margin: '0 0 var(--g-space-2)', color: 'var(--g-color-brand-700)', fontWeight: 600 }}>تنظیم‌شده برای {fa(servedFor)} نفر</Text> : null}
          <IngredientListSection
            sections={ingredientSections}
            renderItemProps={(item) => {
              const it = item.source || {};
              const display = item.titleFa;
              const amount = formatIngredientAmountDisplay({
                volume: it.volume ? stripGrisIds(it.volume) : stripGrisIds(item.amountLabel || '').replace(/^مقدار:\s*/, ''),
                displayUnit: it.displayUnit,
                amount: it.amount,
                unit: it.unit,
                weightG: it.weightG,
                name: display,
                displayName: it.displayName,
              }, scaleFactor);
              const safety = ingredientSafetyMeta(it);
              const authoredSwaps = Array.isArray(it.swaps) ? it.swaps : [];
              const canAskSwap = authoredSwaps.length > 0 || safety.isReplaceable;
              const applied = swaps[display] || null;
              const gone = removed.includes(display);
              return {
                amountLabelOverride: amount ? `مقدار: ${amount}` : item.amountLabel,
                applied,
                gone,
                canAskSwap,
                canRemove: item.canRemove,
                onAskSwap: onAskSwap && !gone && canAskSwap
                  ? () => onAskSwap(display, authoredSwaps.length ? authoredSwaps : safety.replacementCandidates)
                  : null,
                onToggleRemove: onToggleRemove && (gone || item.canRemove)
                  ? () => onToggleRemove(display, it.role)
                  : null,
              };
            }}
          />
        </>
      ) : null}

      {/* ── DISCLOSURE STACK — depth on demand. Everything below the shopping list is one tap away. ── */}
      <Box style={{ marginBlockStart: 'var(--g-space-5)' }}>
        {/* STEPS — detail-page visibility for review; Cook Mode remains the guided, immersive flow. */}
        {list(g.steps).length ? (
          <Accordion icon={IconListNumbers} title="روش آماده‌سازی">
            <Box component="ol" style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)' }}>
              {list(g.steps).map((s, i) => (
                <Box component="li" key={i} style={{ ...card, padding: 'var(--g-space-3)', display: 'flex', gap: 'var(--g-space-3)' }}>
                  <Box aria-hidden="true" style={{ display: 'grid', placeItems: 'center', inlineSize: 26, blockSize: 26, borderRadius: '50%', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 800, flexShrink: 0 }}>{fa(s.order || i + 1)}</Box>
                  <Box style={{ minInlineSize: 0, flex: 1 }}>
                    {s.imageUrl ? <img src={s.imageUrl} alt={s.title || `مرحله ${fa(s.order || i + 1)}`} loading="lazy" decoding="async" style={{ inlineSize: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 'var(--g-radius-input)', marginBlockEnd: 'var(--g-space-2)' }} /> : null}
                    {s.title ? <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>{s.title}</Text> : null}
                    {typeof s.durationMin === 'number' ? <Text component="div" style={{ ...muted, color: 'var(--g-color-brand-700)', fontWeight: 700 }}>{fa(s.durationMin)} دقیقه</Text> : null}
                    <Text component="p" style={{ ...body, margin: s.title ? '2px 0 0' : 0 }}>{s.instruction || s.text || s}</Text>
                    {s.tip ? <Text component="p" style={{ ...muted, margin: '2px 0 0' }}>{stripGrisIds(s.tip)}</Text> : null}
                  </Box>
                </Box>
              ))}
            </Box>
          </Accordion>
        ) : null}

        {/* WHY IT WORKS — the science + any relocated technique insight (the «wow», kept fully, never inline-dumped) */}
        {(techLines.length || why.length) ? (
          <Accordion icon={IconFlask} title="نکته‌های مهم">
            {techLines.map((t, i) => <Text key={`t-${i}`} component="p" style={{ ...body, margin: i ? 'var(--g-space-2) 0 0' : '0' }}>{t}</Text>)}
            {why.length ? (
              <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)', marginBlockStart: techLines.length ? 'var(--g-space-3)' : 0 }}>
                {why.map((w, i) => (
                  <Box key={i} style={{ ...card, padding: 'var(--g-space-4)', background: 'var(--g-color-ai-surface)', border: 'var(--g-border-ai)' }}>
                    <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>{w.point}</Text>
                    <Text component="p" style={{ ...body, margin: 'var(--g-space-1) 0 0' }}>{w.explanation}</Text>
                  </Box>
                ))}
              </Box>
            ) : null}
          </Accordion>
        ) : null}

        {/* SKILLS */}
        {list(g.skillsLearned).length ? (
          <Accordion icon={IconSchool} title="مهارت‌های این دستور">
            <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)' }}>
              {list(g.skillsLearned).map((s, i) => <Chip key={i} tone="brand">🎓 {s}</Chip>)}
            </Box>
          </Accordion>
        ) : null}

        {/* FINISH + chef secret */}
        {g.finish && (g.finish.finalLook || g.finish.plating || g.finish.chefSecret) ? (
          <Accordion icon={IconChefHat} title="نکتهٔ پایانی">
            {g.finish.finalLook ? <Text component="p" style={{ ...body, margin: 0 }}>{g.finish.finalLook}</Text> : null}
            {g.finish.plating ? <Text component="p" style={{ ...body, margin: 'var(--g-space-2) 0 0' }}>🍽️ {g.finish.plating}</Text> : null}
            {g.finish.chefSecret ? (
              <Box style={{ ...card, padding: 'var(--g-space-4)', marginBlockStart: 'var(--g-space-3)', background: 'var(--g-color-brand-50)', border: '1px solid var(--g-color-brand-200)' }}>
                <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-brand-700)', margin: 0 }}>🔑 رازِ سرآشپز: {g.finish.chefSecret}</Text>
              </Box>
            ) : null}
          </Accordion>
        ) : null}

        {/* TROUBLESHOOTING */}
        {list(g.troubleshooting).length ? (
          <Accordion icon={IconAlertTriangle} title="اگر خراب شد">
            {list(g.troubleshooting).map((t, i) => (
              <Box key={i} style={{ marginBlockEnd: 'var(--g-space-2)' }}>
                <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>{t.problem}</Text>
                <Text component="p" style={{ ...body, margin: '2px 0 0' }}>← {t.fix}</Text>
              </Box>
            ))}
          </Accordion>
        ) : null}

        {/* VARIATIONS */}
        {list(g.variations).length ? (
          <Accordion icon={IconArrowsExchange} title="تغییرات پیشنهادی">
            {list(g.variations).map((v, i) => (
              <Box key={i} style={{ marginBlockEnd: 'var(--g-space-2)' }}>
                <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>{v.name}</Text>
                <Text component="p" style={{ ...body, margin: '2px 0 0' }}>{v.how}</Text>
              </Box>
            ))}
          </Accordion>
        ) : null}

        {/* KEEP */}
        {g.keep && (g.keep.makeAhead || g.keep.storage || g.keep.reheat || g.keep.freeze) ? (
          <Accordion icon={IconArchive} title="نگه‌داری">
            {g.keep.makeAhead ? <Text component="p" style={{ ...body, margin: '0 0 var(--g-space-1)' }}>⏲️ آماده‌سازیِ زودهنگام: {g.keep.makeAhead}</Text> : null}
            {g.keep.storage ? <Text component="p" style={{ ...body, margin: '0 0 var(--g-space-1)' }}>🧊 یخچال: {g.keep.storage}</Text> : null}
            {g.keep.reheat ? <Text component="p" style={{ ...body, margin: '0 0 var(--g-space-1)' }}>🔥 گرم‌کردن: {g.keep.reheat}</Text> : null}
            {g.keep.freeze ? <Text component="p" style={{ ...body, margin: 0 }}>❄️ فریز: {g.keep.freeze}</Text> : null}
          </Accordion>
        ) : null}

        {/* SERVE WITH */}
        {list(g.serveWith).length ? (
          <Accordion icon={IconSparkles} title="کنار این غذا">
            <Text component="p" style={{ ...body, margin: 0 }}>{list(g.serveWith).map(stripGrisIds).filter(Boolean).join(' · ')}</Text>
          </Accordion>
        ) : null}

        {/* FAQ */}
        {list(g.faq).length ? (
          <Accordion icon={IconHelpCircle} title="سؤال‌های رایج">
            {list(g.faq).map((f, i) => (
              <Box key={i} style={{ marginBlockEnd: 'var(--g-space-2)' }}>
                <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>{f.q}</Text>
                <Text component="p" style={{ ...body, margin: '2px 0 0' }}>{f.a}</Text>
              </Box>
            ))}
          </Accordion>
        ) : null}
      </Box>
    </Box>
  );
}
