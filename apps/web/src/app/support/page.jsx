// «پشتیبانی» — user-facing support, designed to the app's GES language (rich icon-tile cards, a real chat
// thread with sender avatars, category tiles like «دستهٔ غذا»). List · conversation · new ticket. Wired to /support.
import { useState } from 'react';
import { Box, Text, UnstyledButton, Textarea, TextInput, Loader } from '@mantine/core';
import {
  IconPlus, IconArrowRight, IconSend, IconStar, IconStarFilled, IconCloudOff, IconRefresh,
  IconCircleCheck, IconMessage2, IconHeadset, IconChevronLeft, IconUserCircle, IconTool,
  IconCreditCard, IconBulb, IconBook2, IconMessageCircle2, IconLifebuoy,
} from '@tabler/icons-react';
import { useSupportList, useSupportTicket, useSupportActions } from './useSupport';
import { toFaDigits } from '../../components/ges/format';

const CAT = {
  general: { fa: 'عمومی', Icon: IconMessageCircle2 },
  account: { fa: 'حساب کاربری', Icon: IconUserCircle },
  technical: { fa: 'فنی', Icon: IconTool },
  billing: { fa: 'پرداخت', Icon: IconCreditCard },
  feature: { fa: 'پیشنهادِ ویژگی', Icon: IconBulb },
  content: { fa: 'محتوا', Icon: IconBook2 },
};
const CAT_KEYS = Object.keys(CAT);
const cat = (k) => CAT[k] || CAT.general;
const STATUS = {
  open: ['باز', 'var(--g-color-state-info-bg)', 'var(--g-color-text-secondary)'],
  pending: ['در انتظارِ پاسخ', 'var(--g-color-state-warning-bg, #fdf3e3)', 'var(--g-color-state-warning-fg, #8a5a14)'],
  in_progress: ['در حال بررسی', 'var(--g-color-brand-50)', 'var(--g-color-brand-700)'],
  resolved: ['حل‌شده', 'var(--g-color-state-success-bg)', 'var(--g-color-state-success-fg)'],
  closed: ['بسته', 'var(--g-color-bg-canvas)', 'var(--g-color-text-muted)'],
};
const PRIORITY = { low: ['کم', 'var(--g-color-text-muted)'], normal: ['عادی', 'var(--g-color-text-secondary)'], high: ['زیاد', 'var(--g-color-state-warning-fg, #c0801c)'], urgent: ['فوری', 'var(--g-color-state-danger-fg, #b3261e)'] };
const PRIORITY_KEYS = Object.keys(PRIORITY);
const CLOSED = ['resolved', 'closed'];

const ago = (d) => {
  if (!d) return '';
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'هم‌اکنون';
  if (m < 60) return toFaDigits(m) + ' دقیقه پیش';
  const h = Math.floor(m / 60);
  if (h < 24) return toFaDigits(h) + ' ساعت پیش';
  const dd = Math.floor(h / 24);
  return dd < 30 ? toFaDigits(dd) + ' روز پیش' : toFaDigits(String(d).slice(0, 10));
};

function StatusPill({ status }) {
  const [label, bg, fg] = STATUS[status] || STATUS.open;
  return <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11px', fontWeight: 700, paddingInline: 10, paddingBlock: 3, borderRadius: '999px', background: bg, color: fg, whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</Text>;
}

function IconTile({ Icon, size = 46, tone = 'brand' }) {
  const bg = tone === 'brand' ? 'var(--g-color-brand-50)' : 'var(--g-color-state-info-bg)';
  const fg = tone === 'brand' ? 'var(--g-color-brand-600)' : 'var(--g-color-text-secondary)';
  return <Box aria-hidden="true" style={{ inlineSize: size, blockSize: size, flexShrink: 0, borderRadius: 'var(--g-radius-input)', background: bg, color: fg, display: 'grid', placeItems: 'center' }}><Icon size={Math.round(size * 0.46)} stroke={1.7} /></Box>;
}

const cta = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minBlockSize: 40, paddingInline: 15, borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700 };
const fieldStyles = { input: { fontFamily: 'var(--g-font-fa)', borderRadius: 'var(--g-radius-input)' }, label: { fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 700, marginBlockEnd: 7, color: 'var(--g-color-text-primary)' } };

