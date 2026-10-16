import { useContext } from "react";
import { SubscriptionContext } from "@/state/subscription-context";
import { getCachedIconTier } from "@/services/native/app-icon";

/**
 * Hook seguro para verificar se o usuário é assinante Pro.
 * Se overridePro for fornecido explicitamente (booleano), tem precedência absoluta.
 * Se renderizado fora de <SubscriptionProvider> ou durante a montagem inicial imediata,
 * consulta o cache local persistido ('last_applied_icon_tier'), eliminando atrasos e piscadas visuais.
 */
export function useIsPro(overridePro?: boolean): boolean {
  const ctx = useContext(SubscriptionContext);
  if (typeof overridePro === "boolean") return overridePro;
  if (ctx !== null && typeof ctx.isPro === "boolean") {
    return ctx.isPro;
  }
  return getCachedIconTier() === "PRO";
}
