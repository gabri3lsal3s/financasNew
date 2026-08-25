import type { ReactNode } from "react";
import { Modal, type ModalSize } from "./modal";
import { cn } from "@/lib/utils";

export interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  elevated?: boolean;
  showCalculator?: boolean;
  headerActions?: ReactNode;
  className?: string;
  contentClassName?: string;
}

/**
 * Primitivo canônico de Diálogo / BottomSheet responsivo (F55).
 * 
 * Unifica contratos de modais no sistema:
 * - Mobile (< lg): Bottom Sheet deslizante com drag-to-close e alça ergonômica.
 * - Desktop (lg+): Diálogo centralizado com backdrop blur e tamanhos canônicos.
 * - Suporte nativo a sticky footer, calculadora contextual e Zero Auto-Focus.
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  elevated = false,
  showCalculator = false,
  headerActions,
  className,
  contentClassName,
}: ResponsiveDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size={size}
      elevated={elevated}
      showCalculator={showCalculator}
      headerActions={headerActions}
      className={className}
    >
      <div className={cn("flex flex-col gap-4 mt-4", contentClassName)}>
        <div className="flex-1 min-w-0">{children}</div>
        {footer ? (
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-3 mt-2 border-t border-border/80 sticky bottom-0 bg-surface/95 backdrop-blur-sm -mx-6 px-6 -mb-2 pb-2">
            {footer}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