export default function SupportPage() {
  const [view, setView] = useState('list');
  const [selectedId, setSelectedId] = useState(null);
  const list = useSupportList();
  const openTicket = (id) => { setSelectedId(id); setView('detail'); };

  if (view === 'new') return <NewTicket onBack={() => setView('list')} onCreated={(id) => openTicket(id)} />;
  if (view === 'detail') return <Detail id={selectedId} onBack={() => { setView('list'); setSelectedId(null); }} />;

  const rows = list.data || [];
  return (
    <Box style={{ display: 'flex', flexDirection: 'column' }}>
      {/* HERO header */}
      <Box style={{ paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-3)' }}>
        <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--g-space-3)' }}>
          <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)' }}>
            <IconTile Icon={IconLifebuoy} size={44} />
            <Box>
              <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-22)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0, lineHeight: 1.2 }}>پشتیبانی</Text>
              <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', margin: '2px 0 0' }}>سؤال یا مشکلی داری؟ سریع جواب می‌دیم.</Text>
            </Box>
          </Box>
          <UnstyledButton type="button" onClick={() => setView('new')} style={cta}><IconPlus size={16} stroke={2} />تیکتِ جدید</UnstyledButton>
        </Box>
      </Box>

      {list.isLoading ? (
        <Box style={{ display: 'grid', placeItems: 'center', paddingBlock: 'var(--g-space-8)' }}><Loader color="var(--g-color-brand-600)" /></Box>
      ) : list.isError ? (
        <Empty icon={IconCloudOff} title="تیکت‌ها بارگذاری نشد" cta={<UnstyledButton type="button" onClick={() => list.refetch()} style={cta}><IconRefresh size={15} stroke={1.8} />تلاش دوباره</UnstyledButton>} />
      ) : !rows.length ? (
        <Empty icon={IconHeadset} title="هنوز تیکتی نداری" sub="هر سؤال یا مشکلی داشتی، همین‌جا بپرس — تیمِ پشتیبانی سریع جواب می‌دهد." cta={<UnstyledButton type="button" onClick={() => setView('new')} style={cta}><IconPlus size={16} stroke={2} />اولین تیکت را بزن</UnstyledButton>} />
      ) : (
        <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)', paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-2)', paddingBlockEnd: 'var(--g-space-8)' }}>
          {rows.map((t) => {
            const C = cat(t.category);
            return (
              <UnstyledButton key={t.id} type="button" onClick={() => openTicket(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', inlineSize: '100%', textAlign: 'start', padding: 'var(--g-space-3) var(--g-space-4)', borderRadius: 'var(--g-radius-card)', background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)' }}>
                <IconTile Icon={C.Icon} />
                <Box style={{ flex: 1, minInlineSize: 0 }}>
                  <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-15)', fontWeight: 700, color: 'var(--g-color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</Text>
                    <StatusPill status={t.status} />
                  </Box>
                  <Box style={{ display: 'flex', alignItems: 'center', gap: 8, marginBlockStart: 4, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)' }}>
                    <span>{C.fa}</span>
                    <span aria-hidden style={{ opacity: 0.5 }}>•</span>
                    <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><IconMessage2 size={13} stroke={1.7} />{toFaDigits(t._count?.replies ?? t.replies?.length ?? 0)}</Box>
                    <span aria-hidden style={{ opacity: 0.5 }}>•</span>
                    <span>{ago(t.lastReplyAt || t.createdAt)}</span>
                  </Box>
                </Box>
                <IconChevronLeft size={18} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)', flexShrink: 0 }} />
              </UnstyledButton>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

function Empty({ icon: Icon, title, sub, cta: ctaEl }) {
  return (
    <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingInline: 'var(--g-space-6)', paddingBlock: 'var(--g-space-8)', gap: 'var(--g-space-2)' }}>
      <Box aria-hidden="true" style={{ inlineSize: 68, blockSize: 68, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-600)', border: '1.5px solid var(--g-color-brand-200)' }}><Icon size={30} stroke={1.6} /></Box>
      <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 800, margin: 'var(--g-space-3) 0 0', color: 'var(--g-color-text-primary)' }}>{title}</Text>
      {sub ? <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', color: 'var(--g-color-text-secondary)', margin: 0, maxInlineSize: 320, lineHeight: 'var(--g-leading-body)' }}>{sub}</Text> : null}
      <Box style={{ marginBlockStart: 'var(--g-space-4)' }}>{ctaEl}</Box>
    </Box>
  );
}

const BackHeader = ({ title, onBack, right }) => (
  <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', paddingInline: 'var(--g-space-3)', paddingBlockStart: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-3)', borderBlockEnd: '1px solid var(--g-color-border-subtle)' }}>
    <UnstyledButton type="button" onClick={onBack} aria-label="بازگشت" style={{ inlineSize: 40, blockSize: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', color: 'var(--g-color-text-secondary)', flexShrink: 0 }}><IconArrowRight size={20} stroke={1.8} /></UnstyledButton>
    <Text component="h1" style={{ flex: 1, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</Text>
    {right}
  </Box>
);

function Detail({ id, onBack }) {
  const q = useSupportTicket(id);
  const { reply, close, rate } = useSupportActions();
  const [msg, setMsg] = useState('');
  const [stars, setStars] = useState(0);
  const t = q.data;

  if (q.isLoading || !t) return <Box><BackHeader title="تیکت" onBack={onBack} /><Box style={{ display: 'grid', placeItems: 'center', paddingBlock: 'var(--g-space-8)' }}><Loader color="var(--g-color-brand-600)" /></Box></Box>;

  const C = cat(t.category);
  const [pLabel, pColor] = PRIORITY[t.priority] || PRIORITY.normal;
  const thread = [{ isStaff: false, message: t.message, createdAt: t.createdAt }, ...(t.replies || [])];
  const isClosed = CLOSED.includes(t.status);
  const send = () => { if (msg.trim()) reply.mutate({ id, message: msg.trim() }, { onSuccess: () => setMsg('') }); };

  return (
    <Box style={{ display: 'flex', flexDirection: 'column' }}>
      <BackHeader title={t.subject} onBack={onBack} right={<StatusPill status={t.status} />} />

      {/* meta strip */}
      <Box style={{ display: 'flex', alignItems: 'center', gap: 8, paddingInline: 'var(--g-space-4)', paddingBlock: 'var(--g-space-3)', borderBlockEnd: '1px solid var(--g-color-border-subtle)' }}>
        <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-secondary)' }}><C.Icon size={14} stroke={1.7} style={{ color: 'var(--g-color-brand-600)' }} />{C.fa}</Box>
        <span aria-hidden style={{ color: 'var(--g-color-border-strong)' }}>|</span>
        <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: pColor, fontWeight: 600 }}>اولویت: {pLabel}</Text>
      </Box>

      {/* thread */}
      <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)', paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-4)' }}>
        {thread.map((m, i) => (
          <Box key={i} style={{ display: 'flex', gap: 'var(--g-space-2)', flexDirection: m.isStaff ? 'row' : 'row-reverse', alignItems: 'flex-end' }}>
            <Box aria-hidden="true" style={{ inlineSize: 30, blockSize: 30, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center', background: m.isStaff ? 'var(--g-color-brand-600)' : 'var(--g-color-bg-canvas)', color: m.isStaff ? 'var(--g-color-text-inverse)' : 'var(--g-color-text-secondary)', border: m.isStaff ? 'none' : '1px solid var(--g-color-border-subtle)' }}>{m.isStaff ? <IconHeadset size={16} stroke={1.8} /> : <IconUserCircle size={18} stroke={1.7} />}</Box>
            <Box style={{ maxInlineSize: '82%', padding: 'var(--g-space-3) var(--g-space-4)', borderRadius: 'var(--g-radius-card)', background: m.isStaff ? 'var(--g-color-brand-50)' : 'var(--g-color-bg-surface)', border: `1px solid ${m.isStaff ? 'var(--g-color-brand-200)' : 'var(--g-color-border-subtle)'}` }}>
              <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '10.5px', fontWeight: 700, color: m.isStaff ? 'var(--g-color-brand-700)' : 'var(--g-color-text-muted)', marginBlockEnd: 3 }}>{m.isStaff ? 'پشتیبانیِ گارنیش' : 'شما'}</Text>
              <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-primary)', whiteSpace: 'pre-wrap' }}>{m.message}</Text>
              <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '10px', color: 'var(--g-color-text-muted)', marginBlockStart: 5, textAlign: 'end' }}>{ago(m.createdAt)}</Text>
            </Box>
          </Box>
        ))}
      </Box>

      {/* composer / close / rate */}
      <Box style={{ paddingInline: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)' }}>
        {!isClosed ? (
          <>
            <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="پاسخت را بنویس…" autosize minRows={2} maxRows={6} styles={fieldStyles} />
            <Box style={{ display: 'flex', gap: 'var(--g-space-2)' }}>
              <UnstyledButton type="button" onClick={send} disabled={!msg.trim() || reply.isPending} style={{ ...cta, flex: 1, opacity: !msg.trim() ? 0.5 : 1 }}>{reply.isPending ? <Loader size={16} color="#fff" /> : <><IconSend size={16} stroke={1.8} />ارسال</>}</UnstyledButton>
              <UnstyledButton type="button" onClick={() => close.mutate({ id })} disabled={close.isPending} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minBlockSize: 40, paddingInline: 16, borderRadius: 'var(--g-radius-input)', border: '1px solid var(--g-color-border-strong)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-secondary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 600 }}>بستنِ تیکت</UnstyledButton>
            </Box>
          </>
        ) : (
          <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--g-space-2)', padding: 'var(--g-space-5) var(--g-space-4)', background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)' }}>
            {t.rating ? (
              <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--g-color-state-success-fg)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700 }}><IconCircleCheck size={19} stroke={1.8} />ممنون از امتیازت ({toFaDigits(t.rating)}/۵)</Box>
            ) : (
              <>
                <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>این پشتیبانی چطور بود؟</Text>
                <Box style={{ display: 'inline-flex', gap: 4, marginBlockStart: 2 }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <UnstyledButton key={s} type="button" onClick={() => { setStars(s); rate.mutate({ id, rating: s }); }} aria-label={`${s} ستاره`} style={{ padding: 4, color: 'var(--g-color-state-warning-fg, #e0a93b)' }}>{s <= stars ? <IconStarFilled size={28} /> : <IconStar size={28} stroke={1.7} />}</UnstyledButton>
                  ))}
                </Box>
              </>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}

