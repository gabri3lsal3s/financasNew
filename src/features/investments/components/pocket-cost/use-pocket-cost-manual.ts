import { useRef, useState } from "react";
import { numberToCents } from "@/domain/money";
import {
  buildPocketContributionNotes,
  cleanContributionNotes,
  extractExplicitRateFromNotes,
  isHistoricalWithdrawal,
} from "@/domain/portfolio/pocket-statement-parser";
import { nextConsecutiveMonthDate, todayISO } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import {
  useCreateHistoricalContribution,
  useDeletePortfolioContribution,
  useUpdatePortfolioContribution,
  useUpsertMarcoZero,
  useUpsertPortfolioSnapshot,
} from "@/state";
import type { PortfolioContribution, PortfolioSnapshot } from "@/types";

export function usePocketCostManual(params: {
  historicalContributions: readonly PortfolioContribution[];
  snapshotsByMonth: ReadonlyMap<string, PortfolioSnapshot>;
  defaultCostBRL: number;
  refetchContributions?: () => Promise<unknown>;
  refetchSnapshots?: () => Promise<unknown>;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const {
    historicalContributions,
    snapshotsByMonth,
    defaultCostBRL,
    refetchContributions,
    refetchSnapshots,
    onOpenChange,
    onSuccess,
  } = params;

  const createHistorical = useCreateHistoricalContribution();
  const updateHistorical = useUpdatePortfolioContribution();
  const deleteContribution = useDeletePortfolioContribution();
  const upsertMarcoZero = useUpsertMarcoZero();
  const upsertSnapshot = useUpsertPortfolioSnapshot();

  const formRef = useRef<HTMLFormElement>(null);
  const [editingMarco, setEditingMarco] = useState<PortfolioContribution | null>(null);
  const [entryType, setEntryType] = useState<"aporte" | "resgate">("aporte");
  const [newAmountCents, setNewAmountCents] = useState<number>(() =>
    historicalContributions.length === 0 && defaultCostBRL > 0 ? numberToCents(defaultCostBRL) : 0,
  );
  const [newGrossBalanceCents, setNewGrossBalanceCents] = useState<number>(0);
  const [newRatePctText, setNewRatePctText] = useState<string>("");
  const [newDate, setNewDate] = useState<string>(() => todayISO());
  const [newNotes, setNewNotes] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const initialLastAporte = () => {
    for (const c of historicalContributions) {
      if (!isHistoricalWithdrawal(c) && Number(c.amount) > 0) {
        return numberToCents(Number(c.amount));
      }
    }
    return 0;
  };
  const [lastAporteCents, setLastAporteCents] = useState<number>(initialLastAporte);

  const [quickDate, setQuickDate] = useState<string>(() => todayISO());
  const [quickAmountCents, setQuickAmountCents] = useState<number>(() =>
    defaultCostBRL > 0 ? numberToCents(defaultCostBRL) : 0,
  );

  const handleZeroAporte = () => {
    setEntryType("aporte");
    setNewAmountCents(0);
    setFormError(null);
  };

  const handleRepeatLastAporte = () => {
    if (lastAporteCents > 0) {
      setEntryType("aporte");
      setNewAmountCents(lastAporteCents);
      setFormError(null);
    }
  };

  const handleSelectDate = (date: string) => {
    setNewDate(date);
    setFormError(null);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const handleStartEdit = (marco: PortfolioContribution) => {
    setEditingMarco(marco);
    setEntryType(isHistoricalWithdrawal(marco) ? "resgate" : "aporte");
    setNewDate(marco.date);
    setNewAmountCents(numberToCents(Number(marco.amount)));

    const existingSnap = snapshotsByMonth.get(marco.date.slice(0, 7));
    setNewGrossBalanceCents(existingSnap ? numberToCents(existingSnap.total_value) : 0);

    const existingRate = extractExplicitRateFromNotes(marco.notes);
    setNewRatePctText(
      existingRate !== null ? (existingRate > 0 ? `+${existingRate}` : `${existingRate}`) : "",
    );

    setNewNotes(cleanContributionNotes(marco.notes));
    setFormError(null);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const handleCancelEdit = () => {
    setEditingMarco(null);
    setEntryType("aporte");
    setNewAmountCents(0);
    setNewGrossBalanceCents(0);
    setNewRatePctText("");
    setNewDate(todayISO());
    setNewNotes("");
    setFormError(null);
  };

  const handleSubmitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newAmountCents <= 0 && newGrossBalanceCents <= 0) {
      setFormError("Informe o valor do aporte/resgate ou o saldo da carteira no fim do mês.");
      return;
    }
    if (!newDate) {
      setFormError("Selecione a data do marco histórico.");
      return;
    }

    setFormError(null);
    try {
      const finalNotes = buildPocketContributionNotes({
        entryType,
        notes: newNotes,
        ratePctText: newRatePctText,
        existingNotes: editingMarco?.notes,
        isFirstMarco: historicalContributions.length === 0,
      });

      if (newAmountCents > 0) {
        if (editingMarco) {
          await updateHistorical.mutateAsync({
            id: editingMarco.id,
            input: { date: newDate, amount: newAmountCents / 100, notes: finalNotes },
          });
        } else {
          await createHistorical.mutateAsync({
            date: newDate,
            amount: newAmountCents / 100,
            notes: finalNotes,
          });
          if (entryType === "aporte") {
            setLastAporteCents(newAmountCents);
          }
        }
      }

      if (newGrossBalanceCents > 0) {
        await upsertSnapshot.mutateAsync({
          month: newDate.slice(0, 7),
          total_value: newGrossBalanceCents / 100,
          total_cost: newAmountCents > 0 ? newAmountCents / 100 : 0,
          status: "closed",
          closing_date: newDate,
        });
        await refetchSnapshots?.();
      }

      await refetchContributions?.();

      if (editingMarco) {
        setEditingMarco(null);
      } else {
        // Avanço temporal sequencial inteligente (§Ergonomia):
        setNewDate((prev) => nextConsecutiveMonthDate(prev));
      }

      setNewAmountCents(0);
      setNewGrossBalanceCents(0);
      setNewRatePctText("");
      setNewNotes("");
      triggerSensory("success");
      onSuccess?.();
    } catch (err) {
      setFormError(getErrorMessage(err));
      triggerSensory("error");
    }
  };

  const handleDeleteMarco = async (contribution: PortfolioContribution) => {
    setDeletingId(contribution.id);
    try {
      await deleteContribution.mutateAsync(contribution.id);
      await refetchContributions?.();
      triggerSensory("destructive");
      pushToast({
        title: "Marco histórico removido",
        description: "A linha do tempo da TIR foi recalculada.",
        variant: "default",
      });
      if (editingMarco?.id === contribution.id) handleCancelEdit();
      onSuccess?.();
    } catch (err) {
      pushToast({ title: "Erro ao excluir marco", description: getErrorMessage(err), variant: "destructive" });
      triggerSensory("error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveQuick = async () => {
    if (quickAmountCents <= 0) {
      pushToast({ title: "Valor inválido", description: "Informe o capital total desembolsado do seu bolso.", variant: "warning" });
      return;
    }

    try {
      await upsertMarcoZero.mutateAsync({
        date: quickDate,
        amount: quickAmountCents / 100,
        notes: "Marco Histórico Consolidado",
      });
      await refetchContributions?.();
      triggerSensory("success");
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      pushToast({ title: "Erro ao salvar marco consolidado", description: getErrorMessage(err), variant: "destructive" });
      triggerSensory("error");
    }
  };

  return {
    formRef,
    editingMarco,
    entryType,
    setEntryType,
    newAmountCents,
    setNewAmountCents,
    newGrossBalanceCents,
    setNewGrossBalanceCents,
    newRatePctText,
    setNewRatePctText,
    newDate,
    setNewDate,
    newNotes,
    setNewNotes,
    formError,
    deletingId,
    lastAporteCents,
    handleZeroAporte,
    handleRepeatLastAporte,
    handleSelectDate,
    isPendingManual: createHistorical.isPending || updateHistorical.isPending,
    handleStartEdit,
    handleCancelEdit,
    handleSubmitManual,
    handleDeleteMarco,
    quickDate,
    setQuickDate,
    quickAmountCents,
    setQuickAmountCents,
    isSavingQuick: upsertMarcoZero.isPending,
    handleSaveQuick,
  };
}
