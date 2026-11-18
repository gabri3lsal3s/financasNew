import { AlertTriangle } from "lucide-react";
import { Button, ConfirmDialog, EmptyState } from "@/components/ui";
import { FamilyInviteShell } from "./family-invite-shell";

export interface FamilyInviteSwitchFamilyViewProps {
  token?: string;
  currentFamilyName: string;
  invitedFamilyName?: string | null;
  isSwitchModalOpen: boolean;
  onSwitchModalOpenChange: (open: boolean) => void;
  isSwitching: boolean;
  onConfirmSwitch: () => void;
  onStayInCurrentFamily: () => void;
}

export function FamilyInviteSwitchFamilyView({
  token,
  currentFamilyName,
  invitedFamilyName,
  isSwitchModalOpen,
  onSwitchModalOpenChange,
  isSwitching,
  onConfirmSwitch,
  onStayInCurrentFamily,
}: FamilyInviteSwitchFamilyViewProps) {
  return (
    <FamilyInviteShell token={token}>
      <EmptyState
        headingLevel="h2"
        tone="warning"
        icon={<AlertTriangle className="size-6" aria-hidden="true" />}
        title="Você já pertence a outra família ativa"
        description={`Para entrar na família ${invitedFamilyName || "convidada"}, é necessário desvincular sua conta da família atual (${currentFamilyName}). Seus lançamentos pessoais, contas bancárias e cartões continuarão 100% seguros e intactos.`}
        action={
          <div className="flex flex-col sm:flex-row gap-2.5 justify-center w-full sm:w-auto">
            <Button
              type="button"
              variant="default"
              size="default"
              className="shadow-xs"
              onClick={() => onSwitchModalOpenChange(true)}
            >
              Sair de {currentFamilyName} e Entrar Nesta
            </Button>
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={onStayInCurrentFamily}
            >
              Permanecer na Minha Família
            </Button>
          </div>
        }
      />

      <ConfirmDialog
        open={isSwitchModalOpen}
        onOpenChange={onSwitchModalOpenChange}
        title="Confirmar Troca de Família"
        description={`Deseja se desvincular de "${currentFamilyName}" para ingressar em "${invitedFamilyName || "nova família"}"?`}
        confirmLabel={isSwitching ? "Desvinculando…" : "Confirmar e Entrar"}
        cancelLabel="Voltar"
        variant="destructive"
        confirmPending={isSwitching}
        onConfirm={onConfirmSwitch}
      >
        <p className="text-xs text-muted-foreground leading-relaxed">
          Suas despesas, receitas e contas bancárias continuarão totalmente intactas na sua conta. Apenas a visualização e divisão com a família anterior serão desfeitas.
        </p>
      </ConfirmDialog>
    </FamilyInviteShell>
  );
}
