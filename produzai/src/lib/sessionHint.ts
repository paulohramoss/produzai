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
  const flag = sessionFlag()
  if (flag === '1') return true
  if (flag === '0') return false
  return hasPreviousUse()
}

/** O bilhete cru: '1', '0' ou null quando nunca foi escrito. */
export function sessionFlag(): string | null {
  // Storage bloqueado responde igual a "sem bilhete" — e o `hasStoredSession`
  // logo abaixo cai na heurística de rastros, que trata o erro por conta.
  try { return localStorage.getItem(KEY) } catch { return null }
}

/**
 * A última rede de segurança, para quem tem sessão no Firebase e NENHUM rastro
 * que a leitura síncrona alcance.
 *
 * O Firebase guarda a sessão num banco IndexedDB de nome fixo. Perguntar se
 * esse banco existe é bem mais barato do que carregar o SDK para perguntar a
 * ele: não abre o banco, não lê registro, e não traz 154 KB de JavaScript para
 * dentro da landing. Só serve para decidir se VALE carregar o SDK.
 *
 * Assíncrono de propósito — roda depois da primeira pintura, nunca antes dela.
 * E só faz sentido quando o bilhete está AUSENTE: o banco continua existindo
 * depois do logout, então usá-lo para quem saiu de propósito ('0') mandaria a
 * pessoa de volta para dentro do app.
 *
 * `indexedDB.databases()` não existe em todo navegador; onde falta, o palpite
 * síncrono decide sozinho e o custo é um clique em "Entrar".
 */
export async function probeFirebaseSession(): Promise<boolean> {
  try {
    if (typeof indexedDB === 'undefined' || !('databases' in indexedDB)) return false
    const dbs = await indexedDB.databases()
    return dbs.some(d => d.name === 'firebaseLocalStorageDb')
  } catch {
    return false
  }
}
