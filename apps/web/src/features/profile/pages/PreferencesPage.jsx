import { useState, useEffect } from 'react';
import {
  Container, Title, Text, Paper, Stack, Group, Badge,
  Button, useMantineColorScheme, Select,
  TextInput, ScrollArea, Accordion, Divider, Alert,
  ActionIcon, Box
} from '@mantine/core';
import {
  IconEdit, IconCheck,
  IconAlertTriangle, IconArrowUp, IconPalette
} from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePreferencesQuery } from '../../../hooks/usePreferencesQuery';
import { useAnalytics } from '../../../hooks/useAnalytics'; // 👈 جدید

const DIETS = [
  { value: 'omnivore', label: 'همه‌چیزخوار', icon: '🥩', desc: 'بدون محدودیت غذایی' },
  { value: 'vegetarian', label: 'گیاه‌خوار', icon: '🥬', desc: 'بدون گوشت قرمز، مرغ و ماهی' },
  { value: 'lacto_ovo_vegetarian', label: 'لاکتو-اوو وجترین', icon: '🥚', desc: 'شیر و تخم‌مرغ مجاز' },
  { value: 'lacto_vegetarian', label: 'لاکتو وجترین', icon: '🥛', desc: 'شیر مجاز، تخم‌مرغ غیرمجاز' },
  { value: 'ovo_vegetarian', label: 'اوو وجترین', icon: '🍳', desc: 'تخم‌مرغ مجاز، شیر غیرمجاز' },
  { value: 'pescatarian', label: 'پِسکی‌تارین', icon: '🐟', desc: 'ماهی و غذاهای دریایی مجاز' },
  { value: 'flexitarian', label: 'فلکسی‌تارین', icon: '🥗', desc: 'کاهش مصرف گوشت' },
  { value: 'pollo_vegetarian', label: 'پولو وجترین', icon: '🍗', desc: 'فقط مرغ مجاز است' },
  { value: 'vegan', label: 'وگان', icon: '🌱', desc: 'بدون هیچ محصول حیوانی' },
  { value: 'raw_vegan', label: 'خام‌گیاه‌خوار', icon: '🥒', desc: 'غذاهای خام و فرآوری‌نشدهٔ گیاهی' },
  { value: 'ketogenic', label: 'کتوژنیک', icon: '🧈', desc: 'پرچرب، کم‌کربوهیدرات' },
  { value: 'paleo', label: 'پالئو', icon: '🍖', desc: 'غذاهای طبیعی و غیرصنعتی' },
  { value: 'low_carb', label: 'کم‌کربوهیدرات', icon: '🍞', desc: 'کاهش مصرف کربوهیدرات‌ها' },
  { value: 'mediterranean', label: 'مدیترانه‌ای', icon: '🫒', desc: 'غنی از سبزیجات، ماهی و روغن زیتون' },
  { value: 'dash', label: 'دَش (کم‌نمک)', icon: '🧂', desc: 'کاهش سدیم برای فشار خون' },
  { value: 'gluten_free', label: 'بدون گلوتن', icon: '🌾', desc: 'مناسب سلیاک' },
  { value: 'dairy_free', label: 'بدون لبنیات', icon: '🥛', desc: 'حذف شیر و محصولات لبنی' },
  { value: 'halal', label: 'حلال', icon: '🕌', desc: 'مطابق با قوانین اسلامی' },
  { value: 'kosher', label: 'کوشر', icon: '✡️', desc: 'مطابق با قوانین یهودیت' },
];

