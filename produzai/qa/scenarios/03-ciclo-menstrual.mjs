// Ciclo menstrual — dado sensível e opt-in.
//
// A regressão mais grave aqui não é visual: é o app começar a coletar ou exibir
// ciclo sem a usuária ter ligado, ou não apagar os registros ao desligar.

import { openSession } from '../lib/app.mjs'

export default {
  name: 'Ciclo menstrual (opt-in)',

  async run({ browser, baseUrl, slug, track, check }) {
    const s = track(await openSession(browser, { baseUrl, scenarioSlug: slug }))
    const { page } = s

    // ── Desligado por padrão ─────────────────────────────────────────────────
    await s.open('Hoje')
    const cardBefore = await page.getByRole('button', { name: /Menstruei hoje/ }).count()
    check('nada de ciclo aparece antes do opt-in', cardBefore === 0)

    const dbBefore = await s.db()
    check('nenhum documento de ciclo é criado antes do opt-in',
      !Object.keys(dbBefore).some(p => p.endsWith('/data/cycle')))

    // ── Ligando ──────────────────────────────────────────────────────────────
    await s.openProfile()
    await page.getByText('Ciclo menstrual').first().scrollIntoViewIfNeeded()
    const toggle = page.getByRole('switch')
    check('chave começa desligada', await toggle.getAttribute('aria-checked') === 'false')
    await toggle.click()
    await page.waitForTimeout(800)
    check('chave liga', await toggle.getAttribute('aria-checked') === 'true')
    await s.shot('01-perfil')

    await s.open('Hoje')
    const cta = page.getByRole('button', { name: /Menstruei hoje/ })
    check('card do ciclo aparece depois do opt-in', await cta.isVisible())

    await cta.click()
    await page.waitForTimeout(1200)
    check('mostra a fase depois de registrar', await page.getByText(/Fase menstrual/).isVisible())
    check('mostra o dia do ciclo', await page.getByText('dia do ciclo').isVisible())
    check('prevê a próxima menstruação', await page.getByText(/Próxima menstruação em \d+ dias/).isVisible())
    check('mostra o rendimento típico da fase', await page.getByText(/60\/100/).isVisible())
    await s.shot('02-hoje-fase-menstrual')

    const repeated = await page.getByRole('button', { name: /Início registrado hoje/ }).isVisible()
    check('não deixa registrar o mesmo início duas vezes', repeated)

    const dbAfter = await s.db()
    const cycle = Object.entries(dbAfter).find(([p]) => p.endsWith('/data/cycle'))?.[1]
    check('registro grava a data de início', cycle?.starts?.length === 1, JSON.stringify(cycle?.starts))
    check('opt-in fica gravado', cycle?.enabled === true)

    // ── Duração personalizada ────────────────────────────────────────────────
    await s.openProfile()
    await page.getByText('Ciclo menstrual').first().scrollIntoViewIfNeeded()
    // Sem fallback de propósito: se `getByLabel` parar de achar o campo, é
    // porque o rótulo se desassociou do input — defeito de acessibilidade que o
    // cenário deve reprovar, não contornar.
    await page.getByLabel('Ciclo (dias)').fill('31')
    await page.getByRole('button', { name: 'Salvar duração' }).click()
    await page.waitForTimeout(900)
    await s.open('Hoje')
    // Ciclo de 31 dias, registrado hoje (dia 1): o próximo início cai 31 dias
    // à frente — a duração conta do primeiro dia de um fluxo ao do seguinte.
    check('duração personalizada muda a previsão',
      await page.getByText(/Próxima menstruação em 31 dias/).isVisible())

    // ── Desligar apaga tudo ──────────────────────────────────────────────────
    await s.openProfile()
    await page.getByText('Ciclo menstrual').first().scrollIntoViewIfNeeded()
    await page.getByRole('switch').click()
    await page.waitForTimeout(500)
    check('desligar pede confirmação por apagar histórico',
      await page.getByText(/Desligar apaga/).isVisible())
    await s.shot('03-confirmacao-desligar')

    await page.getByRole('button', { name: 'Desligar e apagar' }).click()
    await page.waitForTimeout(1200)

    const dbOff = await s.db()
    const cycleOff = Object.entries(dbOff).find(([p]) => p.endsWith('/data/cycle'))?.[1]
    check('desligar apaga as datas registradas', (cycleOff?.starts ?? []).length === 0)
    check('desligar grava o opt-out', cycleOff?.enabled === false)

    await s.open('Hoje')
    check('card some do Hoje depois de desligar',
      await page.getByRole('button', { name: /Menstruei hoje/ }).count() === 0)
  },
}
