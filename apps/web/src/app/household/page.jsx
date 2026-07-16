import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, UnstyledButton } from '@mantine/core';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  IconAlertTriangle,
  IconCalendarWeek,
  IconCheck,
  IconChevronLeft,
  IconCloudOff,
  IconHome,
  IconPackageOff,
  IconPlayerPlay,
  IconPlayerStop,
  IconPlus,
  IconRefresh,
  IconShoppingCart,
  IconTrash,
  IconUserPlus,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import Toast from '../../components/ges/Toast';
import { toFaDigits } from '../../components/ges/format';
import { useAuth } from '../../context/AuthContext';
import { riseIn, withReducedMotion } from '../../lib/motion';
import { isHouseholdV1Enabled } from './feature';
import { useHousehold } from './useHousehold';
import styles from './household.module.css';

const PURCHASABLE_ITEM_STATES = new Set(['NEEDED', 'SUBSTITUTION_APPROVED']);
const UNAVAILABLE_ITEM_STATES = new Set(['NEEDED', 'SUBSTITUTION_APPROVED']);
const TERMINAL_ITEM_STATES = new Set(['BOUGHT', 'SKIPPED']);
const STATUS_COPY = {
  NEEDED: 'برای خرید',
  DECISION_PENDING: 'منتظر تصمیم',
  SUBSTITUTION_APPROVED: 'جایگزین تأیید شد',
  BOUGHT: 'خریده شد',
  SKIPPED: 'رد شد',
};

function normalizePhone(value) {
  return String(value || '')
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[\s()-]/g, '');
}

function isMobile(value) {
  return /^(?:\+98|0098|98|0)?9\d{9}$/.test(normalizePhone(value));
}

function LoadingState() {
  return (
    <Box className={styles.content} role="status" aria-busy="true" aria-label="در حال آماده‌کردن خانه">
      {[0, 1, 2].map((item) => <Box key={item} className={`${styles.skeleton} g-skeleton`} />)}
    </Box>
  );
}

function FeatureUnavailable({ onBack }) {
  return (
    <Box className={styles.centerState}>
      <Box className={styles.unavailableIcon} aria-hidden="true"><IconHome size={27} stroke={1.7} /></Box>
      <Text component="h1" className={styles.title}>خرید مشترک هنوز فعال نیست</Text>
      <Text component="p" className={styles.body} style={{ marginBlockStart: 'var(--g-space-2)', maxInlineSize: '32ch' }}>
        این قابلیت در این نسخه فعال نشده؛ لیست خرید فعلی بدون تغییر در دسترس توست.
      </Text>
      <UnstyledButton type="button" className={styles.primaryButton} style={{ marginBlockStart: 'var(--g-space-5)' }} onClick={onBack}>
        رفتن به لیست خرید
      </UnstyledButton>
    </Box>
  );
}

function GuestAccountRequired({ onLogin }) {
  return (
    <Box className={styles.centerState}>
      <Box className={styles.unavailableIcon} aria-hidden="true"><IconUsers size={27} stroke={1.7} /></Box>
      <Text component="h1" className={styles.title}>برای خرید مشترک، اول با شماره وارد شو</Text>
      <Text component="p" className={styles.body} style={{ marginBlockStart: 'var(--g-space-2)', maxInlineSize: '34ch' }}>
        خانه به یک حساب پایدار نیاز دارد تا دعوت‌ها و تغییرهای اعضا به آدم درست برسد. اطلاعات مهمان منتقل یا به‌اشتراک گذاشته نمی‌شود.
      </Text>
      <UnstyledButton type="button" className={styles.primaryButton} style={{ marginBlockStart: 'var(--g-space-5)' }} onClick={onLogin}>
        ورود با شماره
      </UnstyledButton>
    </Box>
  );
}

function VerifiedPhoneRequired({ onBack }) {
  return (
    <Box className={styles.centerState}>
      <Box className={styles.unavailableIcon} aria-hidden="true"><IconUsers size={27} stroke={1.7} /></Box>
      <Text component="h1" className={styles.title}>شمارهٔ تأییدشده لازم است</Text>
      <Text component="p" className={styles.body} style={{ marginBlockStart: 'var(--g-space-2)', maxInlineSize: '36ch' }}>
        برای ورود به نسخهٔ آزمایشی خانه، شمارهٔ موبایل باید با کد پیامکی تأیید شده باشد. امکان اتصال شماره به حساب گوگل هنوز فراهم نیست.
      </Text>
      <UnstyledButton type="button" className={styles.primaryButton} style={{ marginBlockStart: 'var(--g-space-5)' }} onClick={onBack}>
        بازگشت به لیست خرید
      </UnstyledButton>
    </Box>
  );
}

function LoadError({ onRetry }) {
  return (
    <Box className={styles.centerState}>
      <Box className={styles.unavailableIcon} aria-hidden="true"><IconCloudOff size={27} stroke={1.7} /></Box>
      <Text component="h2" className={styles.sectionTitle}>خانه بارگذاری نشد</Text>
      <Text component="p" className={styles.body} style={{ marginBlockStart: 'var(--g-space-2)', maxInlineSize: '32ch' }}>
        اطلاعاتی را حدس نمی‌زنیم. اتصال را بررسی کن و دوباره بگیر.
      </Text>
      <UnstyledButton type="button" className={styles.primaryButton} style={{ marginBlockStart: 'var(--g-space-5)' }} onClick={onRetry}>
        <IconRefresh size={17} stroke={1.9} aria-hidden="true" />تلاش دوباره
      </UnstyledButton>
    </Box>
  );
}

