import { Alert, ConfirmDialog, RadioGroup, Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { InstallmentDeleteMode } from "@/types";
import { MODE_OPTIONS, RECURRENCE_MODE_OPTIONS, type TripDeleteMode } from "./transaction-group-constants";

export interface TransactionDeleteScopeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  confirmPending: boolean;
  onConfirm: () => void;
  isRachaExpense?: boolean;
  tripId?: string | null;
  tripName?: string;
  tripDeleteMode?: TripDeleteMode;
  onTripDeleteModeChange?: (mode: TripDeleteMode) => void;
  isGrouped: boolean;
  isRecurring: boolean;
  mode: InstallmentDeleteMode;
  onModeChange: (mode: InstallmentDeleteMode) => void;
}

/** Confirmação compartilhada de exclusão de despesa/receita (grupo, viagem e racha). */
export function TransactionDeleteScopeModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmPending,
  onConfirm,
  isRachaExpense = false,
  tripId,
  tripName,
  tripDeleteMode = "both",
  onTripDeleteModeChange,
  isGrouped,
  isRecurring,
  mode,
  onModeChange,
}: TransactionDeleteScopeModalProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      variant="destructive"
      confirmPending={confirmPending}
      onConfirm={onConfirm}
    >
      {isRachaExpense ? (
        <div className="flex flex-col gap-3">
          <Alert variant="warning">
            Esta despesa originou um racha compartilhado com amigos. Ao confirmar a exclusão, a despesa será removida do
            extrato, o valor pendente a receber será cancelado e o link público do racha será excluído.
          </Alert>
        </div>
      ) : null}

      {tripId && onTripDeleteModeChange ? (
        <div className="flex flex-col gap-3">
          <Alert variant="warning">
            Esta despesa está vinculada ao Modo Viagem{tripName ? ` (${tripName})` : ""}.
          </Alert>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground">Como deseja prosseguir?</span>
            <RadioGroup
              variant="cards"
              value={tripDeleteMode}
              onValueChange={(val) => onTripDeleteModeChange(val as TripDeleteMode)}
              name="trip-delete-mode"
              options={[
                {
                  value: "both",
                  label: "Excluir do extrato e da viagem",
                  description: "Apaga o lançamento do seu extrato pessoal e remove a despesa do livro da viagem.",
                },
                {
                  value: "personal_only",
                  label: "Excluir apenas do extrato pessoal",
                  description: "Remove o lançamento do seu extrato e mantém a despesa registrada na viagem.",
                },
              ]}
            />
          </div>
        </div>
      ) : null}

      {isGrouped ? (
        <div className={cn("flex flex-col gap-1.5", tripId ? "mt-3 pt-3 border-t border-border/80" : "mt-4")}>
          <span className="text-xs font-semibold text-foreground">O que excluir?</span>
          <Select
            value={mode}
            onValueChange={(value) => onModeChange(value as InstallmentDeleteMode)}
            options={isRecurring ? RECURRENCE_MODE_OPTIONS : MODE_OPTIONS}
            ariaLabel="Modo de exclusão"
          />
        </div>
      ) : null}
    </ConfirmDialog>
  );
}
