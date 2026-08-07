// Responsividade em tela de celular.
//
// Regressão que este cenário guarda: no iPhone o app aparecia com o dobro do
// tamanho. Causa — o Safari dá zoom automático ao focar um campo com fonte
// menor que 16px e NÃO desfaz o zoom depois; todos os campos usavam 11–15px.
// Junto vinham dois vizinhos: o input[type=date] estourava a coluna do grid
// (largura mínima intrínseca sem `min-width: 0`) e modais sem teto de altura
// deixavam o botão de confirmar fora da tela em aparelho baixo.

import { openSession, seededUser } from '../lib/app.mjs'

const PHONE = { width: 320, height: 568 }   // o menor aparelho em uso
const PHONE_TALL = { width: 390, height: 844 }

/** Elementos que passam da borda direita — o que gera rolagem lateral. */
const overflowProbe = () => {
  const vw = window.innerWidth
  const bad = []
  // Um pai que rola na horizontal (a faixa de dias da Agenda, por exemplo) é
  // escolha de design, não estouro de layout.
  const dentroDeScrollerH = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX
      if (ox === 'auto' || ox === 'scroll') return true
    }
    return false
  }
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    if (!r.width && !r.height) continue
    if (el.closest('aside')) continue                       // gaveta fica fora da tela de propósito
    if (getComputedStyle(el).position === 'fixed') continue
    if (dentroDeScrollerH(el)) continue
    if (r.right > vw + 1 && !bad.some(b => b.el.contains(el))) {
      bad.push({ el, txt: (el.textContent || '').trim().slice(0, 30) })
    }
  }
  return {
    scrollW: document.documentElement.scrollWidth,
    vw,
    bad: bad.slice(0, 3).map(({ el, ...o }) => o),
  }
}

/** Fonte efetiva de cada campo digitável — abaixo de 16px o iOS dá zoom. */
const fieldFontSizes = () =>
  [...document.querySelectorAll('input:not([type=range]):not([type=checkbox]):not([type=radio]), textarea, select')]
    .map(el => parseFloat(getComputedStyle(el).fontSize))

/** Painel de modal aberto: precisa caber inteiro na tela visível. */
const openModalBox = () => {
  const panel = document.querySelector('.rise-modal')
    || [...document.querySelectorAll('div')].find(d => {
      const p = d.parentElement
      return p && getComputedStyle(p).position === 'fixed' && +getComputedStyle(p).zIndex >= 100
    })
  if (!panel) return null
  const r = panel.getBoundingClientRect()
  return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: window.innerHeight }
}

const PAGES = ['Dashboard', 'Hoje', 'Histórico', 'Treino', 'Dieta', 'Agenda', 'Projetos', 'Mental', 'Biblioteca', 'Insights', 'Coach', 'Galeria']

export default {
  name: 'Responsividade no celular',

  async run({ browser, baseUrl, slug, track, check }) {
    // ── Onboarding: a tela onde o bug apareceu ──────────────────────────────
    const novo = seededUser({ email: `r${Date.now()}@qa.dev`, name: 'Paulo QA', profile: { onboardingDone: false } })

    for (const vp of [PHONE, PHONE_TALL]) {
      const s = track(await openSession(browser, { baseUrl, scenarioSlug: slug, viewport: vp, user: novo }))
      const { page } = s

      const paraChat = page.getByRole('button', { name: /Prefiro o modo rápido/ })
      if (await paraChat.count()) await paraChat.click()
      await page.getByText('Vamos configurar seu plano em 3 passos rápidos').waitFor({ timeout: 10_000 })

      await page.getByText('Ter mais energia').click()
      await page.getByRole('button', { name: /Continuar/ }).click()
      await page.waitForTimeout(400)

      // O passo 2 é o que tem peso, altura, nascimento e sexo lado a lado.
      const fontes = await page.evaluate(fieldFontSizes)
      check(
        `onboarding @${vp.width}px: campo nenhum abaixo de 16px (senão o iOS dá zoom)`,
        fontes.length > 0 && fontes.every(f => f >= 16),
        `${fontes.length} campo(s): ${[...new Set(fontes)].join(', ')}px`,
      )

      const ov = await page.evaluate(overflowProbe)
      check(
        `onboarding @${vp.width}px: sem rolagem lateral`,
        ov.scrollW <= ov.vw + 1 && ov.bad.length === 0,
        ov.bad.length ? JSON.stringify(ov.bad) : `${ov.scrollW}px`,
      )
    }

    // ── App logado: nenhuma página pode estourar a largura ──────────────────
    const s = track(await openSession(browser, { baseUrl, scenarioSlug: slug, viewport: PHONE, user: seededUser() }))
    const { page } = s

    const estouraram = []
    for (const nome of PAGES) {
      await page.getByRole('button', { name: 'Mais páginas' }).click()
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: nome, exact: true }).first().click()
      await page.waitForTimeout(800)
      const ov = await page.evaluate(overflowProbe)
      if (ov.scrollW > ov.vw + 1 || ov.bad.length) estouraram.push(`${nome}: ${JSON.stringify(ov.bad)}`)
    }
    check(
      `as ${PAGES.length} páginas cabem em ${PHONE.width}px de largura`,
      estouraram.length === 0,
      estouraram.join(' | '),
    )

    // ── Modal: com a tela baixa, o botão de confirmar continua alcançável ───
    await page.getByRole('button', { name: 'Mais páginas' }).click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: 'Treino', exact: true }).first().click()
    await page.waitForTimeout(900)
    await page.getByRole('button', { name: /Registrar/ }).first().click()
    await page.waitForTimeout(600)

    const box = await page.evaluate(openModalBox)
    check(
      `modal de treino cabe em ${PHONE.width}x${PHONE.height}`,
      box !== null && box.top >= -1 && box.bottom <= box.vh + 1,
      box ? `top=${box.top} bottom=${box.bottom} vh=${box.vh}` : 'painel não encontrado',
    )

    const fontesModal = await page.evaluate(fieldFontSizes)
    check(
      'campos do modal também ficam em 16px',
      fontesModal.length > 0 && fontesModal.every(f => f >= 16),
      `${fontesModal.length} campo(s)`,
    )

    await s.shot('01-modal-treino-320')
  },
}
