import { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Text, UnstyledButton } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import {
  IconChevronLeft, IconChevronRight, IconLeaf, IconTrendingUp, IconFlame, IconToolsKitchen2,
  IconAward, IconPlant2, IconAlertTriangle, IconBookmark, IconHistory, IconPencil, IconScale,
  IconInfoCircle, IconLogout, IconSparkles,
} from '@tabler/icons-react';
import { useProfile } from './useProfile';
import { useAuth } from '../../context/AuthContext';
import { toFaDigits, faPercent } from '../../components/ges/format';
import FoodDnaRing from '../../components/ges/FoodDnaRing';
import ErrorState from '../../components/ges/ErrorState';
import Toast from '../../components/ges/Toast';
import { SkeletonLine, SkeletonCircle } from '../../components/ges/LoadingSkeleton';

const PAGE = { display: 'flex', flexDirection: 'column', paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-6)' };
const sectionTitle = { fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 800, color: 'var(--g-color-text-primary)', marginBlock: 'var(--g-space-6) var(--g-space-3)', marginInline: 2 };
const cardWrap = { background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)' };
const rowBtn = { display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', inlineSize: '100%', minBlockSize: 52, paddingInline: 'var(--g-space-4)' };

const CONF = {
  high: { note: 'اطمینان بالا', color: 'var(--g-color-state-success-fg)' },
  med: { note: 'اطمینان متوسط', color: 'var(--g-color-state-warning-fg)' },
  low: { note: 'در حال یادگیری', color: 'var(--g-color-text-muted)' },
};

function StatCard({ icon: Icon, value, label, onClick }) {
  const inner = (
    <>
      <Icon size={20} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} />
      <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-22)', fontWeight: 800, marginBlockStart: 4, color: 'var(--g-color-text-primary)' }}>{value}</Text>
      <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)' }}>{label}</Text>
    </>
  );
  const style = { ...cardWrap, paddingInline: 'var(--g-space-2)', paddingBlock: 'var(--g-space-4)', textAlign: 'center' };
  return onClick
    ? <UnstyledButton type="button" onClick={onClick} style={style}>{inner}</UnstyledButton>
    : <Box style={style}>{inner}</Box>;
}

function QuickRow({ icon: Icon, label, onClick, last }) {
  return (
    <UnstyledButton type="button" onClick={onClick} style={{ ...rowBtn, borderBlockStart: last ? '1px solid var(--g-color-border-subtle)' : 'none' }}>
      <Icon size={20} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-secondary)' }} />
      <Text component="span" style={{ flex: 1, textAlign: 'start', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600, color: 'var(--g-color-text-primary)' }}>{label}</Text>
      <IconChevronLeft size={18} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)' }} />
    </UnstyledButton>
  );
}

function KnownRow({ icon: Icon, iconColor, children, onEdit, divider }) {
  // No row-level aria-label: the visible text (the known preference/allergen) IS the accessible
  // name; the button role + the (decorative) pencil convey it's editable. A label like "ویرایش"
  // would mask the actual content a screen-reader user needs to hear.
  return (
    <UnstyledButton type="button" onClick={onEdit} style={{ ...rowBtn, paddingBlock: 'var(--g-space-3)', borderBlockStart: divider ? '1px solid var(--g-color-border-subtle)' : 'none' }}>
      <Icon size={19} stroke={1.8} aria-hidden="true" style={{ color: iconColor, flexShrink: 0 }} />
      <Text component="span" style={{ flex: 1, textAlign: 'start', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-primary)' }}>{children}</Text>
      <IconPencil size={16} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)', flexShrink: 0 }} />
    </UnstyledButton>
  );
}

