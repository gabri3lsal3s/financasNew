import { useState } from "react";
import { useCreateDeepLink } from "@/hooks";
import type { CategoryKitId } from "@/domain/budgets";
import type { Category, PublicShare } from "@/types";

export function useBudgetsDialogs(isReadOnlyMode: boolean) {
  const [limitFor, setLimitFor] = useState<Category | null>(null);
  const [goalFor, setGoalFor] = useState<Category | null>(null);
  const [sharingGoalFor, setSharingGoalFor] = useState<Category | null>(null);
  const [depositShare, setDepositShare] = useState<PublicShare | null>(null);
  const [manageContributionsShare, setManageContributionsShare] = useState<PublicShare | null>(null);
  const [compositionShare, setCompositionShare] = useState<PublicShare | null>(null);
  const [editingShare, setEditingShare] = useState<PublicShare | null>(null);
  const [editingShareInitialEdit, setEditingShareInitialEdit] = useState(false);
  const [createStandaloneCampaignOpen, setCreateStandaloneCampaignOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const { open: categoryFormOpen, setOpen: setCategoryFormOpen } = useCreateDeepLink("categoria");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [reallocateOpen, setReallocateOpen] = useState(false);
  const [reallocateError, setReallocateError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeContext, setUpgradeContext] = useState<string | undefined>();
  const [kitsModalOpen, setKitsModalOpen] = useState(false);
  const [initialKitId, setInitialKitId] = useState<CategoryKitId | undefined>(undefined);

  const guardWrite = (context: string, action: () => void) => {
    if (isReadOnlyMode) {
      setUpgradeContext(context);
      setUpgradeOpen(true);
      return;
    }
    action();
  };

  return {
    limitFor,
    setLimitFor,
    goalFor,
    setGoalFor,
    sharingGoalFor,
    setSharingGoalFor,
    depositShare,
    setDepositShare,
    manageContributionsShare,
    setManageContributionsShare,
    compositionShare,
    setCompositionShare,
    editingShare,
    setEditingShare,
    editingShareInitialEdit,
    setEditingShareInitialEdit,
    createStandaloneCampaignOpen,
    setCreateStandaloneCampaignOpen,
    editingCategory,
    setEditingCategory,
    categoryFormOpen,
    setCategoryFormOpen,
    adjustOpen,
    setAdjustOpen,
    reallocateOpen,
    setReallocateOpen,
    reallocateError,
    setReallocateError,
    upgradeOpen,
    setUpgradeOpen,
    upgradeContext,
    setUpgradeContext,
    guardWrite,
    handleOpenLimit: (cat: Category) =>
      guardWrite("Definir Limite de Orçamento", () => setLimitFor(cat)),
    handleOpenGoal: (cat: Category) =>
      guardWrite("Definir Meta de Renda", () => setGoalFor(cat)),
    handleOpenAdjustBudget: () =>
      guardWrite("Ajustar Orçamento", () => setAdjustOpen(true)),
    handleOpenCreateCategory: () =>
      guardWrite("Cadastrar Nova Categoria", () => {
        setEditingCategory(null);
        setCategoryFormOpen(true);
      }),
    handleEditCategory: (cat: Category) =>
      guardWrite("Editar Categoria", () => {
        setEditingCategory(cat);
        setCategoryFormOpen(true);
      }),
    handleOpenReallocate: () =>
      guardWrite("Remanejar Orçamento", () => setReallocateOpen(true)),
    handleOpenNewStandaloneCampaign: () =>
      guardWrite("Criar Nova Meta", () => {
        setSharingGoalFor(null);
        setEditingShare(null);
        setEditingShareInitialEdit(false);
        setCreateStandaloneCampaignOpen(true);
      }),
    handleOpenDeposit: (share: PublicShare) =>
      guardWrite("Registrar Aporte na Meta", () => setDepositShare(share)),
    handleManageShare: (share: PublicShare, initialEdit: boolean) => {
      if (initialEdit) {
        guardWrite("Editar Meta Compartilhada", () => {
          setEditingShare(share);
          setEditingShareInitialEdit(true);
        });
        return;
      }
      setEditingShare(share);
      setEditingShareInitialEdit(false);
    },
    handleManageContributions: (share: PublicShare) =>
      guardWrite("Gerenciar Aportes da Meta", () => setManageContributionsShare(share)),
    handleOpenComposition: (share: PublicShare) =>
      guardWrite("Configurar Composição da Meta", () => setCompositionShare(share)),
    kitsModalOpen,
    setKitsModalOpen,
    initialKitId,
    setInitialKitId,
    handleOpenKitsModal: (kitId?: CategoryKitId) => {
      setInitialKitId(kitId);
      setKitsModalOpen(true);
    },
    handleShareGoal: (cat: Category) =>
      guardWrite("Compartilhar Meta", () => setSharingGoalFor(cat)),
  };
}
