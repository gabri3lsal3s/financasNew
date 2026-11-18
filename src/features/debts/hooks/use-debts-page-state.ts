import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { calculateDebtsSummary, todayISO } from "@/domain/debts";
import { useCreateDeepLink } from "@/hooks/use-create-deep-link";
import { useHighlightTarget } from "@/hooks/use-highlight-target";
import { currentMonth } from "@/lib/date";
import { useDebts, useDeleteDebt, useLoans, usePermission, useUpdateDebt } from "@/state";
import type { Debt, InstallmentDeleteMode } from "@/types";
import { useExportDebtsCsv } from "./use-export-debts-csv";

export type DebtsTabKey = "payable" | "receivable" | "loans";

/** Gerencia estado, filtros por aba, guardas read-only e mutações de Contas & Dívidas. */
export function useDebtsPageState() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const permission = usePermission("debts");

  const debtsQuery = useDebts();
  const loansQuery = useLoans();
  const deleteDebt = useDeleteDebt();
  const updateDebt = useUpdateDebt();
  const exportCsv = useExportDebtsCsv();

  const { highlightId } = useHighlightTarget("q");
  const { open: formOpen, setOpen: setFormOpen } = useCreateDeepLink("divida");

  const [showPaid, setShowPaid] = useState(false);
  const [pickedTab, setPickedTab] = useState<DebtsTabKey>("payable");
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [settling, setSettling] = useState<Debt | null>(null);
  const [loanFormOpen, setLoanFormOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeContext, setUpgradeContext] = useState<string | undefined>();

  const paramType = searchParams.get("type");
  const tab: DebtsTabKey =
    paramType === "receivable" || paramType === "payable" || paramType === "loans"
      ? paramType
      : pickedTab;

  const handleTabChange = (next: DebtsTabKey) => {
    setPickedTab(next);
    setSearchParams(
      (prev) => {
        const updated = new URLSearchParams(prev);
        updated.delete("type");
        return updated;
      },
      { replace: true },
    );
  };

  const requireUpgrade = (context?: string) => {
    setUpgradeContext(context);
    setUpgradeOpen(true);
  };

  const handleOpenDebtForm = (debt: Debt | null) => {
    if (permission.isReadOnlyMode) {
      requireUpgrade(debt ? "Editar Dívida / Conta" : "Cadastrar Nova Dívida");
      return;
    }
    setEditingDebt(debt);
    setFormOpen(true);
  };

  const handleOpenLoanForm = () => {
    if (permission.isReadOnlyMode) {
      requireUpgrade("Cadastrar Contrato de Crédito");
      return;
    }
    setLoanFormOpen(true);
  };

  const handleSettle = (debt: Debt) => {
    if (permission.isReadOnlyMode) {
      requireUpgrade("Quitar Dívida / Baixar Conta");
      return;
    }
    setSettling(debt);
  };

  const handleUnsettle = async (debt: Debt) => {
    if (permission.isReadOnlyMode) {
      requireUpgrade("Desmarcar Quitação de Conta");
      return;
    }
    try {
      await updateDebt.mutateAsync({ id: debt.id, input: { paid_at: null } });
    } catch {
      // Erro tratado pela infraestrutura de mutação
    }
  };

  const handleDeleteDebt = async (debt: Debt, mode?: InstallmentDeleteMode) => {
    await deleteDebt.mutateAsync({ id: debt.id, mode });
  };

  const debts = useMemo(() => debtsQuery.data ?? [], [debtsQuery.data]);
  const loans = useMemo(() => loansQuery.data ?? [], [loansQuery.data]);
  const payableDebts = useMemo(() => debts.filter((d) => d.type === "payable"), [debts]);
  const receivableDebts = useMemo(() => debts.filter((d) => d.type === "receivable"), [debts]);
  const debtsSummary = useMemo(() => calculateDebtsSummary(debts), [debts]);

  const today = todayISO();
  const thisMonth = currentMonth();
  const error = debtsQuery.error || loansQuery.error;

  const handleExportDebtsCsv = () => {
    exportCsv({ tab, loans, payableDebts, receivableDebts, showPaid, today });
  };

  const refetchAll = () => {
    void Promise.all([debtsQuery.refetch(), loansQuery.refetch()]);
  };

  const isExportDisabled =
    tab === "loans"
      ? loans.length === 0
      : (tab === "payable" ? payableDebts : receivableDebts).length === 0;

  return {
    navigate,
    permission,
    tab,
    handleTabChange,
    debts,
    loans,
    payableDebts,
    receivableDebts,
    debtsSummary,
    debtsLoading: debtsQuery.isLoading,
    loansLoading: loansQuery.isLoading,
    error,
    today,
    thisMonth,
    highlightId,
    showPaid,
    setShowPaid,
    formOpen,
    setFormOpen,
    editingDebt,
    setEditingDebt,
    settling,
    setSettling,
    loanFormOpen,
    setLoanFormOpen,
    upgradeOpen,
    setUpgradeOpen,
    upgradeContext,
    requireUpgrade,
    handleOpenDebtForm,
    handleOpenLoanForm,
    handleSettle,
    handleUnsettle,
    handleDeleteDebt,
    handleExportDebtsCsv,
    isExportDisabled,
    refetchAll,
  };
}
