import { useContext } from "react";
import { SubscriptionContext } from "@/state/subscription-context";

/**
 * Hook seguro para verificar se o usuário é assinante Pro.
 * Se overridePro for fornecido explicitamente (booleano), tem precedência absoluta.
 * Se renderizado fora de <SubscriptionProvider>, retorna false sem lançar exceção.
 */
export function useIsPro(overridePro?: boolean): boolean {
  const ctx = useContext(SubscriptionContext);
  if (typeof overridePro === "boolean") return overridePro;
  return ctx?.isPro ?? false;
}
