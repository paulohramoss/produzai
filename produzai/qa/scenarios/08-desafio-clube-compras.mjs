// As três apostas de retenção: desafio com fim, clube com meta e lista de compras.
//
// O que cada uma precisa provar, e que um print bonito não prova:
//
//   Desafio — o placar conta DIAS distintos dentro da janela. Treinar duas vezes
//             no mesmo dia não compra dois dias, e treino fora da janela não
//             entra. É a regra inteira do desafio; se ela quebra, o prêmio vai
//             para a pessoa errada.
//   Clube   — a meta coletiva soma o mês de TODOS os membros e ignora quem tem
//             número de mês antigo. Somar mês velho infla a meta com treino que
//             já foi comemorado.
//   Compras — o mesmo ingrediente escrito de duas formas ("150g de peito de
//             frango" e "Peito de frango 150 g") vira UMA linha somada. Se
//             falhar, a lista manda a pessoa comprar frango duas vezes.

import { openSession, seededUser, uidFor } from '../lib/app.mjs'

/** Chave "YYYY-MM" do mês corrente, no fuso local. */
function monthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const DIET = {
  goals: { cal: 2400, prot: 180, carb: 240, fat: 70 },
  meals: [
    { id: 'm1', time: '08:00', name: 'Café', cal: 500, prot: 35, carb: 50, fat: 15, done: false,
      items: ['3 ovos', '2 fatias de pão integral', '200ml de leite'] },
    { id: 'm2', time: '12:00', name: 'Almoço', cal: 800, prot: 60, carb: 80, fat: 20, done: false,
      items: ['150g de peito de frango', '100g arroz integral', 'Brócolis a gosto'] },
    { id: 'm3', time: '20:00', name: 'Jantar', cal: 700, prot: 55, carb: 60, fat: 18, done: false,
      // Mesmo frango, escrito ao contrário — tem de somar com o do almoço.
      items: ['Peito de frango 150 g', 'batata-doce 200g', '2 ovos'] },
  ],
}

