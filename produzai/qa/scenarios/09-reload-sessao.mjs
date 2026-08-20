// F5 com sessão aberta não pode passar pela landing.
//
// A regressão que este cenário existe para pegar: o App decidia entre landing e
// splash lendo `firebase:authUser:` do localStorage, mas o Firebase guarda a
// sessão no IndexedDB. A chave nunca existia, então TODO reload de quem já
// estava logado renderizava a landing primeiro — dava a impressão de ter sido
// deslogado. Ver src/lib/sessionHint.ts.
//
// Conferir só a tela final não pega isso: um instante depois o app aparece de
// qualquer jeito. Então gravamos a PRIMEIRA tela pintada, com um
// MutationObserver que roda antes de qualquer script da página.

import { openSession, openAnonymousSession } from '../lib/app.mjs'

/** Marcas de texto exclusivas da landing pública. */
const LANDING = /Pare de treinar|Começar hoje|é grátis/i

const RECORDER = () => {
  window.__screens = []
  const seen = new Set()
  const record = () => {
    const root = document.getElementById('root')
    const text = (root?.innerText ?? '').trim().slice(0, 300)
    if (!text || seen.has(text)) return
    seen.add(text)
    window.__screens.push(text)
  }
  new MutationObserver(record).observe(document, {
    childList: true, subtree: true, characterData: true,
  })
}

export default {
  name: 'Reload com sessão aberta não volta para a landing',

  async run({ browser, baseUrl, slug, track, check }) {
    const s = track(await openSession(browser, { baseUrl, scenarioSlug: slug }))
    const { page } = s

    // O bilhete de sessão é o que faz o próximo boot acertar a tela.
    const flag = await page.evaluate(() => localStorage.getItem('rise:auth'))
    check('sessão aberta grava o bilhete de sessão', flag === '1', `rise:auth=${flag}`)

    await s.ctx.addInitScript(RECORDER)
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(2500)

    const screens = await page.evaluate(() => window.__screens ?? [])
    const first = screens[0] ?? ''
    check('alguma tela foi gravada no boot', screens.length > 0, `${screens.length} tela(s)`)
    check(
      'primeira tela do reload não é a landing',
      !LANDING.test(first),
      first.replace(/\s+/g, ' ').slice(0, 90),
    )
    const flash = screens.findIndex(t => LANDING.test(t))
    check(
      'a landing não pisca em nenhum momento do boot',
      flash === -1,
      flash === -1 ? undefined : `tela #${flash + 1} era a landing`,
    )
    check('o app assenta logado depois do reload', await page
      .getByRole('button', { name: 'Hoje', exact: true }).first()
      .isVisible().catch(() => false))
    await s.shot('01-depois-do-reload')

    // O outro lado da moeda: quem NÃO tem sessão precisa ver a landing na hora,
    // sem passar por "Carregando..." — é para isso que o palpite existe.
    const v = track(await openAnonymousSession(browser, { baseUrl, scenarioSlug: slug }))
    await v.ctx.addInitScript(RECORDER)
    await v.goto('/')
    const visitor = await v.page.evaluate(() => window.__screens ?? [])
    check(
      'visitante vê a landing na primeira tela',
      LANDING.test(visitor[0] ?? ''),
      (visitor[0] ?? '').replace(/\s+/g, ' ').slice(0, 90),
    )
    await v.shot('02-visitante')

    // Sair de propósito volta a mandar para a landing sem splash nenhum.
    await s.openProfile()
    await page.getByRole('button', { name: /Sair da conta/ }).last().click()
    await page.waitForTimeout(1500)
    const afterLogout = await page.evaluate(() => localStorage.getItem('rise:auth'))
    check('sair da conta apaga o bilhete de sessão', afterLogout === '0', `rise:auth=${afterLogout}`)
  },
}
