import { KeyRound, Settings, Users } from "lucide-react";
import { Button, ConfirmDialog, Modal, ModalFooter, Tabs } from "@/components/ui";
import { FamilyMemberProfileTab } from "./settings/family-member-profile-tab";
import { FamilyMembersInvitesTab } from "./settings/family-members-invites-tab";
import { FamilyRulesTab } from "./settings/family-rules-tab";
import { useFamilySettingsState } from "./settings/use-family-settings-state";

export interface FamilySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: string;
}

export function FamilySettingsDialog({
  open,
  onOpenChange,
  initialTab = "general",
}: FamilySettingsDialogProps) {
  const s = useFamilySettingsState({ open, onOpenChange, initialTab });
  const myIncomeSuggestion = s.incomeSuggestions?.find((item) => item.user_id === s.currentMember?.user_id);

  const tabItems = [
    {
      value: "general",
      label: s.isOwner ? "Regras da Casa" : "Visão das Regras",
      icon: <Settings className="size-4" />,
      content: (
        <FamilyRulesTab
          isOwner={s.isOwner}
          family={s.family}
          editName={s.editName}
          onEditNameChange={(val) => {
            s.setEditName(val);
            s.setIsFamilyDirty(true);
          }}
          editBudgetCents={s.editBudgetCents}
          onEditBudgetCentsChange={(val) => {
            s.setEditBudgetCents(val);
            s.setIsFamilyDirty(true);
          }}
          editSplitRule={s.editSplitRule}
          onEditSplitRuleChange={s.handleSplitRuleChange}
          isDirty={s.isFamilyDirty}
          isPending={s.updateFamilyPending}
          onSubmit={s.handleSaveFamilyParams}
        />
      ),
    },
    {
      value: "pix",
      label: "Meus Dados & Pix",
      icon: <KeyRound className="size-4" />,
      content: (
        <FamilyMemberProfileTab
          memberDisplayName={s.memberDisplayName}
          onMemberDisplayNameChange={(val) => {
            s.setMemberDisplayName(val);
            s.setIsMemberDirty(true);
          }}
          memberPixKeyType={s.memberPixKeyType}
          onMemberPixKeyTypeChange={(val) => {
            s.setMemberPixKeyType(val);
            s.setIsMemberDirty(true);
          }}
          memberPixKey={s.memberPixKey}
          onMemberPixKeyChange={(val) => {
            s.setMemberPixKey(val);
            s.setIsMemberDirty(true);
          }}
          memberSplitRatioPercent={s.memberSplitRatioPercent}
          onMemberSplitRatioPercentChange={(val) => {
            s.setMemberSplitRatioPercent(val);
            s.setIsMemberDirty(true);
          }}
          splitRule={s.family?.split_rule}
          myIncomeSuggestion={myIncomeSuggestion}
          isDirty={s.isMemberDirty}
          isPending={s.updateMemberPending}
          onSubmit={s.handleSaveMemberPix}
        />
      ),
    },
    {
      value: "members",
      label: `Membros (${s.members.length})`,
      icon: <Users className="size-4" />,
      content: (
        <FamilyMembersInvitesTab
          isOwner={s.isOwner}
          members={s.members}
          currentUserId={s.currentMember?.user_id}
          pendingInvites={s.pendingInvites}
          inviteEmail={s.inviteEmail}
          onInviteEmailChange={s.setInviteEmail}
          generatedInviteUrl={s.generatedInviteUrl}
          showQrCode={s.showQrCode}
          onToggleQrCode={() => s.setShowQrCode(!s.showQrCode)}
          copiedToken={s.copiedToken}
          invitePending={s.inviteMemberPending}
          revokePending={s.revokeInvitePending}
          onSendInvite={s.handleSendInvite}
          onCopyLink={s.handleCopyLink}
          onRequestRemoveMember={s.setMemberToRemove}
          onRequestRevokeInvite={s.setInviteToRevoke}
          onRequestDeleteFamily={() => s.setIsDeleteModalOpen(true)}
          onRequestLeaveFamily={() => s.setIsLeaveModalOpen(true)}
        />
      ),
    },
  ];

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Configurações da Família"
        description="Gestão de membros, parâmetros de rateio, chaves Pix e regras do lar."
        size="xl"
        confirmDiscard
        isDirty={s.isFamilyDirty || s.isMemberDirty}
        onDiscard={s.handleResetDrafts}
        discardTitle="Descartar alterações?"
        discardDescription="Você possui alterações não salvas nas configurações da família. Se sair agora, todas as informações modificadas serão descartadas."
        showCalculator={s.activeTab === "general" && s.isOwner}
        footer={
          <ModalFooter borderless>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </ModalFooter>
        }
      >
        <div className="pt-1 pb-2">
          <Tabs
            value={s.activeTab}
            onValueChange={s.setActiveTab}
            items={tabItems}
            variant="underline"
            className="w-full"
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(s.memberToRemove)}
        onOpenChange={(next) => {
          if (!next) s.setMemberToRemove(null);
        }}
        elevated
        title="Remover Membro da Família"
        description={`Tem certeza de que deseja remover ${s.memberToRemove?.display_name || "este participante"} da unidade familiar?`}
        confirmLabel="Confirmar Remoção"
        variant="destructive"
        confirmPending={s.removeMemberPending}
        onConfirm={() => void s.handleConfirmRemoveMember()}
      >
        <p className="text-xs text-muted-foreground leading-relaxed">
          O participante deixará de acessar o extrato consolidado do lar. Suas contas, despesas e dados pessoais permanecem 100% seguros e intactos (Zero Data Bleed).
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(s.inviteToRevoke)}
        onOpenChange={(next) => {
          if (!next) s.setInviteToRevoke(null);
        }}
        elevated
        title="Revogar Convite Pendente"
        description={`Tem certeza de que deseja revogar o convite enviado para ${s.inviteToRevoke?.invited_email ?? "este participante"}?`}
        confirmLabel="Confirmar Revogação"
        variant="destructive"
        confirmPending={s.revokeInvitePending}
        onConfirm={() => void s.handleConfirmRevokeInvite()}
      >
        <p className="text-xs text-muted-foreground leading-relaxed">
          O link de convite deixará de funcionar imediatamente. Caso precise, você poderá gerar um novo convite depois.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={s.isLeaveModalOpen}
        onOpenChange={s.setIsLeaveModalOpen}
        elevated
        title="Sair da Família"
        description="Deseja realmente desvincular sua conta desta unidade familiar?"
        confirmLabel="Confirmar Saída"
        variant="destructive"
        confirmPending={s.leaveFamilyPending}
        onConfirm={() => void s.handleConfirmLeaveFamily()}
      >
        <p className="text-xs text-muted-foreground leading-relaxed">
          Você deixará de visualizar os gastos consolidados do lar. Todas as suas contas bancárias, cartões e despesas particulares continuarão salvas na sua conta.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={s.isDeleteModalOpen}
        onOpenChange={s.setIsDeleteModalOpen}
        elevated
        title="Excluir Unidade Familiar"
        description="Esta ação é irreversível e desfaz o vínculo entre todos os participantes."
        confirmLabel="Confirmar Exclusão"
        variant="destructive"
        confirmPending={s.deleteFamilyPending}
        onConfirm={() => void s.handleConfirmDeleteFamily()}
      >
        <p className="text-xs text-muted-foreground leading-relaxed">
          O grupo familiar será excluído permanentemente. Nenhum dado financeiro pessoal ou lançamento particular de qualquer membro será apagado.
        </p>
      </ConfirmDialog>
    </>
  );
}
