import { Check, Share2, Trash2 } from "lucide-react";
import { Button, Modal, ModalFooter } from "@/components/ui";
import type { Category, PublicShare } from "@/types";
import { ShareGoalActiveFooter } from "./share-goal/ShareGoalActiveFooter";
import { ShareGoalActivePanel } from "./share-goal/ShareGoalActivePanel";
import { ShareGoalConfirmDialogs } from "./share-goal/ShareGoalConfirmDialogs";
import { ShareGoalForm } from "./share-goal/ShareGoalForm";
import { useShareGoalActions } from "./share-goal/use-share-goal-actions";

export interface ShareGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category | null;
  existingShare?: PublicShare | null;
  month?: string;
  currentExpectedCents?: number;
  currentRealizedCents?: number;
  initialEditMode?: boolean;
}

function ShareGoalDialogInner({
  open,
  onOpenChange,
  category,
  existingShare,
  month = new Date().toISOString().slice(0, 7),
  currentExpectedCents = 0,
  currentRealizedCents = 0,
  initialEditMode = false,
}: ShareGoalDialogProps) {
  const s = useShareGoalActions({
    onOpenChange,
    category,
    existingShare,
    month,
    currentExpectedCents,
    currentRealizedCents,
    initialEditMode,
  });

  const isActiveView = Boolean(s.activeShare && !s.isEditingGoal);
  const isEditingExisting = Boolean(s.activeShare && s.isEditingGoal);

  const submitAriaLabel = isEditingExisting
    ? s.isPending
      ? "Salvando alterações da meta…"
      : "Salvar Alterações da Meta"
    : s.isShared
      ? s.isPending
        ? "Gerando link público…"
        : "Gerar Termômetro Público & Copiar Link"
      : s.isPending
        ? "Salvando meta…"
        : "Salvar Meta Pessoal";

  const formFooter = (
    <ModalFooter
      borderless
      destructiveAction={
        isEditingExisting ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-critical-strong hover:bg-critical/10"
            onClick={() => s.setIsDeleteModalOpen(true)}
            disabled={s.isPending}
          >
            <Trash2 className="size-3.5 mr-1.5" aria-hidden="true" />
            <span>Excluir meta</span>
          </Button>
        ) : undefined
      }
    >
      <Button
        type="button"
        variant="outline"
        onClick={() => (isEditingExisting ? s.setIsEditingGoal(false) : onOpenChange(false))}
        disabled={s.isPending}
      >
        Cancelar
      </Button>
      <Button
        type="button"
        variant="default"
        sensoryIntent="success"
        disabled={s.targetCents <= 0 || (s.isShared && !s.pixKey.trim()) || s.isPending}
        onClick={() => void s.handleSubmitForm()}
        aria-label={submitAriaLabel}
        className="gap-2"
      >
        {isEditingExisting ? (
          <>
            <Check className="size-4 shrink-0" aria-hidden="true" />
            <span>{s.isPending ? "Salvando…" : "Salvar"}</span>
          </>
        ) : s.isShared ? (
          <>
            <Share2 className="size-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">{s.isPending ? "Gerando link…" : "Gerar Termômetro"}</span>
            <span className="sm:hidden">{s.isPending ? "Gerando…" : "Ativar"}</span>
          </>
        ) : (
          <>
            <Check className="size-4 shrink-0" aria-hidden="true" />
            <span>{s.isPending ? "Salvando…" : "Salvar Meta"}</span>
          </>
        )}
      </Button>
    </ModalFooter>
  );

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={s.activeShare ? "Gerenciar Termômetro da Meta" : "Compartilhar Progresso da Meta"}
        description={
          s.activeShare
            ? "Edite os dados da meta, ajuste a chave Pix e controle a visibilidade das doações."
            : "Gere um termômetro público transparente com Pix para arrecadação coletiva."
        }
        size="lg"
        showCalculator={!isActiveView}
        footer={
          isActiveView ? (
            <ShareGoalActiveFooter
              isShared={s.isShared}
              isRevoked={s.isRevoked}
              isArchived={s.isArchived}
              isCompleted={s.isCompleted}
              isPending={s.isPending}
              onClose={() => onOpenChange(false)}
              onRequestDelete={() => s.setIsDeleteModalOpen(true)}
              onRequestRevoke={() => s.setIsRevokeModalOpen(true)}
              onRestoreLink={() => void s.handleConfirmRestore()}
              onRequestRegenerate={() => s.setIsRegenerateModalOpen(true)}
              onToggleArchive={() => void s.handleToggleArchive()}
              onToggleStatus={() => void s.handleToggleStatus()}
            />
          ) : (
            formFooter
          )
        }
      >
        {isActiveView && s.activeShare ? (
          <ShareGoalActivePanel
            activeShare={s.activeShare}
            category={category}
            targetCents={s.targetCents}
            pixKey={s.pixKey}
            isArchived={s.isArchived}
            isCompleted={s.isCompleted}
            isShared={s.isShared}
            isRevoked={s.isRevoked}
            isPending={s.isPending}
            showContributionsPublicly={s.showContributionsPublicly}
            shareUrl={s.shareUrl}
            copied={s.copied}
            showQrPreview={s.showQrPreview}
            effectivePixBrCode={s.effectivePixBrCode}
            onEdit={() => s.setIsEditingGoal(true)}
            onOpenPublicPage={s.handleOpenPublicPage}
            onRestoreLink={() => void s.handleConfirmRestore()}
            onCopyLink={() => void s.handleCopyLink()}
            onToggleQrPreview={() => s.setShowQrPreview((prev) => !prev)}
          />
        ) : (
          <ShareGoalForm
            isEditingExisting={isEditingExisting}
            isShared={s.isShared}
            onSharedChange={s.setIsShared}
            title={s.title}
            onTitleChange={s.setTitle}
            targetCents={s.targetCents}
            onTargetCentsChange={s.setTargetCents}
            initialCollectedCents={s.initialCollectedCents}
            onInitialCollectedCentsChange={s.setInitialCollectedCents}
            deadline={s.deadline}
            onDeadlineChange={s.setDeadline}
            pixKey={s.pixKey}
            onPixKeyChange={s.setPixKey}
            selectedKeyType={s.selectedKeyType}
            onSelectedKeyTypeChange={s.setSelectedKeyType}
            merchantName={s.merchantName}
            onMerchantNameChange={s.setMerchantName}
            merchantCity={s.merchantCity}
            onMerchantCityChange={s.setMerchantCity}
            showContributionsPublicly={s.showContributionsPublicly}
            onShowContributionsPubliclyChange={s.setShowContributionsPublicly}
            onCancelEdit={() => s.setIsEditingGoal(false)}
            onSubmit={() => void s.handleSubmitForm()}
          />
        )}
      </Modal>

      <ShareGoalConfirmDialogs
        isRevokeOpen={s.isRevokeModalOpen}
        onRevokeOpenChange={s.setIsRevokeModalOpen}
        onConfirmRevoke={() => void s.handleConfirmRevoke()}
        isRegenerateOpen={s.isRegenerateModalOpen}
        onRegenerateOpenChange={s.setIsRegenerateModalOpen}
        onConfirmRegenerate={() => void s.handleConfirmRegenerate()}
        isDeleteOpen={s.isDeleteModalOpen}
        onDeleteOpenChange={s.setIsDeleteModalOpen}
        onConfirmDelete={() => void s.handleConfirmDelete()}
        isPending={s.isPending}
      />
    </>
  );
}

export function ShareGoalDialog(props: ShareGoalDialogProps) {
  if (!props.open) return null;
  const key = `${props.existingShare?.id ?? props.category?.id ?? "new"}-${props.initialEditMode ? "edit" : "view"}`;
  return <ShareGoalDialogInner key={key} {...props} />;
}
