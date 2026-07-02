import { useState, useRef, useEffect } from 'react';
import { Box, Text, UnstyledButton, Drawer } from '@mantine/core';
import {
  IconSparkles, IconEdit, IconArrowUp, IconChevronLeft, IconInfoCircle, IconArrowsExchange,
  IconFridge, IconSalad, IconThumbUp, IconThumbDown, IconCloudOff, IconRefresh, IconShieldCheck, IconCheck,
  IconMessages, IconTrash, IconPencil, IconPlus, IconX,
} from '@tabler/icons-react';
import { useAssistant } from './useAssistant';

const drawerIconBtn = { flexShrink: 0, inlineSize: 36, blockSize: 36, display: 'grid', placeItems: 'center', borderRadius: 'var(--g-radius-input)', border: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-secondary)' };

/** The conversation threads sidebar — list / new / open / inline-rename / confirm-delete. */
function ConversationsDrawer({ a, opened, onClose }) {
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [confirmDelId, setConfirmDelId] = useState(null);
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size={300}
      title="گفتگوها"
      styles={{ title: { fontFamily: 'var(--g-font-fa)', fontWeight: 800, fontSize: 'var(--g-font-size-16)', color: 'var(--g-color-text-primary)' }, body: { padding: 'var(--g-space-3)' } }}
    >
      <UnstyledButton type="button" onClick={() => { a.newChat(); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', inlineSize: '100%', minBlockSize: 46, paddingInline: 'var(--g-space-3)', marginBlockEnd: 'var(--g-space-3)', borderRadius: 'var(--g-radius-card)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontWeight: 700, fontSize: 'var(--g-font-size-14)' }}>
        <IconPlus size={18} stroke={2} aria-hidden="true" />گفتگوی تازه
      </UnstyledButton>
      {a.conversations.length === 0 ? (
        <Text style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', color: 'var(--g-color-text-muted)', textAlign: 'center', paddingBlock: 'var(--g-space-4)' }}>هنوز گفتگویی نداری.</Text>
      ) : (
        <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)' }}>
          {a.conversations.map((c) => {
            const active = c.id === a.convId;
            if (editingId === c.id) {
              const save = () => { a.renameConversation(c.id, editTitle); setEditingId(null); };
              return (
                <Box key={c.id} style={{ display: 'flex', gap: 'var(--g-space-1)', alignItems: 'center' }}>
                  <Box component="input" autoFocus value={editTitle} onChange={(e) => setEditTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditingId(null); }} aria-label="نام گفتگو" style={{ flex: 1, minInlineSize: 0, blockSize: 40, paddingInline: 'var(--g-space-2)', borderRadius: 'var(--g-radius-input)', border: '1px solid var(--g-color-brand-400)', outline: 'none', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', color: 'var(--g-color-text-primary)' }} />
                  <UnstyledButton type="button" onClick={save} aria-label="ذخیرهٔ نام" style={drawerIconBtn}><IconCheck size={16} stroke={2} /></UnstyledButton>
                </Box>
              );
            }
            return (
              <Box key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-1)', borderRadius: 'var(--g-radius-card)', background: active ? 'var(--g-color-brand-50)' : 'var(--g-color-bg-surface)', border: `1px solid ${active ? 'var(--g-color-brand-200)' : 'var(--g-color-border-subtle)'}`, paddingInline: 'var(--g-space-2)' }}>
                <UnstyledButton type="button" onClick={() => { a.openConversation(c.id); onClose(); }} style={{ flex: 1, minInlineSize: 0, textAlign: 'start', paddingBlock: 'var(--g-space-2)' }}>
                  <Text style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title || 'گفتگوی بی‌نام'}</Text>
                  {c.preview ? <Text style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBlockStart: 2 }}>{c.preview}</Text> : null}
                </UnstyledButton>
                {confirmDelId === c.id ? (
                  <>
                    <UnstyledButton type="button" onClick={() => { a.deleteConversation(c.id); setConfirmDelId(null); }} aria-label="تأیید حذف" style={{ ...drawerIconBtn, color: 'var(--g-color-state-danger-fg)', borderColor: 'var(--g-color-state-danger-fg)' }}><IconCheck size={16} stroke={2} /></UnstyledButton>
                    <UnstyledButton type="button" onClick={() => setConfirmDelId(null)} aria-label="انصراف" style={drawerIconBtn}><IconX size={16} stroke={2} /></UnstyledButton>
                  </>
                ) : (
                  <>
                    <UnstyledButton type="button" onClick={() => { setEditingId(c.id); setEditTitle(c.title || ''); }} aria-label="تغییر نام" style={drawerIconBtn}><IconPencil size={15} stroke={1.8} /></UnstyledButton>
                    <UnstyledButton type="button" onClick={() => setConfirmDelId(c.id)} aria-label="حذف گفتگو" style={drawerIconBtn}><IconTrash size={15} stroke={1.8} /></UnstyledButton>
                  </>
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </Drawer>
  );
}

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

// While the assistant works, cycle a changing status so a slow turn FEELS like active effort (not a frozen spinner).
// Escalating, not looping — the later lines acknowledge the wait. (A future version can stream the real tool steps.)
const THINKING_STEPS = [
  'در حال فکر کردن…',
  'دارم بینِ غذاها و دستورها می‌گردم…',
  'دارم گزینه‌های خوب رو برات جمع می‌کنم…',
  'یه کم طول می‌کشه — دارم با دقت آماده‌اش می‌کنم…',
  'ممنون که صبر می‌کنی، کارهای بیشتری دارم انجام می‌دم…',
  'تقریباً آماده‌ست، یه لحظهٔ دیگه…',
];

function ThinkingStatus() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => Math.min(x + 1, THINKING_STEPS.length - 1)), 3500);
    return () => clearInterval(id);
  }, []);
  return (
    <Text component="span" style={{ display: 'block', marginBlockStart: 'var(--g-space-2)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', transition: 'opacity 0.2s' }}>{THINKING_STEPS[i]}</Text>
  );
}

