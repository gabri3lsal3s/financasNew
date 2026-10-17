import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Stepper } from "@/components/ui/stepper";
import {
  analyzeBackupDuplicates,
  applyDeduplicationStrategy,
  RESTORE_MODULES,
  type BackupData,
  type BackupPayload,
  type RestoreModuleKey,
} from "@/domain/export";
import { fetchAllUserData } from "@/data/repositories/export";
import { useRestoreBackup } from "@/state";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { StepValidation } from "./step-validation";
import { StepModuleSelection } from "./step-module-selection";
import { StepDeduplication } from "./step-deduplication";
import { StepConfirmation } from "./step-confirmation";
import {
  WIZARD_STEP_LABELS,
  type RestoreWizardState,
} from "./restore-wizard-types";

export interface RestoreWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  initialFile?: File | null;
}

const DEFAULT_STATE: RestoreWizardState = {
  step: 1,
  file: null,
  parsedPayload: null,
  selectedModules: new Set<RestoreModuleKey>(RESTORE_MODULES.map((m) => m.key)),
  strategy: "skip",
  analysis: null,
  isRestoring: false,
  isDone: false,
  error: null,
  executionSummary: null,
};

export function RestoreWizardDialog({
  open,
  onOpenChange,
  onSuccess,
  initialFile,
}: RestoreWizardDialogProps) {
  const [state, setState] = useState<RestoreWizardState>(() => {
    return { ...DEFAULT_STATE, file: initialFile ?? null };
  });
  const [existingData, setExistingData] = useState<BackupData | null>(null);
  const [fetchingExisting, setFetchingExisting] = useState(false);
  const [restoredCount, setRestoredCount] = useState(0);

  const restoreMutation = useRestoreBackup();

  const handleClose = () => {
    if (state.isRestoring) return;
    onOpenChange(false);
    // Reset após animação
    setTimeout(() => {
      setState(DEFAULT_STATE);
      setExistingData(null);
    }, 300);
  };

  const handleFileLoaded = (file: File, payload: BackupPayload) => {
    triggerSensory("success");
    setState((prev) => ({
      ...prev,
      file,
      parsedPayload: payload,
      error: null,
    }));
  };

  const handleClearFile = () => {
    setState((prev) => ({
      ...prev,
      file: null,
      parsedPayload: null,
      analysis: null,
      error: null,
    }));
  };

  const handleToggleModule = (modKey: RestoreModuleKey) => {
    setState((prev) => {
      const next = new Set(prev.selectedModules);
      if (next.has(modKey)) {
        next.delete(modKey);
      } else {
        next.add(modKey);
      }
      return { ...prev, selectedModules: next };
    });
  };

  const handleSelectAllModules = () => {
    setState((prev) => ({
      ...prev,
      selectedModules: new Set(RESTORE_MODULES.map((m) => m.key)),
    }));
  };

  const handleClearAllModules = () => {
    setState((prev) => ({
      ...prev,
      selectedModules: new Set(),
    }));
  };

  const handleGoToStep2 = () => {
    if (!state.parsedPayload) return;
    triggerSensory("action");
    setState((prev) => ({ ...prev, step: 2, error: null }));
  };

  const handleGoToStep3 = async () => {
    if (state.selectedModules.size === 0 || !state.parsedPayload) return;

    triggerSensory("action");
    setFetchingExisting(true);
    setState((prev) => ({ ...prev, error: null }));

    try {
      let currentExisting = existingData;
      if (!currentExisting) {
        const livePayload = await fetchAllUserData();
        currentExisting = livePayload.data;
        setExistingData(livePayload.data);
      }

      const analysis = analyzeBackupDuplicates(
        state.parsedPayload.data,
        currentExisting,
      );

      setState((prev) => ({
        ...prev,
        step: 3,
        analysis,
      }));
    } catch {
      // Se falhar ao ler dados existentes (ex.: offline), permite prosseguir com dados vazios
      const analysis = analyzeBackupDuplicates(state.parsedPayload.data, {});
      setState((prev) => ({
        ...prev,
        step: 3,
        analysis,
      }));
    } finally {
      setFetchingExisting(false);
    }
  };

  const handleGoToStep4 = () => {
    if (!state.parsedPayload) return;
    triggerSensory("action");

    const { summary } = applyDeduplicationStrategy({
      backupData: state.parsedPayload.data,
      existingData: existingData ?? {},
      selectedModules: state.selectedModules,
      strategy: state.strategy,
    });

    setState((prev) => ({
      ...prev,
      step: 4,
      executionSummary: summary,
      error: null,
    }));
  };

  const handleExecuteRestore = async () => {
    if (!state.parsedPayload) return;
    triggerSensory("action");
    setState((prev) => ({ ...prev, isRestoring: true, error: null }));

    try {
      const { finalData, summary } = applyDeduplicationStrategy({
        backupData: state.parsedPayload.data,
        existingData: existingData ?? {},
        selectedModules: state.selectedModules,
        strategy: state.strategy,
      });

      const payloadToRestore: BackupPayload = {
        version: state.parsedPayload.version,
        app: state.parsedPayload.app,
        exportedAt: new Date().toISOString(),
        data: finalData,
      };

      const result = await restoreMutation.mutateAsync(payloadToRestore);
      const totalProcessed = Object.values(result).reduce(
        (acc: number, curr) => acc + (typeof curr === "number" ? curr : 0),
        0,
      );

      triggerSensory("success");
      setRestoredCount(totalProcessed > 0 ? totalProcessed : summary.totalToInsert);
      setState((prev) => ({
        ...prev,
        isRestoring: false,
        isDone: true,
      }));
    } catch (err) {
      triggerSensory("error");
      setState((prev) => ({
        ...prev,
        isRestoring: false,
        error: getErrorMessage(err),
      }));
    }
  };

  const handleDone = () => {
    onSuccess?.();
    handleClose();
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
      title="Assistente de Restauração de Backup"
      size="xl"
    >
      <div className="flex flex-col gap-6 pt-2">
        <Stepper steps={[...WIZARD_STEP_LABELS]} current={state.step} />

        {state.error ? <Alert variant="error">{state.error}</Alert> : null}

        {state.step === 1 && (
          <StepValidation
            file={state.file}
            parsedPayload={state.parsedPayload}
            onFileLoaded={handleFileLoaded}
            onClearFile={handleClearFile}
            disabled={state.isRestoring}
          />
        )}

        {state.step === 2 && state.parsedPayload && (
          <StepModuleSelection
            payload={state.parsedPayload}
            selectedModules={state.selectedModules}
            onToggleModule={handleToggleModule}
            onSelectAll={handleSelectAllModules}
            onClearAll={handleClearAllModules}
            disabled={state.isRestoring || fetchingExisting}
          />
        )}

        {state.step === 3 && state.analysis && (
          <StepDeduplication
            analysis={state.analysis}
            selectedModules={state.selectedModules}
            strategy={state.strategy}
            onStrategyChange={(strat) =>
              setState((prev) => ({ ...prev, strategy: strat }))
            }
            disabled={state.isRestoring}
          />
        )}

        {state.step === 4 && (
          <StepConfirmation
            selectedModules={state.selectedModules}
            strategy={state.strategy}
            executionSummary={state.executionSummary}
            isRestoring={state.isRestoring}
            isDone={state.isDone}
            restoredCount={restoredCount}
          />
        )}

        {/* Rodapé unificado de ações do Wizard */}
        <ModalFooter className="sm:justify-between">
          <div>
            {!state.isDone && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={state.isRestoring}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {state.step > 1 && !state.isDone && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    step: (prev.step - 1) as 1 | 2 | 3,
                    error: null,
                  }))
                }
                disabled={state.isRestoring || fetchingExisting}
                className="gap-1.5 flex-1 sm:flex-initial"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                <span>Voltar</span>
              </Button>
            )}

            {state.step === 1 && (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleGoToStep2}
                disabled={!state.parsedPayload || state.isRestoring}
                className="gap-1.5 flex-1 sm:flex-initial"
              >
                <span>Avançar para Módulos</span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            )}

            {state.step === 2 && (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleGoToStep3}
                disabled={state.selectedModules.size === 0 || fetchingExisting}
                className="gap-1.5 flex-1 sm:flex-initial"
              >
                <span>{fetchingExisting ? "Analisando dados..." : "Avançar para Desduplicação"}</span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            )}

            {state.step === 3 && (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleGoToStep4}
                className="gap-1.5 flex-1 sm:flex-initial"
              >
                <span>Avançar para Confirmação</span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            )}

            {state.step === 4 && !state.isDone && (
              <Button
                type="button"
                variant={state.strategy === "wipe_all" ? "destructive" : "default"}
                size="sm"
                onClick={handleExecuteRestore}
                disabled={state.isRestoring}
                className="gap-1.5 flex-1 sm:flex-initial"
              >
                <Check className="size-4" aria-hidden="true" />
                <span>{state.isRestoring ? "Restaurando..." : "Confirmar Restauração"}</span>
              </Button>
            )}

            {state.isDone && (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleDone}
                className="gap-1.5 w-full sm:w-auto"
              >
                <Check className="size-4" aria-hidden="true" />
                <span>Concluir</span>
              </Button>
            )}
          </div>
        </ModalFooter>
      </div>
    </Modal>
  );
}