const ALLERGENS = [
  { value: 'milk', label: 'شیر', icon: '🥛', group: 'big8' },
  { value: 'eggs', label: 'تخم‌مرغ', icon: '🥚', group: 'big8' },
  { value: 'fish', label: 'ماهی', icon: '🐟', group: 'big8' },
  { value: 'shellfish', label: 'صدف سخت‌پوست', icon: '🦐', group: 'big8' },
  { value: 'tree_nuts', label: 'آجیل درختی', icon: '🥜', group: 'big8' },
  { value: 'peanuts', label: 'بادام‌زمینی', icon: '🥜', group: 'big8' },
  { value: 'wheat', label: 'گندم', icon: '🌾', group: 'big8' },
  { value: 'soy', label: 'سویا', icon: '🫘', group: 'big8' },
  { value: 'sesame', label: 'کنجد', icon: '🫘', group: 'other' },
  { value: 'celery', label: 'کرفس', icon: '🥬', group: 'other' },
  { value: 'mustard', label: 'خردل', icon: '🟡', group: 'other' },
  { value: 'lupin', label: 'لوپین', icon: '🫘', group: 'other' },
  { value: 'sulfites', label: 'سولفیت‌ها', icon: '🧪', group: 'other' },
  { value: 'coconut', label: 'نارگیل', icon: '🥥', group: 'other' },
  { value: 'corn', label: 'ذرت', icon: '🌽', group: 'other' },
  { value: 'gelatin', label: 'ژلاتین', icon: '🍮', group: 'other' },
  { value: 'yeast', label: 'مخمر', icon: '🍞', group: 'other' },
  { value: 'red_meat', label: 'گوشت قرمز', icon: '🥩', group: 'other' },
  { value: 'poultry', label: 'گوشت مرغ', icon: '🍗', group: 'other' },
  { value: 'seafood', label: 'غذاهای دریایی', icon: '🦞', group: 'other' },
  { value: 'honey', label: 'عسل', icon: '🍯', group: 'other' },
  { value: 'caffeine', label: 'کافئین', icon: '☕', group: 'other' },
  { value: 'alcohol', label: 'الکل', icon: '🍷', group: 'other' },
  { value: 'msg', label: 'MSG', icon: '🧂', group: 'additive' },
  { value: 'artificial_colors', label: 'رنگ مصنوعی', icon: '🎨', group: 'additive' },
  { value: 'nitrates', label: 'نیترات‌ها', icon: '🥓', group: 'additive' },
  { value: 'artificial_sweeteners', label: 'شیرین‌کننده مصنوعی', icon: '🍬', group: 'additive' },
  { value: 'lentils', label: 'عدس', icon: '🫘', group: 'legume' },
  { value: 'chickpeas', label: 'نخود', icon: '🫘', group: 'legume' },
  { value: 'beans', label: 'لوبیا', icon: '🫘', group: 'legume' },
  { value: 'tomatoes', label: 'گوجه فرنگی', icon: '🍅', group: 'vegetables' },
  { value: 'bell_peppers', label: 'فلفل دلمه‌ای', icon: '🫑', group: 'vegetables' },
  { value: 'eggplant', label: 'بادمجان', icon: '🍆', group: 'vegetables' },
  { value: 'potatoes', label: 'سیب‌زمینی', icon: '🥔', group: 'vegetables' },
  { value: 'spinach', label: 'اسفناج', icon: '🥬', group: 'vegetables' },
  { value: 'broccoli', label: 'کلم بروکلی', icon: '🥦', group: 'vegetables' },
  { value: 'strawberries', label: 'توت‌فرنگی', icon: '🍓', group: 'fruits' },
  { value: 'kiwi', label: 'کیوی', icon: '🥝', group: 'fruits' },
  { value: 'banana', label: 'موز', icon: '🍌', group: 'fruits' },
  { value: 'pineapple', label: 'آناناس', icon: '🍍', group: 'fruits' },
  { value: 'citrus', label: 'مرکبات', icon: '🍊', group: 'fruits' },
  { value: 'peach', label: 'هلو', icon: '🍑', group: 'fruits' },
  { value: 'apple', label: 'سیب', icon: '🍎', group: 'fruits' },
  { value: 'pear', label: 'گلابی', icon: '🍐', group: 'fruits' },
  { value: 'cinnamon', label: 'دارچین', icon: '🌿', group: 'spices' },
  { value: 'ginger', label: 'زنجبیل', icon: '🫚', group: 'spices' },
  { value: 'garlic', label: 'سیر', icon: '🧄', group: 'spices' },
  { value: 'onion', label: 'پیاز', icon: '🧅', group: 'spices' },
  { value: 'saffron', label: 'زعفران', icon: '🌸', group: 'spices' },
  { value: 'vanilla', label: 'وانیل', icon: '🌼', group: 'spices' },
  { value: 'black_pepper', label: 'فلفل سیاه', icon: '🌶️', group: 'spices' },
  { value: 'cumin', label: 'زیره', icon: '🌿', group: 'spices' },
  { value: 'turmeric', label: 'زردچوبه', icon: '🟡', group: 'spices' },
  { value: 'pork', label: 'گوشت خوک', icon: '🐷', group: 'religious' },
  { value: 'non_halal_meat', label: 'گوشت غیر حلال', icon: '🥩', group: 'religious' },
  { value: 'non_kosher', label: 'غیر کوشر', icon: '🥩', group: 'religious' },
  { value: 'beef', label: 'گوشت گاو', icon: '🐄', group: 'religious' },
];

