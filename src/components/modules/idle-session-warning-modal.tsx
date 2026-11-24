import { Clock } from "lucide-react";
import { Button, Modal, ModalFooter } from "@/components/ui";

export interface IdleSessionWarningModalProps {
  open: boolean;
  secondsRemaining: number;
  onStayConnected: () => void;
  onSignOutNow: () => void;
}

/**
 * Modal de aviso prévio antes do encerramento automático de sessão por inatividade.
 * Segue estritamente Regras 15, 18 e 20 de AGENTS.md (zero autoFocus, zero emojis,
 * botão secundário à esquerda e CTA primário à direita).
 */
export function IdleSessionWarningModal({
  open,
  secondsRemaining,
  onStayConnected,
  onSignOutNow,
}: IdleSessionWarningModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onStayConnected();
        }
      }}
      size="sm"
      title="Sessão prestes a expirar"
      description="Nenhuma atividade recente foi detectada neste dispositivo."
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="outline"
            onClick={onSignOutNow}
          >
            Sair agora
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={onStayConnected}
          >
            Continuar conectado
          </Button>
        </ModalFooter>
      }
    >
      <div className="flex items-start gap-3 rounded-xl border border-warning/25 bg-warning/10 p-3.5">
        <Clock className="size-4 text-warning-strong mt-0.5 shrink-0" aria-hidden="true" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Para proteger sua conta, sua sessão será encerrada automaticamente em{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {secondsRemaining}s
          </span>
          . Deseja continuar conectado?
        </p>
      </div>
    </Modal>
  );
}
