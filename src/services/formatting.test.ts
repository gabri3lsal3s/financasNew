import { describe, expect, it } from "vitest";
import { formatAssetQuantity } from "./formatting";

describe("formatAssetQuantity", () => {
  it("formata inteiros em pt-BR sem casas decimais", () => {
    expect(formatAssetQuantity(0)).toBe("0");
    expect(formatAssetQuantity(10, "Ações")).toBe("10");
    expect(formatAssetQuantity(1500, "FIIs")).toBe("1.500");
    expect(formatAssetQuantity(-0)).toBe("0");
    expect(formatAssetQuantity(Number.NaN)).toBe("0");
    expect(formatAssetQuantity(Number.POSITIVE_INFINITY)).toBe("0");
  });

  it("formata frações de ações e FIIs com até 4 casas decimais", () => {
    expect(formatAssetQuantity(10.5, "Ações")).toBe("10,5");
    expect(formatAssetQuantity(12.3456, "FIIs")).toBe("12,3456");
    expect(formatAssetQuantity(1.234567, "Ações")).toBe("1,2346");
  });

  it("preserva até 8 casas decimais para criptoativos", () => {
    expect(formatAssetQuantity(0.00251234, "Cripto")).toBe("0,00251234");
    expect(formatAssetQuantity(0.00000042, "Bitcoin")).toBe("0,00000042");
    expect(formatAssetQuantity(2, "Cripto")).toBe("2");
  });

  it("preserva até 6 casas decimais para internacional, ETFs e renda fixa", () => {
    expect(formatAssetQuantity(1.234567, "Internacional")).toBe("1,234567");
    expect(formatAssetQuantity(0.05, "Renda Fixa")).toBe("0,05");
    expect(formatAssetQuantity(0.123456, "Tesouro Direto")).toBe("0,123456");
  });

  it("evita arredondar frações muito pequenas para zero quando assetClass é omitido", () => {
    expect(formatAssetQuantity(0.00001234)).toBe("0,00001234");
    expect(formatAssetQuantity(0.005)).toBe("0,005");
  });
});
