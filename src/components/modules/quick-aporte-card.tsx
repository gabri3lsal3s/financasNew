import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, ChevronRight, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import { MoneyText } from "@/components/ui/money-text";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";

export interface QuickAporteCardProps {
  className?: string;
  /**
   * Total de aportes já realizados no mês corrente em centavos.
   */
  currentMonthAporteCents?: number;
  /**
   * Sugestão de aporte ou sobra de caixa estimada em centavos (opcional).
   */
  suggestedAporteCents?: number;
  /**
   * Callback customizado ao simular o aporte direcionado (para testes ou modo controlado).
   */
  onSimulate?: (valorCents: number) => void;
  /**
   * Callback customizado ao navegar para a carteira completa.
   */
  onViewPortfolio?: () => void;
}

/**
 * Bloco de Aporte Rápido e Investimentos da Home (Fase 5 — Tarefa 5.4).
 *
 * Permite ao usuário informar o valor pretendido para aporte e navegar
 * diretamente para a calculadora de rebalanceamento hierárquico em lote
 * (`/investments?tab=aporte&valor=...`), com pré-carregamento automático.
 */
export function QuickAporteCard({
  className,
  currentMonthAporteCents = 0,
  suggestedAporteCents = 0,
  onSimulate,
  onViewPortfolio,
}: QuickAporteCardProps) {
  const navigate = useNavigate();
  const [aporteCents, setAporteCents] = useState<number>(0);

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    triggerSensory("action");

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
    if (suggestedAporteCents > 0) {
      setAporteCents(suggestedAporteCents);
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
        "flex flex-col gap-3.5 sm:gap-4 rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden",
        className,
      )}
    >
      {/* Cabeçalho do Bloco: Título à esquerda e Ação na lateral direita */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <TrendingUp className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <h2 className="text-sm font-semibold tracking-tight text-foreground truncate min-w-0">
            Investimentos do mês
          </h2>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleGoToPortfolio}
          aria-label="Ver carteira completa"
          className="h-7 gap-1 px-2 sm:px-2.5 text-xs font-medium text-foreground hover:bg-surface-hover cursor-pointer border-border/80 shrink-0"
        >
          <span className="hidden sm:inline">Ver carteira</span>
          <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
        </Button>
      </div>

      {/* Conteúdo: Resumo de Aportes Realizados e Aporte Rápido */}
      <div className="flex flex-col gap-3.5">
        <div className="flex items-end justify-between gap-2 pt-0.5">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[11px] font-medium text-muted-foreground">
              Aportes realizados no período
            </span>
            <MoneyText
              cents={currentMonthAporteCents}
              tone="portfolio"
              className="text-xl sm:text-2xl font-bold tracking-tight whitespace-nowrap tabular-nums"
            />
          </div>

          {suggestedAporteCents > 0 ? (
            <button
              type="button"
              onClick={handleUseSuggested}
              aria-label="Preencher com sugestão de aporte"
              className="inline-flex items-center gap-1.5 shrink-0 rounded-lg border border-portfolio/20 bg-portfolio/10 px-2 sm:px-2.5 py-1 text-xs font-medium text-portfolio hover:bg-portfolio/15 transition-colors cursor-pointer"
              title="Clique para preencher com a capacidade estimada de aporte"
            >
              <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Sugerido:</span>
              <MoneyText
                cents={suggestedAporteCents}
                tone="portfolio"
                className="font-bold tabular-nums"
              />
            </button>
          ) : null}
        </div>

        {/* Formulário de Ação Rápida: Input de Aporte + Botão de Rebalanceamento */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 pt-2.5 border-t border-border/60">
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
              variant="portfolio"
              size="default"
              aria-label="Calcular Rebalanceamento"
              className="h-10 gap-1.5 px-3 sm:px-4 shrink-0 font-medium cursor-pointer"
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