function HouseholdQuickActions({ onPlan, onPersonalShopping }) {
  const actions = [
    {
      label: 'برنامه هفتگی',
      description: 'وعده‌های این هفته',
      Icon: IconCalendarWeek,
      onClick: onPlan,
    },
    {
      label: 'لیست خرید شخصی',
      description: 'اقلام فقط برای تو',
      Icon: IconShoppingCart,
      onClick: onPersonalShopping,
    },
  ];

  return (
    <Box component="nav" className={styles.quickActions} aria-label="میان‌برهای خرید و برنامه">
      {actions.map((action) => (
        <UnstyledButton key={action.label} type="button" className={styles.quickAction} onClick={action.onClick}>
          <Box component="span" className={styles.quickActionTop}>
            <Box component="span" className={styles.quickActionIcon} aria-hidden="true"><action.Icon size={19} stroke={1.8} /></Box>
            <IconChevronLeft size={17} stroke={1.8} aria-hidden="true" className={styles.quickActionChevron} />
          </Box>
          <Text component="span" className={styles.quickActionLabel}>{action.label}</Text>
          <Text component="span" className={styles.quickActionDescription}>{action.description}</Text>
        </UnstyledButton>
      ))}
    </Box>
  );
}

function InviteQueryState({ kind, title, onRetry, compact = false }) {
  if (kind === 'loading') {
    return (
      <Box className={`${styles.localInviteState} ${compact ? styles.localInviteStateCompact : ''}`} role="status" aria-busy="true">
        <Box className="g-skeleton" style={{ inlineSize: 18, blockSize: 18, borderRadius: '50%', flex: '0 0 auto' }} />
        <Text component="span" className={styles.muted}>{title}</Text>
      </Box>
    );
  }
  if (kind !== 'error') return null;
  return (
    <Box className={`${styles.localInviteState} ${compact ? styles.localInviteStateCompact : ''}`} role="status">
      <IconCloudOff size={18} stroke={1.8} aria-hidden="true" />
      <Text component="span" className={styles.muted} style={{ flex: 1 }}>{title}</Text>
      <UnstyledButton type="button" className={styles.quietButton} onClick={onRetry}>دوباره</UnstyledButton>
    </Box>
  );
}

function PendingInvites({ invites, status, busyAction, onRespond, onRetry }) {
  if (status !== 'ready') {
    return <InviteQueryState kind={status} title={status === 'loading' ? 'در حال بررسی دعوت‌های تو…' : 'دعوت‌های تو بارگذاری نشد.'} onRetry={onRetry} />;
  }
  if (!invites.length) return null;
  return (
    <section aria-labelledby="pending-invites-title">
      <Box className={styles.sectionHeading}>
        <Box className={styles.sectionIcon} aria-hidden="true"><IconUserPlus size={19} stroke={1.8} /></Box>
        <Box>
          <Text component="h2" id="pending-invites-title" className={styles.sectionTitle}>دعوت‌های تو</Text>
          <Text component="p" className={styles.muted}>اول مشخص کن می‌خواهی عضو کدام خانه شوی.</Text>
        </Box>
      </Box>
      <Box className={styles.inviteList}>
        {invites.map((invite) => (
          <motion.article key={invite.id} className={styles.inviteCard} {...withReducedMotion(riseIn)}>
            <Text component="h3" className={styles.sectionTitle}>{invite.household?.name || 'یک خانه'}</Text>
            <Text component="p" className={styles.body} style={{ marginBlockStart: 4 }}>
              {invite.invitedBy?.name ? `${invite.invitedBy.name} دعوتت کرده.` : 'برای عضویت در این خانه دعوت شده‌ای.'}
            </Text>
            <Box className={styles.inviteActions}>
              <UnstyledButton
                type="button"
                className={styles.primaryButton}
                disabled={!!busyAction}
                onClick={() => onRespond(invite.id, 'accept')}
              >
                قبول دعوت
              </UnstyledButton>
              <UnstyledButton
                type="button"
                className={styles.quietButton}
                disabled={!!busyAction}
                onClick={() => onRespond(invite.id, 'decline')}
              >
                فعلاً نه
              </UnstyledButton>
            </Box>
          </motion.article>
        ))}
      </Box>
    </section>
  );
}

