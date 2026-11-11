// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ttf,woff2,webmanifest}'],
        navigateFallbackDenylist: [/^\/api\//],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Never cache API calls or photos in the service worker: data is sensitive and must be fresh.
        runtimeCaching: [],
      },
      manifest: {
        name: 'SCKDA ಚಿನ್ನ ಮತ್ತು ಬೆಳ್ಳಿ ವಸ್ತುಗಳ ದಾಸ್ತಾನು / Gold & Silver Inventory',
        short_name: 'SCKDA ಆಭರಣ',
        description: 'Gold & Silver Articles Accounting and Inventory — Sri Chamundeshwari Kshetra Development Authority',
        display: 'standalone',
        background_color: '#2a080a',
        theme_color: '#5a1519',
        start_url: '/',
        scope: '/',
        lang: 'kn',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: { proxy: { '/api': 'http://127.0.0.1:8080' } },
  preview: { proxy: { '/api': 'http://127.0.0.1:8080' } },
});
