import { Loader2 } from "lucide-react";
import {
  Badge,
  Button,
  Modal,
  ModalFooter,
  RadioGroup,
} from "@/components/ui";

const CANCELLATION_REASONS = [
  { value: "too_expensive", label: "Preço alto / fora do orçamento atual" },
  { value: "not_using_enough", label: "Não estou usando com frequência suficiente" },
  { value: "missing_features", label: "Faltam recursos que eu precisava" },
  { value: "found_alternative", label: "Encontrei outro aplicativo/método" },
  { value: "other", label: "Outro motivo particular" },
];

export interface CancelSubscriptionWizardModalProps {
  open: boolean;
  step: "reason" | "confirm";
  reason: string;
  isWithinGuarantee: boolean;
  isTrialScheduled?: boolean;
  trialEndsFormatted?: string | null;
  currentPeriodFormatted: string | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onStepChange: (step: "reason" | "confirm") => void;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
}

export function CancelSubscriptionWizardModal({
  open,
  step,
  reason,
  isWithinGuarantee,
  isTrialScheduled = false,
  trialEndsFormatted = null,
  currentPeriodFormatted,
  isPending,
  onOpenChange,
  onStepChange,
  onReasonChange,
  onConfirm,
}: CancelSubscriptionWizardModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={
        step === "reason"
          ? "Pesquisa de Cancelamento"
          : isTrialScheduled
            ? "Confirmar Cancelamento do Agendamento"
            : isWithinGuarantee
              ? "Confirmar Cancelamento e Estorno Integral"
              : "Confirmar Cancelamento da Renovação"
      }
      description={
        step === "reason"
          ? "Lamentamos ver você partir. Nos ajude a melhorar contando o principal motivo do cancelamento:"
          : isTrialScheduled
            ? `Seu cartão ainda não foi cobrado. Ao confirmar, o agendamento de renovação futura será cancelado no Asaas e você continuará aproveitando seus dias restantes de teste gratuito até ${trialEndsFormatted || "o término do teste"} normalmente sem nenhum débito.`
            : isWithinGuarantee
              ? "Você está dentro do prazo legal de 7 dias de garantia (CDC). Ao confirmar, o valor pago será estornado integralmente pelo Asaas no seu cartão ou conta Pix e seu acesso Pro será encerrado imediatamente."
              : `Sua assinatura não será renovada ao final do ciclo. Você continuará com acesso Pro completo normalmente até ${currentPeriodFormatted || "o fim do período já pago"} e seus dados serão preservados.`
      }
      footer={
        <ModalFooter borderless>
          {step === "reason" ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Continuar com Pro
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => onStepChange("confirm")}
              >
                Avançar
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => onStepChange("reason")}
              >
                Voltar
              </Button>
              <Button
                type="button"
                variant={isTrialScheduled ? "outline" : "destructive"}
                sensoryIntent={false}
                disabled={isPending}
                onClick={onConfirm}
                className="gap-2"
              >
                {isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
                <span>
                  {isPending
                    ? "Processando..."
                    : isTrialScheduled
                      ? "Cancelar Agendamento"
                      : isWithinGuarantee
                        ? "Confirmar e Estornar"
                        : "Confirmar Cancelamento"}
                </span>
              </Button>
            </>
          )}
        </ModalFooter>
      }
    >
      <div className="space-y-4 pt-2">
        {step === "reason" ? (
          <RadioGroup
            value={reason}
            onValueChange={onReasonChange}
            options={CANCELLATION_REASONS}
            variant="cards"
          />
        ) : (
          <div className="rounded-xl border border-critical/25 bg-critical/5 p-3.5 space-y-1.5">
            <div className="flex items-center gap-2">
              <Badge variant={isTrialScheduled ? "warning" : "critical"} size="xs">
                {isTrialScheduled ? "Nenhuma Cobrança Realizada" : isWithinGuarantee ? "Estorno Integral Asaas" : "Acesso Mantido"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {isTrialScheduled
                ? `O agendamento no Asaas é desfeito imediatamente e você continua no período de teste gratuito até ${trialEndsFormatted || "o encerramento"}.`
                : isWithinGuarantee
                  ? "O estorno é disparado diretamente na API do Asaas e seu acesso Pro volta a ser Somente Leitura."
                  : `Nenhuma nova cobrança será realizada no cartão. Seu acesso Pro segue ativo até ${currentPeriodFormatted || "o término do ciclo"}.`}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
