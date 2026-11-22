import { useState } from "react";
import { UserCheck } from "lucide-react";
import { Button, Modal, ModalFooter, MoneyText } from "@/components/ui";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";
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
  const [selectedId, setSelectedId] = useState<string>("");
  const guestOptions = participants.filter((p) => !p.is_host);

  const effectiveSelectedId =
    selectedId && guestOptions.some((p) => p.id === selectedId)
      ? selectedId
      : (guestOptions[0]?.id ?? "");

  const handleConfirm = () => {
    const selected = guestOptions.find((p) => p.id === effectiveSelectedId) || guestOptions[0];
    if (selected) {
      onConfirm(selected);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="Quem é você no racha?"
      description="Identifique seu nome para avisarmos o anfitrião que você registrou a sua parte."
      footer={
        <ModalFooter borderless>
          <Button type="button" variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="default"
            disabled={!effectiveSelectedId || isPending}
            loading={isPending}
            onClick={handleConfirm}
          >
            Confirmar e Salvar
          </Button>
        </ModalFooter>
      }
    >
      <div className="space-y-4 py-1">
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-foreground block">
            Participantes ({guestOptions.length})
          </span>
          <div className="space-y-2">
            {guestOptions.map((participant) => {
              const isSelected = effectiveSelectedId === participant.id;
              return (
                <button
                  key={participant.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    triggerSensory("selection");
                    setSelectedId(participant.id || "");
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2.5 rounded-xl border p-3 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    isSelected
                      ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
                      : "border-border/80 bg-surface hover:bg-surface-hover text-muted-foreground",
                  )}
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
                    variant="caption"
                    tone="default"
                    className="font-semibold shrink-0"
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
