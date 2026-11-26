import { useMemo, type ReactNode } from "react";
import { ScrollRevealContext } from "./scroll-reveal-context-def";

export interface ScrollRevealProviderProps {
  children: ReactNode;
  resetKey?: number;
}

/**
 * Provedor de contexto para propagar a chave de reset aos componentes ScrollReveal da página.
 */
export function ScrollRevealProvider({ children, resetKey = 0 }: ScrollRevealProviderProps) {
  const value = useMemo(() => ({ resetKey }), [resetKey]);
  return (
    <ScrollRevealContext.Provider value={value}>
      {children}
    </ScrollRevealContext.Provider>
  );
}
