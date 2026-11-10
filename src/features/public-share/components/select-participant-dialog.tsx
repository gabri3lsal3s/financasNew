import { useState } from "react";
import { UserCheck } from "lucide-react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import type { SplitParticipantItem } from "@/types";

export interface SelectParticipantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participants: SplitParticipantItem[];
  isPending?: boolean;
  onConfirm: (participant: SplitParticipantItem) => void;
}

export function SelectParticipantDialog({
  open,
  onOpenChange,
  participants,
  isPending = false,
  onConfirm,
}: SelectParticipantDialogProps) {
  const [selectedId, setSelectedId] = useState<string>(() => {
    return participants[0]?.id ?? "";
  });

  const handleConfirm = () => {
    const selected = participants.find((p) => p.id === selectedId) || participants[0];
    if (selected) {
      onConfirm(selected);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="Quem e voce no racha?"
      description="Identifique seu nome para avisarmos o anfitriao que voce registrou a sua parte."
    >
      <div className="space-y-4 py-1">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            Participantes ({participants.length})
          </label>
          <div className="space-y-2">
            {participants.map((participant) => {
              const isSelected = selectedId === participant.id;
              return (
                <button
                  key={participant.id}
                  type="button"
                  onClick={() => setSelectedId(participant.id || "")}
                  className={`flex w-full items-center justify-between gap-2.5 rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
                      : "border-border/70 bg-surface hover:bg-surface-hover text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-hover">
                      <UserCheck className="size-4 text-foreground" aria-hidden="true" />
                    </span>
                    <span className="text-xs font-semibold text-foreground truncate">
                      {participant.name}
                    </span>
                  </div>
                  <MoneyText
                    cents={participant.share_cents}
                    variant="value"
                    className="text-xs font-semibold tabular-nums shrink-0"
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <ModalFooter>
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
          variant="default"
          disabled={!selectedId || isPending}
          onClick={handleConfirm}
        >
          {isPending ? "Salvando..." : "Confirmar e Salvar"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
