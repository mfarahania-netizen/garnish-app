import { Navigate, Outlet } from 'react-router-dom';
import { Box, Loader } from '@mantine/core';
import { useAuth } from '../context/AuthContext';

/**
 * RequireAuth — the first-run gate for the app shell.
 *
 * An unauthenticated visitor is routed to the onboarding flow (the real first-run
 * experience) instead of being shown an empty Home. While the boot token is being
 * validated (`GET /users/me`) we hold a calm loader to avoid flashing onboarding;
 * if validation fails the token is cleared and the visitor lands on onboarding.
 * No backend "onboarded" flag — purely the real auth signal (token + /users/me).
 */
export default function RequireAuth() {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box style={{ minBlockSize: '100dvh', display: 'grid', placeItems: 'center', background: 'var(--g-color-bg-canvas)' }}>
        <Loader color="var(--g-color-brand-600)" />
      </Box>
    );
  }

  if (!token) return <Navigate to="/onboarding" replace />;

  return <Outlet />;
}
