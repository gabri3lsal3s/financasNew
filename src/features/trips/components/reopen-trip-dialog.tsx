/**
 * Modal de confirmação para reabrir uma viagem finalizada pelo organizador.
 * Altera o status para "active", reativando lançamentos e o link público.
 * Respeita as diretrizes de governança do AGENTS.md.
 */

import { RotateCcw } from "lucide-react";
import { Modal, ModalFooter, Button } from "@/components/ui";
import { useUpdateTripMutation } from "@/state/queries/use-trips";
import type { Trip } from "@/types/trips";

export interface ReopenTripDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip | null;
  onSuccess?: () => void;
}

function ReopenTripDialogContent({
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
  const updateMutation = useUpdateTripMutation();

  const handleConfirm = async () => {
    try {
      await updateMutation.mutateAsync({
        tripId: trip.id,
        input: { status: "active" },
      });
      onOpenChange(false);
      onSuccess?.();
    } catch {
      // Erro tratado pela mutation (toast e sensory)
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title="Reabrir viagem?"
      description={`A viagem "${trip.title}" voltará para o status Ativa. O link de compartilhamento voltará a aceitar novas despesas e o grupo reaparecerá na lista de viagens em andamento.`}
      footer={
        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            disabled={updateMutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="default"
            disabled={updateMutation.isPending}
            onClick={() => void handleConfirm()}
            className="gap-1.5"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            <span>{updateMutation.isPending ? "Reabrindo..." : "Reabrir Viagem"}</span>
          </Button>
        </ModalFooter>
      }
    >
      <div className="py-2">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-1 text-xs text-foreground">
          <p className="font-semibold text-primary-strong">Pronto para novos lançamentos</p>
          <p className="text-[11px] text-muted-foreground">
            Os saldos e acertos já registrados serão preservados. Você poderá continuar lançando gastos e equilibrando despesas normalmente.
          </p>
        </div>
      </div>
    </Modal>
  );
}

export function ReopenTripDialog(props: ReopenTripDialogProps) {
  if (!props.trip) return null;
  return <ReopenTripDialogContent {...props} trip={props.trip} />;
}
