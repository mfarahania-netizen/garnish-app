import { useEffect } from 'react';
import { Box, Text, UnstyledButton } from '@mantine/core';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconEdit,
  IconHeart,
  IconLeaf,
  IconLoader2,
  IconRefresh,
  IconShieldCheck,
  IconSparkles,
  IconUsers,
} from '@tabler/icons-react';
import { Link, useNavigate } from 'react-router-dom';
import { useOnboarding } from './useOnboarding';
import { toFaDigits } from '../../components/ges/format';
import TasteBuilder from './TasteBuilder';
import {
  COOKS_FOR_OPTIONS,
  COOKTIME_OPTIONS,
  DIETARY_RULE_OPTIONS,
  ONBOARDING_ALLERGEN_OPTIONS,
  PATTERN_OPTIONS,
  allergenLabels,
} from './steps';
import styles from './onboarding.module.css';

const transition = { duration: 0.24, ease: [0.16, 1, 0.3, 1] };
const RECIPE_DIET_LABELS = {
  vegan: 'وگان',
  vegetarian: 'گیاه‌خوار',
};

function recommendationMeta(recipe) {
  const rawReason = String(recipe?.reason || '').replace(/\s+/g, ' ').trim();
  const looksInternal = /recommended|because|recipe|effortfit|skillfit|intelligence|controlled variety|\d+%/i.test(rawReason);
  const hasPersian = /[\u0600-\u06ff]/u.test(rawReason);
  const latinLetters = (rawReason.match(/[a-z]/gi) || []).length;
  if (rawReason && rawReason.length <= 120 && hasPersian && latinLetters <= 4 && !looksInternal) return rawReason;

  const parts = [];
  if (recipe?.cookingTime) parts.push(`${toFaDigits(recipe.cookingTime)} دقیقه`);
  if (RECIPE_DIET_LABELS[recipe?.diet]) parts.push(RECIPE_DIET_LABELS[recipe.diet]);
  return parts.length ? parts.join(' · ') : 'پیشنهاد واقعی بر اساس پروفایل تو';
}

function moveRadioSelection(event, onSelect) {
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const current = event.target.closest?.('[role="radio"]');
  if (!current) return;
  const radios = [...event.currentTarget.querySelectorAll('[role="radio"]:not(:disabled)')];
  const currentIndex = radios.indexOf(current);
  if (currentIndex < 0 || !radios.length) return;

  const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
  const forward = event.key === 'ArrowDown' || event.key === (rtl ? 'ArrowLeft' : 'ArrowRight');
  const backward = event.key === 'ArrowUp' || event.key === (rtl ? 'ArrowRight' : 'ArrowLeft');
  let nextIndex = currentIndex;
  if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = radios.length - 1;
  else if (forward) nextIndex = (currentIndex + 1) % radios.length;
  else if (backward) nextIndex = (currentIndex - 1 + radios.length) % radios.length;

  event.preventDefault();
  const next = radios[nextIndex];
  onSelect(next.dataset.radioValue);
  next.focus();
}

function PrimaryButton({ children, disabled, onClick, type = 'button' }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.button
      type={type}
      className={styles.primaryButton}
      disabled={disabled}
      aria-disabled={disabled}
      onClick={onClick}
      whileTap={!disabled && !reduceMotion ? { scale: 0.985 } : undefined}
      transition={{ duration: 0.12 }}
    >
      {children}
    </motion.button>
  );
}

function Frame({ children }) {
  return (
    <Box className={styles.viewport} dir="rtl">
      <Box className={styles.shell}>{children}</Box>
    </Box>
  );
}

