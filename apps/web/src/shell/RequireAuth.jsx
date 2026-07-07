import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Box, Loader } from '@mantine/core';
import { useAuth } from '../context/AuthContext';

export default function RequireAuth() {
  const { token, user, isGuest, isLoading, guestEnabled, clearAuth } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <Box style={{ minBlockSize: '100dvh', display: 'grid', placeItems: 'center', background: 'var(--g-color-bg-canvas)' }}>
        <Loader color="var(--g-color-brand-600)" />
      </Box>
    );
  }

  if (!token || !user) {
    const reason = localStorage.getItem('garnish.sessionExpired') === 'true' ? '?reason=session-expired' : '';
    return <Navigate to={`/login${reason}`} replace state={{ from: location.pathname }} />;
  }

  if (isGuest && !guestEnabled) {
    clearAuth();
    return <Navigate to="/login" replace />;
  }

  if (!isGuest && user.onboardingComplete === false) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
