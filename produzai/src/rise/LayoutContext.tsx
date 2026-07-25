import { createContext, useState, useEffect, ReactNode } from 'react';

// NOTE: This provider is not used — RisePlan creates its own provider.
// Kept for possible future extraction. Always import from LayoutContext.ts.
// eslint-disable-next-line react-refresh/only-export-components
export const LayoutContext = createContext({ isMobile: false, isTablet: false });

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [windowW, setWindowW] = useState(window.innerWidth);

  useEffect(() => {
    const handler = () => setWindowW(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const isMobile = windowW < 768;
  const isTablet = windowW >= 768 && windowW < 1024;

  return (
    <LayoutContext.Provider value={{ isMobile, isTablet }}>
      {children}
    </LayoutContext.Provider>
  );
}
