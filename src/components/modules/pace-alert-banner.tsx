import { ArrowRight, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { cn } from "@/lib/utils";

export interface PaceAlertBannerProps {
  /** % do orçamento já gasto (0–100+). */
  spentPercent: number;
  /** % do mês decorrido (0–100). */
  elapsedPercent: number;
  /** Valor diário disponível em centavos (ou null se indisponível). */
  dailyCents: number | null;
  /** Dias restantes no mês (ou null). */
  daysRemaining: number | null;
  /** Superávit/Déficit projetado em centavos (ou null). */
  surplusCents: number | null;
  /** Callback para navegar à tela de Insights/Projeção. */
  onNavigateInsights: () => void;
  className?: string;
}

/**
 * PaceAlertBanner — Banner contextual de atenção (§3.8) exibido na Visão Geral
 * quando o ritmo de gastos estiver acelerado ou houver déficit projetado.
 */
export function PaceAlertBanner({
  spentPercent,
  elapsedPercent,
  dailyCents,
  daysRemaining,
  surplusCents,
  onNavigateInsights,
  className,
}: PaceAlertBannerProps) {
  const isDeficit = surplusCents !== null && surplusCents < 0;

  return (
    <section
      aria-label="Atenção ao ritmo de gastos"
      className={cn(
        "w-full flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border p-4 sm:p-5 transition-all shadow-xs",
        isDeficit
          ? "border-critical/40 bg-critical/5 text-foreground"
          : "border-warning/40 bg-warning/5 text-foreground",
        className,
      )}
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl border",
            isDeficit
              ? "bg-critical/10 border-critical/20 text-critical-strong"
              : "bg-warning/10 border-warning/20 text-warning-strong",
          )}
        >
          <TrendingDown className="size-4.5" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-foreground">
              {isDeficit ? "Projeção de déficit no mês" : "Ritmo de gastos acima do previsto"}
            </h2>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                isDeficit
                  ? "bg-critical/15 text-critical-strong"
                  : "bg-warning/15 text-warning-strong",
              )}
            >
              Fora do trilho
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Você já consumiu{" "}
            <strong className="font-semibold text-foreground">{Math.round(spentPercent)}%</strong> do
            orçamento com{" "}
            <strong className="font-semibold text-foreground">{Math.round(elapsedPercent)}%</strong> do
            mês decorrido.
            {dailyCents !== null && dailyCents >= 0 && daysRemaining !== null && (
              <>
                {" "}
                Limite diário recomendado:{" "}
                <MoneyText cents={dailyCents} tone="default" className="font-semibold text-foreground" />{" "}
                ({daysRemaining} {daysRemaining === 1 ? "dia restante" : "dias restantes"}).
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center w-full sm:w-auto">
        <Button
          type="button"
          size="sm"
          variant={isDeficit ? "destructive" : "warning"}
          onClick={onNavigateInsights}
          className="gap-1.5 text-xs h-8 shrink-0 font-medium cursor-pointer w-full sm:w-auto justify-center"
        >
          <span>Simular cortes e projeção</span>
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}
