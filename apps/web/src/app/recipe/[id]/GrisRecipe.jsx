import { useState } from 'react';
import { Box, Text, UnstyledButton } from '@mantine/core';
import {
  IconChevronDown, IconFlame, IconClock, IconThermometer, IconEye, IconBulb, IconLifebuoy,
  IconCircleCheck, IconChefHat, IconAlertTriangle, IconToolsKitchen2, IconArrowsExchange,
  IconBook, IconFlask, IconSchool, IconInfoCircle, IconHelpCircle, IconArchive, IconSparkles,
  IconTrash, IconArrowBackUp,
} from '@tabler/icons-react';
import { toFaDigits } from '../../../components/ges/format';
import { scaleWeightG, scaleAmountText } from '../../../components/ges/scaling';
import { parseGrisName, patchStepText, swapsList, stripGrisIds } from '../../../components/ges/personalize';

/**
 * GrisRecipe — renders the full Garnish Recipe Intelligence Standard (GRIS v2) object as a premium,
 * "no-video-needed" recipe page: story, the food-science «why it works», at-a-glance, skills, ingredients
 * (weight + role + buy-tip + swap), ultra-granular steps (flame/temp/time/sees/recovery/doneness), the
 * chef-secret finish, troubleshooting, variations, storage, pairings, and honest nutrition. Pure presenter:
 * renders only what the gris object provides (graceful omission), no fabrication.
 */

const FLAME = { none: 'بدون شعله', low: 'شعلهٔ کم', medium: 'شعلهٔ متوسط', 'medium-high': 'شعلهٔ متوسط‌رو‌به‌بالا', high: 'شعلهٔ زیاد' };
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

