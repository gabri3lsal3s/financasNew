import { Shield } from "lucide-react";
import { formatPercent } from "@/services/masks/percent";

export interface PortfolioConcentrationAlertProps {
  ticker?: string;
  pct: number;
}

export function PortfolioConcentrationAlert({ ticker, pct }: PortfolioConcentrationAlertProps) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-critical/25 bg-critical/5 p-4 text-xs text-foreground shadow-xs">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-xl border bg-critical/10 border-critical/20 text-critical-strong"
        aria-hidden="true"
      >
        <Shield className="size-4.5" />
      </span>
      <div className="flex flex-col gap-1 min-w-0">
        <span className="font-semibold text-critical-strong">Alerta de Concentração na Carteira</span>
        <span className="text-muted-foreground leading-relaxed">
          Seu maior ativo ({ticker}) representa{" "}
          <strong className="font-mono text-foreground tabular-nums">{formatPercent(pct)}%</strong> do
          patrimônio investido. Considere diversificar nos próximos aportes.
        </span>
      </div>
    </div>
  );
}
