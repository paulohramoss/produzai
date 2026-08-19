import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Troca `__SITE_URL__` no index.html pela origem publicada.
 *
 * As tags Open Graph exigem URL ABSOLUTA — o WhatsApp e o Google buscam a
 * imagem de um servidor que não conhece a página. Sem isto a prévia do link
 * chega sem imagem. Defina VITE_SITE_URL no ambiente do deploy.
 */
function siteUrl(url: string): Plugin {
  return {
    name: 'rise-site-url',
    transformIndexHtml: html => html.replaceAll('__SITE_URL__', url.replace(/\/$/, '')),
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
  plugins: [
    react(),
    siteUrl(env.VITE_SITE_URL || 'http://localhost:5173'),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: false },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        importScripts: ['/sw-push.js'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'The Rise Plan',
        short_name: 'Rise Plan',
        description: 'Seu histórico de treino vira decisão: qual carga puxar hoje, o que comprar no mercado e quando descansar.',
        theme_color: '#F97316',
        background_color: '#0C0C0C',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'portrait',
        lang: 'pt-BR',
        categories: ['fitness', 'health', 'lifestyle'],
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
  }
})
