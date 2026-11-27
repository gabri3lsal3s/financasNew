import { CalendarClock, CreditCard, Loader2, QrCode, ShieldCheck } from "lucide-react";
import { Badge, Button, Modal, ModalFooter, MoneyText } from "@/components/ui";

export interface SwitchToAnnualModalProps {
  open: boolean;
  hasActiveRecurringCard: boolean;
  cardLast4: string | null;
  effectiveDateFormatted: string | null;
  isPending: boolean;
  onClose: () => void;
  onConfirmScheduleCard: () => void;
  onPayWithPix: () => void;
  onRegisterNewCard: () => void;
}

export function SwitchToAnnualModal({
  open,
  hasActiveRecurringCard,
  cardLast4,
  effectiveDateFormatted,
  isPending,
  onClose,
  onConfirmScheduleCard,
  onPayWithPix,
  onRegisterNewCard,
}: SwitchToAnnualModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next && !isPending) onClose();
      }}
      size="md"
      title="Mudar para o Plano Pro Anual"
      description="Economize 40% sem perder nenhum dia do período que você já pagou."
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isPending}
          >
            Cancelar
          </Button>
          {hasActiveRecurringCard ? (
            <Button
              type="button"
              variant="solid"
              disabled={isPending}
              onClick={onConfirmScheduleCard}
              className="gap-1.5"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  <span>Agendando...</span>
                </>
              ) : (
                <>
                  <CalendarClock className="size-4" aria-hidden="true" />
                  <span>Agendar no Cartão</span>
                </>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              variant="solid"
              disabled={isPending}
              onClick={onPayWithPix}
              className="gap-1.5"
            >
              <QrCode className="size-4" aria-hidden="true" />
              <span>Pagar Anual via Pix</span>
            </Button>
          )}
        </ModalFooter>
      }
    >
      <div className="space-y-4 py-1">
        <div className="p-3.5 rounded-xl bg-surface-raised/60 border border-border/80 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-semibold text-foreground">Plano Pro Anual</span>
            <Badge variant="positive" size="xs">
              40% OFF
            </Badge>
          </div>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <MoneyText cents={14388} tone="default" className="text-lg font-bold" />
            <span className="text-xs text-muted-foreground">/ano (equivalente a</span>
            <MoneyText cents={1199} variant="caption" tone="default" className="text-xs font-semibold" />
            <span className="text-xs text-muted-foreground">/mês)</span>
          </div>
        </div>

        {hasActiveRecurringCard ? (
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-surface border border-border/80 space-y-2 text-xs text-muted-foreground leading-relaxed">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <CreditCard className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <span>
                  Cartão já cadastrado{cardLast4 ? ` (final ${cardLast4})` : ""}
                </span>
              </div>
              <p>
                <strong className="text-foreground">Cobrança hoje: R$ 0,00.</strong> Seu plano atual continua normalmente até{" "}
                <strong className="text-foreground">{effectiveDateFormatted || "o fim do período vigente"}</strong>.
                Somente nessa data será cobrado o valor anual de{" "}
                <strong className="text-foreground">R$ 143,88</strong> no cartão cadastrado, sem precisar digitar seus dados novamente.
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-raised/40 border border-border/80">
              <div className="space-y-0.5 min-w-0">
                <span className="text-xs font-semibold text-foreground block">
                  Prefere pagar à vista via Pix?
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  Soma +12 meses ao seu saldo atual e cancela automaticamente a cobrança mensal no cartão.
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={onPayWithPix}
                className="gap-1.5 shrink-0"
              >
                <QrCode className="size-3.5" aria-hidden="true" />
                <span>Usar Pix</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-surface border border-border/80 space-y-2 text-xs text-muted-foreground leading-relaxed">
              <p>
                Sua renovação automática no cartão não está ativa. Ao pagar o Plano Anual via Pix, os{" "}
                <strong className="text-foreground">12 meses serão somados</strong> ao seu período vigente{" "}
                {effectiveDateFormatted ? (
                  <>
                    (a partir de <strong className="text-foreground">{effectiveDateFormatted}</strong>)
                  </>
                ) : null}
                .
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-raised/40 border border-border/80">
              <span className="text-xs text-muted-foreground">
                Quer cadastrar um cartão de crédito recorrente?
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={onRegisterNewCard}
                className="gap-1.5 shrink-0"
              >
                <CreditCard className="size-3.5" aria-hidden="true" />
                <span>Cadastrar Cartão</span>
              </Button>
            </div>
          </div>
        )}

        <div className="p-3 rounded-xl bg-surface-raised/60 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
          <span>
            Você pode cancelar a mudança agendada em 1 clique antes da data de renovação.
          </span>
        </div>
      </div>
    </Modal>
  );
}
