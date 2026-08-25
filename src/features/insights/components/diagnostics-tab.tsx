import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Flame,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { SAVINGS_HEALTH_LABELS, WEEKEND_RATIO_LIMIT, type SavingsHealth } from "@/domain/insights";
import { DiagnosticCard } from "./diagnostic-card";

export interface WarningItem {
  id: string;
  variant: "warning" | "success";
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
}

export function DiagnosticsTab({
  warnings,
  expandedWarnings,
  setExpandedWarnings,
  health,
  savingsRate,
  burnRate,
  concentration,
  weekendComparable,
  weekendRatio,
  trendSignificant,
  trendPercent,
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
            <span className="text-[11px] text-muted-foreground">
              {expandedWarnings ? `${warnings.length} de ${warnings.length}` : `2 de ${warnings.length} alertas`}
            </span>
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
                onClick={() => setExpandedWarnings(!expandedWarnings)}
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

      {/* Bloco 2: Diagnóstico Financeiro (Grid 3x2 equilibrado) */}
      <section aria-label="Diagnóstico financeiro" className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Diagnóstico de Hábitos & Indicadores
        </h2>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 min-w-0">
          <DiagnosticCard
            icon={<PiggyBank className="size-4" aria-hidden="true" />}
            label="Saúde da poupança"
            value={SAVINGS_HEALTH_LABELS[health]}
            subtitle="Capacidade de poupar"
            tone={health === "forte" || health === "saudavel" ? "positive" : health === "moderado" ? "neutral" : "negative"}
          />
          <DiagnosticCard
            icon={<Zap className="size-4" aria-hidden="true" />}
            label="Taxa de poupança"
            value={`${savingsRate.toFixed(1)}%`}
            subtitle="Meta ideal: 20%+"
            tone={savingsRate >= 20 ? "positive" : savingsRate >= 0 ? "neutral" : "negative"}
          />
          <DiagnosticCard
            icon={<Flame className="size-4" aria-hidden="true" />}
            label="Taxa de consumo"
            value={`${burnRate.toFixed(0)}%`}
            subtitle="Despesas / Renda"
            tone={burnRate > 85 ? "negative" : burnRate > 70 ? "neutral" : "positive"}
          />
          <DiagnosticCard
            icon={<Wallet className="size-4" aria-hidden="true" />}
            label="Concentração de renda"
            value={`${concentration.topSharePercent.toFixed(0)}%`}
            subtitle="Na principal fonte"
            tone={concentration.alert ? "negative" : "positive"}
          />
          <DiagnosticCard
            icon={<Calendar className="size-4" aria-hidden="true" />}
            label="Gastos fim de semana"
            value={weekendComparable ? `${weekendRatio.toFixed(1)}×` : "—"}
            subtitle="vs. dias úteis"
            tone={weekendComparable ? (weekendRatio > WEEKEND_RATIO_LIMIT ? "negative" : "positive") : "neutral"}
          />
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