function Welcome({ onboarding }) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const o = onboarding;
  return (
    <Box className={styles.welcome}>
      <Box className={styles.welcomeMain}>
        <motion.div
          className={styles.brandMark}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.9, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : transition}
          aria-hidden="true"
        >
          <IconLeaf size={38} stroke={1.8} />
        </motion.div>
        <Text component="span" className={styles.eyebrow}>شروع شخصی‌سازی گارنیش</Text>
        <Text tabIndex={-1} data-onboarding-heading component="h1" className={styles.welcomeTitle}>
          پیشنهادهایی که واقعاً به زندگی تو می‌خورند
        </Text>
        <Text component="p" className={styles.welcomeCopy}>
          {o.personalizationAvailable ? 'چهار' : 'سه'} پاسخ کوتاه دربارهٔ ایمنی، الگوی غذایی و زمانت؛ بعد گارنیش با انتخاب‌هایت دقیق‌تر می‌شود.
        </Text>
        <Box className={styles.benefits} aria-label="مزیت‌های این مرحله">
          <Box className={styles.benefit}><IconShieldCheck size={19} stroke={1.8} />محدودیت‌های ایمنی قبل از هر پیشنهاد</Box>
          <Box className={styles.benefit}><IconClock size={19} stroke={1.8} />غذاهای متناسب با زمان و تعداد نفرات</Box>
          {o.personalizationAvailable ? <Box className={styles.benefit}><IconSparkles size={19} stroke={1.8} />کالیبراسیون اختیاری با غذاهای واقعی</Box> : null}
        </Box>
        {o.authed && !o.termsAccepted ? (
          <Box className={`${styles.consentCard} ${styles.welcomeConsent}`}>
            <label className={styles.consentLabel}>
              <input
                className={styles.consentCheckbox}
                type="checkbox"
                checked={o.termsAccepted}
                onChange={(event) => o.setTermsAccepted(event.target.checked)}
              />
              <span>
                <span className={styles.consentTitle}>شرایط استفاده را می‌پذیرم</span>
                <span className={styles.consentHelp}>
                  پیش از ثبت اطلاعات ایمنی، <Link className={styles.legalLink} to="/terms" target="_blank" rel="noreferrer">شرایط استفاده</Link>
                  {' و '}
                  <Link className={styles.legalLink} to="/privacy" target="_blank" rel="noreferrer">اطلاعیهٔ حریم خصوصی</Link>
                  {' را خوانده‌ام.'}
                </span>
              </span>
            </label>
          </Box>
        ) : null}
        {o.authed && o.termsAccepted ? (
          <Box className={`${styles.inlineState} ${styles.welcomeConsent}`} role="status">شرایط و اطلاعیهٔ حریم خصوصی پذیرفته شده‌اند.</Box>
        ) : null}
      </Box>
      <Box className={styles.welcomeFooter}>
        <ErrorBox onboarding={o} />
        <PrimaryButton onClick={o.start} disabled={o.hydrating}>
          {o.hydrating ? <><IconLoader2 className={styles.spinner} size={19} aria-hidden="true" />آماده‌سازی…</> : <>{o.authed ? 'شروع کنیم' : 'ورود و شروع'}<IconArrowLeft size={19} stroke={1.9} aria-hidden="true" /></>}
        </PrimaryButton>
        <UnstyledButton
          type="button"
          className={styles.textAction}
          onClick={() => o.authed ? o.finish() : navigate('/login?from=/')}
        >
          {o.authed ? 'فعلاً به صفحهٔ اصلی برگرد' : 'قبلاً حساب داری؟ ورود'}
        </UnstyledButton>
      </Box>
    </Box>
  );
}

function StepHeader({ onboarding, review = false }) {
  const o = onboarding;
  const meta = o.stepMeta;
  const progress = review ? 100 : Math.round((o.progressIndex / o.progressTotal) * 100);
  return (
    <header className={styles.header}>
      <Box className={styles.headerRow}>
        <UnstyledButton type="button" className={styles.backButton} onClick={o.back} aria-label="بازگشت به مرحلهٔ قبل">
          <IconChevronRight size={21} stroke={1.8} aria-hidden="true" />
        </UnstyledButton>
        <Box className={styles.headerCopy}>
          <Text component="span" className={styles.headerTitle}>{review ? 'مرور نهایی' : meta?.title}</Text>
          <Text component="span" className={styles.headerCounter}>
            {review ? 'قبل از ساخت پیشنهادها' : `گام ${toFaDigits(o.progressIndex)} از ${toFaDigits(o.progressTotal)}`}
          </Text>
        </Box>
        {meta?.optional && !review ? <Text component="span" className={styles.optionalBadge}>اختیاری</Text> : <span aria-hidden="true" />}
      </Box>
      <Box
        className={styles.progressTrack}
        role="progressbar"
        aria-label="پیشرفت آنبردینگ"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <Box className={styles.progressFill} style={{ inlineSize: `${progress}%` }} />
      </Box>
    </header>
  );
}

