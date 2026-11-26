import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { ResponsiveLabel } from "@/components/ui/responsive-label";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Conteúdo extra entre a descrição e os botões (ex.: seleção de modo). */
  children?: ReactNode;
  confirmLabel?: string;
  /** Rótulo compacto exibido no mobile (< sm) quando `confirmLabel` for extenso. */
  confirmShortLabel?: string;
  /** Ícone opcional exibido ao lado do rótulo de confirmação quando não estiver pendente. */
  confirmIcon?: ReactNode;
  cancelLabel?: string;
  /** Rótulo compacto exibido no mobile (< sm) quando `cancelLabel` for extenso. */
  cancelShortLabel?: string;
  variant?: "default" | "destructive";
  confirmPending?: boolean;
  /** Sobe o z-index do diálogo de confirmação quando aberto sobre outro modal pai. */
  elevated?: boolean;
  onConfirm: () => void;
}

/** Confirmação destrutiva/não-destrutiva — substitui `confirm()` nativo (DESIGN_SYSTEM §13). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel = "Confirmar",
  confirmShortLabel,
  confirmIcon,
  cancelLabel = "Cancelar",
  cancelShortLabel,
  variant = "default",
  confirmPending = false,
  elevated = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (next || !confirmPending) onOpenChange(next);
      }}
      title={title}
      description={description}
      size="sm"
      elevated={elevated}
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="outline"
            disabled={confirmPending}
            onClick={() => onOpenChange(false)}
          >
            {cancelShortLabel ? (
              <ResponsiveLabel short={cancelShortLabel} full={cancelLabel} />
            ) : (
              cancelLabel
            )}
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            loading={confirmPending}
            sensoryIntent={variant === "destructive" ? "destructive" : "success"}
            onClick={onConfirm}
          >
            {!confirmPending && confirmIcon ? confirmIcon : null}
            {confirmShortLabel ? (
              <ResponsiveLabel short={confirmShortLabel} full={confirmLabel} />
            ) : (
              confirmLabel
            )}
          </Button>
        </ModalFooter>
      }
    >
      {children ? <div className="py-2">{children}</div> : null}
    </Modal>
  );
}
