import { Component, Suspense, lazy, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { DirectionProvider, MantineProvider, createTheme } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@mantine/core/styles.css';
import { garnishTheme } from './theme/garnish-theme';
import { AuthProvider } from './context/AuthContext';
import AppShell from './shell/AppShell';
import RequireAuth from './shell/RequireAuth';
import { useAnalytics } from './hooks/useAnalytics';
import { hasAnalyticsConsent } from './lib/analytics-init';
import { installE2EQueryInspection } from './lib/private-session-cache';
const HomePage = lazy(() => import('./app/home/page'));
const RecipeDetailPage = lazy(() => import('./app/recipe/[id]/page'));
const CookPage = lazy(() => import('./app/cook/[id]/page'));
const OnboardingPage = lazy(() => import('./app/onboarding/page'));
const LoginPage = lazy(() => import('./app/login/page'));
const DiscoveryPage = lazy(() => import('./app/discover/page'));
const RecipesPage = lazy(() => import('./app/recipes/page'));
const ProfilePage = lazy(() => import('./app/profile/page'));
const FoodDnaPage = lazy(() => import('./app/food-dna/page'));
const PlanPage = lazy(() => import('./app/plan/page'));
const ShoppingListPage = lazy(() => import('./app/shopping-list/page'));
const HouseholdPage = lazy(() => import('./app/household/page'));
const FavoritesPage = lazy(() => import('./app/favorites/page'));
const AssistantPage = lazy(() => import('./app/assistant/page'));
const SettingsPage = lazy(() => import('./app/settings/page'));
const NotificationsPage = lazy(() => import('./app/notifications/page'));
const AchievementsPage = lazy(() => import('./app/achievements/page'));
const SupportPage = lazy(() => import('./app/support/page'));
const AdminPage = lazy(() => import('./app/admin/page'));
const TermsPage = lazy(() => import('./app/terms/page'));
const PrivacyPage = lazy(() => import('./app/privacy/page'));
const NotFound = lazy(() => import('./shell/NotFound'));

// FE-RESET-A — clean app root.
// Providers wired per spec: MantineProvider (GES theme, RTL) · QueryClient ·
// Auth · BrowserRouter. The obsolete root RecipeProvider was removed: its catalog
// request had no mounted consumer in the active route tree.
// The Mantine theme reuses the preserved
// GES adapter (theme/garnish-theme.js → tokens.css) and pins the Persian
// face so every component renders in Vazirmatn. RTL comes from DirectionProvider
// + `dir="rtl"` on <html>; reduced-motion is respected app-wide.
export function shouldRetryQuery(failureCount, error) {
  const status = error?.response?.status ?? error?.status;
  if (Number.isFinite(status) && status >= 400 && status < 500) return false;
  return failureCount < 1;
}

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetryQuery,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: { retry: false },
    },
  });
}

const queryClient = createAppQueryClient();
installE2EQueryInspection({
  queryClient,
  enabled: import.meta.env.VITE_E2E_QUERY_INSPECTION === 'true',
});

const theme = createTheme({
  ...garnishTheme,
  fontFamily: "Vazirmatn, 'Inter', system-ui, sans-serif",
  headings: {
    ...garnishTheme.headings,
    fontFamily: "Vazirmatn, 'Plus Jakarta Sans', system-ui, sans-serif",
  },
  respectReducedMotion: true,
});

// Minimal safety net so a runtime error degrades to a calm, token-styled
// message instead of a blank screen.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--g-space-6)',
            textAlign: 'center',
            fontFamily: 'var(--g-font-fa)',
            color: 'var(--g-color-text-primary)',
            background: 'var(--g-color-bg-canvas)',
          }}
        >
          مشکلی پیش آمد. لطفاً صفحه را تازه‌سازی کنید.
        </div>
      );
    }
    return this.props.children;
  }
}

