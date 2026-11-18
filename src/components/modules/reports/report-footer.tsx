import { cn } from "@/lib/utils";
import { QrCodeCanvas } from "@/components/ui/qr-code-canvas";
import { OFFICIAL_REPORT_FOOTER_CREDIT } from "@/lib/institutional";
import { getPublicAppUrl } from "@/services/app-url";

export { OFFICIAL_REPORT_FOOTER_CREDIT };

export interface ReportFooterProps {
  disclaimer?: string;
  accountHolder?: string;
  documentId?: string;
  creditText?: string;
  chancelaText?: string;
  showQrCode?: boolean;
  validationUrl?: string;
  presentationUrl?: string;
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
 * Rodapé Institucional e Contábil Padronizado de Relatórios A4 / PDF.
 */
export function ReportFooter({
  disclaimer = "Documento estritamente confidencial emitido pelo titular da conta via Axir. As informações refletem a posição consolidada na data de emissão.",
  accountHolder,
  documentId,
  creditText = OFFICIAL_REPORT_FOOTER_CREDIT,
  chancelaText = "Chancela Oficial · axir.com.br",
  showQrCode = false,
  validationUrl,
  presentationUrl,
  className,
}: ReportFooterProps) {
  const authCode = documentId ?? generateReportAuthId(accountHolder);
  const targetValidationUrl =
    validationUrl ?? `https://axir.com.br/validar?doc=${encodeURIComponent(authCode)}`;
  const targetPresentationUrl = presentationUrl ?? getPublicAppUrl("/apresentacao");

  return (
    <footer
      className={cn(
        "mt-auto pt-3.5 border-t border-border/80 flex flex-col gap-2.5 text-[10px] text-muted-foreground print:pt-3 print:mt-4 print:border-border/80",
        className,
      )}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5 max-w-xl">
          <p className="leading-tight text-muted-foreground">{disclaimer}</p>
          {accountHolder && (
            <p className="font-medium text-foreground/80">Titular: {accountHolder}</p>
          )}
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
          <div className="flex flex-col items-start sm:items-end text-left sm:text-right">
            <a
              href={targetPresentationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground/85 hover:text-foreground hover:underline transition-colors decoration-muted-foreground/40 print:text-foreground/85 print:no-underline"
              title="Conheça a plataforma Axir"
            >
              Axir
            </a>
            <span className="num font-mono text-[10px] text-muted-foreground">ID: {authCode}</span>
            <span className="text-[10px] text-muted-foreground hidden print:inline">
              Autenticação Digital
            </span>
          </div>

          {showQrCode && (
            <div
              className="shrink-0 bg-surface p-1 rounded-md border border-border/80 shadow-xs print:border-border print:shadow-none"
              title={`Validação de autenticidade: ${targetValidationUrl}`}
            >
              <QrCodeCanvas
                text={targetValidationUrl}
                size={40}
                margin={1}
                label={`QR Code de validação do documento ${authCode}`}
                className="size-10 rounded-none border-0 p-0 shadow-none"
              />
            </div>
          )}
        </div>
      </div>

      <div className="pt-2 border-t border-border/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-[10px] text-muted-foreground print:pt-1.5 print:border-border/80">
        <p className="font-medium tracking-tight">{creditText}</p>
        <a
          href={targetPresentationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[10px] text-muted-foreground hover:text-foreground hover:underline transition-colors decoration-muted-foreground/40 print:no-underline"
          title="Acesse a apresentação do Axir"
        >
          {chancelaText}
        </a>
      </div>
    </footer>
  );
}
