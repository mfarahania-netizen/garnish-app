import { useState } from 'react';
import { Box, Text, UnstyledButton } from '@mantine/core';
import { MotionConfig, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { IconLeaf, IconFlame, IconUser, IconSparkles } from '@tabler/icons-react';
import { useHomeData } from './lib/useHomeData';
import { toFaDigits } from '../../components/ges/format';
import FoodDnaRing from '../../components/ges/FoodDnaRing';
import AIWhisper from '../../components/ges/AIWhisper';
import RecipeCard from '../../components/ges/RecipeCard';
import EmptyState from '../../components/ges/EmptyState';
import ErrorState from '../../components/ges/ErrorState';
import { SkeletonLine, SkeletonCircle, SkeletonCard } from '../../components/ges/LoadingSkeleton';

const PAGE = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--g-space-5)',
  paddingInline: 'var(--g-space-4)',
  paddingBlockStart: 'var(--g-space-3)',
  paddingBlockEnd: 'var(--g-space-6)',
};

const settle = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

function Greeting({ greeting, subtitle, showStreak }) {
  return (
    <Box component="header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--g-space-3)' }}>
      <Box style={{ flex: 1, minInlineSize: 0 }}>
        <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 500, color: 'var(--g-color-text-muted)', margin: '0 0 var(--g-space-1)' }}>
          {greeting.line}
        </Text>
        <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-22)', fontWeight: 800, lineHeight: 'var(--g-leading-heading)', color: 'var(--g-color-text-primary)', textWrap: 'balance', margin: 0 }}>
          {greeting.name ? `سلام ${greeting.name}،` : 'سلام،'}
          <br />
          {subtitle}
        </Text>
      </Box>

      <Box style={{ position: 'relative', flexShrink: 0 }}>
        <Box
          aria-hidden="true"
          style={{
            display: 'grid',
            placeItems: 'center',
            inlineSize: 48,
            blockSize: 48,
            borderRadius: '50%',
            background: 'var(--g-color-brand-100)',
            color: 'var(--g-color-brand-700)',
            fontFamily: 'var(--g-font-fa)',
            fontWeight: 800,
            fontSize: 'var(--g-font-size-18)',
          }}
        >
          {greeting.initial || <IconUser size={22} stroke={1.8} />}
        </Box>
        {showStreak && greeting.streak ? (
          <Box
            aria-label={`${toFaDigits(greeting.streak)} هفته پیاپی`}
            style={{
              position: 'absolute',
              insetBlockEnd: -4,
              insetInlineStart: -6,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              paddingInline: 'var(--g-space-2)',
              paddingBlock: 2,
              borderRadius: 'var(--g-radius-chip)',
              background: 'var(--g-color-brand-600)',
              color: 'var(--g-color-text-inverse)',
              boxShadow: '0 0 0 2px var(--g-color-bg-canvas)',
              fontFamily: 'var(--g-font-fa)',
              fontWeight: 800,
              fontSize: 'var(--g-font-size-12)',
            }}
          >
            <IconFlame size={12} stroke={2} aria-hidden="true" />
            {toFaDigits(greeting.streak)}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}

function FoodDnaCard({ dna, onOpen }) {
  return (
    <Box
      component={motion.div}
      variants={settle}
      initial="initial"
      animate="animate"
      transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
    >
      <UnstyledButton
        type="button"
        onClick={onOpen}
        aria-label="شناسهٔ ذائقهٔ تو — مشاهده"
        style={{
          display: 'block',
          inlineSize: '100%',
          textAlign: 'start',
          background: 'var(--g-color-bg-surface)',
          border: '1px solid var(--g-color-border-subtle)',
          borderRadius: 'var(--g-radius-card)',
          boxShadow: 'var(--g-shadow-1)',
          padding: 'var(--g-space-5)',
        }}
      >
        <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', color: 'var(--g-color-brand-700)', marginBlockEnd: 'var(--g-space-4)' }}>
          <IconLeaf size={15} stroke={1.8} aria-hidden="true" />
          <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700 }}>شناسهٔ ذائقهٔ تو</Text>
        </Box>

        <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-4)' }}>
          <FoodDnaRing value={dna.score} size={100} tone={dna.tone} caption="بلوغ ذائقه" />
          <Box style={{ flex: 1, minInlineSize: 0 }}>
            <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, lineHeight: 'var(--g-leading-heading)', color: 'var(--g-color-text-primary)', textWrap: 'balance', margin: 0 }}>
              {dna.headline}
            </Text>
            {dna.traits.length ? (
              <>
                <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-secondary)', margin: 'var(--g-space-2) 0 0' }}>این‌طور می‌شناسیمت:</Text>
                <Box style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--g-space-1) var(--g-space-2)', marginBlockStart: 'var(--g-space-1)' }}>
                  {dna.traits.map((t, i) => (
                    <Box key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                      {i > 0 ? <Text component="span" aria-hidden="true" style={{ color: 'var(--g-color-text-muted)' }}>·</Text> : null}
                      <Text component="b" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-brand-700)' }}>{t}</Text>
                    </Box>
                  ))}
                </Box>
              </>
            ) : null}
          </Box>
        </Box>
      </UnstyledButton>
    </Box>
  );
}

