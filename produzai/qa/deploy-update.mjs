#!/usr/bin/env node
// Um deploy de verdade, visto pelo cliente: `npm run qa:update`
//
// Isto não roda com os dublês nem com o dev server — o mecanismo que estamos
// testando é o Service Worker, e ele só existe no build de produção. O roteiro é
// o de um deploy real:
//
//   1. build A entra no ar, a pessoa abre o app e o SW assume o controle
//   2. build B entra no ar (outro commit, outro id, outro hash de bundle)
//   3. o app percebe sozinho, ESPERA a hora segura e troca de versão
//
// O passo 3 é o que nenhum teste de tela pega: o app antigo continua
// funcionando, então "abriu e apareceu" não prova nada. Aqui conferimos as duas
// metades da política escolhida — que ele NÃO recarrega na cara de quem está
// usando, e que ele recarrega assim que pode.

import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { cpSync, mkdtempSync, readFileSync, rmSync, existsSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { launchBrowser } from './lib/browser.mjs'

const APP = fileURLToPath(new URL('..', import.meta.url))
const PORT = 5188
const ORIGIN = `http://localhost:${PORT}`

const results = []
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail })
  const mark = ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'
  console.log(`  ${mark} ${name}${detail ? ` \x1b[2m— ${detail}\x1b[0m` : ''}`)
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

/**
 * Servidor estático com os MESMOS headers do vercel.json.
 *
 * Servir tudo com o cache liberado faria o teste passar por sorte; servir tudo
 * sem cache faria passar por outro motivo. As regras de cache são metade do
 * mecanismo, então o teste tem de rodar com elas.
 */
function startServer(rootDir) {
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, ORIGIN).pathname)
    const isAsset = urlPath.startsWith('/assets/')
    let file = join(rootDir, normalize(urlPath).replace(/^(\.\.[/\\])+/, ''))

    if (!existsSync(file) || statSync(file).isDirectory()) {
      // Rota do SPA cai no index.html; arquivo que não existe é 404 de verdade.
      // Servir HTML no lugar de um .js ausente só produziria erro de sintaxe.
      if (extname(urlPath)) { res.statusCode = 404; res.end('not found'); return }
      file = join(rootDir, 'index.html')
    }

    res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream')
    res.setHeader('Cache-Control', isAsset
      ? 'public, max-age=31536000, immutable'
      : 'no-cache, must-revalidate')
    res.end(readFileSync(file))
  })
  return new Promise(resolve => server.listen(PORT, () => resolve(server)))
}

