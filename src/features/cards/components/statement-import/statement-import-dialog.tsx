import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, Briefcase, Check, CreditCard as CardIcon, RotateCcw } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  Modal,
  ModalFooter,
  Stepper,
} from "@/components/ui";
import { monthLabel } from "@/lib/date";
import type { CreditCard } from "@/types";
import { StatementCompetenceConflict } from "./statement-competence-conflict";
import { StatementMappingFallback } from "./statement-mapping-fallback";
import { StatementReconcileStep } from "./statement-reconcile-step";
import { StatementSuccessStep } from "./statement-success-step";
import { StatementUploadStep } from "./statement-upload-step";
import { useStatementImport } from "./use-statement-import";

export interface StatementImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: CreditCard | null;
  cards?: readonly CreditCard[];
  competenceMonth: string;
  userId?: string | null;
  isReadOnlyMode?: boolean;
  aiExtractionEnabled?: boolean;
  onCompetenceChange?: (newMonth: string) => void;
  onCardChange?: (newCard: CreditCard) => void;
  onPayBillNow?: () => void;
}

const WIZARD_STEPS = ["Enviar fatura", "Conferir e importar"];

function StatementImportContent({
  open,
  onOpenChange,
  card,
  cards,
  competenceMonth,
  userId,
  isReadOnlyMode,
  aiExtractionEnabled,
  onCompetenceChange,
  onCardChange,
  onPayBillNow,
}: Omit<StatementImportDialogProps, "card"> & { card: CreditCard }) {
  const mappingFormId = useId();
  const errorAlertRef = useRef<HTMLDivElement>(null);
  const [discardBackOpen, setDiscardBackOpen] = useState(false);

  const state = useStatementImport({
    card,
    availableCards: cards,
    competenceMonth,
    userId,
    isReadOnlyMode,
    aiExtractionEnabled,
    onClose: () => onOpenChange(false),
    onCompetenceChange,
    onCardChange,
  });

  useEffect(() => {
    if (state.error && state.step !== "reconcile") {
      errorAlertRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    }
  }, [state.error, state.step]);

  const navigateBackFromReconcile = () => {
    if (state.canAdjustColumns) state.setStep("mapping");
    else state.setStep("upload");
  };

  const handleBackFromReconcile = () => {
    if (state.isDirty) {
      setDiscardBackOpen(true);
      return;
    }
    navigateBackFromReconcile();
  };

  const actionCount = state.reconciliationPlan.totalActionCount;
  const isCommitDisabled =
    state.isPending ||
    state.isSwitchingCard ||
    Boolean(isReadOnlyMode) ||
    state.billProtection.isRolledOver ||
    state.hasUnconfirmedCardMismatch;

  const footer =
    state.step === "mapping" ? (
      <ModalFooter borderless>
        <Button type="button" variant="outline" onClick={() => state.setStep("upload")} className="gap-1.5">
          <RotateCcw className="size-4" aria-hidden="true" />
          Voltar
        </Button>
        <Button type="submit" form={mappingFormId}>
          Avançar para conferência
        </Button>
      </ModalFooter>
    ) : state.step === "reconcile" ? (
      <ModalFooter borderless>
        <Button type="button" variant="outline" onClick={handleBackFromReconcile} disabled={state.isPending} className="gap-1.5">
          <RotateCcw className="size-4" aria-hidden="true" />
          Voltar
        </Button>
        {state.commitRetryState ? (
          <Button type="button" sensoryIntent={false} disabled={state.isPending} onClick={() => void state.handleRetryPendingChunks()}>
            Tentar novamente
          </Button>
        ) : (
          <Button
            type="button"
            sensoryIntent={false}
            disabled={isCommitDisabled}
            onClick={() => void state.handleConfirmImport()}
            className="gap-1.5"
          >
            <Check className="size-4" aria-hidden="true" />
            <span>
              {state.billProtection.isRolledOver
                ? "Importação bloqueada"
                : state.isPending
                  ? state.importProgress && state.importProgress.totalChunks > 1
                    ? `Importando (${state.importProgress.percent}%)...`
                    : "Importando..."
                  : actionCount > 0
                    ? `Aplicar e importar (${actionCount} ${actionCount === 1 ? "ação" : "ações"})`
                    : "Concluir conferência"}
            </span>
          </Button>
        )}
      </ModalFooter>
    ) : state.step === "success" && state.commitSummary ? (
      <ModalFooter borderless>
        <Button
          type="button"
          variant={state.commitSummary.openBalanceAfterCents > 0 && onPayBillNow ? "outline" : "default"}
          onClick={() => onOpenChange(false)}
        >
          Concluir
        </Button>
        {state.commitSummary.openBalanceAfterCents > 0 && onPayBillNow ? (
          <Button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onPayBillNow();
            }}
            className="gap-1.5"
          >
            <CardIcon className="size-4" aria-hidden="true" />
            Pagar fatura agora
          </Button>
        ) : null}
      </ModalFooter>
    ) : undefined;

  const stepperCurrent =
    state.step === "upload" || state.step === "competence_conflict" || state.step === "mapping"
      ? 1
      : state.step === "reconcile"
        ? 2
        : 3;

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={`Importar fatura — ${state.activeCard.name}`}
        description={`Competência de ${monthLabel(state.activeCompetenceMonth)}`}
        size="2xl"
        headerActions={
          state.activeCard.scope === "business" ? (
            <Badge size="xs" variant="portfolio" className="gap-1">
              <Briefcase className="size-3" aria-hidden="true" />
              Cartão Profissional
            </Badge>
          ) : undefined
        }
        footer={footer}
        isDirty={state.step === "reconcile" && state.isDirty}
        confirmDiscard
        discardTitle="Descartar alterações da conferência?"
        discardDescription="Você realizou ajustes nesta fatura que ainda não foram aplicados. Se fechar agora, essas alterações serão descartadas."
        discardConfirmLabel="Descartar"
        discardCancelLabel="Continuar conferindo"
      >
        <div className="space-y-4">
          <Stepper steps={WIZARD_STEPS} current={stepperCurrent} />

          {state.error && state.step !== "reconcile" ? (
            <div ref={errorAlertRef}>
              <Alert variant="error">
                <div className="flex items-center gap-2 text-xs">
                  <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                  <span>{state.error}</span>
                </div>
              </Alert>
            </div>
          ) : null}

          {state.step === "competence_conflict" && state.detectedMeta?.detectedCompetenceMonth ? (
            <StatementCompetenceConflict
              detectedCompetenceMonth={state.detectedMeta.detectedCompetenceMonth}
              activeCompetenceMonth={state.activeCompetenceMonth}
              detectedDueDate={state.detectedMeta.detectedDueDate}
              isBusy={state.isReadingFile}
              onKeepCurrent={() => void state.handleConfirmKeepCurrentCompetence()}
              onChangeFile={state.handleCancelCompetenceConflict}
              onSwitchCompetence={(target) => void state.handleSwitchCompetence(target)}
            />
          ) : state.step === "upload" ? (
            <StatementUploadStep
              onFileSelect={(file) => void state.handleFileSelect(file)}
              onFilesSelect={(files) => void state.handleFilesSelect(files)}
              onTextSubmit={(text) => void state.handleTextSubmit(text)}
              isProcessing={state.isReadingFile}
              processingMessage={state.readingStatusMessage}
              onCancelProcessing={state.handleCancelProcessing}
              pendingPasswordFile={state.pendingPasswordFile}
              passwordError={state.passwordError}
              onPasswordSubmit={(pw) => void state.handlePasswordSubmit(pw)}
              onPasswordCancel={state.handlePasswordCancel}
            />
          ) : state.step === "mapping" ? (
            <StatementMappingFallback
              rows={state.parsedRows}
              initialMapping={state.columnMapping}
              onConfirmMapping={(mapping) => void state.handleConfirmMapping(mapping)}
              onBack={() => state.setStep("upload")}
              formId={mappingFormId}
              hideFooter
            />
          ) : state.step === "reconcile" ? (
            <StatementReconcileStep
              items={state.reconciledItems}
              unmatchedAppExpenses={state.unmatchedAppExpenses}
              appDuplicates={state.appDuplicates}
              competenceMonth={state.activeCompetenceMonth}
              closingDay={state.activeCard.closing_day}
              categories={state.categories}
              qualityGate={state.qualityGate}
              printedTotalCents={state.printedTotalCents}
              detectedMeta={state.detectedMeta}
              aiStatusNotice={state.aiStatusNotice}
              error={state.error}
              billProtection={state.billProtection}
              plan={state.reconciliationPlan}
              activeTab={state.activeCanonicalTab}
              onTabChange={state.setActiveCanonicalTab}
              canonicalCounts={state.canonicalTabCounts}
              searchQuery={state.searchQuery}
              onSearchChange={state.setSearchQuery}
              sortMode={state.sortMode}
              onSortModeChange={state.setSortMode}
              matchedCardForMismatch={state.matchedCardForMismatch}
              hasUnconfirmedCardMismatch={state.hasUnconfirmedCardMismatch}
              onSwitchCard={state.handleSwitchCard}
              onConfirmCardMismatch={state.confirmCardMismatch}
              queuedDeleteExpenseIds={state.queuedDeleteExpenseIds}
              approvedCompetenceMoveTxIds={state.approvedCompetenceMoveTxIds}
              suppressedMicroAdjustmentExpenseIds={state.suppressedMicroAdjustmentExpenseIds}
              showScopeControls={state.showScopeControls}
              canAdjustColumns={state.canAdjustColumns}
              onOpenMapping={state.canAdjustColumns ? () => state.setStep("mapping") : undefined}
              onChangeFile={state.handleChangeFile}
              onToggleItem={state.handleToggleItem}
              onToggleTabItems={state.handleToggleTabItems}
              onChangeCategory={state.handleChangeCategory}
              onEditItem={state.handleEditItem}
              onRemoveItem={state.handleRemoveItem}
              onAddManualItem={state.handleAddManualItem}
              onToggleScope={state.handleToggleScope}
              onSetScopeAll={state.handleSetScopeAll}
              onToggleProjectSeries={state.handleToggleProjectSeries}
              onLinkAndAdjust={state.handleLinkAndAdjust}
              onUndoLinkAndAdjust={state.handleUndoLinkAndAdjust}
              onQueueDeleteAppExpense={state.handleQueueDeleteAppExpense}
              onUndoDeleteAppExpense={state.handleUndoDeleteAppExpense}
              onApproveCompetenceMove={state.handleApproveCompetenceMove}
              onApproveAllCrossCompetenceMoves={() => state.handleApproveAllCrossCompetenceMoves()}
              onMoveExpenseToCompetence={state.handleMoveExpenseToCompetence}
              onToggleSuppressMicroAdjustment={state.handleToggleSuppressMicroAdjustment}
              onRestoreIgnoredPayment={state.handleRestoreIgnoredPayment}
              onApplyCategoryBatch={state.handleApplyCategoryBatch}
              isPending={state.isPending}
              importProgress={state.importProgress}
            />
          ) : state.step === "success" && state.commitSummary ? (
            <StatementSuccessStep
              cardName={state.activeCard.name}
              competenceMonth={state.activeCompetenceMonth}
              summary={state.commitSummary}
            />
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={discardBackOpen}
        onOpenChange={setDiscardBackOpen}
        title="Descartar alterações da conferência?"
        description="Você realizou ajustes nesta conferência que ainda não foram salvos. Deseja voltar e descartá-los?"
        confirmLabel="Descartar e voltar"
        cancelLabel="Continuar conferindo"
        variant="destructive"
        onConfirm={() => {
          setDiscardBackOpen(false);
          state.resetStagingState();
          navigateBackFromReconcile();
        }}
      />
    </>
  );
}

/**
 * Orquestrador modular da Importação e Conciliação de Faturas de Cartão (Onda 4).
 */
export function StatementImportDialog(props: StatementImportDialogProps) {
  if (!props.open || !props.card) return null;
  return <StatementImportContent key={props.card.id} {...props} card={props.card} />;
}
