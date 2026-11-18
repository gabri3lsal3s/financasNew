import type { DailyFlowItem } from "@/domain/overview";
import { toAreaPath, toMonotoneCubicPath, type ChartPoint } from "@/lib/chart-curve";

export const DAILY_FLOW_LINE_WIDTH = 320;
export const DAILY_FLOW_LINE_HEIGHT = 160;
export const DAILY_FLOW_PAD = 12;
export const DAILY_FLOW_BASELINE_Y = DAILY_FLOW_LINE_HEIGHT - DAILY_FLOW_PAD;

export interface DailyFlowXTick {
  label: string;
  leftPct: number;
}

export interface DailyFlowGeometryResult {
  hasIncomes: boolean;
  hasExpenses: boolean;
  hasInvestments: boolean;
  hasAnyData: boolean;
  globalMax: number;
  incomePointList: ChartPoint[];
  expensePointList: ChartPoint[];
  investmentPointList: ChartPoint[];
  incomePath: string;
  expensePath: string;
  investmentPath: string;
  incomeAreaPath: string;
  expenseAreaPath: string;
  investmentAreaPath: string;
  xTicks: DailyFlowXTick[];
}

/**
 * Converte a série em pontos na escala sublinear (x^0.6) para manter
 * despesas e aportes visíveis mesmo quando há picos pontuais de receita.
 */
export function toDailyFlowLinePoints(
  values: readonly number[],
  width: number,
  height: number,
  globalMax: number,
): ChartPoint[] {
  const range = globalMax > 0 ? globalMax : 1;
  const usableHeight = height - DAILY_FLOW_PAD * 2;
  return values.map((value, index) => {
    const x = values.length > 1 ? (index / (values.length - 1)) * width : width;
    const clampedValue = Math.max(0, value);
    const normalized = Math.pow(clampedValue / range, 0.6);
    const y = DAILY_FLOW_PAD + (1 - normalized) * usableHeight;
    return { x, y };
  });
}

export function buildDailyFlowXTicks(daysCount: number): DailyFlowXTick[] {
  if (daysCount <= 1) return [];
  const candidates =
    daysCount >= 20 ? [1, 5, 10, 15, 20, 25, daysCount] : [1, Math.ceil(daysCount / 2), daysCount];
  const unique = Array.from(new Set(candidates.filter((d) => d <= daysCount)));
  return unique.map((d) => ({
    label: String(d).padStart(2, "0"),
    leftPct: ((d - 1) / Math.max(1, daysCount - 1)) * 100,
  }));
}

/**
 * Formata DD/MM diretamente da string ISO YYYY-MM-DD sem passar por UTC `new Date(...)`
 * (evita deslocamento de dia 01 -> 31 do mês anterior em fusos negativos como UTC-3).
 */
export function formatDailyFlowDayLabel(dayIso: string, dayOfMonth: number): string {
  const dayStr = String(dayOfMonth).padStart(2, "0");
  const match = /^\d{4}-(\d{2})-\d{2}/.exec(dayIso);
  if (match?.[1]) {
    return `${dayStr}/${match[1]}`;
  }
  return dayStr;
}

export function computeDailyFlowGeometry(days: readonly DailyFlowItem[]): DailyFlowGeometryResult {
  const incomeValues = days.map((day) => day.incomeCents);
  const expenseValues = days.map((day) => day.expenseCents);
  const investmentValues = days.map((day) => day.investmentCents);

  const hasIncomes = days.some((day) => day.incomeCents > 0);
  const hasExpenses = days.some((day) => day.expenseCents > 0);
  const hasInvestments = days.some((day) => day.investmentCents > 0);
  const hasAnyData = hasIncomes || hasExpenses || hasInvestments;

  const globalMax = Math.max(
    ...(hasIncomes ? incomeValues : []),
    ...(hasExpenses ? expenseValues : []),
    ...(hasInvestments ? investmentValues : []),
    0,
  );

  const incomePointList = hasIncomes
    ? toDailyFlowLinePoints(incomeValues, DAILY_FLOW_LINE_WIDTH, DAILY_FLOW_LINE_HEIGHT, globalMax)
    : [];
  const expensePointList = hasExpenses
    ? toDailyFlowLinePoints(expenseValues, DAILY_FLOW_LINE_WIDTH, DAILY_FLOW_LINE_HEIGHT, globalMax)
    : [];
  const investmentPointList = hasInvestments
    ? toDailyFlowLinePoints(investmentValues, DAILY_FLOW_LINE_WIDTH, DAILY_FLOW_LINE_HEIGHT, globalMax)
    : [];

  const incomePath = hasIncomes ? toMonotoneCubicPath(incomePointList, DAILY_FLOW_BASELINE_Y) : "";
  const expensePath = hasExpenses ? toMonotoneCubicPath(expensePointList, DAILY_FLOW_BASELINE_Y) : "";
  const investmentPath = hasInvestments ? toMonotoneCubicPath(investmentPointList, DAILY_FLOW_BASELINE_Y) : "";

  return {
    hasIncomes,
    hasExpenses,
    hasInvestments,
    hasAnyData,
    globalMax,
    incomePointList,
    expensePointList,
    investmentPointList,
    incomePath,
    expensePath,
    investmentPath,
    incomeAreaPath: hasIncomes && incomePath ? toAreaPath(incomePointList, incomePath, DAILY_FLOW_BASELINE_Y) : "",
    expenseAreaPath: hasExpenses && expensePath ? toAreaPath(expensePointList, expensePath, DAILY_FLOW_BASELINE_Y) : "",
    investmentAreaPath:
      hasInvestments && investmentPath ? toAreaPath(investmentPointList, investmentPath, DAILY_FLOW_BASELINE_Y) : "",
    xTicks: buildDailyFlowXTicks(days.length),
  };
}
