import { useCallback } from "react";
import { useNavigate } from "react-router";
import { Check, ChevronRight, TrendingUp, Wallet } from "lucide-react";
import { Badge, Button, Modal } from "@/components/ui";
import { triggerSensory } from "@/services/sensory";
import type { TourTrackId } from "@/domain/demo-simulation";
import { hasCompletedDemoTour, startDemo } from "@/state/demo-mode";

export interface DemoTrackSelectModalProps {
  /** Se o diálogo seletor de trilha está visível. */
  open: boolean;
  /** Callback acionado ao alterar a visibilidade do modal. */
  onOpenChange: (open: boolean) => void;
  /** Callback opcional acionado quando o usuário seleciona e inicia uma trilha. */
  onSelectTrack?: (track: TourTrackId) => void;
  /** Callback opcional acionado quando o usuário decide pular a simulação e ir para a conta real. */
  onSkipToReal?: () => void;
}

/**
 * Modal de Seleção de Trilha do Tour Interativo (DemoTrackSelectModal).
 * Permite ao usuário escolher entre a trilha de Finanças Diárias & Cartões
 * ou a trilha de Investimentos & Rebalanceamento, com dados simulados em memória.
 */
export function DemoTrackSelectModal({
  open,
  onOpenChange,
  onSelectTrack,
  onSkipToReal,
}: DemoTrackSelectModalProps) {
  const navigate = useNavigate();

  const handleSelectTrack = useCallback(
    (track: TourTrackId) => {
      triggerSensory("action");
      startDemo(track);
      if (track === "finances") {
        navigate("/");
      } else {
        navigate("/investimentos");
      }
      onSelectTrack?.(track);
      onOpenChange(false);
    },
    [navigate, onOpenChange, onSelectTrack],
  );

  const handleSkip = useCallback(() => {
    onOpenChange(false);
    if (onSkipToReal) {
      onSkipToReal();
    } else {
      navigate("/?novo=despesa");
    }
  }, [navigate, onOpenChange, onSkipToReal]);

  const financesCompleted = hasCompletedDemoTour("finances");
  const investmentsCompleted = hasCompletedDemoTour("investments");

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Escolha sua Trilha de Demonstração"
      description="Explore os recursos do aplicativo com dados simulados em memória, sem alterar sua conta real."
      size="md"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 w-full">
          <Button
            type="button"
            variant="ghost"
            onClick={handleSkip}
            className="w-full sm:w-auto text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Pular tour e ir para conta real
          </Button>
        </div>
      }
    >
      <div className="space-y-3 py-2" role="group" aria-label="Trilhas de demonstração disponíveis">
        {/* Opção 1: Finanças Diárias & Cartões */}
        <button
          type="button"
          onClick={() => handleSelectTrack("finances")}
          className="w-full text-left p-4 rounded-xl border border-border/80 hover:border-primary/50 bg-surface/50 hover:bg-surface-hover/70 transition-all flex items-start gap-3.5 group cursor-pointer shadow-xs focus:outline-hidden focus:ring-2 focus:ring-primary/20"
        >
          <div className="size-9 rounded-lg border border-border/80 bg-surface flex items-center justify-center shrink-0 text-positive-strong group-hover:scale-105 transition-transform shadow-2xs">
            <Wallet className="size-5" aria-hidden="true" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                Finanças Diárias & Cartões
              </h4>
              {financesCompleted ? (
                <Badge variant="positive" size="xs" className="gap-1 shrink-0">
                  <Check className="size-3" aria-hidden="true" />
                  <span>Concluído</span>
                </Badge>
              ) : (
                <Badge variant="muted" size="xs" className="shrink-0">
                  4 passos
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Explore entradas, saídas, faturas automáticas e limites de gastos.
            </p>
          </div>

          <ChevronRight
            className="size-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 self-center"
            aria-hidden="true"
          />
        </button>

        {/* Opção 2: Investimentos & Rebalanceamento */}
        <button
          type="button"
          onClick={() => handleSelectTrack("investments")}
          className="w-full text-left p-4 rounded-xl border border-border/80 hover:border-primary/50 bg-surface/50 hover:bg-surface-hover/70 transition-all flex items-start gap-3.5 group cursor-pointer shadow-xs focus:outline-hidden focus:ring-2 focus:ring-primary/20"
        >
          <div className="size-9 rounded-lg border border-border/80 bg-surface flex items-center justify-center shrink-0 text-portfolio group-hover:scale-105 transition-transform shadow-2xs">
            <TrendingUp className="size-5" aria-hidden="true" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                Investimentos & Rebalanceamento
              </h4>
              {investmentsCompleted ? (
                <Badge variant="positive" size="xs" className="gap-1 shrink-0">
                  <Check className="size-3" aria-hidden="true" />
                  <span>Concluído</span>
                </Badge>
              ) : (
                <Badge variant="muted" size="xs" className="shrink-0">
                  3 passos
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Conheça a visão patrimonial, alocação de classes e motor de aportes.
            </p>
          </div>

          <ChevronRight
            className="size-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 self-center"
            aria-hidden="true"
          />
        </button>
      </div>
    </Modal>
  );
}
