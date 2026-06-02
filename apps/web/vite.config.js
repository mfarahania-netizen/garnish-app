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
        theme_color: '#FF6B35',
        orientation: 'portrait-primary',
        dir: 'rtl',
        lang: 'fa-IR',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-cache', expiration: { maxEntries: 50, maxAgeSeconds: 86400 } },
          },
          {
            urlPattern: /\.(js|css|png|jpg|svg|woff2|ttf)$/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'asset-cache' },
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
  server: { host: true, port: 5173 },
});