function StepIntro({ title, lead }) {
  return (
    <>
      <Text tabIndex={-1} data-onboarding-heading component="h1" className={styles.stepHeading}>{title}</Text>
      <Text component="p" className={styles.stepLead}>{lead}</Text>
    </>
  );
}

function ChoiceCard({ option, selected, onClick, radio = false, tabIndex }) {
  const reduceMotion = useReducedMotion();
  const Icon = option.Icon;
  return (
    <motion.button
      type="button"
      className={styles.choiceCard}
      data-selected={selected}
      data-radio-value={radio ? option.id : undefined}
      role={radio ? 'radio' : undefined}
      aria-checked={radio ? selected : undefined}
      aria-pressed={radio ? undefined : selected}
      tabIndex={radio ? tabIndex : undefined}
      onClick={onClick}
      whileTap={!reduceMotion ? { scale: 0.99 } : undefined}
    >
      {Icon ? <span className={styles.choiceIcon} aria-hidden="true"><Icon size={20} stroke={1.8} /></span> : null}
      <span className={styles.choiceCopy}>
        <span className={styles.choiceTitle}>{option.label}</span>
        {option.description ? <span className={styles.choiceDescription}>{option.description}</span> : null}
      </span>
      {selected ? <IconCheck className={styles.choiceCheck} size={19} stroke={2.3} aria-hidden="true" /> : null}
    </motion.button>
  );
}

function SafetyChip({ option, selected, disabled, kind, onClick }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.button
      type="button"
      className={styles.chip}
      data-selected={selected}
      data-safety={kind}
      aria-pressed={selected}
      disabled={disabled}
      title={disabled ? 'این مورد در دستهٔ دیگر انتخاب شده؛ ابتدا آن را بردار.' : undefined}
      onClick={onClick}
      whileTap={!disabled && !reduceMotion ? { scale: 0.98 } : undefined}
    >
      <span className={styles.chipLabel}>{option.label}</span>
      {selected ? <IconCheck size={17} stroke={2.2} aria-hidden="true" /> : null}
    </motion.button>
  );
}