function NewTicket({ onBack, onCreated }) {
  const { create } = useSupportActions();
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('normal');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const subjectOk = subject.trim().length >= 3;
  const messageOk = message.trim().length >= 10;
  const valid = subjectOk && messageOk;
  const rawErrorMessage = Array.isArray(create.error?.response?.data?.message)
    ? create.error.response.data.message.join('، ')
    : create.error?.response?.data?.message;
  const errorMessage = typeof rawErrorMessage === 'string' ? rawErrorMessage : null;
  const submit = (event) => {
    event?.preventDefault();
    if (!valid || create.isPending) return;
    create.mutate(
      { subject: subject.trim(), message: message.trim(), category, priority },
      { onSuccess: (t) => { if (t?.id) onCreated(t.id); } },
    );
  };

  return (
    <Box style={{ display: 'flex', flexDirection: 'column' }}>
      <BackHeader title="تیکتِ جدید" onBack={onBack} />
      <Box component="form" onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-5)', paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-8)' }}>
        {/* category as tiles (matches «دستهٔ غذا») */}
        <Box>
          <Text component="div" style={fieldStyles.label}>موضوع چیست؟</Text>
          <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 'var(--g-space-2)' }}>
            {CAT_KEYS.map((k) => {
              const on = category === k; const C = CAT[k];
              return (
                <UnstyledButton key={k} type="button" onClick={() => setCategory(k)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingBlock: 'var(--g-space-3)', borderRadius: 'var(--g-radius-card)', background: on ? 'var(--g-color-brand-50)' : 'var(--g-color-bg-surface)', border: `1.5px solid ${on ? 'var(--g-color-brand-400)' : 'var(--g-color-border-subtle)'}` }}>
                  <C.Icon size={22} stroke={1.7} style={{ color: on ? 'var(--g-color-brand-600)' : 'var(--g-color-text-secondary)' }} />
                  <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '12px', fontWeight: on ? 700 : 500, color: on ? 'var(--g-color-brand-700)' : 'var(--g-color-text-secondary)' }}>{C.fa}</Text>
                </UnstyledButton>
              );
            })}
          </Box>
        </Box>
        {/* priority pills */}
        <Box>
          <Text component="div" style={fieldStyles.label}>چقدر فوری است؟</Text>
          <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)' }}>
            {PRIORITY_KEYS.map((k) => {
              const on = priority === k;
              return <UnstyledButton key={k} type="button" onClick={() => setPriority(k)} style={{ minBlockSize: 38, paddingInline: 16, borderRadius: '999px', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: on ? 700 : 500, background: on ? 'var(--g-color-brand-600)' : 'var(--g-color-bg-surface)', color: on ? 'var(--g-color-text-inverse)' : 'var(--g-color-text-secondary)', border: `1px solid ${on ? 'var(--g-color-brand-600)' : 'var(--g-color-border-subtle)'}` }}>{PRIORITY[k][0]}</UnstyledButton>;
            })}
          </Box>
        </Box>
        <TextInput label="عنوان" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="کوتاه و گویا" styles={fieldStyles} maxLength={200} />
        <Textarea label="توضیح" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="مشکل یا سؤالت را کامل بنویس…" autosize minRows={4} maxRows={10} styles={fieldStyles} maxLength={5000} />
        {!valid ? <Text style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', marginBlockStart: -8 }}>عنوان باید حداقل ۳ کاراکتر و توضیح حداقل ۱۰ کاراکتر باشد.</Text> : null}
        {create.isError ? <Text role="alert" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-state-danger-fg, #b3261e)' }}>{errorMessage || 'ارسال نشد. اتصال یا ورودت را بررسی کن و دوباره تلاش کن.'}</Text> : null}
        <UnstyledButton type="submit" data-testid="support-submit-ticket" disabled={!valid || create.isPending} style={{ ...cta, minBlockSize: 50, opacity: valid ? 1 : 0.5 }}>{create.isPending ? <Loader size={18} color="#fff" /> : 'ارسالِ تیکت'}</UnstyledButton>
        <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', textAlign: 'center', margin: 0 }}>معمولاً در کمتر از یک روزِ کاری جواب می‌دهیم.</Text>
      </Box>
    </Box>
  );
}
