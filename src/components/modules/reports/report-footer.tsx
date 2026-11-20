import { cn } from "@/lib/utils";
import { QrCodeCanvas } from "@/components/ui/qr-code-canvas";
import { OFFICIAL_REPORT_FOOTER_CREDIT } from "@/lib/institutional";
import { getPublicAppUrl } from "@/services/app-url";

export { OFFICIAL_REPORT_FOOTER_CREDIT };

export type ReportTypePrefix =
  | "irpf"
  | "fire"
  | "balance"
  | "dossier"
  | "dre"
  | "ledger"
  | "carteira"
  | "invoice"
  | "trip"
  | "general";

const REPORT_TYPE_PREFIX_MAP: Record<ReportTypePrefix, string> = {
  irpf: "IRPF",
  fire: "FIRE",
  balance: "BAL",
  dossier: "DOS",
  dre: "DRE",
  ledger: "EXT",
  carteira: "CART",
  invoice: "FAT",
  trip: "TRIP",
  general: "BR",
};

export interface ReportFooterProps {
  disclaimer?: string;
  accountHolder?: string;
  documentId?: string;
  reportType?: ReportTypePrefix;
  creditText?: string;
  chancelaText?: string;
  showQrCode?: boolean;
  validationUrl?: string;
  presentationUrl?: string;
  currentPage?: number;
  totalPages?: number;
  className?: string;
}

function generateReportAuthId(accountHolder?: string, reportType: ReportTypePrefix = "general"): string {
  const prefix = REPORT_TYPE_PREFIX_MAP[reportType] ?? "BR";
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const seed = `${accountHolder ?? "FIN"}-${prefix}-${datePart}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).toUpperCase().padStart(4, "0").slice(0, 4);
  return `${prefix}-${datePart}-${hex}`;
}

/**
 * Rodapé Institucional e Contábil Padronizado de Relatórios A4 / PDF.
 *
 * Características canônicas:
 * - Anti-órfão (break-inside: avoid e contenção volumétrica estrita < 45px);
 * - Identificador criptográfico com prefixo funcional por tipo de documento;
 * - Paginação explícita "Página X de Y";
 * - QR Code vetorial compacto de 32px para autenticação digital imediata.
 */
export function ReportFooter({
  disclaimer = "Documento estritamente confidencial emitido pelo titular da conta via Axir. As informações refletem a posição consolidada na data de emissão.",
  accountHolder,
  documentId,
  reportType = "general",
  creditText = OFFICIAL_REPORT_FOOTER_CREDIT,
  chancelaText = "Chancela Oficial · axir.com.br",
  showQrCode = false,
  validationUrl,
  presentationUrl,
  currentPage,
  totalPages,
  className,
}: ReportFooterProps) {
  const authCode = documentId ?? generateReportAuthId(accountHolder, reportType);
  const targetValidationUrl =
    validationUrl ?? `https://axir.com.br/validar?doc=${encodeURIComponent(authCode)}`;
  const targetPresentationUrl = presentationUrl ?? getPublicAppUrl("/apresentacao");

  const paginationLabel =
    currentPage !== undefined && totalPages !== undefined
      ? `Página ${currentPage} de ${totalPages}`
      : undefined;

  return (
    <footer
      className={cn(
        "mt-auto pt-3 border-t border-border/80 flex flex-col gap-2 text-[9.5pt] text-muted-foreground break-inside-avoid print:pt-2.5 print:mt-3 print:border-border/80",
        className,
      )}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5 max-w-xl">
          <p className="leading-tight text-muted-foreground text-[8pt] print:text-[7.5pt] m-0">
            {disclaimer}
          </p>
          {accountHolder && (
            <p className="font-medium text-foreground/80 text-[8pt] print:text-[7.5pt] m-0">
              Titular: {accountHolder}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
          <div className="flex flex-col items-start sm:items-end text-left sm:text-right">
            <a
              href={targetPresentationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground/85 hover:text-foreground hover:underline transition-colors decoration-muted-foreground/40 text-[8.5pt] print:text-[8pt] print:no-underline"
              title="Conheça a plataforma Axir"
            >
              Axir
            </a>
            <span className="num font-mono text-[8pt] text-muted-foreground whitespace-nowrap">
              ID: {authCode}
            </span>
            {paginationLabel ? (
              <span className="text-[7.5pt] font-mono text-muted-foreground font-semibold">
                {paginationLabel}
              </span>
            ) : (
              <span className="text-[7.5pt] text-muted-foreground hidden print:inline">
                Autenticação Digital
              </span>
            )}
          </div>

          {showQrCode && (
            <div
              className="shrink-0 bg-surface p-0.5 rounded border border-border/80 shadow-xs print:border-border print:shadow-none"
              title={`Validação de autenticidade: ${targetValidationUrl}`}
            >
              <QrCodeCanvas
                text={targetValidationUrl}
                size={32}
                margin={1}
                label={`QR Code de validação do documento ${authCode}`}
                className="size-8 rounded-none border-0 p-0 shadow-none"
              />
            </div>
          )}
        </div>
      </div>

      <div className="pt-1.5 border-t border-border/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-[7.5pt] text-muted-foreground print:pt-1 print:border-border/80">
        <p className="font-medium tracking-tight m-0">{creditText}</p>
        <a
          href={targetPresentationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[7.5pt] text-muted-foreground hover:text-foreground hover:underline transition-colors decoration-muted-foreground/40 print:no-underline"
          title="Acesse a apresentação do Axir"
        >
          {chancelaText}
        </a>
      </div>
    </footer>
  );
}