function SafetyStep({ o }) {
  const safety = o.answers.safety;
  const selectedAllergyLabels = allergenLabels(safety.allergyIds);
  const selectedIntoleranceLabels = allergenLabels(safety.intoleranceIds);
  const noneSelected = safety.status === 'none' && !safety.allergyIds.length && !safety.intoleranceIds.length;
  return (
    <Box className={styles.step}>
      <StepIntro
        title="اول مطمئن شویم غذا برایت مناسب است"
        lead="آلرژی و عدم‌تحمل دو معنی متفاوت دارند؛ هر مورد را فقط در دستهٔ درست ثبت کن."
      />
      <Box className={styles.notice}>
        <IconAlertTriangle size={17} stroke={1.9} aria-hidden="true" />
        <span>گارنیش از موارد اعلام‌شده پرهیز می‌کند، اما جای بررسی برچسب مواد یا توصیهٔ پزشکی را نمی‌گیرد.</span>
      </Box>

      <Box className={styles.section}>
        <motion.button
          type="button"
          className={styles.noneCard}
          data-selected={noneSelected}
          aria-pressed={noneSelected}
          onClick={o.setSafetyNone}
        >
          <span className={styles.choiceIcon} aria-hidden="true"><IconShieldCheck size={20} stroke={1.8} /></span>
          <span className={styles.choiceCopy}>
            <span className={styles.choiceTitle}>آلرژی یا عدم‌تحمل غذایی ندارم</span>
            <span className={styles.choiceDescription}>هیچ موردی برای حذف ایمنی ثبت نمی‌شود</span>
          </span>
          {noneSelected ? <IconCheck className={styles.choiceCheck} size={19} stroke={2.3} aria-hidden="true" /> : null}
        </motion.button>
      </Box>

      <Box className={styles.divider}>یا مواردت را انتخاب کن</Box>

      <section className={styles.section} aria-labelledby="allergy-title">
        <Text id="allergy-title" component="h2" className={styles.sectionTitle}>آلرژی غذایی تشخیص‌داده‌شده</Text>
        <Text component="p" className={styles.sectionHelp}>برای فیلتر ایمنی سخت؛ شدت واکنش پرسیده نمی‌شود.</Text>
        <Box className={styles.chipGrid}>
          {ONBOARDING_ALLERGEN_OPTIONS.map((option) => (
            <SafetyChip
              key={option.id}
              option={option}
              kind="allergy"
              selected={safety.allergyIds.includes(option.id)}
              disabled={safety.intoleranceIds.includes(option.id)}
              onClick={() => o.toggleAllergy(option.id)}
            />
          ))}
        </Box>
      </section>

      <details className={styles.details} open={Boolean(safety.intoleranceIds.length)}>
        <summary className={styles.detailsSummary}>عدم‌تحمل غذایی هم دارم</summary>
        <Box className={styles.detailsBody}>
          <Text component="p" className={styles.sectionHelp}>مثل ناراحتی گوارشی؛ این مورد آلرژی پزشکی محسوب نمی‌شود.</Text>
          <Box className={styles.chipGrid}>
            {ONBOARDING_ALLERGEN_OPTIONS.map((option) => (
              <SafetyChip
                key={option.id}
                option={option}
                kind="intolerance"
                selected={safety.intoleranceIds.includes(option.id)}
                disabled={safety.allergyIds.includes(option.id)}
                onClick={() => o.toggleIntolerance(option.id)}
              />
            ))}
          </Box>
        </Box>
      </details>

      {selectedAllergyLabels.length || selectedIntoleranceLabels.length ? (
        <Box className={styles.selectionSummary} role="status">
          {selectedAllergyLabels.length ? <div><strong>آلرژی:</strong> {selectedAllergyLabels.join('، ')}</div> : null}
          {selectedIntoleranceLabels.length ? <div><strong>عدم تحمل:</strong> {selectedIntoleranceLabels.join('، ')}</div> : null}
        </Box>
      ) : null}
    </Box>
  );
}

function DietStep({ o }) {
  return (
    <Box className={styles.step}>
      <StepIntro
        title="چه الگوی غذایی‌ای بیشتر شبیه توست؟"
        lead="نزدیک‌ترین گزینه را انتخاب کن؛ این پاسخ روی فیلتر و ترتیب پیشنهادها اثر مستقیم دارد."
      />
      <Box
        className={styles.choiceList}
        role="radiogroup"
        aria-label="الگوی غذایی"
        onKeyDown={(event) => moveRadioSelection(event, o.setDietPattern)}
      >
        {PATTERN_OPTIONS.map((option, index) => (
          <ChoiceCard
            key={option.id}
            option={option}
            selected={o.answers.dietPattern === option.id}
            onClick={() => o.setDietPattern(option.id)}
            radio
            tabIndex={o.answers.dietPattern === option.id || (!o.answers.dietPattern && index === 0) ? 0 : -1}
          />
        ))}
      </Box>

      <section className={styles.section} aria-labelledby="rule-title">
        <Text id="rule-title" component="h2" className={styles.sectionTitle}>محدودیت غذایی دیگری داری؟</Text>
        <Text component="p" className={styles.sectionHelp}>اختیاری؛ فقط گزینه‌ای نمایش داده می‌شود که فیلتر آن در داده‌های فعلی قابل‌اعمال است.</Text>
        <Box className={styles.choiceList}>
          {DIETARY_RULE_OPTIONS.map((option) => (
            <ChoiceCard
              key={option.id}
              option={option}
              selected={o.answers.dietaryRules.includes(option.id)}
              onClick={() => o.toggleDietaryRule(option.id)}
            />
          ))}
        </Box>
      </section>
    </Box>
  );
}

