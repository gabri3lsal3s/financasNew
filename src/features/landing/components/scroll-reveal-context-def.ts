import { createContext } from "react";

export interface ScrollRevealContextValue {
  /** Chave de reset que reinicia os observadores quando o usuário retorna ao topo. */
  resetKey: number;
}

export const ScrollRevealContext = createContext<ScrollRevealContextValue>({
  resetKey: 0,
});
