import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * O mínimo que faz uma janela sobreposta funcionar sem mouse.
 *
 * Três coisas que faltavam em todos os modais do app:
 *
 *  1. ESC fecha. É o gesto que todo mundo tenta primeiro, e sem ele quem navega
 *     por teclado precisa caçar o × na tela.
 *  2. O foco entra na janela ao abrir e VOLTA para o botão que a abriu ao
 *     fechar. Sem isso o foco fica preso no fundo: o leitor de tela continua
 *     lendo a página de trás como se nada tivesse acontecido, e o Tab passeia
 *     por links escondidos atrás do escurecido.
 *  3. O Tab circula dentro da janela em vez de escapar para o fundo.
 *
 * Devolve a ref que vai no PAINEL (não no fundo escurecido). O painel também
 * precisa de `role="dialog" aria-modal="true"`, um rótulo e `tabIndex={-1}` —
 * sem o tabIndex ele não pode receber o foco de abertura.
 *
 * `open` existe porque a maioria dos modais é montada dentro de um `&&` na
 * página que a abre: o hook precisa ficar quieto enquanto a janela não está na
 * tela, e Hooks não podem ser chamados dentro de condicional.
 */
export function useDialog(open: boolean, onClose?: () => void) {
  const panelRef = useRef<HTMLDivElement>(null)

  // O `onClose` costuma ser uma arrow function criada no render. Guardá-lo numa
  // ref mantém o efeito preso apenas a `open` — senão ele reinicia a cada
  // render e rouba o foco do campo que a pessoa está preenchendo.
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose })

  useEffect(() => {
    if (!open) return

    const panel = panelRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null

    // Foca o painel em si, não o primeiro campo: começar dentro de um input faz
    // o leitor de tela pular o título, e a pessoa não sabe onde entrou.
    panel?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!closeRef.current) return
        e.stopPropagation()
        closeRef.current()
        return
      }
      if (e.key !== 'Tab' || !panel) return

      const focusables = panel.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (focusables.length === 0) return

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement

      // Chegou na ponta: dá a volta em vez de sair para a página de trás.
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      // Devolve o foco a quem abriu — se ele ainda estiver na tela.
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [open])

  return panelRef
}
