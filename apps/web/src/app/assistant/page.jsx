import { useState, useRef, useEffect } from 'react';
import { Box, Text, UnstyledButton } from '@mantine/core';
import {
  IconSparkles, IconEdit, IconArrowUp, IconChevronLeft, IconInfoCircle, IconArrowsExchange,
  IconFridge, IconSalad, IconThumbUp, IconThumbDown, IconCloudOff, IconRefresh,
} from '@tabler/icons-react';
import { useAssistant } from './useAssistant';

const STARTER_ICONS = { sub: IconArrowsExchange, cook: IconFridge, light: IconSalad };

function AiGlyph({ small }) {
  return (
    <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', marginBlockEnd: small ? 'var(--g-space-2)' : 0 }}>
      <Box aria-hidden="true" style={{ inlineSize: small ? 22 : 40, blockSize: small ? 22 : 40, borderRadius: '50%', background: 'var(--g-color-ai-glow)', color: 'var(--g-color-brand-600)', display: 'grid', placeItems: 'center', boxShadow: '0 0 0 1px var(--g-color-brand-200)' }}><IconSparkles size={small ? 12 : 21} stroke={1.8} /></Box>
      {small ? <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--g-color-brand-700)' }}>AI</Text> : null}
    </Box>
  );
}

function FeedbackRow({ value, onUp, onDown }) {
  const btn = (active, activeFg, activeBg) => ({ inlineSize: 44, blockSize: 44, display: 'grid', placeItems: 'center', borderRadius: '50%', border: `1px solid ${active ? activeFg : 'var(--g-color-border-subtle)'}`, background: active ? activeBg : 'var(--g-color-bg-surface)', color: active ? activeFg : 'var(--g-color-text-secondary)' });
  return (
    <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-3)', paddingBlockStart: 'var(--g-space-2)', borderBlockStart: '1px solid var(--g-color-border-subtle)' }}>
      <UnstyledButton type="button" onClick={onUp} aria-label="مفید بود" aria-pressed={value === 'up'} style={btn(value === 'up', 'var(--g-color-state-success-fg)', 'var(--g-color-state-success-bg)')}><IconThumbUp size={16} stroke={1.8} /></UnstyledButton>
      <UnstyledButton type="button" onClick={onDown} aria-label="مفید نبود" aria-pressed={value === 'down'} style={btn(value === 'down', 'var(--g-color-state-danger-fg)', 'var(--g-color-state-danger-bg)')}><IconThumbDown size={16} stroke={1.8} /></UnstyledButton>
      {value ? <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)' }}>ممنون از بازخوردت</Text> : null}
    </Box>
  );
}