function TimeStep({ o }) {
  return (
    <Box className={styles.step}>
      <StepIntro
        title="در یک روز معمولی چقدر وقت داری؟"
        lead="زمان و تعداد نفرات برای انتخاب دستور و اندازهٔ برنامهٔ غذایی استفاده می‌شوند."
      />
      <section className={styles.section} aria-labelledby="time-title">
        <Text id="time-title" component="h2" className={styles.sectionTitle}>زمان آماده‌سازی و پخت</Text>
        <Box
          className={styles.choiceList}
          role="radiogroup"
          aria-label="زمان آشپزی"
          onKeyDown={(event) => moveRadioSelection(event, o.setWeekdayTimeBucket)}
        >
          {COOKTIME_OPTIONS.map((option, index) => (
            <ChoiceCard
              key={option.id}
              option={option}
              selected={o.answers.weekdayTimeBucket === option.id}
              onClick={() => o.setWeekdayTimeBucket(option.id)}
              radio
              tabIndex={o.answers.weekdayTimeBucket === option.id || (!o.answers.weekdayTimeBucket && index === 0) ? 0 : -1}
            />
          ))}
        </Box>
      </section>

      <section className={styles.section} aria-labelledby="count-title">
        <Text id="count-title" component="h2" className={styles.sectionTitle}>معمولاً برای چند نفر آشپزی می‌کنی؟</Text>
        <Box
          className={styles.chipGrid}
          role="radiogroup"
          aria-label="تعداد نفرات"
          onKeyDown={(event) => moveRadioSelection(event, o.setCooksForCount)}
        >
          {COOKS_FOR_OPTIONS.map((option, index) => (
            <motion.button
              key={option.id}
              type="button"
              className={styles.chip}
              data-selected={o.answers.cooksForCount === option.id}
              data-radio-value={option.id}
              role="radio"
              aria-checked={o.answers.cooksForCount === option.id}
              tabIndex={o.answers.cooksForCount === option.id || (!o.answers.cooksForCount && index === 0) ? 0 : -1}
              onClick={() => o.setCooksForCount(option.id)}
            >
              <span className={styles.chipLabel}>{option.label}</span>
              {o.answers.cooksForCount === option.id ? <IconCheck size={17} stroke={2.2} aria-hidden="true" /> : <IconUsers size={17} stroke={1.8} aria-hidden="true" />}
            </motion.button>
          ))}
        </Box>
      </section>
    </Box>
  );
}

function TasteStep({ o }) {
  return (
    <Box className={styles.step}>
      <StepIntro
        title="با چند غذای واقعی، شروع را دقیق‌تر کنیم"
        lead="این مرحله اختیاری است. پسند یا نپسند تو فقط جهت پیشنهادها را تنظیم می‌کند؛ چیزی را برای همیشه حذف نمی‌کند."
      />
      <Box className={styles.consentCard}>
        <label className={styles.consentLabel}>
          <input
            className={styles.consentCheckbox}
            type="checkbox"
            checked={o.personalizationConsent}
            onChange={(event) => o.setPersonalizationConsent(event.target.checked)}
          />
          <span>
            <span className={styles.consentTitle}>می‌خواهم این انتخاب‌ها برای شخصی‌سازی ذخیره شوند</span>
            <span className={styles.consentHelp}>اختیاری و قابل‌لغو است. تا وقتی فعالش نکنی، هیچ انتخاب ذائقه‌ای روی سرور ذخیره نمی‌شود.</span>
          </span>
        </label>
      </Box>
      {o.personalizationConsent ? (
        <TasteBuilder
          likes={o.answers.taste.likes}
          dislikes={o.answers.taste.dislikes}
          onAdd={o.addTaste}
          onRemove={o.removeTaste}
        />
      ) : (
        <Box className={styles.inlineState} role="status">
          این مرحله رد می‌شود و پیشنهادهای اولیه فقط از محدودیت‌های ایمنی، الگوی غذایی و زمان آشپزی استفاده می‌کنند.
        </Box>
      )}
    </Box>
  );
}

function ErrorBox({ onboarding }) {
  const o = onboarding;
  if (!o.error) return null;
  return (
    <Box className={styles.errorBox} role="alert">
      {o.error}
      {o.revisionConflict ? (
        <Box className={styles.errorActions}>
          <UnstyledButton type="button" className={styles.errorAction} onClick={o.reloadDraft}>
            بارگذاری آخرین نسخه
          </UnstyledButton>
        </Box>
      ) : null}
    </Box>
  );
}

