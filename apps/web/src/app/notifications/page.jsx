import { Box, Text, UnstyledButton } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { IconSettings, IconBell, IconBellCog, IconChevronLeft, IconCloudOff, IconRefresh } from '@tabler/icons-react';
import { useNotifications } from './useNotifications';
import { toFaDigits } from '../../components/ges/format';
import { SkeletonLine } from '../../components/ges/LoadingSkeleton';

const TONE_FG = { brand: 'var(--g-color-brand-600)', success: 'var(--g-color-state-success-fg)', neutral: 'var(--g-color-text-secondary)' };
const TONE_BG = { brand: 'var(--g-color-brand-50)', success: 'var(--g-color-state-success-bg)', neutral: 'var(--g-color-state-info-bg)' };

function Row({ n, onOpen }) {
  return (
    <UnstyledButton type="button" onClick={onOpen} aria-label={n.title} style={{ display: 'flex', gap: 'var(--g-space-3)', inlineSize: '100%', textAlign: 'start', padding: 'var(--g-space-3) var(--g-space-4)', borderRadius: 'var(--g-radius-card)', background: n.isRead ? 'var(--g-color-bg-surface)' : 'var(--g-color-ai-surface)', border: `1px solid ${n.isRead ? 'var(--g-color-border-subtle)' : 'var(--g-color-brand-200)'}` }}>
      <Box aria-hidden="true" style={{ inlineSize: 40, blockSize: 40, flexShrink: 0, borderRadius: 'var(--g-radius-input)', background: TONE_BG[n.tone], color: TONE_FG[n.tone], display: 'grid', placeItems: 'center' }}><n.Icon size={20} stroke={1.8} /></Box>
      <Box style={{ flex: 1, minInlineSize: 0 }}>
        <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-1)' }}>
          <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>{n.title}</Text>
          {!n.isRead ? <Box aria-label="خوانده‌نشده" style={{ inlineSize: 8, blockSize: 8, borderRadius: '50%', background: 'var(--g-color-brand-600)' }} /> : null}
        </Box>
        {n.body ? <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)', margin: '4px 0 0' }}>{n.body}</Text> : null}
        {n.timeText ? <Text component="span" style={{ display: 'block', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', marginBlockStart: 6 }}>{n.timeText}</Text> : null}
      </Box>
      <IconChevronLeft size={17} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)', alignSelf: 'center', flexShrink: 0 }} />
    </UnstyledButton>
  );
}

function PrefsRow({ onClick }) {
  return (
    <UnstyledButton type="button" onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', inlineSize: '100%', minBlockSize: 56, marginBlockStart: 'var(--g-space-3)', paddingInline: 'var(--g-space-4)', background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)' }}>
      <IconBellCog size={19} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-secondary)' }} />
      <Box style={{ flex: 1, textAlign: 'start' }}>
        <Text component="span" style={{ display: 'block', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600, color: 'var(--g-color-text-primary)' }}>تنظیماتِ اعلان</Text>
        <Text component="span" style={{ display: 'block', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', marginBlockStart: 2 }}>ساعتِ آرام · انتخابِ نوع · انصراف</Text>
      </Box>
      <IconChevronLeft size={18} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)' }} />
    </UnstyledButton>
  );
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const n = useNotifications();
  const onOpen = (it) => { n.markRead(it.id); if (it.recipeId) navigate(`/recipe/${it.recipeId}`); };

  return (
    <Box style={{ display: 'flex', flexDirection: 'column' }}>
      <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--g-space-3)', paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-3)', borderBlockEnd: '1px solid var(--g-color-border-subtle)' }}>
        <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-22)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>اعلان‌ها</Text>
        <UnstyledButton type="button" onClick={() => navigate('/settings')} aria-label="تنظیماتِ اعلان" style={{ inlineSize: 44, blockSize: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', color: 'var(--g-color-text-secondary)' }}><IconSettings size={20} stroke={1.8} /></UnstyledButton>
      </Box>

      {n.status === 'loading' ? (
        <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)', padding: 'var(--g-space-4)' }}>
          {[0, 1, 2].map((i) => <Box key={i} style={{ display: 'flex', gap: 'var(--g-space-3)', padding: 'var(--g-space-3)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)' }}><Box className="g-skeleton" style={{ inlineSize: 40, blockSize: 40, borderRadius: 'var(--g-radius-input)' }} /><Box style={{ flex: 1 }}><SkeletonLine w="50%" h={12} /><SkeletonLine w="85%" h={10} style={{ marginBlockStart: 'var(--g-space-2)' }} /></Box></Box>)}
        </Box>
      ) : n.status === 'error' ? (
        <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingInline: 'var(--g-space-6)', paddingBlock: 'var(--g-space-8)', gap: 'var(--g-space-2)' }}>
          <Box aria-hidden="true" style={{ inlineSize: 54, blockSize: 54, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--g-color-state-info-bg)', color: 'var(--g-color-text-secondary)' }}><IconCloudOff size={24} stroke={1.6} /></Box>
          <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 800, margin: 'var(--g-space-2) 0 0', color: 'var(--g-color-text-primary)' }}>اعلان‌ها بارگذاری نشد</Text>
          <UnstyledButton type="button" onClick={n.refetch} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 44, paddingInline: 'var(--g-space-5)', marginBlockStart: 'var(--g-space-2)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700 }}><IconRefresh size={15} stroke={1.8} aria-hidden="true" />تلاش دوباره</UnstyledButton>
        </Box>
      ) : n.status === 'empty' ? (
        <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingInline: 'var(--g-space-6)', paddingBlock: 'var(--g-space-8)', gap: 'var(--g-space-2)' }}>
          <Box aria-hidden="true" style={{ inlineSize: 60, blockSize: 60, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-600)', border: '1.5px solid var(--g-color-brand-200)' }}><IconBell size={26} stroke={1.6} /></Box>
          <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 800, margin: 'var(--g-space-3) 0 0', color: 'var(--g-color-text-primary)' }}>فعلاً خبری نیست</Text>
          <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', color: 'var(--g-color-text-secondary)', margin: 0 }}>وقتی چیزِ مفیدی باشه، آروم خبرت می‌کنیم.</Text>
          <Box style={{ inlineSize: '100%', maxInlineSize: 360, marginBlockStart: 'var(--g-space-4)' }}><PrefsRow onClick={() => navigate('/settings')} /></Box>
        </Box>
      ) : (
        <Box style={{ paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-3)', paddingBlockEnd: 'var(--g-space-6)' }}>
          <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingInline: 2, paddingBlockEnd: 'var(--g-space-2)' }}>
            <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)' }}>{n.unread ? `${toFaDigits(n.unread)} خواندنشده` : 'همه خوانده شد'}</Text>
            {n.unread ? <UnstyledButton type="button" onClick={n.markAll} style={{ minBlockSize: 44, paddingInline: 'var(--g-space-2)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: 'var(--g-color-brand-700)' }}>همه را خواندم</UnstyledButton> : null}
          </Box>
          <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)' }}>
            {n.items.map((it) => <Row key={it.id} n={it} onOpen={() => onOpen(it)} />)}
          </Box>
          <PrefsRow onClick={() => navigate('/settings')} />
        </Box>
      )}
    </Box>
  );
}
