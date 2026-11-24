import { useId, useState } from "react";
import { AlertCircle, ArrowRight, Briefcase, CalendarClock, Check, FileUp, RotateCcw } from "lucide-react";
import { Alert, Badge, Button, Modal, ModalFooter } from "@/components/ui";
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
  const [confirmBackDiscard, setConfirmBackDiscard] = useState(false);
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
    if (state.hasUnsavedChanges && !confirmBackDiscard) {
      setConfirmBackDiscard(true);
      return;
    }
    setConfirmBackDiscard(false);
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
        {confirmBackDiscard ? (
          <div className="flex flex-wrap items-center justify-between gap-2 w-full">
            <span className="text-xs font-medium text-warning-strong">
              Descartar alterações feitas nesta conferência?
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmBackDiscard(false)}
              >
                Continuar editando
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleBackFromReconcile}
              >
                Descartar e voltar
              </Button>
            </div>
          </div>
        ) : (
          <>
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
          </>
        )}
      </ModalFooter>
    ) : undefined;

  const businessHeaderBadge =
    card.scope === "business" ? (
      <Badge size="xs" variant="portfolio" className="gap-1">
        <Briefcase className="size-3" aria-hidden="true" />
        Cartão PJ / Negócio
      </Badge>
    ) : undefined;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Importar Fatura — ${card.name}`}
      description={`Competência de ${monthLabel(state.activeCompetenceMonth)} · Concilie faturas via PDF, CSV, OFX, Excel, prints ou texto colado.`}
      size="2xl"
      headerActions={businessHeaderBadge}
      footer={footer}
      isDirty={state.step === "reconcile" && state.hasUnsavedChanges}
      confirmDiscard
      discardTitle="Descartar alterações da conferência?"
      discardDescription="Você realizou ajustes nesta fatura que ainda não foram importados. Se fechar agora, essas alterações serão perdidas."
      discardConfirmLabel="Descartar"
      discardCancelLabel="Continuar conferindo"
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

        {state.step === "competence_conflict" && state.detectedMeta?.detectedCompetenceMonth ? (
          <div className="rounded-2xl border border-warning/30 bg-surface p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-warning/25 bg-warning/15 text-warning-strong">
                <CalendarClock className="size-5" aria-hidden="true" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-display text-base font-bold text-foreground">
                  Divergência de Competência Detectada
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  O arquivo anexado aparenta pertencer à fatura de{" "}
                  <strong className="text-foreground">
                    {monthLabel(state.detectedMeta.detectedCompetenceMonth)}
                  </strong>
                  , mas a importação atual foi aberta em{" "}
                  <strong className="text-foreground">
                    {monthLabel(state.activeCompetenceMonth)}
                  </strong>
                  .
                </p>
                {state.detectedMeta.detectedDueDate ? (
                  <p className="text-xs text-muted-foreground">
                    Vencimento detectado no documento:{" "}
                    <strong className="text-foreground">
                      {state.detectedMeta.detectedDueDate.split("-").reverse().join("/")}
                    </strong>
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2.5 pt-2 border-t border-border/60">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={state.isReadingFile}
                onClick={state.handleConfirmKeepCurrentCompetence}
                className="text-xs text-muted-foreground hover:text-foreground sm:mr-auto"
              >
                Manter {monthLabel(state.activeCompetenceMonth)} mesmo assim
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={state.isReadingFile}
                onClick={state.handleCancelCompetenceConflict}
                className="gap-1.5"
              >
                <FileUp className="size-3.5" aria-hidden="true" />
                Conferir e anexar outro arquivo
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={state.isReadingFile}
                onClick={() =>
                  void state.handleSwitchCompetence(
                    state.detectedMeta!.detectedCompetenceMonth!,
                  )
                }
                className="gap-1.5"
              >
                <span>
                  Ajustar para {monthLabel(state.detectedMeta.detectedCompetenceMonth)} e prosseguir
                </span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>
        ) : null}

        {state.step !== "competence_conflict" && state.detectedMeta?.hasCardMismatch ? (
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
            pendingPasswordFile={state.pendingPasswordFile}
            passwordError={state.passwordError}
            onPasswordSubmit={state.handlePasswordSubmit}
            onPasswordCancel={state.handlePasswordCancel}
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
            isBusinessModeEnabled={state.showScopeControls}
            onToggleScope={state.handleToggleScope}
            onSetScopeAll={state.handleSetScopeAll}
            onToggleProjectSeries={state.handleToggleProjectSeries}
            onLinkAndAdjust={state.handleLinkAndAdjust}
            onCreateRefund={state.handleCreateRefund}
            onApplyCategoryBatch={state.handleApplyCategoryBatch}
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