function QuestionFooter({ o }) {
  const labels = {
    2: 'ثبت ایمنی و ادامه',
    3: 'ثبت الگوی غذایی',
    4: 'ثبت زمان و تعداد',
    5: 'بررسی انتخاب‌ها',
  };
  return (
    <footer className={styles.footer}>
      <ErrorBox onboarding={o} />
      <PrimaryButton disabled={!o.canContinue || o.saving} onClick={o.continueStep}>
        {o.saving ? <><IconLoader2 className={styles.spinner} size={19} aria-hidden="true" />در حال ذخیره…</> : <>{labels[o.step]}<IconArrowLeft size={19} stroke={1.9} aria-hidden="true" /></>}
      </PrimaryButton>
      {o.step === 5 ? (
        <UnstyledButton type="button" className={styles.skipAction} onClick={o.skipTaste} disabled={o.saving}>
          فعلاً بدون کالیبراسیون ادامه می‌دهم
        </UnstyledButton>
      ) : null}
    </footer>
  );
}

function QuestionFlow({ o }) {
  const reduceMotion = useReducedMotion();
  const StepComponent = o.step === 2 ? SafetyStep : o.step === 3 ? DietStep : o.step === 4 ? TimeStep : TasteStep;
  return (
    <>
      <StepHeader onboarding={o} />
      <Box className={styles.content} data-onboarding-scroll>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={o.step}
            data-onboarding-panel={o.step}
            initial={reduceMotion ? false : { opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, x: 10 }}
            transition={reduceMotion ? { duration: 0 } : transition}
          >
            <StepComponent o={o} />
          </motion.div>
        </AnimatePresence>
        <Box className={styles.srStatus} role="status" aria-live="polite">{o.statusMessage}</Box>
      </Box>
      <QuestionFooter o={o} />
    </>
  );
}

function ReviewRow({ icon: Icon, label, value, onEdit }) {
  return (
    <Box className={styles.reviewCard}>
      <span className={styles.reviewIcon} aria-hidden="true"><Icon size={19} stroke={1.8} /></span>
      <span className={styles.reviewCopy}>
        <span className={styles.reviewLabel}>{label}</span>
        <span className={styles.reviewValue}>{value}</span>
      </span>
      <UnstyledButton type="button" className={styles.editButton} onClick={onEdit} aria-label={`ویرایش ${label}`}>
        <IconEdit size={16} stroke={1.8} aria-hidden="true" /> ویرایش
      </UnstyledButton>
    </Box>
  );
}

