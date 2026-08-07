// Notas e dor por treino, e a correção de um treino já salvo.
//
// A regressão cara aqui é a edição duplicar o registro ou perder a origem
// Strava — treino duplicado envenena volume, carga e recordes.

import { openSession } from '../lib/app.mjs'

export default {
  name: 'Treino: notas, dor e edição',

  async run({ browser, baseUrl, slug, track, check }) {
    const s = track(await openSession(browser, { baseUrl, scenarioSlug: slug }))
    const { page } = s

    await s.open('Treino')
    await page.getByRole('button', { name: '+ Registrar treino' }).first().click()
    await page.waitForTimeout(600)

    await page.getByPlaceholder('ex: 45').fill('50')
    await page.getByPlaceholder('ex: 5.2').fill('8')
    await page.getByPlaceholder(/Sensação, clima/).fill('Pernas pesadas no fim, calor forte.')

    // A escala de dor precisa caber numa linha só — "Muito forte" já quebrou sozinha.
    const painButtons = page.locator('button', { hasText: /^(Não|Leve|Incômoda|Média|Forte|Muito forte)$/ })
    const boxes = await painButtons.evaluateAll(els => els.map(e => e.getBoundingClientRect().top))
    const rows = new Set(boxes.map(t => Math.round(t)))
    check('escala de dor cabe numa linha só', rows.size === 1, `${rows.size} linha(s)`)

    await page.getByRole('button', { name: 'Forte', exact: true }).last().click()
    await page.waitForTimeout(300)
    check('dor forte dispara o aviso de lesão',
      await page.getByText(/sinal de lesão, não de treino puxado/).isVisible())

    await page.getByPlaceholder(/Onde doeu/).fill('joelho direito')
    await s.shot('01-formulario')
    await page.getByRole('button', { name: 'Salvar treino' }).click()
    await page.waitForTimeout(1200)

    check('nota aparece na lista', await page.getByText(/Pernas pesadas no fim/).isVisible())
    check('dor e local aparecem na lista', await page.getByText(/joelho direito/).isVisible())
    await s.shot('02-lista')

    const saved = (await s.db())
    const workouts = Object.entries(saved).find(([p]) => p.endsWith('/data/workouts'))?.[1]?.items ?? []
    check('treino gravado com nota e dor',
      workouts[0]?.painLevel === 4 && workouts[0]?.notes?.startsWith('Pernas pesadas'),
      `painLevel=${workouts[0]?.painLevel}`)

    // ── Edição ───────────────────────────────────────────────────────────────
    const idBefore = workouts[0]?.id
    await page.getByTitle('Editar').first().click()
    await page.waitForTimeout(700)

    check('modal abre em modo edição', await page.getByText('Editar treino').isVisible())
    check('duração vem preenchida', await page.getByPlaceholder('ex: 45').inputValue() === '50')
    check('nota vem preenchida',
      (await page.getByPlaceholder(/Sensação, clima/).inputValue()).startsWith('Pernas pesadas'))
    check('local da dor vem preenchido',
      await page.getByPlaceholder(/Onde doeu/).inputValue() === 'joelho direito')
    check('preenchimento por IA fica fora da edição',
      await page.getByRole('button', { name: /Preencher com IA/ }).count() === 0)

    await page.getByPlaceholder('ex: 45').fill('62')
    await page.getByPlaceholder(/Sensação, clima/).fill('Corrigido: 62 minutos, dor passou.')
    await page.getByRole('button', { name: 'Leve', exact: true }).last().click()
    await s.shot('03-edicao')
    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    await page.waitForTimeout(1200)

    const after = (await s.db())
    const updated = Object.entries(after).find(([p]) => p.endsWith('/data/workouts'))?.[1]?.items ?? []
    check('edição não duplica o treino', updated.length === workouts.length, `${workouts.length} → ${updated.length}`)
    check('edição preserva o id', updated[0]?.id === idBefore)
    check('nota nova foi salva', updated[0]?.notes?.startsWith('Corrigido'))
    check('nível de dor foi corrigido', updated[0]?.painLevel === 1, `painLevel=${updated[0]?.painLevel}`)
    check('duração derivada recalculada', updated[0]?.time === '1h02', `time=${updated[0]?.time}`)
    check('lista mostra a nota corrigida', await page.getByText(/Corrigido: 62 minutos/).isVisible())
    await s.shot('04-editado')

    // ── Dor removida some da lista ───────────────────────────────────────────
    await page.getByTitle('Editar').first().click()
    await page.waitForTimeout(600)
    await page.getByRole('button', { name: 'Não', exact: true }).click()
    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    await page.waitForTimeout(1200)

    const cleared = Object.entries(await s.db()).find(([p]) => p.endsWith('/data/workouts'))?.[1]?.items ?? []
    check('marcar "Não" remove a dor do registro', cleared[0]?.painLevel === undefined)
    check('local da dor sai junto', cleared[0]?.painArea === undefined)
    check('lista não mostra mais dor', await page.getByText(/joelho direito/).count() === 0)
  },
}
