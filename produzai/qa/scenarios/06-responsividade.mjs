// Responsividade em tela de celular.
//
// Regressão que este cenário guarda: no iPhone o app aparecia com o dobro do
// tamanho. Causa — o Safari dá zoom automático ao focar um campo com fonte
// menor que 16px e NÃO desfaz o zoom depois; todos os campos usavam 11–15px.
// Junto vinham dois vizinhos: o input[type=date] estourava a coluna do grid
// (largura mínima intrínseca sem `min-width: 0`) e modais sem teto de altura
// deixavam o botão de confirmar fora da tela em aparelho baixo.

import { openSession, seededUser, uidFor } from '../lib/app.mjs'

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

/**
 * Campos que cabem na caixa mas não no texto: rótulo quebrado em duas linhas ou
 * placeholder cortado. Nada disso estoura a largura da página, então passa
 * batido por `overflowProbe` — foi assim que "DISTÂNCIA (KM)" em duas linhas e
 * "ex: 5.2" virando "ex:" ficaram no ar por meses num aparelho de 320px.
 */
const fieldTextFits = () => {
  const ruler = document.createElement('canvas').getContext('2d')
  const ruim = []

  const larguraDoTexto = (texto, cs) => {
    ruler.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    const espaco = parseFloat(cs.letterSpacing)
    return ruler.measureText(texto).width + (Number.isNaN(espaco) ? 0 : espaco * texto.length)
  }

  // O <label> pode envolver o campo; nesse caso o texto está num filho.
  const rotuloDe = (el) => {
    const host = (el.id && document.querySelector(`label[for="${el.id}"]`))
      || el.closest('label')
      || (el.previousElementSibling?.tagName === 'LABEL' ? el.previousElementSibling : null)
    if (!host) return null
    if (!host.contains(el)) return host
    return [...host.children].find(c => !c.contains(el) && c.textContent.trim()) ?? null
  }

  const campos = [...document.querySelectorAll(
    'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]), select',
  )].filter(el => el.getBoundingClientRect().width > 0)

  for (const el of campos) {
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()

    const rot = rotuloDe(el)
    if (rot) {
      const rcs = getComputedStyle(rot)
      const alturaLinha = parseFloat(rcs.lineHeight) || parseFloat(rcs.fontSize) * 1.2
      const linhas = Math.round(rot.getBoundingClientRect().height / alturaLinha)
      if (linhas > 1) ruim.push(`rótulo "${rot.textContent.trim()}" em ${linhas} linhas`)
    }

    // Chrome reserva espaço interno para os spinners de input[type=number].
    const util = r.width
      - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0)
      - (parseFloat(cs.borderLeftWidth) || 0) - (parseFloat(cs.borderRightWidth) || 0)
      - (el.type === 'number' ? 16 : 0)

    if (el.placeholder && larguraDoTexto(el.placeholder, cs) > util) {
      ruim.push(`placeholder "${el.placeholder}" cortado (cabe ${Math.round(util)}px)`)
    }
  }
  return ruim
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

    // Cardio mostra "Distância (km)" ao lado de "Duração"; o bloco de detalhes
    // traz "FC média (bpm)" ao lado de "Data". São os dois pares que já
    // apertaram rótulo e placeholder num aparelho de 320px.
    const textoModal = await page.evaluate(fieldTextFits)
    check(
      `modal de treino @${PHONE.width}px: rótulo em uma linha e placeholder inteiro`,
      textoModal.length === 0,
      textoModal.join(' | '),
    )

    await page.getByRole('button', { name: /Nome, data, esforço e FC/ }).click()
    await page.waitForTimeout(400)
    const textoDetalhes = await page.evaluate(fieldTextFits)
    check(
      `detalhes do treino @${PHONE.width}px: rótulo em uma linha e placeholder inteiro`,
      textoDetalhes.length === 0,
      textoDetalhes.join(' | '),
    )

    await s.shot('01-modal-treino-320')

    // ── Dieta: quatro colunas de macro no mesmo aparelho estreito ───────────
    // O modal só monta quando já existe plano (`editOpen && wd`), então a dieta
    // vem semeada — sem isso o check passaria sem nunca ter aberto o modal.
    const comDieta = seededUser({
      email: 'dieta@qa.dev',
      docs: {
        [`users/${uidFor('dieta@qa.dev')}/data/diet`]: {
          goals: { cal: 2400, prot: 180, carb: 240, fat: 70 },
          meals: [{ id: 'm1', time: '07:00', name: 'Café da manhã', cal: 500, prot: 30, carb: 60, fat: 15, done: false, items: ['Ovos'] }],
        },
      },
    })
    const sd = track(await openSession(browser, { baseUrl, scenarioSlug: slug, viewport: PHONE, user: comDieta }))

    await sd.page.getByRole('button', { name: 'Mais páginas' }).click()
    await sd.page.waitForTimeout(300)
    await sd.page.getByRole('button', { name: 'Dieta', exact: true }).first().click()
    await sd.page.waitForTimeout(900)
    await sd.page.getByRole('button', { name: /Editar plano/ }).first().click()
    await sd.page.waitForTimeout(700)

    const camposDieta = await sd.page.evaluate(
      () => document.querySelectorAll('.rise-overlay input, .rise-modal input').length,
    )
    const textoDieta = await sd.page.evaluate(fieldTextFits)
    check(
      `modal de dieta @${PHONE.width}px: rótulo em uma linha e placeholder inteiro`,
      camposDieta > 0 && textoDieta.length === 0,
      camposDieta === 0 ? 'modal não abriu — check inválido' : textoDieta.join(' | '),
    )

    // O painel da Dieta não usa `.rise-modal`, então não herda o teto de altura
    // que mantém o botão de salvar alcançável — vale medir.
    const caixaDieta = await sd.page.evaluate(openModalBox)
    check(
      `modal de dieta cabe em ${PHONE.width}x${PHONE.height}`,
      caixaDieta !== null && caixaDieta.top >= -1 && caixaDieta.bottom <= caixaDieta.vh + 1,
      caixaDieta ? `top=${caixaDieta.top} bottom=${caixaDieta.bottom} vh=${caixaDieta.vh}` : 'painel não encontrado',
    )

    await sd.shot('02-modal-dieta-320')
  },
}
