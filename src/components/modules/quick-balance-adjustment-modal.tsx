import { useState } from "react";
import { Check, HeartHandshake, Sparkles } from "lucide-react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import { MoneyText } from "@/components/ui/money-text";
import { todayISO } from "@/domain/debts";
import { useCreateCashCheckpoint } from "@/state";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";

export interface QuickBalanceAdjustmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBalanceCents: number;
}

/**
 * Modal acolhedor de Alinhamento de Saldo em 60 Segundos ("Zero Culpa").
 *
 * Exibido quando o usuário fica 4+ dias sem registrar despesas, permitindo calibrar
 * o saldo com um único lançamento de reconciliação sem culpa ou fricção.
 */
export function QuickBalanceAdjustmentModal({
  open,
  onOpenChange,
  currentBalanceCents,
}: QuickBalanceAdjustmentModalProps) {
  const [realBalanceCents, setRealBalanceCents] = useState<number>(currentBalanceCents);
  const createCheckpointMutation = useCreateCashCheckpoint();

  const deltaCents = realBalanceCents - currentBalanceCents;
  const isPending = createCheckpointMutation.isPending;

  const handleConfirm = async () => {
    try {
      await createCheckpointMutation.mutateAsync({
        date: todayISO(),
        balance_cents: realBalanceCents,
        notes: "Alinhamento Rápido de Saldo (Zero Culpa)",
      });

      triggerSensory("success");
      pushToast({
        title: "Saldo sincronizado",
        description: "Suas métricas e o Safe-to-Spend foram alinhados com sucesso. Bons hábitos recomeçam agora!",
        variant: "success",
      });
      onOpenChange(false);
    } catch {
      triggerSensory("warning");
      pushToast({
        title: "Erro ao sincronizar saldo",
        description: "Não foi possível registrar o alinhamento de saldo.",
        variant: "destructive",
      });
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Alinhamento de Saldo em 60s"
      size="md"
      footer={
        <ModalFooter className="sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={isPending}
            onClick={() => void handleConfirm()}
            className="gap-1.5 font-semibold"
          >
            <Check className="size-4" aria-hidden="true" />
            <span>{isPending ? "Sincronizando…" : "Sincronizar em 1 Clique"}</span>
          </Button>
        </ModalFooter>
      }
    >
      <div className="flex flex-col gap-4 py-2">
        {/* Banner Acolhedor "Zero Culpa" */}
        <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3.5 text-xs">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary-strong">
            <HeartHandshake className="size-4.5" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-foreground">Sem tempo para lançar tudo? Sem problemas!</span>
            <p className="text-muted-foreground leading-relaxed">
              Não gaste tempo garimpando comprovantes antigos. Basta informar quanto você tem no banco hoje e o Áxis calibra seu saldo e o Safe-to-Spend instantaneamente.
            </p>
          </div>
        </div>

        {/* Comparativo de Saldo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border border-border/80 bg-surface">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">Saldo Atual Registrado</span>
            <MoneyText cents={currentBalanceCents} className="text-base font-bold text-foreground" />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">Diferença a Ajustar</span>
            <div className="flex items-center gap-1.5">
              <MoneyText
                cents={Math.abs(deltaCents)}
                className={`text-base font-bold ${
                  deltaCents >= 0 ? "text-positive-strong" : "text-negative-strong"
                }`}
              />
              <span className="text-[11px] text-muted-foreground">
                {deltaCents === 0 ? "(exato)" : deltaCents > 0 ? "(crédito)" : "(débito)"}
              </span>
            </div>
          </div>
        </div>

        {/* Input de Saldo Real */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="quick-balance-input" className="text-xs font-semibold text-foreground">
            Qual o seu saldo total nas contas hoje?
          </label>
          <MoneyInput
            id="quick-balance-input"
            cents={realBalanceCents}
            onCentsChange={(c) => setRealBalanceCents(c)}
            autoFocus
          />
          <span className="text-[11px] text-muted-foreground">
            Soma dos saldos disponíveis em suas contas correntes e carteiras digitais.
          </span>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 text-[11px] text-muted-foreground">
          <Sparkles className="size-3.5 text-primary shrink-0" aria-hidden="true" />
          <span>
            Esta calibração atualiza suas projeções futuras sem criar despesas fictícias nas categorias de orçamento.
          </span>
        </div>
      </div>
    </Modal>
  );
}
