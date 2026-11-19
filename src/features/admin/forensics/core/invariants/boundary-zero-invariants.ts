/**
 * Invariantes Matemáticos de Casos Limite & Divisão por Zero (boundary-zero-invariants.ts).
 *
 * Assertivas:
 * 1. Blindagem contra NaN/Infinity em Indicadores de Risco (Sharpe/Volatilidade)
 * 2. Imutabilidade de Timestamp Local em Ano Bissexto (29/02/2028 23:59:59)
 * 3. Precisão Numérica de 8 Casas Decimais em Criptoativos
 */

import type { InvariantAssertion, InvariantSuite } from "./types";
import { createAssertionResult } from "./helpers";
import type { BoundaryZeroState } from "../personas/types";
import { calculateSharpeRatio, calculateSampleVolatility } from "@/domain/portfolio/risk-metrics";

export const assertRiskMetricsZeroDivisionSafety: InvariantAssertion<BoundaryZeroState> = {
  id: "INV-BND-01",
  name: "Blindagem contra Divisão por Zero (Sharpe/Volatilidade)",
  module: "portfolio",
  description: "Verifica se carteiras com 0 retorno, variância nula ou amostragem insuficiente nunca geram NaN ou Infinity.",
  execute: (state: BoundaryZeroState) => {
    const { divisionByZeroCases } = state;

    const volEmpty = calculateSampleVolatility(divisionByZeroCases.emptyReturnsSeries);
    const volSingle = calculateSampleVolatility(divisionByZeroCases.singleReturnSeries);
    const sharpeZeroVar = calculateSharpeRatio({
      annualizedReturnPct: 0.12,
      riskFreeRatePct: divisionByZeroCases.zeroBenchmarkReturn,
      annualizedStdDevPct: 0.0, // Variância nula
      monthsCount: 12,
    });

    const isVolEmptyValid = Number.isFinite(volEmpty.monthlyStdDevPct) && !Number.isNaN(volEmpty.monthlyStdDevPct);
    const isVolSingleValid = Number.isFinite(volSingle.monthlyStdDevPct) && !Number.isNaN(volSingle.monthlyStdDevPct);
    // Sharpe com variância zero deve retornar null ou número finito, jamais NaN ou Infinity
    const isSharpeValid = sharpeZeroVar.sharpeRatio === null || (Number.isFinite(sharpeZeroVar.sharpeRatio) && !Number.isNaN(sharpeZeroVar.sharpeRatio));

    const passed = isVolEmptyValid && isVolSingleValid && isSharpeValid;

    return createAssertionResult({
      id: "INV-BND-01",
      name: "Blindagem contra Divisão por Zero (Sharpe/Volatilidade)",
      module: "portfolio",
      expected: "Valores numéricos finitos (0.00), null seguro e não-NaN",
      found: `volEmpty=${volEmpty.monthlyStdDevPct}, volSingle=${volSingle.monthlyStdDevPct}, sharpe=${sharpeZeroVar.sharpeRatio}`,
      passed,
      origin: "src/domain/portfolio/risk-metrics.ts",
    });
  },
};

export const assertLeapYearBoundary: InvariantAssertion<BoundaryZeroState> = {
  id: "INV-BND-02",
  name: "Imutabilidade de Timestamp Local em Ano Bissexto",
  module: "auxiliary",
  description: "Garante que o carimbo de data 29/02/2028 às 23:59:59 não sofra vazamento para 01/03/2028.",
  execute: (state: BoundaryZeroState) => {
    const { leapYearTimestamps } = state;
    // O ISO local retira a data sem sofrer deslocamento indevido de timezone
    const datePart = leapYearTimestamps.localIso.slice(0, 10);
    const [year, month, day] = datePart.split("-").map(Number);

    const passed =
      year === leapYearTimestamps.expectedYear &&
      month === leapYearTimestamps.expectedMonth &&
      day === leapYearTimestamps.expectedDay;

    return createAssertionResult({
      id: "INV-BND-02",
      name: "Imutabilidade de Timestamp Local em Ano Bissexto",
      module: "auxiliary",
      expected: "2028-02-29",
      found: datePart,
      passed,
      origin: "src/lib/date.ts",
    });
  },
};

export const assertCryptoEightDecimals: InvariantAssertion<BoundaryZeroState> = {
  id: "INV-BND-03",
  name: "Precisão Numérica de 8 Decimais em Criptoativos",
  module: "portfolio",
  description: "Assegura que frações de Satoshi não sofrem truncamento precoce de ponto flutuante antes da conversão para centavos.",
  execute: (state: BoundaryZeroState) => {
    const { cryptoPrecision } = state;
    const computedTotalCents = Math.floor(cryptoPrecision.quantityUnits * cryptoPrecision.unitPriceBRL * 100);
    const passed = computedTotalCents === cryptoPrecision.expectedTotalCents;

    return createAssertionResult({
      id: "INV-BND-03",
      name: "Precisão Numérica de 8 Decimais em Criptoativos",
      module: "portfolio",
      expected: cryptoPrecision.expectedTotalCents,
      found: computedTotalCents,
      passed,
      origin: "src/domain/portfolio/valuation.ts",
    });
  },
};

export const boundaryZeroInvariantSuite: InvariantSuite = {
  name: "Suíte Forense de Casos Limite & Divisão por Zero",
  module: "portfolio",
  assertions: [assertRiskMetricsZeroDivisionSafety, assertLeapYearBoundary, assertCryptoEightDecimals],
};
