import { useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Alert, Modal } from "@/components/ui";
import {
  STATEMENT_IMPORT_CHUNK_SIZE,
  buildTransactionsFromRows,
  chunkBankStatementBatch,
  generateStatementHash,
  parseStatementInput,
  reconcileBankTransactions,
  type ColumnMapping,
  type ExistingExpenseForReconciliation,
  type ExistingIncomeForReconciliation,
  type RawParsedRow,
  type BankTransactionItem,
  type BankTransactionKind,
  type StatementTransaction,
} from "@/domain/reconciliation";
import { numberToCents } from "@/domain/money";
import {
  useCategories,
  useExpenses,
  useIncomes,
  usePredictionHistory,
  useImportBankTransactions,
} from "@/state";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { autoLearnExpenseCategory } from "@/services/merchant-learning";
import type { Expense, Income } from "@/types";
import { BankStatementUploadStep } from "./bank-statement-upload-step";
import { BankStatementMappingStep } from "./bank-statement-mapping-step";
import { BankStatementReconcileStep, type StatementImportProgress } from "./bank-statement-reconcile-step";

interface BankStatementImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competenceMonth: string;
}

type WizardStep = "upload" | "mapping" | "reconcile";

/**
 * Modal orquestrador de Importação e Reconciliação Inteligente de Extratos Bancários (Fase 34).
 * Segue o padrão de ciclo de vida "Modal Content with Key Pattern" para isolar o estado.
 */
