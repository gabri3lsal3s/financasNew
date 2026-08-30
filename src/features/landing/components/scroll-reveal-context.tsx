import { type ReactNode } from "react";
import { ScrollRevealContext } from "./scroll-reveal-context-def";

export interface ScrollRevealProviderProps {
  children: ReactNode;
  resetKey?: number;
}

/**
 * Provedor de contexto para propagar a chave de reset aos componentes ScrollReveal da página.
 */
export function ScrollRevealProvider({ children, resetKey = 0 }: ScrollRevealProviderProps) {
  return (
    <ScrollRevealContext.Provider value={{ resetKey }}>
      {children}
    </ScrollRevealContext.Provider>
  );
}
