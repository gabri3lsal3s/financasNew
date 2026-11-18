import { AlertTriangle, LogOut } from "lucide-react";
import { Button, Modal, ModalFooter, MoneyText } from "@/components/ui";
import { useUnlinkTripMemberMutation } from "@/state/queries/use-trips";
import type { Trip, TripMember, TripMemberBalance } from "@/types/trips";

export interface LeaveTripDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip | null;
  myMember: TripMember | null;
  myBalance?: TripMemberBalance | null;
  onSuccess?: () => void;
}

function LeaveTripDialogContent({
  open,
  onOpenChange,
  trip,
  myMember,
  myBalance,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip;
  myMember: TripMember;
  myBalance?: TripMemberBalance | null;
  onSuccess?: () => void;
}) {
  const unlinkMutation = useUnlinkTripMemberMutation(trip.id);
  const netCents = myBalance?.netBalanceCents ?? 0;
  const hasDebt = netCents < 0;
  const hasCredit = netCents > 0;

  const handleConfirm = async () => {
    try {
      await unlinkMutation.mutateAsync(myMember.id);
      onOpenChange(false);
      onSuccess?.();
    } catch {
      // Erro tratado pela mutation
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title="Sair da viagem?"
      description={`Tem certeza de que deseja sair de "${trip.title}"? Sua conta será desvinculada e o grupo deixará de aparecer no seu painel. Seus registros de despesas e cotas continuarão salvos no histórico dos amigos.`}
      footer={
        <ModalFooter borderless>
          <Button type="button" variant="outline" disabled={unlinkMutation.isPending} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            sensoryIntent={false}
            disabled={unlinkMutation.isPending}
            loading={unlinkMutation.isPending}
            onClick={() => void handleConfirm()}
            className="gap-1.5"
          >
            <LogOut className="size-3.5" aria-hidden="true" />
            <span>Sair da Viagem</span>
          </Button>
        </ModalFooter>
      }
    >
      <div className="py-2 space-y-3">
        {hasDebt && (
          <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 space-y-1 text-xs text-warning-strong flex items-start gap-2.5">
            <AlertTriangle className="size-4 shrink-0 text-warning-strong mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold">Pendência financeira em aberto</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Você possui um saldo devedor de{" "}
                <MoneyText cents={Math.abs(netCents)} tone="default" variant="caption" className="font-bold text-foreground" /> nesta viagem. Certifique-se de realizar a quitação com o organizador ou amigos.
              </p>
            </div>
          </div>
        )}

        {hasCredit && (
          <div className="rounded-xl border border-positive/30 bg-positive/10 p-3 space-y-1 text-xs text-positive-strong flex items-start gap-2.5">
            <AlertTriangle className="size-4 shrink-0 text-positive-strong mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold">Saldo a receber pendente</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Você ainda possui{" "}
                <MoneyText cents={netCents} tone="default" variant="caption" className="font-bold text-foreground" /> a receber dos participantes desta viagem.
              </p>
            </div>
          </div>
        )}

        {!hasDebt && !hasCredit && (
          <div className="rounded-xl border border-border/80 bg-surface-raised p-3 text-xs text-muted-foreground">
            Seu saldo nesta viagem está completamente equilibrado (zerado). Você pode se desvincular com tranquilidade.
          </div>
        )}
      </div>
    </Modal>
  );
}

export function LeaveTripDialog(props: LeaveTripDialogProps) {
  if (!props.trip || !props.myMember) return null;
  return <LeaveTripDialogContent {...props} trip={props.trip} myMember={props.myMember} />;
}
