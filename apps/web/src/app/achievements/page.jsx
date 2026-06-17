import { Box, Text, UnstyledButton } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { IconFlame, IconCheck, IconShieldHalf, IconInfoCircle, IconMoodSmile, IconLock, IconAward, IconCloudOff, IconRefresh } from '@tabler/icons-react';
import { useAchievements } from './useAchievements';
import { toFaDigits, faPercent } from '../../components/ges/format';
import { SkeletonLine } from '../../components/ges/LoadingSkeleton';

const card = { background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)', boxShadow: 'var(--g-shadow-1)' };
const h3 = { fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 'var(--g-space-6) 2px var(--g-space-3)' };

function StreakCard({ streak }) {
  if (streak.state !== 'active') {
    const broken = streak.state === 'broken';
    return (
      <Box style={{ ...card, padding: 'var(--g-space-4)', display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)' }}>
        <Box aria-hidden="true" style={{ inlineSize: 48, blockSize: 48, flexShrink: 0, borderRadius: 'var(--g-radius-card)', background: 'var(--g-color-state-info-bg)', color: 'var(--g-color-text-secondary)', display: 'grid', placeItems: 'center' }}><IconMoodSmile size={24} stroke={1.8} /></Box>
        <Box style={{ flex: 1, minInlineSize: 0 }}>
          <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 800, color: 'var(--g-color-text-primary)' }}>{broken ? 'هفتهٔ شلوغی بود' : 'بیا رشته‌ات رو بساز'}</Text>
          <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-secondary)', marginBlockStart: 3 }}>{streak.kindMessage || 'از نو شروع کنیم؟ اولین آشپزیِ این هفته، رشتهٔ تازه.'}</Text>
        </Box>
      </Box>
    );
  }
  const cells = Math.max(streak.weeks + 1, 4);
  return (
    <Box style={{ ...card, position: 'relative', overflow: 'hidden', padding: 'var(--g-space-4)' }}>
      <Box aria-hidden="true" style={{ position: 'absolute', insetBlockStart: -30, insetInlineStart: -20, inlineSize: 120, blockSize: 120, borderRadius: '50%', background: 'radial-gradient(circle, var(--g-color-brand-50), transparent 70%)' }} />
      <Box style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)' }}>
        <Box aria-hidden="true" style={{ inlineSize: 52, blockSize: 52, flexShrink: 0, borderRadius: 'var(--g-radius-card)', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-600)', display: 'grid', placeItems: 'center' }}><IconFlame size={26} stroke={1.8} /></Box>
        <Box style={{ flex: 1, minInlineSize: 0 }}>
          <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)' }}>{toFaDigits(streak.weeks)} هفته پیاپی</Text>
          {streak.kindMessage ? <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-secondary)', marginBlockStart: 3 }}>{streak.kindMessage}</Text> : null}
        </Box>
      </Box>
      <Box aria-hidden="true" style={{ position: 'relative', display: 'flex', gap: 'var(--g-space-1)', marginBlockStart: 'var(--g-space-4)' }}>
        {Array.from({ length: cells }, (_, i) => (
          <Box key={i} style={{ flex: 1, blockSize: 32, borderRadius: 'var(--g-radius-input)', display: 'grid', placeItems: 'center', background: i < streak.weeks ? 'var(--g-color-brand-100)' : 'var(--g-color-bg-canvas)', border: i < streak.weeks ? 'none' : '1px dashed var(--g-color-border-strong)', color: 'var(--g-color-brand-700)' }}>
            {i < streak.weeks ? <IconCheck size={15} stroke={2} /> : null}
          </Box>
        ))}
        {streak.atRisk ? <Box style={{ flex: 1, blockSize: 32, borderRadius: 'var(--g-radius-input)', display: 'grid', placeItems: 'center', background: 'var(--g-color-state-info-bg)', color: 'var(--g-color-text-muted)' }}><IconShieldHalf size={14} stroke={1.8} /></Box> : null}
      </Box>
      <Text component="p" style={{ position: 'relative', display: 'flex', gap: 'var(--g-space-1)', alignItems: 'flex-start', margin: 'var(--g-space-3) 0 0', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-muted)' }}>
        <IconInfoCircle size={12} stroke={1.8} aria-hidden="true" style={{ flexShrink: 0, marginBlockStart: 2 }} />{streak.graceUsed ? 'این هفته رو بپز تا رشته‌ات ادامه پیدا کنه.' : 'یک هفتهٔ مهلت داری — اگه یه هفته نپزی، رشته نمی‌شکنه.'}
      </Text>
    </Box>
  );
}

