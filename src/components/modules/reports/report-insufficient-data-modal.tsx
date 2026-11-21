import { AlertCircle, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import type { MissingRequirement } from "@/domain/reports";

export interface ReportInsufficientDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportTitle: string;
  periodLabel?: string;
  blockingReasons: MissingRequirement[];
  onAction?: (route: string) => void;
}

/**
 * Modal de Pré-Validação e Dados Insuficientes (Gatekeeper de Relatórios).
 *
 * Cumpre a Regra 18 do AGENTS.md e as diretrizes de UX da Parte 6.1:
 * - Informa ao usuário com máxima clareza e empatia o que falta para compilar o documento;
 * - Oferece CTA direto para a rota de resolução no aplicativo (ex: cadastrar cartão, ativos);
 * - Padrão sóbrio, zero emojis, ícones semânticos com aria-hidden.
 */
export function ReportInsufficientDataModal({
  open,
  onOpenChange,
  reportTitle,
  periodLabel,
  blockingReasons,
  onAction,
}: ReportInsufficientDataModalProps) {
  const navigate = useNavigate();
  const primaryReason = blockingReasons[0];

  const handleCtaClick = () => {
    onOpenChange(false);
    if (!primaryReason?.ctaRoute) return;

    if (onAction) {
      onAction(primaryReason.ctaRoute);
    } else {
      navigate(primaryReason.ctaRoute);
    }
  };

  const subtitle = `Para gerar o ${reportTitle}${periodLabel ? ` (${periodLabel})` : ""}, ainda precisamos das seguintes informações:`;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Dados insuficientes para gerar este relatório"
      size="sm"
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>

          {primaryReason?.ctaRoute ? (
            <Button
              type="button"
              variant="default"
              sensoryIntent="action"
              onClick={handleCtaClick}
              className="gap-1.5"
            >
              <span>{primaryReason.ctaLabel ?? "Completar cadastro"}</span>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Button>
          ) : null}
        </ModalFooter>
      }
    >
      <div className="flex flex-col gap-3 py-1">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {subtitle}
        </p>

        <div className="flex flex-col gap-2.5">
          {blockingReasons.map((reason) => (
            <div
              key={reason.code}
              className="flex items-start gap-2.5 p-3 rounded-xl border border-warning/30 bg-warning/5 text-xs"
            >
              <AlertCircle
                className="size-4 text-warning-strong shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="font-semibold text-foreground">
                  {reason.title}
                </span>
                <span className="text-muted-foreground leading-relaxed text-[11px]">
                  {reason.description}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
