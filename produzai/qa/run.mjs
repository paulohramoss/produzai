#!/usr/bin/env node
// Runner do QA: sobe o app com os dublês, roda os cenários em sequência,
// imprime o relatório e sai com código != 0 se algo falhou.
//
//   npm run qa                  todos os cenários
//   npm run qa -- ciclo treino  só os cenários cujo arquivo casa com o filtro
//   npm run qa -- --headed      abrindo o navegador para você assistir

import { readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { launchBrowser, startAppServer } from './lib/browser.mjs'
import { Report } from './lib/report.mjs'

const SCENARIOS_DIR = fileURLToPath(new URL('./scenarios', import.meta.url))
const ARTIFACTS = fileURLToPath(new URL('./artifacts', import.meta.url))

const args = process.argv.slice(2)
const headed = args.includes('--headed')
const filters = args.filter(a => !a.startsWith('--'))

const files = readdirSync(SCENARIOS_DIR)
  .filter(f => f.endsWith('.mjs'))
  .filter(f => filters.length === 0 || filters.some(q => f.toLowerCase().includes(q.toLowerCase())))
  .sort()

if (files.length === 0) {
  console.error(`Nenhum cenário casa com: ${filters.join(', ')}`)
  process.exit(1)
}

const report = new Report()
let server, browser

try {
  console.log('Subindo o app com os dublês do Firebase...')
  const app = await startAppServer()
  server = app.server
  browser = await launchBrowser({ headed })
  console.log(`App em ${app.url} · ${files.length} cenário(s)`)

  for (const file of files) {
    const mod = await import(pathToFileURL(`${SCENARIOS_DIR}/${file}`))
    const scenario = mod.default
    const slug = file.replace(/\.mjs$/, '')
    const entry = report.startScenario(scenario.name ?? slug)
    const started = Date.now()

    const opened = []
    const track = s => { opened.push(s); return s }

    try {
      await scenario.run({
        browser,
        baseUrl: app.url,
        slug,
        track,
        check: (name, ok, detail) => report.check(name, ok, detail),
      })
      // Um erro de runtime no console é falha do produto, mesmo que todos os
      // checks do cenário tenham passado.
      const errs = opened.flatMap(s => s.runtimeErrors)
      report.check('sem erros de runtime no console', errs.length === 0, errs.slice(0, 2).join(' | '))
    } catch (err) {
      report.failScenario(err)
      for (const s of opened) {
        try { await s.shot('erro') } catch { /* página pode ter morrido */ }
      }
    } finally {
      entry.ms = Date.now() - started
      for (const s of opened) await s.ctx.close().catch(() => {})
    }
  }
} finally {
  await browser?.close().catch(() => {})
  await server?.close().catch(() => {})
}

mkdirSync(ARTIFACTS, { recursive: true })
writeFileSync(`${ARTIFACTS}/report.json`, JSON.stringify(report.toJSON(), null, 2))

const ok = report.print()
console.log(`\nPrints e relatório em qa/artifacts/`)
process.exit(ok ? 0 : 1)
