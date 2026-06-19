import { useState, useEffect } from 'react';
import { Box, Drawer, Text, UnstyledButton } from '@mantine/core';
import { IconSparkles, IconUsers, IconReplace, IconClock, IconInfoCircle, IconChevronLeft, IconMinus, IconPlus, IconCheck } from '@tabler/icons-react';
import { toFaDigits } from './format';
import { bottomSheetStyles } from './sheet';
import apiClient from '../../lib/apiClient';

/**
 * AISheet — "برای من تنظیمش کن": a disclosed, hedged, IN-CONTEXT bottom sheet to tune the recipe.
 *
 * DISCLOSED (AI glyph + "AI"), HEDGED ("AI can be wrong; nutrition shows its source), and strictly
 * PROPOSES — it NEVER auto-applies and NEVER navigates away to the generic assistant. Tuning servings
 * is a real, deterministic proposal the user confirms with «بله، اعمال کن» / «بی‌خیال» (the page applies
 * it locally). Swaps/timing are shown honestly as step-by-step help that lives in Cook Mode — no
 * fabricated AI answer, no navigation. Mantine Drawer gives focus-trap / ESC / overlay-close.
 */
const OPTIONS = [
  { key: 'servings', label: 'تنظیم تعداد نفرات', Icon: IconUsers },
  { key: 'swap', label: 'جایگزینِ مواد', Icon: IconReplace },
  { key: 'time', label: 'تنظیم زمان', Icon: IconClock },
];

const Disclosure = () => (
  <Box style={{ display: 'flex', gap: 'var(--g-space-2)', alignItems: 'flex-start', marginBlockStart: 'var(--g-space-4)' }}>
    <IconInfoCircle size={14} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)', flexShrink: 0, marginBlockStart: 2 }} />
    <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-muted)', margin: 0 }}>
      پاسخِ هوش مصنوعی ممکن است اشتباه کند و هر تغییری پیش از اعمال از تو می‌پرسد. اعداد ارزش غذایی همیشه با منبع نشان داده می‌شوند.
    </Text>
  </Box>
);

