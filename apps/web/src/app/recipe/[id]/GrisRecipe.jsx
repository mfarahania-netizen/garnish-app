import { useState } from 'react';
import { Box, Text, UnstyledButton } from '@mantine/core';
import {
  IconChevronDown, IconClock, IconChefHat, IconAlertTriangle, IconToolsKitchen2, IconArrowsExchange,
  IconBook, IconFlask, IconSchool, IconHelpCircle, IconArchive, IconSparkles,
  IconTrash, IconArrowBackUp,
} from '@tabler/icons-react';
import { toFaDigits } from '../../../components/ges/format';
import { scaleWeightG, scaleAmountText } from '../../../components/ges/scaling';
import { parseGrisName, stripGrisIds } from '../../../components/ges/personalize';

/**
 * GrisRecipe — renders the Garnish Recipe Intelligence Standard (GRIS v2) as a premium recipe page built on
 * PROGRESSIVE DISCLOSURE: the minimal visible surface is story → at-a-glance → ingredients; everything deeper
 * (the food-science «why it works», skills, the chef-secret finish, troubleshooting, variations, storage,
 * pairings, FAQ) lives in a clean stack of expandables — present and understandable, never cluttering. The
 * cooking STEPS live in Cook Mode («بپز» → /cook/:id), and nutrition is unified into one quiet accordion the
 * parent renders. Pure presenter: renders only what the gris object provides (graceful omission), no fabrication.
 *
 * Content rules (the founder's feedback): the story OPENS as a story (origin/occasion, never a technique line);
 * any technique insight (story.hook, or the recipe's technique-flavoured description passed as `techniqueTip`)
 * is relocated into the «چرا این‌طوری؟» science section where technique belongs.
 */

const fa = (n) => (typeof n === 'number' ? toFaDigits(n) : n);
const list = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);

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

