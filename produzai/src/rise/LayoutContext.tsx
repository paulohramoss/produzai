import { createContext, useState, useEffect, ReactNode } from 'react';

export const LayoutContext = createContext({ isMobile: false });

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <LayoutContext.Provider value={{ isMobile }}>
      {children}
    </LayoutContext.Provider>
  );
}
