// Manter o cliente na versão mais recente — sem atropelar quem está usando.
//
// O problema não é o cache do navegador: é o Service Worker. Ele guarda um
// precache das telas e responde TODA navegação a partir dele
// (`NavigationRoute` + `createHandlerBoundToURL('index.html')`). Enquanto um SW
// antigo controla a aba, `location.reload()` devolve o app antigo de novo — o
// pedido nem chega à rede. Limpar o cache na mão, no navegador, era a única
// saída. Este módulo automatiza a saída certa.
//
// São três perguntas separadas, e é por isso que o arquivo existe:
//
//   1. SAIU VERSÃO NOVA?  O SW só checa no load da página. Um PWA aberto o dia
//      todo nunca pergunta. Aqui perguntamos por intervalo, ao voltar para a
//      aba e ao reconectar. O /version.json (que nunca é cacheado) é o
//      desempate: ele vem da rede mesmo quando o SW está servindo tela velha.
//
//   2. JÁ PODE TROCAR?  Recarregar no meio de uma série registrada apaga o que
//      a pessoa digitou e não salvou. Então só trocamos quando é seguro: aba em
//      segundo plano, ou aba visível mas sem nada em edição e sem toque há um
//      minuto. Se estiver no meio de algo, a troca fica pendente e acontece na
//      próxima vez que a pessoa sair da aba ou parar de mexer.
//
//   3. COMO TROCAR?  Caminho normal: manda 'SKIP_WAITING' para o SW que está
//      esperando, ele assume, recarregamos. Caminho de escape: se o
//      /version.json insiste que estamos velhos e nenhum SW novo apareceu,
//      apagamos os caches e desregistramos o SW antes de recarregar — é o
//      equivalente programático a limpar o cache do navegador.

import { toast } from './toast'

/** Id do commit que gerou este bundle. Injetado pelo vite.config. */
declare const __BUILD_ID__: string

export const BUILD_ID = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'

/** De quanto em quanto tempo perguntar se saiu versão nova. */
const CHECK_EVERY_MS = 15 * 60 * 1000

/** Silêncio necessário para trocar de versão com a aba na cara da pessoa. */
const IDLE_BEFORE_RELOAD_MS = 60 * 1000

/** Teto de recargas por sessão: um loop de reload é pior que uma versão velha. */
const MAX_RELOADS = 3
const RELOADS_KEY = 'rise:updateReloads'

let pending = false          // já sabemos que existe versão nova
let applying = false         // troca em andamento, não fazer duas
let holds = 0                // trechos do app que pediram para não recarregar agora
let lastInteraction = Date.now()
let registration: ServiceWorkerRegistration | null = null

/**
 * "Não recarregue agora" — para telas com trabalho em andamento que o app ainda
 * não gravou. Devolve a função que solta a trava; chame no cleanup do efeito.
 *
 *     useEffect(() => holdAppUpdate(), [])
 */
export function holdAppUpdate(): () => void {
  holds++
  let released = false
  return () => {
    if (released) return
    released = true
    holds--
    // Soltou a última trava e havia troca esperando: tenta agora.
    if (holds === 0 && pending) applyWhenSafe()
  }
}

/** Há campo de texto em foco com conteúdo? Então tem gente digitando. */
function isTyping(): boolean {
  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  if (el.isContentEditable) return true
  const tag = el.tagName
  if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return false
  return (el as HTMLInputElement).value?.length > 0
}

function isSafeToReload(): boolean {
  if (holds > 0) return false
  // Aba em segundo plano: nada na tela para atropelar.
  if (document.visibilityState === 'hidden') return true
  if (isTyping()) return false
  return Date.now() - lastInteraction >= IDLE_BEFORE_RELOAD_MS
}

/** Quantas vezes já recarregamos por atualização nesta sessão. */
function reloadCount(): number {
  try { return Number(sessionStorage.getItem(RELOADS_KEY) ?? 0) } catch { return 0 }
}

function countReload() {
  try { sessionStorage.setItem(RELOADS_KEY, String(reloadCount() + 1)) } catch { /* ignore */ }
}

/**
 * Apaga tudo o que o navegador guardou desta origem e sai do controle do SW.
 *
 * Só para o caminho de escape: o app se sabe velho, mas nenhum SW novo apareceu
 * para assumir. Sem desregistrar, o SW antigo continuaria respondendo a
 * navegação com a tela antiga e o reload não sairia do lugar.
 */
async function hardReset() {
  try {
    const names = await caches.keys()
    await Promise.all(names.map(n => caches.delete(n)))
  } catch (e) {
    console.warn('[update] não foi possível limpar os caches', e)
  }
  try {
    await registration?.unregister()
  } catch (e) {
    console.warn('[update] não foi possível desregistrar o SW', e)
  }
}

/** Recarrega buscando da rede, contando a recarga contra o teto. */
function reload() {
  countReload()
  window.location.reload()
}

/**
 * Espera o SW novo terminar de instalar e ficar em `waiting`.
 *
 * Quem quase sempre percebe a versão nova primeiro é o /version.json — ele é um
 * arquivo minúsculo, enquanto o SW ainda está baixando o precache inteiro. Sem
 * esta espera, o caminho de escape (que apaga TODOS os caches e desregistra o
 * SW) dispararia em toda atualização normal, torrando o cache de fontes e o
 * modo offline por nada.
 */
