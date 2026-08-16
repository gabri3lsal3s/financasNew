import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PrintSheetProps {
  open: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Folha de impressão (F22 evolução) — porta o documento para o `body` como
 * irmão do app (`#root`), com a classe `.print-sheet`:
 *
 *   • na tela: `display: none` (invisível — o preview continua no modal);
 *   • na impressão (`@media print` em globals.css): o app e os demais portais
 *     (modal, toasts) são removidos do fluxo (`display: none`) e apenas o
 *     `.print-sheet` é exibido em **fluxo normal** — paginação multi-página
 *     confiável no Chrome (elementos `fixed`/`absolute` em impressão são
 *     cortados na primeira página, o que deixava os lançamentos incompletos).
 */
export function PrintSheet({ open, children, className }: PrintSheetProps) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className={cn("print-sheet", className)} aria-hidden="true">
      {children}
    </div>,
    document.body,
  );
}
