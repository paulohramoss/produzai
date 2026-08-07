// Vocabulário do app para os cenários: abrir sessão, navegar, tirar print.
//
// Um cenário não deveria saber o que é `localStorage` nem qual é a chave da
// sessão falsa. Ele diz "abra o app como uma atleta já cadastrada, na página
// Treino" e recebe uma página pronta.

import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ARTIFACTS = fileURLToPath(new URL('../artifacts', import.meta.url))

const AUTH_KEY = 'qa_auth_user'
const DB_KEY = 'qa_firestore'

/** Mesmo algoritmo de `uidFor` em qa/fakes/firebase-auth.ts. */
export function uidFor(email) {
  let h = 0
  for (const ch of email) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return 'qa' + h.toString(36).padStart(7, '0')
}

/** Hábitos padrão, para o checklist do Hoje não nascer vazio. */
const DEFAULT_HABITS = [
  { id: 'h1', icon: '💧', label: 'Água 3L', why: 'Hidratação.', createdAt: 1 },
  { id: 'h2', icon: '🏋', label: 'Treino diário', why: 'Base de tudo.', createdAt: 1 },
]

/**
 * Estado de um usuário já cadastrado e com onboarding concluído — o ponto de
 * partida da maioria dos cenários, que não devem gastar 20 cliques no wizard.
 */
export function seededUser({ email = 'atleta@qa.dev', name = 'Atleta QA', profile = {}, docs = {} } = {}) {
  const uid = uidFor(email)
  return {
    uid,
    email,
    name,
    auth: { uid, email, displayName: name, photoURL: null, providerData: [{ providerId: 'password' }] },
    db: {
      [`users/${uid}/data/profile`]: {
        onboardingDone: true,
        consentAt: 1_700_000_000_000,
        createdAt: 1_700_000_000_000,
        ...profile,
      },
      [`users/${uid}/data/habitDefs`]: { items: DEFAULT_HABITS },
      ...docs,
    },
  }
}

export class AppSession {
  constructor(ctx, page, user) {
    this.ctx = ctx
    this.page = page
    this.user = user
    this.errors = []
  }

  /** Erros de runtime que não são ruído de rede/PWA. */
  get runtimeErrors() {
    return this.errors.filter(e => !/favicon|manifest|sw\.js|Failed to load resource|net::ERR/i.test(e))
  }

  async goto(path = '/') {
    await this.page.goto(this.baseUrl + path, { waitUntil: 'networkidle' })
    await this.page.waitForTimeout(600)
  }

  /** Clica um item do menu lateral e espera a página assentar. */
  async open(pageName) {
    await this.page.getByRole('button', { name: pageName, exact: true }).first().click()
    await this.page.waitForTimeout(1200)
  }

  async openProfile() {
    await this.page.getByRole('button', { name: 'Ir para perfil' }).first().click()
    await this.page.waitForTimeout(1200)
  }

  /** Estado atual do "servidor" — para conferir o que o app realmente gravou. */
  async db() {
    return JSON.parse(await this.page.evaluate(() => JSON.stringify(window.__qaDb.dump())))
  }

  async shot(name) {
    const dir = `${ARTIFACTS}/${this.scenarioSlug}`
    mkdirSync(dir, { recursive: true })
    const file = `${dir}/${name}.png`
    await this.page.screenshot({ path: file, fullPage: true })
    return file
  }
}

/**
 * Abre uma sessão isolada do app. `user: null` cai na tela de login (para
 * cenários de cadastro); com usuário, entra direto logado.
 */
export async function openSession(browser, { baseUrl, scenarioSlug, user = seededUser(), viewport } = {}) {
  const ctx = await browser.newContext({ viewport: viewport ?? { width: 1400, height: 1000 } })

  if (user) {
    await ctx.addInitScript(({ authKey, dbKey, auth, db }) => {
      localStorage.setItem(authKey, JSON.stringify(auth))
      // Não sobrescreve o que o próprio app já gravou nesta sessão: o
      // addInitScript roda a cada navegação, inclusive nos reloads do teste.
      if (!localStorage.getItem(dbKey)) localStorage.setItem(dbKey, JSON.stringify(db))
    }, { authKey: AUTH_KEY, dbKey: DB_KEY, auth: user.auth, db: user.db })
  }

  const page = await ctx.newPage()
  const session = new AppSession(ctx, page, user)
  session.baseUrl = baseUrl
  session.scenarioSlug = scenarioSlug

  page.on('pageerror', e => session.errors.push(`pageerror: ${e.message}`))
  page.on('console', m => { if (m.type() === 'error') session.errors.push(`console: ${m.text()}`) })

  await session.goto('/')
  return session
}

/**
 * Abre uma sessão SEM login, opcionalmente enxergando o mesmo "banco" de outra
 * sessão — é assim que se testa uma página pública (link do treinador) sem
 * herdar a autenticação de quem publicou.
 */
export async function openAnonymousSession(browser, { baseUrl, scenarioSlug, db = {}, viewport } = {}) {
  const ctx = await browser.newContext({ viewport: viewport ?? { width: 1200, height: 1000 } })
  await ctx.addInitScript(({ dbKey, dump }) => {
    localStorage.setItem(dbKey, dump)
  }, { dbKey: DB_KEY, dump: JSON.stringify(db) })

  const page = await ctx.newPage()
  const session = new AppSession(ctx, page, null)
  session.baseUrl = baseUrl
  session.scenarioSlug = scenarioSlug
  page.on('pageerror', e => session.errors.push(`pageerror: ${e.message}`))
  page.on('console', m => { if (m.type() === 'error') session.errors.push(`console: ${m.text()}`) })
  return session
}

/** Cadastro pela interface de verdade — usado pelo cenário de autenticação. */
export async function signUpThroughUi(page, { name, email, password = 'senha123' }) {
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
  await page.getByPlaceholder('Seu nome').fill(name)
  await page.getByPlaceholder('seu@email.com').fill(email)
  await page.getByPlaceholder('Mínimo 6 caracteres').fill(password)
  await page.locator('input[type=checkbox]').check()
  await page.getByRole('button', { name: /Criar conta/ }).last().click()
}
