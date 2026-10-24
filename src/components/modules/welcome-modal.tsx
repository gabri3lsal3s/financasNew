import { useCallback, useState } from "react";
import { ArrowUpDown, Compass, CreditCard, Sparkles, TrendingUp } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { hasSeenWelcomeModal, markWelcomeModalSeen } from "@/state/demo-mode";

export interface WelcomeModalProps {
  /** Controle externo de visibilidade (opcional). Se omitido, deriva de hasSeenWelcomeModal(). */
  open?: boolean;
  /** Callback acionado ao alterar o estado de abertura do modal. */
  onOpenChange?: (open: boolean) => void;
  /** Callback acionado quando o usuário escolhe fazer o tour demonstrativo guiado. */
  onStartTour?: () => void;
  /** Callback acionado quando o usuário escolhe ir direto para a configuração da conta real. */
  onStartRealAccount?: () => void;
  /** Força a exibição ignorando a flag salva no localStorage. */
  forceShow?: boolean;
}

/**
 * Diálogo de Boas-Vindas no Primeiro Acesso do Usuário (WelcomeModal).
 * Apresentado para orientar o novo usuário sobre os pilares da plataforma
 * (controle de fluxo diário, cartões inteligentes e carteira de investimentos),
 * oferecendo a escolha entre fazer um tour guiado de 2 minutos com dados simulados
 * em memória ou iniciar a configuração direta da sua conta real.
 */
export function WelcomeModal({
  open,
  onOpenChange,
  onStartTour,
  onStartRealAccount,
  forceShow = false,
}: WelcomeModalProps) {
  const [internalOpen, setInternalOpen] = useState<boolean>(() => {
    if (forceShow) return true;
    if (open !== undefined) return open;
    return !hasSeenWelcomeModal();
  });

  const isVisible = open !== undefined ? open : internalOpen;

  const handleClose = useCallback(() => {
    markWelcomeModalSeen();
    setInternalOpen(false);
    onOpenChange?.(false);
  }, [onOpenChange]);

  const handleStartTour = useCallback(() => {
    handleClose();
    onStartTour?.();
  }, [handleClose, onStartTour]);

  const handleStartRealAccount = useCallback(() => {
    handleClose();
    onStartRealAccount?.();
  }, [handleClose, onStartRealAccount]);

  if (!isVisible) return null;

  return (
    <Modal
      open={isVisible}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleClose();
        } else {
          setInternalOpen(true);
          onOpenChange?.(true);
        }
      }}
      title="Boas-vindas ao seu novo centro financeiro"
      description="Sua plataforma unificada para controle de fluxo diário, faturas de cartão e estratégia patrimonial."
      size="md"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 w-full">
          <Button
            type="button"
            variant="outline"
            onClick={handleStartRealAccount}
            className="w-full sm:w-auto cursor-pointer"
          >
            Configurar Minha Conta Agora
          </Button>

          <Button
            type="button"
            variant="default"
            onClick={handleStartTour}
            className="w-full sm:w-auto gap-2 cursor-pointer font-semibold"
          >
            <Compass className="size-4 shrink-0" aria-hidden="true" />
            <span>Fazer Tour Rápido (2 min)</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-2">
        <div className="space-y-2.5">
          {/* Pilar 1: Fluxo Diário */}
          <div className="flex items-start gap-3 rounded-lg border border-border/80 bg-surface/40 p-3 transition-colors">
            <ArrowUpDown
              className="size-4 shrink-0 text-positive-strong mt-0.5"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <h4 className="text-xs sm:text-sm font-semibold text-foreground">
                Controle de Fluxo Diário
              </h4>
              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                Acompanhe receitas, despesas e seu saldo real do mês com previsibilidade e clareza total.
              </p>
            </div>
          </div>

          {/* Pilar 2: Cartões Inteligentes */}
          <div className="flex items-start gap-3 rounded-lg border border-border/80 bg-surface/40 p-3 transition-colors">
            <CreditCard
              className="size-4 shrink-0 text-muted-foreground mt-0.5"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <h4 className="text-xs sm:text-sm font-semibold text-foreground">
                Cartões Inteligentes
              </h4>
              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                Faturas automáticas, competências precisas e controle do melhor dia de compra sem surpresas.
              </p>
            </div>
          </div>

          {/* Pilar 3: Carteira & Rebalanceamento */}
          <div className="flex items-start gap-3 rounded-lg border border-border/80 bg-surface/40 p-3 transition-colors">
            <TrendingUp
              className="size-4 shrink-0 text-portfolio mt-0.5"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <h4 className="text-xs sm:text-sm font-semibold text-foreground">
                Carteira & Rebalanceamento
              </h4>
              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                Defina metas percentuais por classe e calcule seus aportes ideais de forma matemática.
              </p>
            </div>
          </div>
        </div>

        {/* Nota explicativa contextual da simulação */}
        <div className="flex items-start gap-2.5 rounded-lg border border-border/80 bg-surface-hover/40 p-3 text-xs text-muted-foreground">
          <Sparkles className="size-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden="true" />
          <p className="leading-relaxed">
            Experimente todos os recursos com dados simulados em memória sem alterar sua conta real.
            Você pode transicionar para sua conta limpa a qualquer momento.
          </p>
        </div>
      </div>
    </Modal>
  );
}
