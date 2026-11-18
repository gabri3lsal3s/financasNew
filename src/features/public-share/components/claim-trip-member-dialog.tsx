import { useState } from "react";
import { Check, Lock, User, Users } from "lucide-react";
import { Badge, Button, EmptyState, FormField, Input, Modal, ModalFooter } from "@/components/ui";
import { useClaimTripMemberMutation } from "@/state/queries/use-trips";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";
import type { PublicTripMember } from "@/types/trips";

export interface ClaimTripMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripTitle: string;
  token: string;
  tripId: string;
  members: PublicTripMember[];
  initialSelectedMemberId?: string | null;
  hasPasscode?: boolean;
  onSuccess?: (tripId: string) => void;
}

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
      // O erro já é tratado no onError da mutação
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="Vincular Viagem à sua Conta"
      description={`Selecione qual participante representa você em "${tripTitle}" para sincronizar gastos e rateios com seu extrato pessoal.`}
      footer={
        <ModalFooter borderless>
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
            sensoryIntent={false}
            disabled={!selectedMemberId || claimableMembers.length === 0 || claimMutation.isPending}
            loading={claimMutation.isPending}
            onClick={handleConfirm}
          >
            Confirmar e Vincular
          </Button>
        </ModalFooter>
      }
    >
      <div className="space-y-4 py-1">
        {claimableMembers.length === 0 ? (
          <EmptyState
            icon={<Users className="size-6 text-muted-foreground" aria-hidden="true" />}
            title="Nenhum participante disponível"
            description="Todos os participantes desta viagem já possuem conta Axir vinculada."
          />
        ) : (
          <div className="space-y-2">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-foreground block">
                Participantes disponíveis ({claimableMembers.length})
              </span>
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
                    aria-pressed={isSelected}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors cursor-pointer",
                      isSelected
                        ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
                        : "border-border/80 bg-surface hover:bg-surface-hover text-muted-foreground",
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-lg border",
                          isSelected
                            ? "bg-primary/20 border-primary/30 text-primary-strong"
                            : "bg-surface-raised border-border/80 text-muted-foreground",
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
              <div className="pt-3 border-t border-border/80">
                <FormField
                  htmlFor="claim-trip-passcode"
                  optional
                  label={
                    <span className="inline-flex items-center gap-1.5">
                      <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      <span>Código de Acesso da Viagem</span>
                    </span>
                  }
                  helperText="Necessário apenas se o organizador configurou uma senha para esta viagem."
                >
                  <Input
                    id="claim-trip-passcode"
                    type="password"
                    placeholder="Digite o código da viagem"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="text-base sm:text-sm"
                  />
                </FormField>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
