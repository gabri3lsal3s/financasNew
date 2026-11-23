import { Copy, HelpCircle, ShieldCheck } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  Badge,
  Button,
} from "@/components/ui";
import { formatPixKeyTypeLabel, inspectPixPaymentPayload } from "@/domain/pix";
import { cn } from "@/lib/utils";

export interface PixTroubleshootAccordionProps {
  pixBrCode?: string | null;
  pixKey?: string | null;
  pixKeyType?: string | null;
  onCopyPixKey?: () => void;
  className?: string;
}

/**
 * Acordeão compacto de diagnóstico para a tela de pagamento Pix:
 * exibe verificação estrutural EMV/CRC16, explica os motivos reais caso o app
 * do banco recuse o pagamento ou o motivo de indisponibilidade do BR Code, e
 * oferece atalho direto para copiar apenas a chave Pix.
 */
export function PixTroubleshootAccordion({
  pixBrCode,
  pixKey,
  pixKeyType,
  onCopyPixKey,
  className,
}: PixTroubleshootAccordionProps) {
  const inspection = inspectPixPaymentPayload({
    pixBrCode,
    pixKey,
    pixKeyType,
  });

  if (!pixBrCode && !pixKey) {
    return null;
  }

  return (
    <Accordion type="single" collapsible className={cn("w-full text-left", className)}>
      <AccordionItem value="pix-troubleshoot" className="bg-surface-raised/60">
        <AccordionTrigger className="min-h-9 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
          <span className="inline-flex items-center gap-1.5">
            <HelpCircle className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>Deu erro ao pagar no app do banco? Ver diagnóstico</span>
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-3 pt-1 text-xs space-y-2.5">
          {inspection.isValidEmv ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-positive/25 bg-positive/5 px-2.5 py-2">
                <span className="inline-flex items-center gap-1.5 font-semibold text-foreground text-[11px]">
                  <ShieldCheck className="size-3.5 text-positive-strong shrink-0" aria-hidden="true" />
                  <span>Estrutura EMV íntegra</span>
                </span>
                {inspection.crc16 ? (
                  <Badge size="xs" variant="positive">
                    CRC16 {inspection.crc16}
                  </Badge>
                ) : null}
              </div>

              {inspection.embeddedKey ? (
                <p className="text-[11px] text-muted-foreground px-0.5 break-all font-mono">
                  {`Chave verificada no EMV (${formatPixKeyTypeLabel(inspection.embeddedKeyType)}): ${inspection.embeddedKey}`}
                </p>
              ) : null}

              <div className="space-y-1 text-[11px] text-muted-foreground leading-relaxed">
                <p className="font-medium text-foreground">
                  Se o aplicativo do banco recusar este código, confira os 4 motivos mais comuns:
                </p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>
                    A chave Pix informada não está cadastrada ou ativa no banco de destino (DICT).
                  </li>
                  <li>
                    Tentativa de pagar um código criado para a sua própria conta no mesmo banco (alguns bancos bloqueiam autopagamento).
                  </li>
                  <li>
                    Saldo insuficiente ou limite diário/noturno do Pix abaixo do valor cobrado.
                  </li>
                  <li>
                    Código colado em &quot;Transferir por chave&quot; em vez de &quot;Pix Copia e Cola&quot;, ou copiado com espaço ou quebra de linha.
                  </li>
                </ol>
              </div>
            </div>
          ) : (
            <Alert variant="warning" className="text-xs">
              <span>{inspection.issueReason}</span>
            </Alert>
          )}

          {pixKey && onCopyPixKey ? (
            <div className="pt-1 border-t border-border/70 flex justify-end">
              <Button
                type="button"
                size="xs"
                variant="outline"
                sensoryIntent={false}
                onClick={onCopyPixKey}
                className="gap-1.5"
              >
                <Copy className="size-3" aria-hidden="true" />
                <span>Copiar apenas a chave Pix</span>
              </Button>
            </div>
          ) : null}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
