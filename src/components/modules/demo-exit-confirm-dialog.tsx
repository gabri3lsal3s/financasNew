import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router";
import { Sparkles } from "lucide-react";
import { Button, Modal, ModalFooter } from "@/components/ui";
import { getTourHandoffDestination } from "@/domain/demo-simulation";
import { endDemo, markTourCompleted, useDemoSession } from "@/state/demo-mode";

export interface DemoExitConfirmDialogProps {
  /** Se o diálogo está aberto. */
  open: boolean;
  /** Callback acionado ao alterar a visibilidade do diálogo. */
  onOpenChange: (open: boolean) => void;
  /** Callback acionado quando o usuário confirma a saída do modo de demonstração. */
  onConfirm?: () => void;
  /** Callback acionado quando o usuário cancela e decide continuar explorando. */
  onCancel?: () => void;
  /** Título customizado opcional. */
  title?: string;
  /** Descrição customizada opcional. */
  description?: string;
  /** Rótulo do botão de confirmação. */
  confirmLabel?: string;
  /** Rótulo do botão de cancelamento. */
  cancelLabel?: string;
}

/**
 * Diálogo de Interceptação de Ação Real (DemoExitConfirmDialog).
 * Apresentado quando o usuário no modo de demonstração tenta cadastrar
 * um dado real (despesa, receita, cartão, ativo), orientando sobre a
 * saída da simulação em memória para a conta definitiva.
 */
export function DemoExitConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  title = "Sair da simulação e cadastrar dado real?",
  description = "Você está no modo de demonstração. Deseja sair da simulação e registrar seu primeiro lançamento real agora?",
  confirmLabel = "Confirmar (Cadastrar Dado Real)",
  cancelLabel = "Continuar Explorando",
}: DemoExitConfirmDialogProps) {
  const { activeTrack } = useDemoSession();
  const navigate = useNavigate();
  const location = useLocation();

  const handleCancel = useCallback(() => {
    onOpenChange(false);
    onCancel?.();
  }, [onCancel, onOpenChange]);

  const handleConfirm = useCallback(() => {
    if (activeTrack) {
      markTourCompleted(activeTrack);
    }
    endDemo();
    onOpenChange(false);
    if (onConfirm) {
      onConfirm();
    } else {
      const destination = getTourHandoffDestination(activeTrack, location.pathname);
      navigate(destination);
    }
  }, [activeTrack, location.pathname, navigate, onConfirm, onOpenChange]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      footer={
        <ModalFooter className="mt-0 pt-0 border-t-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            className="w-full sm:w-auto cursor-pointer"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleConfirm}
            className="w-full sm:w-auto font-semibold cursor-pointer"
          >
            {confirmLabel}
          </Button>
        </ModalFooter>
      }
    >
      <div className="py-2">
        <div className="flex items-start gap-2.5 rounded-lg border border-border/80 bg-surface-hover/40 p-3 text-xs text-muted-foreground">
          <Sparkles className="size-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden="true" />
          <p className="leading-relaxed">
            Ao confirmar, os dados de exemplo em memória serão desativados e você poderá
            iniciar os lançamentos legítimos na sua conta com total segurança.
          </p>
        </div>
      </div>
    </Modal>
  );
}