export default function AISheet({ opened, onClose, recipeTitle, baseServings = 4, onApplyServings, ingredients = [] }) {
  const [mode, setMode] = useState(null); // null = menu · 'servings' | 'swap' | 'time' = proposal
  const [servings, setServings] = useState(baseServings);
  const [swap, setSwap] = useState({ ingredient: null, loading: false, items: null });

  const ingNames = (Array.isArray(ingredients) ? ingredients : [])
    .map((i) => (typeof i === 'string' ? i : i?.name)).filter(Boolean);

  // Reopen always starts on the menu, seeded from the recipe's current servings.
  useEffect(() => {
    if (opened) { setMode(null); setServings(baseServings > 0 ? baseServings : 4); setSwap({ ingredient: null, loading: false, items: null }); }
  }, [opened, baseServings]);

  const applyServings = () => { onApplyServings?.(servings); onClose?.(); };

  // real grounded substitution for the picked ingredient → POST /ai/substitutions (deterministic, no live LLM)
  const askSwap = async (name) => {
    if (!name) return;
    setSwap({ ingredient: name, loading: true, items: null });
    try {
      const { data } = await apiClient.post('/ai/substitutions', { ingredient: name, limit: 5 });
      const items = Array.isArray(data?.substitutions)
        ? data.substitutions.map((s) => (typeof s === 'string' ? s : s?.name)).filter(Boolean)
        : [];
      setSwap({ ingredient: name, loading: false, items });
    } catch {
      setSwap({ ingredient: name, loading: false, items: [] });
    }
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="bottom"
      zIndex={400}
      withCloseButton
      closeButtonProps={{ 'aria-label': 'بستن', size: 'lg' }}
      overlayProps={{ backgroundOpacity: 0.42, blur: 1 }}
      transitionProps={{ transition: 'slide-up', duration: 240 }}
      title={
        <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
          <Box aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', inlineSize: 24, blockSize: 24, borderRadius: '50%', background: 'var(--g-color-ai-glow)', color: 'var(--g-color-brand-600)', boxShadow: '0 0 0 1px var(--g-color-brand-200)' }}>
            <IconSparkles size={13} stroke={1.8} />
          </Box>
          <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--g-color-brand-700)' }}>AI</Text>
        </Box>
      }
      styles={bottomSheetStyles({
        content: { height: 'auto', maxHeight: '85vh', borderStartStartRadius: 'var(--g-radius-sheet)', borderStartEndRadius: 'var(--g-radius-sheet)', background: 'var(--g-color-bg-surface)' },
        header: { background: 'var(--g-color-bg-surface)' },
        body: { paddingInline: 'var(--g-space-5)', paddingBlockEnd: 'var(--g-space-6)' },
      })}
    >
      {recipeTitle ? (
        <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', paddingInline: 'var(--g-space-3)', paddingBlock: 5, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600 }}>
          دربارهٔ: {recipeTitle}
        </Box>
      ) : null}

      {/* ── menu ── */}
      {mode === null ? (
        <>
          <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-4)' }}>
            {OPTIONS.map(({ key, label, Icon }) => (
              <UnstyledButton
                key={key}
                type="button"
                onClick={() => setMode(key)}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', minBlockSize: 52, paddingInline: 'var(--g-space-4)', borderRadius: 'var(--g-radius-input)', border: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface)' }}
              >
                <Icon size={20} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)', flexShrink: 0 }} />
                <Text component="span" style={{ flex: 1, textAlign: 'start', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600, color: 'var(--g-color-text-primary)' }}>{label}</Text>
                <IconChevronLeft size={18} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)' }} />
              </UnstyledButton>
            ))}
          </Box>
          <Disclosure />
        </>
      ) : null}

      {/* ── servings proposal (real, deterministic, propose-not-auto) ── */}
      {mode === 'servings' ? (
        <Box style={{ marginBlockStart: 'var(--g-space-4)' }}>
          <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-primary)', margin: 0 }}>برای چند نفر تنظیمش کنم؟</Text>
          <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--g-space-4)', marginBlockStart: 'var(--g-space-4)' }}>
            <UnstyledButton type="button" onClick={() => setServings((n) => Math.max(1, n - 1))} aria-label="کمتر" style={{ inlineSize: 44, blockSize: 44, borderRadius: '50%', border: '1px solid var(--g-color-border-strong)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><IconMinus size={18} stroke={2} /></UnstyledButton>
            <Text component="span" aria-live="polite" style={{ minInlineSize: 64, textAlign: 'center', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-22)', fontWeight: 800, color: 'var(--g-color-text-primary)' }}>{toFaDigits(servings)} نفر</Text>
            <UnstyledButton type="button" onClick={() => setServings((n) => Math.min(20, n + 1))} aria-label="بیشتر" style={{ inlineSize: 44, blockSize: 44, borderRadius: '50%', border: '1px solid var(--g-color-border-strong)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><IconPlus size={18} stroke={2} /></UnstyledButton>
          </Box>
          <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-muted)', margin: 'var(--g-space-3) 0 0', textAlign: 'center' }}>مقدار مواد را به‌نسبت در نظر بگیر — پیشنهاد است، خودکار چیزی عوض نمی‌شود.</Text>
          <Box style={{ display: 'flex', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-4)' }}>
            <UnstyledButton type="button" onClick={() => setMode(null)} style={{ flex: 1, minBlockSize: 48, borderRadius: 'var(--g-radius-input)', border: '1px solid var(--g-color-border-strong)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-primary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600 }}>بی‌خیال</UnstyledButton>
            <UnstyledButton type="button" onClick={applyServings} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--g-space-1)', minBlockSize: 48, borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700 }}><IconCheck size={16} stroke={2} aria-hidden="true" />بله، اعمال کن</UnstyledButton>
          </Box>
        </Box>
      ) : null}

      {/* ── swap: REAL grounded substitutions (POST /ai/substitutions) — pick an ingredient, see same-role swaps ── */}
      {mode === 'swap' ? (
        <Box style={{ marginBlockStart: 'var(--g-space-4)' }}>
          <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-primary)', margin: 0 }}>کدام ماده را جایگزین کنم؟</Text>
          {ingNames.length ? (
            <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-3)' }}>
              {ingNames.map((n, i) => {
                const active = swap.ingredient === n;
                return (
                  <UnstyledButton key={`${n}-${i}`} type="button" onClick={() => askSwap(n)} aria-pressed={active} style={{ minBlockSize: 40, paddingInline: 'var(--g-space-3)', display: 'inline-flex', alignItems: 'center', borderRadius: 'var(--g-radius-chip)', border: `1px solid ${active ? 'var(--g-color-brand-600)' : 'var(--g-color-border-strong)'}`, background: active ? 'var(--g-color-brand-50)' : 'var(--g-color-bg-surface)', color: active ? 'var(--g-color-brand-700)' : 'var(--g-color-text-secondary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 600 }}>{n}</UnstyledButton>
                );
              })}
            </Box>
          ) : (
            <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', color: 'var(--g-color-text-muted)', margin: 'var(--g-space-2) 0 0' }}>موادی برای جایگزینی پیدا نشد.</Text>
          )}

          {swap.ingredient ? (
            <Box style={{ marginBlockStart: 'var(--g-space-4)', padding: 'var(--g-space-4)', borderRadius: 'var(--g-radius-card)', background: 'var(--g-color-ai-surface)', border: 'var(--g-border-ai)' }}>
              {swap.loading ? (
                <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', color: 'var(--g-color-text-secondary)', margin: 0 }}>در حال یافتنِ جایگزین برای «{swap.ingredient}»…</Text>
              ) : swap.items?.length ? (
                <>
                  <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600, color: 'var(--g-color-text-primary)', margin: '0 0 var(--g-space-2)' }}>به‌جای «{swap.ingredient}» می‌تونی استفاده کنی:</Text>
                  <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)' }}>
                    {swap.items.map((it, i) => (
                      <Box key={`${it}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, paddingInline: 'var(--g-space-3)', paddingBlock: 'var(--g-space-2)', borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600 }}>
                        <IconReplace size={15} stroke={1.8} aria-hidden="true" />{it}
                      </Box>
                    ))}
                  </Box>
                </>
              ) : (
                <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', color: 'var(--g-color-text-secondary)', margin: 0 }}>برای «{swap.ingredient}» جایگزینِ هم‌نقشی در پایگاه پیدا نشد.</Text>
              )}
            </Box>
          ) : null}

          <Box style={{ display: 'flex', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-4)' }}>
            <UnstyledButton type="button" onClick={() => setMode(null)} style={{ flex: 1, minBlockSize: 48, borderRadius: 'var(--g-radius-input)', border: '1px solid var(--g-color-border-strong)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-primary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600 }}>باشه</UnstyledButton>
          </Box>
          <Disclosure />
        </Box>
      ) : null}

      {/* ── time: honest in-context (timing help lives step-by-step in Cook Mode) ── */}
      {mode === 'time' ? (
        <Box style={{ marginBlockStart: 'var(--g-space-4)' }}>
          <Box style={{ display: 'flex', gap: 'var(--g-space-2)', alignItems: 'flex-start', padding: 'var(--g-space-4)', borderRadius: 'var(--g-radius-card)', background: 'var(--g-color-ai-surface)', border: 'var(--g-border-ai)' }}>
            <IconSparkles size={16} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)', flexShrink: 0, marginBlockStart: 1 }} />
            <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-primary)', margin: 0 }}>
              زمان‌ها رو سرِ پخت، مرحله‌به‌مرحله کنارت تنظیم می‌کنم — با تأیید خودت، نه خودکار.
            </Text>
          </Box>
          <Box style={{ display: 'flex', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-4)' }}>
            <UnstyledButton type="button" onClick={() => setMode(null)} style={{ flex: 1, minBlockSize: 48, borderRadius: 'var(--g-radius-input)', border: '1px solid var(--g-color-border-strong)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-primary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600 }}>باشه</UnstyledButton>
          </Box>
          <Disclosure />
        </Box>
      ) : null}
    </Drawer>
  );
}
