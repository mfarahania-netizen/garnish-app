import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { MantineProvider, createTheme, virtualColor, Center, Loader } from '@mantine/core';
import { AnimatePresence, motion } from 'framer-motion';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Component, Suspense, lazy, useEffect, useState } from 'react';
import posthog from 'posthog-js';
import { AuthProvider } from './context/AuthContext';
import ConsentModal from './components/ConsentModal';
import { getAnalyticsConsent } from './lib/analytics-init';
import { I18nProvider } from './i18n/I18nProvider';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute';
import MainLayout from './layouts/MainLayout';
import 'swiper/css';
import 'swiper/css/pagination';
import '@mantine/core/styles.css';
import './App.css';

const queryClient = new QueryClient();
const HomePage = lazy(() => import('./app/home/page'));
const RecipeDetailPage = lazy(() => import('./app/recipe/[id]/page'));
const RecipesPage = lazy(() => import('./app/recipes/page'));
const AuthPage = lazy(() => import('./app/auth/page'));
const CategoryPage = lazy(() => import('./app/category/[keyword]/page'));
const PlanPage = lazy(() => import('./app/plan/page'));
const ShoppingListPage = lazy(() => import('./app/shopping-list/page'));
const AdminDashboard = lazy(() => import('./app/admin/page'));
const FavoritesPage = lazy(() => import('./app/favorites/page'));
const ProfilePage = lazy(() => import('./features/profile/pages/ProfilePage'));
const AddRecipePage = lazy(() => import('./features/add-recipe').then((module) => ({ default: module.AddRecipePage })));
const MyRecipesPage = lazy(() => import('./features/add-recipe/pages/MyRecipesPage'));
const SupportPage = lazy(() => import('./features/support/pages/SupportPage'));
const PreferencesPage = lazy(() => import('./features/profile/pages/PreferencesPage'));
const AIChatPage = lazy(() => import('./features/ai-chat/pages/AIChatPage'));
const NotificationsPage = lazy(() => import('./features/notifications/pages/NotificationsPage'));

function RouteFallback() {
  return (
    <Center h="60vh">
      <Loader color="orange" />
    </Center>
  );
}

const theme = createTheme({
  primaryColor: 'orange',
  fontFamily: 'Vazirmatn, sans-serif',
  fontSizes: {
    xs: '0.75rem', sm: '0.85rem', md: '0.95rem', lg: '1.1rem', xl: '1.25rem',
  },
  headings: {
    fontFamily: 'Vazirmatn, sans-serif',
    fontWeight: '700',
    sizes: {
      h1: { fontSize: '1.8rem', lineHeight: '2.2' },
      h2: { fontSize: '1.5rem', lineHeight: '2' },
      h3: { fontSize: '1.25rem', lineHeight: '1.8' },
      h4: { fontSize: '1.1rem', lineHeight: '1.7' },
      h5: { fontSize: '1rem', lineHeight: '1.6' },
      h6: { fontSize: '0.9rem', lineHeight: '1.5' },
    },
  },
  colors: {
    navy: virtualColor({
      name: 'navy',
      light: ['#E8EAF6','#C5CAE9','#9FA8DA','#7986CB','#5C6BC0','#3F51B5','#3949AB','#303F9F','#283593','#1A237E'],
      dark: ['#C1C2C5','#A6A7AB','#909296','#5c5f66','#373A40','#2C2E33','#25262b','#1A1B1E','#141517','#101113'],
    }),
    glass: virtualColor({ name: 'glass', light: 'rgba(255,255,255,0.7)', dark: 'rgba(40,40,45,0.8)' }),
    glassNav: virtualColor({ name: 'glassNav', light: 'rgba(255,255,255,0.8)', dark: 'rgba(30,30,35,0.9)' }),
    accent: virtualColor({ name: 'accent', light: '#1A237E', dark: '#FF6B35' }),
    tip: virtualColor({ name: 'tip', light: '#2e7d32', dark: '#81c784' }),
  },
  dir: 'rtl',
});

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(_error) { return { hasError: true }; }
  componentDidCatch(error, errorInfo) { console.error('ErrorBoundary caught:', error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return <div style={{ padding: 20, textAlign: 'center' }}>⚠️ مشکلی پیش اومد. لطفاً صفحه رو رفرش کن.</div>;
    }
    return this.props.children;
  }
}

function AnimatedRoutes() {
  const location = useLocation();

  useEffect(() => {
    if (posthog.__loaded) {
      posthog.capture('$pageview', {
        path: location.pathname,
        url: window.location.href,
      });
    }
  }, [location]);

  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<RouteFallback />}>
      <Routes location={location} key={location.pathname}>
        {/* مسیرهای داخل MainLayout */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<PageWrapper><HomePage /></PageWrapper>} />
          <Route path="recipe/:id" element={<PageWrapper><RecipeDetailPage /></PageWrapper>} />
          <Route path="recipes" element={<PageWrapper><RecipesPage /></PageWrapper>} />
          <Route path="auth" element={<PageWrapper><AuthPage /></PageWrapper>} />
          <Route path="category/:keyword" element={<PageWrapper><CategoryPage /></PageWrapper>} />
          <Route path="plan" element={<ProtectedRoute><PageWrapper><PlanPage /></PageWrapper></ProtectedRoute>} />
          <Route path="profile" element={<ProtectedRoute><PageWrapper><ProfilePage /></PageWrapper></ProtectedRoute>} />
          <Route path="add-recipe" element={<ProtectedRoute><PageWrapper><AddRecipePage /></PageWrapper></ProtectedRoute>} />
          <Route path="my-recipes" element={<ProtectedRoute><PageWrapper><MyRecipesPage /></PageWrapper></ProtectedRoute>} />
          <Route path="shopping-list" element={<ProtectedRoute><PageWrapper><ShoppingListPage /></PageWrapper></ProtectedRoute>} />
          <Route path="support" element={<ProtectedRoute><PageWrapper><SupportPage /></PageWrapper></ProtectedRoute>} />
          <Route path="preferences" element={<ProtectedRoute><PageWrapper><PreferencesPage /></PageWrapper></ProtectedRoute>} />
          <Route path="favorites" element={<ProtectedRoute><PageWrapper><FavoritesPage /></PageWrapper></ProtectedRoute>} />
          <Route path="ai-chat" element={<ProtectedRoute><PageWrapper><AIChatPage /></PageWrapper></ProtectedRoute>} />
          <Route path="notifications" element={<ProtectedRoute><PageWrapper><NotificationsPage /></PageWrapper></ProtectedRoute>} />
        </Route>

        {/* 🆕 مسیر admin مستقل، بدون MainLayout */}
        <Route
          path="admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />
      </Routes>
      </Suspense>
    </AnimatePresence>
  );
}

function PageWrapper({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}

// E4: first-visit analytics consent prompt. Opens only when the user has made
// no prior decision; PostHog stays uninitialized until consent is granted.
function AnalyticsConsentGate() {
  const [opened, setOpened] = useState(() => getAnalyticsConsent() === null);
  return (
    <ConsentModal
      opened={opened}
      onClose={() => setOpened(false)}
      onConsentGiven={() => setOpened(false)}
    />
  );
}

function AppInner() {
  const { dark } = useTheme();
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} colorScheme={dark ? 'dark' : 'light'}>
        <AuthProvider>
          <ErrorBoundary>
            <AnimatedRoutes />
            <AnalyticsConsentGate />
          </ErrorBoundary>
        </AuthProvider>
      </MantineProvider>
    </QueryClientProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <BrowserRouter>
          <AppInner />
        </BrowserRouter>
      </I18nProvider>
    </ThemeProvider>
  );
}
