// Cadastro e primeira entrada.
//
// Regressão que este cenário guarda: o cadastro já travou em "Aguarde..." para
// sempre porque o listener de auth quebrava antes de publicar o usuário quando
// a carga do Firestore falhava. Nenhum check de unidade pegava isso.

import { openSession, signUpThroughUi } from '../lib/app.mjs'

export default {
  name: 'Cadastro e onboarding',

  async run({ browser, baseUrl, slug, track, check }) {
    const s = track(await openSession(browser, { baseUrl, scenarioSlug: slug, user: null }))
    const { page } = s

    check('tela de login abre', await page.getByText('Entrar na conta').isVisible())

    await signUpThroughUi(page, { name: 'Paula QA', email: `p${Date.now()}@qa.dev` })

    // O sintoma do bug era exatamente este waitFor estourar.
    await page.getByText('Vamos te conhecer').waitFor({ timeout: 10_000 })
    check('cadastro entra no app (não trava em "Aguarde...")', true)

    const stuck = await page.getByRole('button', { name: 'Aguarde...' }).count()
    check('botão de cadastro não fica preso em "Aguarde..."', stuck === 0)

    // O consentimento é aceito no cadastro; pedir de novo é regressão.
    const consentAgain = await page.getByText('Política de Privacidade').first().isVisible().catch(() => false)
    check('não pede consentimento outra vez após aceitar no cadastro', !consentAgain)

    // Saída de escape do onboarding por conversa.
    const quick = page.getByRole('button', { name: /Prefiro o modo rápido/ })
    const box = await quick.boundingBox()
    check('atalho do modo rápido é um botão visível de largura cheia', box.width > 400, `${Math.round(box.width)}px`)
    await s.shot('01-onboarding-conversa')

    await quick.click()
    await page.getByText('Vamos configurar seu plano em 3 passos rápidos').waitFor({ timeout: 10_000 })
    check('modo rápido abre o wizard de 3 passos', true)

    await page.getByText('Ter mais energia').click()
    await page.getByRole('button', { name: /Continuar/ }).click()
    await page.getByRole('button', { name: /Continuar/ }).click()
    await page.getByRole('button', { name: /Começar agora/ }).click()

    await page.getByRole('button', { name: 'Hoje', exact: true }).first().waitFor({ timeout: 10_000 })
    await page.waitForTimeout(1500)
    check('wizard concluído leva ao app', await page.getByText('Sair da conta').isVisible())
    await s.shot('02-app-aberto')

    // Onboarding concluído precisa estar no perfil, senão o wizard volta no reload.
    const db = await s.db()
    const profile = Object.entries(db).find(([p]) => p.endsWith('/data/profile'))?.[1]
    check('onboarding fica marcado como concluído no perfil', profile?.onboardingDone === true)

    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(2500)
    check('reload não devolve o usuário ao onboarding', await page.getByText('Sair da conta').isVisible())
  },
}
