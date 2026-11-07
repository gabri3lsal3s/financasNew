import { describe, expect, it } from "vitest";
import { validateMonthlyClosingPreFlight } from "./closing-validator";

describe("closing-validator: Validador Pré-Flight de Fechamento Mensal", () => {
  it("deve validar com sucesso uma carteira incluindo ativo CAIXA (preço 1.00 automático)", () => {
    const result = validateMonthlyClosingPreFlight({
      assets: [
        {
          id: "1",
          ticker: "PETR4",
          asset_class: "Ações",
          quantity: 100,
          average_price: 35.0,
          currency: "BRL",
        },
        {
          id: "2",
          ticker: "CAIXA",
          asset_class: "Caixa",
          quantity: 500,
          average_price: 1.0,
          currency: "BRL",
        },
      ],
      prices: [
        { ticker: "PETR4", price: 38.0, currency: "BRL", source: "api" },
        // Não passamos CAIXA na lista de cotações para testar a isenção de API
      ],
    });

    expect(result.isValid).toBe(true);
    expect(result.missingTickers).toHaveLength(0);
    expect(result.invalidPrices).toHaveLength(0);

    // Custo: 100 * 35 (3500) + 500 * 1 (500) = 4000
    expect(result.totalCost).toBe(4000);
    // Valor: 100 * 38 (3800) + 500 * 1 (500) = 4300
    expect(result.totalValue).toBe(4300);

    // CAIXA deve constar nos preços validados com preço 1.00 e source fallback
    const caixaPrice = result.validatedPrices.find((p) => p.ticker === "CAIXA");
    expect(caixaPrice).toBeDefined();
    expect(caixaPrice?.price).toBe(1.0);
    expect(caixaPrice?.source).toBe("fallback");
  });

  it("deve acusar falta de cotação para ativo que não seja caixa", () => {
    const result = validateMonthlyClosingPreFlight({
      assets: [
        {
          id: "1",
          ticker: "VALE3",
          asset_class: "Ações",
          quantity: 50,
          average_price: 60.0,
          currency: "BRL",
        },
      ],
      prices: [],
    });

    expect(result.isValid).toBe(false);
    expect(result.missingTickers).toEqual(["VALE3"]);
    expect(result.reason).toContain("VALE3");
  });

  it("deve acusar cotação não-positiva (<= 0)", () => {
    const result = validateMonthlyClosingPreFlight({
      assets: [
        {
          id: "1",
          ticker: "BBAS3",
          asset_class: "Ações",
          quantity: 100,
          average_price: 25.0,
          currency: "BRL",
        },
      ],
      prices: [{ ticker: "BBAS3", price: 0, currency: "BRL" }],
    });

    expect(result.isValid).toBe(false);
    expect(result.invalidPrices).toEqual([{ ticker: "BBAS3", price: 0 }]);
  });

  it("deve ignorar ativos com quantidade zerada", () => {
    const result = validateMonthlyClosingPreFlight({
      assets: [
        {
          id: "1",
          ticker: "MGLU3",
          asset_class: "Ações",
          quantity: 0,
          average_price: 20.0,
          currency: "BRL",
        },
      ],
      prices: [],
    });

    expect(result.isValid).toBe(true);
    expect(result.totalCost).toBe(0);
    expect(result.totalValue).toBe(0);
  });
});