/* ── Profile view ── */
function ProfileView({ p, onOpenDna, navigate, showToast, onLogout }) {
  const { header, dna, progress, known } = p;
  return (
    <Box style={PAGE}>
      {/* header */}
      <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)' }}>
        <Box style={{ position: 'relative', flexShrink: 0 }}>
          <Box aria-hidden="true" style={{ inlineSize: 64, blockSize: 64, borderRadius: '50%', background: 'var(--g-color-brand-100)', color: 'var(--g-color-brand-700)', display: 'grid', placeItems: 'center', fontFamily: 'var(--g-font-fa)', fontWeight: 800, fontSize: 'var(--g-font-size-22)' }}>{header.initial}</Box>
          {header.streakWeeks > 0 ? (
            <Box aria-label={`${toFaDigits(header.streakWeeks)} هفته پیاپی`} style={{ position: 'absolute', insetBlockEnd: -2, insetInlineStart: -4, display: 'inline-flex', alignItems: 'center', gap: 2, paddingInline: 'var(--g-space-2)', paddingBlock: 2, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', boxShadow: '0 0 0 2px var(--g-color-bg-canvas)', fontFamily: 'var(--g-font-fa)', fontWeight: 800, fontSize: 'var(--g-font-size-12)' }}>
              <IconFlame size={11} stroke={2} aria-hidden="true" />{toFaDigits(header.streakWeeks)}
            </Box>
          ) : null}
        </Box>
        <Box style={{ flex: 1, minInlineSize: 0 }}>
          <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-22)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>{header.name}</Text>
          <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', margin: '3px 0 0' }}>
            {header.since ? `عضو از ${header.since} · ` : ''}{header.cooksText}
          </Text>
        </Box>
        <UnstyledButton type="button" onClick={() => showToast('ویرایش پروفایل به‌زودی', IconPencil)} aria-label="ویرایش" style={{ flexShrink: 0, inlineSize: 44, blockSize: 44, borderRadius: '50%', border: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-secondary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconPencil size={18} stroke={1.8} />
        </UnstyledButton>
      </Box>

      {/* DNA summary card → DNA view */}
      <UnstyledButton type="button" onClick={onOpenDna} aria-label="شناسهٔ ذائقه — تفکیک ابعاد" style={{ ...cardWrap, position: 'relative', overflow: 'hidden', boxShadow: 'var(--g-shadow-1)', padding: 'var(--g-space-5)', marginBlockStart: 'var(--g-space-5)', textAlign: 'start' }}>
        <Box aria-hidden="true" style={{ position: 'absolute', insetBlockStart: -40, insetInlineStart: -30, inlineSize: 150, blockSize: 150, borderRadius: '50%', background: 'radial-gradient(circle, var(--g-color-brand-50), transparent 70%)' }} />
        <Box style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', color: 'var(--g-color-brand-700)', marginBlockEnd: 'var(--g-space-4)' }}>
          <IconLeaf size={15} stroke={1.8} aria-hidden="true" />
          <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700 }}>شناسهٔ ذائقهٔ تو</Text>
          <IconChevronLeft size={16} stroke={1.8} aria-hidden="true" style={{ marginInlineStart: 'auto', color: 'var(--g-color-text-muted)' }} />
        </Box>
        <Box style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 'var(--g-space-4)' }}>
          <FoodDnaRing value={dna.score} size={96} tone={dna.forming ? 'forming' : 'mature'} caption="بلوغ" />
          <Box style={{ flex: 1, minInlineSize: 0 }}>
            <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', paddingInline: 'var(--g-space-3)', paddingBlock: 4, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700 }}>
              <IconTrendingUp size={12} stroke={1.8} aria-hidden="true" />{dna.bandLabel}
            </Box>
            {dna.traits.length ? (
              <Box style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '5px 7px', marginBlockStart: 'var(--g-space-3)' }}>
                {dna.traits.map((t, i) => (
                  <Box key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px 7px' }}>
                    {i > 0 ? <Text component="span" aria-hidden="true" style={{ color: 'var(--g-color-text-muted)' }}>·</Text> : null}
                    <Text component="b" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700, color: 'var(--g-color-brand-700)' }}>{t}</Text>
                  </Box>
                ))}
              </Box>
            ) : null}
          </Box>
        </Box>
      </UnstyledButton>

      {/* پیشرفتِ تو */}
      <Text component="h2" style={sectionTitle}>پیشرفتِ تو</Text>
      <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--g-space-2)' }}>
        <StatCard icon={IconFlame} value={toFaDigits(progress.streakWeeks)} label="هفته پیاپی" />
        <StatCard icon={IconToolsKitchen2} value={toFaDigits(progress.totalCooks)} label="پخته‌شده" />
        <StatCard icon={IconAward} value={toFaDigits(progress.badges)} label="نشان" onClick={() => navigate('/achievements')} />
      </Box>

      {/* آنچه از تو می‌دانیم */}
      <Text component="h2" style={sectionTitle}>آنچه از تو می‌دانیم</Text>
      <Box style={cardWrap}>
        {known.dietLabel ? (
          <KnownRow icon={IconPlant2} iconColor="var(--g-color-brand-600)" onEdit={() => navigate('/onboarding')}>
            بیشتر غذای <b>{known.dietLabel}</b> را دوست داری
          </KnownRow>
        ) : null}
        {known.allergens.map((a, i) => (
          <KnownRow key={a} icon={IconAlertTriangle} iconColor="var(--g-color-allergen-fg)" divider={i > 0 || !!known.dietLabel} onEdit={() => navigate('/onboarding')}>
            حساسیت به <b>{a}</b> — پرچمِ ایمنی فعال است
          </KnownRow>
        ))}
        {!known.dietLabel && !known.allergens.length ? (
          <Box style={{ ...rowBtn, paddingBlock: 'var(--g-space-3)' }}>
            <IconLeaf size={19} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} />
            <Text component="span" style={{ flex: 1, textAlign: 'start', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)' }}>هرچی بیشتر بپزی، بهتر می‌شناسیمت.</Text>
          </Box>
        ) : null}
      </Box>

      {/* دسترسی سریع */}
      <Text component="h2" style={sectionTitle}>دسترسی سریع</Text>
      <Box style={cardWrap}>
        <QuickRow icon={IconBookmark} label="علاقه‌مندی‌ها" onClick={() => navigate('/favorites')} />
        <QuickRow icon={IconHistory} label="تاریخچهٔ پخت" onClick={() => showToast('تاریخچهٔ پخت به‌زودی', IconHistory)} last />
        <QuickRow icon={IconAward} label="دستاوردها" onClick={() => navigate('/achievements')} last />
        <QuickRow icon={IconSparkles} label="تنظیمات و پروفایل غذایی" onClick={() => navigate('/settings')} last />
      </Box>

      {/* logout */}
      <UnstyledButton type="button" onClick={onLogout} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--g-space-2)', inlineSize: '100%', minBlockSize: 52, marginBlockStart: 'var(--g-space-6)', borderRadius: 'var(--g-radius-input)', border: '1px solid var(--g-color-state-danger-fg)', background: 'var(--g-color-state-danger-bg)', color: 'var(--g-color-state-danger-fg)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 700 }}>
        <IconLogout size={18} stroke={1.8} aria-hidden="true" />خروج از حساب
      </UnstyledButton>
    </Box>
  );
}