function Review({ o }) {
  return (
    <>
      <StepHeader onboarding={o} review />
      <Box className={styles.content} data-onboarding-scroll>
        <Box className={styles.step}>
          <Text tabIndex={-1} data-onboarding-heading component="h1" className={styles.reviewHeading}>این پروفایل اولیهٔ توست</Text>
          <Text component="p" className={styles.stepLead}>قبل از ساخت پیشنهادها، پاسخ‌ها را یک‌بار مرور کن. الگوی غذایی و حساسیت‌ها را بعداً هم می‌توانی از تنظیمات تغییر بدهی.</Text>
          <Box className={styles.reviewList}>
            <ReviewRow icon={IconShieldCheck} label="ایمنی" value={o.summary.safety} onEdit={() => o.go(2)} />
            <ReviewRow
              icon={IconLeaf}
              label="الگوی غذایی"
              value={`${o.summary.diet}${o.summary.rules.length ? ` · ${o.summary.rules.join('، ')}` : ''}`}
              onEdit={() => o.go(3)}
            />
            <ReviewRow icon={IconClock} label="زمان و تعداد" value={`${o.summary.time} · ${o.summary.cooksFor}`} onEdit={() => o.go(4)} />
            {o.personalizationAvailable ? (
              <ReviewRow
                icon={IconHeart}
                label="کالیبراسیون ذائقه"
                value={o.summary.tasteCount
                  ? `${toFaDigits(o.summary.tasteCount)} انتخاب`
                  : 'ثبت نشده؛ پیشنهادهای اولیه از محدودیت‌ها و ترجیحات صریح ساخته می‌شوند'}
                onEdit={() => o.go(5)}
              />
            ) : null}
          </Box>

          {o.personalizationAvailable ? (
            <Box className={styles.consentCard}>
              <label className={styles.consentLabel}>
                <input
                  className={styles.consentCheckbox}
                  type="checkbox"
                  checked={o.personalizationConsent}
                  onChange={(event) => o.setPersonalizationConsent(event.target.checked)}
                />
                <span>
                  <span className={styles.consentTitle}>یادگیری خودکار ذائقه را فعال کن</span>
                  <span className={styles.consentHelp}>اختیاری و قابل‌لغو است؛ با فعال‌بودن آن، انتخاب‌های ذائقه برای بهترشدن پیشنهادها استفاده می‌شوند. استفاده از رفتارهای بعدی نیازمند فعال‌کردن جداگانهٔ آمار استفاده است و محدودیت‌های ایمنی مستقل باقی می‌مانند.</span>
                </span>
              </label>
            </Box>
          ) : null}
          {!o.termsAccepted ? (
            <Box className={styles.consentCard}>
              <label className={styles.consentLabel}>
                <input
                  className={styles.consentCheckbox}
                  type="checkbox"
                  checked={false}
                  onChange={(event) => o.setTermsAccepted(event.target.checked)}
                />
                <span>
                  <span className={styles.consentTitle}>شرایط استفاده را می‌پذیرم</span>
                  <span className={styles.consentHelp}>
                    <Link className={styles.legalLink} to="/terms" target="_blank" rel="noreferrer">شرایط استفاده</Link>
                    {' و '}
                    <Link className={styles.legalLink} to="/privacy" target="_blank" rel="noreferrer">اطلاعیهٔ حریم خصوصی</Link>
                    {' را خوانده‌ام.'}
                  </span>
                </span>
              </label>
            </Box>
          ) : (
            <Box className={styles.inlineState} role="status">شرایط و اطلاعیهٔ حریم خصوصی پذیرفته شده‌اند.</Box>
          )}
        </Box>
      </Box>
      <footer className={styles.footer}>
        <ErrorBox onboarding={o} />
        <PrimaryButton disabled={o.saving} onClick={o.complete}>
          {o.saving ? <><IconLoader2 className={styles.spinner} size={19} aria-hidden="true" />در حال ساخت پروفایل…</> : <>{!o.personalizationAvailable ? 'ساخت پروفایل و ادامه' : o.personalizationConsent ? 'فعال‌کردن یادگیری و ادامه' : 'ذخیره بدون یادگیری خودکار'}<IconArrowLeft size={19} stroke={1.9} aria-hidden="true" /></>}
        </PrimaryButton>
      </footer>
    </>
  );
}

