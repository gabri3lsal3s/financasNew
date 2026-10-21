import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  forgetStoredMerchantCategory,
  getStoredMerchantCategoryMapping,
  storeMerchantCategory,
} from "./merchant-storage";

describe("merchant-storage — Persistência Isolada da Memória de Merchant", () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }

    vi.spyOn(Storage.prototype, "getItem").mockImplementation((key) => store[key] ?? null);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, val) => {
      store[key] = val;
    });
  });

  it("retorna objeto vazio se nada foi salvo", () => {
    expect(getStoredMerchantCategoryMapping()).toEqual({});
  });

  it("salva e recupera associações de estabelecimento com normalização", () => {
    const res = storeMerchantCategory("Padaria Central", "alimentacao");
    expect(res["padaria central"]).toBe("alimentacao");

    const retrieved = getStoredMerchantCategoryMapping();
    expect(retrieved["padaria central"]).toBe("alimentacao");
  });

  it("permite esquecer um estabelecimento gravado", () => {
    storeMerchantCategory("Posto Shell", "transporte");
    const updated = forgetStoredMerchantCategory("Posto Shell");
    expect(updated["posto shell"]).toBeUndefined();
    expect(getStoredMerchantCategoryMapping()["posto shell"]).toBeUndefined();
  });
});
