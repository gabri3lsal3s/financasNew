import { describe, expect, it, beforeEach } from "vitest";
import { getMigratedStorageItem } from "./storage-migration";

describe("getMigratedStorageItem", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("retorna null quando nenhuma chave existe", () => {
    expect(getMigratedStorageItem("axir_test", "axis_test")).toBeNull();
  });

  it("retorna o valor da nova chave quando ela já existe", () => {
    window.localStorage.setItem("axir_test", "valor_novo");
    expect(getMigratedStorageItem("axir_test", "axis_test")).toBe("valor_novo");
  });

  it("migra automaticamente da chave legada para a nova e remove a legada", () => {
    window.localStorage.setItem("axis_test", "dado_antigo");
    const result = getMigratedStorageItem("axir_test", "axis_test");

    expect(result).toBe("dado_antigo");
    expect(window.localStorage.getItem("axir_test")).toBe("dado_antigo");
    expect(window.localStorage.getItem("axis_test")).toBeNull();
  });
});
