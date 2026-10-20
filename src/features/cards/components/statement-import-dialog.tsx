import { useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Alert, Modal } from "@/components/ui";
import {
  STATEMENT_IMPORT_CHUNK_SIZE,
  buildTransactionsFromRows,
  chunkArray,
  generateStatementHash,
  parseStatementInput,
  reconcileStatementTransactions,
  type ColumnMapping,
  type ExistingExpenseForReconciliation,
  type RawParsedRow,
  type ReconciliationItem,
  type StatementTransaction,
} from "@/domain/reconciliation";
import { numberToCents } from "@/domain/money";
import { useCategories, useCardExpenses, usePredictionHistory, useImportStatementExpenses } from "@/state";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type { CreditCard, Expense } from "@/types";
import { StatementUploadStep } from "./statement-upload-step";
import { StatementMappingStep } from "./statement-mapping-step";
import { StatementReconcileStep, type StatementImportProgress } from "./statement-reconcile-step";

interface StatementImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: CreditCard | null;
  competenceMonth: string;
}

type WizardStep = "upload" | "mapping" | "reconcile";

/**
 * Modal orquestrador de Importação e Reconciliação Inteligente de Faturas (Fase 30).
 * Segue o padrão de ciclo de vida "Modal Content with Key Pattern" para isolar o estado.
 */
