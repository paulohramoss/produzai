// Registro retroativo: quem esquece de marcar na hora não pode perder o dado
// de performance. Treino permite escolher uma data passada; Histórico permite
// abrir qualquer dia já vivido e marcar os hábitos daquele dia, mesmo que o
// preenchimento em si aconteça hoje.

import { openSession, seededUser } from '../lib/app.mjs'

function pad(n) { return String(n).padStart(2, '0') }
function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default {
  name: 'Registro retroativo de treino e hábitos',

  async run({ browser, baseUrl, slug, track, check }) {
    const user = seededUser({ email: 'retro@qa.dev', name: 'Atleta Retro' })
    const s = track(await openSession(browser, { baseUrl, scenarioSlug: slug, user }))
    const { page } = s

    // ── Treino: registrar um treino de 3 dias atrás ─────────────────────────
    await s.open('Treino')
    await page.getByRole('button', { name: '+ Registrar treino' }).first().click()
    await page.waitForTimeout(600)
    await page.getByText('+ Nome, data, esforço e FC').click()
    await page.waitForTimeout(300)

    const past = daysAgo(3)
    await page.locator('input[type="date"]').fill(past)
    await page.getByPlaceholder('ex: 45').fill('40')
    await s.shot('01-treino-data-passada')
    await page.getByRole('button', { name: 'Salvar treino' }).click()
    await page.waitForTimeout(1200)

    const saved = await s.db()
    const workouts = Object.entries(saved).find(([p]) => p.endsWith('/data/workouts'))?.[1]?.items ?? []
    check('treino gravado com a data selecionada (não a de hoje)',
      workouts[0]?.rawDate === past, `esperado=${past} gravado=${workouts[0]?.rawDate}`)

    // ── Histórico: abrir um dia de 2 dias atrás e marcar um hábito ──────────
    await s.open('Histórico')
    await page.waitForTimeout(900)

    const target = daysAgo(2)
    const targetDay = Number(target.slice(-2))
    await page.getByText(String(targetDay), { exact: true }).first().click()
    await page.waitForTimeout(700)
    await s.shot('02-historico-dia-selecionado')

    check('checklist do dia passado aparece editável',
      await page.getByText('Água 3L').isVisible())

    await page.getByText('Água 3L').click()
    await page.waitForTimeout(900)

    const afterHabit = await s.db()
    const uid = s.user.uid
    const dailyDoc = afterHabit[`users/${uid}/daily/${target}`]
    check('hábito marcado fica gravado sob a data escolhida, não a de hoje',
      dailyDoc?.habits?.some(h => h.id === 'h1' && h.done === true),
      `habits=${JSON.stringify(dailyDoc?.habits)}`)

    // ── Dia futuro não é editável ────────────────────────────────────────────
    const future = new Date()
    future.setDate(future.getDate() + 5)
    if (future.getMonth() === new Date().getMonth()) {
      const futureDay = future.getDate()
      const futureCell = page.getByText(String(futureDay), { exact: true }).first()
      const opacity = await futureCell.evaluate(el => getComputedStyle(el).opacity)
      check('dia futuro no calendário fica desabilitado', Number(opacity) < 1, `opacity=${opacity}`)
    }
  },
}
