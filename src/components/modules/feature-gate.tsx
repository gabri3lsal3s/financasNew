import type { ReactNode } from "react";
import { useUserAccess } from "@/state";
import type { SystemFeatureKey } from "@/types";

export interface FeatureGateProps {
  feature: SystemFeatureKey | string;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Componente declarativo para renderização condicional baseada em Feature Flags (§F43).
 */
export function FeatureGate({ feature, children, fallback = null }: FeatureGateProps) {
  const { hasFeature, isLoading } = useUserAccess();

  if (isLoading) {
    return null;
  }

  if (!hasFeature(feature)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
