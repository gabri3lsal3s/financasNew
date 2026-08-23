import type { SystemFeature, UserFeatureOverride } from "@/types";

export type FeatureStatusKind =
  | "globally_disabled"
  | "override_enabled"
  | "override_disabled"
  | "default_enabled"
  | "default_disabled";

export interface FeatureStatusInfo {
  isEnabled: boolean;
  kind: FeatureStatusKind;
  label: string;
  badgeVariant: "positive" | "critical" | "muted";
  hasOverride: boolean;
}

/**
 * Resolve o estado final de uma funcionalidade para um usuário específico:
 * 1. Se `is_globally_enabled === false` (Kill-Switch Global) -> desativada incondicionalmente.
 * 2. Se houver `UserFeatureOverride` -> prevalece a escolha personalizada do usuário.
 * 3. Caso contrário -> usa `default_enabled_for_new_users` da feature.
 */
export function resolveFeatureState(
  feature: SystemFeature,
  override?: UserFeatureOverride,
): boolean {
  if (!feature.is_globally_enabled) {
    return false;
  }
  if (override !== undefined) {
    return override.is_enabled;
  }
  return feature.default_enabled_for_new_users;
}

/**
 * Retorna os metadados visuais de status da funcionalidade para exibição na UI de administração.
 */
export function getFeatureStatusInfo(
  feature: SystemFeature,
  override?: UserFeatureOverride,
): FeatureStatusInfo {
  if (!feature.is_globally_enabled) {
    return {
      isEnabled: false,
      kind: "globally_disabled",
      label: "Bloqueado (Kill-Switch Global)",
      badgeVariant: "critical",
      hasOverride: Boolean(override),
    };
  }

  if (override !== undefined) {
    if (override.is_enabled) {
      return {
        isEnabled: true,
        kind: "override_enabled",
        label: "Liberado (Override Individual)",
        badgeVariant: "positive",
        hasOverride: true,
      };
    }
    return {
      isEnabled: false,
      kind: "override_disabled",
      label: "Bloqueado (Override Individual)",
      badgeVariant: "critical",
      hasOverride: true,
    };
  }

  if (feature.default_enabled_for_new_users) {
    return {
      isEnabled: true,
      kind: "default_enabled",
      label: "Liberado (Padrão Global)",
      badgeVariant: "muted",
      hasOverride: false,
    };
  }

  return {
    isEnabled: false,
    kind: "default_disabled",
    label: "Bloqueado (Padrão Global)",
    badgeVariant: "muted",
    hasOverride: false,
  };
}

/**
 * Resolve um mapa chave-valor de todas as funcionalidades ativas para o usuário.
 */
export function resolveAllFeatures(
  features: readonly SystemFeature[],
  overrides: readonly UserFeatureOverride[] = [],
): Record<string, boolean> {
  const overrideByFeature = new Map<string, UserFeatureOverride>();
  for (const o of overrides) {
    overrideByFeature.set(o.feature_key, o);
  }

  const result: Record<string, boolean> = {};
  for (const f of features) {
    result[f.key] = resolveFeatureState(f, overrideByFeature.get(f.key));
  }
  return result;
}