/** Publica uma build com um id de commit próprio, como a Vercel faria. */
function deploy(sha, serveDir) {
  execFileSync('npm', ['run', 'build'], {
    cwd: APP,
    env: { ...process.env, VERCEL_GIT_COMMIT_SHA: sha },
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  rmSync(serveDir, { recursive: true, force: true })
  cpSync(join(APP, 'dist'), serveDir, { recursive: true })
  return JSON.parse(readFileSync(join(serveDir, 'version.json'), 'utf8')).buildId
}

/** Qual bundle esta página carregou. Muda a cada build — é a prova do reload. */
const loadedBundle = page => page.evaluate(() =>
  document.querySelector('script[type=module][src*="/assets/"]')?.src ?? '')

const serveDir = mkdtempSync(join(tmpdir(), 'rise-deploy-'))
let server, browser

try {
  console.log('\n\x1b[1m▸ Deploy A entra no ar\x1b[0m')
  const idA = deploy('aaaaaaaaaaaa1111', serveDir)
  server = await startServer(serveDir)
  check('build A publicada com id próprio', idA === 'aaaaaaaaaaaa', `buildId=${idA}`)

  browser = await launchBrowser({ headed: process.argv.includes('--headed') })
  const ctx = await browser.newContext({ serviceWorkers: 'allow' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))

  await page.goto(ORIGIN, { waitUntil: 'load' })
  await page.waitForFunction(
    () => navigator.serviceWorker.ready.then(r => r.active?.state === 'activated'),
    null, { timeout: 30_000 },
  )

  // A primeira visita NÃO fica sob controle do SW — é isso que distingue
  // "instalei agora" de "saiu versão nova", e o app não pode confundir os dois.
  const controlledOnFirstVisit = await page.evaluate(() => !!navigator.serviceWorker.controller)
  check('primeira visita não é confundida com atualização', !controlledOnFirstVisit)

  await page.reload({ waitUntil: 'load' })
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20_000 })
  check('SW assume o controle na segunda visita',
    await page.evaluate(() => !!navigator.serviceWorker.controller))

  const bundleA = await loadedBundle(page)
  check('cliente está rodando a build A', bundleA.includes('/assets/'), bundleA.split('/').pop())

  console.log('\n\x1b[1m▸ Deploy B entra no ar, com o cliente usando o app\x1b[0m')
  const idB = deploy('bbbbbbbbbbbb2222', serveDir)
  check('build B publicada com id diferente', idB !== idA, `${idA} → ${idB}`)

  // Alguém digitando: a troca não pode acontecer agora, custe o que custar.
  await page.evaluate(() => {
    const input = document.createElement('input')
    input.id = 'em-edicao'
    document.body.appendChild(input)
    input.focus()
    input.value = 'série que ainda não foi salva'
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }))
  })

  // O gatilho realista de "voltei a ter rede" força a checagem imediata.
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await page.waitForTimeout(6000)

  const stillA = await loadedBundle(page)
  check('NÃO recarrega enquanto a pessoa digita', stillA === bundleA,
    stillA === bundleA ? 'continua na build A, como deve' : 'recarregou e comeu o que foi digitado')
  const typed = await page.evaluate(() =>
    document.getElementById('em-edicao')?.value ?? null)
  check('o que estava digitado sobreviveu', typed === 'série que ainda não foi salva',
    typed === null ? 'campo desapareceu (página recarregou)' : typed)

  // Agora a aba vai para segundo plano: hora segura, ninguém olhando.
  //
  // O Chrome headless não muda `visibilityState` ao trocar de aba, então o
  // estado é forjado aqui. O que está sob teste é a POLÍTICA do app diante de
  // uma aba escondida — não a janela do sistema operacional.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
  })

  await page.waitForFunction(
    bundle => document.querySelector('script[type=module][src*="/assets/"]')?.src !== bundle,
    bundleA, { timeout: 30_000 },
  ).catch(() => {})

  await page.waitForTimeout(1500)
  const bundleAfter = await loadedBundle(page)
  check('trocou de versão sozinho ao ficar em segundo plano', bundleAfter !== bundleA,
    `${bundleA.split('/').pop()} → ${bundleAfter.split('/').pop()}`)

  const servedId = await page.evaluate(async () =>
    (await (await fetch('/version.json', { cache: 'no-store' })).json()).buildId)
  check('cliente e servidor na mesma versão', servedId === idB, `servidor=${servedId}`)

  // Convergiu: nenhuma recarga a mais. Um loop de reload seria pior que ficar
  // na versão antiga, e o teto de MAX_RELOADS existe para isso.
  const reloadsUsed = await page.evaluate(() => sessionStorage.getItem('rise:updateReloads'))
  check('parou de recarregar depois de atualizar', Number(reloadsUsed ?? 0) <= 1,
    `recargas por atualização=${reloadsUsed ?? 0}`)

  const real = errors.filter(e => !/Firebase|auth\/|api-key|Failed to fetch/i.test(e))
  check('sem erros de runtime no caminho todo', real.length === 0, real[0])
} finally {
  await browser?.close()
  server?.close()
  rmSync(serveDir, { recursive: true, force: true })
}

const failed = results.filter(r => !r.ok)
console.log(`\n\x1b[1m─── Resultado ───\x1b[0m\nChecks: ${results.length - failed.length}/${results.length}`)
if (failed.length) {
  console.log('\x1b[31m\x1b[1m\nFalhou:\x1b[0m')
  for (const f of failed) console.log(`  ✗ ${f.name}${f.detail ? ` — ${f.detail}` : ''}`)
  process.exit(1)
}
console.log('\x1b[32m\x1b[1mO cliente se atualiza sozinho, e só quando é seguro.\x1b[0m')
