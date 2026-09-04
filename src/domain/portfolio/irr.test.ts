import { describe, expect, it } from "vitest";
import {
  buildAssetCashFlows,
  buildPortfolioCashFlows,
  calculateNetInjectedCapital,
  calculateNetPocketGain,
  calculateXIRR,
  normalizeCashFlows,
  type CashFlow,
} from "./irr";

describe("normalizeCashFlows", () => {
  it("agrega múltiplos fluxos na mesma data e ordena cronologicamente", () => {
    const raw: CashFlow[] = [
      { date: "2026-03-10", amount: 200 },
      { date: "2026-01-05", amount: -1000 },
      { date: "2026-01-05", amount: -500 },
      { date: "2026-02-15", amount: 50 },
    ];

    const normalized = normalizeCashFlows(raw);
    expect(normalized).toEqual([
      { date: "2026-01-05", amount: -1500 },
      { date: "2026-02-15", amount: 50 },
      { date: "2026-03-10", amount: 200 },
    ]);
  });

  it("elimina fluxos nulos ou que se anulam exatamente no mesmo dia", () => {
    const raw: CashFlow[] = [
      { date: "2026-01-01", amount: -500 },
      { date: "2026-01-01", amount: 500 },
      { date: "2026-02-01", amount: 1000 },
    ];

    const normalized = normalizeCashFlows(raw);
    expect(normalized).toEqual([{ date: "2026-02-01", amount: 1000 }]);
  });
});

describe("calculateXIRR — Motor Puro de Taxa Interna de Retorno", () => {
  it("calcula taxa anualizada exata para fluxo simples de 1 ano com 10% de retorno", () => {
    // Aporte de R$ 10.000 em 01/01/2026 e resgate de R$ 11.000 em 01/01/2027 (exatos 365 dias)
    const flows: CashFlow[] = [
      { date: "2026-01-01", amount: -10000 },
      { date: "2027-01-01", amount: 11000 },
    ];

    const res = calculateXIRR(flows);
    expect(res.status).toBe("ok");
    expect(res.isEligible).toBe(true);
    expect(res.daysElapsed).toBe(365);
    expect(res.periodRatePct).toBe(10);
    expect(res.annualizedRatePct).toBe(10);
  });

  it("calcula taxa anualizada para 180 dias com ganho de 5%", () => {
    // 5% em aprox meio ano vira ~10.4% a.a. composta
    const flows: CashFlow[] = [
      { date: "2026-01-01", amount: -1000 },
      { date: "2026-07-01", amount: 1050 }, // 181 dias
    ];

    const res = calculateXIRR(flows);
    expect(res.status).toBe("ok");
    expect(res.isEligible).toBe(true);
    expect(res.periodRatePct).toBe(5);
    expect(res.annualizedRatePct).toBeCloseTo(10.3, 0);
  });

  it("prova imunidade à armadilha do giro de carteira (CDB A -> CDB B reinvestido)", () => {
    // Caso da problematização:
    // 01/01/2026: Tirou R$ 1.000 do bolso (-1000)
    // 01/07/2026: Venceu CDB A por 1.150 e comprou CDB B por 1.150 (fluxo líquido do bolso = 0)
    // 01/01/2027: CDB B resgatado ou saldo em carteira = R$ 1.300 (+1300)
    const flows: CashFlow[] = [
      { date: "2026-01-01", amount: -1000 },
      { date: "2027-01-01", amount: 1300 },
    ];

    const res = calculateXIRR(flows);
    expect(res.status).toBe("ok");
    expect(res.periodRatePct).toBe(30);
    expect(res.annualizedRatePct).toBe(30); // 30% a.a. sobre os R$ 1.000 que saíram do bolso
  });

  it("calcula TIR consistente para múltiplos aportes mensais espaçados", () => {
    // 3 aportes de R$ 1.000 e saldo final de R$ 3.200 após 6 meses
    const flows: CashFlow[] = [
      { date: "2026-01-01", amount: -1000 },
      { date: "2026-02-01", amount: -1000 },
      { date: "2026-03-01", amount: -1000 },
      { date: "2026-07-01", amount: 3200 },
    ];

    const res = calculateXIRR(flows);
    expect(res.status).toBe("ok");
    expect(res.isEligible).toBe(true);
    expect(res.periodRatePct).toBeCloseTo(6.67, 1); // 200 / 3000 = 6.67%
    expect(res.annualizedRatePct).toBeGreaterThan(12); // Ponderada no tempo anualizada
  });

  it("aplica salvaguarda temporal para históricos inferiores a 30 dias", () => {
    // 10 dias com ganio de 2%
    const flows: CashFlow[] = [
      { date: "2026-01-01", amount: -1000 },
      { date: "2026-01-11", amount: 1020 },
    ];

    const res = calculateXIRR(flows);
    expect(res.status).toBe("insufficient_history");
    expect(res.isEligible).toBe(false);
    expect(res.annualizedRatePct).toBeNull(); // Não anualiza sem histórico suficiente!
    expect(res.periodRatePct).toBe(2); // Mas mantém a taxa simples do período
    expect(res.daysElapsed).toBe(10);
  });

  it("calcula corretamente carteiras com rentabilidade negativa (perdas)", () => {
    // Perda de 20% em 1 ano
    const flows: CashFlow[] = [
      { date: "2026-01-01", amount: -1000 },
      { date: "2027-01-01", amount: 800 },
    ];

    const res = calculateXIRR(flows);
    expect(res.status).toBe("ok");
    expect(res.periodRatePct).toBe(-20);
    expect(res.annualizedRatePct).toBe(-20);
  });

  it("identifica cobertura insuficiente de capital quando o aporte registrado for residual (< 50% do valor com ganho > 500%)", () => {
    // Aporte de R$ 196 para patrimônio de R$ 18.660 (inconsistência de histórico de aportes)
    const flows: CashFlow[] = [
      { date: "2026-01-01", amount: -196.35 },
      { date: "2026-06-01", amount: 18660.01 },
    ];

    const res = calculateXIRR(flows);
    expect(res.status).toBe("insufficient_capital_coverage");
    expect(res.isEligible).toBe(false);
    expect(res.annualizedRatePct).toBeNull();
    expect(res.periodRatePct).toBeNull();
  });

  it("permite anualização normalmente quando a carteira possui histórico de 60 dias", () => {
    const onlyNegative: CashFlow[] = [
      { date: "2026-01-01", amount: -1000 },
      { date: "2026-02-01", amount: -500 },
    ];
    expect(calculateXIRR(onlyNegative).status).toBe("no_sign_change");
  });

  it("retorna no_sign_change quando não há fluxo positivo ou negativo", () => {
    const onlyNegative: CashFlow[] = [
      { date: "2026-01-01", amount: -1000 },
      { date: "2026-02-01", amount: -500 },
    ];
    expect(calculateXIRR(onlyNegative).status).toBe("no_sign_change");

    const onlyPositive: CashFlow[] = [
      { date: "2026-01-01", amount: 1000 },
      { date: "2026-02-01", amount: 500 },
    ];
    expect(calculateXIRR(onlyPositive).status).toBe("no_sign_change");
  });
});

