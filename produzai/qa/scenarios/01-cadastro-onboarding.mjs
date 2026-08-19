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

    // Quem nunca logou cai na landing, não num formulário: a porta de entrada
    // pública é o que existe antes da conta.
    check('visitante cai na landing, não no formulário',
      await page.getByText(/Pare de treinar/).first().isVisible())
    check('a landing vende benefício, não módulo',
      await page.getByText(/Sua próxima carga não precisa ser um chute/).isVisible())
    await s.shot('00-landing')

    await signUpThroughUi(page, { name: 'Paula QA', email: `p${Date.now()}@qa.dev` })

    // O padrão é o wizard de 3 passos. Cair numa conversa com a IA no primeiro
    // minuto é o atrito que esta checagem existe para impedir de voltar.
    await page.getByText('Vamos configurar seu plano em 3 passos rápidos').waitFor({ timeout: 10_000 })
    check('cadastro entra no app (não trava em "Aguarde...")', true)
    check('o padrão do onboarding é o wizard de 3 passos, não o chat', true)

    const stuck = await page.getByRole('button', { name: 'Aguarde...' }).count()
    check('botão de cadastro não fica preso em "Aguarde..."', stuck === 0)

    // O consentimento é aceito no cadastro; pedir de novo é regressão.
    const consentAgain = await page.getByText('Política de Privacidade').first().isVisible().catch(() => false)
    check('não pede consentimento outra vez após aceitar no cadastro', !consentAgain)

    // O chat continua disponível — virou escolha, deixou de ser pedágio.
    check('quem prefere conversar ainda tem o atalho para a IA',
      await page.getByText(/Prefiro conversar com a IA/).isVisible().catch(() => false))
    await s.shot('01-onboarding-wizard')

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