function CreateHome({ busy, onCreate }) {
  const [name, setName] = useState('');
  const trimmed = name.trim();
  const submit = (event) => {
    event.preventDefault();
    if (trimmed) onCreate(trimmed).then((ok) => { if (ok) setName(''); });
  };

  return (
    <motion.section className={`${styles.card} ${styles.brandCard}`} aria-labelledby="create-home-title" {...withReducedMotion(riseIn)}>
      <Box className={styles.sectionHeading}>
        <Box className={styles.sectionIcon} aria-hidden="true"><IconHome size={20} stroke={1.8} /></Box>
        <Box>
          <Text component="h2" id="create-home-title" className={styles.sectionTitle}>یک خانه بساز</Text>
          <Text component="p" className={styles.muted}>فقط برای آدم‌هایی که خودت دعوت می‌کنی.</Text>
        </Box>
      </Box>
      <Text component="p" className={styles.body}>
        یک لیست مشترک بسازید، خرید را بین خودتان جلو ببرید و برای چیزهای ناموجود سریع تصمیم بگیرید.
      </Text>
      <Box component="form" className={styles.form} onSubmit={submit}>
        <Box component="label" className={styles.label} htmlFor="household-name">نام خانه</Box>
        <Box className={styles.fieldRow}>
          <Box
            component="input"
            id="household-name"
            className={styles.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={60}
            autoComplete="organization"
            placeholder="مثلاً خانهٔ ما"
          />
          <UnstyledButton type="submit" className={styles.primaryButton} disabled={busy || !trimmed}>
            ساختن خانه
          </UnstyledButton>
        </Box>
      </Box>
    </motion.section>
  );
}

function InviteMember({ busy, onInvite, openRequest = 0 }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (openRequest > 0) setOpen(true);
  }, [openRequest]);

  const submit = async (event) => {
    event.preventDefault();
    if (!isMobile(phone)) { setInvalid(true); return; }
    setInvalid(false);
    const ok = await onInvite(normalizePhone(phone));
    if (ok) { setPhone(''); setOpen(false); }
  };

  if (!open) {
    return (
      <UnstyledButton type="button" className={`${styles.secondaryButton} ${styles.wideButton}`} onClick={() => setOpen(true)}>
        <IconUserPlus size={18} stroke={1.8} aria-hidden="true" />دعوت یک نفر
      </UnstyledButton>
    );
  }

  return (
    <Box component="form" className={styles.form} onSubmit={submit} noValidate>
      <Box component="label" className={styles.label} htmlFor="invite-phone">شمارهٔ موبایل عضو</Box>
      <Box className={styles.fieldRow}>
        <Box
          component="input"
          ref={inputRef}
          id="invite-phone"
          className={styles.input}
          style={{ direction: 'ltr', textAlign: 'start' }}
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(event) => { setPhone(event.target.value); setInvalid(false); }}
          maxLength={16}
          aria-invalid={invalid}
          aria-describedby={invalid ? 'invite-phone-error' : undefined}
          placeholder="0912 123 4567"
        />
        <UnstyledButton type="submit" className={styles.primaryButton} disabled={busy || !phone.trim()}>
          ثبت دعوت داخل اپ
        </UnstyledButton>
        <UnstyledButton type="button" className={styles.iconButton} aria-label="بستن دعوت" onClick={() => { setOpen(false); setInvalid(false); }}>
          <IconX size={19} stroke={1.8} aria-hidden="true" />
        </UnstyledButton>
      </Box>
      {invalid ? <Text component="p" id="invite-phone-error" className={styles.muted} style={{ color: 'var(--g-color-state-danger-fg)' }}>شمارهٔ موبایل را کامل وارد کن.</Text> : null}
      <Text component="p" className={styles.muted}>پس از ورود با همین شماره در گارنیش دیده می‌شود؛ پیامک ارسال نمی‌شود و وجود حساب نمایش داده نمی‌شود.</Text>
    </Box>
  );
}

function formatInviteCreatedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('fa-IR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function OutgoingInvites({ invites, status, busyAction, onRevoke, onRetry }) {
  const [confirmId, setConfirmId] = useState(null);
  if (status !== 'ready') {
    return (
      <Box style={{ marginBlockStart: 'var(--g-space-4)' }}>
        <InviteQueryState kind={status} title={status === 'loading' ? 'در حال گرفتن دعوت‌های در انتظار…' : 'دعوت‌های در انتظار بارگذاری نشد.'} onRetry={onRetry} compact />
      </Box>
    );
  }
  if (!invites.length) return null;

  const revoke = async (invite) => {
    if (confirmId !== invite.id) { setConfirmId(invite.id); return; }
    const ok = await onRevoke(invite);
    if (ok) setConfirmId(null);
  };

  return (
    <Box style={{ marginBlockStart: 'var(--g-space-4)' }} aria-label="دعوت‌های در انتظار">
      <Text component="h3" className={styles.label}>دعوت‌های در انتظار</Text>
      <Box className={styles.outgoingInviteList}>
        {invites.map((invite) => (
          <Box key={invite.id} className={styles.outgoingInviteRow}>
            <Box style={{ flex: 1, minInlineSize: 0 }}>
              <Text component="span" className={styles.itemName}>دعوت در انتظار</Text>
              <Text component="span" className={styles.itemMeta}>
                {formatInviteCreatedAt(invite.createdAt) ? `ثبت‌شده در ${formatInviteCreatedAt(invite.createdAt)} · ` : ''}
                شماره و وضعیت حساب نمایش داده نمی‌شود.
              </Text>
            </Box>
            <UnstyledButton
              type="button"
              className={confirmId === invite.id ? styles.dangerQuietButton : styles.quietButton}
              disabled={!!busyAction}
              onClick={() => revoke(invite)}
            >
              {confirmId === invite.id ? 'تأیید لغو' : 'لغو دعوت'}
            </UnstyledButton>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function HouseholdChooser({ households, selectedId, onChange }) {
  if (households.length < 2) return null;
  return (
    <Box className={styles.card}>
      <Box component="label" className={styles.label} htmlFor="household-choice">خانهٔ فعال</Box>
      <Box
        component="select"
        id="household-choice"
        className={`${styles.input} ${styles.select}`}
        value={selectedId || ''}
        onChange={(event) => onChange(event.target.value)}
      >
        {households.map((household) => (
          <option key={household.id} value={household.id}>{household.name}</option>
        ))}
      </Box>
      <Text component="p" className={styles.muted} style={{ marginBlockStart: 'var(--g-space-2)' }}>
        هر خانه اعضا، فهرست و تصمیم‌های جدا دارد.
      </Text>
    </Box>
  );
}

function MembersDisclosure({ model, currentUserId, onNotice }) {
  const [confirm, setConfirm] = useState(null);
  const activeMembers = model.members.filter((member) => member.status === 'ACTIVE');
  if (!activeMembers.length) return null;

  const currentMembership = activeMembers.find((member) => member.userId === currentUserId);
  const isOwner = model.household?.role === 'OWNER';
  const remove = async (member) => {
    if (confirm !== member.id) { setConfirm(member.id); return; }
    const result = await model.removeMember(member);
    if (result.ok) { setConfirm(null); onNotice('عضو از خانه حذف شد', IconUsers); }
  };
  const leave = async () => {
    if (confirm !== 'leave') { setConfirm('leave'); return; }
    const result = await model.leaveHousehold(currentMembership);
    if (result.ok) { setConfirm(null); onNotice('از خانه خارج شدی', IconHome); }
  };
  const transfer = async (member) => {
    const confirmation = `transfer:${member.id}`;
    if (confirm !== confirmation) { setConfirm(confirmation); return; }
    const result = await model.transferOwner(member);
    if (result.ok) { setConfirm(null); onNotice('مالک جدید ثبت شد', IconUsers); }
  };

  return (
    <Box component="details" className={`${styles.card} ${styles.membersDisclosure}`}>
      <Box component="summary" className={styles.membersSummary}>
        <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
          <IconUsers size={18} stroke={1.8} aria-hidden="true" />
          <Text component="span" className={styles.sectionTitle}>اعضای خانه</Text>
        </Box>
        <Text component="span" className={styles.muted}>{toFaDigits(activeMembers.length)} نفر</Text>
      </Box>
      <Box component="ul" className={styles.memberList}>
        {activeMembers.map((member) => {
          const self = member.userId === currentUserId;
          return (
            <Box component="li" key={member.id} className={styles.memberRow}>
              <Box className={styles.memberAvatar} aria-hidden="true">{(member.name || 'ع').trim().slice(0, 1)}</Box>
              <Box style={{ flex: 1, minInlineSize: 0 }}>
                <Text component="span" className={styles.memberName}>{member.name || (self ? 'تو' : 'عضو خانه')}</Text>
                <Text component="span" className={styles.itemMeta}>{member.role === 'OWNER' ? 'مالک خانه' : 'عضو'}</Text>
              </Box>
              {isOwner && !self && member.role === 'MEMBER' ? (
                <Box className={styles.memberActions}>
                  <UnstyledButton
                    type="button"
                    className={confirm === `transfer:${member.id}` ? styles.secondaryButton : styles.quietButton}
                    disabled={!!model.busyAction}
                    onClick={() => transfer(member)}
                  >
                    {confirm === `transfer:${member.id}` ? 'تأیید مالکیت' : 'مالک کن'}
                  </UnstyledButton>
                  <UnstyledButton
                    type="button"
                    className={confirm === member.id ? styles.dangerQuietButton : styles.quietButton}
                    disabled={!!model.busyAction}
                    onClick={() => remove(member)}
                  >
                    {confirm === member.id ? 'تأیید حذف' : 'حذف'}
                  </UnstyledButton>
                </Box>
              ) : null}
            </Box>
          );
        })}
      </Box>
      {currentMembership && !isOwner ? (
        <UnstyledButton
          type="button"
          className={`${confirm === 'leave' ? styles.dangerQuietButton : styles.quietButton} ${styles.wideButton}`}
          disabled={!!model.busyAction}
          onClick={leave}
        >
          {confirm === 'leave' ? 'تأیید خروج از خانه' : 'ترک این خانه'}
        </UnstyledButton>
      ) : null}
      {currentMembership && isOwner && activeMembers.length > 1 ? (
        <Text component="p" className={styles.muted} style={{ marginBlockStart: 'var(--g-space-3)' }}>
          مالک برای خروج باید ابتدا مالکیت را به یک عضو دیگر منتقل کند.
        </Text>
      ) : null}
    </Box>
  );
}

function SessionCard({ session, busy, online, onStart, onEnd }) {
  const active = !!session;
  return (
    <section className={`${styles.sessionCard} ${active ? styles.sessionActive : ''}`} aria-label="جلسه خرید">
      <Box style={{ minInlineSize: 0 }}>
        <Text component="h2" className={styles.sectionTitle}>{active ? 'خرید در جریانه' : 'آمادهٔ خریدی؟'}</Text>
        <Text component="p" className={styles.muted} style={{ marginBlockStart: 2 }}>
          {active ? 'اقلام را بخر یا ناموجودی را برای تصمیم ثبت کن.' : 'جلسه فقط شروع و پایان این خرید را ثبت می‌کند؛ نه موقعیتت را.'}
        </Text>
      </Box>
      <UnstyledButton
        type="button"
        className={active ? styles.quietButton : styles.primaryButton}
        disabled={busy || !online}
        onClick={active ? onEnd : onStart}
      >
        {active ? <IconPlayerStop size={17} stroke={1.9} aria-hidden="true" /> : <IconPlayerPlay size={17} stroke={1.9} aria-hidden="true" />}
        {active ? 'پایان' : 'شروع'}
      </UnstyledButton>
    </section>
  );
}

function DecisionCard({ decision, busy, online, onResolve, onCancel }) {
  const options = Array.isArray(decision.options) ? decision.options : [];
  const createdByMe = decision.createdByMe === true;
  const canResolve = decision.canResolve === true;
  const canCancel = decision.canCancel === true;
  return (
    <motion.article className={styles.decisionCard} {...withReducedMotion(riseIn)}>
      <Box className={styles.decisionBadge}>
        <IconAlertTriangle size={14} stroke={1.9} aria-hidden="true" />
        {createdByMe ? 'منتظر پاسخ خانه' : canResolve ? 'تصمیم تو لازمه' : 'منتظر پاسخ'}
      </Box>
      <Text component="h3" className={styles.sectionTitle} style={{ marginBlockStart: 'var(--g-space-3)' }}>
        {decision.question || 'برای این مورد چه‌کار کنیم؟'}
      </Text>
      {createdByMe ? (
        <Text component="p" className={styles.muted} style={{ marginBlockStart: 'var(--g-space-2)' }}>
          این درخواست را تو فرستادی؛ پاسخ را یکی از اعضای دیگر ثبت می‌کند.
        </Text>
      ) : null}
      {canResolve && !createdByMe ? (
        <Box className={styles.decisionActions}>
          {options.map((option, index) => {
            const skip = /^(SKIP|SKIP_ITEM)$/i.test(option) || /نخر|صرف|رد/.test(option);
            return (
              <UnstyledButton
                key={option}
                type="button"
                className={skip ? styles.quietButton : styles.primaryButton}
                disabled={busy || !online}
                onClick={() => onResolve(decision, option)}
              >
                {skip ? 'این بار نخریم' : index === 0 ? `بگیریم: ${option}` : option}
              </UnstyledButton>
            );
          })}
        </Box>
      ) : null}
      {createdByMe && canCancel ? (
        <Box className={styles.decisionActions}>
          <UnstyledButton
            type="button"
            className={styles.quietButton}
            disabled={busy || !online}
            onClick={() => onCancel(decision)}
          >
            لغو درخواست
          </UnstyledButton>
        </Box>
      ) : null}
    </motion.article>
  );
}

function ItemRow({ item, busyAction, online, canAskHousehold, unavailableHelpId, onBought, onUnavailable, onRemove }) {
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [alternative, setAlternative] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const purchasable = PURCHASABLE_ITEM_STATES.has(item.status);
  const canMarkUnavailable = UNAVAILABLE_ITEM_STATES.has(item.status);
  const bought = item.status === 'BOUGHT';
  const busy = !!busyAction;
  const amount = [item.amount, item.unit].filter(Boolean).join(' ');

  const submitUnavailable = async (event) => {
    event.preventDefault();
    if (!alternative.trim()) return;
    const ok = await onUnavailable(item, alternative);
    if (ok) { setAlternative(''); setShowUnavailable(false); }
  };

  const remove = async () => {
    if (!confirmRemove) { setConfirmRemove(true); return; }
    const result = await onRemove(item);
    if (result?.ok) setConfirmRemove(false);
  };

  return (
    <motion.li className={styles.itemRow} layout="position" {...withReducedMotion(riseIn)}>
      <Box className={styles.itemMain}>
        <Box className={`${styles.itemMarker} ${bought ? `${styles.itemMarkerBought} g-check-pop` : ''}`} aria-hidden="true">
          {bought ? <IconCheck size={17} stroke={2.3} /> : <IconShoppingCart size={16} stroke={1.8} />}
        </Box>
        <Box className={styles.itemCopy}>
          <Text component="span" className={styles.itemName}>{item.name}</Text>
          <Text component="span" className={styles.itemMeta}>
            {[amount ? toFaDigits(amount) : null, STATUS_COPY[item.status] || 'در لیست'].filter(Boolean).join(' · ')}
          </Text>
        </Box>
        <Box className={styles.itemActions}>
          {purchasable ? (
            <>
              <UnstyledButton
                type="button"
                className={`${styles.itemAction} ${styles.boughtAction}`}
                disabled={busy || !online}
                onClick={() => onBought(item)}
                aria-label={`خریدم: ${item.name}`}
              >
                <IconCheck size={17} stroke={2} aria-hidden="true" />گرفتم
              </UnstyledButton>
              {canMarkUnavailable ? (
                <UnstyledButton
                  type="button"
                  className={styles.itemAction}
                  disabled={busy || !online || !canAskHousehold}
                  aria-expanded={showUnavailable}
                  aria-describedby={!canAskHousehold ? unavailableHelpId : undefined}
                  onClick={() => { setConfirmRemove(false); setShowUnavailable((value) => !value); }}
                  aria-label={`پیدا نشد: ${item.name}`}
                >
                  <IconPackageOff size={17} stroke={1.8} aria-hidden="true" />پیدا نشد
                </UnstyledButton>
              ) : null}
            </>
          ) : null}
          {!bought && item.status !== 'DECISION_PENDING' ? (
            <UnstyledButton
              type="button"
              className={`${styles.itemAction} ${styles.removeAction} ${confirmRemove ? styles.confirmRemoveAction : ''}`}
              disabled={busy || !online}
              onClick={remove}
              aria-label={confirmRemove ? `تأیید حذف ${item.name}` : `حذف ${item.name}`}
            >
              <IconTrash size={17} stroke={1.8} aria-hidden="true" />
              {confirmRemove ? 'تأیید حذف' : 'حذف'}
            </UnstyledButton>
          ) : null}
        </Box>
      </Box>
      <AnimatePresence initial={false}>
        {showUnavailable && canMarkUnavailable && canAskHousehold ? (
          <motion.form className={styles.unavailableForm} onSubmit={submitUnavailable} {...withReducedMotion(riseIn)}>
            <Box component="label" className={styles.label} htmlFor={`alternative-${item.id}`}>اگر این نبود، چی بگیریم؟</Box>
            <Box className={styles.fieldRow}>
              <Box
                component="input"
                id={`alternative-${item.id}`}
                className={styles.input}
                value={alternative}
                onChange={(event) => setAlternative(event.target.value)}
                maxLength={80}
                autoFocus
                placeholder="مثلاً پنیر خامه‌ای"
              />
              <UnstyledButton type="submit" className={styles.primaryButton} disabled={busy || !online || !alternative.trim()}>
                پرسیدن از خانه
              </UnstyledButton>
            </Box>
            <Text component="p" className={styles.muted}>پیشنهادت برای تصمیم اعضای مرتبط فرستاده می‌شود.</Text>
          </motion.form>
        ) : null}
      </AnimatePresence>
    </motion.li>
  );
}

function SharedList({ model, memberCount, canInvite, onInviteNeeded, onNotice }) {
  const [draft, setDraft] = useState('');
  const busy = !!model.busyAction;
  const canAskHousehold = memberCount > 1;
  const activeItems = useMemo(
    () => model.items.filter((item) => item.status !== 'REMOVED' && !TERMINAL_ITEM_STATES.has(item.status)),
    [model.items],
  );
  const completedItems = useMemo(
    () => model.items.filter((item) => TERMINAL_ITEM_STATES.has(item.status)),
    [model.items],
  );

  const add = async (event) => {
    event.preventDefault();
    const name = draft.trim();
    if (!name) return;
    const result = await model.addItem(name);
    if (result.ok) { setDraft(''); onNotice('به لیست خانه اضافه شد', IconPlus); }
  };

  const bought = async (item) => {
    const result = await model.updateItem(item, { status: 'BOUGHT' });
    if (result.ok) onNotice(`${item.name} خریده شد`, IconCheck);
  };

  const unavailable = async (item, alternative) => {
    const result = await model.markUnavailable(item, alternative);
    if (result.ok) onNotice('برای تصمیم اعضای مرتبط فرستاده شد', IconPackageOff);
    return result.ok;
  };

  return (
    <section aria-labelledby="shared-list-title">
      <Box className={styles.sectionHeading}>
        <Box className={styles.sectionIcon} aria-hidden="true"><IconShoppingCart size={19} stroke={1.8} /></Box>
        <Box>
          <Text component="h2" id="shared-list-title" className={styles.sectionTitle}>لیست خرید مشترک</Text>
          <Text component="p" className={styles.muted}>{toFaDigits(activeItems.length)} مورد در این چرخه</Text>
        </Box>
      </Box>
      <Box component="form" className={styles.quickAdd} onSubmit={add}>
        <Box
          component="input"
          className={styles.input}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={120}
          aria-label="افزودن به لیست مشترک"
          placeholder="مثلاً شیر ۲ عدد"
        />
        <UnstyledButton type="submit" className={styles.addButton} disabled={busy || !model.online || !draft.trim()} aria-label="افزودن">
          <IconPlus size={21} stroke={2} aria-hidden="true" />
        </UnstyledButton>
      </Box>
      {!canAskHousehold ? (
        <Box id="single-member-decision-note" className={styles.singleMemberNote} role="note">
          <IconUsers size={18} stroke={1.8} aria-hidden="true" />
          <Text component="span" className={styles.muted} style={{ flex: 1 }}>
            برای پرسیدن دربارهٔ جایگزین، اول یک عضو دیگر به خانه اضافه کن.
          </Text>
          {canInvite ? (
            <UnstyledButton type="button" className={styles.quietButton} onClick={onInviteNeeded}>دعوت عضو</UnstyledButton>
          ) : (
            <Text component="span" className={styles.muted}>از مالک خانه بخواه دعوت را بفرستد.</Text>
          )}
        </Box>
      ) : null}
      {activeItems.length ? (
        <Box component="ul" className={styles.itemList} style={{ listStyle: 'none', margin: 'var(--g-space-3) 0 0', padding: 0 }}>
          {activeItems.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              busyAction={model.busyAction}
              online={model.online}
              canAskHousehold={canAskHousehold}
              unavailableHelpId="single-member-decision-note"
              onBought={bought}
              onUnavailable={unavailable}
              onRemove={model.removeItem}
            />
          ))}
        </Box>
      ) : (
        <Box className={styles.emptyList} style={{ marginBlockStart: 'var(--g-space-3)' }}>
          <Box className={styles.emptyIcon} aria-hidden="true"><IconShoppingCart size={25} stroke={1.7} /></Box>
          <Text component="h3" className={styles.sectionTitle}>هنوز چیزی لازم ندارید</Text>
          <Text component="p" className={styles.body} style={{ marginBlockStart: 4 }}>اولین قلم را همین بالا اضافه کن.</Text>
        </Box>
      )}
      {completedItems.length ? (
        <Box component="details" className={styles.completedDisclosure}>
          <Box component="summary" className={styles.completedSummary}>
            <Text component="span">تمام‌شده‌ها</Text>
            <Text component="span" className={styles.muted}>{toFaDigits(completedItems.length)} مورد</Text>
          </Box>
          <Box component="ul" className={styles.completedList}>
            {completedItems.map((item) => (
              <Box component="li" key={item.id} className={styles.completedRow}>
                <IconCheck size={15} stroke={2} aria-hidden="true" />
                <Text component="span" style={{ flex: 1 }}>{item.name}</Text>
                <Text component="span" className={styles.muted}>{STATUS_COPY[item.status]}</Text>
              </Box>
            ))}
          </Box>
        </Box>
      ) : null}
    </section>
  );
}

export default function HouseholdPage({ enabled = isHouseholdV1Enabled() }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const guestAccount = user?.isGuest === true;
  const verifiedPhoneAccount = user?.phoneVerified === true;
  const model = useHousehold({ enabled: enabled && !guestAccount && verifiedPhoneAccount });
  const viewModel = model.reconciliationRequired
    ? { ...model, busyAction: 'reconciliation-required' }
    : model;
  const [toast, setToast] = useState(null);
  const [inviteOpenRequest, setInviteOpenRequest] = useState(0);
  const timer = useRef(null);
  const inviteSectionRef = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const notice = (message, Icon = IconCheck) => {
    clearTimeout(timer.current);
    setToast({ message, Icon });
    timer.current = setTimeout(() => setToast(null), 2600);
  };

  if (!enabled) return <FeatureUnavailable onBack={() => navigate('/shopping-list')} />;
  if (guestAccount) return <GuestAccountRequired onLogin={() => navigate('/login?from=/household')} />;
  if (!verifiedPhoneAccount) return <VerifiedPhoneRequired onBack={() => navigate('/shopping-list')} />;
  if (model.status === 'disabled') return <FeatureUnavailable onBack={() => navigate('/shopping-list')} />;
  if (model.status === 'loading') return <LoadingState />;
  if (model.status === 'error') return <LoadError onRetry={model.refresh} />;

  const create = async (name) => {
    const result = await model.createHousehold(name);
    if (result.ok) notice('خانه ساخته شد', IconHome);
    return result.ok;
  };
  const invite = async (phone) => {
    const result = await model.inviteMember(phone);
    if (result.ok) notice('دعوت داخل اپ ثبت شد؛ پیامکی ارسال نمی‌شود.', IconUserPlus);
    return result.ok;
  };
  const revokeInvite = async (pendingInvite) => {
    const result = await model.revokeInvite(pendingInvite);
    const revoked = result.ok && result.data?.invite?.status === 'REVOKED';
    if (revoked) notice('دعوت لغو شد', IconX);
    return revoked;
  };
  const respondInvite = async (inviteId, response) => {
    const result = await model.respondToInvite(inviteId, response);
    if (result.ok) notice(response === 'accept' ? 'به خانه اضافه شدی' : 'دعوت رد شد');
  };
  const resolveDecision = async (decision, option) => {
    const result = await model.resolveDecision(decision, option);
    if (result.ok) notice('تصمیمت ثبت شد', IconCheck);
  };
  const cancelDecision = async (decision) => {
    const result = await model.cancelDecision(decision);
    if (result.ok) notice('درخواست لغو شد؛ قلم به فهرست برگشت', IconX);
  };

  const memberCount = model.members.length || model.household?.memberCount || 0;
  const canInvite = model.household?.role === 'OWNER'
    || model.capabilities.some((capability) => /INVITE/.test(capability));
  const requestInviteMember = () => {
    setInviteOpenRequest((value) => value + 1);
    if (typeof inviteSectionRef.current?.scrollIntoView === 'function') {
      inviteSectionRef.current.scrollIntoView({ block: 'center' });
    }
  };

  return (
    <Box className={styles.page}>
      <Box className={styles.header}>
        <Box className={styles.headerCopy}>
          <Text component="h1" className={styles.title}>خرید باهم</Text>
          <Text component="p" className={styles.subtitle}>
            {model.household ? `${model.household.name} · ${toFaDigits(memberCount)} عضو` : 'خرید مشترک، بدون شلوغی'}
          </Text>
        </Box>
        <UnstyledButton type="button" className={styles.iconButton} onClick={model.refresh} aria-label="تازه‌سازی خانه">
          <IconRefresh size={20} stroke={1.8} aria-hidden="true" />
        </UnstyledButton>
      </Box>

      <Box className={styles.content}>
        {!model.online ? (
          <Box className={styles.offline} role="status">
            <IconCloudOff size={20} stroke={1.8} aria-hidden="true" />
            <Box>
              <Text component="strong" className={styles.sectionTitle}>آفلاینی</Text>
              <Text component="p" className={styles.muted}>فهرست قبلی را می‌بینی، اما تا اتصال برنگردد تغییری ارسال نمی‌شود.</Text>
            </Box>
          </Box>
        ) : null}

        {model.operationError ? (
          <Box className={styles.operationError} role="alert">
            <IconAlertTriangle size={20} stroke={1.8} aria-hidden="true" />
            <Box style={{ flex: 1 }}>
              <Text component="strong" className={styles.sectionTitle}>{model.operationError.title}</Text>
              <Text component="p" className={styles.muted}>{model.operationError.message}</Text>
              <Box className={styles.errorActions}>
                {['conflict', 'unknown', 'stale_display', 'reconciliation', 'refresh_failed'].includes(model.operationError.kind) ? (
                  <UnstyledButton type="button" className={styles.secondaryButton} onClick={model.refresh}>گرفتن نسخهٔ جدید</UnstyledButton>
                ) : null}
                {!['unknown', 'reconciliation'].includes(model.operationError.kind) ? (
                  <UnstyledButton type="button" className={styles.quietButton} onClick={model.clearOperationError}>بستن</UnstyledButton>
                ) : null}
              </Box>
            </Box>
          </Box>
        ) : null}

        <HouseholdQuickActions
          onPlan={() => navigate('/plan')}
          onPersonalShopping={() => navigate('/shopping-list')}
        />

        <PendingInvites
          invites={model.invites}
          status={model.incomingInvitesStatus}
          busyAction={viewModel.busyAction}
          onRespond={respondInvite}
          onRetry={model.refreshIncomingInvites}
        />

        <HouseholdChooser households={model.households} selectedId={model.household?.id} onChange={model.selectHousehold} />

        {!model.household ? (
          <CreateHome busy={!!viewModel.busyAction} onCreate={create} />
        ) : (
          <>
            <motion.section className={`${styles.card} ${styles.brandCard}`} aria-labelledby="home-title" {...withReducedMotion(riseIn)}>
              <Box className={styles.homeSummary}>
                <Box>
                  <Text component="h2" id="home-title" className={styles.sectionTitle}>{model.household.name}</Text>
                  <Text component="p" className={styles.body} style={{ marginBlockStart: 4 }}>یک لیست مشترک؛ وضعیت هر قلم برای همه روشن می‌ماند.</Text>
                </Box>
                <Box className={styles.memberPill}><IconUsers size={15} stroke={1.8} aria-hidden="true" />{toFaDigits(memberCount)} عضو</Box>
              </Box>
              {canInvite ? (
                <Box ref={inviteSectionRef} style={{ marginBlockStart: 'var(--g-space-4)' }}>
                  <InviteMember busy={!!viewModel.busyAction} onInvite={invite} openRequest={inviteOpenRequest} />
                  <OutgoingInvites
                    invites={model.outgoingInvites}
                    status={model.outgoingInvitesStatus}
                    busyAction={viewModel.busyAction}
                    onRevoke={revokeInvite}
                    onRetry={model.refreshOutgoingInvites}
                  />
                </Box>
              ) : null}
            </motion.section>

            <MembersDisclosure model={viewModel} currentUserId={user?.id || user?.userId} onNotice={notice} />

            {model.decisions.length ? (
              <section aria-labelledby="decisions-title">
                <Box className={styles.sectionHeading}>
                  <Box className={styles.sectionIcon} aria-hidden="true"><IconAlertTriangle size={19} stroke={1.8} /></Box>
                  <Box>
                    <Text component="h2" id="decisions-title" className={styles.sectionTitle}>تصمیم‌های خانه</Text>
                    <Text component="p" className={styles.muted}>پاسخ‌های لازم و درخواست‌های در انتظار، جدا نمایش داده می‌شوند.</Text>
                  </Box>
                </Box>
                <Box className={styles.decisionList}>
                  {model.decisions.map((decision) => (
                    <DecisionCard
                      key={decision.id}
                      decision={decision}
                      busy={!!viewModel.busyAction}
                      online={model.online}
                      onResolve={resolveDecision}
                      onCancel={cancelDecision}
                    />
                  ))}
                </Box>
              </section>
            ) : null}

            <SessionCard
              session={model.activeSession}
              busy={!!viewModel.busyAction}
              online={model.online}
              onStart={async () => { const result = await model.startSession(); if (result.ok) notice('جلسهٔ خرید شروع شد', IconPlayerPlay); }}
              onEnd={async () => { const result = await model.endSession(); if (result.ok) notice('جلسهٔ خرید تمام شد', IconCheck); }}
            />

            <SharedList
              model={viewModel}
              memberCount={memberCount}
              canInvite={canInvite}
              onInviteNeeded={requestInviteMember}
              onNotice={notice}
            />

            <Box className={styles.syncNote}>
              <IconRefresh size={14} stroke={1.8} aria-hidden="true" />
              در جلسهٔ خرید، تغییرها دوره‌ای تازه می‌شوند؛ بیرون از آن با بازگشت یا تازه‌سازی.
            </Box>
          </>
        )}
      </Box>
      <Toast toast={toast} />
    </Box>
  );
}
