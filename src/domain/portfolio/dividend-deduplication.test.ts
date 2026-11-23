import { describe, expect, it } from "vitest";
import {
  findFuzzyMatchingManualDividend,
  isCorporateDividendDeduplicated,
  normalizeDividendTickerKey,
} from "./dividend-deduplication";

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

  it("normaliza tickers fracionários (.SA / F) e não deduplica quando payment_date é nula", () => {
    expect(normalizeDividendTickerKey("petr4f.sa")).toBe("PETR4");

    const matchNull = findFuzzyMatchingManualDividend(
      { ticker: "PETR4", payment_date: null },
      100,
      [{ id: "m1", ticker: "PETR4", date: "2026-11-20", amount: 100 }],
    );
    expect(matchNull).toBeNull();

    const matchFrac = findFuzzyMatchingManualDividend(
      { ticker: "PETR4", payment_date: "2026-11-20" },
      100,
      [{ id: "m2", ticker: "PETR4F", date: "2026-11-20", amount: 100 }],
    );
    expect(matchFrac?.id).toBe("m2");
  });

  it("usa calendário NYSE quando o evento corporativo é USD e resolve ticker via assetTickerMap", () => {
    // 2026-07-03 é feriado observado de Independence Day nos EUA (sem pregão US), 2026-07-04/05 fim de semana.
    // Entre 2026-07-01 e 2026-07-07 contam-se apenas 3 dias úteis US (02, 06, 07) <= max 3.
    const assetTickerMap = new Map([["asset-aapl", "AAPL"]]);
    const matchUs = findFuzzyMatchingManualDividend(
      { ticker: "AAPL", payment_date: "2026-07-01", currency: "USD" },
      25.5,
      [{ id: "m-us", ticker: null, asset_id: "asset-aapl", date: "2026-07-07", amount: 25.53 }],
      assetTickerMap,
    );
    expect(matchUs?.id).toBe("m-us");

    // Payment date inválida nunca colide mesmo com valor idêntico
    const invalidCorp = isCorporateDividendDeduplicated(
      { ticker: "AAPL", payment_date: "" },
      25.5,
      [{ ticker: "AAPL", date: "2026-07-07", amount: 25.5 }],
    );
    expect(invalidCorp).toBe(false);
  });
});
