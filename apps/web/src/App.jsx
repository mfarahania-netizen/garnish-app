import { Component } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DirectionProvider, MantineProvider, createTheme } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@mantine/core/styles.css';
import { garnishTheme } from './theme/garnish-theme';
import { AuthProvider } from './context/AuthContext';
import { RecipeProvider } from './context/RecipeContext';
import AppShell from './shell/AppShell';
import RequireAuth from './shell/RequireAuth';
import HomePage from './app/home/page';
import RecipeDetailPage from './app/recipe/[id]/page';
import CookPage from './app/cook/[id]/page';
import OnboardingPage from './app/onboarding/page';
import DiscoveryPage from './app/discover/page';
import ProfilePage from './app/profile/page';
import PlanPage from './app/plan/page';
import ShoppingListPage from './app/shopping-list/page';
import FavoritesPage from './app/favorites/page';
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
                  <Routes>
                    {/* Recipe Detail is a standalone immersive screen (own hero controls + action shelf) */}
                    <Route path="/onboarding" element={<OnboardingPage />} />
                    <Route path="/recipe/:id" element={<RecipeDetailPage />} />
                    <Route path="/cook/:id" element={<CookPage />} />
                    <Route element={<RequireAuth />}>
                      <Route element={<AppShell />}>
                        <Route index element={<HomePage />} />
                        <Route path="/discover" element={<DiscoveryPage />} />
                        <Route path="/profile" element={<ProfilePage />} />
                        <Route path="/food-dna" element={<ProfilePage initialView="dna" />} />
                        <Route path="/plan" element={<PlanPage />} />
                        <Route path="/shopping-list" element={<ShoppingListPage />} />
                        <Route path="/favorites" element={<FavoritesPage />} />
                        <Route path="*" element={<NotFound />} />
                      </Route>
                    </Route>
                  </Routes>
                </BrowserRouter>
              </RecipeProvider>
            </AuthProvider>
          </MantineProvider>
        </QueryClientProvider>
      </DirectionProvider>
    </ErrorBoundary>
  );
}
