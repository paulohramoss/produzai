// De onde o atleta veio — capturado ANTES do login.
//
// A atribuição precisa sobreviver ao caminho inteiro: a pessoa clica no link do
// Instagram, lê a landing, fecha o app, volta no dia seguinte e só então cria a
// conta. Por isso o dado é gravado em localStorage global (não no userStorage,
// que só existe depois que há uid) e só é copiado para o perfil no cadastro.
//
// Regra do primeiro toque: quem trouxe a pessoa foi o primeiro link, não o
// último. Uma visita posterior sem parâmetro nenhum não apaga a origem, e uma
// visita com parâmetro novo não sobrescreve a original.

const KEY = 'rise_attribution'

export interface Attribution {
  /** utm_source — "instagram", "box-fulano", "whatsapp". */
  source?: string
  /** utm_medium — "bio", "story", "panfleto". */
  medium?: string
  /** utm_campaign — "desafio21", "lancamento". */
  campaign?: string
  /** Código de convite de quem indicou (?ref=ABC123). */
  ref?: string
  /** Primeira visita, Unix ms. */
  landedAt: number
  /** Página de destino da primeira visita. */
  landingPath?: string
}

function read(): Attribution | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Attribution) : null
  } catch {
    return null
  }
}

/**
 * Lê os parâmetros da URL e grava a origem se ainda não houver uma.
 * Idempotente: chamar em todo carregamento é seguro.
 */
export function captureAttribution(search = window.location.search): Attribution | null {
  const existing = read()
  if (existing) return existing

  const p = new URLSearchParams(search)
  const source   = p.get('utm_source')   ?? undefined
  const medium   = p.get('utm_medium')   ?? undefined
  const campaign = p.get('utm_campaign') ?? undefined
  const ref      = p.get('ref')?.trim().toUpperCase() || undefined

  // Visita orgânica direta não vira registro — evita encher o storage de ruído
  // e deixa claro, no perfil, quem chegou sem campanha nenhuma.
  if (!source && !medium && !campaign && !ref) return null

  const attribution: Attribution = {
    source, medium, campaign, ref,
    landedAt: Date.now(),
    landingPath: window.location.pathname,
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(attribution))
  } catch {
    // Navegador em modo restrito: seguimos sem atribuição, não é fatal.
  }
  return attribution
}

export function getAttribution(): Attribution | null {
  return read()
}

/** Campos prontos para o Firestore (que rejeita undefined). */
export function attributionFields(): Record<string, unknown> {
  const a = read()
  if (!a) return {}
  const out: Record<string, unknown> = { landedAt: a.landedAt }
  if (a.source)      out.source = a.source
  if (a.medium)      out.medium = a.medium
  if (a.campaign)    out.campaign = a.campaign
  if (a.ref)         out.ref = a.ref
  if (a.landingPath) out.landingPath = a.landingPath
  return { attribution: out }
}

/** Monta um link de convite/campanha a partir da origem do app. */
export function buildInviteLink(inviteCode: string, campaign = 'convite'): string {
  const url = new URL(window.location.origin)
  url.searchParams.set('ref', inviteCode)
  url.searchParams.set('utm_source', 'convite')
  url.searchParams.set('utm_medium', 'atleta')
  url.searchParams.set('utm_campaign', campaign)
  return url.toString()
}
