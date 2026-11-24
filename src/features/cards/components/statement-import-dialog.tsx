import { useId } from "react";
import { AlertCircle, Check, RotateCcw } from "lucide-react";
import { Alert, Button, Modal, ModalFooter } from "@/components/ui";
import { monthLabel } from "@/lib/date";
import type { CreditCard } from "@/types";
import { StatementMappingStep } from "./statement-mapping-step";
import { StatementReconcileStep } from "./statement-reconcile-step";
import { StatementUploadStep } from "./statement-upload-step";
import { useStatementImport } from "./use-statement-import";

export interface StatementImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: CreditCard | null;
  competenceMonth: string;
  userId?: string | null;
  isReadOnlyMode?: boolean;
  aiExtractionEnabled?: boolean;
  onCompetenceChange?: (newMonth: string) => void;
}

interface StatementImportContentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: CreditCard;
  competenceMonth: string;
  userId?: string | null;
  isReadOnlyMode?: boolean;
  aiExtractionEnabled?: boolean;
  onCompetenceChange?: (newMonth: string) => void;
}

function StatementImportContent({
  open,
  onOpenChange,
  card,
  competenceMonth,
  userId,
  isReadOnlyMode,
  aiExtractionEnabled,
  onCompetenceChange,
}: StatementImportContentProps) {
  const mappingFormId = useId();
  const state = useStatementImport({
    card,
    competenceMonth,
    userId,
    isReadOnlyMode,
    aiExtractionEnabled,
    onClose: () => onOpenChange(false),
    onCompetenceChange,
  });

  const handleBackFromReconcile = () => {
    if (state.usedAiStructurer || state.parsedRows.length === 0) {
      state.setStep("upload");
    } else {
      state.setStep("mapping");
    }
  };

  const footer =
    state.step === "mapping" ? (
      <ModalFooter borderless>
        <Button type="button" variant="outline" onClick={() => state.setStep("upload")}>
          <RotateCcw className="size-4" aria-hidden="true" />
          Voltar
        </Button>
        <Button type="submit" form={mappingFormId}>
          Avançar para Conferência
        </Button>
      </ModalFooter>
    ) : state.step === "reconcile" ? (
      <ModalFooter borderless>
        <Button
          type="button"
          variant="outline"
          onClick={handleBackFromReconcile}
          disabled={state.isPending}
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Voltar
        </Button>
        <Button
          type="button"
          sensoryIntent={false}
          disabled={state.selectedCount === 0 || state.isPending}
          onClick={() => void state.handleConfirmImport()}
        >
          {state.isPending ? (
            state.importProgress && state.importProgress.totalChunks > 1 ? (
              `Importando (${state.importProgress.percent}%)...`
            ) : (
              "Importando..."
            )
          ) : (
            <>
              <Check className="size-4" aria-hidden="true" />
              <span>
                Importar {state.selectedCount > 0 ? state.selectedCount : ""}{" "}
                {state.selectedCount === 1 ? "Lançamento" : "Lançamentos"}
              </span>
            </>
          )}
        </Button>
      </ModalFooter>
    ) : undefined;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Importar Fatura — ${card.name}`}
      description={`Competência de ${monthLabel(state.activeCompetenceMonth)} · Concilie faturas via PDF, CSV, OFX, Excel, prints ou texto colado.`}
      size="3xl"
      footer={footer}
    >
      <div className="space-y-4">
        {state.error ? (
          <Alert variant="error">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              <span>{state.error}</span>
            </div>
          </Alert>
        ) : null}

        {state.detectedMeta?.hasCompetenceMismatch &&
        state.detectedMeta.detectedCompetenceMonth ? (
          <Alert variant="warning">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-start gap-2">
                <AlertCircle
                  className="size-4 shrink-0 mt-0.5 text-warning-strong"
                  aria-hidden="true"
                />
                <div className="text-xs space-y-0.5">
                  <p className="font-semibold text-foreground">
                    Divergência de Competência Detectada
                  </p>
                  <p className="text-muted-foreground">
                    {state.detectedMeta.competenceMismatchWarning}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={state.handleDismissCompetenceMismatch}
                >
                  Manter {monthLabel(state.activeCompetenceMonth)}
                </Button>
                <Button
                  type="button"
                  size="xs"
                  onClick={() =>
                    void state.handleSwitchCompetence(
                      state.detectedMeta!.detectedCompetenceMonth!,
                    )
                  }
                >
                  Ajustar para {monthLabel(state.detectedMeta.detectedCompetenceMonth)}
                </Button>
              </div>
            </div>
          </Alert>
        ) : null}

        {state.detectedMeta?.hasCardMismatch ? (
          <Alert variant="warning">
            <div className="flex items-start gap-2 text-xs">
              <AlertCircle
                className="size-4 shrink-0 mt-0.5 text-warning-strong"
                aria-hidden="true"
              />
              <div className="space-y-0.5">
                <p className="font-semibold text-foreground">
                  Aviso de Compatibilidade de Cartão
                </p>
                <p className="text-muted-foreground">
                  {state.detectedMeta.cardMismatchWarning}
                </p>
              </div>
            </div>
          </Alert>
        ) : null}

        {state.step === "upload" ? (
          <StatementUploadStep
            onFileSelect={(file) => void state.handleFileSelect(file)}
            onFilesSelect={(files) => void state.handleFilesSelect(files)}
            onTextSubmit={(text) => void state.handleTextSubmit(text)}
            isProcessing={state.isReadingFile}
          />
        ) : state.step === "mapping" && state.columnMapping ? (
          <StatementMappingStep
            rows={state.parsedRows}
            initialMapping={state.columnMapping}
            onConfirmMapping={state.handleConfirmMapping}
            onBack={() => state.setStep("upload")}
            formId={mappingFormId}
            hideFooter
          />
        ) : state.step === "reconcile" ? (
          <StatementReconcileStep
            items={state.reconciledItems}
            unmatchedAppExpenses={state.unmatchedAppExpenses}
            categories={state.categories}
            usedAiStructurer={state.usedAiStructurer}
            printedTotalCents={state.printedTotalCents}
            detectedMeta={state.detectedMeta}
            onOpenMapping={state.canOpenMapping ? () => state.setStep("mapping") : undefined}
            onToggleItem={state.handleToggleItem}
            onToggleAll={state.handleToggleAll}
            onChangeCategory={state.handleChangeCategory}
            onEditItem={state.handleEditItem}
            onRemoveItem={state.handleRemoveItem}
            onAddManualItem={state.handleAddManualItem}
            onUncheckDuplicates={state.handleUncheckDuplicates}
            isBusinessModeEnabled={state.isBusinessModeEnabled}
            onToggleScope={state.handleToggleScope}
            onSetScopeAll={state.handleSetScopeAll}
            onBack={handleBackFromReconcile}
            onConfirm={() => void state.handleConfirmImport()}
            isPending={state.isPending}
            importProgress={state.importProgress}
            hideFooter
          />
        ) : null}
      </div>
    </Modal>
  );
}

/**
 * Modal orquestrador de Importação e Reconciliação Inteligente de Faturas (Fase 30).
 * Segue o padrão "Modal Content with Key Pattern" para isolar o estado do wizard por cartão.
 */
export function StatementImportDialog({
  open,
  onOpenChange,
  card,
  competenceMonth,
  userId,
  isReadOnlyMode,
  aiExtractionEnabled,
  onCompetenceChange,
}: StatementImportDialogProps) {
  if (!open || !card) return null;

  return (
    <StatementImportContent
      key={card.id}
      open={open}
      onOpenChange={onOpenChange}
      card={card}
      competenceMonth={competenceMonth}
      userId={userId}
      isReadOnlyMode={isReadOnlyMode}
      aiExtractionEnabled={aiExtractionEnabled}
      onCompetenceChange={onCompetenceChange}
    />
  );
}
