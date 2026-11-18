import { cloneElement, isValidElement } from "react";
import type { ReactElement } from "react";
import { Modal, ModalFooter, type ModalFooterProps, type ModalProps } from "./modal";
import { cn } from "@/lib/utils";

export interface ResponsiveDialogProps extends ModalProps {
  footerClassName?: string;
}

/**
 * Alias/wrapper de compatibilidade sobre `<Modal />` (primitivo único de diálogo/Bottom Sheet).
 * Repassa integralmente `ModalProps` (`destructiveAction`, `modal`, `dataTour`, `showCalculator`,
 * `elevated`, `wideHeaderActions`, etc.) sem embrulhar `<ModalFooter>` duas vezes.
 */
export function ResponsiveDialog({
  footer,
  footerClassName,
  destructiveAction,
  ...modalProps
}: ResponsiveDialogProps) {
  const resolvedFooter = (() => {
    if (!footer && !destructiveAction) return undefined;
    if (isValidElement(footer) && footer.type === ModalFooter) {
      const existingProps = footer.props as ModalFooterProps;
      return cloneElement(footer as ReactElement<ModalFooterProps>, {
        borderless: existingProps.borderless ?? true,
        destructiveAction: existingProps.destructiveAction ?? destructiveAction,
        className: cn(footerClassName, existingProps.className),
      });
    }
    return (
      <ModalFooter
        borderless
        destructiveAction={destructiveAction}
        className={footerClassName}
      >
        {footer}
      </ModalFooter>
    );
  })();

  return <Modal {...modalProps} footer={resolvedFooter} />;
}
