/**
 * Motor Puro de Rentabilidade por TIR / Fluxo do Bolso (XIRR / Money-Weighted Return).
 *
 * Princípios de Engenharia Financeira:
 * 1. Ponderação no tempo: resolve VPL = 0 para fluxos de caixa com datas irregulares;
 * 2. Imunidade ao giro (turnover): reinvestimentos internos são neutros para o bolso;
 * 3. Solver híbrido robusto: Newton-Raphson (50 iter, tol 1e-7) com fallback determinístico
 *    para Bisseção / Busca Intervalar no intervalo [-0.999, 10.0];
 * 4. Salvaguarda de estabilidade temporal: históricos com menos de 30 dias corridos não são
 *    anualizados sem aviso para evitar taxas surreais decorrentes do expoente 365 / dias.
 *
 * Módulo puro — sem import de UI ou Supabase; 100% testável isoladamente.
 */

import { todayISO } from "@/domain/debts";

export interface CashFlow {
  /** Data no formato ISO (YYYY-MM-DD). */
  date: string;
  /**
   * Valor monetário:
   * - Negativo (< 0): saída do bolso (aporte externo, compra de ativo);
   * - Positivo (> 0): entrada no bolso (retirada, venda líquida, provento sacado ou saldo final na data de avaliação).
   */
  amount: number;
}

export type XIRRStatus =
  | "ok"
  | "insufficient_history"
  | "insufficient_capital_coverage"
  | "no_sign_change"
  | "calculation_limit"
  | "invalid_input";

export interface XIRRResult {
  /** Taxa anualizada (% a.a.), ex.: 14.52 para 14.52% a.a. Null se dados insuficientes ou divergência. */
  annualizedRatePct: number | null;
  /** Taxa acumulada simples no período (% total sobre o capital aportado). Null se cobertura insuficiente ou sem dados. */
  periodRatePct: number | null;
  /** Quantidade de dias corridos entre o primeiro fluxo e a data final. */
  daysElapsed: number;
  /** true apenas quando o histórico possui dados consistentes (cobertura e tempo) para exibição. */
  isEligible: boolean;
  /** Percentual do patrimônio coberto pelo capital aportado registrado (ex.: 100 para 100%). */
  capitalCoveragePct?: number;
  /** Diagnóstico da convergência e integridade dos dados. */
  status: XIRRStatus;
}

const MIN_DAYS_FOR_ANNUALIZATION = 30;
const MAX_NEWTON_ITERATIONS = 50;
const TOLERANCE = 1e-7;
const MIN_RATE = -0.999;
const MAX_RATE = 10.0; // 1.000% a.a.

/**
 * Converte string de data ISO (YYYY-MM-DD) para timestamp em milissegundos UTC.
 */
function parseDateUTC(dateStr: string): number {
  const parts = dateStr.slice(0, 10).split("-");
  const year = parseInt(parts[0] ?? "2026", 10);
  const month = parseInt(parts[1] ?? "01", 10) - 1;
  const day = parseInt(parts[2] ?? "01", 10);
  return Date.UTC(year, month, day);
}

/**
 * Agrega fluxos de caixa na mesma data e remove valores nulos/irrelevantes.
 */