function waitForWaitingWorker(reg: ServiceWorkerRegistration, timeoutMs: number) {
  return new Promise<ServiceWorker | null>(resolve => {
    if (reg.waiting) return resolve(reg.waiting)
    const timer = setTimeout(() => { clearInterval(poll); resolve(null) }, timeoutMs)
    const poll = setInterval(() => {
      if (!reg.waiting) return
      clearInterval(poll)
      clearTimeout(timer)
      resolve(reg.waiting)
    }, 250)
  })
}

/**
 * Aplica a versão nova, se der. Se não der, apenas registra a intenção — os
 * gatilhos de `armRetry` chamam isto de novo quando a situação mudar.
 */
async function applyWhenSafe() {
  if (applying || !pending) return
  if (reloadCount() >= MAX_RELOADS) return
  if (!isSafeToReload()) return

  applying = true

  if (registration) {
    // Caminho normal. Se o SW novo ainda não está pronto, damos um empurrão e
    // esperamos por ele — vale muito mais a pena que o caminho de escape.
    if (!registration.waiting) await registration.update().catch(() => {})
    const waiting = await waitForWaitingWorker(registration, 15_000)
    if (waiting) {
      // Ao assumir o controle, o navegador dispara 'controllerchange' — só
      // então a próxima navegação vem do precache novo.
      navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true })
      waiting.postMessage({ type: 'SKIP_WAITING' })
      // Um SW que não responde não pode prender o app na versão velha.
      setTimeout(() => { if (applying) reload() }, 5000)
      return
    }
  }

  // Último recurso: o servidor diz que estamos velhos e nenhum SW novo
  // apareceu para assumir. Sem apagar o cache e desregistrar, o SW antigo
  // continuaria respondendo a navegação com a tela antiga e o reload não sairia
  // do lugar — é exatamente o "limpar o cache do navegador" na mão.
  console.warn('[update] nenhum SW novo assumiu; limpando cache e desregistrando')
  await hardReset()
  reload()
}

/** Gatilhos que podem tornar seguro o que agora não é. */
function armRetry() {
  const retry = () => { if (pending) applyWhenSafe() }
  document.addEventListener('visibilitychange', retry)
  window.setInterval(retry, 20_000)
}

/** Marca a versão nova como disponível e tenta aplicar. */
function markPending(reason: string) {
  if (pending) return
  pending = true
  console.info(`[update] versão nova disponível (${reason}); build atual ${BUILD_ID}`)
  applyWhenSafe()
}

/**
 * O /version.json vem sempre da rede. É o que enxerga uma versão nova mesmo
 * quando o SW antigo está servindo a tela antiga — o caso em que o app não tem
 * como se descobrir velho por conta própria.
 */
async function checkVersionEndpoint() {
  if (pending) return
  try {
    const res = await fetch('/version.json', { cache: 'no-store' })
    if (!res.ok) return
    const { buildId } = await res.json() as { buildId?: string }
    if (buildId && BUILD_ID !== 'dev' && buildId !== BUILD_ID) {
      markPending(`servidor em ${buildId}`)
    }
  } catch {
    // Offline: nada a fazer, e não é erro. Tentamos de novo no próximo gatilho.
  }
}

/** Pede ao navegador para reconferir o sw.js no servidor. */
async function checkServiceWorker() {
  try { await registration?.update() } catch { /* offline */ }
}

async function check() {
  await checkServiceWorker()
  await checkVersionEndpoint()
}

/**
 * Liga o vigia. Chamado uma vez, no boot.
 *
 * Registrar o SW é responsabilidade nossa (o vite.config desliga o script que o
 * plugin injetaria) justamente para termos a `registration` em mãos — sem ela
 * não há como perguntar por atualização nem mandar 'SKIP_WAITING'.
 */
export function watchForUpdates() {
  const track = () => { lastInteraction = Date.now() }
  addEventListener('pointerdown', track, { passive: true })
  addEventListener('keydown', track, { passive: true })

  armRetry()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
  addEventListener('online', check)
  setInterval(check, CHECK_EVERY_MS)

  if (!('serviceWorker' in navigator)) {
    // Sem SW não há precache para ficar velho, mas o bundle em memória fica.
    // O termômetro do /version.json continua valendo.
    checkVersionEndpoint()
    return
  }

  navigator.serviceWorker.register('/sw.js', { scope: '/' })
    .then(reg => {
      registration = reg
      // Um SW novo já esperando (baixado numa visita anterior que não trocou).
      if (reg.waiting) markPending('SW esperando desde a visita anterior')
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing
        if (!sw) return
        sw.addEventListener('statechange', () => {
          // 'installed' com controller presente = é atualização, não instalação
          // primeira. Sem essa checagem, a primeira visita se "atualizaria".
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            markPending('SW novo instalado')
          }
        })
      })
      checkVersionEndpoint()
    })
    .catch(e => {
      console.warn('[update] SW não registrou; seguindo só com /version.json', e)
      checkVersionEndpoint()
    })
}

/** Força a checagem e a troca agora, ignorando o "é seguro?". Para um botão. */
export async function updateNow() {
  await check()
  if (!pending) {
    toast.info('Você já está na versão mais recente.')
    return
  }
  holds = 0
  lastInteraction = 0
  await applyWhenSafe()
}
