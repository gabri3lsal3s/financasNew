import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Flame,
  PiggyBank,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Alert, Badge, Button } from "@/components/ui";
import {
  ESSENTIAL_STATUS_LABELS,
  SAVINGS_HEALTH_LABELS,
  WEEKEND_RATIO_LIMIT,
  type EssentialSpendingResult,
  type SavingsHealth,
} from "@/domain/insights";
import { DiagnosticCard } from "./diagnostic-card";

export interface WarningItem {
  id: string;
  variant: "warning" | "success" | "error";
  message: string;
}

export interface DiagnosticsTabProps {
  warnings: WarningItem[];
  expandedWarnings: boolean;
  setExpandedWarnings: (val: boolean | ((prev: boolean) => boolean)) => void;
  health: SavingsHealth;
  savingsRate: number;
  burnRate: number;
  concentration: { topSharePercent: number; alert: boolean };
  weekendComparable: boolean;
  weekendRatio: number;
  trendSignificant: boolean;
  trendPercent: number;
  overspentBudgets?: number;
  essentialSpending?: EssentialSpendingResult;
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
  trendSignificant,
  trendPercent,
  overspentBudgets = 0,
  essentialSpending,
}: DiagnosticsTabProps) {
  return (
    <div className="flex flex-col gap-6 min-w-0">
      {/* Bloco 1: Avisos e Recomendações Imediatas */}
      <section aria-label="Avisos e recomendações" className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Avisos & Recomendações
          </h2>
          {warnings.length > 2 && (
            <Badge size="xs" variant="muted">
              {expandedWarnings ? `${warnings.length} de ${warnings.length}` : `2 de ${warnings.length} alertas`}
            </Badge>
          )}
        </div>
        {warnings.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-positive/30 bg-positive/5 p-4 text-xs">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-positive/10 text-positive-strong">
              <CheckCircle2 className="size-4" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-0.5">
              <p className="font-medium text-foreground">Nenhum aviso no momento.</p>
              <p className="text-muted-foreground">Seu ritmo de gastos e orçamentos estão equilibrados neste mês.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {(expandedWarnings ? warnings : warnings.slice(0, 2)).map((w) => (
              <Alert key={w.id} variant={w.variant}>
                {w.message}
              </Alert>
            ))}
            {warnings.length > 2 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setExpandedWarnings((prev) => !prev);
                }}
                className="self-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mt-0.5"
              >
                {expandedWarnings ? (
                  <>
                    <ChevronUp className="size-3.5" aria-hidden="true" />
                    <span>Mostrar menos alertas</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-3.5" aria-hidden="true" />
                    <span>Ver mais {warnings.length - 2} {warnings.length - 2 === 1 ? "alerta" : "alertas"}</span>
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </section>

      {/* Bloco 2: Diagnóstico Financeiro */}
      <section aria-label="Diagnóstico financeiro" className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Diagnóstico de Hábitos & Indicadores
        </h2>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 min-w-0">
          {/* Card 1: Saúde da Poupança & Taxa unificadas */}
          <DiagnosticCard
            icon={<PiggyBank className="size-4" aria-hidden="true" />}
            label="Saúde da poupança"
            value={`${savingsRate.toFixed(1)}%`}
            subtitle="Capacidade de poupar"
            tone={health === "forte" || health === "saudavel" ? "positive" : health === "moderado" ? "neutral" : "negative"}
            badge={
              <Badge
                variant={health === "forte" || health === "saudavel" ? "positive" : health === "moderado" ? "warning" : "critical"}
                size="xs"
              >
                {SAVINGS_HEALTH_LABELS[health]}
              </Badge>
            }
          />

          {/* Card 2: Orçamentos em Risco / Estourados */}
          <DiagnosticCard
            icon={<Flame className="size-4" aria-hidden="true" />}
            label="Orçamentos estourados"
            value={overspentBudgets === 0 ? "Em dia" : `${overspentBudgets} ${overspentBudgets === 1 ? "estouro" : "estouros"}`}
            subtitle={overspentBudgets === 0 ? "Todas categorias no teto" : "Excederam o limite"}
            tone={overspentBudgets === 0 ? "positive" : "negative"}
          />

          {/* Card 3: Concentração de renda */}
          <DiagnosticCard
            icon={<Wallet className="size-4" aria-hidden="true" />}
            label="Concentração de renda"
            value={`${concentration.topSharePercent.toFixed(0)}%`}
            subtitle={concentration.alert ? "Alta dependência" : "Fonte principal"}
            tone={concentration.alert ? "negative" : "neutral"}
          />

          {/* Card 4: Gastos no fim de semana */}
          <DiagnosticCard
            icon={<Calendar className="size-4" aria-hidden="true" />}
            label="Gastos fim de semana"
            value={weekendComparable ? `${weekendRatio.toFixed(1)}×` : "—"}
            subtitle="vs. dias úteis"
            tone={weekendComparable ? (weekendRatio > WEEKEND_RATIO_LIMIT ? "negative" : "positive") : "neutral"}
          />

          {/* Card 5: Comprometimento Essencial (Regra 50/30/20) */}
          <DiagnosticCard
            icon={<ShieldCheck className="size-4" aria-hidden="true" />}
            label="Gastos essenciais"
            value={essentialSpending ? `${essentialSpending.ratioPercent.toFixed(0)}%` : "—"}
            subtitle="Teto ideal: até 50%"
            tone={
              essentialSpending
                ? essentialSpending.status === "adequado"
                  ? "positive"
                  : essentialSpending.status === "moderado"
                    ? "neutral"
                    : "negative"
                : "neutral"
            }
            badge={
              essentialSpending ? (
                <Badge
                  variant={
                    essentialSpending.status === "adequado"
                      ? "positive"
                      : essentialSpending.status === "moderado"
                        ? "warning"
                        : "critical"
                  }
                  size="xs"
                >
                  {ESSENTIAL_STATUS_LABELS[essentialSpending.status]}
                </Badge>
              ) : null
            }
          />

          {/* Card 6: Tendência histórica de gastos */}
          <DiagnosticCard
            icon={trendPercent >= 0 ? <TrendingUp className="size-4" aria-hidden="true" /> : <TrendingDown className="size-4" aria-hidden="true" />}
            label="Tendência de gastos"
            value={`${trendPercent >= 0 ? "+" : ""}${trendPercent.toFixed(1)}%`}
            subtitle="vs. mês anterior"
            tone={trendSignificant ? (trendPercent > 0 ? "negative" : "positive") : "neutral"}
          />
        </div>
      </section>
    </div>
  );
}