export function BankStatementImportDialog({
  open,
  onOpenChange,
  competenceMonth,
}: BankStatementImportDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Importar Extrato Bancário — ${competenceMonth}`}
      description="Importe extratos OFX, planilhas CSV ou cole lançamentos em texto livre para conciliação automática de despesas e receitas."
      size="2xl"
    >
      {open ? (
        <BankStatementImportContent
          key={competenceMonth}
          competenceMonth={competenceMonth}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </Modal>
  );
}

interface BankStatementImportContentProps {
  competenceMonth: string;
  onClose: () => void;
}

function BankStatementImportContent({ competenceMonth, onClose }: BankStatementImportContentProps) {
  const [step, setStep] = useState<WizardStep>("upload");
  const [error, setError] = useState<string | null>(null);

  // Dados parseados em memória
  const [parsedRows, setParsedRows] = useState<RawParsedRow[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(null);
  const [reconciledItems, setReconciledItems] = useState<BankTransactionItem[]>([]);
  const [importProgress, setImportProgress] = useState<StatementImportProgress | null>(null);

  const categoriesQuery = useCategories("expense");
  const incomeCategoriesQuery = useCategories("income");
  const expensesQuery = useExpenses(competenceMonth);
  const incomesQuery = useIncomes(competenceMonth);
  const historyQuery = usePredictionHistory(true);
  const importMutation = useImportBankTransactions();

  const categories = categoriesQuery.data ?? [];
  const defaultCategoryId = categories[0]?.id ?? "";
  const defaultIncomeCategoryId = incomeCategoriesQuery.data?.[0]?.id;

  // Despesas existentes na competência (apenas à vista/débito/PIX/boleto, ignorando cartão de crédito)
  const existingExpensesForReconciliation: ExistingExpenseForReconciliation[] = useMemo(() => {
    const expenses: Expense[] = expensesQuery.data ?? [];
    return expenses
      .filter((e) => e.payment_method !== "credit_card")
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
  }, [expensesQuery.data]);

  // Receitas existentes na competência
  const existingIncomesForReconciliation: ExistingIncomeForReconciliation[] = useMemo(() => {
    const incomes: Income[] = incomesQuery.data ?? [];
    return incomes.map((inc) => ({
      id: inc.id,
      date: inc.date,
      description: inc.description ?? "",
      valueCents: numberToCents(inc.value),
      receiveType: inc.receive_type,
      statementHash: inc.statement_hash,
    }));
  }, [incomesQuery.data]);

  /**
   * Processa o input de arquivo ou texto inicial.
   */
  const handleProcessInput = (content: string | ArrayBuffer, fileNameOrType: string) => {
    setError(null);
    try {
      const result = parseStatementInput(content, fileNameOrType, {
        cardId: "bank_account",
        competenceMonth,
      });

      if (result.transactions.length === 0 && result.rows.length === 0) {
        setError("Nenhuma linha de transação válida foi encontrada no extrato.");
        return;
      }

      setParsedRows(result.rows);
      setColumnMapping(result.mapping);

      // Se for OFX ou CSV/Texto simples com mapeamento de alta confiança, pula direto para a reconciliação
      if (result.isOfx || (result.rows.length > 0 && result.mapping.hasHeader)) {
        const reconciliation = reconcileBankTransactions({
          statementTransactions: result.transactions,
          existingExpenses: existingExpensesForReconciliation,
          existingIncomes: existingIncomesForReconciliation,
          categoryPredictionHistory: historyQuery.entries,
          defaultCategoryId,
        });

        setReconciledItems(reconciliation.items);
        setStep("reconcile");
      } else if (result.rows.length > 0) {
        setStep("mapping");
      } else {
        const reconciliation = reconcileBankTransactions({
          statementTransactions: result.transactions,
          existingExpenses: existingExpensesForReconciliation,
          existingIncomes: existingIncomesForReconciliation,
          categoryPredictionHistory: historyQuery.entries,
          defaultCategoryId,
        });

        setReconciledItems(reconciliation.items);
        setStep("reconcile");
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (content) {
        handleProcessInput(content, file.name);
      }
    };
    reader.onerror = () => {
      setError("Erro ao ler o arquivo selecionado.");
    };

    if (file.name.toLowerCase().endsWith(".ofx") || file.name.toLowerCase().endsWith(".csv")) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleTextSubmit = (text: string) => {
    handleProcessInput(text, "pasted.txt");
  };

  const handleConfirmMapping = (mapping: ColumnMapping) => {
    setColumnMapping(mapping);

    const transactions = buildTransactionsFromRows(parsedRows, mapping, {
      cardId: "bank_account",
      competenceMonth,
    });

    if (transactions.length === 0) {
      setError("Nenhuma transação válida gerada com o mapeamento selecionado.");
      return;
    }

    const reconciliation = reconcileBankTransactions({
      statementTransactions: transactions,
      existingExpenses: existingExpensesForReconciliation,
      existingIncomes: existingIncomesForReconciliation,
      categoryPredictionHistory: historyQuery.entries,
      defaultCategoryId,
    });

    setReconciledItems(reconciliation.items);
    setStep("reconcile");
  };

  const handleToggleItem = (id: string) => {
    setReconciledItems((prev) =>
      prev.map((it) => (it.transaction.id === id ? { ...it, selected: !it.selected } : it)),
    );
  };

  const handleToggleAll = (selected: boolean) => {
    setReconciledItems((prev) => prev.map((it) => ({ ...it, selected })));
  };

  const handleChangeCategory = (id: string, categoryId: string) => {
    setReconciledItems((prev) =>
      prev.map((it) => (it.transaction.id === id ? { ...it, selectedCategoryId: categoryId } : it)),
    );
    const targetItem = reconciledItems.find((it) => it.transaction.id === id);
    if (targetItem && targetItem.kind === "expense" && categoryId) {
      autoLearnExpenseCategory(
        targetItem.transaction.cleanDescription,
        categoryId,
        undefined,
        targetItem.transaction.rawDescription,
      );
    }
  };

  const handleChangeReceiveType = (id: string, receiveType: string) => {
    setReconciledItems((prev) =>
      prev.map((it) => (it.transaction.id === id ? { ...it, selectedReceiveType: receiveType } : it)),
    );
  };

  const handleEditItem = (
    id: string,
    updated: {
      date: string;
      cleanDescription: string;
      amountCents: number;
      kind: BankTransactionKind;
      selectedCategoryId: string;
      selectedReceiveType?: string;
    },
  ) => {
    const existing = reconciledItems.find((it) => it.transaction.id === id);
    if (updated.kind === "expense" && updated.selectedCategoryId) {
      autoLearnExpenseCategory(
        updated.cleanDescription,
        updated.selectedCategoryId,
        undefined,
        existing?.transaction.rawDescription,
      );
    }
    setReconciledItems((prev) =>
      prev.map((it) => {
        if (it.transaction.id !== id) return it;
        const newHash = generateStatementHash({
          cardId: "bank_account",
          competenceMonth,
          date: updated.date,
          amountCents: updated.amountCents,
          cleanDescription: updated.cleanDescription,
          occurrenceIndex: it.transaction.occurrenceIndex,
        });
        return {
          ...it,
          selected: true,
          kind: updated.kind,
          selectedCategoryId: updated.selectedCategoryId,
          selectedReceiveType: updated.selectedReceiveType,
          transaction: {
            ...it.transaction,
            date: updated.date,
            cleanDescription: updated.cleanDescription,
            rawDescription: updated.cleanDescription,
            amountCents: updated.amountCents,
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
    kind: BankTransactionKind;
    selectedCategoryId: string;
    selectedReceiveType?: string;
  }) => {
    const newId = `stmt-manual-${Date.now()}`;
    const newHash = generateStatementHash({
      cardId: "bank_account",
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
      isRefund: item.kind === "income",
      isPayment: false,
      statementHash: newHash,
    };
    const newItem: BankTransactionItem = {
      transaction: newTx,
      kind: item.kind,
      status: "unmatched_new",
      score: 0,
      suggestedCategoryId: item.selectedCategoryId,
      selectedCategoryId: item.selectedCategoryId,
      suggestedReceiveType: item.selectedReceiveType,
      selectedReceiveType: item.selectedReceiveType,
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

  const handleFinalImport = async () => {
    setError(null);
    const selectedItems = reconciledItems.filter((it) => it.selected);
    if (selectedItems.length === 0) {
      setError("Selecione ao menos uma transação para importar.");
      return;
    }

    const expensesPayload = selectedItems
      .filter((it) => it.kind === "expense")
      .map((it) => ({
        category_id: it.selectedCategoryId || defaultCategoryId,
        value: it.transaction.amountCents / 100,
        date: it.transaction.date,
        description: it.transaction.cleanDescription,
        statement_hash: it.transaction.statementHash,
        payment_method: "cash",
        report_weight: 1.0,
      }));

    const incomesPayload = selectedItems
      .filter((it) => it.kind === "income")
      .map((it) => ({
        category_id: it.selectedCategoryId || defaultIncomeCategoryId || undefined,
        value: it.transaction.amountCents / 100,
        date: it.transaction.date,
        description: it.transaction.cleanDescription,
        receive_type: it.selectedReceiveType || "other",
        statement_hash: it.transaction.statementHash,
      }));

    const chunks = chunkBankStatementBatch(
      expensesPayload,
      incomesPayload,
      STATEMENT_IMPORT_CHUNK_SIZE,
    );

    const totalItems = expensesPayload.length + incomesPayload.length;
    let totalExpensesInserted = 0;
    let totalIncomesInserted = 0;
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
          expenses: chunk.expenses,
          incomes: chunk.incomes,
        });

        totalExpensesInserted += result.expenses_inserted;
        totalIncomesInserted += result.incomes_inserted;

        processedItems += chunk.expenses.length + chunk.incomes.length;
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

      const totalInserted = totalExpensesInserted + totalIncomesInserted;
      pushToast({
        title: "Extrato importado com sucesso!",
        description: `${totalInserted} lançamentos adicionados (${totalExpensesInserted} despesas e ${totalIncomesInserted} receitas).`,
        variant: "success",
      });

      onClose();
    } catch (err) {
      triggerSensory("error");
      const baseMessage = getErrorMessage(err);
      const insertedSoFar = totalExpensesInserted + totalIncomesInserted;
      if (insertedSoFar > 0) {
        setError(
          `Importação interrompida no lote ${currentChunkIndex + 1} de ${chunks.length}. ${insertedSoFar} itens foram gravados com sucesso. Detalhe do erro: ${baseMessage}`,
        );
      } else {
        setError(baseMessage);
      }
    } finally {
      setImportProgress(null);
    }
  };

  return (
    <div className="space-y-4 py-2">
      {error && (
        <Alert variant="error" className="text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        </Alert>
      )}

      {step === "upload" && (
        <BankStatementUploadStep
          onFileSelect={handleFileSelect}
          onTextSubmit={handleTextSubmit}
        />
      )}

      {step === "mapping" && columnMapping && (
        <BankStatementMappingStep
          rows={parsedRows}
          initialMapping={columnMapping}
          onConfirmMapping={handleConfirmMapping}
          onBack={() => setStep("upload")}
        />
      )}

      {step === "reconcile" && (
        <BankStatementReconcileStep
          items={reconciledItems}
          categories={categories}
          onToggleItem={handleToggleItem}
          onToggleAll={handleToggleAll}
          onChangeCategory={handleChangeCategory}
          onChangeReceiveType={handleChangeReceiveType}
          onEditItem={handleEditItem}
          onRemoveItem={handleRemoveItem}
          onAddManualItem={handleAddManualItem}
          onUncheckDuplicates={handleUncheckDuplicates}
          onBack={() => setStep(parsedRows.length > 0 ? "mapping" : "upload")}
          onConfirm={handleFinalImport}
          isPending={importMutation.isPending || importProgress !== null}
          importProgress={importProgress}
        />
      )}
    </div>
  );
}
