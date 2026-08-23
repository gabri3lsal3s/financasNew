import { useUserAccess } from "@/state";
import type { SystemFeatureKey } from "@/types";

/**
 * Hook para consulta reativa do estado de uma Feature Flag específica.
 */
export function useFeatureFlag(featureKey: SystemFeatureKey | string): boolean {
  const { hasFeature } = useUserAccess();
  return hasFeature(featureKey);
}
