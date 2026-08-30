import { useContext } from "react";
import {
  ScrollRevealContext,
  type ScrollRevealContextValue,
} from "@/features/landing/components/scroll-reveal-context-def";

/**
 * Hook para acessar a chave de reset dos efeitos de rolagem.
 */
export function useScrollRevealContext(): ScrollRevealContextValue {
  return useContext(ScrollRevealContext);
}
