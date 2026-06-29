// Standalone /login — clean login/signup, always reachable (fixes the bug where the guest-spine token hid the
// onboarding login link). Public route. On success → `from` (or home).
import { Box, Text, UnstyledButton } from '@mantine/core';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AuthForm from '../../components/auth/AuthForm';

export default function LoginPage() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const from = sp.get('from') || '/';
  return (
    <Box style={{ minBlockSize: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--g-color-bg-canvas)', paddingInline: 'var(--g-space-5)', paddingBlock: 'var(--g-space-6)' }}>
      <AuthForm
        initialMode={sp.get('mode') === 'signup' ? 'signup' : 'login'}
        heading="به گارنیش خوش آمدی"
        sub="وارد شو یا حساب بساز تا شناسهٔ ذائقه‌ات ذخیره بماند."
        onSuccess={() => navigate(from, { replace: true })}
        footer={
          <UnstyledButton type="button" onClick={() => navigate('/onboarding')} style={{ inlineSize: '100%', paddingBlock: 6, fontFamily: 'var(--g-font-fa)', fontSize: '12.5px', color: 'var(--g-color-text-muted)', textAlign: 'center' }}>
            ادامه به‌عنوان مهمان
          </UnstyledButton>
        }
      />
    </Box>
  );
}
