import type { ReactNode } from "react";
import { Modal, ModalFooter, type ModalSize } from "./modal";
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
  footerClassName?: string;
}

/**
 * Primitivo canônico de Diálogo / BottomSheet responsivo (F55).
 * 
 * Unifica contratos de modais no sistema:
 * - Mobile (< md): Bottom Sheet deslizante com drag-to-close e alça ergonômica.
 * - Desktop (md+): Diálogo centralizado com backdrop blur e tamanhos canônicos.
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
  footerClassName,
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
      contentClassName={contentClassName}
      footer={
        footer ? (
          <ModalFooter className={cn("mt-0 pt-0 border-t-0", footerClassName)}>
            {footer}
          </ModalFooter>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3.5">
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </Modal>
  );
}
