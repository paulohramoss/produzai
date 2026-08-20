// Existe sessão guardada neste navegador? — resposta SÍNCRONA, no primeiro render.
//
// Não dá para perguntar isso ao Firebase: ele só confirma o usuário depois de
// ler o IndexedDB e, normalmente, de uma ida à rede. Até lá o App tem que
// escolher entre duas telas erradas — prender o VISITANTE num "Carregando..."
// ou jogar quem JÁ ESTÁ LOGADO na landing a cada F5, que é o mesmo que dizer
// "você saiu do app".
//
// A saída é um bilhete nosso, em localStorage (o único storage que se lê sem
// await), escrito pelo próprio listener de auth. Três estados:
//
//   '1'     → tinha sessão na última vez: mostre o splash e espere o Firebase
//   '0'     → saiu de propósito: mostre a landing na hora
//   ausente → nunca decidimos aqui; cai na heurística de rastros abaixo
//
// O bilhete é só um palpite sobre QUAL TELA mostrar primeiro. Quem autentica
// continua sendo o Firebase: token expirado ou sessão revogada derruba o
// palpite e a landing aparece — só um instante depois, em vez de antes.

const KEY = 'rise:auth'

/** Nomes dos stores persistidos (o `persist` grava como `<uid>:<nome>`). */
const STORE_KEYS = [
  'manual_workouts', 'webdiet_data', 'week_plan', 'coach_messages', 'habit_defs',
]

export function markSignedIn() {
  try { localStorage.setItem(KEY, '1') } catch { /* storage bloqueado */ }
}

export function markSignedOut() {
  try { localStorage.setItem(KEY, '0') } catch { /* storage bloqueado */ }
}

/**
 * Rastros de uso anterior, para quem já estava logado antes deste bilhete
 * existir: a chave antiga do Firebase (quando o IndexedDB não está disponível)
 * ou qualquer store persistido com prefixo de uid. Vale uma única vez — no
 * primeiro F5 o listener grava '1' ou '0' e a heurística sai de cena.
 */
function hasPreviousUse(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k) continue
      if (k.startsWith('firebase:authUser:')) return true
      if (STORE_KEYS.some(name => k.endsWith(`:${name}`))) return true
    }
  } catch {
    // Storage bloqueado (aba anônima, cookies negados): trate como visitante.
  }
  return false
}

export function hasStoredSession(): boolean {
  let flag: string | null = null
  try { flag = localStorage.getItem(KEY) } catch { return false }
  if (flag === '1') return true
  if (flag === '0') return false
  return hasPreviousUse()
}
