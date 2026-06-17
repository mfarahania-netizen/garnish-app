import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Dedicated Vitest config — deliberately NOT the app vite.config (no PWA plugin,
// no manualChunks): the smoke-test net only needs the React transform + jsdom.
// The @garnish/shared alias is mirrored so imports resolve identically to the build.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@garnish/shared': path.resolve(__dirname, '../../packages/shared'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    clearMocks: true,
    restoreMocks: true,
  },
});