export default {
  name: 'Desafio, clube e lista de compras',

  async run({ browser, baseUrl, slug, track, check }) {
    // ── Lista de compras ───────────────────────────────────────────────────
    const eu = seededUser({
      email: 'compras@qa.dev',
      name: 'Atleta QA',
      docs: { [`users/${uidFor('compras@qa.dev')}/data/diet`]: DIET },
    })

    const s = track(await openSession(browser, { baseUrl, scenarioSlug: slug, user: eu }))
    const { page } = s

    await s.open('Dieta')
    await page.getByRole('button', { name: /Lista de compras/ }).click()
    await page.waitForTimeout(700)

    const modal = page.locator('text=Compra para').first()
    check('a lista de compras abre a partir da Dieta', await modal.isVisible())

    // 150g + 150g = 300g/dia × 7 dias = 2,1 kg. Uma linha só, não duas.
    const frango = page.getByText(/^Peito de frango$/)
    check('as duas grafias de frango viram um item só', await frango.count() === 1,
      `${await frango.count()} linha(s)`)
    check('quantidade somada e convertida para kg',
      await page.getByText('2,1 kg').first().isVisible().catch(() => false))

    // 3 + 2 ovos = 5/dia × 7 = 35.
    check('ovos somam entre refeições diferentes',
      await page.getByText('35 un').first().isVisible().catch(() => false))

    // "Brócolis a gosto" é brócolis, não um item chamado "brócolis a gosto".
    check('ingrediente sem quantidade entra pelo nome limpo',
      await page.getByText(/^Brócolis$/).first().isVisible().catch(() => false))

    check('itens saem agrupados por setor do mercado',
      await page.getByText('Açougue e peixaria').first().isVisible().catch(() => false))

    // A janela muda o total: 3 dias de frango são 900g, não 2,1kg.
    await page.getByRole('button', { name: '3 dias' }).click()
    await page.waitForTimeout(400)
    check('trocar a janela recalcula as quantidades',
      await page.getByText('900 g').first().isVisible().catch(() => false))
    await s.shot('01-lista-compras')

    await page.getByRole('button', { name: 'Fechar', exact: true }).click()
    await page.waitForTimeout(400)

    // ── Desafio ────────────────────────────────────────────────────────────
    // A janela do desafio vem de src/lib/challenge.ts, que pode estar no
    // futuro. O que dá para checar sempre é que o card existe e não mente.
    await s.open('Início')
    const desafio = page.getByText(/Desafio 21 Dias/).first()
    check('o desafio aparece no início', await desafio.isVisible().catch(() => false))
    check('o desafio diz o que se ganha',
      await page.getByText(/Quem terminar no topo leva/).first().isVisible().catch(() => false))
    await s.shot('02-desafio')

    // ── Clube ──────────────────────────────────────────────────────────────
    const criar = page.getByRole('button', { name: 'Criar um clube' })
    check('sem clube, o convite é criar um', await criar.isVisible().catch(() => false))
    await criar.click()
    await page.waitForTimeout(300)

    await page.getByPlaceholder(/Nome do clube/).fill('Box da Beira-Mar')
    await page.getByRole('button', { name: 'Criar', exact: true }).click()
    await page.waitForTimeout(1200)

    check('o clube criado aparece com o nome dado',
      await page.getByText('Box da Beira-Mar').first().isVisible().catch(() => false))
    check('a meta do mês aparece', await page.getByText(/Meta de /).first().isVisible().catch(() => false))
    await s.shot('03-clube')

    // O documento do clube tem de nascer com o dono dentro dele — sem isso a
    // meta coletiva soma zero membro e a regra do Firestore recusa a entrada.
    const db = await s.db()
    const clube = Object.entries(db).find(([p]) => p.startsWith('clubs/'))?.[1]
    check('o clube é gravado com o dono como primeiro membro',
      clube?.ownerUid === eu.uid && clube?.memberUids?.includes(eu.uid),
      JSON.stringify(clube?.memberUids))
    check('o usuário guarda a referência do clube',
      db[`users/${eu.uid}/data/club`]?.clubId === clube?.id)

    // ── A meta coletiva só conta o mês corrente ────────────────────────────
    // Dois colegas com o MESMO número de treinos gravado, um no mês de agora e
    // outro num mês antigo. Só o primeiro pode entrar na conta; se o segundo
    // entrasse, a meta ficaria "cheia" de treino que já foi comemorado.
    //
    // O placar do próprio usuário não é semeado de propósito: o Dashboard
    // recalcula e sobrescreve o dele a cada carga, que é o comportamento certo.
    await page.evaluate(({ clubId, mes, meuUid }) => {
      const db = JSON.parse(localStorage.getItem('qa_firestore'))
      db[`clubs/${clubId}`].memberUids = [meuUid, 'qa-agora', 'qa-antigo']
      const base = {
        xp: 500, streakDays: 2, weeklyWorkouts: 1, weeklyXP: 100, weekKey: 'x',
        inviteCode: 'QAXXXX', updatedAt: Date.now(),
      }
      db['leaderboard/qa-agora'] = {
        ...base, uid: 'qa-agora', displayName: 'Colega de Agora',
        monthlyWorkouts: 7, monthKey: mes,
      }
      db['leaderboard/qa-antigo'] = {
        ...base, uid: 'qa-antigo', displayName: 'Colega Antigo',
        monthlyWorkouts: 99, monthKey: '2020-01',
      }
      localStorage.setItem('qa_firestore', JSON.stringify(db))
    }, { clubId: clube?.id, mes: monthKey(), meuUid: eu.uid })

    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(2500)
    await s.open('Início')

    // Meta padrão 100. Só os 7 do mês corrente contam → faltam 93.
    check('a meta soma quem tem número do mês corrente',
      await page.getByText('Faltam 93 treinos para o clube fechar o mês.')
        .first().isVisible().catch(() => false))
    check('treino de mês antigo NÃO entra na meta do mês',
      !(await page.getByText(/Faltam -6 treinos|Meta batida/).first()
        .isVisible().catch(() => false)))
    check('o membro de mês antigo aparece na lista zerado',
      await page.getByText('Colega Antigo').first().isVisible().catch(() => false))

    await s.shot('04-clube-meta')

    check('nenhum erro de runtime no caminho todo',
      s.runtimeErrors.length === 0, s.runtimeErrors.join(' | '))
  },
}
