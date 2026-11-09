/**
 * Modal de confirmação para participante sair da viagem (desvincular conta).
 * Chama a RPC unlink_trip_member.
 * Respeita as diretrizes de governança do AGENTS.md.
 */

import { LogOut, AlertTriangle } from "lucide-react";
import { Modal, ModalFooter, Button } from "@/components/ui";
import { formatCentsAsBRL } from "@/services/masks/money";
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
      // Erro tratado pela mutation (toast e sensory)
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
        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            disabled={unlinkMutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={unlinkMutation.isPending}
            sensoryIntent="destructive"
            onClick={() => void handleConfirm()}
            className="gap-1.5"
          >
            <LogOut className="size-3.5" aria-hidden="true" />
            <span>{unlinkMutation.isPending ? "Saindo..." : "Sair da Viagem"}</span>
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
                Você possui um saldo devedor de <strong className="text-foreground">{formatCentsAsBRL(Math.abs(netCents))}</strong> nesta viagem. Certifique-se de realizar a quitação com o organizador ou amigos.
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
                Você ainda possui <strong className="text-foreground">{formatCentsAsBRL(netCents)}</strong> a receber dos participantes desta viagem.
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
  return (
    <LeaveTripDialogContent
      {...props}
      trip={props.trip}
      myMember={props.myMember}
    />
  );
}
