import type { ReactNode } from "react";
import { Printer } from "lucide-react";
import { Button, Modal, usePrint, PrintSheet } from "@/components/ui";
import type { ModalSize } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface ReportDocumentLayoutProps {
  /** Controla se o modal de pré-visualização está aberto. */
  open: boolean;
  /** Callback acionado ao alterar visibilidade do modal. */
  onOpenChange: (open: boolean) => void;
  /** Título do modal / diálogo. */
  title: string;
  /** Nome sugerido para o arquivo PDF gerado ao salvar (ex.: "Relatorio_Executivo_Agosto_2026.pdf"). */
  documentTitle?: string;
  /** Ações customizadas adicionais no cabeçalho do modal (ex.: botão de copiar, exportar Excel). */
  customActions?: ReactNode;
  /** Conteúdo editorial do relatório (usado tanto no preview de tela quanto na impressão). */
  children: ReactNode;
  /** Tamanho do modal no desktop (padrão: "2xl" = lg:max-w-5xl). */
  size?: ModalSize;
  className?: string;
}

/**
 * Contêiner Mestre Editorial para Relatórios e PDFs do Axir.
 *
 * Garante padrão DRY e visual executivo em 100% dos relatórios do sistema:
 * - Modo Tela: Modal unificado com barra superior de ações no cabeçalho nativo ("Imprimir / Salvar PDF", ações extras e fechar único);
 * - Modo Impressão (@media print): Renderizado via portal PrintSheet no `body`,
 *   suprimindo fundos, overlays e elementos do navegador com margens A4 perfeitas.
 */
export function ReportDocumentLayout({
  open,
  onOpenChange,
  title,
  documentTitle,
  customActions,
  children,
  size = "2xl",
  className,
}: ReportDocumentLayoutProps) {
  const suggestedTitle = documentTitle ?? `${title.replace(/[^a-zA-Z0-9_\u00C0-\u00FF]+/g, "_")}.pdf`;
  const { printing, triggerPrint } = usePrint(suggestedTitle);

  return (
    <>
      {/* 1. Pré-visualização Interativa na Tela (Modal Oficial Unificado) */}
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        hideTitle
        size={size}
        contentClassName="p-3 sm:p-5 lg:p-6"
        headerActions={
          <div className="flex items-center gap-1.5 print:hidden">
            {customActions}

            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => triggerPrint(suggestedTitle)}
              disabled={printing}
              className="gap-1.5 shadow-xs h-8 text-xs px-2.5 sm:px-3"
            >
              <Printer className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">
                {printing ? "Preparando..." : "Imprimir / Salvar PDF"}
              </span>
              <span className="sm:hidden">{printing ? "..." : "PDF"}</span>
            </Button>
          </div>
        }
      >
        {/* Folha Editorial A4 renderizada diretamente no contêiner com rolagem nativa do Modal */}
        <div
          className={cn(
            "mx-auto w-full bg-surface text-foreground rounded-xl border border-border/80 p-4 sm:p-6 lg:p-7 shadow-xs flex flex-col gap-6 print:hidden",
            className,
          )}
        >
          {children}
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

