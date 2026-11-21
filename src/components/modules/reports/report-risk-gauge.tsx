import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatPercent } from "@/services/masks/percent";
import { cn } from "@/lib/utils";

export interface ReportRiskGaugeProps {
  title?: string;
  topItemName: string;
  topItemPct: number;
  warningThresholdPct?: number;
  criticalThresholdPct?: number;
  className?: string;
}

/**
 * Termômetro de Concentração & Gestão de Risco para Relatórios A4 / PDF.
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

  // Escala calibrada com limite superior de 40%+ para máxima legibilidade do quadrante de decisão
  const maxScalePct = 40;
  const safeWidthPct = (warningThresholdPct / maxScalePct) * 100; // 37.5%
  const warningWidthPct = ((criticalThresholdPct - warningThresholdPct) / maxScalePct) * 100; // 25.0%
  const criticalWidthPct = 100 - safeWidthPct - warningWidthPct; // 37.5%

  const pinPct = (topItemPct / maxScalePct) * 100;
  const clampPosition = Math.min(Math.max(pinPct, 4), 96);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border/80 bg-muted/30 p-4 sm:p-5 print:p-3 print:gap-1.5 break-inside-avoid print:bg-surface print:border-border shadow-xs",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 pb-2 print:pb-1">
        <div className="flex items-center gap-2 min-w-0">
          {isSafe ? (
            <ShieldCheck className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
          ) : (
            <ShieldAlert className="size-4 text-warning-strong shrink-0" aria-hidden="true" />
          )}
          <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
            {title}
          </span>
        </div>

        <Badge
          size="xs"
          variant={isSafe ? "positive" : isWarning ? "warning" : "critical"}
          className="font-bold shrink-0"
        >
          {isSafe ? "Concentração Baixa" : isWarning ? "Concentração Moderada" : "Concentração Elevada"}
        </Badge>
      </div>

      <div className="relative flex flex-col gap-1.5 pt-4 pb-1 print:pt-2.5 print:pb-0.5">
        <div className="relative h-2 w-full rounded-full overflow-hidden flex border border-border/80 bg-muted/20">
          <div
            style={{ width: `${safeWidthPct}%` }}
            className="h-full bg-positive-strong border-r-2 border-white dark:border-surface"
            title="Zona Segura"
          />
          <div
            style={{ width: `${warningWidthPct}%` }}
            className="h-full bg-warning-strong border-r-2 border-white dark:border-surface"
            title="Zona de Atenção"
          />
          <div
            style={{ width: `${criticalWidthPct}%` }}
            className="h-full bg-critical-strong"
            title="Zona Crítica"
          />
        </div>

        <div
          className="absolute top-0 transform -translate-x-1/2 flex flex-col items-center pointer-events-none z-10"
          style={{ left: `${clampPosition}%` }}
        >
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-foreground text-background leading-none shadow-xs tabular-nums whitespace-nowrap">
            {formatPercent(topItemPct)}%
          </span>
          <span className="size-1 rotate-45 bg-foreground -mt-0.5" />
        </div>

        <div className="relative h-4 w-full text-[10px] text-muted-foreground font-mono num tabular-nums pt-0.5">
          <span className="absolute left-0">0%</span>
          <span
            className="absolute transform -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${safeWidthPct}%` }}
          >
            {warningThresholdPct}% (Atenção)
          </span>
          <span
            className="absolute transform -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${safeWidthPct + warningWidthPct}%` }}
          >
            {criticalThresholdPct}% (Crítico)
          </span>
          <span className="absolute right-0">40%+</span>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground leading-snug pt-0.5 print:text-foreground">
        Maior ativo na carteira: <strong className="font-semibold text-foreground">{topItemName || "N/A"}</strong>{" "}
        representando <strong className="num font-mono font-bold text-foreground tabular-nums">{formatPercent(topItemPct)}%</strong> do patrimônio total.
        {isSafe && " Concentração individual dentro do parâmetro de referência (até 15%)."}
        {isWarning && " Posição individual acima do patamar de referência de 15% do patrimônio total."}
        {isCritical && " Posição individual acima de 25% do patrimônio total."}
      </p>
    </div>
  );
}