export default function GrisRecipe({ gris, scaleFactor = 1, servedFor = null, swaps = {}, onAskSwap = null, removed = [], onToggleRemove = null, techniqueTip = null }) {
  if (!gris) return null;
  const g = gris;
  const scaled = scaleFactor !== 1;
  const ing = list(g.ingredients);
  // group ingredients by component
  const groups = {};
  for (const i of ing) { const k = i.component || ''; (groups[k] = groups[k] || []).push(i); }

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

      {/* INGREDIENTS — grouped, with weight + role + buy-tip + swap. The one long block that stays fully visible. */}
      {ing.length ? (
        <>
          <H2 icon={IconToolsKitchen2}>مواد لازم</H2>
          {scaled && servedFor ? <Text component="p" style={{ ...muted, margin: '0 0 var(--g-space-2)', color: 'var(--g-color-brand-700)', fontWeight: 600 }}>↕️ تنظیم‌شده برای {fa(servedFor)} نفر</Text> : null}
          {Object.entries(groups).map(([comp, items]) => (
            <Box key={comp || 'main'} style={{ marginBlockEnd: 'var(--g-space-3)' }}>
              {comp ? <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 700, color: 'var(--g-color-brand-700)', margin: '0 0 var(--g-space-2)' }}>برای {comp}</Text> : null}
              <Box style={card}>
                {items.map((it, i) => {
                  const { display } = parseGrisName(it.name); // strip the «— ing_xxx» grounding suffix for display + keys
                  const sw = scaleWeightG(it.weightG, scaleFactor);
                  // suppress sub-1g «۰g» (rounds to nothing); scrub authoring notes from the volume string
                  const weightPart = typeof sw === 'number' && sw >= 1 ? `${fa(sw)}g` : null;
                  const volPart = it.volume ? scaleAmountText(stripGrisIds(it.volume), scaleFactor) : null;
                  const amount = [weightPart, volPart].filter(Boolean).join(' · ');
                  const applied = swaps[display] || null; // session swap applied to this ingredient
                  const gone = removed.includes(display);
                  return (
                  <Box key={i} style={{ padding: 'var(--g-space-3) var(--g-space-4)', borderBlockStart: i ? '1px solid var(--g-color-border-subtle)' : 'none', opacity: gone ? 0.6 : 1 }}>
                    {/* name + controls on row 1; the amount stacks on its own wrapping line (no overlap/scroll) */}
                    <Box style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--g-space-2)' }}>
                      <Box style={{ flex: 1, minInlineSize: 0 }}>
                        <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: applied && !gone ? 700 : 600, color: applied && !gone ? 'var(--g-color-brand-700)' : 'var(--g-color-text-primary)', textDecoration: gone ? 'line-through' : 'none' }}>{applied && !gone ? applied.to : display}{!applied && !gone && it.prepState ? <Text component="span" style={muted}> — {stripGrisIds(it.prepState)}</Text> : null}</Text>
                        {applied && !gone ? <Text component="span" style={{ ...muted, marginInlineStart: 4 }}>به‌جای {display}</Text> : null}
                        {gone ? <Text component="span" style={{ ...muted, marginInlineStart: 4 }}>حذف شد</Text> : null}
                      </Box>
                      <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-1)', flexShrink: 0 }}>
                        {onAskSwap && !gone ? <UnstyledButton type="button" onClick={() => onAskSwap(display, it.swaps)} aria-label={`جایگزین برای ${display}`} style={{ display: 'inline-flex', alignItems: 'center', minBlockSize: 32, paddingInline: 'var(--g-space-2)', borderRadius: 'var(--g-radius-chip)', border: `1px solid ${applied ? 'var(--g-color-brand-600)' : 'var(--g-color-brand-200)'}`, background: applied ? 'var(--g-color-brand-50)' : 'transparent', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-11)', fontWeight: 600 }}>{applied ? 'تغییر' : 'جایگزین؟'}</UnstyledButton> : null}
                        {onToggleRemove ? <UnstyledButton type="button" onClick={() => onToggleRemove(display, it.role)} aria-label={gone ? `برگرداندن ${display}` : `حذف ${display}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', inlineSize: 30, minBlockSize: 32, color: gone ? 'var(--g-color-brand-600)' : 'var(--g-color-text-muted)' }}>{gone ? <IconArrowBackUp size={16} stroke={1.8} /> : <IconTrash size={15} stroke={1.8} />}</UnstyledButton> : null}
                      </Box>
                    </Box>
                    {amount && !gone ? <Text component="p" style={{ ...muted, margin: '2px 0 0', overflowWrap: 'anywhere' }}>⚖️ {amount}</Text> : null}
                    {it.role && !gone ? <Text component="p" style={{ ...muted, margin: '2px 0 0' }}>🧩 {it.role}</Text> : null}
                    {it.buyTip && !gone ? <Text component="p" style={{ ...muted, margin: '2px 0 0' }}>🛒 {it.buyTip}</Text> : null}
                    {it.swap && !applied && !gone ? <Text component="p" style={{ ...muted, margin: '2px 0 0', color: 'var(--g-color-brand-700)' }}>🔄 {stripGrisIds(it.swap)}</Text> : null}
                  </Box>
                  );
                })}
              </Box>
            </Box>
          ))}
        </>
      ) : null}

      {/* ── DISCLOSURE STACK — depth on demand. Everything below the shopping list is one tap away. ── */}
      <Box style={{ marginBlockStart: 'var(--g-space-5)' }}>
        {/* WHY IT WORKS — the science + any relocated technique insight (the «wow», kept fully, never inline-dumped) */}
        {(techLines.length || why.length) ? (
          <Accordion icon={IconFlask} title="چرا این‌طوری؟ — علمِ آشپزی">
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
          <Accordion icon={IconSchool} title="چی یاد می‌گیری">
            <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)' }}>
              {list(g.skillsLearned).map((s, i) => <Chip key={i} tone="brand">🎓 {s}</Chip>)}
            </Box>
          </Accordion>
        ) : null}

        {/* FINISH + chef secret */}
        {g.finish && (g.finish.finalLook || g.finish.plating || g.finish.chefSecret) ? (
          <Accordion icon={IconChefHat} title="پایان و رازِ سرآشپز">
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
          <Accordion icon={IconAlertTriangle} title="رفعِ مشکل">
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
          <Accordion icon={IconArrowsExchange} title="تغییرات (مالِ خودت کن)">
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
          <Accordion icon={IconArchive} title="نگه‌داری و گرم‌کردن">
            {g.keep.makeAhead ? <Text component="p" style={{ ...body, margin: '0 0 var(--g-space-1)' }}>⏲️ آماده‌سازیِ زودهنگام: {g.keep.makeAhead}</Text> : null}
            {g.keep.storage ? <Text component="p" style={{ ...body, margin: '0 0 var(--g-space-1)' }}>🧊 یخچال: {g.keep.storage}</Text> : null}
            {g.keep.reheat ? <Text component="p" style={{ ...body, margin: '0 0 var(--g-space-1)' }}>🔥 گرم‌کردن: {g.keep.reheat}</Text> : null}
            {g.keep.freeze ? <Text component="p" style={{ ...body, margin: 0 }}>❄️ فریز: {g.keep.freeze}</Text> : null}
          </Accordion>
        ) : null}

        {/* SERVE WITH */}
        {list(g.serveWith).length ? (
          <Accordion icon={IconSparkles} title="سرو با">
            <Text component="p" style={{ ...body, margin: 0 }}>{list(g.serveWith).map(stripGrisIds).filter(Boolean).join(' · ')}</Text>
          </Accordion>
        ) : null}

        {/* FAQ */}
        {list(g.faq).length ? (
          <Accordion icon={IconHelpCircle} title="سؤال‌های پرتکرار">
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
