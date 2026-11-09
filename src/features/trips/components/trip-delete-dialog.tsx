/**
 * Modal de confirmação para exclusão de viagem pelo organizador.
 * Exclui a viagem e seus registros vinculados em cascata.
 * Respeita as diretrizes de governança do AGENTS.md.
 */

import { Trash2 } from "lucide-react";
import { Modal, ModalFooter, Button } from "@/components/ui";
import { useDeleteTripMutation } from "@/state/queries/use-trips";
import type { Trip } from "@/types/trips";

export interface TripDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip | null;
  onSuccess?: () => void;
}

function TripDeleteDialogContent({
  open,
  onOpenChange,
  trip,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip;
  onSuccess?: () => void;
}) {
  const deleteMutation = useDeleteTripMutation();

  const handleConfirm = async () => {
    try {
      await deleteMutation.mutateAsync(trip.id);
      onOpenChange(false);
      onSuccess?.();
    } catch {
      // Erro tratado pela mutation (toast e feedback sensorial)
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title="Excluir viagem?"
      description={`Tem certeza de que deseja excluir "${trip.title}"? Esta ação é definitiva e removerá permanentemente todas as despesas da viagem, participantes e histórico de acertos associados.`}
      footer={
        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            disabled={deleteMutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={deleteMutation.isPending}
            sensoryIntent="destructive"
            onClick={() => void handleConfirm()}
            className="gap-1.5"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            <span>{deleteMutation.isPending ? "Excluindo..." : "Excluir Viagem"}</span>
          </Button>
        </ModalFooter>
      }
    >
      <div className="py-2">
        <div className="rounded-xl border border-critical/20 bg-critical/5 p-3 space-y-1 text-xs text-critical-strong">
          <p className="font-semibold">Atenção: Ação irreversível</p>
          <p className="text-[11px] text-muted-foreground">
            Os dados desta viagem não poderão ser recuperados após a exclusão. Se restarem saldos pendentes entre os amigos, certifique-se de que os acertos foram realizados.
          </p>
        </div>
      </div>
    </Modal>
  );
}

export function TripDeleteDialog(props: TripDeleteDialogProps) {
  if (!props.trip) return null;
  return <TripDeleteDialogContent {...props} trip={props.trip} />;
}
