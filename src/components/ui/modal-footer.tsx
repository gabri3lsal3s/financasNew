import { Children, Fragment, isValidElement } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function countActionChildren(node: ReactNode): number {
  let count = 0;
  Children.forEach(node, (child) => {
    if (child === null || child === undefined || typeof child === "boolean") {
      return;
    }
    if (isValidElement(child) && child.type === Fragment) {
      count += countActionChildren((child.props as { children?: ReactNode }).children);
      return;
    }
    count += 1;
  });
  return count;
}

export interface ModalFooterProps {
  children?: ReactNode;
  className?: string;
  /** Remove margens e bordas extras (útil quando renderizado dentro de slot de rodapé já delimitado). */
  borderless?: boolean;
  /** Ação isolada à esquerda no desktop e linha separada no mobile (ex: botão Excluir). */
  destructiveAction?: ReactNode;
}

export function ModalFooter({
  children,
  className,
  borderless = false,
  destructiveAction,
}: ModalFooterProps) {
  const count = countActionChildren(children);
  const actionsLayoutClass =
    count === 2
      ? "grid grid-cols-2 gap-2.5 sm:flex sm:flex-row sm:items-center sm:justify-end"
      : "flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5";

  if (destructiveAction) {
    return (
      <div
        className={cn(
          "w-full",
          !borderless && "pt-4 mt-6 border-t border-border/80",
          "flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between",
          className,
        )}
      >
        <div className="order-last sm:order-first w-full sm:w-auto [&>button]:w-full [&>button]:sm:w-auto">
          {destructiveAction}
        </div>
        <div
          className={cn(
            "w-full sm:w-auto [&>button]:w-full [&>button]:sm:w-auto [&>button]:sm:min-w-[110px]",
            actionsLayoutClass,
          )}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full [&>button]:w-full [&>button]:sm:w-auto [&>button]:sm:min-w-[110px]",
        !borderless && "pt-4 mt-6 border-t border-border/80",
        actionsLayoutClass,
        className,
      )}
    >
      {children}
    </div>
  );
}
