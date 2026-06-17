import { render } from '@testing-library/react';
import { DirectionProvider, MantineProvider, createTheme } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { garnishTheme } from '../theme/garnish-theme';

const theme = createTheme({
  ...garnishTheme,
  fontFamily: "Vazirmatn, system-ui, sans-serif",
  respectReducedMotion: true,
});

/**
 * renderWithProviders — the shell every screen needs to mount under test, mirroring App.jsx:
 * DirectionProvider(rtl) · MantineProvider(GES theme) · QueryClient(no retry/no cache) ·
 * AuthProvider · MemoryRouter. Pass { path, route } to mount a param route (/recipe/:id etc.).
 *
 * Screen data hooks are mocked per-test (vi.mock), so no network happens here; AuthProvider
 * runs logged-out by default (no token) which is the safe baseline for these smoke tests.
 */
export function renderWithProviders(ui, { route = '/', path } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });

  const tree = (
    <DirectionProvider initialDirection="rtl" detectDirection={false}>
      <QueryClientProvider client={queryClient}>
        <MantineProvider theme={theme} defaultColorScheme="light">
          <AuthProvider>
            <MemoryRouter initialEntries={[route]}>
              {path ? (
                <Routes>
                  <Route path={path} element={ui} />
                </Routes>
              ) : (
                ui
              )}
            </MemoryRouter>
          </AuthProvider>
        </MantineProvider>
      </QueryClientProvider>
    </DirectionProvider>
  );

  return render(tree);
}
