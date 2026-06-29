import { Component, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { DirectionProvider, MantineProvider, createTheme } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@mantine/core/styles.css';
import { garnishTheme } from './theme/garnish-theme';
import { AuthProvider } from './context/AuthContext';
import { RecipeProvider } from './context/RecipeContext';
import AppShell from './shell/AppShell';
import RequireAuth from './shell/RequireAuth';
import { useAnalytics } from './hooks/useAnalytics';
import HomePage from './app/home/page';
import RecipeDetailPage from './app/recipe/[id]/page';
import CookPage from './app/cook/[id]/page';
import OnboardingPage from './app/onboarding/page';
import LoginPage from './app/login/page';
import DiscoveryPage from './app/discover/page';
import RecipesPage from './app/recipes/page';
import ProfilePage from './app/profile/page';
import FoodDnaPage from './app/food-dna/page';
import PlanPage from './app/plan/page';
import ShoppingListPage from './app/shopping-list/page';
import FavoritesPage from './app/favorites/page';
import AssistantPage from './app/assistant/page';
import SettingsPage from './app/settings/page';
import NotificationsPage from './app/notifications/page';
import AchievementsPage from './app/achievements/page';
import SupportPage from './app/support/page';
import AdminPage from './app/admin/page';
import TermsPage from './app/terms/page';
import PrivacyPage from './app/privacy/page';
import NotFound from './shell/NotFound';

// FE-RESET-A — clean app root.
// Providers wired per spec: MantineProvider (GES theme, RTL) · QueryClient ·
// Auth · Recipe · BrowserRouter. The Mantine theme reuses the preserved
// GES adapter (theme/garnish-theme.js → tokens.css) and pins the Persian
// face so every component renders in Vazirmatn. RTL comes from DirectionProvider
// + `dir="rtl"` on <html>; reduced-motion is respected app-wide.
const queryClient = new QueryClient();

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
function RouteTracker() {
  const location = useLocation();
  const { trackEvent } = useAnalytics();
  const lastRef = useRef(null);
  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/admin')) return;
    if (lastRef.current === path) return; // StrictMode / dup-render guard within this mount
    lastRef.current = path;
    let prevPage = null, enterTs = 0;
    try { prevPage = sessionStorage.getItem('g_prevPage') || null; enterTs = Number(sessionStorage.getItem('g_enterTs')) || 0; } catch { /* private mode */ }
    // TIME-ON-PAGE: how long the page we're leaving stayed open (sane 0.5s…30m window).
    if (prevPage && enterTs) {
      const ms = Date.now() - enterTs;
      if (ms > 500 && ms < 1_800_000) trackEvent('page_dwell', { page: prevPage, ms });
    }
    // PAGE→PAGE FLOW: where this view came from. sessionStorage-backed so it survives a refresh within the session.
    trackEvent('page_view', { page: path, from: prevPage });
    try { sessionStorage.setItem('g_prevPage', path); sessionStorage.setItem('g_enterTs', String(Date.now())); } catch { /* */ }
  }, [location.pathname, trackEvent]);
  // Flush the current page's dwell when the tab is hidden/closed (else the last page per visit is lost).
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState !== 'hidden') return;
      try {
        const prevPage = sessionStorage.getItem('g_prevPage'); const enterTs = Number(sessionStorage.getItem('g_enterTs')) || 0;
        if (prevPage && enterTs) { const ms = Date.now() - enterTs; if (ms > 500 && ms < 1_800_000) { trackEvent('page_dwell', { page: prevPage, ms }); sessionStorage.setItem('g_enterTs', String(Date.now())); } }
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
              <RecipeProvider>
                <BrowserRouter>
                  <RouteTracker />
                  <AppRoutes />
                </BrowserRouter>
              </RecipeProvider>
            </AuthProvider>
          </MantineProvider>
        </QueryClientProvider>
      </DirectionProvider>
    </ErrorBoundary>
  );
}

/** The route tree, exported so tests can mount it under a MemoryRouter and verify the shell wraps a route. */
export function AppRoutes() {
  return (
                  <Routes>
                    {/* Recipe Detail is a standalone immersive screen (own hero controls + action shelf) */}
                    <Route path="/onboarding" element={<OnboardingPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    {/* Public legal pages — opened (target=_blank) from the onboarding consent links */}
                    <Route path="/terms" element={<TermsPage />} />
                    <Route path="/privacy" element={<PrivacyPage />} />
                    <Route path="/recipe/:id" element={<RecipeDetailPage />} />
                    <Route path="/admin" element={<AdminPage />} />
                    {/* Cook Mode wears the standard app shell (TopBar + BottomNav) but stays publicly
                        reachable from a recipe — same access level as Recipe Detail, so NOT behind RequireAuth */}
                    <Route element={<AppShell />}>
                      <Route path="/cook/:id" element={<CookPage />} />
                    </Route>
                    <Route element={<RequireAuth />}>
                      <Route element={<AppShell />}>
                        <Route index element={<HomePage />} />
                        <Route path="/discover" element={<DiscoveryPage />} />
                        <Route path="/recipes" element={<RecipesPage />} />
                        {/* distinct keys → each route remounts ProfilePage with the right initial view
                            («پروفایل من» = profile, «شناسهٔ ذائقه» = the Food-DNA breakdown), so the two
                            drawer links never collapse to the same screen */}
                        <Route path="/profile" element={<ProfilePage key="profile" />} />
                        {/* S2: dedicated Food DNA activation screen (was ProfilePage initialView="dna") */}
                        <Route path="/food-dna" element={<FoodDnaPage />} />
                        <Route path="/plan" element={<PlanPage />} />
                        <Route path="/shopping-list" element={<ShoppingListPage />} />
                        <Route path="/favorites" element={<FavoritesPage />} />
                        <Route path="/assistant" element={<AssistantPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="/notifications" element={<NotificationsPage />} />
                        <Route path="/support" element={<SupportPage />} />
                        <Route path="/achievements" element={<AchievementsPage />} />
                        <Route path="*" element={<NotFound />} />
                      </Route>
                    </Route>
                  </Routes>
  );
}