const ALLERGEN_GROUPS = {
  big8: { label: '۸ آلرژن اصلی', color: 'red', icon: '⚠️' },
  other: { label: 'آلرژن‌های مهم', color: 'orange', icon: '🔶' },
  additive: { label: 'افزودنی‌ها', color: 'yellow', icon: '🧪' },
  legume: { label: 'حبوبات', color: 'green', icon: '🫘' },
  vegetables: { label: 'سبزیجات', color: 'teal', icon: '🥬' },
  fruits: { label: 'میوه‌ها', color: 'blue', icon: '🍎' },
  spices: { label: 'ادویه‌ها و طعم‌دهنده‌ها', color: 'violet', icon: '🌿' },
  religious: { label: 'محدودیت‌های مذهبی/فرهنگی', color: 'grape', icon: '🕊️' },
};

const SKILL_LEVELS = [
  { value: 'beginner', label: 'مبتدی' },
  { value: 'intermediate', label: 'متوسط' },
  { value: 'advanced', label: 'حرفه‌ای' },
];

export default function PreferencesPage() {
  const { preferences, updatePreferences, loading } = usePreferencesQuery();
  const { trackEvent } = useAnalytics(); // 👈 جدید
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';

  const [editMode, setEditMode] = useState(false);
  const [diet, setDiet] = useState(preferences?.diet || 'omnivore');
  const [allergies, setAllergies] = useState(preferences?.allergies || []);
  const [skill, setSkill] = useState(preferences?.skill || 'beginner');
  const [saved, setSaved] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setDiet(preferences?.diet || 'omnivore');
    setAllergies(preferences?.allergies || []);
    setSkill(preferences?.skill || 'beginner');
  }, [preferences]);

  const handleSave = async () => {
    await updatePreferences({ diet, allergies, skill });
    // 👇 ردیابی ذخیره تنظیمات
    trackEvent('preference_update', { diet, allergies, skill });
    setSaved(true);
    setEditMode(false);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleAllergyToggle = (allergen) => {
    setAllergies(prev =>
      prev.includes(allergen)
        ? prev.filter(a => a !== allergen)
        : [...prev, allergen]
    );
    // 👇 ردیابی تغییر آلرژی
    trackEvent('allergy_changed', { 
      allergen, 
      action: allergies.includes(allergen) ? 'removed' : 'added' 
    });
  };

  const dietLabel = DIETS.find(d => d.value === diet)?.label || diet;
  const skillLabel = SKILL_LEVELS.find(s => s.value === skill)?.label || skill;

  const allergyBadges = allergies.map(allergy => {
    const allergen = ALLERGENS.find(a => a.value === allergy);
    return allergen ? `${allergen.icon} ${allergen.label}` : allergy;
  });

  const filteredAllergens = searchQuery
    ? ALLERGENS.filter(a => a.label.includes(searchQuery))
    : ALLERGENS;

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <Container size="xs" style={{ maxWidth: 420, margin: '0 auto', padding: '0 8px 40px' }}>
      <Box mb="lg" mt="md">
        <Group gap="xs" align="center">
          <IconPalette size={32} style={{ color: 'var(--g-color-food-saffron)' }} />
          <Title order={3} style={{ color: 'var(--g-color-text-primary)' }}>تنظیمات سلیقه</Title>
        </Group>
        <Text size="xs" c="dimmed" mt={4}>
          رژیم غذایی، سطح مهارت و آلرژی‌های خود را مدیریت کنید
        </Text>
      </Box>

      <AnimatePresence mode="wait">
        {!editMode ? (
          <motion.div
            key="view"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Paper p="lg" radius="xl" style={{
              border: '1px solid var(--g-color-food-saffron)',
              background: dark ? 'var(--g-color-bg-surface)' : 'var(--g-color-bg-surface)',
              backdropFilter: 'blur(8px)',
              boxShadow: dark ? 'none' : 'var(--g-shadow-1)',
            }}>
              <Group justify="space-between" mb="md">
                <Text fw={700} size="sm" c={dark ? 'var(--g-color-bg-surface)' : 'var(--g-color-text-primary)'}>خلاصه سلیقهٔ شما</Text>
                <Button 
                  variant="light" 
                  color="orange" 
                  size="xs" 
                  radius="xl" 
                  leftSection={<IconEdit size={16} />} 
                  onClick={() => { 
                    setEditMode(true); 
                    trackEvent('preference_edit_start'); 
                  }}
                >
                  ویرایش
                </Button>
              </Group>
              <Stack gap="sm">
                <Group gap="xs">
                  <Text size="sm" fw={500}>رژیم:</Text>
                  <Badge variant="filled" color="orange" size="lg" radius="xl">{dietLabel}</Badge>
                </Group>
                <Group gap="xs">
                  <Text size="sm" fw={500}>سطح مهارت:</Text>
                  <Badge variant="light" color="blue" size="lg" radius="xl">{skillLabel}</Badge>
                </Group>
                <Group gap="xs" align="flex-start">
                  <Text size="sm" fw={500}>حساسیت‌ها:</Text>
                  {allergies.length > 0 ? (
                    <Group gap="xs">
                      {allergyBadges.map((badge, idx) => (
                        <Badge key={idx} variant="dot" color="red" size="sm" radius="xl">{badge}</Badge>
                      ))}
                    </Group>
                  ) : (
                    <Text size="sm" c="dimmed">هیچ‌کدام</Text>
                  )}
                </Group>
              </Stack>
              <Text size="xs" c="dimmed" mt="md">
                این تنظیمات برای دستیار هوش مصنوعی، برنامه هفتگی و پیشنهادهای غذایی شما استفاده می‌شوند.
              </Text>
              {saved && <Alert color="green" mt="sm" icon={<IconCheck size={16} />}>تنظیمات با موفقیت ذخیره شد.</Alert>}
            </Paper>
          </motion.div>
        ) : (
          <motion.div
            key="edit"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Paper p="md" radius="lg" style={{
              border: '1px solid var(--g-color-food-saffron)',
              background: dark ? 'var(--g-color-bg-surface)' : 'var(--g-color-bg-surface)',
              backdropFilter: 'blur(8px)',
            }}>
              <Stack gap="md">
                <Select
                  label="🥗 رژیم غذایی"
                  data={DIETS.map(d => ({ value: d.value, label: `${d.icon} ${d.label} - ${d.desc}` }))}
                  value={diet}
                  onChange={(val) => { 
                    setDiet(val); 
                    trackEvent('diet_changed', { diet: val }); 
                  }}
                  searchable
                  styles={{
                    input: { textAlign: 'right' },
                    item: { textAlign: 'right' },
                  }}
                />
                {diet !== 'omnivore' && (
                  <Text size="xs" c="green.6">
                    ✅ مواد غذایی متناقض با رژیم {DIETS.find(d => d.value === diet)?.label} به‌طور خودکار فیلتر می‌شوند.
                  </Text>
                )}

                <Select
                  label="👨‍🍳 سطح مهارت"
                  data={SKILL_LEVELS.map(s => ({ value: s.value, label: s.label }))}
                  value={skill}
                  onChange={(val) => { 
                    setSkill(val); 
                    trackEvent('skill_changed', { skill: val }); 
                  }}
                />

                <Divider label="⚠️ آلرژی‌ها و محدودیت‌ها" labelPosition="center" />

                <TextInput
                  placeholder="🔍 جستجوی مادهٔ غذایی..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  radius="xl"
                  size="sm"
                />

                {allergies.length > 0 && (
                  <Group gap="xs" mb="sm">
                    {allergies.map(allergy => {
                      const allergen = ALLERGENS.find(a => a.value === allergy);
                      return (
                        <Badge
                          key={allergy}
                          variant="filled"
                          color="red"
                          size="sm"
                          radius="xl"
                          style={{ cursor: 'pointer' }}
                          rightSection={
                            <ActionIcon
                              size="xs"
                              variant="transparent"
                              onClick={() => handleAllergyToggle(allergen.value)} // 👈 اصلاح شد
                            >
                              <IconAlertTriangle size={10} />
                            </ActionIcon>
                          }
                        >
                          {allergen?.icon} {allergen?.label || allergy}
                        </Badge>
                      );
                    })}
                    <Button 
                      variant="subtle" 
                      size="xs" 
                      color="red" 
                      onClick={() => { 
                        setAllergies([]); 
                        trackEvent('allergy_cleared'); 
                      }}
                    >
                      پاک‌سازی همه
                    </Button>
                  </Group>
                )}

                <ScrollArea h={300} offsetScrollbars>
                  <Accordion variant="contained" radius="md" chevronPosition="left">
                    {Object.entries(ALLERGEN_GROUPS).map(([groupKey, groupInfo]) => {
                      const groupAllergens = filteredAllergens.filter(a => a.group === groupKey);
                      if (groupAllergens.length === 0) return null;

                      return (
                        <Accordion.Item key={groupKey} value={groupKey}>
                          <Accordion.Control>
                            <Group gap="xs">
                              <Text size="sm">{groupInfo.icon}</Text>
                              <Text size="sm" fw={600}>{groupInfo.label}</Text>
                              <Badge size="xs" variant="light" color={groupInfo.color}>
                                {groupAllergens.length}
                              </Badge>
                            </Group>
                          </Accordion.Control>
                          <Accordion.Panel>
                            <Group gap="xs">
                              {groupAllergens.map(allergen => {
                                const isSelected = allergies.includes(allergen.value);
                                return (
                                  <Badge
                                    key={allergen.value}
                                    variant={isSelected ? 'filled' : 'outline'}
                                    color={isSelected ? 'red' : 'gray'}
                                    size="lg"
                                    radius="xl"
                                    style={{ cursor: 'pointer', transition: '0.2s' }}
                                    leftSection={<Text size="sm">{allergen.icon}</Text>}
                                    onClick={() => handleAllergyToggle(allergen.value)} // 👈 اصلاح شد
                                  >
                                    {allergen.label}
                                  </Badge>
                                );
                              })}
                            </Group>
                          </Accordion.Panel>
                        </Accordion.Item>
                      );
                    })}
                  </Accordion>
                </ScrollArea>

                <Group grow>
                  <Button variant="default" onClick={() => setEditMode(false)} radius="xl">انصراف</Button>
                  <Button onClick={handleSave} loading={loading} radius="xl" color="orange">ذخیره تغییرات</Button>
                </Group>
                {saved && <Alert color="green" icon={<IconCheck size={16} />}>تنظیمات با موفقیت ذخیره شد.</Alert>}
              </Stack>
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>

      <ActionIcon
        variant="light"
        color="orange"
        size="xl"
        radius="xl"
        style={{
          position: 'fixed',
          bottom: 80,
          right: 16,
          zIndex: 50,
          boxShadow: 'var(--g-shadow-1)',
        }}
        onClick={scrollToTop}
      >
        <IconArrowUp size={18} />
      </ActionIcon>
    </Container>
  );
}
