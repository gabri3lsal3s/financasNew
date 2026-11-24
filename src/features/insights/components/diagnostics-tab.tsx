import {
  Calendar,
  Flame,
  PiggyBank,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui";
import {
  ESSENTIAL_STATUS_LABELS,
  SAVINGS_HEALTH_LABELS,
  WEEKEND_RATIO_LIMIT,
  type EssentialSpendingResult,
  type SavingsHealth,
} from "@/domain/insights";
import { formatPercent, formatSignedPct } from "@/services/masks";
import { DiagnosticCard } from "./diagnostic-card";
import { DiagnosticsWarningsSection } from "./DiagnosticsWarningsSection";

export interface WarningItem {
  id: string;
  variant: "warning" | "success" | "error" | "info";
  message: string;
}

export interface DiagnosticsTabProps {
  warnings: WarningItem[];
  expandedWarnings: boolean;
  setExpandedWarnings: (val: boolean | ((prev: boolean) => boolean)) => void;
  health: SavingsHealth;
  savingsRate: number;
  concentration: { topSharePercent: number; alert: boolean };
  weekendComparable: boolean;
  weekendRatio: number;
  trendHasPreviousBase?: boolean;
  trendSignificant: boolean;
  trendPercent: number;
  overspentBudgets?: number;
  essentialSpending?: EssentialSpendingResult;
  hasTransactions?: boolean;
  hasIncome?: boolean;
}

export function DiagnosticsTab({
  warnings,
  expandedWarnings,
  setExpandedWarnings,
  health,
  savingsRate,
  concentration,
  weekendComparable,
  weekendRatio,
  trendHasPreviousBase = true,
  trendSignificant,
  trendPercent,
  overspentBudgets = 0,
  essentialSpending,
  hasTransactions,
  hasIncome = true,
}: DiagnosticsTabProps) {
  return (
    <div className="flex flex-col gap-6 min-w-0">
      <DiagnosticsWarningsSection
        warnings={warnings}
        expandedWarnings={expandedWarnings}
        setExpandedWarnings={setExpandedWarnings}
        hasTransactions={hasTransactions}
      />

      <section aria-label="Diagnóstico financeiro" className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Diagnóstico de Hábitos &amp; Indicadores
        </h2>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 min-w-0">
          <DiagnosticCard
            icon={<PiggyBank className="size-4" aria-hidden="true" />}
            label="Saúde da poupança"
            value={health === "indefinido" || !hasIncome ? "—" : `${formatPercent(savingsRate)}%`}
            subtitle={health === "indefinido" || !hasIncome ? "Aguardando renda" : "Capacidade de poupar"}
            tone={
              health === "indefinido" || !hasIncome
                ? "neutral"
                : health === "forte" || health === "saudavel"
                  ? "positive"
                  : health === "moderado"
                    ? "neutral"
                    : "negative"
            }
            badge={
              <Badge
                variant={
                  health === "indefinido" || !hasIncome
                    ? "muted"
                    : health === "forte" || health === "saudavel"
                      ? "positive"
                      : health === "moderado"
                        ? "warning"
                        : "critical"
                }
                size="xs"
                className="max-w-full truncate"
              >
                {SAVINGS_HEALTH_LABELS[health]}
              </Badge>
            }
          />

          <DiagnosticCard
            icon={<Flame className="size-4" aria-hidden="true" />}
            label="Orçamentos estourados"
            value={
              overspentBudgets === 0
                ? "Em dia"
                : `${overspentBudgets} ${overspentBudgets === 1 ? "estouro" : "estouros"}`
            }
            subtitle={overspentBudgets === 0 ? "Todas categorias no teto" : "Excederam o limite"}
            tone={overspentBudgets === 0 ? "positive" : "negative"}
          />

          <DiagnosticCard
            icon={<Wallet className="size-4" aria-hidden="true" />}
            label="Concentração de renda"
            value={!hasIncome ? "—" : `${concentration.topSharePercent.toFixed(0)}%`}
            subtitle={!hasIncome ? "Aguardando renda" : concentration.alert ? "Alta dependência" : "Fonte principal"}
            tone={!hasIncome ? "neutral" : concentration.alert ? "negative" : "neutral"}
          />

          <DiagnosticCard
            icon={<Calendar className="size-4" aria-hidden="true" />}
            label="Gastos fim de semana"
            value={weekendComparable ? `${formatPercent(weekendRatio)}×` : "—"}
            subtitle="vs. dias úteis"
            tone={
              weekendComparable
                ? weekendRatio > WEEKEND_RATIO_LIMIT
                  ? "negative"
                  : "positive"
                : "neutral"
            }
          />

          <DiagnosticCard
            icon={<ShieldCheck className="size-4" aria-hidden="true" />}
            label="Gastos essenciais"
            value={
              !essentialSpending
                ? "—"
                : essentialSpending.status === "em_formacao" || !essentialSpending.hasCriticalMass
                  ? "Em formação"
                  : `${essentialSpending.ratioPercent.toFixed(0)}%`
            }
            subtitle={
              essentialSpending?.status === "em_formacao"
                ? "Mín. 3 lançamentos"
                : "Teto ideal: até 50%"
            }
            tone={
              !essentialSpending || essentialSpending.status === "em_formacao" || !essentialSpending.hasCriticalMass
                ? "neutral"
                : essentialSpending.status === "adequado"
                  ? "positive"
                  : essentialSpending.status === "moderado"
                    ? "neutral"
                    : "negative"
            }
            badge={
              essentialSpending ? (
                <Badge
                  variant={
                    essentialSpending.status === "em_formacao" || !essentialSpending.hasCriticalMass
                      ? "muted"
                      : essentialSpending.status === "adequado"
                        ? "positive"
                        : essentialSpending.status === "moderado"
                          ? "warning"
                          : "critical"
                  }
                  size="xs"
                  className="max-w-full truncate"
                >
                  {ESSENTIAL_STATUS_LABELS[essentialSpending.status]}
                </Badge>
              ) : null
            }
          />

          <DiagnosticCard
            icon={
              !trendHasPreviousBase || trendPercent >= 0 ? (
                <TrendingUp className="size-4" aria-hidden="true" />
              ) : (
                <TrendingDown className="size-4" aria-hidden="true" />
              )
            }
            label="Tendência de gastos"
            value={trendHasPreviousBase ? formatSignedPct(trendPercent) : "Sem base anterior"}
            subtitle="vs. mês anterior"
            tone={trendHasPreviousBase && trendSignificant ? (trendPercent > 0 ? "negative" : "positive") : "neutral"}
          />
        </div>
      </section>
    </div>
  );
}
