// Link read-only do treinador.
//
// Este cenário é meio funcional, meio de privacidade. O que ele guarda:
// o link abre sem login, mostra o que deve mostrar, NÃO vaza o que não deve
// (ciclo menstrual, e-mail, uid), e morre de verdade quando revogado.

import { openSession, openAnonymousSession, seededUser } from '../lib/app.mjs'
import { todayIso, isoDaysAgo } from '../lib/dates.mjs'

export default {
  name: 'Link read-only do treinador',

  async run({ browser, baseUrl, slug, track, check }) {
    // Atleta com um treino e um check-in de prontidão já registrados, para o
    // resumo ter conteúdo de verdade.
    const user = seededUser({
      email: 'compartilha@qa.dev',
      name: 'Paula QA',
      profile: { sex: 'feminino', weightKg: 62 },
    })
    // Os caminhos dependem do uid, que só existe depois de montar o usuário.
    user.db[`users/${user.uid}/data/workouts`] = {
      items: [{
        id: 'w1', type: 'Corrida', name: 'Longão de domingo',
        rawDate: isoDaysAgo(2), date: 'Dom 5 de ago.',
        dist: 14, pace: "5'30\"", time: '1h17', cal: 980, hr: 152, elev: 0,
        effort: 3, source: 'manual',
        notes: 'Última série puxada, joelho reclamou na descida.',
        painLevel: 3, painArea: 'joelho direito',
      }],
    }
    user.db[`users/${user.uid}/dailyMonthly/${todayIso().slice(0, 7)}`] = {
      [todayIso()]: {
        waterMl: 2000,
        readiness: { sleepHours: 8, sleepQuality: 4, soreness: 2, drive: 4, loggedAt: Date.now() },
      },
    }

    const s = track(await openSession(browser, { baseUrl, scenarioSlug: slug, user }))
    const { page } = s

    // ── Geração ──────────────────────────────────────────────────────────────
    await s.openProfile()
    await page.getByText('Compartilhar com treinador').scrollIntoViewIfNeeded()
    check('aviso de que o link é público aparece antes de gerar',
      await page.getByText(/Quem tiver o link vê esses dados/).isVisible())

    await page.getByRole('button', { name: /Gerar link para o treinador/ }).click()
    await page.waitForTimeout(2000)

    const linkText = await page.getByText(/\?coach=/).first().textContent()
    const token = linkText?.match(/\?coach=([a-f0-9]+)/)?.[1]
    check('token tem 160 bits em hex', token?.length === 40, `${token?.length} caracteres`)
    await s.shot('01-perfil')

    // ── Página pública ───────────────────────────────────────────────────────
    const db = await s.db()
    const coach = track(await openAnonymousSession(browser, { baseUrl, scenarioSlug: slug, db }))
    await coach.goto(`/?coach=${token}`)
    await coach.page.waitForTimeout(1500)

    check('abre sem sessão de login',
      await coach.page.evaluate(() => localStorage.getItem('qa_auth_user') === null))
    check('não renderiza a navegação do app',
      await coach.page.getByRole('button', { name: 'Ir para perfil' }).count() === 0)
    check('mostra o nome da atleta', await coach.page.getByText('Paula QA').isVisible())
    check('mostra o treino do período', await coach.page.getByText('Longão de domingo').isVisible())
    check('mostra a nota do treino', await coach.page.getByText(/joelho reclamou na descida/).isVisible())
    check('mostra a dor relatada', await coach.page.getByText(/Dor 3\/5/).isVisible())
    check('destaca treinos com dor no topo', await coach.page.getByText(/1 treino com dor relatada/).isVisible())
    check('mostra prontidão do dia', await coach.page.getByText(/PRONTIDÃO MÉDIA/i).isVisible())
    check('mostra hidratação', await coach.page.getByText(/2,0L/).isVisible())
    await coach.shot('02-treinador')

    // ── Privacidade ──────────────────────────────────────────────────────────
    const body = await coach.page.locator('body').innerText()
    check('não vaza dados de ciclo menstrual', !/menstrua|ciclo|folicular|lútea/i.test(body))
    check('não vaza o e-mail da atleta', !body.includes('compartilha@qa.dev'))
    check('não vaza o uid', !body.includes(user.uid))
    check('deixa claro que é somente leitura', /Somente leitura/i.test(body))

    // ── Revogação ────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Revogar link' }).click()
    await page.waitForTimeout(400)
    await page.getByRole('button', { name: /Confirmar/ }).click()
    await page.waitForTimeout(1500)

    const dbAfter = await s.db()
    check('revogar apaga o documento do resumo', !dbAfter[`coachShares/${token}`])

    const revoked = track(await openAnonymousSession(browser, { baseUrl, scenarioSlug: slug, db: dbAfter }))
    await revoked.goto(`/?coach=${token}`)
    await revoked.page.waitForTimeout(1500)
    check('link revogado para de funcionar', await revoked.page.getByText('Link indisponível').isVisible())
    check('nada do atleta sobra na página revogada',
      !(await revoked.page.locator('body').innerText()).includes('Longão'))
    await revoked.shot('03-revogado')
  },
}
