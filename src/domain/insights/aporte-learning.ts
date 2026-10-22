/**
 * Motor de Aprendizado do Padrão Temporal entre Renda Principal e Aportes em Corretoras (§Eixo 3).
 *
 * Função 100% pura: sem dependências de UI, React ou banco de dados.
 *
 * Responsável por:
 *   1. Mapear transferências históricas para corretoras (XP, NuInvest, BTG, Inter, Clear, Rico, etc.);
 *   2. Identificar a defasagem temporal (lag em dias) entre o recebimento da renda principal e o aporte;
 *   3. Determinar quando o ciclo corrente está pronto para sugerir o aporte planejado com sobra de caixa.
 */

import type { ExpenseLike } from "./recurrences";
import type { RecurringIncomeOccurrence } from "./recurrences";

export interface LearnedBrokerPattern {
  /** Nome da principal corretora identificada no histórico habitual. */
  primaryBroker?: string;
  /** Defasagem típica (em dias) entre a entrada da renda principal e o aporte. */
  typicalLagDays: number;
  /** Dia típico estimado do mês para realização do aporte (1–31). */
  typicalDayOfMonth: number;
  /** Valor médio histórico de aportes mensais em centavos. */
  averageAporteCents: number;
  /** Verdadeiro se já foi identificado um aporte ou transferência para corretora no mês atual. */
  hasAporteThisMonth: boolean;
  /** Verdadeiro se a data típica de aporte já chegou no mês vigente e ainda não há aporte registrado. */
  isReadyForAporte: boolean;
  /** Quantidade de meses históricos com aporte registrado. */
  historicalAportesCount: number;
}

const BROKER_KEYWORDS_REGEX =
  /\b(nuinvest|nubank corretora|xp\b|xp investimentos|btg\b|btg pactual|inter dtvm|banco inter|clear\b|clear corretora|rico\b|rico investimentos|toro\b|toro investimentos|avenue|nomad|binance|mercado bitcoin|foxbit|orama|órama|genial\b|c6 invest)\b/i;

const INVESTMENT_CATEGORY_REGEX = /\b(investimento|investimentos|aporte|aportes|carteira|ações|fundos|tesouro direto)\b/i;

/**
 * Normaliza e identifica se uma despesa corresponde a aporte ou transferência para corretora.
 */
export function isBrokerExpense(expense: ExpenseLike): boolean {
  const desc = (expense.description || "").trim();
  if (BROKER_KEYWORDS_REGEX.test(desc)) {
    return true;
  }
  const cat = (expense.categoryName || "").trim();
  if (cat && INVESTMENT_CATEGORY_REGEX.test(cat)) {
    return true;
  }
  return false;
}

/**
 * Extrai o nome da corretora a partir da descrição da despesa.
 */
export function extractBrokerName(description?: string | null): string | undefined {
  if (!description) return undefined;
  const match = description.match(BROKER_KEYWORDS_REGEX);
  if (!match) return undefined;
  const raw = match[0].toLowerCase();
  if (raw.includes("nuinvest") || raw.includes("nubank")) return "NuInvest";
  if (raw.includes("xp")) return "XP";
  if (raw.includes("btg")) return "BTG";
  if (raw.includes("inter")) return "Inter";
  if (raw.includes("clear")) return "Clear";
  if (raw.includes("rico")) return "Rico";
  if (raw.includes("toro")) return "Toro";
  if (raw.includes("avenue")) return "Avenue";
  if (raw.includes("nomad")) return "Nomad";
  if (raw.includes("binance")) return "Binance";
  if (raw.includes("mercado bitcoin")) return "Mercado Bitcoin";
  if (raw.includes("genial")) return "Genial";
  if (raw.includes("orama") || raw.includes("órama")) return "Órama";
  return match[0].toUpperCase();
}

export interface LearnBrokerAportePatternParams {
  expenses: readonly ExpenseLike[];
  incomes?: readonly RecurringIncomeOccurrence[];
  todayISO: string;
}

