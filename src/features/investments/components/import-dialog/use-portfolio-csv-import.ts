import { useMemo, useState } from "react";
import { todayLocalIso } from "@/lib/date";
import {
  parseB3ImportSource,
  parsePortfolioFromMapping,
  recalculateImportRowValues,
  type ParsedPortfolioImportRow,
  type PortfolioColumnMapping,
  type RawPortfolioRow,
} from "@/domain/portfolio/b3-csv-parser";
import { parseXlsxToCsv } from "@/domain/portfolio";
import { pushToast } from "@/services/toast";
import { usePortfolioAssets } from "@/state";
import { usePortfolioImportConfirm } from "./use-portfolio-import-confirm";

export function usePortfolioCsvImport(onOpenChange: (open: boolean) => void) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rawRows, setRawRows] = useState<RawPortfolioRow[]>([]);
  const [columnMapping, setColumnMapping] = useState<PortfolioColumnMapping | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedPortfolioImportRow[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const { data: existingAssets = [] } = usePortfolioAssets();
  const existingTickerMap = useMemo(
    () => new Map(existingAssets.map((a) => [a.ticker.trim().toUpperCase(), a])),
    [existingAssets],
  );

  const handleClose = () => {
    setStep(1);
    setRawRows([]);
    setColumnMapping(null);
    setParsedRows([]);
    setSelectedIndices(new Set());
    setEditingIndex(null);
    onOpenChange(false);
  };

  const { isProcessing, confirmImport } = usePortfolioImportConfirm({
    existingAssets,
    existingTickerMap,
    onSuccessClose: handleClose,
  });

  const handleProcessInput = (inputText: string) => {
    const parsedSource = parseB3ImportSource(inputText);
    if (parsedSource.kind === "empty") {
      pushToast({
        title: "Conteúdo vazio",
        description: "Cole o texto ou selecione um arquivo de planilha com suas operações.",
        variant: "destructive",
      });
      return;
    }

    if (parsedSource.kind === "mapping") {
      setRawRows(parsedSource.rows);
      setColumnMapping(parsedSource.mapping);
      setStep(2);
      return;
    }

    if (parsedSource.rows.length === 0) {
      pushToast({
        title: "Nenhuma operação identificada",
        description: "Verifique o formato do texto colado ou o arquivo CSV e tente novamente.",
        variant: "destructive",
      });
      return;
    }

    setParsedRows(parsedSource.rows);
    setSelectedIndices(new Set(parsedSource.rows.map((_, i) => i)));
    setStep(3);
  };

  const handleFileUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    try {
      const isXlsx =
        file.name.toLowerCase().endsWith(".xlsx") ||
        file.name.toLowerCase().endsWith(".xls") ||
        file.type.includes("spreadsheetml") ||
        file.type.includes("excel");

      const content = isXlsx ? await parseXlsxToCsv(await file.arrayBuffer()) : await file.text();
      if (!content) {
        pushToast({
          title: "Planilha vazia ou ilegível",
          description: "Não foi possível extrair dados da planilha selecionada.",
          variant: "destructive",
        });
        return;
      }

      handleProcessInput(content);
    } catch {
      pushToast({
        title: "Falha ao ler arquivo",
        description: "Não foi possível processar o arquivo selecionado.",
        variant: "destructive",
      });
    }
  };

  const handleConfirmMapping = (mapping: PortfolioColumnMapping) => {
    setColumnMapping(mapping);
    const rows = parsePortfolioFromMapping(rawRows, mapping);
    if (rows.length === 0) {
      pushToast({
        title: "Nenhum lançamento identificado com esse mapeamento",
        description: "Verifique as colunas selecionadas e tente novamente.",
        variant: "destructive",
      });
      return;
    }

    setParsedRows(rows);
    setSelectedIndices(new Set(rows.map((_, i) => i)));
    setStep(3);
  };

  const toggleSelectAll = () => {
    setSelectedIndices(
      selectedIndices.size === parsedRows.length ? new Set() : new Set(parsedRows.map((_, i) => i)),
    );
  };

  const toggleIndex = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const updateParsedRow = (index: number, updates: Partial<ParsedPortfolioImportRow>) => {
    setParsedRows((prev) => {
      const copy = [...prev];
      const target = copy[index];
      if (!target) return prev;
      copy[index] = recalculateImportRowValues(target, updates);
      return copy;
    });
  };

  const removeParsedRow = (index: number) => {
    setParsedRows((prev) => prev.filter((_, i) => i !== index));
    setSelectedIndices((prev) => {
      const next = new Set<number>();
      for (const idx of prev) {
        if (idx < index) next.add(idx);
        else if (idx > index) next.add(idx - 1);
      }
      return next;
    });
    if (editingIndex === index) setEditingIndex(null);
    else if (editingIndex !== null && editingIndex > index) setEditingIndex(editingIndex - 1);
  };

  const addNewRow = () => {
    const newRow: ParsedPortfolioImportRow = {
      date: todayLocalIso(),
      ticker: "NOVO3",
      type: "buy",
      quantity: 100,
      price: 10,
      total: 1000,
      assetClass: "Ações",
      currency: "BRL",
      rawText: "manual",
    };
    setParsedRows((prev) => [newRow, ...prev]);
    setSelectedIndices((prev) => {
      const next = new Set<number>([0]);
      for (const idx of prev) next.add(idx + 1);
      return next;
    });
    setEditingIndex(0);
  };

  const handleConfirmImport = () =>
    confirmImport(parsedRows.filter((_, i) => selectedIndices.has(i)));

  return {
    step,
    setStep,
    rawRows,
    columnMapping,
    parsedRows,
    selectedIndices,
    editingIndex,
    setEditingIndex,
    isProcessing,
    existingTickerMap,
    handleClose,
    handleProcessInput,
    handleFileUpload,
    handleConfirmMapping,
    toggleSelectAll,
    toggleIndex,
    updateParsedRow,
    removeParsedRow,
    addNewRow,
    handleConfirmImport,
  };
}
