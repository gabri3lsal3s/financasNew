/**
 * Persona Limite & Borda — Zero Absoluto, Divisões por Zero e Ano Bissexto
 *
 * Módulos: Investimentos, Fluxo de Caixa, Cartões de Crédito, Dívidas, Insights.
 * Valida resiliência extrema a dados nulos, usuário recém-criado, proteção contra
 * NaN/Infinity em Sharpe/volatilidade, carimbo no último segundo do mês em ano bissexto
 * (29/02/2028 23:59:59) e frações de 8 casas decimais em criptoativos.
 */

import type { TheoreticalPersona, BoundaryZeroState } from "./types";

export const personaBoundaryZero: TheoreticalPersona<BoundaryZeroState> = {
  id: "persona-boundary-zero",
  name: "Casos Limite & Divisão por Zero",
  description:
    "Testa usuário recém-criado com saldo zero, proteção contra NaN em Sharpe/volatilidade, timestamp 29/02/2028 23:59:59 e cripto de 8 decimais.",
  targetModules: ["portfolio", "cards", "debts", "insights", "projection"],
  instantiate: (): BoundaryZeroState => {
    return {
      zeroUser: {
        accountsCount: 0,
        transactionsCount: 0,
        totalEquityCents: 0,
      },
      divisionByZeroCases: {
        emptyReturnsSeries: [],
        singleReturnSeries: [0.015],
        zeroVarianceSeries: [0.01, 0.01, 0.01, 0.01],
        zeroBenchmarkReturn: 0.0,
      },
      leapYearTimestamps: {
        utcIso: "2028-03-01T02:59:59.000Z",
        localIso: "2028-02-29T23:59:59.000-03:00",
        expectedYear: 2028,
        expectedMonth: 2,
        expectedDay: 29,
      },
      cryptoPrecision: {
        ticker: "BTC",
        quantityUnits: 0.00001234,
        unitPriceBRL: 540_000.0,
        // 0.00001234 * 540000 = 6.6636 BRL -> 666 centavos inteiros
        expectedTotalCents: 666,
      },
    };
  },
};
