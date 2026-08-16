import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { triggerHaptic } from "@/services/haptics";

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
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} description={description}>
      {children}
      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" autoFocus onClick={() => onOpenChange(false)}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={variant === "destructive" ? "destructive" : "default"}
          disabled={confirmPending}
          onClick={() => {
            // Confirmações de mutação com feedback tátil (F8 — Decisão 3).
            triggerHaptic("success");
            onConfirm();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