function Accordion({ icon: Icon, title, defaultOpen = false, children }) {
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

export default function GrisRecipe({ gris, scaleFactor = 1, servedFor = null, swaps = {}, onAskSwap = null, removed = [], onToggleRemove = null }) {
  if (!gris) return null;
  const g = gris;
  const scaled = scaleFactor !== 1;
  const ing = list(g.ingredients);
  // group ingredients by component
  const groups = {};
  for (const i of ing) { const k = i.component || ''; (groups[k] = groups[k] || []).push(i); }

  return (
    <Box>
      {/* STORY */}
      {g.story ? (
        <>
          <H2 icon={IconBook}>داستان</H2>
          {g.story.hook ? <Text component="p" style={{ ...body, fontSize: 'var(--g-font-size-16)', color: 'var(--g-color-text-primary)', margin: 0 }}>{g.story.hook}</Text> : null}
          {g.story.origin ? <Text component="p" style={{ ...body, margin: 'var(--g-space-2) 0 0' }}>{g.story.origin}</Text> : null}
          {g.story.occasion ? <Text component="p" style={{ ...muted, margin: 'var(--g-space-2) 0 0' }}>🗓️ {g.story.occasion}</Text> : null}
        </>
      ) : null}

      {/* WHY IT WORKS — the science (the wow) */}
      {list(g.whyItWorks).length ? (
        <>
          <H2 icon={IconFlask}>چرا این دستور کار می‌کند</H2>
          <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)' }}>
            {list(g.whyItWorks).map((w, i) => (
              <Box key={i} style={{ ...card, padding: 'var(--g-space-4)', background: 'var(--g-color-ai-surface)', border: 'var(--g-border-ai)' }}>
                <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>{w.point}</Text>
                <Text component="p" style={{ ...body, margin: 'var(--g-space-1) 0 0' }}>{w.explanation}</Text>
              </Box>
            ))}
          </Box>
        </>
      ) : null}

      {/* GLANCE */}
      {g.glance ? (
        <>
          <H2 icon={IconClock}>نگاهِ اول</H2>
          {g.glance.promise ? <Text component="p" style={{ ...body, margin: '0 0 var(--g-space-3)' }}>{g.glance.promise}</Text> : null}
          <Box style={{ ...card, padding: 'var(--g-space-4)', display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)' }}>
            {typeof g.glance.activeTimeMin === 'number' ? <Chip tone="brand">⏱️ فعال: {fa(g.glance.activeTimeMin)} دقیقه</Chip> : null}
            {typeof g.glance.totalTimeMin === 'number' ? <Chip tone="brand">⏳ کل: {fa(g.glance.totalTimeMin)} دقیقه</Chip> : null}
            {typeof g.glance.handsOffMin === 'number' ? <Chip>🤲 بی‌دخالت: {fa(g.glance.handsOffMin)} دقیقه</Chip> : null}
            {g.glance.difficulty ? <Chip>📊 {g.glance.difficulty}</Chip> : null}
            {g.glance.costBand ? <Chip>💰 {g.glance.costBand}</Chip> : null}
            {typeof g.glance.servings === 'number' || servedFor ? <Chip tone={scaled ? 'brand' : undefined}>🍽️ {fa(servedFor || g.glance.servings)} نفر{scaled ? ' (تنظیم‌شده)' : ''}</Chip> : null}
          </Box>
          {list(g.glance.keyEquipment).length ? <Text component="p" style={{ ...muted, margin: 'var(--g-space-2) 0 0' }}>🔧 ابزار: {g.glance.keyEquipment.join(' · ')}</Text> : null}
          {list(g.glance.goodFor).length ? <Text component="p" style={{ ...muted, margin: 'var(--g-space-1) 0 0' }}>👌 مناسبِ: {g.glance.goodFor.join(' · ')}</Text> : null}
        </>
      ) : null}

      {/* SKILLS */}
      {list(g.skillsLearned).length ? (
        <>
          <H2 icon={IconSchool}>مهارتی که یاد می‌گیری</H2>
          <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)' }}>
            {list(g.skillsLearned).map((s, i) => <Chip key={i} tone="brand">🎓 {s}</Chip>)}
          </Box>
        </>
      ) : null}

      {/* INGREDIENTS — grouped, with weight + role + buy-tip + swap */}
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
                  const amount = [sw != null ? `${fa(sw)}g` : null, it.volume ? scaleAmountText(it.volume, scaleFactor) : null].filter(Boolean).join(' · ');
                  const applied = swaps[display] || null; // session swap applied to this ingredient
                  const gone = removed.includes(display);
                  return (
                  <Box key={i} style={{ padding: 'var(--g-space-3) var(--g-space-4)', borderBlockStart: i ? '1px solid var(--g-color-border-subtle)' : 'none', opacity: gone ? 0.6 : 1 }}>
                    <Box style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--g-space-2)' }}>
                      <Box style={{ flex: 1, minInlineSize: 0 }}>
                        <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: applied && !gone ? 700 : 600, color: applied && !gone ? 'var(--g-color-brand-700)' : 'var(--g-color-text-primary)', textDecoration: gone ? 'line-through' : 'none' }}>{applied && !gone ? applied.to : display}{!applied && !gone && it.prepState ? <Text component="span" style={muted}> — {it.prepState}</Text> : null}</Text>
                        {applied && !gone ? <Text component="span" style={{ ...muted, marginInlineStart: 4 }}>به‌جای {display}</Text> : null}
                        {gone ? <Text component="span" style={{ ...muted, marginInlineStart: 4 }}>حذف شد</Text> : null}
                      </Box>
                      <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-1)', flexShrink: 0 }}>
                        {amount && !gone ? <Text component="span" style={{ ...muted, whiteSpace: 'nowrap' }}>{amount}</Text> : null}
                        {onAskSwap && !gone ? <UnstyledButton type="button" onClick={() => onAskSwap(display)} aria-label={`جایگزین برای ${display}`} style={{ display: 'inline-flex', alignItems: 'center', minBlockSize: 32, paddingInline: 'var(--g-space-2)', borderRadius: 'var(--g-radius-chip)', border: `1px solid ${applied ? 'var(--g-color-brand-600)' : 'var(--g-color-brand-200)'}`, background: applied ? 'var(--g-color-brand-50)' : 'transparent', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-11)', fontWeight: 600 }}>{applied ? 'تغییر' : 'جایگزین؟'}</UnstyledButton> : null}
                        {onToggleRemove ? <UnstyledButton type="button" onClick={() => onToggleRemove(display, it.role)} aria-label={gone ? `برگرداندن ${display}` : `حذف ${display}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', inlineSize: 30, minBlockSize: 32, color: gone ? 'var(--g-color-brand-600)' : 'var(--g-color-text-muted)' }}>{gone ? <IconArrowBackUp size={16} stroke={1.8} /> : <IconTrash size={15} stroke={1.8} />}</UnstyledButton> : null}
                      </Box>
                    </Box>
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

      {/* STEPS — flame / temp / time / sees / recovery / doneness */}
      {list(g.steps).length ? (
        <>
          <H2 icon={IconFlame}>روشِ پخت</H2>
          <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)' }}>
            {list(g.steps).map((s, i) => {
              const patched = patchStepText(s.instruction, swapsList(swaps), removed);
              return (
              <Box key={i} style={{ ...card, padding: 'var(--g-space-4)' }}>
                <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                  <Box aria-hidden="true" style={{ flexShrink: 0, display: 'grid', placeItems: 'center', inlineSize: 26, blockSize: 26, borderRadius: '50%', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontWeight: 800, fontSize: 'var(--g-font-size-12)' }}>{fa(s.order || i + 1)}</Box>
                  <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-15)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>{s.title}</Text>
                </Box>
                <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-1)', margin: 'var(--g-space-2) 0' }}>
                  {s.flame && s.flame !== 'none' ? <Chip><IconFlame size={13} stroke={1.8} aria-hidden="true" />{FLAME[s.flame] || s.flame}</Chip> : null}
                  {typeof s.tempC === 'number' ? <Chip><IconThermometer size={13} stroke={1.8} aria-hidden="true" />{fa(s.tempC)}°</Chip> : null}
                  {typeof s.durationMin === 'number' ? <Chip><IconClock size={13} stroke={1.8} aria-hidden="true" />{fa(s.durationMin)} دقیقه</Chip> : null}
                </Box>
                <Text component="p" style={{ ...body, margin: 0 }}>{patched.text}</Text>
                {patched.caveats.length ? <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: 'var(--g-color-brand-700)', margin: '4px 0 0' }}>↳ {patched.caveats.join(' · ')}</Text> : null}
                {s.sees ? <Line icon={IconEye}>{s.sees}</Line> : null}
                {s.doneness ? <Line icon={IconCircleCheck} tone="success">{s.doneness}</Line> : null}
                {s.tip ? <Line icon={IconBulb}>{s.tip}</Line> : null}
                {s.recovery ? <Line icon={IconLifebuoy} tone="warn">اگر خراب شد: {s.recovery}</Line> : null}
              </Box>
              );
            })}
          </Box>
        </>
      ) : null}

      {/* FINISH + chef secret */}
      {g.finish ? (
        <>
          <H2 icon={IconChefHat}>پایان و رازِ سرآشپز</H2>
          {g.finish.finalLook ? <Text component="p" style={{ ...body, margin: 0 }}>{g.finish.finalLook}</Text> : null}
          {g.finish.plating ? <Text component="p" style={{ ...body, margin: 'var(--g-space-2) 0 0' }}>🍽️ {g.finish.plating}</Text> : null}
          {g.finish.chefSecret ? (
            <Box style={{ ...card, padding: 'var(--g-space-4)', marginBlockStart: 'var(--g-space-3)', background: 'var(--g-color-brand-50)', border: '1px solid var(--g-color-brand-200)' }}>
              <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-brand-700)', margin: 0 }}>🔑 رازِ سرآشپز: {g.finish.chefSecret}</Text>
            </Box>
          ) : null}
        </>
      ) : null}

      {/* TROUBLESHOOTING / VARIATIONS / KEEP / FAQ — accordions */}
      <Box style={{ marginBlockStart: 'var(--g-space-5)' }}>
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
        {g.keep ? (
          <Accordion icon={IconArchive} title="نگه‌داری و گرم‌کردن">
            {g.keep.makeAhead ? <Text component="p" style={{ ...body, margin: '0 0 var(--g-space-1)' }}>⏲️ آماده‌سازیِ زودهنگام: {g.keep.makeAhead}</Text> : null}
            {g.keep.storage ? <Text component="p" style={{ ...body, margin: '0 0 var(--g-space-1)' }}>🧊 یخچال: {g.keep.storage}</Text> : null}
            {g.keep.reheat ? <Text component="p" style={{ ...body, margin: '0 0 var(--g-space-1)' }}>🔥 گرم‌کردن: {g.keep.reheat}</Text> : null}
            {g.keep.freeze ? <Text component="p" style={{ ...body, margin: 0 }}>❄️ فریز: {g.keep.freeze}</Text> : null}
          </Accordion>
        ) : null}
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

      {/* SERVE WITH */}
      {list(g.serveWith).length ? (
        <>
          <H2 icon={IconSparkles}>سرو با</H2>
          <Text component="p" style={{ ...body, margin: 0 }}>{list(g.serveWith).map(stripGrisIds).filter(Boolean).join(' · ')}</Text>
        </>
      ) : null}

      {/* NOURISHMENT — qualitative, non-medical */}
      {g.nourishment ? (
        <>
          <H2 icon={IconInfoCircle}>تغذیه</H2>
          {list(g.nourishment.attributes).length ? (
            <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)', marginBlockEnd: 'var(--g-space-2)' }}>
              {g.nourishment.attributes.map((a, i) => <Chip key={i} tone="brand">{a}</Chip>)}
            </Box>
          ) : null}
          {g.nourishment.note ? <Text component="p" style={{ ...body, margin: 0 }}>{g.nourishment.note}</Text> : null}
          {g.nourishment.disclaimer ? <Text component="p" style={{ ...muted, margin: 'var(--g-space-2) 0 0' }}>⚠️ {g.nourishment.disclaimer}</Text> : null}
        </>
      ) : null}
    </Box>
  );
}

function Line({ icon: Icon, tone, children }) {
  const color = tone === 'success' ? 'var(--g-color-state-success-fg)' : tone === 'warn' ? 'var(--g-color-allergen-fg)' : 'var(--g-color-text-muted)';
  return (
    <Box style={{ display: 'flex', gap: 'var(--g-space-1)', alignItems: 'flex-start', marginBlockStart: 'var(--g-space-2)' }}>
      <Icon size={14} stroke={1.8} aria-hidden="true" style={{ color, flexShrink: 0, marginBlockStart: 2 }} />
      <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)' }}>{children}</Text>
    </Box>
  );
}
