import { describe, expect, it } from "vitest";
import { SYSTEM_FEATURE_KEYS } from "@/types";
import {
  ALL_PRODUCT_MODULES,
  ALL_SYSTEM_MODULES,
  BETA_MODULES,
  CORE_MODULES,
  EXPANSION_MODULES,
  INVESTMENT_ONLY_PRESET,
  MODULE_CATEGORY_LABELS,
  NO_AI_PRESET,
  PERSONAL_ONLY_PRESET,
} from "./module-catalog";

describe("admin module catalog", () => {
  it("cobre todas as chaves de SYSTEM_FEATURE_KEYS sem duplicatas", () => {
    const catalogKeys = ALL_SYSTEM_MODULES.map((m) => m.key);
    expect(new Set(catalogKeys).size).toBe(catalogKeys.length);

    for (const key of SYSTEM_FEATURE_KEYS) {
      expect(catalogKeys).toContain(key);
    }
  });

  it("inclui categoria Expansões do App com family, trips e business em CORE_MODULES e ALL_PRODUCT_MODULES", () => {
    expect(MODULE_CATEGORY_LABELS.expansions).toBe("Expansões do App");

    const expansionKeys = EXPANSION_MODULES.map((m) => m.key);
    expect(expansionKeys).toEqual(["family", "trips", "business"]);
    for (const mod of EXPANSION_MODULES) {
      expect(mod.category).toBe("expansions");
      expect(CORE_MODULES).toContainEqual(mod);
      expect(ALL_PRODUCT_MODULES).toContainEqual(mod);
    }
  });

  it("preset Somente Investimentos cobre todos os módulos core, expansões e beta", () => {
    const presetMap = new Map(INVESTMENT_ONLY_PRESET.map((item) => [item.moduleKey, item.accessLevel]));
    for (const mod of [...CORE_MODULES, ...BETA_MODULES]) {
      expect(presetMap.has(mod.key)).toBe(true);
    }

    expect(presetMap.get("investments")).toBe("write");
    expect(presetMap.get("reports")).toBe("write");
    expect(presetMap.get("family")).toBe("none");
    expect(presetMap.get("trips")).toBe("none");
    expect(presetMap.get("business")).toBe("none");
    expect(presetMap.get("transactions")).toBe("none");
  });

  it("preset Somente Pessoal bloqueia business e libera os demais módulos core e expansões pessoais", () => {
    const presetMap = new Map(PERSONAL_ONLY_PRESET.map((item) => [item.moduleKey, item.accessLevel]));
    for (const mod of CORE_MODULES) {
      expect(presetMap.has(mod.key)).toBe(true);
    }

    expect(presetMap.get("business")).toBe("none");
    expect(presetMap.get("family")).toBe("write");
    expect(presetMap.get("trips")).toBe("write");
    expect(presetMap.get("transactions")).toBe("write");
  });

  it("preset Sem IA bloqueia ai_extraction", () => {
    expect(NO_AI_PRESET).toEqual([{ moduleKey: "ai_extraction", accessLevel: "none" }]);
  });
});
