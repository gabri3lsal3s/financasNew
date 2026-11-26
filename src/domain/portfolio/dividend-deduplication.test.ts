import { describe, expect, it } from "vitest";
import {
  findFuzzyMatchingManualDividend,
  isCorporateDividendDeduplicated,
  normalizeDividendTickerKey,
  reconcileCorporateWithManualDividends,
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

describe("reconcileCorporateWithManualDividends (S3 — Conciliação 1:1 e N:1)", () => {
  const mkEv = (
    overrides: Partial<Parameters<typeof reconcileCorporateWithManualDividends>[0][number]> & {
      id: string;
      netCents: number;
    },
  ): Parameters<typeof reconcileCorporateWithManualDividends>[0][number] => ({
    ticker: "PETR4",
    currency: "BRL",
    comDate: "2026-10-01",
    paymentDate: "2026-10-15",
    grossCents: overrides.netCents,
    type: "DIVIDENDO",
    isTypeUncertain: false,
    manualReviewRequired: false,
    status: "PENDING_CONFIRMATION",
    ...overrides,
  });

  const mkMan = (
    overrides: Partial<Parameters<typeof reconcileCorporateWithManualDividends>[1][number]> & {
      id: string;
      cents: number;
    },
  ): Parameters<typeof reconcileCorporateWithManualDividends>[1][number] => ({
    ticker: "PETR4",
    currency: "BRL",
    date: "2026-10-15",
    monthly: false,
    sourceEventId: null,
    alreadyLinked: false,
    ...overrides,
  });

  it("auto_vincula 1:1 dentro do limiar max(10 centavos, 1.5%) para erros positivo e negativo", () => {
    const resPos = reconcileCorporateWithManualDividends(
      [mkEv({ id: "e1", netCents: 10000 })],
      [mkMan({ id: "m1", date: "2026-10-16", cents: 10140 })], // +1.4% <= 1.5%
    );
    expect(resPos.aplicar).toHaveLength(1);
    expect(resPos.aplicar[0]?.reason).toBe("exact_1_to_1");

    const resNeg = reconcileCorporateWithManualDividends(
      [mkEv({ id: "e2", ticker: "VALE3", netCents: 500 })],
      [mkMan({ id: "m2", ticker: "VALE3", cents: 491 })], // -9 cents <= 10 cents
    );
    expect(resNeg.aplicar).toHaveLength(1);

    const resOut = reconcileCorporateWithManualDividends(
      [mkEv({ id: "e3", ticker: "ITUB4", netCents: 10000 })],
      [mkMan({ id: "m3", ticker: "ITUB4", cents: 10180 })], // +1.8% > 1.5%
    );
    expect(resOut.aplicar).toHaveLength(0);
    expect(resOut.sugerir).toHaveLength(0);
  });

  it("aplica hipóteses de IR (JCP 85% / USD bruto) como sugerir", () => {
    const resJcp = reconcileCorporateWithManualDividends(
      [mkEv({ id: "e-jcp", ticker: "BBAS3", netCents: 10000, grossCents: 10000, type: "JCP" })],
      [mkMan({ id: "m-jcp", ticker: "BBAS3", cents: 8500 })],
    );
    expect(resJcp.sugerir[0]).toMatchObject({ manual: "m-jcp", reason: "tax_hypothesis" });

    const resUsd = reconcileCorporateWithManualDividends(
      [mkEv({ id: "e-us", ticker: "AAPL", currency: "USD", netCents: 700, grossCents: 1000 })],
      [mkMan({ id: "m-us", ticker: "AAPL", currency: "USD", cents: 1000 })],
    );
    expect(resUsd.sugerir[0]).toMatchObject({ manual: "m-us", reason: "tax_hypothesis" });
  });

  it("respeita regra de consolidado mensal vs dia 01 sem tag", () => {
    const resTagged = reconcileCorporateWithManualDividends(
      [mkEv({ id: "e-m", ticker: "MXRF11", paymentDate: "2026-10-20", netCents: 2500 })],
      [mkMan({ id: "m-m", ticker: "MXRF11", date: "2026-10-01", monthly: true, cents: 2500 })],
    );
    expect(resTagged.sugerir[0]).toMatchObject({ manual: "m-m", reason: "monthly_estimate" });

    const resUntagged = reconcileCorporateWithManualDividends(
      [mkEv({ id: "e-u", ticker: "MXRF11", paymentDate: "2026-10-20", netCents: 2500 })],
      [mkMan({ id: "m-u", ticker: "MXRF11", date: "2026-10-01", monthly: false, cents: 2500 })],
    );
    expect(resUntagged.aplicar).toHaveLength(0);
    expect(resUntagged.sugerir).toHaveLength(0);
  });

  it("resolve matching bipartido ótimo evitando armadilha gulosa e marca empate como sugerir", () => {
    const resOptimal = reconcileCorporateWithManualDividends(
      [
        mkEv({ id: "e1", netCents: 10000 }),
        mkEv({ id: "e2", netCents: 10005 }),
      ],
      [
        mkMan({ id: "d1", cents: 10005 }),
        mkMan({ id: "d2", cents: 9992 }),
      ],
    );
    expect(resOptimal.aplicar).toHaveLength(2);
    expect(resOptimal.aplicar.find((l) => l.eventos.includes("e2"))?.manual).toBe("d1");
    expect(resOptimal.aplicar.find((l) => l.eventos.includes("e1"))?.manual).toBe("d2");

    const resTie = reconcileCorporateWithManualDividends(
      [
        mkEv({ id: "t1", netCents: 5000 }),
        mkEv({ id: "t2", netCents: 5000 }),
      ],
      [mkMan({ id: "dm", cents: 5000 })],
    );
    expect(resTie.aplicar).toHaveLength(0);
    expect(resTie.sugerir.length).toBeGreaterThanOrEqual(1);
    expect(resTie.ambiguousEventIds).toEqual(expect.arrayContaining(["t1", "t2"]));
  });

  it("detecta N:1 para subconjuntos de 2..4 eventos e respeita teto de 12 eventos e idempotência", () => {
    const resN1 = reconcileCorporateWithManualDividends(
      [
        mkEv({ id: "n1", ticker: "HGLG11", paymentDate: "2026-10-05", netCents: 1100 }),
        mkEv({ id: "n2", ticker: "HGLG11", paymentDate: "2026-10-18", netCents: 1450 }),
        mkEv({ id: "n3", ticker: "HGLG11", paymentDate: "2026-10-25", netCents: 450 }),
      ],
      [mkMan({ id: "mn1", ticker: "HGLG11", date: "2026-10-25", monthly: true, cents: 3000 })],
    );
    expect(resN1.sugerir[0]).toMatchObject({ manual: "mn1", reason: "n_to_1" });
    expect(resN1.sugerir[0]?.eventos).toHaveLength(3);

    const resReplay = reconcileCorporateWithManualDividends(
      [mkEv({ id: "r1", ticker: "HGLG11", netCents: 2000, status: "SETTLED" })],
      [mkMan({ id: "rm1", ticker: "HGLG11", cents: 2000, sourceEventId: "r1", alreadyLinked: true })],
    );
    expect(resReplay.aplicar).toHaveLength(0);
    expect(resReplay.sugerir).toHaveLength(0);

    const manyEvents = Array.from({ length: 13 }, (_, idx) =>
      mkEv({ id: `many-${idx}`, ticker: "TAEE11", paymentDate: "2026-10-10", netCents: 500 }),
    );
    const resCap = reconcileCorporateWithManualDividends(manyEvents, [
      mkMan({ id: "m-cap", ticker: "TAEE11", date: "2026-10-10", monthly: true, cents: 1500 }),
    ]);
    expect(resCap.sugerir.every((l) => l.reason !== "n_to_1")).toBe(true);
    expect(resCap.overSearchCapPartitions).toContain("BRL:TAEE11");
  });
});
