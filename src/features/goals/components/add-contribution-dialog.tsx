import { useState } from "react";
import { Plus, User } from "lucide-react";
import {
  Button,
  DatePicker,
  Input,
  Modal,
  ModalFooter,
  MoneyInput,
} from "@/components/ui";
import { useUpdatePublicShare } from "@/state";
import { todayISO } from "@/lib/date";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type { GoalContribution, PublicShare } from "@/types";

export interface AddContributionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  share: PublicShare;
}

export function AddContributionDialog({
  open,
  onOpenChange,
  share,
}: AddContributionDialogProps) {
  const updateShareMutation = useUpdatePublicShare();
  const [amountCents, setAmountCents] = useState(0);
  const [contributorName, setContributorName] = useState("");
  const [date, setDate] = useState(() => todayISO());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    setAmountCents(0);
    setContributorName("");
    setDate(todayISO());
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (amountCents <= 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const currentCents = Number(share.payload?.current_cents ?? 0);
      const newTotalCents = currentCents + amountCents;

      const newContribution: GoalContribution = {
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `contrib-${Date.now()}`,
        amount_cents: amountCents,
        contributor_name: contributorName.trim() || undefined,
        date: date || todayISO(),
      };

      const existingContributions =
        (share.payload?.contributions as GoalContribution[] | undefined) ?? [];

      await updateShareMutation.mutateAsync({
        id: share.id,
        payload: {
          ...share.payload,
          current_cents: newTotalCents,
          contributions: [...existingContributions, newContribution],
        },
      });

      pushToast({
        title: "Depósito registrado com sucesso!",
        description: "O valor arrecadado agora é refletido em tempo real no termômetro web.",
        variant: "success",
      });

      handleClose();
    } catch {
      triggerSensory("error");
      pushToast({
        title: "Erro ao registrar depósito",
        description: "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = (share.payload?.title as string) || "Meta Coletiva";

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
        else onOpenChange(true);
      }}
      title="Registrar Depósito na Vaquinha"
      description={`Adicione um novo valor recebido para a meta "${title}".`}
      size="md"
      showCalculator
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="default"
            sensoryIntent="success"
            disabled={amountCents <= 0 || isSubmitting}
            onClick={() => void handleSubmit()}
            aria-label="Confirmar Depósito"
            className="gap-1.5"
          >
            <Plus className="size-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Confirmar Depósito</span>
            <span className="sm:hidden">Confirmar</span>
          </Button>
        </ModalFooter>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
        className="flex flex-col gap-4 py-2"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="contribution-amount" className="text-xs font-semibold text-foreground">
            Valor Recebido
          </label>
          <MoneyInput
            id="contribution-amount"
            cents={amountCents}
            onCentsChange={setAmountCents}
            placeholder="R$ 0,00"
          />
          <p className="text-[11px] text-muted-foreground">
            Quantia arrecadada via Pix, dinheiro ou transferência para somar ao termômetro.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="contributor-name" className="text-xs font-semibold text-foreground">
            Nome do Participante <span className="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <div className="relative">
            <Input
              id="contributor-name"
              type="text"
              value={contributorName}
              onChange={(e) => setContributorName(e.target.value)}
              placeholder="Ex: Lucas, Mariana, Anônimo..."
              className="pl-9 text-base sm:text-sm"
              maxLength={60}
            />
            <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="contribution-date" className="text-xs font-semibold text-foreground">
            Data do Recebimento
          </label>
          <DatePicker
            id="contribution-date"
            value={date}
            onChange={(next) => setDate(next ?? todayISO())}
          />
        </div>
      </form>
    </Modal>
  );
}
