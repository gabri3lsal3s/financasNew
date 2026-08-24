import type { ReactNode } from "react";
import { Printer, X } from "lucide-react";
import { Button, Modal, usePrint, PrintSheet } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface ReportDocumentLayoutProps {
  /** Controla se o modal de pré-visualização está aberto. */
  open: boolean;
  /** Callback acionado ao alterar visibilidade do modal. */
  onOpenChange: (open: boolean) => void;
  /** Título do modal / diálogo. */
  title: string;
  /** Ações customizadas adicionais no cabeçalho do modal (ex.: botão de copiar, exportar Excel). */
  customActions?: ReactNode;
  /** Conteúdo editorial do relatório (usado tanto no preview de tela quanto na impressão). */
  children: ReactNode;
  /** Largura customizada para o modal de tela (padrão: max-w-4xl). */
  maxWidthClassName?: string;
  className?: string;
}

/**
 * Contêiner Mestre Editorial para Relatórios e PDFs do Guia Financeiro.
 *
 * Garante padrão DRY e visual executivo em 100% dos relatórios do sistema:
 * - Modo Tela: Modal responsivo com barra superior fixa de ações ("Imprimir / Salvar PDF", ações extras e fechar);
 * - Modo Impressão (@media print): Renderizado via portal PrintSheet no `body`,
 *   suprimindo fundos, overlays e elementos do navegador com margens A4 perfeitas.
 */
export function ReportDocumentLayout({
  open,
  onOpenChange,
  title,
  customActions,
  children,
  maxWidthClassName = "max-w-4xl",
  className,
}: ReportDocumentLayoutProps) {
  const { printing, triggerPrint } = usePrint();

  return (
    <>
      {/* 1. Pré-visualização Interativa na Tela (Modal) */}
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        className={cn(maxWidthClassName, "w-full max-h-[92vh] flex flex-col p-0 overflow-hidden")}
      >
        {/* Barra Superior Fixa de Ações (Ocultada na Impressão) */}
        <div className="flex items-center justify-between gap-3 px-6 py-3.5 border-b border-border bg-surface/95 backdrop-blur-xs shrink-0 print:hidden">
          <span className="font-display text-sm font-semibold text-foreground line-clamp-1">
            {title}
          </span>

          <div className="flex items-center gap-2">
            {customActions}

            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={triggerPrint}
              disabled={printing}
              className="gap-1.5 shadow-xs"
            >
              <Printer className="size-4" aria-hidden="true" />
              <span>{printing ? "Preparando..." : "Imprimir / Salvar PDF"}</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="size-8 text-muted-foreground hover:text-foreground"
              aria-label="Fechar prévia do relatório"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Corpo com Rolagem no Modal */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-muted/10 print:hidden">
          <div
            className={cn(
              "mx-auto bg-surface text-foreground rounded-2xl border border-border/80 p-6 sm:p-8 shadow-xs flex flex-col gap-6",
              className,
            )}
          >
            {children}
          </div>
        </div>
      </Modal>

      {/* 2. Portal de Impressão Direta A4 (Ativo somente durante @media print) */}
      <PrintSheet open={open} className={className}>
        <div className="print-document flex flex-col gap-5 w-full bg-white text-slate-900">
          {children}
        </div>
      </PrintSheet>
    </>
  );
}
