/**
 * Relatórios — ESPECIFICAÇÃO §3.6 (Visão Consolidada) e §4.
 *
 * Motores puros (testáveis isoladamente):
 *   • Peso de relatório (`report_weight` 0–1): o `base_amount` preserva o
 *     valor original para auditoria; o valor efetivo é base × peso;
 *   • Agregações por categoria, forma de pagamento e dia da semana
 *     (Monday-first, `(getDay()+6)%7`);
 *   • Merge de dívidas pagas: recebíveis → rendas, pagáveis → despesas
 *     (pelo mês do vencimento), com saldo recalculado;
 *   • Validação de período customizado (máx. 366 dias).
 */

/** Valor efetivo de um lançamento em centavos (base × peso, arredondado). */
export function weightedCents(baseCents: number, reportWeight: number): number {
  if (reportWeight < 0 || reportWeight > 1) {
    throw new Error("Peso de relatório deve estar entre 0 e 1.");
  }
  return Math.round(baseCents * reportWeight);
}

/** Soma ponderada de vários lançamentos (para relatórios por categoria). */
export function weightedSum(entries: readonly { baseCents: number; weight: number }[]): number {
  return entries.reduce((acc, entry) => acc + weightedCents(entry.baseCents, entry.weight), 0);
}

// ---------------------------------------------------------------------------
// Agregações (§3.6 — agrupamentos por categoria / forma / dia da semana)
// ---------------------------------------------------------------------------

export type ReportEntryKind = "expense" | "income";

export interface ReportEntry {
  id: string;
  /** Data do lançamento (YYYY-MM-DD) — usada nos agrupamentos por dia. */
  date: string;
  kind: ReportEntryKind;
  categoryId: string;
  categoryName: string;
  categoryIcon?: string | null;
  /** Forma de pagamento (despesas). */
  paymentMethod?: string | null;
  /** Valor original em centavos. */
  baseCents: number;
  /** Peso de relatório (0–1, default 1). */
  weight: number;
}

export interface CategoryTotal {
  categoryId: string;
  name: string;
  icon?: string | null;
  /** Total nominal bruto (100%) em centavos. */
  brutoCents: number;
  /** Total ponderado (com pesos) em centavos. */
  ponderadoCents: number;
  /** Alias retrocompatível para ponderadoCents. */
  totalCents: number;
}

/** Efetivo de um lançamento no relatório (base × peso). */
function entryCents(entry: Pick<ReportEntry, "baseCents" | "weight">): number {
  return weightedCents(entry.baseCents, entry.weight);
}

/** Agrega por categoria (bruto e ponderado), ordenado por total ponderado decrescente. */
export function aggregateByCategory(entries: readonly ReportEntry[]): CategoryTotal[] {
  const map = new Map<string, { categoryId: string; name: string; icon?: string | null; brutoCents: number; ponderadoCents: number }>();
  for (const entry of entries) {
    const existing = map.get(entry.categoryId);
    const bruto = entry.baseCents;
    const ponderado = entryCents(entry);
    if (existing) {
      existing.brutoCents += bruto;
      existing.ponderadoCents += ponderado;
    } else {
      map.set(entry.categoryId, {
        categoryId: entry.categoryId,
        name: entry.categoryName,
        icon: entry.categoryIcon,
        brutoCents: bruto,
        ponderadoCents: ponderado,
      });
    }
  }
  return [...map.values()]
    .map((item) => ({
      ...item,
      totalCents: item.ponderadoCents,
    }))
    .sort((a, b) => b.ponderadoCents - a.ponderadoCents);
}

export interface PaymentMethodTotal {
  method: string;
  /** Total nominal bruto (100%) em centavos. */
  brutoCents: number;
  /** Total ponderado (com pesos) em centavos. */
  ponderadoCents: number;
  /** Alias retrocompatível para ponderadoCents. */
  totalCents: number;
}

/** Agrega por forma de pagamento (bruto e ponderado), ordenado por total ponderado decrescente. */
export function aggregateByPaymentMethod(entries: readonly ReportEntry[]): PaymentMethodTotal[] {
  const map = new Map<string, { brutoCents: number; ponderadoCents: number }>();
  for (const entry of entries) {
    const method = entry.paymentMethod ?? "other";
    const existing = map.get(method);
    const bruto = entry.baseCents;
    const ponderado = entryCents(entry);
    if (existing) {
      existing.brutoCents += bruto;
      existing.ponderadoCents += ponderado;
    } else {
      map.set(method, { brutoCents: bruto, ponderadoCents: ponderado });
    }
  }
  return [...map.entries()]
    .map(([method, totals]) => ({
      method,
      brutoCents: totals.brutoCents,
      ponderadoCents: totals.ponderadoCents,
      totalCents: totals.ponderadoCents,
    }))
    .sort((a, b) => b.ponderadoCents - a.ponderadoCents);
}

/** Índice do dia da semana Monday-first: 0=Segunda … 6=Domingo (§4.1). */
export function mondayFirstWeekday(date: string): number {
  const day = new Date(`${date}T12:00:00`).getDay(); // 0=Dom … 6=Sáb
  return (day + 6) % 7;
}

export const WEEKDAY_LABELS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"] as const;

