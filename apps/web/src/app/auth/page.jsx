import { useState } from 'react';
import { Container, Paper, Title, TextInput, PasswordInput, Button, Stack, Tabs, Text } from '@mantine/core';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { IconChefHat } from '@tabler/icons-react';
import { useAnalytics } from '../../hooks/useAnalytics'; // 👈 جدید

export default function AuthPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics(); // 👈 جدید
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (mode) => {
    setError('');
    setLoading(true);
    try {
      if (mode === 'register') {
        await register(phone, password, name);
        trackEvent('register', { phone }); // 👈 ردیابی ثبت‌نام موفق
      } else {
        await login(phone, password);
        trackEvent('login', { phone }); // 👈 ردیابی ورود موفق
      }
      navigate('/');
    } catch (err) {
      trackEvent(mode === 'register' ? 'register_error' : 'login_error', { phone, error: err.response?.data?.message }); // 👈 ردیابی خطا
      setError(err.response?.data?.message || 'خطایی رخ داد');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="xs" py="xl" style={{ maxWidth: 420, margin: '0 auto' }}>
      <Paper radius="lg" p="xl" withBorder style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: -40, left: -40,
          width: 120, height: 120, borderRadius: '50%',
          background: 'linear-gradient(135deg, #FF6B35, #1A237E)',
          opacity: 0.08, zIndex: 0
        }} />

        <Stack align="center" style={{ position: 'relative', zIndex: 1 }}>
          <IconChefHat size={32} style={{ color: '#FF6B35' }} />
          <Title order={3} ta="center" style={{ color: '#1A237E' }}>
            🍽️ ورود به گارنیش
          </Title>
        </Stack>

        <Tabs 
          defaultValue="login" 
          style={{ position: 'relative', zIndex: 1 }}
          onChange={(value) => trackEvent('auth_tab_change', { tab: value })} // 👈 ردیابی تغییر تب
        >
          <Tabs.List grow mb="md">
            <Tabs.Tab value="login">ورود</Tabs.Tab>
            <Tabs.Tab value="register">عضویت</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="login">
            <Stack>
              <TextInput
                label="شماره موبایل"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                styles={{ input: { textAlign: 'right' } }}
              />
              <PasswordInput
                label="رمز عبور"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                styles={{ input: { textAlign: 'right' } }}
              />
              {error && <Text c="red" size="sm">{error}</Text>}
              <Button
                loading={loading}
                onClick={() => handleSubmit('login')}
                color="orange"
                radius="xl"
                size="md"
                fullWidth
              >
                ورود
              </Button>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="register">
            <Stack>
              <TextInput
                label="نام (اختیاری)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                styles={{ input: { textAlign: 'right' } }}
              />
              <TextInput
                label="شماره موبایل"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                styles={{ input: { textAlign: 'right' } }}
              />
              <PasswordInput
                label="رمز عبور"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                styles={{ input: { textAlign: 'right' } }}
              />
              {error && <Text c="red" size="sm">{error}</Text>}
              <Button
                loading={loading}
                onClick={() => handleSubmit('register')}
                color="orange"
                radius="xl"
                size="md"
                fullWidth
              >
                عضویت
              </Button>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Paper>
    </Container>
  );
}