/**
 * Analisa o histórico de despesas e rendas para aprender a dinâmica temporal dos aportes em corretoras.
 */
export function learnBrokerAportePattern(
  params: LearnBrokerAportePatternParams,
): LearnedBrokerPattern {
  const { expenses, incomes = [], todayISO } = params;
  const currentMonth = todayISO.slice(0, 7);
  const currentDay = parseInt(todayISO.slice(8, 10), 10) || 1;

  // 1. Identifica a renda principal (prioriza renda fixa/CLT ou a de maior valor médio)
  const mainIncome =
    incomes.find((i) => i.profile === "fixed") ||
    [...incomes].sort((a, b) => b.averageCents - a.averageCents)[0];

  const incomeDay = mainIncome?.typicalDayOfMonth ?? 5;

  // 2. Filtra transações de corretoras e agrupa por mês
  const brokerExpenses = expenses.filter(isBrokerExpense);
  const byMonth = new Map<string, ExpenseLike[]>();

  for (const exp of brokerExpenses) {
    const list = byMonth.get(exp.month) ?? [];
    list.push(exp);
    byMonth.set(exp.month, list);
  }

  // 3. Verifica se já houve aporte no mês corrente
  const currentMonthExpenses = byMonth.get(currentMonth) ?? [];
  const hasAporteThisMonth = currentMonthExpenses.length > 0;

  // 4. Analisa meses anteriores
  const pastMonths = [...byMonth.keys()].filter((m) => m < currentMonth).sort();
  const lags: number[] = [];
  const monthlyAporteTotals: number[] = [];
  const brokerCounts = new Map<string, number>();

  for (const m of pastMonths) {
    const exps = byMonth.get(m) ?? [];
    if (exps.length === 0) continue;

    const totalCents = exps.reduce((acc, e) => acc + e.valueCents, 0);
    monthlyAporteTotals.push(totalCents);

    // Primeiro dia de aporte no mês
    const sortedByDate = [...exps].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    const firstExp = sortedByDate[0];
    if (firstExp && firstExp.date) {
      const expDay = parseInt(firstExp.date.slice(8, 10), 10);
      if (!Number.isNaN(expDay)) {
        // Lag em dias em relação à data da renda principal
        const lag = expDay >= incomeDay ? expDay - incomeDay : Math.max(0, expDay);
        lags.push(lag);
      }
    }

    for (const e of exps) {
      const broker = extractBrokerName(e.description);
      if (broker) {
        brokerCounts.set(broker, (brokerCounts.get(broker) ?? 0) + 1);
      }
    }
  }

  // Corretora preferencial
  let primaryBroker: string | undefined;
  let maxCount = 0;
  for (const [b, count] of brokerCounts) {
    if (count > maxCount) {
      maxCount = count;
      primaryBroker = b;
    }
  }

  // Lag típico: mediana dos lags observados (padrão 2 dias se não houver dados históricos)
  const typicalLagDays =
    lags.length > 0
      ? [...lags].sort((a, b) => a - b)[Math.floor(lags.length / 2)]!
      : 2;

  const typicalDayOfMonth = Math.min(31, Math.max(1, incomeDay + typicalLagDays));

  // Média histórica de aporte
  const averageAporteCents =
    monthlyAporteTotals.length > 0
      ? Math.round(monthlyAporteTotals.reduce((a, b) => a + b, 0) / monthlyAporteTotals.length)
      : 0;

  // Pronto para aporte se:
  // - Não houve aporte ainda no mês corrente
  // - O dia atual é >= dia típico do aporte OU a renda principal já entrou no mês corrente
  const isReadyForAporte = !hasAporteThisMonth && currentDay >= Math.min(incomeDay, typicalDayOfMonth);

  return {
    primaryBroker,
    typicalLagDays,
    typicalDayOfMonth,
    averageAporteCents,
    hasAporteThisMonth,
    isReadyForAporte,
    historicalAportesCount: pastMonths.length,
  };
}
