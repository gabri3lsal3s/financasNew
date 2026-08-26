import { cn } from "@/lib/utils";

export interface ReportFooterProps {
  /** Termo de confidencialidade customizado (opcional). */
  disclaimer?: string;
  /** Identificação do titular da conta. */
  accountHolder?: string;
  /** Identificador de integridade ou hash do documento (opcional). */
  documentId?: string;
  className?: string;
}

function generateReportAuthId(accountHolder?: string): string {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const seed = `${accountHolder ?? "FIN"}-${datePart}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).toUpperCase().padStart(4, "0").slice(0, 4);
  return `BR-${datePart}-${hex}`;
}

/**
 * Rodapé Institucional de Relatório A4 / PDF.
 *
 * Exibe termos de confidencialidade, autenticação do documento e
 * alinhamento editorial limpo no final de cada folha impressa.
 */
export function ReportFooter({
  disclaimer = "Documento estritamente confidencial emitido pelo titular da conta via Guia Financeiro. As informações refletem a posição consolidada na data de emissão.",
  accountHolder,
  documentId,
  className,
}: ReportFooterProps) {
  const authCode = documentId ?? generateReportAuthId(accountHolder);

  return (
    <footer
      className={cn(
        "mt-auto pt-4 border-t border-border/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[10px] text-muted-foreground print:text-[9.5px] print:pt-3 print:mt-4 print:border-border/80",
        className,
      )}
    >
      <div className="flex flex-col gap-0.5 max-w-xl">
        <p className="leading-tight">{disclaimer}</p>
        {accountHolder && (
          <p className="font-medium text-foreground/80">
            Titular: {accountHolder}
          </p>
        )}
      </div>

      <div className="flex flex-col items-start sm:items-end text-left sm:text-right shrink-0">
        <span className="font-semibold text-foreground/80">Guia Financeiro</span>
        <span className="num font-mono text-[9px] text-muted-foreground/70">
          ID: {authCode}
        </span>
      </div>
    </footer>
  );
}
