import { describe, expect, it } from "vitest";
import { SYSTEM_FEATURE_KEYS } from "@/types";
import {
  ALL_SYSTEM_MODULES,
  BETA_MODULES,
  CORE_MODULES,
  INVESTMENT_ONLY_PRESET,
} from "./module-catalog";

describe("admin module catalog", () => {
  it("cobre todas as chaves de SYSTEM_FEATURE_KEYS sem duplicatas", () => {
    const catalogKeys = ALL_SYSTEM_MODULES.map((m) => m.key);
    expect(new Set(catalogKeys).size).toBe(catalogKeys.length);

    for (const key of SYSTEM_FEATURE_KEYS) {
      expect(catalogKeys).toContain(key);
    }
  });

  it("preset Somente Investimentos cobre todos os módulos core e beta", () => {
    const presetKeys = new Set(INVESTMENT_ONLY_PRESET.map((item) => item.moduleKey));
    for (const mod of [...CORE_MODULES, ...BETA_MODULES]) {
      expect(presetKeys.has(mod.key)).toBe(true);
    }

    const investmentsGrant = INVESTMENT_ONLY_PRESET.find((i) => i.moduleKey === "investments");
    const reportsGrant = INVESTMENT_ONLY_PRESET.find((i) => i.moduleKey === "reports");
    expect(investmentsGrant?.accessLevel).toBe("write");
    expect(reportsGrant?.accessLevel).toBe("write");
  });
});
