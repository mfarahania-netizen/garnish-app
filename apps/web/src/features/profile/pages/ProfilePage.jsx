// features/profile/pages/ProfilePage.jsx
import { useRef, useState, useEffect } from 'react';
import {
  Container, Paper, Group, Text, Avatar, Button,
  Progress, Badge, useMantineColorScheme, ActionIcon,
  Accordion, Box, UnstyledButton, Stack, ThemeIcon,
  SimpleGrid, Skeleton, Modal, TextInput
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import {
  IconEdit, IconLogout, IconSettings, IconCamera,
  IconHeart, IconTrophy, IconPencil, IconCalendar,
  IconChevronLeft, IconArrowUp, IconUser
} from '@tabler/icons-react';
import { useProfileQuery } from '../../../hooks/useProfileQuery';
import { useAnalytics } from '../../../hooks/useAnalytics';
import apiClient from '../../../lib/apiClient'; // 🆕
import { FoodDnaRing, CardShell } from '../../../components/ges';

const chefLevels = [
  { minXP: 0, title: 'نوآموز', color: 'gray' },
  { minXP: 50, title: 'آشپز', color: 'blue' },
  { minXP: 100, title: 'سرآشپز', color: 'orange' },
  { minXP: 200, title: 'مستر شف', color: 'red' },
  { minXP: 500, title: 'افسانه', color: 'yellow' },
];

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { profile, stats, badges, myRecipes, loading, updateName, updateAvatar } = useProfileQuery();
  const { trackEvent } = useAnalytics();
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';
  const [nameModalOpen, { open: openNameModal, close: closeNameModal }] = useDisclosure(false);
  const [newName, setNewName] = useState('');
  const [dnaBand, setDnaBand] = useState(null); // real Food DNA maturity band (S22)
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    apiClient.get('/profile').then(({ data }) => setDnaBand(data?.maturity?.band ?? null)).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (user) trackEvent('profile_view');
  }, [user, trackEvent]);

  const totalXP = stats.recipeCount * 10 + stats.favoriteCount * 5 + stats.plannedMeals * 3;
  let currentLevel = chefLevels[0];
  for (let i = chefLevels.length - 1; i >= 0; i--) {
    if (totalXP >= chefLevels[i].minXP) {
      currentLevel = chefLevels[i];
      break;
    }
  }
  const nextLevel = chefLevels[chefLevels.indexOf(currentLevel) + 1] || null;
  const progressValue = nextLevel
    ? ((totalXP - currentLevel.minXP) / (nextLevel.minXP - currentLevel.minXP)) * 100
    : 100;

  // 🆕 آپلود واقعی و ذخیره URL
  const handleAvatarChange = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await apiClient.post('/upload/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateAvatar(data.avatarUrl);
      trackEvent('avatar_change');
    } catch (err) {
      console.error('آپلود آواتار ناموفق بود:', err);
    }
  };

  const handleSaveName = async () => {
    if (newName.trim()) {
      await updateName(newName.trim());
      trackEvent('profile_edit', { name: newName });
      closeNameModal();
    }
  };

  const handleLogout = () => {
    trackEvent('logout');
    logout();
    navigate('/');
  };

  const handleNavigation = (destination) => {
    trackEvent('profile_navigate', { destination });
    navigate(destination);
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const textColor = dark ? 'var(--g-color-bg-surface)' : 'var(--g-color-text-primary)';
  const cardBg = dark ? 'var(--g-color-bg-surface)' : 'var(--g-color-bg-surface)';
  const borderColor = 'var(--g-color-food-saffron)';

  const statCards = [
    { value: stats.recipeCount, label: 'رسپی', icon: IconPencil, color: 'blue' },
    { value: stats.favoriteCount, label: 'علاقه‌مندی', icon: IconHeart, color: 'pink' },
    { value: stats.plannedMeals, label: 'وعده', icon: IconCalendar, color: 'teal' },
  ];

  if (!user) {
    return (
      <Container size="xs" style={{ maxWidth: 420, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <IconUser size={48} color="var(--g-color-food-saffron)" />
        <Text fw={700} mb="sm" c={textColor}>پروفایل کاربر</Text>
        <Text size="sm" c="dimmed" mb="xl">برای دیدن پروفایل خود وارد شوید</Text>
        <Button fullWidth size="md" radius="xl" onClick={() => navigate('/auth')}>ورود / عضویت</Button>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container size="xs" style={{ maxWidth: 420, margin: '0 auto', padding: '0 8px' }}>
        <Skeleton height={180} radius="xl" mb="md" />
        <SimpleGrid cols={3} spacing="sm" mb="md">
          <Skeleton height={80} radius="lg" />
          <Skeleton height={80} radius="lg" />
          <Skeleton height={80} radius="lg" />
        </SimpleGrid>
        <Skeleton height={150} radius="lg" mb="md" />
        <Skeleton height={150} radius="lg" />
      </Container>
    );
  }

  return (
    <Container size="xs" style={{ maxWidth: 420, margin: '0 auto', padding: '0 8px 40px' }}>
      {/* S22 — Food DNA summary + quick links to the new screens */}
      <Box mb="md" mt="md">
        <CardShell>
          <Group justify="space-between" align="center" wrap="nowrap" style={{ gap: 'var(--g-space-3)' }}>
            <Stack style={{ flex: 1, minWidth: 0, gap: 'var(--g-space-2)' }}>
              <Text fw={700} c="var(--g-color-text-primary)">ذائقهٔ غذایی تو</Text>
              <Group gap="var(--g-space-2)" wrap="wrap">
                <Button variant="light" color="saffron" radius="xl" size="xs" onClick={() => navigate('/food-dna')}>ذائقهٔ من</Button>
                <Button variant="light" color="saffron" radius="xl" size="xs" onClick={() => navigate('/achievements')}>دستاوردها</Button>
                <Button variant="light" color="gray" radius="xl" size="xs" onClick={() => navigate('/settings')}>تنظیمات</Button>
              </Group>
            </Stack>
            {dnaBand && <FoodDnaRing band={dnaBand} size={84} label="ذائقه" />}
          </Group>
        </CardShell>
      </Box>

      {/* هدر گرادیانتی */}
      <Paper
        p="lg"
        radius="xl"
        mb="md"
        style={{
          background: dark
            ? 'linear-gradient(135deg, var(--g-color-text-primary) 0%, var(--g-color-text-primary) 100%)'
            : 'linear-gradient(135deg, var(--g-color-brand-400) 0%, var(--g-color-brand-600) 100%)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: 'var(--g-shadow-1)',
        }}
      >
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'var(--g-color-bg-surface)' }} />
        <div style={{ position: 'absolute', bottom: -20, left: -20, width: 80, height: 80, borderRadius: '50%', background: 'var(--g-color-bg-surface)' }} />

        <Group wrap="nowrap" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ position: 'relative' }}>
            <Avatar
              size={64}
              radius="xl"
              src={profile.avatar ? `http://localhost:3000${profile.avatar}` : undefined}
              color="white"
              style={{ border: '3px solid var(--g-color-border-subtle)' }}
            >
              {!profile.avatar && <Text size={26}>{profile.name?.charAt(0) || user.name?.charAt(0)}</Text>}
            </Avatar>
            <ActionIcon
              size="xs" radius="xl" variant="filled" color="white"
              style={{ position: 'absolute', bottom: 0, right: 0, border: '2px solid var(--g-color-food-saffron)', boxShadow: 'var(--g-shadow-1)' }}
              onClick={() => fileInputRef.current?.click()}
            >
              <IconCamera size={10} />
            </ActionIcon>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleAvatarChange(e.target.files[0])} />
          </div>
          <div style={{ flex: 1 }}>
            <Group gap="xs" mb={4}>
              <Text fw={700} size="lg">{profile.name || user.name}</Text>
              <ActionIcon variant="subtle" color="white" size="sm" onClick={() => { setNewName(profile.name || user.name); openNameModal(); }}>
                <IconEdit size={16} />
              </ActionIcon>
            </Group>
            <Group gap="xs" mb={8}>
              <Badge variant="filled" color={currentLevel.color} size="sm" style={{ color: 'white' }}>
                {currentLevel.title}
              </Badge>
              <Badge variant="light" color="white" size="sm">سطح {chefLevels.indexOf(currentLevel) + 1}</Badge>
            </Group>
            <Progress value={progressValue} color="yellow" size="sm" radius="xl" />
            <Text size="xs" mt={4} style={{ color: 'white' }}>
              {totalXP} XP {nextLevel ? `(تا ${nextLevel.title} ${nextLevel.minXP - totalXP} XP)` : '(حداکثر)'}
            </Text>
          </div>
        </Group>
      </Paper>

      {/* آمار */}
      <SimpleGrid cols={3} spacing="sm" mb="md">
        {statCards.map((item, i) => (
          <Paper
            key={i}
            p="sm"
            radius="lg"
            style={{
              background: cardBg,
              backdropFilter: 'blur(8px)',
              border: `1px solid ${borderColor}`,
              textAlign: 'center',
              boxShadow: dark ? 'none' : 'var(--g-shadow-1)',
            }}
          >
            <Stack gap={4} align="center">
              <ThemeIcon size="lg" radius="xl" color={item.color} variant="light">
                <item.icon size={18} />
              </ThemeIcon>
              <Text fw={700} size="lg" c={textColor}>{item.value}</Text>
              <Text size="xs" c="dimmed">{item.label}</Text>
            </Stack>
          </Paper>
        ))}
      </SimpleGrid>

      {/* لینک‌های سریع */}
      <Paper radius="lg" mb="md" style={{ overflow: 'hidden', background: cardBg, backdropFilter: 'blur(8px)', border: `1px solid ${borderColor}` }}>
        <UnstyledButton onClick={() => handleNavigation('/favorites')} style={linkStyle(dark)}>
          <Group gap="sm"><IconHeart size={20} color="var(--g-color-food-saffron)" /><Text size="sm" fw={600} c={textColor}>علاقمندی‌ها</Text></Group>
          <IconChevronLeft size={18} style={{ transform: 'rotate(180deg)' }} color="dimmed" />
        </UnstyledButton>
        <UnstyledButton onClick={() => handleNavigation('/my-recipes')} style={linkStyle(dark)}>
          <Group gap="sm"><IconPencil size={20} color="var(--g-color-state-success-fg)" /><Text size="sm" fw={600} c={textColor}>رسپی‌های ارسالی من</Text></Group>
          <IconChevronLeft size={18} style={{ transform: 'rotate(180deg)' }} color="dimmed" />
        </UnstyledButton>
        <UnstyledButton onClick={() => handleNavigation('/preferences')} style={{ ...linkStyle(dark), borderBottom: 'none' }}>
          <Group gap="sm"><IconSettings size={20} color="var(--g-color-food-saffron)" /><Text size="sm" fw={600} c={textColor}>تنظیمات سلیقه</Text></Group>
          <IconChevronLeft size={18} style={{ transform: 'rotate(180deg)' }} color="dimmed" />
        </UnstyledButton>
      </Paper>

      {/* آکاردئون‌ها */}
      <Accordion multiple variant="contained" radius="lg" mb="md" chevronPosition="left">
        <Accordion.Item value="badges">
          <Accordion.Control icon={<IconTrophy size={20} color="var(--g-color-food-saffron)" />} onClick={() => trackEvent('badge_view')}>
            <Text size="sm" fw={600} c={textColor}>نشان‌ها و دستاوردها</Text>
          </Accordion.Control>
          <Accordion.Panel>
            {badges.length > 0 ? (
              <Stack gap="sm">
                {badges.map(badge => (
                  <Paper key={badge.id} p="sm" radius="md" style={{
                    borderRight: `4px solid ${badge.color}`,
                    background: dark ? 'var(--g-color-bg-surface)' : 'var(--g-color-bg-surface)',
                  }}>
                    <Group gap="sm" wrap="nowrap">
                      <Text size="xl">{badge.icon}</Text>
                      <Box style={{ flex: 1 }}>
                        <Text size="sm" fw={600}>{badge.title}</Text>
                        <Text size="xs" c="dimmed">{badge.description}</Text>
                        <Progress value={badge.progress} color={badge.color} size="xs" radius="xl" mt={4} />
                      </Box>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed" ta="center" py="md">هنوز نشانی کسب نکرده‌اید</Text>
            )}
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="recipes">
          <Accordion.Control icon={<IconPencil size={20} color="var(--g-color-food-saffron)" />} onClick={() => trackEvent('my_recipes_view')}>
            <Text size="sm" fw={600} c={textColor}>رسپی‌های من</Text>
          </Accordion.Control>
          <Accordion.Panel>
            {myRecipes.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center" py="md">هنوز رسپی اضافه نکرده‌اید</Text>
            ) : (
              myRecipes.slice(0, 5).map((recipe) => (
                <Group key={recipe.id} justify="space-between" py={6} px="sm" style={{ borderRadius: 8, backgroundColor: dark ? 'var(--g-color-bg-surface)' : 'var(--g-color-border-subtle)', marginBottom: 4 }}>
                  <Text size="sm" c={dark ? 'var(--g-color-border-subtle)' : 'var(--g-color-border-strong)'} style={{ cursor: 'pointer' }} onClick={() => navigate(`/recipe/${recipe.id}`)}>{recipe.title}</Text>
                  <Text size="xs" c="dimmed">{recipe.cook_time || ''}</Text>
                </Group>
              ))
            )}
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      <Button fullWidth color="red" variant="light" size="sm" leftSection={<IconLogout size={16} />} onClick={handleLogout} radius="xl">
        خروج از حساب
      </Button>

      <Modal opened={nameModalOpen} onClose={closeNameModal} title="ویرایش نام" centered radius="lg">
        <TextInput
          placeholder="نام جدید"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          radius="xl"
          styles={{ input: { textAlign: 'right' } }}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={closeNameModal} radius="xl">انصراف</Button>
          <Button onClick={handleSaveName} radius="xl" color="orange">ذخیره</Button>
        </Group>
      </Modal>

      <ActionIcon
        variant="light" color="orange" size="xl" radius="xl"
        style={{ position: 'fixed', bottom: 80, right: 16, zIndex: 50, boxShadow: 'var(--g-shadow-1)' }}
        onClick={scrollToTop}
      >
        <IconArrowUp size={18} />
      </ActionIcon>
    </Container>
  );
}

const linkStyle = (dark) => ({
  width: '100%',
  padding: '16px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderBottom: `1px solid ${dark ? 'var(--g-color-border-strong)' : 'var(--g-color-border-subtle)'}`,
  cursor: 'pointer',
});