/* ── DNA breakdown view ── */
function DnaView({ p, onBack, navigate }) {
  const { dna } = p;
  return (
    <Box style={PAGE}>
      <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', marginBlockEnd: 'var(--g-space-4)' }}>
        <UnstyledButton type="button" onClick={onBack} aria-label="بازگشت" style={{ inlineSize: 44, blockSize: 44, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--g-color-text-secondary)' }}>
          <IconChevronRight size={20} stroke={1.8} />
        </UnstyledButton>
        <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>شناسهٔ ذائقه</Text>
      </Box>

      <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <FoodDnaRing value={dna.score} size={140} tone={dna.forming ? 'forming' : 'mature'} caption="بلوغ ذائقه" />
        <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', marginBlockStart: 'var(--g-space-4)', paddingInline: 'var(--g-space-3)', paddingBlock: 5, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700 }}>
          <IconTrendingUp size={14} stroke={1.8} aria-hidden="true" />{dna.bandLabel}
        </Box>
      </Box>

      {dna.breakdown.length ? (
        <>
          <Text component="h2" style={sectionTitle}>تفکیکِ ابعاد</Text>
          <Box style={{ ...cardWrap, paddingInline: 'var(--g-space-4)' }}>
            {dna.breakdown.map((d, i) => {
              const conf = CONF[d.band] || CONF.low;
              return (
                <Box key={d.key} style={{ paddingBlock: 'var(--g-space-4)', borderBlockStart: i ? '1px solid var(--g-color-border-subtle)' : 'none' }}>
                  <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBlockEnd: 'var(--g-space-2)' }}>
                    <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>{d.label}</Text>
                    <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                      <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: 'var(--g-color-text-muted)' }}>{faPercent(d.value * 100)}</Text>
                      <UnstyledButton type="button" onClick={() => navigate('/onboarding')} aria-label="ویرایش" style={{ inlineSize: 44, blockSize: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--g-color-text-muted)' }}>
                        <IconPencil size={15} stroke={1.8} />
                      </UnstyledButton>
                    </Box>
                  </Box>
                  <Box aria-hidden="true" style={{ blockSize: 6, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-border-subtle)', overflow: 'hidden' }}>
                    <Box style={{ inlineSize: `${Math.round(d.value * 100)}%`, blockSize: '100%', background: d.band === 'low' ? 'var(--g-color-brand-300)' : 'var(--g-color-brand-500)' }} />
                  </Box>
                  <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', marginBlockStart: 'var(--g-space-2)' }}>
                    <Box aria-hidden="true" style={{ inlineSize: 6, blockSize: 6, borderRadius: '50%', background: conf.color }} />
                    <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: conf.color }}>{conf.note}</Text>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </>
      ) : (
        <Box style={{ ...cardWrap, textAlign: 'center', padding: 'var(--g-space-6)', marginBlockStart: 'var(--g-space-6)' }}>
          <Box aria-hidden="true" style={{ inlineSize: 60, blockSize: 60, margin: '0 auto', borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-600)', border: '1.5px solid var(--g-color-brand-200)' }}>
            <IconLeaf size={28} stroke={1.6} />
          </Box>
          <Text component="h3" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 'var(--g-space-3) 0 0' }}>ذائقه‌ات تازه داره شکل می‌گیره</Text>
          <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', color: 'var(--g-color-text-secondary)', margin: 'var(--g-space-2) 0 0' }}>بیا کامل‌ترش کنیم — چند پرسشِ کوتاه.</Text>
          <UnstyledButton type="button" onClick={() => navigate('/onboarding')} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minBlockSize: 44, paddingInline: 'var(--g-space-5)', marginBlockStart: 'var(--g-space-4)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700 }}>بریم</UnstyledButton>
        </Box>
      )}

      {/* honest reconciliation */}
      <Box style={{ marginBlockStart: 'var(--g-space-5)', background: 'var(--g-color-ai-surface)', border: 'var(--g-border-ai)', borderRadius: 'var(--g-radius-card)', padding: 'var(--g-space-4)' }}>
        <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', marginBlockEnd: 'var(--g-space-2)' }}>
          <IconScale size={16} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} />
          <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>آشتیِ صادقانه</Text>
        </Box>
        <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-primary)', margin: 0 }}>
          {dna.reconciliation.specific
            ? <>گفتی <b>{dna.reconciliation.declared}</b>ی؛ ولی گاهی <b>{dna.reconciliation.observed}</b> هم انتخاب کردی. هیچ‌کدوم رو پاک نکردیم — <b>هر دو رو نگه داشتیم</b> تا پیشنهادها واقعی بمونن.</>
            : <>هرجا گفته‌هات با رفتارت کمی فرق داشت، هیچ‌کدوم رو پاک نکردیم — <b>هر دو رو نگه داشتیم</b> تا پیشنهادها واقعی بمونن.</>}
        </Text>
        <UnstyledButton type="button" onClick={() => navigate('/onboarding')} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 44, marginBlockStart: 'var(--g-space-3)', paddingInline: 'var(--g-space-3)', borderRadius: 'var(--g-radius-chip)', border: '1px solid var(--g-color-brand-200)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600 }}>
          <IconPencil size={13} stroke={1.8} aria-hidden="true" />اصلاحش کن
        </UnstyledButton>
      </Box>
      <Text component="p" style={{ display: 'flex', gap: 'var(--g-space-2)', alignItems: 'flex-start', margin: 'var(--g-space-4) 2px 0', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-muted)' }}>
        <IconInfoCircle size={13} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)', flexShrink: 0, marginBlockStart: 1 }} />
        هرچی بیشتر بپزی، دقیق‌تر می‌شه. ویرایش همیشه در دستِ توست.
      </Text>
    </Box>
  );
}

