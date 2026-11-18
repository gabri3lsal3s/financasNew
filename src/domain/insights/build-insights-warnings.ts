import type { InsightAlert } from "./alerts";
import { formatBRL } from "./recurrence-budget-impact";
import type { FamilyConsolidationResult } from "@/types";

export interface InsightsWarningItem {
  id: string;
  variant: "warning" | "success" | "error";
  message: string;
}

export interface PortfolioWarningRow {
  assetId: string;
  ticker: string;
  isMatured?: boolean;
  maturityDate?: string | null;
  fixedIncomeResult?: {
    taxCountdown?: {
      daysRemaining: number;
      nextRatePct: number;
    } | null;
  } | null;
}

export interface EmergencyCompositionWarning {
  id: string;
  message: string;
}

export interface BuildInsightsWarningsInput {
  alerts: readonly InsightAlert[];
  portfolioRows: readonly PortfolioWarningRow[];
  todayISO: string;
  emergencyWarnings: readonly EmergencyCompositionWarning[];
  householdData: FamilyConsolidationResult | null | undefined;
  daysInMonth: number;
  dayOfMonth: number;
}

const DATE_ONLY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function formatIsoDateBR(iso: string): string {
  const datePart = iso.split("T")[0] ?? "";
  if (!DATE_ONLY_PATTERN.test(datePart)) {
    return iso;
  }
  const [year, month, day] = datePart.split("-");
  return `${day}/${month}/${year}`;
}

function diffCalendarDays(targetIso: string, baseIso: string): number | null {
  const targetPart = targetIso.split("T")[0] ?? "";
  const basePart = baseIso.split("T")[0] ?? "";
  if (!DATE_ONLY_PATTERN.test(targetPart) || !DATE_ONLY_PATTERN.test(basePart)) {
    const diffMs = new Date(targetIso).getTime() - new Date(baseIso).getTime();
    if (Number.isNaN(diffMs)) return null;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }
  const [ty, tm, td] = targetPart.split("-").map(Number);
  const [by, bm, bd] = basePart.split("-").map(Number);
  const targetUtc = Date.UTC(ty ?? 0, (tm ?? 1) - 1, td ?? 1);
  const baseUtc = Date.UTC(by ?? 0, (bm ?? 1) - 1, bd ?? 1);
  return Math.ceil((targetUtc - baseUtc) / (1000 * 60 * 60 * 24));
}

export function buildInsightsWarnings({
  alerts,
  portfolioRows,
  todayISO,
  emergencyWarnings,
  householdData,
  daysInMonth,
  dayOfMonth,
}: BuildInsightsWarningsInput): InsightsWarningItem[] {
  const warnings: InsightsWarningItem[] = [
    ...alerts.map((a) => ({
      id: a.id,
      variant:
        a.severity === "critical"
          ? ("error" as const)
          : a.severity === "praise"
            ? ("success" as const)
            : ("warning" as const),
      message: `${a.title}: ${a.description}`,
    })),
    ...portfolioRows
      .filter((r) => r.isMatured)
      .map((r) => ({
        id: `matured-${r.assetId}`,
        variant: "warning" as const,
        message: `Título Vencido: O ativo ${r.ticker} atingiu a data de vencimento (${r.maturityDate ? formatIsoDateBR(r.maturityDate) : "—"}). Realize o resgate para voltar a rentabilizar seu capital.`,
      })),
  ];

  for (const row of portfolioRows) {
    if (row.isMatured || !row.maturityDate) continue;
    const diffDays = diffCalendarDays(row.maturityDate, todayISO);
    if (diffDays !== null && diffDays > 0 && diffDays <= 30) {
      warnings.push({
        id: `maturing-${row.assetId}`,
        variant: "warning",
        message: `Vencimento Próximo: O ativo ${row.ticker} vencerá em ${diffDays} dia(s) (${formatIsoDateBR(row.maturityDate)}). Planeje o reinvestimento do montante.`,
      });
    }
  }

  for (const row of portfolioRows) {
    const countdown = row.fixedIncomeResult?.taxCountdown;
    if (countdown && countdown.daysRemaining <= 30) {
      warnings.push({
        id: `tax-opt-${row.assetId}`,
        variant: "success",
        message: `Otimização Fiscal: A alíquota de IR de ${row.ticker} reduzirá para ${countdown.nextRatePct}% em ${countdown.daysRemaining} dia(s). Aguarde para resgatar com menor retenção.`,
      });
    }
  }

  for (const ew of emergencyWarnings) {
    warnings.push({
      id: ew.id,
      variant: "warning",
      message: ew.message,
    });
  }

  if (householdData && householdData.monthly_ceiling_cents > 0) {
    if (householdData.spent_percentage >= 100) {
      const excessCents = Math.max(0, householdData.total_spent_cents - householdData.monthly_ceiling_cents);
      warnings.push({
        id: "household-ceiling-exceeded",
        variant: "error",
        message: `Teto Familiar: A casa ultrapassou o teto estipulado em ${formatBRL(excessCents)} (${householdData.spent_percentage}% consumido).`,
      });
    } else if (householdData.spent_percentage >= 85) {
      warnings.push({
        id: "household-ceiling-warning",
        variant: "warning",
        message: `Teto Familiar: A casa consumiu ${householdData.spent_percentage}% do teto mensal. Faltam ${Math.max(0, daysInMonth - dayOfMonth)} dias para fechar a competência.`,
      });
    }
  }

  if (
    householdData &&
    !householdData.is_settled &&
    householdData.settlement &&
    householdData.settlement.amount_cents > 0
  ) {
    warnings.push({
      id: "household-settlement-pending",
      variant: "warning",
      message: `Acerto Familiar: Compensação Pix de ${formatBRL(householdData.settlement.amount_cents)} pendente no rateio do mês.`,
    });
  }

  return warnings;
}
