import { useEffect, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Printer } from "lucide-react";
import { Button, ConfirmDialog, Modal, usePrint, PrintSheet } from "@/components/ui";
import type { ModalSize } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface ReportPrintWarning {
  title: string;
  description: string;
  confirmLabel?: string;
}

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
  /** Interceptador executado antes de disparar a impressão nativa/PDF. Retornar false cancela a impressão. */
  onBeforePrint?: () => boolean | void;
  /** Alerta de confirmação explícita antes de gerar PDF quando há cotações/câmbio defasados ou estimados. */
  printWarning?: ReportPrintWarning | null;
  /** Conteúdo editorial do relatório (usado tanto no preview de tela quanto na impressão). */
  children: ReactNode;
  /** Tamanho do modal no desktop (padrão: "3xl" = max-w-7xl / 1280px para máxima escaneabilidade de dados tabulares). */
  size?: ModalSize;
  className?: string;
}

/**
 * Contêiner Mestre Editorial para Relatórios e PDFs do Axir.
 *
 * - Modo Tela: Modal unificado com barra superior de ações no cabeçalho ("Imprimir / Salvar PDF", ações extras e fechar único);
 * - Modo Impressão (@media print): Renderizado via portal PrintSheet no `body` sob demanda
 *   (durante `printing` ou eventos nativos `beforeprint` / `afterprint`), evitando dupla
 *   renderização pesada do relatório enquanto está apenas em pré-visualização na tela.
 */
export function ReportDocumentLayout({
  open,
  onOpenChange,
  title,
  documentTitle,
  customActions,
  children,
  size = "3xl",
  className,
  onBeforePrint,
  printWarning,
}: ReportDocumentLayoutProps) {
  const suggestedTitle = documentTitle ?? `${title.replace(/[^a-zA-Z0-9_\u00C0-\u00FF]+/g, "_")}.pdf`;
  const { printing, triggerPrint } = usePrint(suggestedTitle);
  const [browserPrinting, setBrowserPrinting] = useState(false);
  const [warningConfirmOpen, setWarningConfirmOpen] = useState(false);

  const handlePrintClick = () => {
    if (onBeforePrint && onBeforePrint() === false) {
      return;
    }
    if (printWarning) {
      setWarningConfirmOpen(true);
      return;
    }
    triggerPrint(suggestedTitle);
  };

  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    const handleBeforePrint = () => {
      flushSync(() => {
        setBrowserPrinting(true);
      });
    };

    const handleAfterPrint = () => {
      setBrowserPrinting(false);
    };

    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setBrowserPrinting(false);
      setWarningConfirmOpen(false);
    }
    onOpenChange(next);
  };

  const shouldMountPrintContent = open && (printing || browserPrinting);

  return (
    <>
      {/* 1. Pré-visualização Interativa na Tela (Modal Oficial Unificado) */}
      <Modal
        open={open}
        onOpenChange={handleOpenChange}
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
              onClick={handlePrintClick}
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

      {/* 2. Portal de Impressão Direta A4 (Conteúdo montado apenas sob demanda durante impressão) */}
      <PrintSheet open={open} className={className}>
        <div className="print-document flex flex-col gap-5 w-full bg-white text-slate-900 print:block print:space-y-4">
          {shouldMountPrintContent ? children : null}
        </div>
      </PrintSheet>

      {printWarning ? (
        <ConfirmDialog
          open={warningConfirmOpen}
          onOpenChange={setWarningConfirmOpen}
          title={printWarning.title}
          description={printWarning.description}
          confirmLabel={printWarning.confirmLabel ?? "Emitir PDF mesmo assim"}
          cancelLabel="Cancelar"
          elevated
          onConfirm={() => {
            setWarningConfirmOpen(false);
            triggerPrint(suggestedTitle);
          }}
        />
      ) : null}
    </>
  );
}
