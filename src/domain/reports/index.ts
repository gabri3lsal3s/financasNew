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
  totalCents: number;
}

/** Efetivo de um lançamento no relatório (base × peso). */
export function entryCents(entry: Pick<ReportEntry, "baseCents" | "weight">): number {
  return weightedCents(entry.baseCents, entry.weight);
}

/** Agrega por categoria (ponderado), ordenado por total decrescente. */
export function aggregateByCategory(entries: readonly ReportEntry[]): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>();
  for (const entry of entries) {
    const existing = map.get(entry.categoryId);
    if (existing) {
      existing.totalCents += entryCents(entry);
    } else {
      map.set(entry.categoryId, {
        categoryId: entry.categoryId,
        name: entry.categoryName,
        icon: entry.categoryIcon,
        totalCents: entryCents(entry),
      });
    }
  }
  return [...map.values()].sort((a, b) => b.totalCents - a.totalCents);
}

export interface PaymentMethodTotal {
  method: string;
  totalCents: number;
}

/** Agrega por forma de pagamento (ponderado), ordenado por total decrescente. */
export function aggregateByPaymentMethod(entries: readonly ReportEntry[]): PaymentMethodTotal[] {
  const map = new Map<string, number>();
  for (const entry of entries) {
    const method = entry.paymentMethod ?? "other";
    map.set(method, (map.get(method) ?? 0) + entryCents(entry));
  }
  return [...map.entries()]
    .map(([method, totalCents]) => ({ method, totalCents }))
    .sort((a, b) => b.totalCents - a.totalCents);
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
  totalCents: number;
}

/** Agrega por dia da semana (Monday-first), com todos os 7 dias presentes. */
export function aggregateByWeekday(entries: readonly ReportEntry[]): WeekdayTotal[] {
  const totals = Array.from({ length: 7 }, (_, weekday) => ({ weekday, label: WEEKDAY_LABELS[weekday] ?? "", totalCents: 0 }));
  for (const entry of entries) {
    const weekday = mondayFirstWeekday(entry.date);
    totals[weekday]!.totalCents += entryCents(entry);
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
  incomeCents: number;
  expenseCents: number;
  /** saldo = rendas − despesas − investimentos (recalculado após merge). */
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
): MergedTotals {
  let income = baseIncomeCents;
  let expense = baseExpenseCents;
  for (const debt of paidDebts) {
    if (debt.kind === "receivable") income += debt.valueCents;
    else expense += debt.valueCents;
  }
  return { incomeCents: income, expenseCents: expense, balanceCents: income - expense - investmentCents };
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
