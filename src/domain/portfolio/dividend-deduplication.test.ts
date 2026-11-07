import { describe, expect, it } from "vitest";
import { isCorporateDividendDeduplicated } from "./dividend-deduplication";

describe("dividend-deduplication: Deduplicação Inteligente B3 vs Manual", () => {
  it("deve deduplicar quando ticker, data (dentro de 3 dias úteis) e valor forem coincidentes", () => {
    const corpEvent = {
      ticker: "PETR4",
      payment_date: "2026-11-20",
    };
    const calculatedTotal = 150.25;

    // Lançamento manual do investidor feito na segunda-feira seguinte (23/11/2026 = 1 dia útil após sexta 20/11)
    const manualDividends = [
      {
        ticker: "PETR4",
        date: "2026-11-23",
        amount: 150.27, // diferença de R$ 0,02
      },
    ];

    const deduplicated = isCorporateDividendDeduplicated(
      corpEvent,
      calculatedTotal,
      manualDividends,
    );

    expect(deduplicated).toBe(true);
  });

  it("não deve deduplicar se a diferença de valor exceder R$ 0,05", () => {
    const corpEvent = {
      ticker: "VALE3",
      payment_date: "2026-11-20",
    };
    const calculatedTotal = 200.0;

    const manualDividends = [
      {
        ticker: "VALE3",
        date: "2026-11-20",
        amount: 200.1, // diferença de R$ 0,10
      },
    ];

    const deduplicated = isCorporateDividendDeduplicated(
      corpEvent,
      calculatedTotal,
      manualDividends,
    );

    expect(deduplicated).toBe(false);
  });

  it("não deve deduplicar se a diferença de datas ultrapassar o limite de dias úteis", () => {
    const corpEvent = {
      ticker: "BBAS3",
      payment_date: "2026-11-03", // Terça-feira
    };
    const calculatedTotal = 50.0;

    // 10 dias úteis depois
    const manualDividends = [
      {
        ticker: "BBAS3",
        date: "2026-11-20",
        amount: 50.0,
      },
    ];

    const deduplicated = isCorporateDividendDeduplicated(
      corpEvent,
      calculatedTotal,
      manualDividends,
    );

    expect(deduplicated).toBe(false);
  });

  it("não deve deduplicar tickers diferentes", () => {
    const corpEvent = {
      ticker: "ITUB4",
      payment_date: "2026-11-20",
    };
    const calculatedTotal = 80.0;

    const manualDividends = [
      {
        ticker: "BBDC4",
        date: "2026-11-20",
        amount: 80.0,
      },
    ];

    const deduplicated = isCorporateDividendDeduplicated(
      corpEvent,
      calculatedTotal,
      manualDividends,
    );

    expect(deduplicated).toBe(false);
  });
});
