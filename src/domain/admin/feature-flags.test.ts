import { describe, expect, it } from "vitest";
import { resolveAllFeatures, resolveFeatureState } from "./feature-flags";
import type { SystemFeature, UserFeatureOverride } from "@/types";

describe("feature flags domain engine", () => {
  const baseFeature: SystemFeature = {
    key: "investments",
    name: "Investimentos",
    is_globally_enabled: true,
    default_enabled_for_new_users: true,
  };

  it("deve desativar se houver kill-switch global ativo, mesmo com override positivo", () => {
    const disabledGlobally: SystemFeature = { ...baseFeature, is_globally_enabled: false };
    const override: UserFeatureOverride = {
      id: "o1",
      user_id: "u1",
      feature_key: "investments",
      is_enabled: true,
    };

    expect(resolveFeatureState(disabledGlobally, override)).toBe(false);
  });

  it("deve respeitar o override do usuário quando a feature estiver globalmente ativa", () => {
    const overrideFalse: UserFeatureOverride = {
      id: "o1",
      user_id: "u1",
      feature_key: "investments",
      is_enabled: false,
    };
    expect(resolveFeatureState(baseFeature, overrideFalse)).toBe(false);

    const overrideTrue: UserFeatureOverride = {
      id: "o2",
      user_id: "u1",
      feature_key: "investments",
      is_enabled: true,
    };
    expect(resolveFeatureState(baseFeature, overrideTrue)).toBe(true);
  });

  it("deve usar o padrão para novos usuários se não houver override", () => {
    const defaultOff: SystemFeature = {
      ...baseFeature,
      default_enabled_for_new_users: false,
    };
    expect(resolveFeatureState(defaultOff, undefined)).toBe(false);
    expect(resolveFeatureState(baseFeature, undefined)).toBe(true);
  });

  it("deve resolver mapa completo de features para um usuário", () => {
    const features: SystemFeature[] = [
      { key: "investments", name: "Investimentos", is_globally_enabled: true, default_enabled_for_new_users: true },
      { key: "debts", name: "Dívidas", is_globally_enabled: true, default_enabled_for_new_users: false },
      { key: "budgets", name: "Orçamentos", is_globally_enabled: false, default_enabled_for_new_users: true },
    ];
    const overrides: UserFeatureOverride[] = [
      { id: "o1", user_id: "u1", feature_key: "debts", is_enabled: true },
      { id: "o2", user_id: "u1", feature_key: "budgets", is_enabled: true }, // Não adianta pois está globally false
    ];

    const resolved = resolveAllFeatures(features, overrides);

    expect(resolved.investments).toBe(true);
    expect(resolved.debts).toBe(true);
    expect(resolved.budgets).toBe(false);
  });
});