function Result({ o }) {
  const reduceMotion = useReducedMotion();
  const actionableRecommendations = o.recommendations.filter((recipe) => Boolean(recipe?.id));
  return (
    <Box className={styles.result}>
      <Box className={styles.resultMain}>
        <motion.div
          className={styles.successMark}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.78 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: [0.78, 1.06, 1] }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.44, ease: [0.16, 1, 0.3, 1] }}
          aria-hidden="true"
        >
          <IconCheck size={42} stroke={2.1} />
        </motion.div>
        <Text component="span" className={styles.eyebrow}>پروفایل اولیه آماده است</Text>
        <Text tabIndex={-1} data-onboarding-heading component="h1" className={styles.resultTitle}>از همین حالا پیشنهادها دقیق‌تر می‌شوند</Text>
        <Text component="p" className={styles.resultCopy}>
          {o.personalizationConsent
            ? 'این نتیجه قطعی نیست؛ گارنیش با ذخیره، ردکردن و پختن غذاها به‌مرور بهتر یاد می‌گیرد.'
            : 'فعلاً پیشنهادها بر اساس تنظیمات صریح و محدودیت‌های ایمنی تو هستند؛ یادگیری خودکار خاموش می‌ماند.'}
        </Text>

        {o.recommendationsLoading ? (
          <Box className={styles.recommendations} role="status" aria-label="در حال بارگذاری پیشنهادهای واقعی">
            {[0, 1, 2].map((index) => <Box className={styles.skeleton} key={index} />)}
          </Box>
        ) : null}

        {!o.recommendationsLoading && actionableRecommendations.length ? (
          <Box className={styles.recommendations} aria-label="پیشنهادهای اولیه">
            {actionableRecommendations.map((recipe, index) => (
              <Link className={styles.recommendationCard} to={`/recipe/${encodeURIComponent(recipe.id)}`} key={`${recipe.id}:${index}`}>
                <span className={styles.recommendationIndex}>{toFaDigits(index + 1)}</span>
                <span className={styles.recommendationCopy}>
                  <span className={styles.recommendationTitle}>{recipe.title}</span>
                  <span className={styles.recommendationMeta}>{recommendationMeta(recipe)}</span>
                </span>
                <IconChevronLeft size={18} stroke={1.8} aria-hidden="true" />
              </Link>
            ))}
          </Box>
        ) : null}

        {!o.recommendationsLoading && o.recommendationsError ? (
          <Box className={styles.resultState} role="alert">
            {o.recommendationsError}
            <Box className={styles.errorActions}>
              <UnstyledButton type="button" className={styles.errorAction} onClick={() => o.retryRecommendations()}>
                <IconRefresh size={15} stroke={1.8} aria-hidden="true" /> تلاش دوباره
              </UnstyledButton>
            </Box>
          </Box>
        ) : null}

        {!o.recommendationsLoading && !o.recommendationsError && !actionableRecommendations.length ? (
          <Box className={styles.resultState}>پروفایل ذخیره شده است؛ پیشنهادها را در صفحهٔ اصلی می‌بینی.</Box>
        ) : null}
      </Box>
      <Box className={styles.resultActions}>
        <PrimaryButton onClick={o.finish}>ورود به گارنیش<IconArrowLeft size={19} stroke={1.9} aria-hidden="true" /></PrimaryButton>
        <a className={styles.textAction} href="/settings#food-profile">ویرایش الگو و حساسیت‌ها در تنظیمات</a>
      </Box>
    </Box>
  );
}

function HydrationGate() {
  return (
    <Box className={styles.hydrationGate} role="status" aria-live="polite" aria-busy="true">
      <IconLoader2 className={styles.spinner} size={24} aria-hidden="true" />
      <Text component="p" className={styles.hydrationCopy}>در حال بارگذاری آخرین پروفایل ذخیره‌شده…</Text>
    </Box>
  );
}

export default function OnboardingPage() {
  const onboarding = useOnboarding();

  useEffect(() => {
    if (onboarding.hydrating) return undefined;
    const isQuestion = onboarding.step >= 2 && onboarding.step <= 5;
    const selector = isQuestion
      ? `[data-onboarding-panel="${onboarding.step}"] [data-onboarding-heading]`
      : '[data-onboarding-heading]';

    const focusCurrentHeading = () => {
      const heading = document.querySelector(selector);
      if (!heading) return false;
      heading.focus({ preventScroll: true });
      return true;
    };

    if (focusCurrentHeading()) return undefined;

    // AnimatePresence keeps the outgoing question in the DOM until its exit
    // finishes. Wait for the panel that belongs to the new step so focus does
    // not fall back to <body> when the outgoing heading is removed.
    const observer = new MutationObserver(() => {
      if (focusCurrentHeading()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const fallback = window.setTimeout(() => {
      observer.disconnect();
      focusCurrentHeading();
    }, 1_000);

    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, [onboarding.hydrating, onboarding.step]);

  return (
    <Frame>
      {onboarding.hydrating ? <HydrationGate /> : null}
      {!onboarding.hydrating && onboarding.step === 1 ? <Welcome onboarding={onboarding} /> : null}
      {!onboarding.hydrating && onboarding.step >= 2 && onboarding.step <= 5 ? <QuestionFlow o={onboarding} /> : null}
      {!onboarding.hydrating && onboarding.step === 6 ? <Review o={onboarding} /> : null}
      {!onboarding.hydrating && onboarding.step === 7 ? <Result o={onboarding} /> : null}
    </Frame>
  );
}
