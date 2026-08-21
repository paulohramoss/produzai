import { C, T } from '../data'

/**
 * O que ocupa a tela enquanto o chunk da página chega.
 *
 * Não é enfeite: sem ele a troca de aba deixaria a área de conteúdo VAZIA por
 * alguns quadros — e uma tela em branco lida como app travado, não como app
 * carregando. As barras têm a altura aproximada dos cards reais para a página
 * não "pular" quando o conteúdo de verdade entra no lugar.
 *
 * A animação é declarada em index.css e some sozinha com `prefers-reduced-motion`.
 */
export function PageSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-live="polite" style={{ paddingTop: 8 }}>
      <span className="sr-only">Carregando…</span>
      <div className="rise-skeleton" style={{ height: 28, width: '45%', borderRadius: T.radius.sm, marginBottom: 20 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[140, 190, 110].map((h, i) => (
          <div
            key={i}
            className="rise-skeleton"
            style={{ height: h, borderRadius: T.radius['2xl'], border: `1px solid ${C.border}` }}
          />
        ))}
      </div>
    </div>
  )
}