export interface WeekdayTotal {
  /** 0=Segunda … 6=Domingo. */
  weekday: number;
  label: string;
  /** Total nominal bruto (100%) em centavos. */
  brutoCents: number;
  /** Total ponderado (com pesos) em centavos. */
  ponderadoCents: number;
  /** Alias retrocompatível para ponderadoCents. */
  totalCents: number;
}

/** Agrega por dia da semana (Monday-first), com todos os 7 dias presentes. */
export function aggregateByWeekday(entries: readonly ReportEntry[]): WeekdayTotal[] {
  const totals: WeekdayTotal[] = Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    label: WEEKDAY_LABELS[weekday] ?? "",
    brutoCents: 0,
    ponderadoCents: 0,
    totalCents: 0,
  }));
  for (const entry of entries) {
    const weekday = mondayFirstWeekday(entry.date);
    const target = totals[weekday]!;
    target.brutoCents += entry.baseCents;
    target.ponderadoCents += entryCents(entry);
    target.totalCents = target.ponderadoCents;
  }
  return totals;
}

// ---------------------------------------------------------------------------
// Merge de dívidas pagas (§4.3)
// ---------------------------------------------------------------------------

export interface PaidDebt {
  kind: "payable" | "receivable";
  /** Valor pago/quítado em centavos (entra no relatório do período). */
  valueCents: number;
}

export interface MergedTotals {
  /** Total bruto (100%) de rendas em centavos. */
  incomeBrutoCents: number;
  /** Total ponderado (com pesos) de rendas em centavos. */
  incomePonderadoCents: number;
  incomeCents: number;
  /** Total bruto (100%) de despesas em centavos. */
  expenseBrutoCents: number;
  /** Total ponderado (com pesos) de despesas em centavos. */
  expensePonderadoCents: number;
  expenseCents: number;
  /** saldo bruto = rendas brutas − despesas brutas − investimentos. */
  balanceBrutoCents: number;
  /** saldo ponderado = rendas ponderadas − despesas ponderadas − investimentos. */
  balancePonderadoCents: number;
  balanceCents: number;
}

/**
 * Merge de dívidas pagas no período: recebíveis somam às rendas; pagáveis
 * somam às despesas (pelo mês do vencimento). O saldo é recalculado.
 */
export function mergePaidDebts(
  baseIncomeCents: number,
  baseExpenseCents: number,
  investmentCents: number,
  paidDebts: readonly PaidDebt[],
  options?: {
    incomeBrutoCents?: number;
    expenseBrutoCents?: number;
  },
): MergedTotals {
  let incomePonderado = baseIncomeCents;
  let expensePonderado = baseExpenseCents;
  let incomeBruto = options?.incomeBrutoCents ?? baseIncomeCents;
  let expenseBruto = options?.expenseBrutoCents ?? baseExpenseCents;

  for (const debt of paidDebts) {
    if (debt.kind === "receivable") {
      incomePonderado += debt.valueCents;
      incomeBruto += debt.valueCents;
    } else {
      expensePonderado += debt.valueCents;
      expenseBruto += debt.valueCents;
    }
  }
  return {
    incomeBrutoCents: incomeBruto,
    incomePonderadoCents: incomePonderado,
    incomeCents: incomePonderado,
    expenseBrutoCents: expenseBruto,
    expensePonderadoCents: expensePonderado,
    expenseCents: expensePonderado,
    balanceBrutoCents: incomeBruto - expenseBruto - investmentCents,
    balancePonderadoCents: incomePonderado - expensePonderado - investmentCents,
    balanceCents: incomePonderado - expensePonderado - investmentCents,
  };
}

// ---------------------------------------------------------------------------
// Período customizado (§3.6 — máx. 366 dias)
// ---------------------------------------------------------------------------

/** Máximo de dias em períodos customizados. */
export const MAX_CUSTOM_PERIOD_DAYS = 366;

export interface CustomPeriod {
  /** Primeiro dia (YYYY-MM-DD), inclusivo. */
  start: string;
  /** Último dia (YYYY-MM-DD), inclusivo. */
  end: string;
  /** Número de dias do período. */
  days: number;
}

function parseDate(date: string): Date | null {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Valida um período customizado: datas válidas, início ≤ fim e máximo de
 * 366 dias. Retorna o período validado ou um erro legível.
 */
export function validateCustomPeriod(start: string, end: string): { ok: true; period: CustomPeriod } | { ok: false; error: string } {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (!startDate || !endDate) return { ok: false, error: "Datas inválidas." };
  if (startDate.getTime() > endDate.getTime()) return { ok: false, error: "Início maior que o fim do período." };

  const days = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
  if (days > MAX_CUSTOM_PERIOD_DAYS) {
    return { ok: false, error: `Período máximo de ${MAX_CUSTOM_PERIOD_DAYS} dias.` };
  }
  return { ok: true, period: { start, end, days } };
}

// ---------------------------------------------------------------------------
// Comparativo (§3.6 — período anterior)
// ---------------------------------------------------------------------------

/** Variação percentual vs período anterior (reutiliza o motor do overview). */
export { percentChange } from "@/domain/overview";

// ---------------------------------------------------------------------------
// Fechamento mensal detalhado (F22 evolução)
// ---------------------------------------------------------------------------

export {
  buildDetailedClose,
  type DetailedCloseCategory,
  type DetailedCloseDay,
  type DetailedCloseEntry,
  type DetailedCloseExpenseInput,
  type DetailedCloseResolvers,
} from "./detailed-close";
