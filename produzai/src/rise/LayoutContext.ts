import { createContext } from 'react'

export interface LayoutContextValue {
  isMobile: boolean
  menuOpen: boolean
  setMenuOpen: (v: boolean) => void
}

export const LayoutContext = createContext<LayoutContextValue>({
  isMobile: false,
  menuOpen: false,
  setMenuOpen: () => {},
})
