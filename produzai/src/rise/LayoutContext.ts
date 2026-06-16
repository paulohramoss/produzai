import { createContext } from 'react'

export interface LayoutContextValue {
  isMobile: boolean   // < 768px  — single column, bottom nav
  isTablet: boolean   // 768–1023px — icon sidebar
  menuOpen: boolean
  setMenuOpen: (v: boolean) => void
}

export const LayoutContext = createContext<LayoutContextValue>({
  isMobile: false,
  isTablet: false,
  menuOpen: false,
  setMenuOpen: () => {},
})