function BadgeTile({ b }) {
  return (
    <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 'var(--g-space-2)', paddingInline: 'var(--g-space-3)', paddingBlock: 'var(--g-space-4)', borderRadius: 'var(--g-radius-card)', background: b.earned ? 'var(--g-color-bg-surface)' : 'var(--g-color-bg-canvas)', border: '1px solid var(--g-color-border-subtle)', boxShadow: b.earned ? 'var(--g-shadow-1)' : 'none', opacity: b.earned ? 1 : 0.75 }}>
      <Box aria-hidden="true" style={{ inlineSize: 52, blockSize: 52, borderRadius: '50%', display: 'grid', placeItems: 'center', background: b.earned ? 'var(--g-color-brand-50)' : 'var(--g-color-state-info-bg)', color: b.earned ? 'var(--g-color-brand-600)' : 'var(--g-color-text-muted)', border: b.earned ? '1px solid var(--g-color-brand-200)' : '1px dashed var(--g-color-border-strong)' }}>
        {b.earned ? <b.Icon size={26} stroke={1.8} /> : <IconLock size={24} stroke={1.8} />}
      </Box>
      <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 700, color: b.earned ? 'var(--g-color-text-primary)' : 'var(--g-color-text-secondary)' }}>{b.title}</Text>
      <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-muted)' }}>{b.description}</Text>
    </Box>
  );
}

export default function AchievementsPage() {
  const navigate = useNavigate();
  const a = useAchievements();

  if (a.status === 'loading') {
    return (
      <Box role="status" aria-busy="true" aria-label="در حال بارگذاری دستاوردها" style={{ padding: 'var(--g-space-4)' }}>
        <Box className="g-skeleton" style={{ blockSize: 96, borderRadius: 'var(--g-radius-card)' }} />
        <SkeletonLine w="35%" h={14} style={{ marginBlockStart: 'var(--g-space-5)' }} />
        <Box style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--g-space-3)', marginBlockStart: 'var(--g-space-3)' }}>
          {[0, 1, 2, 3].map((i) => <Box key={i} className="g-skeleton" style={{ blockSize: 120, borderRadius: 'var(--g-radius-card)' }} />)}
        </Box>
      </Box>
    );
  }
  if (a.status === 'error') {
    return (
      <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingInline: 'var(--g-space-6)', paddingBlock: 'var(--g-space-8)', gap: 'var(--g-space-2)' }}>
        <Box aria-hidden="true" style={{ inlineSize: 54, blockSize: 54, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--g-color-state-info-bg)', color: 'var(--g-color-text-secondary)' }}><IconCloudOff size={24} stroke={1.6} /></Box>
        <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 800, margin: 'var(--g-space-2) 0 0', color: 'var(--g-color-text-primary)' }}>بارگذاری نشد</Text>
        <UnstyledButton type="button" onClick={a.refetch} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 44, paddingInline: 'var(--g-space-5)', marginBlockStart: 'var(--g-space-2)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700 }}><IconRefresh size={15} stroke={1.8} aria-hidden="true" />تلاش دوباره</UnstyledButton>
      </Box>
    );
  }

  return (
    <Box style={{ display: 'flex', flexDirection: 'column' }}>
      <Box style={{ paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-3)', borderBlockEnd: '1px solid var(--g-color-border-subtle)' }}>
        <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-22)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>دستاوردها</Text>
      </Box>

      {a.isNewUser ? (
        <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingInline: 'var(--g-space-6)', paddingBlock: 'var(--g-space-8)', gap: 'var(--g-space-2)' }}>
          <Box aria-hidden="true" style={{ inlineSize: 60, blockSize: 60, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-600)', border: '1.5px solid var(--g-color-brand-200)' }}><IconAward size={26} stroke={1.6} /></Box>
          <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 'var(--g-space-3) 0 0' }}>اولین پختت اولین نشانته</Text>
          <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', color: 'var(--g-color-text-secondary)', margin: 0 }}>شروع کن — بقیه خودشون میان.</Text>
          <UnstyledButton type="button" onClick={() => navigate('/discover')} style={{ minBlockSize: 44, paddingInline: 'var(--g-space-5)', marginBlockStart: 'var(--g-space-3)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700 }}>یه دستور پیدا کن</UnstyledButton>
        </Box>
      ) : (
        <Box style={{ paddingInline: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-8)' }}>
          <Box style={{ marginBlockStart: 'var(--g-space-4)' }}><StreakCard streak={a.streak} /></Box>

          <Text component="h2" style={h3}>نشان‌ها</Text>
          <Box style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--g-space-3)' }}>
            {a.badges.map((b) => <BadgeTile key={b.key} b={b} />)}
          </Box>

          {a.mastery ? (
            <>
              <Text component="h2" style={h3}>مهارت‌ها</Text>
              <Box style={{ ...card, padding: 'var(--g-space-4)' }}>
                <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBlockEnd: 'var(--g-space-2)' }}>
                  <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>سطح {toFaDigits(a.mastery.level)}{a.mastery.levelName ? ` · ${a.mastery.levelName}` : ''}</Text>
                  <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)' }}>{faPercent(a.mastery.progressToNext * 100)}</Text>
                </Box>
                <Box aria-hidden="true" style={{ blockSize: 6, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-border-subtle)', overflow: 'hidden' }}>
                  <Box style={{ inlineSize: `${Math.round(a.mastery.progressToNext * 100)}%`, blockSize: '100%', background: 'var(--g-color-brand-500)' }} />
                </Box>
                {a.mastery.basis ? <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-muted)', margin: 'var(--g-space-2) 0 0' }}>{a.mastery.basis}</Text> : null}
              </Box>
            </>
          ) : null}
        </Box>
      )}
    </Box>
  );
}
