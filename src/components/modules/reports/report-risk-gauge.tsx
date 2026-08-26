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

  const clampPosition = Math.min(Math.max(topItemPct, 4), 96);

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-xl border border-border/80 bg-muted/30 p-3.5 break-inside-avoid print:bg-white print:border-slate-200 shadow-2xs",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/70 pb-1.5">
        <div className="flex items-center gap-2">
          {isSafe ? (
            <ShieldCheck className="size-3.5 text-positive-strong" aria-hidden="true" />
          ) : (
            <ShieldAlert className="size-3.5 text-warning-strong" aria-hidden="true" />
          )}
          <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">
            {title}
          </span>
        </div>

        <span
          className={cn(
            "text-[10px] font-bold px-2 py-0.5 rounded-full border",
            isSafe && "bg-positive/10 border-positive/30 text-positive-strong",
            isWarning && "bg-warning/10 border-warning/30 text-warning-strong",
            isCritical && "bg-critical/10 border-critical/30 text-critical-strong",
          )}
        >
          {isSafe ? "Concentração Baixa" : isWarning ? "Concentração Moderada" : "Concentração Elevada"}
        </span>
      </div>

      {/* Barra de Zonas de Risco com Marcador */}
      <div className="relative flex flex-col gap-1 pt-3 pb-0.5">
        {/* Barra de Gradiente / Zonas */}
        <div className="relative h-2 w-full rounded-full overflow-hidden flex border border-border/80">
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
          <span className="text-[8px] font-mono font-bold px-1 py-0.5 rounded bg-foreground text-background leading-none shadow-2xs">
            {topItemPct.toFixed(1)}%
          </span>
          <span className="size-1 rotate-45 bg-foreground -mt-0.5" />
        </div>

        {/* Labels da Escala */}
        <div className="flex items-center justify-between text-[9px] text-muted-foreground font-mono num pt-0.5">
          <span>0%</span>
          <span>{warningThresholdPct}% (Atenção)</span>
          <span>{criticalThresholdPct}% (Crítico)</span>
          <span>100%</span>
        </div>
      </div>

      {/* Diagnóstico Contextual Neutro / Estatístico */}
      <p className="text-[11px] text-muted-foreground leading-snug">
        Maior ativo na carteira: <strong className="font-semibold text-foreground">{topItemName || "N/A"}</strong> representando{" "}
        <strong className="num font-mono font-bold text-foreground">{topItemPct.toFixed(1)}%</strong> do patrimônio total.
        {isSafe && " Concentração individual dentro do parâmetro de referência (≤ 15%)."}
        {isWarning && " Posição individual acima do patamar de referência de 15% do patrimônio total."}
        {isCritical && " Posição individual acima de 25% do patrimônio total."}
      </p>
    </div>
  );
}

