import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['fonts/*.ttf', 'logo-garnish.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'گارنیش - آشپزی هوشمند',
        short_name: 'گارنیش',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#EA6C0A',
        orientation: 'portrait-primary',
        dir: 'rtl',
        lang: 'fa-IR',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Make autoUpdate actually instant: a new SW activates + claims open clients immediately and
        // old precaches are purged — so a deploy/refresh always serves the NEW build (this was the real
        // reason a hard refresh still showed the old chrome-less Cook Mode).
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Delete cache families created by pre-P0-A workers even when an old tab
        // never executes the new page bundle.
        importScripts: ['/sw-private-cache-cleanup.js'],
        runtimeCaching: [
          {
            // images/fonts only — the hashed JS/CSS are PRECACHED (versioned), so they must NOT be
            // StaleWhileRevalidate'd here or an updated app keeps serving stale code for a load.
            // API responses, user uploads and arbitrary images are excluded.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && (
              (/^\/fonts\//.test(url.pathname) && /\.(woff2|ttf)$/i.test(url.pathname))
              || ['/logo-garnish.png', '/icon-192.png', '/icon-512.png'].includes(url.pathname)
            ),
            handler: 'CacheFirst',
            options: {
              cacheName: 'public-immutable-assets',
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 16, maxAgeSeconds: 31536000 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@garnish/shared': path.resolve(__dirname, '../../packages/shared'),
    },
  },
  build: {
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) return 'react';
          if (id.includes('@mantine')) return 'mantine';
          if (id.includes('framer-motion')) return 'motion';
          if (id.includes('recharts')) return 'charts';
          if (id.includes('@tanstack/react-query')) return 'query';
          return 'vendor';
        },
      },
    },
  },
  server: { host: true, port: 5173 },
});
