// Água no Hoje.
//
// O ponto da feature não é "existe um card": é que Hoje e Dieta leem e gravam o
// MESMO `waterMl` do dia. Estado paralelo entre as duas telas é a regressão que
// este cenário existe para pegar.

import { openSession } from '../lib/app.mjs'

export default {
  name: 'Hidratação no Hoje e na Dieta',

  async run({ browser, baseUrl, slug, track, check }) {
    const s = track(await openSession(browser, { baseUrl, scenarioSlug: slug }))
    const { page } = s

    await s.open('Hoje')
    check('card de Hidratação aparece no Hoje', await page.getByText('Hidratação', { exact: true }).isVisible())

    const chip = () => page.getByText(/💧 .*L/).first().textContent()
    const before = await chip()

    await page.getByRole('button', { name: '+ 250ml' }).click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: '+ 500ml' }).click()
    await page.waitForTimeout(600)

    const after = await chip()
    check('chip do topo acompanha os botões', before !== after, `${before?.trim()} → ${after?.trim()}`)
    check('soma 250 + 500 = 0,8L', after?.includes('0,8'), after?.trim())
    await s.shot('01-hoje')

    // O botão de tirar água não pode zerar nem passar de zero.
    await page.getByRole('button', { name: '−' }).click()
    await page.waitForTimeout(500)
    check('botão de remover tira um passo de 250ml', (await chip())?.includes('0,5'))

    await page.getByRole('button', { name: '−' }).click()
    await page.getByRole('button', { name: '−' }).click()
    await page.waitForTimeout(500)
    const floor = await chip()
    check('não desce abaixo de zero', floor?.includes('0,0'), floor?.trim())

    await page.getByRole('button', { name: '+ 500ml' }).click()
    await page.waitForTimeout(600)

    // Persistência real: o valor tem de voltar do "Firestore", não do React.
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(2500)
    await s.open('Hoje')
    check('água persiste após reload', (await chip())?.includes('0,5'), (await chip())?.trim())

    // A mesma fonte de dados na Dieta.
    await s.open('Dieta')
    const onDiet = await page.locator('text=/^0,5L$/').first().isVisible().catch(() => false)
    check('Dieta mostra o mesmo valor do Hoje', onDiet)
    await s.shot('02-dieta')

    await page.getByRole('button', { name: '+ 250ml' }).click()
    await page.waitForTimeout(600)
    await s.open('Hoje')
    check('água adicionada na Dieta aparece no Hoje', (await chip())?.includes('0,8'), (await chip())?.trim())

    // Gravado no documento do dia, sem apagar hábitos e foco do mesmo dia.
    const db = await s.db()
    const dayDoc = Object.entries(db).find(([p]) => /\/daily\/\d{4}-\d{2}-\d{2}$/.test(p))?.[1]
    check('waterMl é gravado no documento do dia', dayDoc?.waterMl === 750, `waterMl=${dayDoc?.waterMl}`)
  },
}
