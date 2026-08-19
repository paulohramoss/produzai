// Diário de treino: sentimentos, dores e motivação, disponíveis depois para o
// Coach cruzar com o volume de treino e sinalizar sobrecarga.
//
// O risco caro aqui é salvar sob a data errada ou não persistir nada — a
// feature existe para o Coach enxergar padrão ao longo dos dias, então o
// texto de hoje precisa estar gravado sob a chave de hoje.

import { openSession } from '../lib/app.mjs'

export default {
  name: 'Diário de treino: registrar e ver insights',

  async run({ browser, baseUrl, slug, track, check }) {
    const s = track(await openSession(browser, { baseUrl, scenarioSlug: slug }))
    const { page } = s

    await s.open('Treino')
    await page.getByText('Diário de treino').first().scrollIntoViewIfNeeded()
    check('card do diário aparece na aba Treino', await page.getByText('Diário de treino').isVisible())

    const textarea = page.getByPlaceholder(/hoje o treino foi pesado/i)
    await textarea.fill('Hoje o treino foi pesado, senti uma dor leve no joelho e pouca motivação.')
    await s.shot('01-preenchido')

    // onBlur dispara o save — tirar o foco do campo clicando fora.
    await page.getByText('Diário de treino').first().click()
    await page.waitForTimeout(900)

    check('toast de diário salvo aparece', await page.getByText('Diário salvo').isVisible().catch(() => false))

    const saved = await s.db()
    const uid = s.user.uid
    const today = new Date().toISOString().slice(0, 10)
    const journalDoc = saved[`users/${uid}/journal/${today}`]
    check('entrada do diário gravada sob a data de hoje',
      journalDoc?.text?.startsWith('Hoje o treino foi pesado'),
      `text=${journalDoc?.text}`)

    const ym = today.slice(0, 7)
    const monthlyDoc = saved[`users/${uid}/journalMonthly/${ym}`]
    check('agregação mensal também recebe a entrada de hoje',
      monthlyDoc?.[today]?.text?.startsWith('Hoje o treino foi pesado'))

    check('botão de gerar insights aparece quando há conteúdo',
      await page.getByRole('button', { name: /Gerar insights do diário/ }).isVisible())

    // `/api/*` não sobe neste harness (ver limites do QA) — clicar aqui só
    // confirma que a falha de rede é tratada sem quebrar a tela, não que a
    // IA responde. A cor por riskLevel é coberta por revisão de código.
    await page.getByRole('button', { name: /Gerar insights do diário/ }).click()
    await page.waitForTimeout(1500)
    check('falha de rede ao gerar insights não quebra a página',
      await page.getByText('Diário de treino').isVisible())
    await s.shot('02-apos-tentativa-insights')

    // ── Reload: o texto de hoje precisa vir de volta do "servidor" ──────────
    await s.goto('/')
    await s.open('Treino')
    await page.waitForTimeout(900)
    const reloadedTextarea = page.getByPlaceholder(/hoje o treino foi pesado/i)
    check('texto de hoje persiste após reload',
      (await reloadedTextarea.inputValue()).startsWith('Hoje o treino foi pesado'))
  },
}