function ProfileLoading() {
  return (
    <Box role="status" aria-busy="true" aria-label="در حال بارگذاری…" style={PAGE}>
      <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)' }}>
        <SkeletonCircle size={64} />
        <Box style={{ flex: 1 }}><SkeletonLine w="55%" h={16} /><SkeletonLine w="38%" h={12} style={{ marginBlockStart: 'var(--g-space-2)' }} /></Box>
      </Box>
      <Box className="g-skeleton" style={{ blockSize: 140, borderRadius: 'var(--g-radius-card)', marginBlockStart: 'var(--g-space-5)' }} />
      <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-5)' }}>
        <Box className="g-skeleton" style={{ blockSize: 84, borderRadius: 'var(--g-radius-card)' }} />
        <Box className="g-skeleton" style={{ blockSize: 84, borderRadius: 'var(--g-radius-card)' }} />
        <Box className="g-skeleton" style={{ blockSize: 84, borderRadius: 'var(--g-radius-card)' }} />
      </Box>
    </Box>
  );
}

export default function ProfilePage({ initialView = 'profile' }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const p = useProfile();
  const [view, setView] = useState(initialView);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef();
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const showToast = useCallback((message, Icon) => {
    clearTimeout(toastTimer.current);
    setToast({ message, Icon });
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);
  const onLogout = useCallback(() => { logout(); navigate('/onboarding', { replace: true }); }, [logout, navigate]);

  if (p.status === 'loading') return <ProfileLoading />;
  if (p.status === 'error') return <ErrorState title="پروفایل بارگذاری نشد" body="یک اتصال کوتاه قطع شد. چیزی از دست نرفته." reassurance="اطلاعاتت امن ذخیره است" onRetry={p.refetch} />;

  return (
    <>
      {view === 'dna'
        ? <DnaView p={p} onBack={() => setView('profile')} navigate={navigate} />
        : <ProfileView p={p} onOpenDna={() => setView('dna')} navigate={navigate} showToast={showToast} onLogout={onLogout} />}
      <Toast toast={toast} />
    </>
  );
}
