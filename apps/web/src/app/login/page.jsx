// Public /login — single entry for login/signup with phone OTP.
import { Box } from '@mantine/core';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AuthForm from '../../components/auth/AuthForm';

export default function LoginPage() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const from = sp.get('from') || '/';
  const reason = sp.get('reason');

  const afterAuth = (user) => {
    if (user?.onboardingComplete === false && from !== '/onboarding') {
      navigate('/onboarding', { replace: true });
      return;
    }
    navigate(from, { replace: true });
  };

  return (
    <Box style={{ minBlockSize: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--g-color-bg-canvas)', paddingInline: 'var(--g-space-5)', paddingBlock: 'var(--g-space-6)' }}>
      <AuthForm
        heading="به گارنیش خوش آمدی"
        sub={reason === 'session-expired' ? 'نشستت تمام شده؛ دوباره با کد پیامکی وارد شو.' : 'شماره موبایلت را وارد کن؛ رمز عبور لازم نیست.'}
        onSuccess={afterAuth}
      />
    </Box>
  );
}
