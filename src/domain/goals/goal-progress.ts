/**
 * Motor puro de progresso e ritmo de metas financeiras (Onda 1 · Fase 2A).
 *
 * Centraliza a leitura de prazo (`payload.deadline`), verificação estrita em centavos
 * (sem arredondar 9.999/10.000 para "100% batido") e cálculo de ritmo diário necessário.
 *
 * 100% puro — zero dependências de UI ou Supabase.
 */

export type GoalDeadlineStatus = "no_deadline" | "on_schedule" | "due_today" | "overdue";

export interface EvaluateGoalProgressInput {
  currentCents: number;
  targetCents: number;
  /** Data limite civil YYYY-MM-DD (de PublicShare.payload.deadline). */
  deadline?: string | null;
  /** Data de referência civil YYYY-MM-DD (padrão: hoje local). */
  asOfDate?: string;
}

export interface GoalProgressEvaluation {
  currentCents: number;
  targetCents: number;
  remainingCents: number;
  isCompleted: boolean;
  isFinalStretch: boolean;
  rawPct: number;
  /** Percentual seguro para exibição: nunca retorna 100 se `currentCents < targetCents`. */
  displayPct: number;
  deadline: string | null;
  remainingDays: number | null;
  requiredDailyCents: number | null;
  deadlineStatus: GoalDeadlineStatus;
}

function parseLocalCivilDate(isoDate: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const d = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }
  return d;
}

function todayLocalCivilIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function evaluateGoalProgress(
  input: EvaluateGoalProgressInput,
): GoalProgressEvaluation {
  const targetCents = Math.max(0, Math.round(input.targetCents));
  const currentCents = Math.max(0, Math.round(input.currentCents));
  const remainingCents = Math.max(0, targetCents - currentCents);

  const isCompleted = targetCents > 0 ? currentCents >= targetCents : false;
  const rawPct = targetCents > 0 ? (currentCents / targetCents) * 100 : 0;
  const displayPct = isCompleted
    ? 100
    : Math.min(99, Math.floor(rawPct));
  const isFinalStretch = !isCompleted && rawPct >= 80;

  const cleanDeadline =
    typeof input.deadline === "string" && input.deadline.trim().length > 0
      ? input.deadline.trim().slice(0, 10)
      : null;

  const deadlineDate = cleanDeadline ? parseLocalCivilDate(cleanDeadline) : null;
  const asOfDate = parseLocalCivilDate(input.asOfDate ?? todayLocalCivilIso());

  if (!deadlineDate || !asOfDate) {
    return {
      currentCents,
      targetCents,
      remainingCents,
      isCompleted,
      isFinalStretch,
      rawPct,
      displayPct,
      deadline: null,
      remainingDays: null,
      requiredDailyCents: null,
      deadlineStatus: "no_deadline",
    };
  }

  const utcAsOf = Date.UTC(
    asOfDate.getFullYear(),
    asOfDate.getMonth(),
    asOfDate.getDate(),
  );
  const utcDeadline = Date.UTC(
    deadlineDate.getFullYear(),
    deadlineDate.getMonth(),
    deadlineDate.getDate(),
  );
  const remainingDays = Math.round((utcDeadline - utcAsOf) / (24 * 60 * 60 * 1000));

  let deadlineStatus: GoalDeadlineStatus = "on_schedule";
  if (remainingDays < 0) {
    deadlineStatus = "overdue";
  } else if (remainingDays === 0) {
    deadlineStatus = "due_today";
  }

  const requiredDailyCents =
    remainingDays > 0 && remainingCents > 0
      ? Math.ceil(remainingCents / remainingDays)
      : null;

  return {
    currentCents,
    targetCents,
    remainingCents,
    isCompleted,
    isFinalStretch,
    rawPct,
    displayPct,
    deadline: cleanDeadline,
    remainingDays,
    requiredDailyCents,
    deadlineStatus,
  };
}