export function StatementImportDialog({
  open,
  onOpenChange,
  card,
  competenceMonth,
}: StatementImportDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Importar Fatura — ${card?.name ?? "Cartão"} (${competenceMonth})`}
      description="Importe arquivos CSV, OFX ou cole o extrato para conciliação automática e lançamento em lote."
      size="2xl"
    >
      {open && card ? (
        <StatementImportContent
          key={`${card.id}-${competenceMonth}`}
          card={card}
          competenceMonth={competenceMonth}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </Modal>
  );
}

interface StatementImportContentProps {
  card: CreditCard;
  competenceMonth: string;
  onClose: () => void;
}

function StatementImportContent({ card, competenceMonth, onClose }: StatementImportContentProps) {
  const [step, setStep] = useState<WizardStep>("upload");
  const [error, setError] = useState<string | null>(null);

  // Dados parseados em memória
  const [parsedRows, setParsedRows] = useState<RawParsedRow[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(null);
  const [reconciledItems, setReconciledItems] = useState<ReconciliationItem[]>([]);
  const [unmatchedAppExpenses, setUnmatchedAppExpenses] = useState<ExistingExpenseForReconciliation[]>([]);
  const [importProgress, setImportProgress] = useState<StatementImportProgress | null>(null);

  const categoriesQuery = useCategories("expense");
  const expensesQuery = useCardExpenses(card.id);
  const historyQuery = usePredictionHistory(true);
  const importMutation = useImportStatementExpenses();

  const categories = categoriesQuery.data ?? [];
  const defaultCategoryId = categories[0]?.id ?? "";

  const existingExpensesForReconciliation: ExistingExpenseForReconciliation[] = useMemo(() => {
    const expenses: Expense[] = expensesQuery.data ?? [];
    return expenses
      .filter((e) => e.bill_competence === competenceMonth)
      .map((e) => ({
        id: e.id,
        date: e.date,
        description: e.description ?? "",
        valueCents: numberToCents(e.value),
        categoryId: e.category_id,
        installmentNumber: e.installment_number,
        installmentsTotal: e.installments_total,
        statementHash: e.statement_hash,
      }));
  }, [expensesQuery.data, competenceMonth]);

  /**
   * Processa o input de arquivo ou texto inicial.
   */
  const handleProcessInput = (content: string | ArrayBuffer, fileNameOrType: string) => {
    setError(null);
    try {
      const result = parseStatementInput(content, fileNameOrType, {
        cardId: card.id,
        competenceMonth,
      });

      if (result.transactions.length === 0 && result.rows.length === 0) {
        setError("Nenhuma linha de transação válida foi encontrada no extrato.");
        return;
      }

      setParsedRows(result.rows);
      setColumnMapping(result.mapping);

      // Se for OFX, vai direto para reconciliação (OFX já tem campos sem ambiguidade)
      if (result.isOfx || result.rows.length === 0) {
        const reconciliation = reconcileStatementTransactions({
          statementTransactions: result.transactions,
          existingExpenses: existingExpensesForReconciliation,
          history: historyQuery.entries ?? [],
          defaultCategoryId,
        });
        setReconciledItems(reconciliation.items);
        setUnmatchedAppExpenses(reconciliation.unmatchedExistingExpenses);
        setStep("reconcile");
      } else {
        // Se for CSV/Texto com linhas, passa pelo passo 2 de mapeamento/prévia
        setStep("mapping");
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleFileSelect = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      handleProcessInput(buffer, file.name);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleTextSubmit = (text: string) => {
    handleProcessInput(text, "pasted-statement.txt");
  };

  /**
   * Confirma o mapeamento de colunas do Passo 2 e avança para Reconciliação.
   */
  const handleConfirmMapping = (mapping: ColumnMapping) => {
    setColumnMapping(mapping);
    try {
      // Reconstrói as transações com o mapeamento escolhido pelo usuário
      const transactions = buildTransactionsFromRows(parsedRows, mapping, {
        cardId: card.id,
        competenceMonth,
      });

      const reconciliation = reconcileStatementTransactions({
        statementTransactions: transactions,
        existingExpenses: existingExpensesForReconciliation,
        history: historyQuery.entries ?? [],
        defaultCategoryId,
      });

      setReconciledItems(reconciliation.items);
      setUnmatchedAppExpenses(reconciliation.unmatchedExistingExpenses);
      setStep("reconcile");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  /**
   * Alterna a seleção de um item individual na tabela do Passo 3.
   */
  const handleToggleItem = (id: string) => {
    setReconciledItems((prev) =>
      prev.map((it) => (it.transaction.id === id ? { ...it, selected: !it.selected } : it)),
    );
  };

  /**
   * Marca ou desmarca todos os itens visíveis.
   */
  const handleToggleAll = (selected: boolean) => {
    setReconciledItems((prev) => prev.map((it) => ({ ...it, selected })));
  };

  /**
   * Altera a categoria selecionada para um item no Passo 3.
   */
  const handleChangeCategory = (id: string, categoryId: string) => {
    setReconciledItems((prev) =>
      prev.map((it) => (it.transaction.id === id ? { ...it, selectedCategoryId: categoryId } : it)),
    );
  };

  const handleEditItem = (
    id: string,
    updated: {
      date: string;
      cleanDescription: string;
      amountCents: number;
      selectedCategoryId: string;
      installment?: { current: number; total: number };
    },
  ) => {
    setReconciledItems((prev) =>
      prev.map((it) => {
        if (it.transaction.id !== id) return it;
        const newHash = generateStatementHash({
          cardId: card.id,
          competenceMonth,
          date: updated.date,
          amountCents: updated.amountCents,
          cleanDescription: updated.cleanDescription,
          occurrenceIndex: it.transaction.occurrenceIndex,
        });
        return {
          ...it,
          selected: true,
          selectedCategoryId: updated.selectedCategoryId,
          transaction: {
            ...it.transaction,
            date: updated.date,
            cleanDescription: updated.cleanDescription,
            rawDescription: updated.cleanDescription,
            amountCents: updated.amountCents,
            installment: updated.installment,
            statementHash: newHash,
          },
        };
      }),
    );
  };

  const handleRemoveItem = (id: string) => {
    setReconciledItems((prev) => prev.filter((it) => it.transaction.id !== id));
  };

  const handleAddManualItem = (item: {
    date: string;
    cleanDescription: string;
    amountCents: number;
    selectedCategoryId: string;
    installment?: { current: number; total: number };
  }) => {
    const newId = `stmt-manual-${Date.now()}`;
    const newHash = generateStatementHash({
      cardId: card.id,
      competenceMonth,
      date: item.date,
      amountCents: item.amountCents,
      cleanDescription: item.cleanDescription,
      occurrenceIndex: 0,
    });
    const newTx: StatementTransaction = {
      id: newId,
      index: reconciledItems.length,
      occurrenceIndex: 0,
      date: item.date,
      rawDescription: item.cleanDescription,
      cleanDescription: item.cleanDescription,
      amountCents: item.amountCents,
      isRefund: false,
      isPayment: false,
      installment: item.installment,
      statementHash: newHash,
    };
    const newItem: ReconciliationItem = {
      transaction: newTx,
      status: "unmatched_new",
      score: 0,
      suggestedCategoryId: item.selectedCategoryId,
      selectedCategoryId: item.selectedCategoryId,
      selected: true,
      ignoredByDefault: false,
    };
    setReconciledItems((prev) => [newItem, ...prev]);
  };

  const handleUncheckDuplicates = () => {
    setReconciledItems((prev) =>
      prev.map((it) =>
        it.isInternalDuplicate || it.status === "exact_match" ? { ...it, selected: false } : it,
      ),
    );
  };

  /**
   * Submissão final: envia os itens selecionados ao RPC atômico.
   */
  const handleConfirmImport = async () => {
    const toImport = reconciledItems.filter((it) => it.selected);
    if (toImport.length === 0) return;

    setError(null);
    const payload = toImport.map((it) => ({
      date: it.transaction.date,
      value: it.transaction.amountCents / 100,
      category_id: it.selectedCategoryId,
      description: it.transaction.cleanDescription,
      installments_total: it.transaction.installment?.total ?? 1,
      installment_number: it.transaction.installment?.current ?? 1,
      report_weight: 1.0,
      statement_hash: it.transaction.statementHash,
    }));

    const chunks = chunkArray(payload, STATEMENT_IMPORT_CHUNK_SIZE);
    const totalItems = payload.length;
    let totalInserted = 0;
    let totalSkipped = 0;
    let processedItems = 0;
    let currentChunkIndex = 0;

    try {
      setImportProgress({
        currentChunk: 1,
        totalChunks: chunks.length,
        percent: 0,
        processedItems: 0,
        totalItems,
      });

      for (const [i, chunk] of chunks.entries()) {
        currentChunkIndex = i;
        const result = await importMutation.mutateAsync({
          cardId: card.id,
          competenceMonth,
          expenses: chunk,
        });

        totalInserted += result.inserted_count;
        totalSkipped += result.skipped_count;

        processedItems += chunk.length;
        const percent = Math.round((processedItems / totalItems) * 100);

        setImportProgress({
          currentChunk: Math.min(i + 2, chunks.length),
          totalChunks: chunks.length,
          percent,
          processedItems,
          totalItems,
        });
      }

      triggerSensory("success");

      pushToast({
        variant: "default",
        title: `Fatura importada com sucesso: ${totalInserted} ${
          totalInserted === 1 ? "lançamento criado" : "lançamentos criados"
        }${totalSkipped > 0 ? ` (${totalSkipped} duplicatas ignoradas)` : ""}.`,
      });

      onClose();
    } catch (err) {
      triggerSensory("error");
      const baseMessage = getErrorMessage(err);
      if (totalInserted > 0) {
        setError(
          `Importação interrompida no lote ${currentChunkIndex + 1} de ${chunks.length}. ${totalInserted} lançamentos foram salvos com sucesso. Detalhe do erro: ${baseMessage}`,
        );
      } else {
        setError(baseMessage);
      }
    } finally {
      setImportProgress(null);
    }
  };

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="error">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4" aria-hidden />
            <span>{error}</span>
          </div>
        </Alert>
      ) : null}

      {step === "upload" ? (
        <StatementUploadStep onFileSelect={handleFileSelect} onTextSubmit={handleTextSubmit} />
      ) : step === "mapping" && columnMapping ? (
        <StatementMappingStep
          rows={parsedRows}
          initialMapping={columnMapping}
          onConfirmMapping={handleConfirmMapping}
          onBack={() => setStep("upload")}
        />
      ) : step === "reconcile" ? (
        <StatementReconcileStep
          items={reconciledItems}
          unmatchedAppExpenses={unmatchedAppExpenses}
          categories={categories}
          onToggleItem={handleToggleItem}
          onToggleAll={handleToggleAll}
          onChangeCategory={handleChangeCategory}
          onEditItem={handleEditItem}
          onRemoveItem={handleRemoveItem}
          onAddManualItem={handleAddManualItem}
          onUncheckDuplicates={handleUncheckDuplicates}
          onBack={() => setStep(parsedRows.length > 0 ? "mapping" : "upload")}
          onConfirm={handleConfirmImport}
          isPending={importMutation.isPending || importProgress !== null}
          importProgress={importProgress}
        />
      ) : null}
    </div>
  );
}