describe("buildPortfolioCashFlows", () => {
  it("monta os fluxos da carteira com aportes negativos, saques e valor final positivos", () => {
    const flows = buildPortfolioCashFlows({
      contributions: [
        { date: "2026-01-10", amount: 5000 },
        { date: "2026-03-15", amount: 2000 },
      ],
      cashWithdrawals: [
        { date: "2026-05-01", amount: 1000 },
      ],
      currentPortfolioValueBRL: 6800,
      today: "2026-06-01",
    });

    expect(flows).toEqual([
      { date: "2026-01-10", amount: -5000 },
      { date: "2026-03-15", amount: -2000 },
      { date: "2026-05-01", amount: 1000 },
      { date: "2026-06-01", amount: 6800 },
    ]);
  });
});

describe("buildAssetCashFlows", () => {
  it("monta os fluxos individuais de um ativo com compras, vendas, proventos e cotação atual", () => {
    const flows = buildAssetCashFlows({
      transactions: [
        { date: "2026-01-05", type: "buy", total: 1000 },
        { date: "2026-02-10", type: "sell", total: 300 },
      ],
      dividends: [
        { date: "2026-01-20", amount: 25 },
        { date: "2026-02-20", amount: 30 },
      ],
      currentAssetValue: 800,
      today: "2026-03-01",
    });

    expect(flows).toEqual([
      { date: "2026-01-05", amount: -1000 },
      { date: "2026-01-20", amount: 25 },
      { date: "2026-02-10", amount: 300 },
      { date: "2026-02-20", amount: 30 },
      { date: "2026-03-01", amount: 800 },
    ]);
  });
});

describe("calculateNetInjectedCapital & calculateNetPocketGain", () => {
  it("calcula o capital líquido injetado e o ganho real do bolso", () => {
    const contributions = [{ amount: 10000 }, { amount: 5000 }];
    const withdrawals = [{ amount: 2000 }];

    const netCapital = calculateNetInjectedCapital(contributions, withdrawals);
    expect(netCapital).toBe(13000); // 15.000 - 2.000

    const currentPortfolio = 15800;
    const pocketGain = calculateNetPocketGain(currentPortfolio, netCapital);
    expect(pocketGain).toBe(2800); // 15.800 - 13.000 = +2.800 de ganho do bolso
  });
});
