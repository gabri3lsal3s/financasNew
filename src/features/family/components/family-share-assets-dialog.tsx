import { useState } from "react";
import { Button, Modal, ModalFooter } from "@/components/ui";
import {
  useMyFamily,
  usePortfolioAssets,
  useTogglePortfolioAssetFamily,
  useUpdateFamilyWealthSharing,
} from "@/state";
import type { FamilyMemberWithProfile } from "@/types";
import { FamilyShareAssetsContent } from "./family-share-assets-content";

export interface FamilyShareAssetsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DialogInnerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMember: FamilyMemberWithProfile;
  familyId?: string | null;
}

function FamilyShareAssetsInnerModal({
  open,
  onOpenChange,
  currentMember,
  familyId,
}: DialogInnerModalProps) {
  const assetsQuery = usePortfolioAssets();
  const updateWealthSharing = useUpdateFamilyWealthSharing();
  const toggleAssetFamily = useTogglePortfolioAssetFamily();

  const userAssets = assetsQuery.data ?? [];
  const [shareAll, setShareAll] = useState(() => Boolean(currentMember.share_all_portfolio));
  const [selectedClasses, setSelectedClasses] = useState<string[]>(
    () => currentMember.shared_asset_classes ?? [],
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleToggleClass = (cls: string) => {
    setSelectedClasses((prev) =>
      prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls],
    );
  };

  const handleSavePreferences = async () => {
    setIsSaving(true);
    try {
      await updateWealthSharing.mutateAsync({
        memberId: currentMember.id,
        shareAllPortfolio: shareAll,
        sharedAssetClasses: selectedClasses,
      });
      onOpenChange(false);
    } catch {
      // Toast tratado na mutation
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleSingleAsset = async (assetId: string, currentIsFamily: boolean) => {
    if (!familyId) return;
    try {
      await toggleAssetFamily.mutateAsync({
        assetId,
        isFamily: !currentIsFamily,
        familyId: !currentIsFamily ? familyId : null,
      });
    } catch {
      // Erro tratado na mutation
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Compartilhar Meus Investimentos"
      description="Escolha quais investimentos da sua carteira pessoal compõem o patrimônio e reserva da família."
      size="lg"
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="default"
            sensoryIntent={false}
            onClick={handleSavePreferences}
            disabled={isSaving}
            loading={isSaving}
          >
            Salvar Preferências
          </Button>
        </ModalFooter>
      }
    >
      <FamilyShareAssetsContent
        shareAll={shareAll}
        onShareAllChange={setShareAll}
        selectedClasses={selectedClasses}
        onToggleClass={handleToggleClass}
        userAssets={userAssets}
        isTogglePending={toggleAssetFamily.isPending}
        onToggleSingleAsset={handleToggleSingleAsset}
      />
    </Modal>
  );
}

export function FamilyShareAssetsDialog({ open, onOpenChange }: FamilyShareAssetsDialogProps) {
  const { data: myFamilyData } = useMyFamily();
  const currentMember = myFamilyData?.currentMember;

  if (!currentMember) {
    return (
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Compartilhar Meus Investimentos"
        description="Escolha quais investimentos da sua carteira pessoal compõem o patrimônio e reserva da família."
        size="lg"
      />
    );
  }

  return (
    <FamilyShareAssetsInnerModal
      key={currentMember.id}
      open={open}
      onOpenChange={onOpenChange}
      currentMember={currentMember}
      familyId={myFamilyData?.family?.id}
    />
  );
}
