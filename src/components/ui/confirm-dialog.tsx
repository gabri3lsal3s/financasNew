import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Conteúdo extra entre a descrição e os botões (ex.: seleção de modo). */
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
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
  cancelLabel = "Cancelar",
  variant = "default",
  confirmPending = false,
  elevated = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      elevated={elevated}
      footer={
        <ModalFooter borderless>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            disabled={confirmPending}
            sensoryIntent={variant === "destructive" ? "destructive" : "success"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </ModalFooter>
      }
    >
      {children ? <div className="py-2">{children}</div> : null}
    </Modal>
  );
}
