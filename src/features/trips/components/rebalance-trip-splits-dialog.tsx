/**
 * Modal de Confirmação para Equilibrar Despesas entre Todos os Participantes.
 * Permite ao organizador remover restrições de data de entrada e ratear 100% das despesas
 * gerais igualmente entre todos os membros ativos da viagem.
 * Cumpre as regras do AGENTS.md (Regras 4, 7, 8, 15, 18).
 */

import {
  Modal,
  ModalFooter,
  Button,
} from "@/components/ui";
import { Scale } from "lucide-react";
import { useRebalanceTripMutation } from "@/state/queries/use-trips";

export interface RebalanceTripSplitsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  membersCount: number;
}

export function RebalanceTripSplitsDialog({
  open,
  onOpenChange,
  tripId,
  membersCount,
}: RebalanceTripSplitsDialogProps) {
  const rebalanceMutation = useRebalanceTripMutation(tripId);

  const handleConfirm = async () => {
    try {
      await rebalanceMutation.mutateAsync();
      onOpenChange(false);
    } catch {
      // Erro gerenciado no hook useRebalanceTripMutation
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title="Equilibrar Despesas da Viagem"
      description={`Deseja incluir todos os ${membersCount} participantes em todas as despesas gerais da viagem?`}
      footer={
        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={rebalanceMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleConfirm}
            loading={rebalanceMutation.isPending}
            disabled={rebalanceMutation.isPending}
            className="gap-1.5"
          >
            <Scale className="size-3.5" aria-hidden="true" />
            Equilibrar para Todos
          </Button>
        </ModalFooter>
      }
    >
      <div className="space-y-3 text-xs text-muted-foreground">
        <p>
          Ao confirmar, os participantes que ingressaram depois passarão a ratear
          igualmente todas as despesas gerais da viagem desde o primeiro dia (como hospedagem,
          gasolina e compras coletivas).
        </p>
        <p className="p-2.5 rounded-xl bg-surface-raised border border-border/80 text-foreground font-medium">
          Os balanços líquidos individuais e as sugestões de transferências Pix serão
          recalculados imediatamente.
        </p>
      </div>
    </Modal>
  );
}
