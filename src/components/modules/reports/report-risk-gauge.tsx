import { ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReportRiskGaugeProps {
  title?: string;
  /** Nome ou ticker do ativo mais concentrado. */
  topItemName: string;
  /** % de concentração do maior item (0-100). */
  topItemPct: number;
  /** Limite de atenção em % (padrão: 15%). */
  warningThresholdPct?: number;
  /** Limite crítico em % (padrão: 25%). */
  criticalThresholdPct?: number;
  className?: string;
}

/**
 * Termômetro de Concentração & Gestão de Risco para Relatórios A4 / PDF.
 *
 * Exibe a escala com 3 zonas semânticas (Verde, Âmbar, Vermelho)
 * e o marcador do ativo ou classe mais concentrada da carteira.
 */
export function ReportRiskGauge({
  title = "Termômetro de Concentração & Risco",
  topItemName,
  topItemPct,
  warningThresholdPct = 15,
  criticalThresholdPct = 25,
  className,
}: ReportRiskGaugeProps) {
  const isCritical = topItemPct >= criticalThresholdPct;
  const isWarning = !isCritical && topItemPct >= warningThresholdPct;
  const isSafe = !isCritical && !isWarning;

  const clampPosition = Math.min(Math.max(topItemPct, 0), 100);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border/80 bg-muted/10 p-4 break-inside-avoid print:bg-white print:border-border",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isSafe ? (
            <ShieldCheck className="size-4 text-positive-strong" aria-hidden="true" />
          ) : (
            <ShieldAlert className="size-4 text-warning-strong" aria-hidden="true" />
          )}
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
            {title}
          </span>
        </div>

        <span
          className={cn(
            "text-xs font-bold px-2 py-0.5 rounded-full border",
            isSafe && "bg-positive/10 border-positive/30 text-positive-strong",
            isWarning && "bg-warning/10 border-warning/30 text-warning-strong",
            isCritical && "bg-critical/10 border-critical/30 text-critical-strong",
          )}
        >
          {isSafe ? "Diversificação Saudável" : isWarning ? "Atenção (Concentração Moderada)" : "Alerta de Sobrepeso"}
        </span>
      </div>

      {/* Barra de Zonas de Risco com Marcador */}
      <div className="relative flex flex-col gap-1 pt-4 pb-1">
        {/* Barra de Gradiente / Zonas */}
        <div className="relative h-2.5 w-full rounded-full overflow-hidden flex border border-border/80">
          <div style={{ width: `${warningThresholdPct}%` }} className="h-full bg-positive-strong" title="Zona Segura" />
          <div
            style={{ width: `${criticalThresholdPct - warningThresholdPct}%` }}
            className="h-full bg-warning-strong"
            title="Zona de Atenção"
          />
          <div
            style={{ width: `${100 - criticalThresholdPct}%` }}
            className="h-full bg-critical-strong"
            title="Zona Crítica"
          />
        </div>

        {/* Marcador do Maior Ativo com indicador e valor */}
        <div
          className="absolute top-0 transform -translate-x-1/2 flex flex-col items-center pointer-events-none z-10"
          style={{ left: `${clampPosition}%` }}
        >
          <span className="text-[8px] font-mono font-bold px-1 py-0.5 rounded bg-foreground text-surface leading-none shadow-2xs">
            {topItemPct.toFixed(1)}%
          </span>
          <span className="size-1 rotate-45 bg-foreground -mt-0.5" />
        </div>

        {/* Labels da Escala */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono num pt-1">
          <span>0%</span>
          <span>{warningThresholdPct}% (Atenção)</span>
          <span>{criticalThresholdPct}% (Crítico)</span>
          <span>100%</span>
        </div>
      </div>

      {/* Diagnóstico Contextual */}
      <p className="text-xs text-muted-foreground leading-relaxed">
        Maior ativo na carteira: <strong className="font-semibold text-foreground">{topItemName}</strong> representando{" "}
        <strong className="num font-mono font-bold text-foreground">{topItemPct.toFixed(1)}%</strong> do patrimônio total.
        {isSafe && " A carteira possui excelente distribuição de risco individual."}
        {isWarning && " Recomendado direcionar novos aportes para outras classes/ativos para diluir o peso."}
        {isCritical && " Alerta de alta dependência sobre um único ativo."}
      </p>
    </div>
  );
}
