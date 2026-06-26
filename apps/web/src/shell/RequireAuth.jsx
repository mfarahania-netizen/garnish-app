import { Navigate, Outlet } from 'react-router-dom';
import { Box, Loader } from '@mantine/core';
import { useAuth } from '../context/AuthContext';
import { ONBOARDED_KEY } from '../context/AuthContext';

/**
 * RequireAuth — the first-run gate for the app shell.
 *
 * Every visitor now carries a token (the guest spine mints one on load), so this gate's job shifts from "do you have
 * an account?" to "have you completed first-run?". A brand-new GUEST is routed through onboarding so they set their
 * allergies BEFORE the first slate renders (the safety pre-write); a registered user, or a guest who already finished
 * onboarding, passes straight through. While the boot token resolves (validate `GET /users/me`, or mint a guest) we
 * hold a calm loader to avoid flashing onboarding. The token-less branch is a fallback for when the guest mint fails.
 */
export default function RequireAuth() {
  const { token, isGuest, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box style={{ minBlockSize: '100dvh', display: 'grid', placeItems: 'center', background: 'var(--g-color-bg-canvas)' }}>
        <Loader color="var(--g-color-brand-600)" />
      </Box>
    );
  }

  if (!token) return <Navigate to="/onboarding" replace />;

  // First-run: an un-onboarded guest must complete onboarding (allergy safety) before reaching the gated app.
  if (isGuest && localStorage.getItem(ONBOARDED_KEY) !== 'true') return <Navigate to="/onboarding" replace />;

  return <Outlet />;
}
