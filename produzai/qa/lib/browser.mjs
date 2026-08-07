// Chrome já instalado na máquina + dev server do Vite em processo.
//
// `playwright-core` não baixa navegador nenhum: usamos o Chrome do sistema. Se
// não houver Chrome, a mensagem diz o que instalar em vez de estourar um erro
// interno do Playwright.

import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const fakes = (name) => fileURLToPath(new URL(`../fakes/${name}`, import.meta.url))
const projectRoot = fileURLToPath(new URL('../..', import.meta.url))

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
]

export async function launchBrowser({ headed = false } = {}) {
  const opts = { headless: !headed, args: ['--disable-blink-features=AutomationControlled'] }
  try {
    return await chromium.launch({ ...opts, channel: 'chrome' })
  } catch {
    const found = CHROME_CANDIDATES.find(p => existsSync(p))
    if (!found) {
      throw new Error(
        'Nenhum Chrome encontrado. Instale o Google Chrome, ou rode ' +
        '`npx playwright install chromium` e ajuste qa/lib/browser.mjs.',
      )
    }
    return await chromium.launch({ ...opts, executablePath: found })
  }
}

/**
 * Sobe o app REAL com o SDK do Firebase trocado pelos dublês de qa/fakes.
 * O servidor roda dentro deste processo — sem subprocesso órfão para matar.
 */
export async function startAppServer({ port = 5199 } = {}) {
  const server = await createServer({
    configFile: false,
    root: projectRoot,
    plugins: [react()],
    resolve: {
      alias: [
        { find: /^firebase\/app$/,       replacement: fakes('firebase-app.ts') },
        { find: /^firebase\/auth$/,      replacement: fakes('firebase-auth.ts') },
        { find: /^firebase\/firestore$/, replacement: fakes('firebase-firestore.ts') },
        { find: /^firebase\/storage$/,   replacement: fakes('firebase-storage.ts') },
      ],
    },
    server: { port, strictPort: true },
    logLevel: 'error',
    // O PWA fica de fora de propósito: service worker cacheando o bundle entre
    // cenários é fonte de falha intermitente que não diz nada sobre o produto.
  })
  await server.listen()
  return { server, url: `http://localhost:${port}` }
}
