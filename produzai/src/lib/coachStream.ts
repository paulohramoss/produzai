// Leitura do SSE do Coach: texto sai em chunks para a UI, blocos tool_use são
// montados a partir dos deltas de JSON e devolvidos no fim do turno.
// Sem dependências do app — o que permite testar o parser isoladamente.

/** Pedido de ferramenta feito pelo Coach — executado no cliente. */
export interface ChatToolUse {
  id: string
  name: string
  input: Record<string, unknown>
}

interface StreamEvent {
  type: string
  index?: number
  content_block?: { type: string; id?: string; name?: string }
  delta?: { type: string; text?: string; partial_json?: string }
  error?: string
}

/** Bloco tool_use em construção enquanto os deltas de JSON chegam. */
interface PendingToolUse {
  id: string
  name: string
  json: string
}

/**
 * Consome o stream até o fim.
 * Retorna as ferramentas pedidas, ou `null` se o servidor emitiu um erro
 * (nesse caso `onError` já foi chamado).
 */
export async function readCoachStream(
  body: ReadableStream<Uint8Array>,
  onChunk: (text: string) => void,
  onError: (err: string) => void,
): Promise<ChatToolUse[] | null> {
  const reader = body.getReader()
  const dec = new TextDecoder()
  const pending = new Map<number, PendingToolUse>()
  const toolUses: ChatToolUse[] = []
  // Um chunk da rede pode cortar uma linha no meio — sem buffer, deltas de
  // JSON chegariam truncados e o parse falharia silenciosamente.
  let buffer = ''

  const handleEvent = (ev: StreamEvent): 'error' | void => {
    if (ev.type === 'error') {
      onError(ev.error ?? 'Erro desconhecido')
      return 'error'
    }
    if (ev.type === 'content_block_start' && ev.content_block?.type === 'tool_use') {
      pending.set(ev.index ?? 0, {
        id: ev.content_block.id ?? '',
        name: ev.content_block.name ?? '',
        json: '',
      })
      return
    }
    if (ev.type === 'content_block_delta') {
      if (ev.delta?.type === 'text_delta' && ev.delta.text) {
        onChunk(ev.delta.text)
      } else if (ev.delta?.type === 'input_json_delta') {
        const p = pending.get(ev.index ?? 0)
        if (p) p.json += ev.delta.partial_json ?? ''
      }
      return
    }
    if (ev.type === 'content_block_stop') {
      const key = ev.index ?? 0
      const p = pending.get(key)
      if (!p) return
      pending.delete(key)
      let input: Record<string, unknown> = {}
      try {
        input = p.json.trim() ? (JSON.parse(p.json) as Record<string, unknown>) : {}
      } catch { /* ferramenta sem input válido — segue com objeto vazio */ }
      if (p.id && p.name) toolUses.push({ id: p.id, name: p.name, input })
    }
  }

  const drain = (flush: boolean): 'error' | void => {
    const lines = buffer.split('\n')
    // A última fatia pode ser uma linha incompleta — guarda para o próximo chunk.
    buffer = flush ? '' : (lines.pop() ?? '')
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6).trim()
      if (!raw || raw === '[DONE]') continue
      try {
        if (handleEvent(JSON.parse(raw) as StreamEvent) === 'error') return 'error'
      } catch { /* SSE malformado — ignora a linha */ }
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += dec.decode(value, { stream: true })
    if (drain(false) === 'error') return null
  }
  if (drain(true) === 'error') return null

  return toolUses
}