export function normalizeCashFlows(cashFlows: readonly CashFlow[]): CashFlow[] {
  const map = new Map<string, number>();

  for (const cf of cashFlows) {
    if (!cf.date || Math.abs(cf.amount) < 0.0001) continue;
    const date = cf.date.slice(0, 10);
    map.set(date, (map.get(date) ?? 0) + cf.amount);
  }

  return Array.from(map.entries())
    .map(([date, amount]) => ({
      date,
      amount: Math.round(amount * 100) / 100,
    }))
    .filter((cf) => Math.abs(cf.amount) >= 0.01)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calcula o Valor Presente Líquido (VPL / NPV) para uma taxa de juros anualizada r.
 */
function npv(rate: number, flows: readonly { t: number; amount: number }[]): number {
  let sum = 0;
  for (const f of flows) {
    // (1 + r)^t
    sum += f.amount / Math.pow(1 + rate, f.t);
  }
  return sum;
}

/**
 * Calcula a primeira derivada do VPL em relação a r:
 * d(NPV)/dr = sum( -t * amount / (1 + r)^(t + 1) )
 */
function npvDerivative(rate: number, flows: readonly { t: number; amount: number }[]): number {
  let sum = 0;
  for (const f of flows) {
    sum -= (f.t * f.amount) / Math.pow(1 + rate, f.t + 1);
  }
  return sum;
}

/**
 * Resolve a Taxa Interna de Retorno de fluxos de caixa com datas irregulares (XIRR).
 */
export function calculateXIRR(rawFlows: readonly CashFlow[]): XIRRResult {
  const flows = normalizeCashFlows(rawFlows);

  if (flows.length < 2) {
    return {
      annualizedRatePct: null,
      periodRatePct: null,
      daysElapsed: 0,
      isEligible: false,
      status: "invalid_input",
    };
  }

  let hasNegative = false;
  let hasPositive = false;
  let sumNegative = 0;
  let sumPositive = 0;

  for (const f of flows) {
    if (f.amount < 0) {
      hasNegative = true;
      sumNegative += Math.abs(f.amount);
    } else if (f.amount > 0) {
      hasPositive = true;
      sumPositive += f.amount;
    }
  }

  if (!hasNegative || !hasPositive) {
    return {
      annualizedRatePct: null,
      periodRatePct: null,
      daysElapsed: 0,
      isEligible: false,
      status: "no_sign_change",
    };
  }

  const d0 = parseDateUTC(flows[0]!.date);
  const dEnd = parseDateUTC(flows[flows.length - 1]!.date);
  const daysElapsed = Math.max(0, Math.round((dEnd - d0) / (24 * 60 * 60 * 1000)));

  // Taxa acumulada no período (ganho total líquido sobre o total aportado)
  const periodRatePct =
    sumNegative > 0
      ? Math.round(((sumPositive - sumNegative) / sumNegative) * 10000) / 100
      : null;

  // Trava de cobertura de capital: se a saída registrada for residual frente ao valor final
  // (ex.: aportes de R$ 196 para uma carteira de R$ 18.660), o fluxo está incompleto
  const coverageRatio = sumPositive > 0 ? sumNegative / sumPositive : 1;
  const capitalCoveragePct = Math.round(coverageRatio * 10000) / 100;

  if (coverageRatio < 0.5 && periodRatePct !== null && periodRatePct > 500) {
    return {
      annualizedRatePct: null,
      periodRatePct: null,
      daysElapsed,
      isEligible: false,
      capitalCoveragePct,
      status: "insufficient_capital_coverage",
    };
  }

  // Trava de período mínimo: < 30 dias não anualiza sem gerar distorção matemática extrema
  if (daysElapsed < MIN_DAYS_FOR_ANNUALIZATION) {
    return {
      annualizedRatePct: null,
      periodRatePct,
      daysElapsed,
      isEligible: false,
      capitalCoveragePct,
      status: "insufficient_history",
    };
  }

  // Prepara os fluxos com frações de ano normalizadas (base 365 dias)
  const preparedFlows = flows.map((f) => {
    const d = parseDateUTC(f.date);
    const t = Math.max(0, (d - d0) / (365 * 24 * 60 * 60 * 1000));
    return { t, amount: f.amount };
  });

  // Chute inicial razoável baseado na taxa do período anualizada
  let guess = 0.1;
  if (periodRatePct !== null && daysElapsed > 0) {
    const rawPeriod = (sumPositive - sumNegative) / sumNegative;
    if (rawPeriod > -0.9) {
      guess = Math.pow(1 + rawPeriod, 365 / daysElapsed) - 1;
      if (isNaN(guess) || !isFinite(guess) || guess < -0.9 || guess > 5.0) {
        guess = 0.1;
      }
    }
  }

  // 1. Tenta resolver via Newton-Raphson
  let rate = guess;
  let newtonConverged = false;

  for (let i = 0; i < MAX_NEWTON_ITERATIONS; i++) {
    const val = npv(rate, preparedFlows);
    if (Math.abs(val) < TOLERANCE) {
      newtonConverged = true;
      break;
    }

    const deriv = npvDerivative(rate, preparedFlows);
    if (Math.abs(deriv) < 1e-12 || isNaN(deriv) || !isFinite(deriv)) {
      break; // Derivada nula ou indefinida: chaveia para bisseção
    }

    const nextRate = rate - val / deriv;
    if (nextRate <= MIN_RATE || nextRate > MAX_RATE || isNaN(nextRate)) {
      break; // Saiu do domínio válido: chaveia para bisseção
    }

    if (Math.abs(nextRate - rate) < TOLERANCE) {
      rate = nextRate;
      newtonConverged = true;
      break;
    }

    rate = nextRate;
  }

  if (newtonConverged && rate > MIN_RATE && rate <= MAX_RATE) {
    return {
      annualizedRatePct: Math.round(rate * 10000) / 100,
      periodRatePct,
      daysElapsed,
      isEligible: true,
      status: "ok",
    };
  }

  // 2. Fallback determinístico: Bisseção Intervalar
  let low = MIN_RATE;
  let high = 5.0; // 500% a.a.

  let fLow = npv(low, preparedFlows);
  let fHigh = npv(high, preparedFlows);

  // Procura intervalo onde ocorra inversão de sinal
  if (fLow * fHigh > 0) {
    // Tenta expandir o teto para 10.0 (1.000% a.a.)
    high = 10.0;
    fHigh = npv(high, preparedFlows);
  }

  if (fLow * fHigh > 0) {
    // Tenta intervalo menor
    high = 1.0;
    fHigh = npv(high, preparedFlows);
  }

  if (fLow * fHigh <= 0) {
    for (let iter = 0; iter < 100; iter++) {
      const mid = (low + high) / 2;
      const fMid = npv(mid, preparedFlows);

      if (Math.abs(fMid) < TOLERANCE || (high - low) / 2 < TOLERANCE) {
        return {
          annualizedRatePct: Math.round(mid * 10000) / 100,
          periodRatePct,
          daysElapsed,
          isEligible: true,
          status: "ok",
        };
      }

      if (fLow * fMid <= 0) {
        high = mid;
      } else {
        low = mid;
        fLow = fMid;
      }
    }
  }

  return {
    annualizedRatePct: null,
    periodRatePct,
    daysElapsed,
    isEligible: true,
    status: "calculation_limit",
  };
}

/**
 * Constrói os fluxos de caixa da Carteira Consolidada (Fluxo do Bolso Global).
 *
 * Mapeamento:
 * - Aportes externos (`portfolio_contributions`): saídas do bolso (-);
 * - Saques de caixa registrados como retiradas externas: entradas no bolso (+);
 * - Saldo patrimonial consolidado hoje (liquidação virtual da carteira): entrada (+).
 */
export function buildPortfolioCashFlows(params: {
  contributions: readonly { date: string; amount: number }[];
  currentPortfolioValueBRL: number;
  cashWithdrawals?: readonly { date: string; amount: number }[];
  today?: string;
}): CashFlow[] {
  const {
    contributions,
    currentPortfolioValueBRL,
    cashWithdrawals = [],
    today = todayISO(),
  } = params;

  const flows: CashFlow[] = [];

  // 1. Aportes externos (dinheiro que sai do bolso para a carteira)
  for (const c of contributions) {
    if (c.amount > 0) {
      flows.push({
        date: c.date,
        amount: -Math.abs(c.amount),
      });
    }
  }

  // 2. Retiradas / Saques externos (dinheiro que volta ao bolso)
  for (const w of cashWithdrawals) {
    if (w.amount > 0) {
      flows.push({
        date: w.date,
        amount: Math.abs(w.amount),
      });
    }
  }

  // 3. Valor patrimonial consolidado na data atual (liquidação hipotética do portfólio)
  if (currentPortfolioValueBRL > 0) {
    flows.push({
      date: today,
      amount: currentPortfolioValueBRL,
    });
  }

  return normalizeCashFlows(flows);
}

/**
 * Constrói os fluxos de caixa individuais de um Ativo sob custódia.
 *
 * Mapeamento:
 * - Compras / Subscrições: saída (-);
 * - Vendas / Resgates: entrada (+);
 * - Proventos recebidos: entrada (+);
 * - Valor de mercado da posição remanescente hoje: entrada final (+).
 */
export function buildAssetCashFlows(params: {
  transactions: readonly {
    date: string;
    type: string;
    total: number;
    quantity?: number;
    price?: number;
  }[];
  dividends: readonly { date: string; amount: number }[];
  currentAssetValue: number;
  today?: string;
}): CashFlow[] {
  const {
    transactions,
    dividends,
    currentAssetValue,
    today = todayISO(),
  } = params;

  const flows: CashFlow[] = [];

  for (const tx of transactions) {
    const rawTotal = tx.total > 0 ? tx.total : (tx.quantity ?? 0) * (tx.price ?? 0);
    const total = Math.round(rawTotal * 100) / 100;
    if (total <= 0) continue;

    if (tx.type === "buy" || tx.type === "subscription") {
      flows.push({
        date: tx.date,
        amount: -total,
      });
    } else if (tx.type === "sell") {
      flows.push({
        date: tx.date,
        amount: total,
      });
    }
  }

  for (const div of dividends) {
    if (div.amount > 0) {
      flows.push({
        date: div.date,
        amount: Math.round(div.amount * 100) / 100,
      });
    }
  }

  if (currentAssetValue > 0) {
    flows.push({
      date: today,
      amount: Math.round(currentAssetValue * 100) / 100,
    });
  }

  return normalizeCashFlows(flows);
}

/**
 * Calcula o Capital Líquido Injetado do Bolso (Net Invested Capital).
 * Permite que o usuário compare o dinheiro total que saiu do seu bolso contra o patrimônio atual.
 */
export function calculateNetInjectedCapital(
  contributions: readonly { amount: number }[],
  withdrawals: readonly { amount: number }[] = [],
): number {
  const totalIn = contributions.reduce((acc, c) => acc + Math.max(0, c.amount), 0);
  const totalOut = withdrawals.reduce((acc, w) => acc + Math.max(0, w.amount), 0);
  return Math.round((totalIn - totalOut) * 100) / 100;
}

/**
 * Calcula o Lucro Líquido Real do Bolso em R$:
 * Patrimônio Atual - Capital Líquido Injetado.
 */
export function calculateNetPocketGain(
  currentPortfolioValueBRL: number,
  netInjectedCapitalBRL: number,
): number {
  return Math.round((currentPortfolioValueBRL - netInjectedCapitalBRL) * 100) / 100;
}
