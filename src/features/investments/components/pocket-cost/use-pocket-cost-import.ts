import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildPocketImportPayloads,
  computePocketCostSummary,
  deduplicateStatementRows,
  filterHistoricalContributions,
  parsePocketStatementText,
  type StatementParseResult,
} from "@/domain/portfolio/pocket-statement-parser";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import {
  useBatchCreateHistoricalContributions,
  useBatchUpsertPortfolioSnapshots,
  useDeletePortfolioContribution,
  usePortfolioContributions,
  usePortfolioSnapshots,
} from "@/state";
import { usePocketCostManual } from "./use-pocket-cost-manual";

export function usePocketCostImport(params: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCostBRL: number;
  onSuccess?: () => void;
}) {
  const { open, onOpenChange, defaultCostBRL, onSuccess } = params;

  const contributionsQuery = usePortfolioContributions();
  const snapshotsQuery = usePortfolioSnapshots();
  const deleteContribution = useDeletePortfolioContribution();
  const batchCreateHistorical = useBatchCreateHistoricalContributions();
  const batchUpsertSnapshots = useBatchUpsertPortfolioSnapshots();

  const [activeTab, setActiveTab] = useState<string>("manual");
  const [statementText, setStatementText] = useState<string>("");
  const [parseResult, setParseResult] = useState<StatementParseResult | null>(null);
  const [replaceExisting, setReplaceExisting] = useState<boolean>(true);
  const [isImporting, setIsImporting] = useState<boolean>(false);

  const refetchContributions = contributionsQuery.refetch;
  const refetchSnapshots = snapshotsQuery.refetch;
  const refetchContribRef = useRef(refetchContributions);
  const refetchSnapshotsRef = useRef(refetchSnapshots);

  useEffect(() => {
    refetchContribRef.current = refetchContributions;
    refetchSnapshotsRef.current = refetchSnapshots;
  }, [refetchContributions, refetchSnapshots]);

  useEffect(() => {
    if (open) {
      void refetchContribRef.current?.();
      void refetchSnapshotsRef.current?.();
    }
  }, [open]);

  const historicalContributions = useMemo(
    () => filterHistoricalContributions(contributionsQuery.data ?? []),
    [contributionsQuery.data],
  );

  const snapshotsData = snapshotsQuery.data;
  const snapshotsCount = snapshotsData?.length ?? 0;
  const snapshotsByMonth = useMemo(() => {
    const map = new Map<string, NonNullable<typeof snapshotsData>[number]>();
    for (const s of snapshotsData ?? []) {
      map.set(s.month, s);
    }
    return map;
  }, [snapshotsData]);

  const summary = useMemo(
    () => computePocketCostSummary(historicalContributions),
    [historicalContributions],
  );

  const manual = usePocketCostManual({
    historicalContributions,
    snapshotsByMonth,
    defaultCostBRL,
    refetchContributions: contributionsQuery.refetch,
    refetchSnapshots: snapshotsQuery.refetch,
    onOpenChange,
    onSuccess,
  });

  const handleProcessStatement = () => {
    if (!statementText.trim()) {
      pushToast({ title: "Texto vazio", description: "Cole o conteúdo do seu extrato antes de analisar.", variant: "warning" });
      return;
    }

    const result = parsePocketStatementText(statementText);
    setParseResult(result);

    if (result.actionableRows.length === 0) {
      pushToast({
        title: "Nenhum marco detectado",
        description: "Verifique se o texto contém colunas com Mês/Ano e Valor Aplicado.",
        variant: "warning",
      });
    } else {
      pushToast({
        title: "Extrato processado com sucesso!",
        description: `${result.actionableRows.length} movimentação(ões) identificada(s).`,
        variant: "success",
      });
    }
  };

  const handleConfirmImportStatement = async () => {
    if (!parseResult || parseResult.actionableRows.length === 0) return;

    setIsImporting(true);
    try {
      if (replaceExisting && historicalContributions.length > 0) {
        for (const item of historicalContributions) {
          await deleteContribution.mutateAsync(item.id);
        }
      }

      let rowsToImport = parseResult.actionableRows;
      if (!replaceExisting && historicalContributions.length > 0) {
        const { newRows, skippedExistingRows } = deduplicateStatementRows(
          historicalContributions,
          parseResult.actionableRows,
        );
        rowsToImport = newRows;

        if (newRows.length === 0) {
          pushToast({
            title: "Nenhum marco novo para importar",
            description: `Todos os ${skippedExistingRows.length} meses do extrato já constam na linha do tempo.`,
            variant: "warning",
          });
          setIsImporting(false);
          return;
        }

        if (skippedExistingRows.length > 0) {
          pushToast({
            title: "Meses duplicados ignorados",
            description: `${skippedExistingRows.length} movimentações já existentes foram mantidas intactas.`,
            variant: "default",
          });
        }
      }

      const { contributionPayloads, snapshotPayloads } = buildPocketImportPayloads(
        rowsToImport,
        parseResult.rows,
      );

      await batchCreateHistorical.mutateAsync(contributionPayloads);

      if (snapshotPayloads.length > 0) {
        await batchUpsertSnapshots.mutateAsync(snapshotPayloads);
        await snapshotsQuery.refetch?.();
      }

      await contributionsQuery.refetch?.();
      setStatementText("");
      setParseResult(null);
      setActiveTab("manual");
      triggerSensory("success");
      pushToast({
        title: "Marcos importados com sucesso!",
        description: `${contributionPayloads.length} novo(s) marco(s) adicionado(s) à carteira.`,
        variant: "success",
      });
      onSuccess?.();
    } catch (err) {
      pushToast({ title: "Erro ao importar marcos", description: getErrorMessage(err), variant: "destructive" });
      triggerSensory("error");
    } finally {
      setIsImporting(false);
    }
  };

  return {
    activeTab,
    setActiveTab,
    historicalContributions,
    snapshotsCount,
    snapshotsByMonth,
    summary,
    statementText,
    setStatementText,
    parseResult,
    replaceExisting,
    setReplaceExisting,
    isImporting,
    handleProcessStatement,
    handleConfirmImportStatement,
    ...manual,
  };
}
