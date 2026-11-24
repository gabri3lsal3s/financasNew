import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, ChevronRight, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import { MoneyText } from "@/components/ui/money-text";
import type { SurplusAllocationIntent } from "@/domain/overview";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";

export interface QuickAporteCardProps {
  className?: string;
  /** Total de aportes já realizados no mês corrente em centavos. */
  currentMonthAporteCents?: number;
  /** Sugestão de aporte ou sobra de caixa estimada em centavos (opcional). */
  suggestedAporteCents?: number;
  /** Direcionamento sugerido pela trava de reserva de emergência (Fase 3). */
  allocationIntent?: SurplusAllocationIntent;
  /** Parcela da sobra direcionada prioritariamente à reserva de emergência (centavos). */
  suggestedEmergencyAllocationCents?: number;
  /** Callback customizado ao simular o aporte direcionado (para testes ou modo controlado). */
  onSimulate?: (valorCents: number) => void;
  /** Callback customizado ao navegar para a carteira completa. */
  onViewPortfolio?: () => void;
}

/**
 * Bloco de Aporte Rápido e Investimentos da Home (Fase 5 — Tarefa 5.4 / Fase 3).
 */
export function QuickAporteCard({
  className,
  currentMonthAporteCents = 0,
  suggestedAporteCents = 0,
  allocationIntent = "portfolio_aporte",
  suggestedEmergencyAllocationCents,
  onSimulate,
  onViewPortfolio,
}: QuickAporteCardProps) {
  const navigate = useNavigate();
  const [aporteCents, setAporteCents] = useState<number>(0);

  const portfolioSuggestedCents =
    allocationIntent === "emergency_fund"
      ? Math.max(0, suggestedAporteCents - (suggestedEmergencyAllocationCents ?? suggestedAporteCents))
      : suggestedAporteCents;
  const shouldPrioritizeEmergency =
    allocationIntent === "emergency_fund" &&
    suggestedAporteCents > 0 &&
    portfolioSuggestedCents === 0;

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();

    if (onSimulate) {
      onSimulate(aporteCents);
      return;
    }

    if (aporteCents > 0) {
      navigate(`/investments?tab=aporte&valor=${aporteCents}`);
    } else {
      navigate("/investments?tab=aporte");
    }
  };

  const handleUseSuggested = () => {
    if (portfolioSuggestedCents > 0) {
      setAporteCents(portfolioSuggestedCents);
      triggerSensory("action");
    }
  };

  const handleGoToPortfolio = () => {
    if (onViewPortfolio) {
      onViewPortfolio();
    } else {
      navigate("/investments");
    }
  };

  return (
    <section
      aria-label="Investimentos e Aportes"
      className={cn(
        "flex flex-col gap-3.5 sm:gap-4 rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs min-w-0 overflow-hidden",
        className,
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <TrendingUp className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <h2 className="text-sm font-semibold tracking-tight text-foreground line-clamp-2 break-words min-w-0">
            Investimentos do mês
          </h2>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleGoToPortfolio}
          aria-label="Ver carteira completa"
          className="gap-1 px-2.5 text-xs font-medium text-foreground self-start sm:self-auto shrink-0"
        >
          <span>Ver carteira</span>
          <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
        </Button>
      </div>

      <div className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-end justify-between gap-2 pt-0.5">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[11px] font-medium text-muted-foreground">
              Aportes realizados no período
            </span>
            <MoneyText
              cents={currentMonthAporteCents}
              tone="portfolio"
              variant="hero"
              animated
              className="text-xl sm:text-2xl font-bold tracking-tight whitespace-nowrap tabular-nums"
            />
          </div>

          {portfolioSuggestedCents > 0 ? (
            <button
              type="button"
              onClick={handleUseSuggested}
              aria-label="Preencher com sugestão de aporte"
              className="relative inline-flex min-h-8 items-center gap-1.5 shrink-0 rounded-lg border border-portfolio/20 bg-portfolio/10 px-2.5 py-1 text-xs font-medium text-portfolio hover:bg-portfolio/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors cursor-pointer max-sm:after:absolute max-sm:after:-inset-2"
              title="Clique para preencher com a capacidade estimada de aporte"
            >
              <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Sugerido:</span>
              <MoneyText
                cents={portfolioSuggestedCents}
                tone="portfolio"
                className="font-bold tabular-nums"
              />
            </button>
          ) : shouldPrioritizeEmergency ? (
            <Button
              type="button"
              variant="positive"
              size="xs"
              onClick={() => navigate("/insights?aba=projection")}
              aria-label="Priorizar reserva de emergência"
              className="gap-1.5 shrink-0"
            >
              <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
              <span>Priorizar reserva</span>
            </Button>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2 pt-2.5 border-t border-border/80">
          <div className="flex flex-col gap-0.5">
            <label
              htmlFor="quick-aporte-input"
              className="text-xs font-semibold text-foreground"
            >
              Planejar novo aporte
            </label>
            <span className="text-[11px] text-muted-foreground leading-relaxed">
              Simule o rebalanceamento inteligente sem vender ativos.
            </span>
          </div>

          <div className="flex items-center gap-2 pt-0.5">
            <div className="flex-1 min-w-0">
              <MoneyInput
                id="quick-aporte-input"
                aria-label="Valor do aporte planejado"
                cents={aporteCents}
                onCentsChange={setAporteCents}
                placeholder="R$ 0,00"
                size="md"
                className="w-full"
              />
            </div>

            <Button
              type="submit"
              size="default"
              aria-label="Calcular Rebalanceamento"
              className="gap-1.5 px-3 sm:px-4 shrink-0 font-semibold rounded-xl"
            >
              <span className="hidden sm:inline">Calcular Rebalanceamento</span>
              <span className="sm:hidden">Calcular</span>
              <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
