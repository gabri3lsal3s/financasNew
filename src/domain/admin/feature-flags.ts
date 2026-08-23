import type { SystemFeature, UserFeatureOverride } from "@/types";

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
