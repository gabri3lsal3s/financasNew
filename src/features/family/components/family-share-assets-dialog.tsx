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

  const handleToggleClass = async (cls: string) => {
    const nextClasses = selectedClasses.includes(cls)
      ? selectedClasses.filter((c) => c !== cls)
      : [...selectedClasses, cls];
    setSelectedClasses(nextClasses);
    try {
      await updateWealthSharing.mutateAsync({
        memberId: currentMember.id,
        shareAllPortfolio: shareAll,
        sharedAssetClasses: nextClasses,
      });
    } catch {
      // Toast e rollback tratados na mutation
    }
  };

  const handleShareAllChange = async (checked: boolean) => {
    setShareAll(checked);
    try {
      await updateWealthSharing.mutateAsync({
        memberId: currentMember.id,
        shareAllPortfolio: checked,
        sharedAssetClasses: selectedClasses,
      });
    } catch {
      // Toast e rollback tratados na mutation
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
            variant="default"
            onClick={() => onOpenChange(false)}
          >
            Concluir
          </Button>
        </ModalFooter>
      }
    >
      <FamilyShareAssetsContent
        shareAll={shareAll}
        onShareAllChange={(val) => void handleShareAllChange(val)}
        selectedClasses={selectedClasses}
        onToggleClass={(cls) => void handleToggleClass(cls)}
        userAssets={userAssets}
        isTogglePending={toggleAssetFamily.isPending || updateWealthSharing.isPending}
        onToggleSingleAsset={handleToggleSingleAsset}
      />
    </Modal>
  );
}

export function FamilyShareAssetsDialog({ open, onOpenChange }: FamilyShareAssetsDialogProps) {
  const { data: myFamilyData } = useMyFamily();
  const currentMember = myFamilyData?.currentMember;

  if (!open) return null;

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
      key={`${currentMember.id}-${open}`}
      open={open}
      onOpenChange={onOpenChange}
      currentMember={currentMember}
      familyId={myFamilyData?.family?.id}
    />
  );
}
