import { useState } from "react";
import { User, Check, Lock, Users } from "lucide-react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useClaimTripMemberMutation } from "@/state/queries/use-trips";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";
import type { PublicTripMember } from "@/types/trips";

export interface ClaimTripMemberDialogProps {
  /** Se o modal está aberto */
  open: boolean;
  /** Callback para controle de abertura/fechamento */
  onOpenChange: (open: boolean) => void;
  /** Título descritivo da viagem para contextualização */
  tripTitle: string;
  /** Token público da viagem para autenticação da RPC */
  token: string;
  /** ID da viagem para redirecionamento após o vínculo */
  tripId: string;
  /** Lista completa de participantes da viagem */
  members: PublicTripMember[];
  /** ID do participante inicialmente sugerido (ex.: ativo no navegador) */
  initialSelectedMemberId?: string | null;
  /** Se a viagem requer código de acesso */
  hasPasscode?: boolean;
  /** Callback executado após a conclusão com sucesso do vínculo */
  onSuccess?: (tripId: string) => void;
}

/**
 * Diálogo rápido para reivindicar/vincular um participante de viagem à conta Axir logada.
 * Cumpre as regras DRY, acessibilidade (Radix Modal), zero controles nativos e zero emojis.
 */
export function ClaimTripMemberDialog({
  open,
  onOpenChange,
  tripTitle,
  token,
  tripId,
  members,
  initialSelectedMemberId,
  hasPasscode = false,
  onSuccess,
}: ClaimTripMemberDialogProps) {
  // Apenas participantes sem conta Axir vinculada podem ser reivindicados
  const claimableMembers = members.filter((m) => !m.has_axis_account);

  const defaultSelectedId =
    initialSelectedMemberId && claimableMembers.some((m) => m.id === initialSelectedMemberId)
      ? initialSelectedMemberId
      : (claimableMembers[0]?.id ?? null);

  const [chosenMemberId, setChosenMemberId] = useState<string | null>(null);

  const selectedMemberId =
    chosenMemberId && claimableMembers.some((m) => m.id === chosenMemberId)
      ? chosenMemberId
      : defaultSelectedId;

  const [passcode, setPasscode] = useState("");
  const claimMutation = useClaimTripMemberMutation();

  const handleSelectMember = (memberId: string) => {
    triggerSensory("selection");
    setChosenMemberId(memberId);
  };

  const handleConfirm = async () => {
    if (!selectedMemberId || claimMutation.isPending) return;

    try {
      const result = await claimMutation.mutateAsync({
        token,
        memberId: selectedMemberId,
        passcode: passcode.trim() || undefined,
      });

      onOpenChange(false);
      onSuccess?.(result?.trip_id || tripId);
    } catch {
      // O erro já é tratado no onError da mutação (sensory + toast)
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="Vincular Viagem à sua Conta"
      description={`Selecione qual participante representa você em "${tripTitle}" para sincronizar gastos e rateios com seu extrato pessoal.`}
    >
      <div className="space-y-4 py-1">
        {claimableMembers.length === 0 ? (
          <EmptyState
            icon={<Users className="size-8 text-muted-foreground" aria-hidden="true" />}
            title="Nenhum participante disponível"
            description="Todos os participantes desta viagem já possuem conta Axir vinculada."
          />
        ) : (
          <div className="space-y-2">
            <div className="space-y-0.5">
              <label className="text-xs font-semibold text-foreground">
                Participantes disponíveis ({claimableMembers.length})
              </label>
              <p className="text-[11px] text-muted-foreground">
                Selecione qual participante é você nesta viagem.
              </p>
            </div>

            <div className="space-y-2">
              {claimableMembers.map((member) => {
                const isSelected = selectedMemberId === member.id;
                const isBrowserSuggested = member.id === initialSelectedMemberId;

                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => handleSelectMember(member.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors cursor-pointer",
                      isSelected
                        ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
                        : "border-border/70 bg-surface hover:bg-surface-hover text-muted-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-lg border",
                          isSelected
                            ? "bg-primary/20 border-primary/30 text-primary-strong"
                            : "bg-surface-raised border-border/80 text-muted-foreground"
                        )}
                      >
                        {isSelected ? (
                          <Check className="size-4 text-primary-strong" aria-hidden="true" />
                        ) : (
                          <User className="size-4" aria-hidden="true" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-foreground truncate block">
                          {member.name}
                        </span>
                        {isBrowserSuggested && (
                          <span className="text-[10px] text-primary-strong font-medium block">
                            Identificado no navegador
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Badge size="xs" variant="default" className="shrink-0">
                        Selecionado
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>

            {hasPasscode && (
              <div className="space-y-1.5 pt-3 border-t border-border/60">
                <label
                  htmlFor="claim-trip-passcode"
                  className="text-xs font-semibold text-foreground flex items-center gap-1.5"
                >
                  <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  <span>Código de Acesso da Viagem (opcional)</span>
                </label>
                <Input
                  id="claim-trip-passcode"
                  type="password"
                  placeholder="Digite o código da viagem"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Necessário apenas se o organizador configurou uma senha para esta viagem.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          disabled={claimMutation.isPending}
          onClick={() => onOpenChange(false)}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          variant="default"
          disabled={!selectedMemberId || claimableMembers.length === 0 || claimMutation.isPending}
          onClick={handleConfirm}
        >
          {claimMutation.isPending ? "Vinculando..." : "Confirmar e Vincular"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
