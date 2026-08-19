import { useEffect, useState } from 'react'

/**
 * `true` abaixo de 768px — o mesmo corte que a sidebar usa.
 *
 * O LayoutContext só existe dentro do app logado; telas públicas (landing,
 * login) precisam medir a janela por conta própria.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const handler = () => setIsMobile(mq.matches)
    handler()
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint])

  return isMobile
}