// Fire a page_view on EVERY route change with the REAL path, so the admin "top pages" reflects actual
// navigation. The rebuilt app had dropped page-view tracking entirely (only 18-day-old legacy /home events
// remained → the panel showed just "/"). Admin routes are skipped so operator views don't pollute user analytics.
export function RouteTracker() {
  const location = useLocation();
  const { trackEvent } = useAnalytics();
  const lastRef = useRef(null);
  // CLICKS-PER-PAGE: count clicks on the current page (capture phase); flushed as ONE summary on leave (low volume,
  // never per-click — that would flood ingest). Stored in sessionStorage so it survives a same-session refresh.
  useEffect(() => {
    const onClick = () => {
      if (!hasAnalyticsConsent()) return;
      try { sessionStorage.setItem('g_clicks', String((Number(sessionStorage.getItem('g_clicks')) || 0) + 1)); } catch { /* */ }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/admin')) return;
    if (!hasAnalyticsConsent()) {
      lastRef.current = null;
      try {
        sessionStorage.removeItem('g_prevPage');
        sessionStorage.removeItem('g_enterTs');
        sessionStorage.removeItem('g_clicks');
      } catch { /* private mode */ }
      return;
    }
    if (lastRef.current === path) return; // StrictMode / dup-render guard within this mount
    lastRef.current = path;
    let prevPage = null, enterTs = 0, clicks = 0;
    try { prevPage = sessionStorage.getItem('g_prevPage') || null; enterTs = Number(sessionStorage.getItem('g_enterTs')) || 0; clicks = Number(sessionStorage.getItem('g_clicks')) || 0; } catch { /* private mode */ }
    // TIME-ON-PAGE + CLICKS: summarise the page we're LEAVING.
    if (prevPage && enterTs) {
      const ms = Date.now() - enterTs;
      if (ms > 500 && ms < 1_800_000) trackEvent('page_dwell', { page: prevPage, ms });
      if (clicks > 0) trackEvent('page_clicks', { page: prevPage, count: clicks });
    }
    // PAGE→PAGE FLOW: where this view came from. sessionStorage-backed so it survives a refresh within the session.
    trackEvent('page_view', { page: path, from: prevPage });
    try { sessionStorage.setItem('g_prevPage', path); sessionStorage.setItem('g_enterTs', String(Date.now())); sessionStorage.setItem('g_clicks', '0'); } catch { /* */ }
  }, [location.pathname, trackEvent]);
  // Flush the current page's dwell + clicks when the tab is hidden/closed (else the last page per visit is lost).
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState !== 'hidden') return;
      if (!hasAnalyticsConsent()) {
        try {
          sessionStorage.removeItem('g_prevPage');
          sessionStorage.removeItem('g_enterTs');
          sessionStorage.removeItem('g_clicks');
        } catch { /* private mode */ }
        return;
      }
      try {
        const prevPage = sessionStorage.getItem('g_prevPage'); const enterTs = Number(sessionStorage.getItem('g_enterTs')) || 0; const clicks = Number(sessionStorage.getItem('g_clicks')) || 0;
        if (prevPage && enterTs) {
          const ms = Date.now() - enterTs;
          if (ms > 500 && ms < 1_800_000) trackEvent('page_dwell', { page: prevPage, ms });
          if (clicks > 0) trackEvent('page_clicks', { page: prevPage, count: clicks });
          sessionStorage.setItem('g_enterTs', String(Date.now())); sessionStorage.setItem('g_clicks', '0');
        }
      } catch { /* */ }
    };
    document.addEventListener('visibilitychange', flush);
    return () => document.removeEventListener('visibilitychange', flush);
  }, [trackEvent]);
  return null;
}

export default function App() {
  // ErrorBoundary is outermost so it also catches a synchronous throw from any
  // provider; its fallback uses only CSS-var tokens (loaded independently of the
  // providers), so it renders even if MantineProvider itself failed.
  return (
    <ErrorBoundary>
      <DirectionProvider initialDirection="rtl" detectDirection={false}>
        <QueryClientProvider client={queryClient}>
          <MantineProvider theme={theme} defaultColorScheme="light">
            <AuthProvider>
              <BrowserRouter>
                <RouteTracker />
                <AppRoutes />
              </BrowserRouter>
            </AuthProvider>
          </MantineProvider>
        </QueryClientProvider>
      </DirectionProvider>
    </ErrorBoundary>
  );
}

export function RouteFallback() {
  return (
    <div className="g-route-fallback" role="status" aria-live="polite" aria-atomic="true">
      <span className="g-route-fallback__bar g-skeleton" aria-hidden="true" />
      <span>در حال آماده‌سازی صفحه…</span>
    </div>
  );
}

function RouteBoundary({ children }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

const routeElement = (element) => <RouteBoundary>{element}</RouteBoundary>;

/** The route tree, exported so tests can mount it under a MemoryRouter and verify the shell wraps a route. */
export function AppRoutes() {
  return (
    <Routes>
      {/* Recipe Detail is a standalone immersive screen (own hero controls + action shelf) */}
      <Route path="/onboarding" element={routeElement(<OnboardingPage />)} />
      <Route path="/login" element={routeElement(<LoginPage />)} />
      <Route path="/register" element={<Navigate to="/login?mode=signup" replace />} />
      {/* Public legal pages — opened (target=_blank) from the onboarding consent links */}
      <Route path="/terms" element={routeElement(<TermsPage />)} />
      <Route path="/privacy" element={routeElement(<PrivacyPage />)} />
      <Route path="/recipe/:id" element={routeElement(<RecipeDetailPage />)} />
      <Route path="/admin" element={routeElement(<AdminPage />)} />
      {/* Cook Mode wears the standard app shell (TopBar + BottomNav) but stays publicly
          reachable from a recipe — same access level as Recipe Detail, so NOT behind RequireAuth */}
      <Route element={<AppShell />}>
        <Route path="/cook/:id" element={routeElement(<CookPage />)} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={routeElement(<HomePage />)} />
          <Route path="/discover" element={routeElement(<DiscoveryPage />)} />
          <Route path="/recipes" element={routeElement(<RecipesPage />)} />
          {/* Profile stays a summary/control center; Food DNA owns the detailed taste workflow. */}
          <Route path="/profile" element={routeElement(<ProfilePage key="profile" />)} />
          {/* S2: dedicated Food DNA activation screen (was ProfilePage initialView="dna") */}
          <Route path="/food-dna" element={routeElement(<FoodDnaPage />)} />
          <Route path="/plan" element={routeElement(<PlanPage />)} />
          <Route path="/shopping-list" element={routeElement(<ShoppingListPage />)} />
          <Route path="/household" element={routeElement(<HouseholdPage />)} />
          <Route path="/favorites" element={routeElement(<FavoritesPage />)} />
          <Route path="/assistant" element={routeElement(<AssistantPage />)} />
          <Route path="/settings" element={routeElement(<SettingsPage />)} />
          <Route path="/notifications" element={routeElement(<NotificationsPage />)} />
          <Route path="/support" element={routeElement(<SupportPage />)} />
          <Route path="/achievements" element={routeElement(<AchievementsPage />)} />
          <Route path="*" element={routeElement(<NotFound />)} />
        </Route>
      </Route>
    </Routes>
  );
}