export default function AssistantPage() {
  const a = useAssistant();
  const [draft, setDraft] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mainRef = useRef(null);
  useEffect(() => { const el = mainRef.current; if (el) el.scrollTop = el.scrollHeight; }, [a.messages, a.thinking, a.error]);

  const submit = () => { const t = draft.trim(); if (!t) return; a.send(t); setDraft(''); };

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', flex: 1, minBlockSize: 0 }}>
      <ConversationsDrawer a={a} opened={drawerOpen} onClose={() => setDrawerOpen(false)} />
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
        <UnstyledButton type="button" onClick={() => setDrawerOpen(true)} aria-label="گفتگوها" style={{ flexShrink: 0, inlineSize: 44, blockSize: 44, borderRadius: '50%', border: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-secondary)', display: 'grid', placeItems: 'center' }}><IconMessages size={18} stroke={1.8} /></UnstyledButton>
        <UnstyledButton type="button" onClick={a.newChat} aria-label="گفتگوی تازه" style={{ flexShrink: 0, inlineSize: 44, blockSize: 44, borderRadius: '50%', border: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-secondary)', display: 'grid', placeItems: 'center' }}><IconEdit size={18} stroke={1.8} /></UnstyledButton>
      </Box>

      {/* thread / starter — live region so a screen-reader hears the assistant's reply + thinking state */}
      <Box ref={mainRef} aria-live="polite" aria-busy={a.thinking ? 'true' : 'false'} style={{ flex: 1, overflowY: 'auto', paddingInline: 'var(--g-space-4)', paddingBlock: 'var(--g-space-4)' }}>
        {a.isEmpty ? (
          <>
            <Box style={{ textAlign: 'center', paddingBlock: 'var(--g-space-5)' }}>
              <Box aria-hidden="true" style={{ inlineSize: 60, blockSize: 60, margin: '0 auto', borderRadius: 'var(--g-radius-card)', display: 'grid', placeItems: 'center', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-600)', border: '1px solid var(--g-color-brand-200)' }}><IconSparkles size={28} stroke={1.8} /></Box>
              <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 'var(--g-space-3) 0 0' }}>{a.opener?.greeting || 'چطور کمکت کنم؟'}</Text>
              <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-secondary)', margin: 'var(--g-space-1) 0 0' }}>جایگزین، تنظیمِ دستور، ایدهٔ شام یا برنامهٔ هفته.</Text>
            </Box>
            {/* PROACTIVE opener — a data-grounded suggestion surfaced on entry; tap sends its prompt to the assistant. */}
            {a.opener?.suggestion ? (
              <UnstyledButton type="button" onClick={() => a.send(a.opener.suggestion.prompt)} style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', inlineSize: '100%', minBlockSize: 60, paddingInline: 'var(--g-space-4)', paddingBlock: 'var(--g-space-3)', marginBlockStart: 'var(--g-space-3)', background: 'var(--g-color-ai-glow, var(--g-color-brand-50))', border: '1px solid var(--g-color-brand-200)', borderRadius: 'var(--g-radius-card)', boxShadow: 'var(--g-shadow-1)' }}>
                <Box aria-hidden="true" style={{ flexShrink: 0, inlineSize: 32, blockSize: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)' }}><IconSparkles size={17} stroke={1.8} /></Box>
                <Box style={{ flex: 1, minInlineSize: 0, textAlign: 'start' }}>
                  <Text component="span" style={{ display: 'block', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-11)', fontWeight: 700, color: 'var(--g-color-brand-700)', marginBlockEnd: 2 }}>پیشنهادِ من برات</Text>
                  <Text component="span" style={{ display: 'block', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600, color: 'var(--g-color-text-primary)', lineHeight: 'var(--g-leading-body)' }}>{a.opener.suggestion.text}</Text>
                </Box>
                <IconChevronLeft size={18} stroke={1.8} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--g-color-brand-600)' }} />
              </UnstyledButton>
            ) : null}
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
                {/* §3 conversational-allergy: one-tap confirm-then-write. The user must tap to save (decision D2). */}
                {m.suggestedAction && m.suggestedAction.type === 'add_allergy' && !a.added?.[i] ? (
                  <UnstyledButton type="button" onClick={() => a.confirmAllergens(i, m.suggestedAction.allergens)} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 44, paddingInline: 'var(--g-space-4)', marginBlockStart: 'var(--g-space-2)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 700 }}>
                    <IconShieldCheck size={15} stroke={1.8} aria-hidden="true" />افزودن به آلرژی‌هام
                  </UnstyledButton>
                ) : null}
                {m.suggestedAction && m.suggestedAction.type === 'remove_allergy' && !a.removed?.[i] ? (
                  <UnstyledButton type="button" onClick={() => a.removeAllergens(i, m.suggestedAction.allergens)} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 44, paddingInline: 'var(--g-space-4)', marginBlockStart: 'var(--g-space-2)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-state-danger-bg)', color: 'var(--g-color-state-danger-fg)', border: '1px solid var(--g-color-state-danger-fg)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 700 }}>
                    <IconTrash size={15} stroke={1.8} aria-hidden="true" />حذف از آلرژی‌ها
                  </UnstyledButton>
                ) : null}
                {a.added?.[i] ? (
                  <Text component="span" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', marginBlockStart: 'var(--g-space-2)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700, color: 'var(--g-color-state-success-text, var(--g-color-brand-600))' }}>
                    <IconCheck size={14} stroke={2} aria-hidden="true" />به آلرژی‌هات اضافه شد
                  </Text>
                ) : null}
                {a.removed?.[i] ? (
                  <Text component="span" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', marginBlockStart: 'var(--g-space-2)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700, color: 'var(--g-color-state-success-text, var(--g-color-brand-600))' }}>
                    <IconCheck size={14} stroke={2} aria-hidden="true" />از آلرژی‌ها حذف شد
                  </Text>
                ) : null}
                <FeedbackRow value={a.feedback[i]} onUp={() => a.rate(i, 'up')} onDown={() => a.rate(i, 'down')} />
              </Box>
            )))}
            {a.thinking ? (
              <Box style={{ marginBlockEnd: 'var(--g-space-4)' }}>
                <AiGlyph small />
                <Box className="g-skeleton" style={{ blockSize: 11, inlineSize: '88%', borderRadius: 'var(--g-radius-input)', marginBlockEnd: 'var(--g-space-2)' }} />
                <Box className="g-skeleton" style={{ blockSize: 11, inlineSize: '64%', borderRadius: 'var(--g-radius-input)' }} />
                <ThinkingStatus />
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