function HomeLoading() {
  return (
    <Box style={PAGE}>
      <Box component="header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--g-space-3)' }}>
        <Box style={{ flex: 1 }}>
          <SkeletonLine w={90} h={12} />
          <SkeletonLine w={170} h={20} style={{ marginBlockStart: 'var(--g-space-2)' }} />
        </Box>
        <SkeletonCircle size={48} />
      </Box>
      <Box style={{ background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)', padding: 'var(--g-space-5)' }}>
        <SkeletonLine w={110} h={12} />
        <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-4)', marginBlockStart: 'var(--g-space-4)' }}>
          <SkeletonCircle size={100} />
          <Box style={{ flex: 1 }}>
            <SkeletonLine w="100%" h={14} />
            <SkeletonLine w="60%" h={12} style={{ marginBlockStart: 'var(--g-space-2)' }} />
          </Box>
        </Box>
      </Box>
      <SkeletonCard />
    </Box>
  );
}

export default function HomePage() {
  const { status, greeting, dna, whisper, picks, refetch } = useHomeData();
  const navigate = useNavigate();
  const [whisperDismissed, setWhisperDismissed] = useState(false);
  const [saved, setSaved] = useState({});

  const openRecipe = (id) => navigate(`/recipe/${id}`);
  const toggleSave = (id) => setSaved((s) => ({ ...s, [id]: !s[id] }));

  if (status === 'loading') return <HomeLoading />;

  return (
    <MotionConfig reducedMotion="user">
      <Box style={PAGE}>
        <Greeting
          greeting={greeting}
          subtitle={status === 'empty' ? 'خوش اومدی' : 'امشب چی بپزیم؟'}
          showStreak={status === 'ready'}
        />

        {status === 'error' ? <ErrorState onRetry={refetch} /> : null}

        {status === 'empty' ? (
          <EmptyState
            icon={IconLeaf}
            title="بیا ذائقه‌ات رو کشف کنیم"
            body="چند سؤال کوتاه می‌پرسیم تا پیشنهادها از همین امشب دقیق‌تر شوند."
            actionLabel="شروع شناختِ ذائقه"
            actionIcon={IconSparkles}
            onAction={() => navigate('/discover')}
          />
        ) : null}

        {status === 'ready' ? (
          <>
            <FoodDnaCard dna={dna} onOpen={() => navigate('/food-dna')} />

            {whisper && !whisperDismissed ? (
              <AIWhisper
                text={whisper.text}
                sub={whisper.sub}
                onAccept={() => openRecipe(whisper.recipeId)}
                onDismiss={() => setWhisperDismissed(true)}
              />
            ) : null}

            <Box component="section">
              <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBlockEnd: 'var(--g-space-3)' }}>
                <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>برای تو، امشب</Text>
                <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: 'var(--g-color-text-muted)' }}>{`${toFaDigits(picks.length)} پیشنهاد`}</Text>
              </Box>

              <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)' }}>
                {picks.map((p, i) => (
                  <Box
                    key={p.recipeId}
                    component={motion.div}
                    variants={settle}
                    initial="initial"
                    animate="animate"
                    transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1], delay: 0.05 + i * 0.05 }}
                  >
                    <RecipeCard
                      title={p.title}
                      placeholderSeed={p.seed}
                      fit={p.fit}
                      cookTimeText={p.cookTimeText}
                      difficultyText={p.difficultyText}
                      reasons={p.reasons}
                      reasonText={p.reasonText}
                      saved={!!saved[p.recipeId]}
                      onSave={() => toggleSave(p.recipeId)}
                      onOpen={() => openRecipe(p.recipeId)}
                    />
                  </Box>
                ))}
              </Box>
            </Box>
          </>
        ) : null}
      </Box>
    </MotionConfig>
  );
}
