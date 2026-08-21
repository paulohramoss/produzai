import { execSync } from 'node:child_process'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Identidade desta build — é o commit que a gerou.
 *
 * É o que faz "toda vez que eu commito, o cliente pega a versão nova" ser
 * verificável em vez de fé: o app carrega o id embutido no bundle e compara com
 * o /version.json servido pela rede. Diferente = tem versão nova no ar.
 *
 * Na Vercel o SHA vem no ambiente (o build roda sem o .git). Fora dela, lemos o
 * git local. O timestamp é último recurso: sem ele, um ambiente sem git nenhum
 * geraria builds com o mesmo id e o app nunca perceberia a troca.
 */
function resolveBuildId(): string {
  const fromCi = process.env.VERCEL_GIT_COMMIT_SHA
  if (fromCi) return fromCi.slice(0, 12)
  try {
    return execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim()
  } catch {
    return `t${Date.now().toString(36)}`
  }
}

/**
 * Publica o id da build num arquivo que o Service Worker NÃO guarda em cache.
 *
 * Sem isto o app não tem como saber que está velho: quem serve as telas é o
 * precache do SW, então a própria página que ele carrega já é a antiga. Este
 * arquivo é a única coisa que sempre vem da rede — é o termômetro.
 */
function versionEndpoint(buildId: string): Plugin {
  return {
    name: 'rise-version-endpoint',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ buildId, builtAt: Date.now() }),
      })
    },
  }
}

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
  const buildId = resolveBuildId()
  return {
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [
    react(),
    siteUrl(env.VITE_SITE_URL || 'http://localhost:5173'),
    versionEndpoint(buildId),
    VitePWA({
      // `prompt` NÃO significa perguntar para o usuário: significa que a página
      // decide QUANDO trocar de versão, em vez de o SW novo assumir sozinho no
      // instante em que termina de baixar. A diferença importa — enquanto a
      // versão antiga está na tela, ela precisa do precache antigo para os
      // chunks que ainda vai carregar. Quem decide o momento é lib/appUpdate.
      registerType: 'prompt',
      // Registramos o SW à mão, no appUpdate: o script que o plugin injeta só
      // registra e vai embora, sem nunca voltar a checar se saiu versão nova.
      injectRegister: null,
      devOptions: { enabled: false },
      workbox: {
        // Com `skipWaiting: false` o Workbox põe no SW um listener de
        // 'SKIP_WAITING' — é por essa mensagem que a página aplica a troca.
        skipWaiting: false,
        clientsClaim: false,
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        // A capa de compartilhamento tem 211 KB e quem a busca é o robô do
        // WhatsApp/Google, nunca o app. Fora do precache ela deixa de ser
        // baixada na primeira visita de todo mundo.
        globIgnores: ['**/og-cover.png'],
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
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // A `maskable` recua a arte: o sistema recorta até 20% de cada borda
          // para encaixar o ícone no formato do aparelho.
          { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  }
})
