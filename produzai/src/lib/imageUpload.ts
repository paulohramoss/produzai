// Preparo e diagnóstico dos envios de imagem para o Firebase Storage.
//
// Os dois problemas que este arquivo existe para resolver:
//
//  1. FOTO DE CELULAR NÃO CABE. Um retrato de iPhone sai com 3–8 MB; o avatar
//     era recusado acima de 5 MB e a galeria acima de 10 MB. Ou seja: o caminho
//     mais comum do app — tirar foto e mandar — batia num "imagem muito grande"
//     que o usuário não tem como resolver. Reduzir antes de enviar tira essa
//     classe de erro do mapa e ainda economiza dados móveis: 512px de avatar
//     saem em dezenas de KB, não em megabytes.
//
//  2. O ERRO NÃO DIZIA NADA. A tela mostrava "Erro ao enviar foto. Verifique o
//     Firebase Storage." e o motivo real ficava só no console. Cada código do
//     Storage tem uma causa e uma ação diferentes — regra negada, CORS do
//     bucket, bucket errado, cota — e tratá-los como um erro só transforma
//     conserto de cinco minutos em caça ao tesouro.

/** Lado maior do avatar, em pixels. Acima disso é detalhe que a tela descarta. */
export const AVATAR_MAX_PX = 512

/** Foto de progresso guarda mais detalhe: é usada para comparar evolução. */
export const PROGRESS_MAX_PX = 1600

/**
 * Teto do arquivo ORIGINAL, antes de reduzir.
 *
 * Não é o teto do envio (esse é o resultado da redução) — é só o limite do que
 * vale a pena decodificar na memória do aparelho. 30 MB cobre foto de qualquer
 * celular atual com folga.
 */
export const MAX_SOURCE_BYTES = 30 * 1024 * 1024

/**
 * Reduz a imagem para caber em `maxPx` no lado maior.
 *
 * Devolve o arquivo ORIGINAL sem alarde quando não dá para decodificar (HEIC do
 * iPhone em navegador que não abre HEIC, SVG, formato exótico) ou quando a
 * imagem já é menor que o alvo. Falhar aqui não pode impedir o envio — o pior
 * caso é mandar o arquivo como veio, que é exatamente o que acontecia antes.
 */
export async function shrinkImage(file: File, maxPx: number): Promise<Blob> {
  // `imageOrientation: 'from-image'` aplica o EXIF na hora de desenhar. Sem
  // isso, retrato de celular chega deitado — o canvas ignora a rotação que o
  // visualizador do sistema aplica sozinho.
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file
  }

  try {
    const { width, height } = bitmap
    const scale = Math.min(1, maxPx / Math.max(width, height))
    if (scale === 1) return file

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)

    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    )

    // Se a "redução" saiu maior que o original (acontece com PNG pequeno já
    // otimizado), fica com o original.
    return blob && blob.size < file.size ? blob : file
  } finally {
    bitmap.close()
  }
}

/**
 * O que dizer ao usuário — e o que a mensagem manda VOCÊ conferir.
 *
 * Os códigos vêm do SDK do Storage. Os dois primeiros são os que aparecem
 * quando o CORS do bucket não conhece a origem do site: o navegador barra a
 * resposta, o SDK não vê status nenhum e desiste por tentativa esgotada.
 */
export function storageErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''

  switch (code) {
    case 'storage/unauthorized':
      return 'Envio bloqueado pelas regras do Storage. As regras publicadas não batem com storage.rules.'
    case 'storage/unauthenticated':
      return 'Sua sessão expirou. Entre de novo e tente outra vez.'
    case 'storage/retry-limit-exceeded':
    case 'storage/unknown':
      return 'Não foi possível falar com o Storage. Costuma ser o CORS do bucket sem a origem deste site.'
    case 'storage/bucket-not-found':
    case 'storage/project-not-found':
      return 'Bucket do Storage não encontrado. Confira VITE_FIREBASE_STORAGE_BUCKET.'
    case 'storage/quota-exceeded':
      return 'A cota do Storage acabou. Confira o plano do projeto no Firebase.'
    case 'storage/canceled':
      return 'Envio cancelado.'
    default:
      return 'Erro ao enviar a imagem. Tente de novo em instantes.'
  }
}

/**
 * Registra no console o suficiente para o erro ser resolvido de primeira.
 *
 * Bucket em uso, tamanho antes e depois, tipo e código — é a diferença entre
 * "deu erro no storage" e saber qual das cinco causas foi.
 */
export function logStorageFailure(
  context: string,
  err: unknown,
  info: { path: string; bucket?: string; sourceBytes?: number; sentBytes?: number; type?: string },
) {
  const code = (err as { code?: string })?.code ?? '(sem código)'
  console.error(
    `[storage] ${context} falhou — ${code}\n` +
    `  caminho: ${info.path}\n` +
    `  bucket:  ${info.bucket ?? '(desconhecido)'}\n` +
    `  origem:  ${window.location.origin}\n` +
    `  arquivo: ${info.type ?? '?'} · ${fmtBytes(info.sourceBytes)} → ${fmtBytes(info.sentBytes)}`,
    err,
  )
}

function fmtBytes(n?: number): string {
  if (n === undefined) return '?'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