export default function AssistantPage() {
  const a = useAssistant();
  const [draft, setDraft] = useState('');
  const mainRef = useRef(null);
  useEffect(() => { const el = mainRef.current; if (el) el.scrollTop = el.scrollHeight; }, [a.messages, a.thinking, a.error]);

  const submit = () => { const t = draft.trim(); if (!t) return; a.send(t); setDraft(''); };

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', flex: 1, minBlockSize: 0 }}>
      {/* disclosure header */}
      <Box style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-3)', paddingBlockEnd: 'var(--g-space-3)', borderBlockEnd: '1px solid var(--g-color-border-subtle)' }}>
        <AiGlyph />
        <Box style={{ flex: 1, minInlineSize: 0 }}>
          <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-1)' }}>
            <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>دستیار گارنیش</Text>
            <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--g-color-brand-700)', background: 'var(--g-color-brand-50)', paddingInline: 6, paddingBlock: 1, borderRadius: 'var(--g-radius-chip)' }}>AI</Text>
          </Box>
          <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', margin: '2px 0 0' }}>ممکنه اشتباه کنه — برای ایده و کمک، نه توصیهٔ پزشکی</Text>
        </Box>
        <UnstyledButton type="button" onClick={a.reset} aria-label="گفتگوی تازه" style={{ flexShrink: 0, inlineSize: 44, blockSize: 44, borderRadius: '50%', border: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-secondary)', display: 'grid', placeItems: 'center' }}><IconEdit size={18} stroke={1.8} /></UnstyledButton>
      </Box>

      {/* thread / starter */}
      <Box ref={mainRef} style={{ flex: 1, overflowY: 'auto', paddingInline: 'var(--g-space-4)', paddingBlock: 'var(--g-space-4)' }}>
        {a.isEmpty ? (
          <>
            <Box style={{ textAlign: 'center', paddingBlock: 'var(--g-space-5)' }}>
              <Box aria-hidden="true" style={{ inlineSize: 60, blockSize: 60, margin: '0 auto', borderRadius: 'var(--g-radius-card)', display: 'grid', placeItems: 'center', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-600)', border: '1px solid var(--g-color-brand-200)' }}><IconSparkles size={28} stroke={1.8} /></Box>
              <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 'var(--g-space-3) 0 0' }}>چطور کمکت کنم؟</Text>
              <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-secondary)', margin: 'var(--g-space-1) 0 0' }}>جایگزین، تنظیمِ دستور، ایدهٔ شام یا برنامهٔ هفته.</Text>
            </Box>
            <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-3)' }}>
              {a.starters.map((s) => {
                const Icon = STARTER_ICONS[s.id] || IconSparkles;
                return (
                  <UnstyledButton key={s.id} type="button" onClick={() => a.send(s.text)} style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', inlineSize: '100%', minBlockSize: 52, paddingInline: 'var(--g-space-4)', background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)', boxShadow: 'var(--g-shadow-1)' }}>
                    <Icon size={18} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} />
                    <Text component="span" style={{ flex: 1, textAlign: 'start', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600, color: 'var(--g-color-text-primary)' }}>{s.text}</Text>
                    <IconChevronLeft size={16} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)' }} />
                  </UnstyledButton>
                );
              })}
            </Box>
          </>
        ) : (
          <>
            {a.messages.map((m, i) => (m.role === 'user' ? (
              <Box key={i} style={{ display: 'flex', justifyContent: 'flex-start', marginBlockEnd: 'var(--g-space-4)' }}>
                <Box style={{ maxInlineSize: '82%', background: 'var(--g-color-brand-50)', color: 'var(--g-color-text-primary)', borderRadius: 'var(--g-radius-card)', borderStartEndRadius: 4, paddingInline: 'var(--g-space-4)', paddingBlock: 'var(--g-space-3)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 500, lineHeight: 'var(--g-leading-body)' }}>{m.text}</Box>
              </Box>
            ) : (
              <Box key={i} style={{ marginBlockEnd: 'var(--g-space-4)' }}>
                <AiGlyph small />
                <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-primary)', margin: 0, whiteSpace: 'pre-wrap' }}>{m.text}</Text>
                <Text component="p" style={{ display: 'flex', gap: 'var(--g-space-1)', alignItems: 'flex-start', margin: 'var(--g-space-2) 0 0', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-muted)' }}>
                  <IconInfoCircle size={13} stroke={1.8} aria-hidden="true" style={{ flexShrink: 0, marginBlockStart: 1 }} />پاسخِ AI ممکن است اشتباه کند.
                </Text>
                <FeedbackRow value={a.feedback[i]} onUp={() => a.rate(i, 'up')} onDown={() => a.rate(i, 'down')} />
              </Box>
            )))}
            {a.thinking ? (
              <Box style={{ marginBlockEnd: 'var(--g-space-4)' }}>
                <AiGlyph small />
                <Box className="g-skeleton" style={{ blockSize: 11, inlineSize: '88%', borderRadius: 'var(--g-radius-input)', marginBlockEnd: 'var(--g-space-2)' }} />
                <Box className="g-skeleton" style={{ blockSize: 11, inlineSize: '64%', borderRadius: 'var(--g-radius-input)' }} />
                <Text component="span" style={{ display: 'block', marginBlockStart: 'var(--g-space-2)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)' }}>در حال فکر…</Text>
              </Box>
            ) : null}
            {a.error ? (
              <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 'var(--g-space-1)', paddingBlock: 'var(--g-space-5)' }}>
                <Box aria-hidden="true" style={{ inlineSize: 48, blockSize: 48, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--g-color-state-info-bg)', color: 'var(--g-color-text-secondary)' }}><IconCloudOff size={22} stroke={1.6} /></Box>
                <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-primary)', margin: 'var(--g-space-1) 0 0' }}>دستیار در دسترس نیست</Text>
                <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-secondary)', margin: 0 }}>یه لحظه دیگه دوباره بپرس.</Text>
                <UnstyledButton type="button" onClick={a.retry} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 44, paddingInline: 'var(--g-space-4)', marginBlockStart: 'var(--g-space-2)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 700 }}><IconRefresh size={15} stroke={1.8} aria-hidden="true" />تلاش دوباره</UnstyledButton>
              </Box>
            ) : null}
          </>
        )}
      </Box>

      {/* composer */}
      <Box style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-2)', paddingBlockEnd: 'calc(var(--g-space-2) + env(safe-area-inset-bottom))', background: 'var(--g-color-bg-surface-raised)', borderBlockStart: '1px solid var(--g-color-border-subtle)' }}>
        <Box component="input" type="text" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder="هرچی خواستی بپرس…" aria-label="پیام به دستیار" style={{ flex: 1, minInlineSize: 0, blockSize: 46, paddingInline: 'var(--g-space-4)', background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-chip)', outline: 'none', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', color: 'var(--g-color-text-primary)' }} />
        <UnstyledButton type="button" onClick={submit} aria-label="بفرست" disabled={a.thinking || !draft.trim()} style={{ inlineSize: 46, blockSize: 46, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '50%', background: draft.trim() ? 'var(--g-color-brand-600)' : 'var(--g-color-border-strong)', color: draft.trim() ? 'var(--g-color-text-inverse)' : 'var(--g-color-text-muted)' }}><IconArrowUp size={20} stroke={2} /></UnstyledButton>
      </Box>
    </Box>
  );
}
